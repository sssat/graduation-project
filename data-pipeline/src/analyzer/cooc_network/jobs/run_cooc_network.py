# data-pipeline/src/analyzer/cooc_network/jobs/run_cooc_network.py
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings

from src.analyzer.cooc_network.core.cooc_network import build_cooc_network
from src.analyzer.cooc_network.preprocess.cooc_preprocess import (
    CoocPreprocessOptions,
    default_cooc_preprocess_options_from_settings,
)
from src.analyzer.cooc_network.tokenize.cooc_tokenize import (
    CoocTokenizeOptions,
    default_cooc_tokenize_options_from_settings,
    default_cooc_stopwords_from_settings,
)
from src.analyzer.cooc_network.storage.cooc_reader import (
    fetch_keyword_seqs_for_trend_run,
    fetch_articles_text_for_cooc,
)
from src.analyzer.cooc_network.storage.cooc_writer import (
    CoocHeaderKey,
    delete_cooc_for_run_periods,
    upsert_cooc_header_and_get_seq,
    replace_cooc_nodes_edges,
)

SUPPORTED_PERIODS = ("TODAY", "D7", "D14", "D30")


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _resolve_trend_run_seq(requested: int) -> int:
    if requested and requested > 0:
        return int(requested)

    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT TREND_RUN_SEQ AS s FROM T_TREND_RUN ORDER BY TREND_RUN_SEQ DESC LIMIT 1")
            row = cur.fetchone()
            if not row:
                raise RuntimeError("T_TREND_RUN이 비어있습니다. 먼저 run_trend를 실행하세요.")
            return int(row["s"])
    finally:
        conn.close()


def _parse_periods(raw: str | None) -> List[str]:
    if not raw:
        return list(SUPPORTED_PERIODS)
    parts = [p.strip().upper() for p in str(raw).split(",") if p.strip()]
    if not parts:
        return list(SUPPORTED_PERIODS)
    out = [p for p in parts if p in SUPPORTED_PERIODS]
    return out if out else list(SUPPORTED_PERIODS)


def _settings_summary_one_line() -> str:
    include_overall = bool(getattr(settings, "cooc_include_overall", True))
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"cooc(text_source={getattr(settings,'cooc_text_source','CONTENT')},"
        f"mode={getattr(settings,'cooc_mode','doc')},"
        f"window={int(getattr(settings,'cooc_window_size',20))},"
        f"min_text_chars={int(getattr(settings,'cooc_min_text_chars',200))},"
        f"max_tokens_per_doc={int(getattr(settings,'cooc_max_tokens_per_doc',60))},"
        f"node_top_k={int(getattr(settings,'cooc_node_top_k',60))},"
        f"edge_top_k={int(getattr(settings,'cooc_edge_top_k',300))},"
        f"min_edge_weight={int(getattr(settings,'cooc_min_edge_weight',2))},"
        f"include_overall={int(include_overall)},"
        f"default_media_code={int(getattr(settings,'cooc_default_media_code',0) or 0)},"
        f"token_len={int(getattr(settings,'cooc_token_min_len',2))}-{int(getattr(settings,'cooc_token_max_len',30))})"
    )


def _ensure_log_dir() -> Path:
    p = Path(settings.log_dir_cooc_network)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _write_json_log(payload: Dict[str, Any]) -> Path:
    log_dir = _ensure_log_dir()
    ts = _now_in_tz().strftime("%Y%m%d_%H%M%S")
    path = log_dir / f"run_cooc_network_{ts}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _get_int_attr(obj: object, names: Sequence[str], default: int = 0) -> int:
    for n in names:
        if hasattr(obj, n):
            try:
                return int(getattr(obj, n) or 0)
            except Exception:
                return default
    return default


def _get_str_attr(obj: object, names: Sequence[str], default: str = "") -> str:
    for n in names:
        if hasattr(obj, n):
            try:
                return str(getattr(obj, n) or "")
            except Exception:
                return default
    return default


