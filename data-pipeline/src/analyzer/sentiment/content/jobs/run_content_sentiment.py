# data-pipeline/src/analyzer/sentiment/content/jobs/run_content_sentiment.py
# 본문 기반 감성분석 실행 엔트리포인트
# - 이번 TREND_RUN_SEQ의 모든 키워드(T_TREND_KEYWORD)를 대상으로 기사 CONTENT_CLEAN을 감성분석
# - 본문은 길 수 있으므로 (문자 기준) chunking 후 chunk 확률 평균 -> 기사 확률을 만든다
# - 기사 확률을 그룹별(키워드×언론사, 키워드×전체)로 평균내어 T_KEYWORD_SENTIMENT에 저장
# - (추가) 기사 수가 적은 그룹은 "그룹 단위"로 스킵 가능(.env로 제어)

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings

from src.analyzer.sentiment.content.core.content_sentiment import (
    SentimentModel,
    SentimentProba,
    mean_proba,
    split_text_into_chunks_by_chars,
)
from src.analyzer.sentiment.content.storage.content_sentiment_reader import (
    ContentSentimentArticleRow,
    fetch_keyword_seqs_for_trend_run,
    fetch_content_clean_articles_for_sentiment,
)
from src.analyzer.sentiment.content.storage.content_sentiment_writer import (
    ContentSentimentAggRow,
    reset_existing_content_sentiment_rows,
    upsert_keyword_content_sentiment_rows,
)

SUPPORTED_PERIODS = ("TODAY", "D7", "D14")


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _settings_summary_one_line(
    *,
    model_name: str,
    batch_size: int,
    keyword_top_n: int,
    device: str,
    max_length: int,
    chunk_size_chars: int,
    chunk_overlap_chars: int,
    max_chunks: int,
    min_chars: int,
    min_articles_per_group: int,
    min_articles_overall: int,
) -> str:
    top_n_str = "all" if keyword_top_n <= 0 else str(keyword_top_n)
    dev = device if device else "auto"
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"sentiment(content,model={model_name},device={dev},max_len={int(max_length)},keywords={top_n_str},batch={int(batch_size)},"
        f"chunk={int(chunk_size_chars)}/{int(chunk_overlap_chars)},max_chunks={int(max_chunks)},min_chars={int(min_chars)},"
        f"min_group={int(min_articles_per_group)},min_overall={int(min_articles_overall)})"
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
    return Path(settings.log_dir_sentiment_content)


def _group_probs_with_min_rules(
    *,
    articles: Sequence[ContentSentimentArticleRow],
    article_probs: Sequence[SentimentProba],
    period_filter: str,
    min_articles_per_group: int,
    min_articles_overall: int,
) -> Tuple[List[ContentSentimentAggRow], Dict[str, int]]:
    """
    (keyword, media) 별 평균 + (keyword, media=0) 전체 평균
    - 기사 확률(article_probs)은 "기사 1건당 1개"여야 함
    - (추가) 기사 수가 적은 그룹은 스킵(min rule)

    스킵 규칙:
      - media 그룹(media_code!=0): article_count < min_articles_per_group 이면 스킵(단, min이 0이면 적용 안 함)
      - overall 그룹(media_code=0): article_count < min_articles_overall 이면 스킵(단, min이 0이면 적용 안 함)
    """
    km: Dict[Tuple[int, int], List[SentimentProba]] = {}
    k0: Dict[int, List[SentimentProba]] = {}

    for a, p in zip(articles, article_probs):
        key = (int(a.keyword_seq), int(a.media_code))
        km.setdefault(key, []).append(p)
        k0.setdefault(int(a.keyword_seq), []).append(p)

    groups_total_media = len(km)
    groups_total_overall = len(k0)

    skipped_media = 0
    skipped_overall = 0

    out: List[ContentSentimentAggRow] = []
    pf = str(period_filter).strip().upper()

    # 1) media 그룹
    for (keyword_seq, media_code), items in km.items():
        cnt = len(items)
        if int(min_articles_per_group) > 0 and cnt < int(min_articles_per_group):
            skipped_media += 1
            continue

        out.append(
            ContentSentimentAggRow(
                keyword_seq=int(keyword_seq),
                media_code=int(media_code),
                period_filter=pf,
                article_count=cnt,
                avg_proba=mean_proba(items),
            )
        )

    # 2) overall 그룹(키워드 전체)
    for keyword_seq, items in k0.items():
        cnt = len(items)
        if int(min_articles_overall) > 0 and cnt < int(min_articles_overall):
            skipped_overall += 1
            continue

        out.append(
            ContentSentimentAggRow(
                keyword_seq=int(keyword_seq),
                media_code=0,
                period_filter=pf,
                article_count=cnt,
                avg_proba=mean_proba(items),
            )
        )

    stats = {
        "groups_total_media": int(groups_total_media),
        "groups_total_overall": int(groups_total_overall),
        "groups_skipped_media": int(skipped_media),
        "groups_skipped_overall": int(skipped_overall),
        "groups_emitted": int(len(out)),
    }
    return out, stats


