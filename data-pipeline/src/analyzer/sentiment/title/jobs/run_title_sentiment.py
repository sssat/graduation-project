# data-pipeline/src/analyzer/sentiment/title/jobs/run_title_sentiment.py
# 제목 기반 감성분석 실행 엔트리포인트
# - 이번 TREND_RUN_SEQ의 모든 키워드(T_TREND_KEYWORD)를 대상으로 기사 TITLE_CLEAN을 감성분석
# - 기사 단위 soft 확률을 그룹별(키워드×언론사, 키워드×전체)로 평균내어 T_KEYWORD_SENTIMENT에 저장
# - 결과 로그(JSON)를 src/analyzer/sentiment/title/logs에 저장 (환경변수로 경로 조정 가능)
#
# (추가) 그룹(키워드×언론사 / 키워드×전체) 단위 최소 기사 수 스킵 규칙
# - SENTIMENT_TITLE_MIN_ARTICLES_PER_GROUP: media_code!=0 그룹 최소 기사 수
# - SENTIMENT_TITLE_MIN_ARTICLES_OVERALL: media_code==0(키워드×전체) 그룹 최소 기사 수(0이면 적용 안 함)

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings

from src.analyzer.sentiment.title.core.title_sentiment import SentimentModel, SentimentProba, mean_proba
from src.analyzer.sentiment.title.storage.title_sentiment_reader import (
    SentimentArticleRow,
    fetch_keyword_seqs_for_trend_run,
    fetch_title_clean_articles_for_sentiment,
)
from src.analyzer.sentiment.title.storage.title_sentiment_writer import (
    SentimentAggRow,
    reset_existing_title_sentiment_rows,
    upsert_keyword_sentiment_rows,
)

SUPPORTED_PERIODS = ("TODAY", "D7", "D14", "D30")


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _settings_summary_one_line(
    *,
    model_name: str,
    batch_size: int,
    keyword_top_n: int,
    device: str,
    max_length: int,
    min_per_group: int,
    min_overall: int,
) -> str:
    top_n_str = "all" if keyword_top_n <= 0 else str(keyword_top_n)
    dev = device if device else "auto"
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"sentiment(title,model={model_name},device={dev},max_len={int(max_length)},"
        f"keywords={top_n_str},batch={int(batch_size)},"
        f"min_group={int(min_per_group)},min_overall={int(min_overall)})"
    )


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
    parts = [p.strip().upper() for p in raw.split(",") if p.strip()]
    if not parts:
        return list(SUPPORTED_PERIODS)
    return [p for p in parts if p in SUPPORTED_PERIODS]


def _logs_dir() -> Path:
    # 기본값 포함해서 settings에서 확정해 둔 경로를 사용
    return Path(settings.log_dir_sentiment_title)


def _group_probs(
    *,
    articles: Sequence[SentimentArticleRow],
    probs: Sequence[SentimentProba],
    period_filter: str,
    min_per_group: int,
    min_overall: int,
) -> Tuple[List[SentimentAggRow], Dict[str, int]]:
    """
    (keyword, media) 별 평균 + (keyword, media=0) 전체 평균도 같이 생성
    (추가) 최소 기사 수 규칙:
      - media_code != 0 그룹: len(items) < min_per_group 이면 스킵(단, min_per_group=0이면 스킵 규칙 미적용)
      - media_code == 0(전체) 그룹: len(items) < min_overall 이면 스킵(단, min_overall=0이면 스킵 규칙 미적용)
    """
    km: Dict[Tuple[int, int], List[SentimentProba]] = {}
    k0: Dict[int, List[SentimentProba]] = {}

    for a, p in zip(articles, probs):
        key = (int(a.keyword_seq), int(a.media_code))
        km.setdefault(key, []).append(p)
        k0.setdefault(int(a.keyword_seq), []).append(p)

    out: List[SentimentAggRow] = []
    skipped_groups = 0
    skipped_overall = 0

    pf = str(period_filter).strip().upper()

    # (키워드×언론사) 그룹
    for (keyword_seq, media_code), items in km.items():
        n = len(items)
        if int(min_per_group) > 0 and int(media_code) != 0 and n < int(min_per_group):
            skipped_groups += 1
            continue

        out.append(
            SentimentAggRow(
                keyword_seq=int(keyword_seq),
                media_code=int(media_code),
                period_filter=pf,
                article_count=n,
                avg_proba=mean_proba(items),
            )
        )

    # (키워드×전체 media=0) 그룹
    for keyword_seq, items in k0.items():
        n = len(items)
        if int(min_overall) > 0 and n < int(min_overall):
            skipped_overall += 1
            continue

        out.append(
            SentimentAggRow(
                keyword_seq=int(keyword_seq),
                media_code=0,
                period_filter=pf,
                article_count=n,
                avg_proba=mean_proba(items),
            )
        )

    stats = {
        "groups_total_media": len(km),
        "groups_total_overall": len(k0),
        "groups_skipped_media": int(skipped_groups),
        "groups_skipped_overall": int(skipped_overall),
        "groups_emitted": len(out),
    }
    return out, stats