def run_cooc(
    *,
    trend_run_seq: int,
    periods: Sequence[str],
    keyword_top_n: int,
    refresh_same_run: bool,
) -> Dict[str, Any]:
    started_at = _now_in_tz()

    trend_run_seq = int(trend_run_seq)
    periods = [str(p).strip().upper() for p in periods if str(p).strip()]
    keyword_top_n = int(keyword_top_n)

    text_source = str(getattr(settings, "cooc_text_source", "CONTENT") or "CONTENT").strip().upper()
    if text_source not in {"TITLE", "CONTENT", "BOTH"}:
        text_source = "CONTENT"

    min_text_chars = int(getattr(settings, "cooc_min_text_chars", 200) or 0)
    min_text_chars = max(0, int(min_text_chars))

    mode = str(getattr(settings, "cooc_mode", "doc") or "doc").strip().lower()
    if mode not in {"doc", "window"}:
        mode = "doc"

    window_size = int(getattr(settings, "cooc_window_size", 20) or 20)
    max_tokens_per_doc = int(getattr(settings, "cooc_max_tokens_per_doc", 60) or 60)
    node_top_k = int(getattr(settings, "cooc_node_top_k", 60) or 60)
    edge_top_k = int(getattr(settings, "cooc_edge_top_k", 300) or 300)
    min_edge_weight = int(getattr(settings, "cooc_min_edge_weight", 2) or 2)

    default_media_code = int(getattr(settings, "cooc_default_media_code", 0) or 0)

    # 전체(미디어 코드 0) 그래프도 같이 만들지 여부 (기본: True)
    include_overall = bool(getattr(settings, "cooc_include_overall", True))
    overall_media_code = 0

    preprocess_opt: CoocPreprocessOptions = default_cooc_preprocess_options_from_settings()
    tokenize_opt: CoocTokenizeOptions = default_cooc_tokenize_options_from_settings()
    stopwords = default_cooc_stopwords_from_settings()

    all_keyword_seqs = fetch_keyword_seqs_for_trend_run(trend_run_seq=trend_run_seq)
    if not all_keyword_seqs:
        raise RuntimeError("T_TREND_KEYWORD_SNAPSHOT에 이번 run의 키워드가 없습니다. run_trend 결과를 확인하세요.")

    if keyword_top_n > 0:
        all_keyword_seqs = all_keyword_seqs[: max(1, keyword_top_n)]

    reset_groups = 0
    if refresh_same_run:
        # media_codes를 제한하지 않으므로, 전체(0) 포함 모든 미디어 코드 결과가 함께 삭제된다.
        reset_groups = delete_cooc_for_run_periods(
            trend_run_seq=trend_run_seq,
            periods=periods,
            keyword_seqs=all_keyword_seqs,
        )

    details: List[Dict[str, Any]] = []
    total_graphs_written = 0
    total_docs_used_sum = 0
    total_rows_selected = 0
    total_rows_skipped_missing_media = 0

    for period in periods:
        rows = fetch_articles_text_for_cooc(
            trend_run_seq=trend_run_seq,
            period_filter=period,
            keyword_seqs=all_keyword_seqs,
            text_source=text_source,
            min_text_chars=min_text_chars,
        )

        total_rows_selected += int(len(rows or []))

        if not rows:
            details.append(
                {
                    "period": period,
                    "keywords": len(all_keyword_seqs),
                    "rows_selected": 0,
                    "media_groups": 0,
                    "graphs_written": 0,
                    "graphs_written_overall": 0,
                    "graphs_written_media": 0,
                    "note": "해당 기간에 공동언급 대상 텍스트가 없습니다.",
                }
            )
            continue

        # (keyword_seq, media_code) 단위로 텍스트를 모은다 (언론사별)
        by_group: Dict[Tuple[int, int], List[str]] = defaultdict(list)

        # keyword_seq 단위로 텍스트를 모은다 (전체: 모든 언론사 합산)
        by_keyword_all: Dict[int, List[str]] = defaultdict(list)

        # cooc_reader가 반환하는 row 타입이 dataclass/record일 수 있으니 속성명 후보를 넉넉히 둔다.
        for r in rows:
            ks = _get_int_attr(r, ["keyword_seq", "KEYWORD_SEQ", "keywordSeq"], default=0)
            if ks <= 0:
                continue

            txt = _get_str_attr(
                r,
                ["text", "TEXT", "content", "CONTENT", "content_clean", "CONTENT_CLEAN"],
                default="",
            )
            if not txt:
                continue

            # 전체 그래프용: 미디어 코드가 없더라도 텍스트가 있으면 포함
            by_keyword_all[int(ks)].append(txt)

            # 언론사별 그래프용: media_code가 유효해야 포함
            mc = _get_int_attr(r, ["media_code", "MEDIA_CODE", "mediaCode"], default=0)
            if mc <= 0:
                if default_media_code > 0:
                    mc = int(default_media_code)
                else:
                    total_rows_skipped_missing_media += 1
                    continue

            by_group[(int(ks), int(mc))].append(txt)

        if not by_group and not (include_overall and by_keyword_all):
            details.append(
                {
                    "period": period,
                    "keywords": len(all_keyword_seqs),
                    "rows_selected": len(rows),
                    "media_groups": 0,
                    "graphs_written": 0,
                    "graphs_written_overall": 0,
                    "graphs_written_media": 0,
                    "note": "그룹을 만들 수 없습니다(media_code 결측 또는 텍스트 비어있음).",
                }
            )
            continue

        graphs_written = 0
        graphs_written_overall = 0
        graphs_written_media = 0

        # 안정적인 진행을 위해 키워드 순서대로 처리하되, 실제로 데이터가 있는 (keyword, media)만 돈다.
        groups_by_keyword: Dict[int, List[int]] = defaultdict(list)
        for (ks, mc) in by_group.keys():
            groups_by_keyword[int(ks)].append(int(mc))
        for ks in groups_by_keyword:
            groups_by_keyword[ks] = sorted(set(groups_by_keyword[ks]))

        for keyword_seq in all_keyword_seqs:
            keyword_seq = int(keyword_seq)

            # 1) 전체(0) 그래프 생성/저장 (키워드별로 모든 언론사 텍스트 합산)
            if include_overall:
                texts_all = by_keyword_all.get(keyword_seq, [])
                if texts_all:
                    nodes, edges, stats = build_cooc_network(
                        texts_all,
                        preprocess_opt=preprocess_opt,
                        tokenize_opt=tokenize_opt,
                        stopwords=set(stopwords),
                        mode=mode,
                        window_size=window_size,
                        max_tokens_per_doc=max_tokens_per_doc,
                        node_top_k=node_top_k,
                        edge_top_k=edge_top_k,
                        min_edge_weight=min_edge_weight,
                    )

                    if nodes and edges:
                        total_docs_used_sum += int(stats.get("docs_used", 0) or 0)

                        graph_seq = upsert_cooc_header_and_get_seq(
                            key=CoocHeaderKey(
                                trend_run_seq=trend_run_seq,
                                keyword_seq=keyword_seq,
                                media_code=int(overall_media_code),
                                period_filter=period,
                            ),
                            node_count=len(nodes),
                            edge_count=len(edges),
                        )

                        replace_cooc_nodes_edges(
                            graph_seq=graph_seq,
                            nodes=nodes,
                            edges=edges,
                        )

                        graphs_written += 1
                        graphs_written_overall += 1
                        total_graphs_written += 1

            # 2) 언론사별 그래프 생성/저장
            mcs = groups_by_keyword.get(keyword_seq, [])
            if not mcs:
                continue

            for media_code in mcs:
                texts = by_group.get((keyword_seq, int(media_code)), [])
                if not texts:
                    continue

                nodes, edges, stats = build_cooc_network(
                    texts,
                    preprocess_opt=preprocess_opt,
                    tokenize_opt=tokenize_opt,
                    stopwords=set(stopwords),
                    mode=mode,
                    window_size=window_size,
                    max_tokens_per_doc=max_tokens_per_doc,
                    node_top_k=node_top_k,
                    edge_top_k=edge_top_k,
                    min_edge_weight=min_edge_weight,
                )

                # 네트워크가 너무 작으면 저장하지 않는다.
                if not nodes or not edges:
                    continue

                total_docs_used_sum += int(stats.get("docs_used", 0) or 0)

                graph_seq = upsert_cooc_header_and_get_seq(
                    key=CoocHeaderKey(
                        trend_run_seq=trend_run_seq,
                        keyword_seq=keyword_seq,
                        media_code=int(media_code),
                        period_filter=period,
                    ),
                    node_count=len(nodes),
                    edge_count=len(edges),
                )

                replace_cooc_nodes_edges(
                    graph_seq=graph_seq,
                    nodes=nodes,
                    edges=edges,
                )

                graphs_written += 1
                graphs_written_media += 1
                total_graphs_written += 1

        details.append(
            {
                "period": period,
                "keywords": len(all_keyword_seqs),
                "rows_selected": len(rows),
                "rows_grouped_media": sum(len(v) for v in by_group.values()),
                "rows_grouped_overall": sum(len(v) for v in by_keyword_all.values()),
                "media_groups": int(len(by_group)),
                "keyword_groups_overall": int(len(by_keyword_all)),
                "graphs_written": int(graphs_written),
                "graphs_written_overall": int(graphs_written_overall),
                "graphs_written_media": int(graphs_written_media),
            }
        )

    ended_at = _now_in_tz()

    return {
        "mode": "cooc_network",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "settings_summary": _settings_summary_one_line(),
        "trend_run_seq": int(trend_run_seq),
        "periods": list(periods),
        "keyword_top_n": int(keyword_top_n),
        "refresh_same_run": bool(refresh_same_run),
        "reset_groups": int(reset_groups),
        "graphs_written": int(total_graphs_written),
        "rows_selected_total": int(total_rows_selected),
        "rows_skipped_missing_media_total": int(total_rows_skipped_missing_media),
        "docs_used_sum": int(total_docs_used_sum),
        "details": details,
        "note": (
            "스키마(A안) 기준: GRAPH/NODE/EDGE에만 저장되며 text_source/mode/window_size는 DB에 저장하지 않습니다. "
            "또한 docs_used_sum은 '그래프 단위 합계'이므로 전체(0) + 언론사별을 함께 만들면 중복 집계될 수 있습니다."
        ),
    }


