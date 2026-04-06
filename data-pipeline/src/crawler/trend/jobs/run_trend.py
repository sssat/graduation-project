# data-pipeline/src/crawler/trend/jobs/run_trend.py
# 트렌드 크롤링 파이프라인을 실행 가능한 형태로 묶는 실행 스크립트

# 함수 호출 순서(실행 흐름): 
# (1) run_trend.py
# main() 실행
# -> run_trend() 

# (2) trend.py
# -> crawl_trends()                  : Selenium으로 Google Trends 페이지에 접속해서 트렌드 키워드 목록을 긁어옴

# (3)keyword_writer.py
# -> save_trend_snapshot_with_run()  : 가져온 키워드들을 DB에 저장. T_TREND_RUN에 실행 1건을 만들고, 키워드 사전(upsert) + 스냅샷 테이블에 (run, rank, keyword) 저장

# (4) retention.py
# -> prune_old_trend_runs()          : RETENTION_KEEP_LAST_N만 남기고 오래된 T_TREND_RUN들을 삭제

# 각 함수는 trend.py / keyword_writer.py / retention.py 모듈에 정의되어 있고,
# 전체 로직은 run_trend.py의 main()에서 시작된 호출 흐름(run_trend()가 직접/간접으로 호출하는 체인) 안에서 실행된다.

# => 모듈을 호출하는게 아니라 모듈에 정의한 함수를 호출하는 것이다.
# 코드 실행 시 python -m src.crawler.trend.jobs.run_trend로 실행 

from __future__ import annotations

import argparse
import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from src.config.settings import settings
from src.crawler.trend.core.trend import crawl_trends
from src.crawler.trend.storage.keyword_writer import save_trend_snapshot_with_run
from src.crawler.trend.storage.retention import prune_old_trend_runs


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _today_in_tz() -> date:
    return _now_in_tz().date()


def _resolve_run_started_at() -> datetime:
    raw = os.getenv("NEWSIGHT_BATCH_STARTED_AT", "").strip()
    if raw:
        try:
            parsed = datetime.fromisoformat(raw)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=ZoneInfo(settings.tz))
            return parsed.astimezone(ZoneInfo(settings.tz))
        except ValueError:
            pass

    return _now_in_tz()


def _settings_summary_one_line() -> str:
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"headless={1 if settings.headless else 0} "
        f"selenium_wait={settings.selenium_wait_seconds}s "
        f"trend_top_n={settings.trend_top_n} "
        f"retention(keep_last_n={settings.retention_keep_last_n}) "
        f"log_dir_trend={settings.log_dir_trend}"
    )


def run_trend(*, base_date: date | None = None) -> dict[str, Any]:
    """
    환경변수(.env/OS) 값은 settings를 통해서만 사용한다.
    - top_n: settings.trend_top_n
    - headless: settings.headless
    - retention: settings.retention_keep_last_n (prune_old_trend_runs 내부에서 사용)
    """
    started_at = _resolve_run_started_at()
    base_date = base_date or started_at.date()

    keywords = crawl_trends(top_n=int(settings.trend_top_n), headless=bool(settings.headless))
    trend_run_seq, saved = save_trend_snapshot_with_run(
        keywords,
        base_date=base_date,
        run_at=started_at,
    )

    # retention도 settings 기반으로만 동작
    deleted = prune_old_trend_runs()

    return {
        "base_date": str(base_date),
        "run_started_at": started_at.isoformat(),
        "trend_run_seq": int(trend_run_seq),
        "trend_keywords_saved": int(saved),
        "top_n": int(settings.trend_top_n),
        "headless": bool(settings.headless),
        "retention_keep_last_n": int(settings.retention_keep_last_n),
        "retention_deleted_runs": int(deleted),
    }


def main() -> None:
    p = argparse.ArgumentParser(description="구글 트렌드 크롤링 -> DB 스냅샷 저장")
    p.add_argument("--base-date", type=str, default=None, help="BASE_DATE 지정 (YYYY-MM-DD). 미지정 시 오늘")
    p.add_argument(
        "--save-log",
        type=int,
        choices=[0, 1],
        default=1,
        help="실행 결과를 트렌드 로그 디렉토리에 json으로 저장(기본 1)",
    )
    args = p.parse_args()

    bd = date.fromisoformat(args.base_date) if args.base_date else None

    print(_settings_summary_one_line())

    result = run_trend(base_date=bd)

    print(json.dumps(result, ensure_ascii=False, indent=2))

    if int(args.save_log) == 1:
        logs_dir = Path(settings.log_dir_trend)
        logs_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.now(tz=ZoneInfo(settings.tz)).strftime("%Y%m%d_%H%M%S")
        out_path = logs_dir / f"run_trend_{result['base_date']}_run{result['trend_run_seq']}_{ts}.json"
        out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[saved] {out_path}")


if __name__ == "__main__":
    main()