def run_sentiment_title(
    *,
    trend_run_seq: int,
    periods: Sequence[str],
    keyword_top_n: int,
    refresh_same_run: bool,
    model_name: str,
    batch_size: int,
    device: str,
    max_length: int,
    min_per_group: int,
    min_overall: int,
) -> Dict[str, Any]:
    trend_run_seq = int(trend_run_seq)
    periods = [str(p).strip().upper() for p in periods if str(p).strip()]
    batch_size = max(1, int(batch_size))
    keyword_top_n = int(keyword_top_n)
    max_length = max(16, int(max_length))

    min_per_group = max(0, int(min_per_group))
    min_overall = max(0, int(min_overall))

    started_at = _now_in_tz()

    reset_rows = 0
    if refresh_same_run:
        # DELETE 금지: 제목/본문이 같은 행을 공유하므로 제목 컬럼만 초기화(UPDATE)
        reset_rows = reset_existing_title_sentiment_rows(trend_run_seq=trend_run_seq, periods=periods)

    model = SentimentModel(model_name, device=(device or None), max_length=max_length)

    all_written = 0
    per_period_details: List[Dict[str, Any]] = []

    # 이번 run의 모든 키워드 가져오기
    all_keyword_seqs = fetch_keyword_seqs_for_trend_run(trend_run_seq=trend_run_seq)
    if not all_keyword_seqs:
        raise RuntimeError("T_TREND_KEYWORD에 이번 run의 키워드가 없습니다. run_trend 결과를 확인하세요.")

    # 필요하면 상위 N개만 사용 (0이면 전체)
    if keyword_top_n > 0:
        all_keyword_seqs = all_keyword_seqs[: max(1, keyword_top_n)]

    for period in periods:
        articles = fetch_title_clean_articles_for_sentiment(
            trend_run_seq=trend_run_seq,
            period_filter=period,
            keyword_seqs=all_keyword_seqs,
        )

        if not articles:
            per_period_details.append(
                {
                    "period": period,
                    "keywords": len(all_keyword_seqs),
                    "articles_selected": 0,
                    "groups_written": 0,
                    "note": "해당 기간에 TITLE_CLEAN 대상 기사가 없습니다.",
                }
            )
            continue

        texts = [a.title_clean for a in articles]
        probs = model.predict_proba(texts, batch_size=batch_size)

        agg_rows, grp_stats = _group_probs(
            articles=articles,
            probs=probs,
            period_filter=period,
            min_per_group=min_per_group,
            min_overall=min_overall,
        )

        if not agg_rows:
            per_period_details.append(
                {
                    "period": period,
                    "keywords": len(all_keyword_seqs),
                    "articles_selected": len(articles),
                    "groups_generated": 0,
                    "rows_written": 0,
                    "group_rule": {
                        "min_per_group": int(min_per_group),
                        "min_overall": int(min_overall),
                    },
                    "group_stats": grp_stats,
                    "note": "그룹 최소 기사 수 규칙으로 인해 적재할 그룹이 없습니다.",
                }
            )
            continue

        written = upsert_keyword_sentiment_rows(trend_run_seq=trend_run_seq, rows=agg_rows)
        all_written += int(written)

        per_period_details.append(
            {
                "period": period,
                "keywords": len(all_keyword_seqs),
                "articles_selected": len(articles),
                "groups_generated": len(agg_rows),
                "rows_written": int(written),
                "group_rule": {
                    "min_per_group": int(min_per_group),
                    "min_overall": int(min_overall),
                },
                "group_stats": grp_stats,
            }
        )

    ended_at = _now_in_tz()

    return {
        "mode": "sentiment_title",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "settings_summary": _settings_summary_one_line(
            model_name=model_name,
            batch_size=batch_size,
            keyword_top_n=keyword_top_n,
            device=device,
            max_length=max_length,
            min_per_group=min_per_group,
            min_overall=min_overall,
        ),
        "trend_run_seq": trend_run_seq,
        "periods": periods,
        "keyword_top_n": keyword_top_n,
        "refresh_same_run": bool(refresh_same_run),
        "reset_rows": int(reset_rows),
        "rows_written": int(all_written),
        "min_articles_per_group": int(min_per_group),
        "min_articles_overall": int(min_overall),
        "details": per_period_details,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="제목 기반 감성분석(T_KEYWORD_SENTIMENT) 적재")

    # 기본값을 settings(.env)로 연결
    p.add_argument(
        "--trend-run-seq",
        type=int,
        default=int(settings.sentiment_title_trend_run_seq),
        help="대상 TREND_RUN_SEQ (0이면 최신)",
    )
    p.add_argument(
        "--periods",
        type=str,
        default=str(settings.sentiment_title_periods or "TODAY,D7,D14,D30"),
        help="대상 PERIOD_FILTER 목록(콤마). 예: TODAY,D7,D14,D30",
    )

    p.add_argument(
        "--keyword-top-n",
        type=int,
        default=int(settings.sentiment_title_keyword_top_n),
        help="이번 run의 키워드 중 상위 N개만 사용(0이면 전체 키워드)",
    )

    # refresh는:
    # - 사용자가 --refresh를 주면 True
    # - 안 주면 .env의 SENTIMENT_TITLE_REFRESH(=settings.sentiment_title_refresh) 기본값을 따른다
    p.add_argument("--refresh", action="store_true", help="같은 run/period 기존 제목 감성 컬럼을 0으로 초기화 후 재적재")

    p.add_argument("--model-name", type=str, default="", help="Transformers 모델명(미지정 시 .env 기본값 사용)")
    p.add_argument("--batch-size", type=int, default=settings.sentiment_title_batch_size, help="모델 추론 배치 크기")
    p.add_argument("--max-length", type=int, default=settings.sentiment_title_max_length, help="토크나이저 max_length")
    p.add_argument("--device", type=str, default=settings.sentiment_title_device, help='추론 디바이스("cpu" 또는 "cuda"). 비우면 auto')

    # 저장 여부는 당장은 env로 빼지 않음(요청대로)
    p.add_argument("--save-log", type=int, choices=[0, 1], default=1, help="결과 로그 JSON 저장(기본 1)")

    args = p.parse_args()

    trend_run_seq = _resolve_trend_run_seq(int(args.trend_run_seq))
    periods = _parse_periods(args.periods)

    model_name = (args.model_name or "").strip() or (settings.sentiment_title_model_name or "").strip()
    if not model_name:
        model_name = "snunlp/KR-FinBert-SC"

    device = (args.device or "").strip()
    batch_size = int(args.batch_size)
    max_length = int(args.max_length)
    keyword_top_n = int(args.keyword_top_n)

    # refresh 우선순위: CLI 플래그(--refresh) > .env 기본값(settings.sentiment_title_refresh)
    refresh_same_run = bool(args.refresh) or bool(settings.sentiment_title_refresh)

    # (추가) 그룹 최소 기사 수 규칙(.env)
    min_per_group = int(settings.sentiment_title_min_articles_per_group)
    min_overall = int(settings.sentiment_title_min_articles_overall)

    print(
        _settings_summary_one_line(
            model_name=model_name,
            batch_size=batch_size,
            keyword_top_n=keyword_top_n,
            device=device,
            max_length=max_length,
            min_per_group=min_per_group,
            min_overall=min_overall,
        )
    )

    result = run_sentiment_title(
        trend_run_seq=trend_run_seq,
        periods=periods,
        keyword_top_n=keyword_top_n,
        refresh_same_run=refresh_same_run,
        model_name=model_name,
        batch_size=batch_size,
        device=device,
        max_length=max_length,
        min_per_group=min_per_group,
        min_overall=min_overall,
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))

    if int(args.save_log) == 1:
        logs_dir = _logs_dir()
        logs_dir.mkdir(parents=True, exist_ok=True)

        ended_at = datetime.fromisoformat(result["ended_at"])
        ts = ended_at.strftime("%Y%m%d_%H%M%S")
        out_path = logs_dir / f"run_sentiment_title_run{trend_run_seq}_{ts}.json"
        out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"saved: {out_path}")


if __name__ == "__main__":
    main()
