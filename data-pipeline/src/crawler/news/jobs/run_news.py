# data-pipeline/src/crawler/news/jobs/run_news.py
# 네이버 뉴스 크롤링 파이프라인을 실행 가능한 형태로 묶는 실행 스크립트
#
# 목표:
# - 평소 실행은 "python -m src.crawler.news.jobs.run_news" 한 줄로 통일
# - 실행 옵션(대상 run, 댓글 수집, refresh)은 .env -> settings로 중앙 관리
# - 필요 시 CLI로만 임시 오버라이드도 가능(우선순위: CLI > .env)

from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, Tuple
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings
from src.crawler.news.core.news import PRESS_CODES, crawl_news_core
from src.crawler.news.storage.article_writer import persist_articles
from src.crawler.news.storage.keyword_reader import fetch_keywords_for_trend_run


def _settings_summary_one_line(
    *,
    trend_run_seq: int,
    base_date: date | None,
    include_comments: bool,
    refresh_same_run: bool,
) -> str:
    bd = base_date.isoformat() if base_date else "AUTO(DB)"
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"headless={1 if settings.headless else 0} "
        f"news(days_back={settings.news_days_back},pages={settings.news_start_page}-{settings.news_end_page}) "
        f"proc(search={settings.news_search_processes},comment={settings.news_comment_processes}) "
        f"comments(on={1 if include_comments else 0},sample={settings.news_comment_sample_rate},min={settings.news_comment_sample_min}) "
        f"refresh_same_run={1 if refresh_same_run else 0} "
        f"pipeline(keyword_top_n={settings.news_keyword_top_n}) "
        f"run(trend_run_seq={trend_run_seq},base_date={bd}) "
        f"log_dir_news={settings.log_dir_news}"
    )


def _fetch_latest_trend_run() -> Tuple[int, date]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT TREND_RUN_SEQ AS trend_run_seq, BASE_DATE AS base_date
                FROM T_TREND_RUN
                ORDER BY TREND_RUN_SEQ DESC
                LIMIT 1
                """
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("T_TREND_RUN이 비어있습니다. 먼저 run_trend를 실행하세요.")
            return int(row["trend_run_seq"]), row["base_date"]
    finally:
        conn.close()


def _fetch_trend_run_base_date(trend_run_seq: int) -> date:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT BASE_DATE AS base_date
                FROM T_TREND_RUN
                WHERE TREND_RUN_SEQ = %s
                """,
                (trend_run_seq,),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f"존재하지 않는 TREND_RUN_SEQ 입니다: {trend_run_seq}")
            return row["base_date"]
    finally:
        conn.close()


def _parse_base_date_or_none(s: str | None) -> date | None:
    raw = (s or "").strip()
    if not raw:
        return None
    return date.fromisoformat(raw)