def main() -> None:
    p = argparse.ArgumentParser(description="공동 언급 네트워크 분석 적재(A안: CO_MENTION_* 스키마)")

    p.add_argument(
        "--trend-run-seq",
        type=int,
        default=int(getattr(settings, "cooc_trend_run_seq", 0) or 0),
        help="대상 TREND_RUN_SEQ (0이면 최신)",
    )
    p.add_argument(
        "--periods",
        type=str,
        default=str(getattr(settings, "cooc_periods", "TODAY,D7,D14,D30") or "TODAY,D7,D14,D30"),
        help="대상 PERIOD_FILTER 목록(콤마). 예: TODAY,D7,D14,D30",
    )
    p.add_argument(
        "--keyword-top-n",
        type=int,
        # 중요: 0을 유지해야 하므로 "or 20" 같은 처리를 하면 안 된다.
        default=int(getattr(settings, "cooc_keyword_top_n", 20)),
        help="이번 run의 키워드 중 상위 N개만 사용(0이면 전체 키워드)",
    )
    p.add_argument(
        "--refresh",
        default=bool(getattr(settings, "cooc_refresh", False)),
        action=argparse.BooleanOptionalAction,
        help="같은 run/period(+선택된 키워드)의 공동언급 결과를 삭제 후 재생성",
    )

    args = p.parse_args()

    started_at = _now_in_tz()

    trend_run_seq = _resolve_trend_run_seq(int(args.trend_run_seq))
    periods = _parse_periods(args.periods)
    keyword_top_n = int(args.keyword_top_n)
    refresh_same_run = bool(args.refresh)

    log_payload: Dict[str, Any] = {
        "started_at": started_at.isoformat(),
        "settings": {
            "env": settings.app_env,
            "tz": settings.tz,
            "db": f"{settings.db_host}:{settings.db_port}/{settings.db_name}",
            "trend_run_seq": int(trend_run_seq),
            "periods": list(periods),
            "keyword_top_n": int(keyword_top_n),
            "refresh": bool(refresh_same_run),
            "cooc": {
                "text_source": str(getattr(settings, "cooc_text_source", "CONTENT")),
                "mode": str(getattr(settings, "cooc_mode", "doc")),
                "window_size": int(getattr(settings, "cooc_window_size", 20)),
                "min_text_chars": int(getattr(settings, "cooc_min_text_chars", 200)),
                "max_tokens_per_doc": int(getattr(settings, "cooc_max_tokens_per_doc", 60)),
                "node_top_k": int(getattr(settings, "cooc_node_top_k", 60)),
                "edge_top_k": int(getattr(settings, "cooc_edge_top_k", 300)),
                "min_edge_weight": int(getattr(settings, "cooc_min_edge_weight", 2)),
                "include_overall": bool(getattr(settings, "cooc_include_overall", True)),
                "default_media_code": int(getattr(settings, "cooc_default_media_code", 0) or 0),
                "tokenize": {
                    "min_len": int(getattr(settings, "cooc_token_min_len", 2)),
                    "max_len": int(getattr(settings, "cooc_token_max_len", 30)),
                    "drop_numeric_only": bool(getattr(settings, "cooc_drop_numeric_only", True)),
                },
            },
            "log_dir": str(settings.log_dir_cooc_network),
        },
        "result": None,
        "error": None,
        "finished_at": None,
        "summary": None,
    }

    print(_settings_summary_one_line())

    try:
        result = run_cooc(
            trend_run_seq=trend_run_seq,
            periods=periods,
            keyword_top_n=keyword_top_n,
            refresh_same_run=refresh_same_run,
        )
        finished_at = _now_in_tz()
        log_payload["result"] = result
        log_payload["finished_at"] = finished_at.isoformat()
        log_payload["summary"] = {
            "trend_run_seq": int(result.get("trend_run_seq", trend_run_seq)),
            "periods": list(result.get("periods", periods)),
            "graphs_written": int(result.get("graphs_written", 0)),
            "reset_groups": int(result.get("reset_groups", 0)),
            "duration_seconds": int((finished_at - started_at).total_seconds()),
        }

        log_path = _write_json_log(log_payload)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print(f"[cooc_network] done. log={log_path}")
    except Exception as e:
        finished_at = _now_in_tz()
        log_payload["error"] = repr(e)
        log_payload["finished_at"] = finished_at.isoformat()
        log_payload["summary"] = {
            "trend_run_seq": int(trend_run_seq),
            "periods": list(periods),
            "graphs_written": 0,
            "reset_groups": 0,
            "duration_seconds": int((finished_at - started_at).total_seconds()),
        }
        log_path = _write_json_log(log_payload)
        print(f"[cooc_network] error. log={log_path}")
        raise


if __name__ == "__main__":
    main()