def _predict_article_probs_with_chunking(
    *,
    model: SentimentModel,
    articles: Sequence[ContentSentimentArticleRow],
    batch_size: int,
    chunk_size_chars: int,
    chunk_overlap_chars: int,
    max_chunks: int,
    min_chars: int,
) -> Tuple[List[ContentSentimentArticleRow], List[SentimentProba], Dict[str, int]]:
    """
    본문을 chunk로 쪼개서 chunk 확률 평균 -> 기사 확률로 만든다.

    반환:
      (사용된 기사 목록, 기사별 확률 목록(기사 수와 동일), stats)
    """
    used_articles: List[ContentSentimentArticleRow] = []
    chunk_texts: List[str] = []
    spans: List[Tuple[int, int]] = []  # article i -> chunk_texts[start:end]
    skipped_short = 0
    total_chunks = 0

    for a in articles:
        content = (a.content_clean or "").strip()
        if min_chars > 0 and len(content) < int(min_chars):
            skipped_short += 1
            continue

        chunks = split_text_into_chunks_by_chars(
            content,
            chunk_size=int(chunk_size_chars),
            overlap=int(chunk_overlap_chars),
            max_chunks=int(max_chunks),
        )
        if not chunks:
            skipped_short += 1
            continue

        start = len(chunk_texts)
        chunk_texts.extend(chunks)
        end = len(chunk_texts)

        spans.append((start, end))
        used_articles.append(a)
        total_chunks += (end - start)

    if not used_articles:
        return [], [], {"articles_skipped_short": skipped_short, "chunks_total": 0}

    chunk_probs = model.predict_proba(chunk_texts, batch_size=batch_size)

    article_probs: List[SentimentProba] = []
    for (start, end) in spans:
        article_probs.append(mean_proba(chunk_probs[start:end]))

    return used_articles, article_probs, {"articles_skipped_short": skipped_short, "chunks_total": total_chunks}


