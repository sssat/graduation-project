# data-pipeline/src/analyzer/wordcloud/jobs/run_wordcloud.py
# 워드클라우드(TITLE/CONTENT/COMMENT) 생성 + DB 적재 엔트리포인트
#
# 설계:
# - 기본값은 settings(.env)에서 읽고, CLI는 필요할 때만 덮어쓰기(override)
# - 키워드 목록은 "스냅샷 순위(T_TREND_KEYWORD_SNAPSHOT.TREND_RANK)" 기준
# - (run, keyword, media, period, type) 조합마다:
#   1) 입력 텍스트 조회(reader)
#   2) 추가 전처리(preprocess)
#   3) 토큰화(tokenize)
#   4) 워드클라우드 상위 K 계산(core)
#   5) 헤더 upsert + 아이템 replace(writer)
#
# 실행 예:
#   python -m src.analyzer.wordcloud.jobs.run_wordcloud
#   python -m src.analyzer.wordcloud.jobs.run_wordcloud --trend-run-seq 15 --periods TODAY,D7,D14 --types TITLE,CONTENT --refresh
#
# 주의:
# - run_wordcloud의 실행 옵션(대상 run/기간/타입/refresh/media_codes)은 반드시 .env에 등록하고
#   settings를 통해 읽도록 구성한다.
# - 토큰화 단계에서 불용어 파일을 매번 읽지 않도록, stopwords/options는 1회 로드 후 재사용한다.

from __future__ import annotations

import argparse
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings

from src.analyzer.wordcloud.storage.wdc_reader import (
    PERIOD_D14,
    PERIOD_D7,
    PERIOD_TODAY,
    WC_COMMENT,
    WC_CONTENT,
    WC_TITLE,
    get_base_date_for_run,
    get_latest_trend_run_seq,
    resolve_date_window,
    select_article_texts_for_group,
    select_comment_texts_for_group,
    select_keyword_name,
    select_keywords_for_wordcloud,
)
from src.analyzer.wordcloud.preprocess.wdc_preprocess import preprocess_many_for_wordcloud
from src.analyzer.wordcloud.tokenize.wdc_tokenize import (
    TokenizeOptions,
    default_stopwords_from_settings,
    default_tokenize_options_from_settings,
    tokenize_many,
)
from src.analyzer.wordcloud.core.wordcloud import build_wordcloud_items_from_tokens
from src.analyzer.wordcloud.storage.wdc_writer import WordcloudItem as DbWordcloudItem
from src.analyzer.wordcloud.storage.wdc_writer import replace_wordcloud_items, upsert_wordcloud_header


_ALLOWED_PERIODS = {PERIOD_TODAY, PERIOD_D7, PERIOD_D14}
_ALLOWED_TYPES = {WC_TITLE, WC_CONTENT, WC_COMMENT}


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _parse_csv_upper(raw: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for part in (raw or "").split(","):
        s = part.strip().upper()
        if not s:
            continue
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def _resolve_periods(periods_csv: str) -> list[str]:
    raw = (periods_csv or "").strip()
    if not raw:
        raw = "TODAY,D7,D14"

    out: list[str] = []
    for p in _parse_csv_upper(raw):
        if p in _ALLOWED_PERIODS:
            out.append(p)

    if not out:
        out = [PERIOD_TODAY, PERIOD_D7, PERIOD_D14]
    return out


def _resolve_types(types_csv: str) -> list[str]:
    raw = (types_csv or "").strip()
    if not raw:
        raw = "TITLE,CONTENT,COMMENT"

    out: list[str] = []
    for t in _parse_csv_upper(raw):
        if t in _ALLOWED_TYPES:
            out.append(t)

    if not out:
        out = [WC_TITLE, WC_CONTENT, WC_COMMENT]
    return out


def _select_existing_wc_seq(
    *,
    conn,
    trend_run_seq: int,
    keyword_seq: int,
    media_code: int,
    period_filter: str,
    wc_type: str,
) -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT WC_SEQ
            FROM T_ANALYZE_WORDCLOUD
            WHERE TREND_RUN_SEQ = %s
              AND KEYWORD_SEQ = %s
              AND MEDIA_CODE = %s
              AND PERIOD_FILTER = %s
              AND WC_TYPE = %s
            """,
            (int(trend_run_seq), int(keyword_seq), int(media_code), str(period_filter), str(wc_type)),
        )
        row = cur.fetchone() or {}
        wc_seq = row.get("WC_SEQ")
        return int(wc_seq) if wc_seq is not None else None


def _count_items_by_wc_seq(*, conn, wc_seq: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM T_ANALYZE_WORDCLOUD_ITEM
            WHERE WC_SEQ = %s
            """,
            (int(wc_seq),),
        )
        row = cur.fetchone() or {}
        return int(row.get("cnt") or 0)