def run_news(
    *,
    trend_run_seq: int,
    base_date: date | None = None,
    include_comments: bool | None = None,
    refresh_same_run: bool = False,
) -> dict[str, Any]:
    # 1) trend_run_seq=0이면 최신 자동
    if int(trend_run_seq) == 0:
        latest_seq, latest_base_date = _fetch_latest_trend_run()
        trend_run_seq = latest_seq
        if base_date is None:
            base_date = latest_base_date

    # 2) base_date 미지정이면 해당 run의 BASE_DATE를 DB에서 조회해서 사용(정합성 보장)
    if base_date is None:
        base_date = _fetch_trend_run_base_date(int(trend_run_seq))

    # 3) 댓글 여부
    if include_comments is None:
        include_comments = bool(settings.include_comments)


    # 4) run에 속한 키워드(랭크 순) 조회
    kw_rows = fetch_keywords_for_trend_run(int(trend_run_seq))
    run_keywords = [r.keyword_name for r in kw_rows]
    if not run_keywords:
        raise RuntimeError(
            "trend_run_seq에 해당하는 키워드를 찾지 못했습니다. "
            "T_TREND_KEYWORD_SNAPSHOT/T_TREND_KEYWORD_MASTER 데이터를 확인하세요."
        )

    # 5) 뉴스에 사용할 키워드 수 제한
    limit = int(settings.news_keyword_top_n)
    if limit <= 0:
        limit = len(run_keywords)
    limit = max(1, min(limit, len(run_keywords)))
    news_keywords = run_keywords[:limit]

    # 6) 크롤링(네트워크 수집/파싱)만 수행
    articles, comment_bundles, crawl_stats = crawl_news_core(
        trend_run_seq=int(trend_run_seq),
        base_date=base_date,
        keywords=news_keywords,
        days_back=int(settings.news_days_back),
        start_page=int(settings.news_start_page),
        end_page=int(settings.news_end_page),
        press_codes=PRESS_CODES,
        headless=bool(settings.headless),
        search_processes=int(settings.news_search_processes),
        include_comments=bool(include_comments),
        comment_processes=int(settings.news_comment_processes),
    )

    # 7) DB 적재는 job(run_news.py)에서 수행
    db_stats = persist_articles(
        articles=articles,
        comment_bundles=comment_bundles,
        refresh_same_run=bool(refresh_same_run),
    )

    return {
        "base_date": str(base_date),
        "trend_run_seq": int(trend_run_seq),
        "news_keywords_used": len(news_keywords),
        "include_comments": bool(include_comments),
        "refresh_same_run": bool(refresh_same_run),
        "crawl": crawl_stats,
        "db": db_stats,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="뉴스만 크롤링 -> DB 적재 (TREND_RUN 기반)")

    # 기본은 .env(settings)로 가고, CLI로 주면 그때만 오버라이드(우선순위: CLI > .env)
    p.add_argument(
        "--trend-run-seq",
        type=int,
        default=None,
        help="대상 TREND_RUN_SEQ (미입력 시 NEWS_TREND_RUN_SEQ 사용. 0이면 최신 run 자동)",
    )
    p.add_argument(
        "--base-date",
        default=None,
        help="기준일(YYYY-MM-DD). 미입력 시 NEWS_BASE_DATE 사용, 그것도 없으면 DB의 BASE_DATE 사용",
    )
    p.add_argument(
        "--include-comments",
        type=int,
        choices=[0, 1],
        default=None,
        help="댓글 수집 여부(0/1). 미입력 시 NEWS_INCLUDE_COMMENTS(없으면 INCLUDE_COMMENTS) 사용",
    )
    p.add_argument(
        "--refresh-same-run",
        type=int,
        choices=[0, 1],
        default=None,
        help="같은 trend_run_seq 재실행 시 삭제 후 재삽입(0/1). 미입력 시 NEWS_REFRESH_SAME_RUN 사용",
    )

    args = p.parse_args()

    # 1) trend_run_seq 결정
    effective_trend_run_seq = (
        int(args.trend_run_seq) if args.trend_run_seq is not None else int(settings.news_trend_run_seq)
    )

    # 2) base_date 결정: CLI > settings.NEWS_BASE_DATE > None(DB에서 조회)
    bd = _parse_base_date_or_none(args.base_date)
    if bd is None:
        bd = _parse_base_date_or_none(settings.news_base_date)

    # 3) 
    if args.include_comments is None:
        effective_include_comments = bool(settings.include_comments)
        include_comments_arg: bool | None = None
    else:
        effective_include_comments = bool(args.include_comments == 1)
        include_comments_arg = effective_include_comments

    # 4) refresh 결정: CLI > settings.news_refresh_same_run
    if args.refresh_same_run is None:
        effective_refresh_same_run = bool(settings.news_refresh_same_run)
    else:
        effective_refresh_same_run = bool(args.refresh_same_run == 1)

    print(
        _settings_summary_one_line(
            trend_run_seq=effective_trend_run_seq,
            base_date=bd,
            include_comments=effective_include_comments,
            refresh_same_run=effective_refresh_same_run,
        )
    )

    result = run_news(
        trend_run_seq=effective_trend_run_seq,
        base_date=bd,
        include_comments=include_comments_arg,  # None이면 내부에서 settings.news_include_comments 사용
        refresh_same_run=effective_refresh_same_run,
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))

    logs_dir = Path(settings.log_dir_news)
    logs_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(tz=ZoneInfo(settings.tz)).strftime("%Y%m%d_%H%M%S")
    out_path = logs_dir / f"run_news_{result['base_date']}_run{result['trend_run_seq']}_{ts}.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[saved] {out_path}")


if __name__ == "__main__":
    main()