def run_sentiment_content(
    *,
    trend_run_seq: int,
    periods: Sequence[str],
    keyword_top_n: int,
    refresh_same_run: bool,
    model_name: str,
    batch_size: int,
    device: str,
    max_length: int,
    chunk_size_chars: int,
    chunk_overlap_chars: int,
    max_chunks: int,
    min_chars: int,
    min_articles_per_group: int,
    min_articles_overall: int,
) -> Dict[str, Any]:
    trend_run_seq = int(trend_run_seq)
    periods = [str(p).strip().upper() for p in periods if str(p).strip()]

    batch_size = max(1, int(batch_size))
    keyword_top_n = int(keyword_top_n)
    max_length = max(16, int(max_length))

    chunk_size_chars = max(200, int(chunk_size_chars))
    chunk_overlap_chars = max(0, int(chunk_overlap_chars))
    if chunk_overlap_chars >= chunk_size_chars:
        chunk_overlap_chars = max(0, chunk_size_chars // 4)
    max_chunks = max(1, int(max_chunks))
    min_chars = max(0, int(min_chars))

    min_articles_per_group = max(0, int(min_articles_per_group))
    min_articles_overall = max(0, int(min_articles_overall))

    started_at = _now_in_tz()

    reset_rows = 0
    if refresh_same_run:
        reset_rows = reset_existing_content_sentiment_rows(trend_run_seq=trend_run_seq, periods=periods)

    model = SentimentModel(model_name, device=(device or None), max_length=max_length)

    all_written = 0
    per_period_details: List[Dict[str, Any]] = []

    all_keyword_seqs = fetch_keyword_seqs_for_trend_run(trend_run_seq=trend_run_seq)
    if not all_keyword_seqs:
        raise RuntimeError("T_TREND_KEYWORD에 이번 run의 키워드가 없습니다. run_trend 결과를 확인하세요.")

    if keyword_top_n > 0:
        all_keyword_seqs = all_keyword_seqs[: max(1, keyword_top_n)]

    for period in periods:
        articles = fetch_content_clean_articles_for_sentiment(
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
                    "rows_written": 0,
                    "note": "해당 기간에 CONTENT_CLEAN 대상 기사가 없습니다.",
                }
            )
            continue

        used_articles, article_probs, stats = _predict_article_probs_with_chunking(
            model=model,
            articles=articles,
            batch_size=batch_size,
            chunk_size_chars=chunk_size_chars,
            chunk_overlap_chars=chunk_overlap_chars,
            max_chunks=max_chunks,
            min_chars=min_chars,
        )

        if not used_articles:
            per_period_details.append(
                {
                    "period": period,
                    "keywords": len(all_keyword_seqs),
                    "articles_selected": len(articles),
                    "articles_used": 0,
                    "rows_written": 0,
                    "note": "chunking 결과 유효한 본문이 없어 스킵되었습니다.",
                    **stats,
                }
            )
            continue

        agg_rows, group_stats = _group_probs_with_min_rules(
            articles=used_articles,
            article_probs=article_probs,
            period_filter=period,
            min_articles_per_group=min_articles_per_group,
            min_articles_overall=min_articles_overall,
        )

        if not agg_rows:
            per_period_details.append(
                {
                    "period": period,
                    "keywords": len(all_keyword_seqs),
                    "articles_selected": len(articles),
                    "articles_used": len(used_articles),
                    "chunks_total": int(stats.get("chunks_total", 0)),
                    "articles_skipped_short": int(stats.get("articles_skipped_short", 0)),
                    "groups_generated": 0,
                    "rows_written": 0,
                    "note": "그룹 최소 기사 수 규칙으로 인해 모든 그룹이 스킵되었습니다.",
                    "group_rule": {"min_per_group": int(min_articles_per_group), "min_overall": int(min_articles_overall)},
                    "group_stats": group_stats,
                }
            )
            continue

        written = upsert_keyword_content_sentiment_rows(trend_run_seq=trend_run_seq, rows=agg_rows)
        all_written += int(written)

        per_period_details.append(
            {
                "period": period,
                "keywords": len(all_keyword_seqs),
                "articles_selected": len(articles),
                "articles_used": len(used_articles),
                "chunks_total": int(stats.get("chunks_total", 0)),
                "articles_skipped_short": int(stats.get("articles_skipped_short", 0)),
                "groups_generated": len(agg_rows),
                "rows_written": int(written),
                "group_rule": {"min_per_group": int(min_articles_per_group), "min_overall": int(min_articles_overall)},
                "group_stats": group_stats,
            }
        )

    ended_at = _now_in_tz()

    return {
        "mode": "sentiment_content",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "settings_summary": _settings_summary_one_line(
            model_name=model_name,
            batch_size=batch_size,
            keyword_top_n=keyword_top_n,
            device=device,
            max_length=max_length,
            chunk_size_chars=chunk_size_chars,
            chunk_overlap_chars=chunk_overlap_chars,
            max_chunks=max_chunks,
            min_chars=min_chars,
            min_articles_per_group=min_articles_per_group,
            min_articles_overall=min_articles_overall,
        ),
        "trend_run_seq": trend_run_seq,
        "periods": periods,
        "keyword_top_n": keyword_top_n,
        "refresh_same_run": bool(refresh_same_run),
        "reset_rows": int(reset_rows),
        "rows_written": int(all_written),
        "min_articles_per_group": int(min_articles_per_group),
        "min_articles_overall": int(min_articles_overall),
        "details": per_period_details,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="본문 기반 감성분석(T_KEYWORD_SENTIMENT) 적재 (chunking)")

    # 기본값: .env(settings) 우선
    p.add_argument(
        "--trend-run-seq",
        type=int,
        default=int(settings.sentiment_content_trend_run_seq),
        help="대상 TREND_RUN_SEQ (0이면 최신)",
    )
    p.add_argument(
        "--periods",
        type=str,
        default=str(settings.sentiment_content_periods),
        help="대상 PERIOD_FILTER 목록(콤마). 예: TODAY,D7,D14",
    )

    p.add_argument(
        "--keyword-top-n",
        type=int,
        default=int(settings.sentiment_content_keyword_top_n),
        help="이번 run의 키워드 중 상위 N개만 사용(0이면 전체 키워드)",
    )

    # 기본값: .env(settings) 우선 + CLI 호환
    # - python -m ... --refresh (True)
    # - python -m ... --no-refresh (False)
    # - 옵션 미지정 시 .env 기본값 사용
    p.add_argument(
        "--refresh",
        default=bool(settings.sentiment_content_refresh),
        action=argparse.BooleanOptionalAction,
        help="같은 run/period 본문 감성 컬럼만 초기화 후 재적재",
    )

    # content 전용 기본값: 비어있으면 title 설정을 fallback
    default_model = (settings.sentiment_content_model_name or "").strip() or (settings.sentiment_title_model_name or "").strip()
    default_device = (settings.sentiment_content_device or "").strip() or (settings.sentiment_title_device or "").strip()
    default_batch = int(settings.sentiment_content_batch_size)
    default_max_len = int(settings.sentiment_content_max_length)

    p.add_argument("--model-name", type=str, default="", help="Transformers 모델명(미지정 시 .env 기본값 사용)")
    p.add_argument("--batch-size", type=int, default=default_batch, help="모델 추론 배치 크기")
    p.add_argument("--max-length", type=int, default=default_max_len, help="토크나이저 max_length")
    p.add_argument("--device", type=str, default=default_device, help='추론 디바이스("cpu" 또는 "cuda"). 비우면 auto')

    # chunking args (env 기본값 사용)
    p.add_argument("--chunk-size-chars", type=int, default=settings.sentiment_content_chunk_size_chars, help="본문 chunk 크기(문자)")
    p.add_argument(
        "--chunk-overlap-chars", type=int, default=settings.sentiment_content_chunk_overlap_chars, help="본문 chunk overlap(문자)"
    )
    p.add_argument("--max-chunks", type=int, default=settings.sentiment_content_max_chunks, help="기사당 최대 chunk 수")
    p.add_argument("--min-chars", type=int, default=settings.sentiment_content_min_chars, help="본문 최소 길이(문자). 미만이면 스킵")

    args = p.parse_args()

    trend_run_seq = _resolve_trend_run_seq(int(args.trend_run_seq))
    periods = _parse_periods(args.periods)

    model_name = (args.model_name or "").strip() or default_model
    if not model_name:
        model_name = "snunlp/KR-FinBert-SC"

    device = (args.device or "").strip()
    batch_size = int(args.batch_size)
    max_length = int(args.max_length)
    keyword_top_n = int(args.keyword_top_n)

    chunk_size_chars = int(args.chunk_size_chars)
    chunk_overlap_chars = int(args.chunk_overlap_chars)
    max_chunks = int(args.max_chunks)
    min_chars = int(args.min_chars)

    # 그룹 최소 기사 수 규칙은 .env(settings)로만 제어 (title과 동일한 방식)
    min_articles_per_group = int(getattr(settings, "sentiment_content_min_articles_per_group", 0) or 0)
    min_articles_overall = int(getattr(settings, "sentiment_content_min_articles_overall", 0) or 0)

    print(
        _settings_summary_one_line(
            model_name=model_name,
            batch_size=batch_size,
            keyword_top_n=keyword_top_n,
            device=device,
            max_length=max_length,
            chunk_size_chars=chunk_size_chars,
            chunk_overlap_chars=chunk_overlap_chars,
            max_chunks=max_chunks,
            min_chars=min_chars,
            min_articles_per_group=min_articles_per_group,
            min_articles_overall=min_articles_overall,
        )
    )

    result = run_sentiment_content(
        trend_run_seq=trend_run_seq,
        periods=periods,
        keyword_top_n=keyword_top_n,
        refresh_same_run=bool(args.refresh),
        model_name=model_name,
        batch_size=batch_size,
        device=device,
        max_length=max_length,
        chunk_size_chars=chunk_size_chars,
        chunk_overlap_chars=chunk_overlap_chars,
        max_chunks=max_chunks,
        min_chars=min_chars,
        min_articles_per_group=min_articles_per_group,
        min_articles_overall=min_articles_overall,
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))

    # save_log는 요구사항에서 제외(옵션/환경변수 모두 제거)


if __name__ == "__main__":
    main()