def _ensure_log_dir() -> Path:
    p = Path(settings.log_dir_wordcloud)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _write_json_log(payload: Dict[str, Any]) -> Path:
    log_dir = _ensure_log_dir()
    ts = _now_in_tz().strftime("%Y%m%d_%H%M%S")
    path = log_dir / f"run_wordcloud_{ts}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _settings_one_line(
    *,
    trend_run_seq: int,
    periods: Sequence[str],
    types: Sequence[str],
    refresh: bool,
    media_codes: Sequence[int],
) -> str:
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"trend_run_seq={trend_run_seq} "
        f"periods={','.join(periods)} "
        f"types={','.join(types)} "
        f"refresh={1 if refresh else 0} "
        f"media_codes={','.join(map(str, media_codes))} "
        f"top_n={settings.wordcloud_top_n} "
        f"top_k={settings.wordcloud_top_k} "
        f"weight_mode={settings.wordcloud_weight_mode}"
    )


def _resolve_media_codes_from_settings() -> list[int]:
    mcs = list(settings.wordcloud_media_codes or ())
    if not mcs:
        mcs = [0]

    # 0(전체) 먼저 나오게(재현성)
    if 0 in mcs:
        mcs = [0] + [x for x in mcs if x != 0]


    # 중복 제거(순서 유지)
    seen: set[int] = set()
    out: list[int] = []
    for x in mcs:
        ix = int(x)
        if ix in seen:
            continue
        seen.add(ix)
        out.append(ix)
    return out


def _build_db_items_from_core(core_items) -> List[DbWordcloudItem]:
    db_items: List[DbWordcloudItem] = []
    for it in core_items:
        db_items.append(
            DbWordcloudItem(
                rank_no=int(it.rank_no),
                word_text=str(it.word_text),
                weight=Decimal(str(it.weight)),
            )
        )
    return db_items


def main() -> None:
    parser = argparse.ArgumentParser(description="워드클라우드 생성 + DB 적재")

    # CLI는 "필요할 때만 override" 용도
    parser.add_argument("--trend-run-seq", type=int, default=None, help="대상 TREND_RUN_SEQ (미지정 시 settings 사용)")
    parser.add_argument("--periods", type=str, default=None, help="기간 목록 (예: TODAY,D7,D14) (미지정 시 settings 사용)")
    parser.add_argument("--types", type=str, default=None, help="타입 목록 (예: TITLE,CONTENT,COMMENT) (미지정 시 settings 사용)")
    parser.add_argument("--refresh", action="store_true", help="기존 결과가 있어도 재계산/덮어쓰기")
    parser.add_argument("--no-refresh", action="store_true", help="refresh 강제 해제(기존 결과 있으면 스킵)")

    args = parser.parse_args()

    # 1) settings(.env) 기본값
    trend_run_seq = int(settings.wordcloud_trend_run_seq)
    periods_csv = str(settings.wordcloud_periods)
    types_csv = str(settings.wordcloud_types)
    refresh = bool(settings.wordcloud_refresh)
    media_codes = _resolve_media_codes_from_settings()

    # 2) CLI override
    if args.trend_run_seq is not None:
        trend_run_seq = int(args.trend_run_seq)

    if args.periods is not None and str(args.periods).strip():
        periods_csv = str(args.periods).strip()

    if args.types is not None and str(args.types).strip():
        types_csv = str(args.types).strip()

    if args.refresh:
        refresh = True
    if args.no_refresh:
        refresh = False

    periods = _resolve_periods(periods_csv)
    types = _resolve_types(types_csv)

    run_started_at = _now_in_tz()

    # 토큰화 옵션/불용어는 1회 로드 후 재사용(그룹마다 파일 읽기 방지)
    tok_opt: TokenizeOptions = default_tokenize_options_from_settings()
    stopwords = default_stopwords_from_settings()

    log: Dict[str, Any] = {
        "started_at": run_started_at.isoformat(),
        "settings": {
            "env": settings.app_env,
            "tz": settings.tz,
            "db": f"{settings.db_host}:{settings.db_port}/{settings.db_name}",
            "trend_run_seq": trend_run_seq,
            "periods": periods,
            "types": types,
            "refresh": refresh,
            "media_codes": media_codes,
            "wordcloud_top_n": settings.wordcloud_top_n,
            "wordcloud_top_k": settings.wordcloud_top_k,
            "wordcloud_weight_mode": settings.wordcloud_weight_mode,
            "tokenize": {
                "min_len": int(tok_opt.min_len),
                "max_len": int(tok_opt.max_len),
                "drop_numeric_only": bool(tok_opt.drop_numeric_only),
                "stopwords_count": int(len(stopwords)),
            },
        },
        "groups": [],
        "summary": {},
    }

    print(_settings_one_line(trend_run_seq=trend_run_seq, periods=periods, types=types, refresh=refresh, media_codes=media_codes))

    with get_conn() as conn:
        # 대상 run 결정
        if trend_run_seq == 0:
            trend_run_seq = get_latest_trend_run_seq(conn=conn)

        base_date = get_base_date_for_run(conn=conn, trend_run_seq=trend_run_seq)

        # 대상 키워드 목록(스냅샷 rank 기준)
        keyword_seqs = select_keywords_for_wordcloud(conn=conn, trend_run_seq=trend_run_seq)

        if not keyword_seqs:
            log["summary"] = {"status": "empty_keywords", "trend_run_seq": trend_run_seq}
            _write_json_log(log)
            print(f"[wordcloud] 키워드가 없습니다. trend_run_seq={trend_run_seq}")
            return

        total_groups = 0
        total_written = 0
        total_skipped = 0
        total_empty = 0
        total_errors = 0

        for keyword_seq in keyword_seqs:
            keyword_name = select_keyword_name(conn=conn, keyword_seq=keyword_seq)

            for period in periods:
                start_date, end_date = resolve_date_window(base_date=base_date, period=period)

                for wc_type in types:
                    for media_code in media_codes:
                        total_groups += 1

                        # refresh=0이면 기존 결과 있으면 스킵(아이템이 1개 이상인 경우에만)
                        if not refresh:
                            existed_wc_seq = _select_existing_wc_seq(
                                conn=conn,
                                trend_run_seq=trend_run_seq,
                                keyword_seq=keyword_seq,
                                media_code=media_code,
                                period_filter=period,
                                wc_type=wc_type,
                            )
                            if existed_wc_seq is not None:
                                cnt = _count_items_by_wc_seq(conn=conn, wc_seq=existed_wc_seq)
                                if cnt > 0:
                                    total_skipped += 1
                                    log["groups"].append(
                                        {
                                            "trend_run_seq": trend_run_seq,
                                            "keyword_seq": keyword_seq,
                                            "keyword_name": keyword_name,
                                            "media_code": media_code,
                                            "period": period,
                                            "wc_type": wc_type,
                                            "status": "skipped_existing",
                                            "existing_wc_seq": existed_wc_seq,
                                            "existing_items": cnt,
                                        }
                                    )
                                    continue

                        # 입력 텍스트 조회
                        if wc_type == WC_COMMENT:
                            rows = select_comment_texts_for_group(
                                conn=conn,
                                trend_run_seq=trend_run_seq,
                                keyword_seq=keyword_seq,
                                media_code=media_code,
                                start_date=start_date,
                                end_date=end_date,
                            )
                        else:
                            rows = select_article_texts_for_group(
                                conn=conn,
                                trend_run_seq=trend_run_seq,
                                keyword_seq=keyword_seq,
                                media_code=media_code,
                                start_date=start_date,
                                end_date=end_date,
                                wc_type=wc_type,
                            )

                        raw_texts = [r.text for r in rows]
                        pre_texts = preprocess_many_for_wordcloud(raw_texts)
                        tokens = tokenize_many(pre_texts, opt=tok_opt, stopwords=stopwords)

                        # 토큰이 없고 refresh=0이면 DB 건드리지 않고 스킵
                        if not tokens and not refresh:
                            total_empty += 1
                            log["groups"].append(
                                {
                                    "trend_run_seq": trend_run_seq,
                                    "keyword_seq": keyword_seq,
                                    "keyword_name": keyword_name,
                                    "media_code": media_code,
                                    "period": period,
                                    "wc_type": wc_type,
                                    "status": "empty_tokens_skip",
                                    "input_rows": len(rows),
                                    "kept_texts": len(pre_texts),
                                    "tokens": 0,
                                }
                            )
                            continue

                        # core 계산
                        items_core = build_wordcloud_items_from_tokens(
                            tokens,
                            top_k=int(settings.wordcloud_top_k),
                            weight_mode=str(settings.wordcloud_weight_mode),
                        )

                        # DB writer 형식으로 변환(Decimal)
                        db_items: List[DbWordcloudItem] = _build_db_items_from_core(items_core)

                        # 저장(헤더 upsert + 아이템 replace)
                        try:
                            wc_seq = upsert_wordcloud_header(
                                conn=conn,
                                trend_run_seq=trend_run_seq,
                                keyword_seq=keyword_seq,
                                media_code=media_code,
                                period_filter=period,
                                wc_type=wc_type,
                            )
                            write_result = replace_wordcloud_items(conn=conn, wc_seq=wc_seq, items=db_items)
                            conn.commit()
                            total_written += 1

                            log["groups"].append(
                                {
                                    "trend_run_seq": trend_run_seq,
                                    "keyword_seq": keyword_seq,
                                    "keyword_name": keyword_name,
                                    "media_code": media_code,
                                    "period": period,
                                    "wc_type": wc_type,
                                    "status": "written",
                                    "wc_seq": wc_seq,
                                    "input_rows": len(rows),
                                    "kept_texts": len(pre_texts),
                                    "tokens": len(tokens),
                                    "items": len(db_items),
                                    "db": write_result,
                                }
                            )
                        except Exception as e:
                            conn.rollback()
                            total_errors += 1
                            total_skipped += 1
                            log["groups"].append(
                                {
                                    "trend_run_seq": trend_run_seq,
                                    "keyword_seq": keyword_seq,
                                    "keyword_name": keyword_name,
                                    "media_code": media_code,
                                    "period": period,
                                    "wc_type": wc_type,
                                    "status": "error",
                                    "error": repr(e),
                                }
                            )

        finished_at = _now_in_tz()
        log["finished_at"] = finished_at.isoformat()
        log["summary"] = {
            "trend_run_seq": trend_run_seq,
            "base_date": str(base_date),
            "total_groups": total_groups,
            "written": total_written,
            "skipped": total_skipped,
            "empty": total_empty,
            "errors": total_errors,
            "duration_seconds": int((finished_at - run_started_at).total_seconds()),
        }

    log_path = _write_json_log(log)
    print(f"[wordcloud] done. log={log_path}")


if __name__ == "__main__":
    main()
