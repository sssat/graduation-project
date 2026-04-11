# data-pipeline/src/jobs/run_all.py
from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime
from typing import Dict, List
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.common.trend_run_publish import get_latest_trend_run_seq, publish_trend_run
from src.config.settings import settings


def _now() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _parse_steps(raw: str) -> List[str]:
    return [s.strip().lower() for s in (raw or "").split(",") if s.strip()]


def main() -> None:
    # 스텝 키 -> 실제 실행할 모듈 경로 매핑
    step_to_module: Dict[str, str] = {
        "trend": "src.crawler.trend.jobs.run_trend",
        "news": "src.crawler.news.jobs.run_news",
        "preprocess": "src.preprocess.jobs.run_preprocess",
        "aggregate": "src.analyzer.aggregate.jobs.run_aggregate",
        "final_rank": "src.analyzer.final_rank.jobs.run_final_rank",
        "summary": "src.analyzer.summary.jobs.run_summary",
        "title_sentiment": "src.analyzer.sentiment.title.jobs.run_title_sentiment",
        "content_sentiment": "src.analyzer.sentiment.content.jobs.run_content_sentiment",
        "title_bias": "src.analyzer.bias.title.jobs.run_title_bias",
        "content_bias": "src.analyzer.bias.content.jobs.run_content_bias",
        "wordcloud": "src.analyzer.wordcloud.jobs.run_wordcloud",
        "cooc_network": "src.analyzer.cooc_network.jobs.run_cooc_network",
        "search_timeline": "src.analyzer.search_timeline.jobs.run_search_timeline",
    }

    steps = _parse_steps(getattr(settings, "run_all_steps", ""))
    fail_fast = bool(getattr(settings, "run_all_fail_fast", True))

    started_at = _now()
    batch_started_at = started_at.isoformat()
    child_env = os.environ.copy()
    child_env["NEWSIGHT_BATCH_STARTED_AT"] = batch_started_at

    print(
        "[run_all] "
        f"env={settings.app_env} tz={settings.tz} "
        f"fail_fast={int(fail_fast)} steps={steps} "
        f"started_at={batch_started_at}"
    )

    active_trend_run_seq: int | None = None
    has_failures = False

    for idx, step in enumerate(steps, start=1):
        module = step_to_module.get(step)
        if not module:
            msg = f"[run_all] ({idx}/{len(steps)}) unknown step: {step}"
            if fail_fast:
                raise RuntimeError(msg)
            has_failures = True
            print(msg)
            continue

        print(f"[run_all] ({idx}/{len(steps)}) start: {step} -> python -m {module}")

        # 각 job이 settings(.env)를 읽어서 동작하 ensures:
        # - run_all은 추가 로그 파일 생성 X
        # - job별 logs 폴더에 기존대로 로그 생성
        try:
            subprocess.run([sys.executable, "-m", module], check=True, env=child_env)
            print(f"[run_all] ({idx}/{len(steps)}) done: {step}")

            if step == "trend":
                conn = get_conn(autocommit=True)
                try:
                    active_trend_run_seq = get_latest_trend_run_seq(conn=conn)
                finally:
                    conn.close()

                if active_trend_run_seq is None:
                    raise RuntimeError("[run_all] trend completed but no TREND_RUN_SEQ could be resolved.")

                print(f"[run_all] active trend_run_seq={active_trend_run_seq}")
        except subprocess.CalledProcessError as e:
            print(f"[run_all] ({idx}/{len(steps)}) FAIL: {step} (exit={e.returncode})")
            has_failures = True
            if fail_fast:
                raise

    ended_at = _now()

    if active_trend_run_seq is not None and not has_failures:
        conn = get_conn(autocommit=False)
        try:
            publish_trend_run(
                conn=conn,
                trend_run_seq=active_trend_run_seq,
                published_at=ended_at,
            )
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
        finally:
            conn.close()

        print(
            "[run_all] "
            f"published trend_run_seq={active_trend_run_seq} "
            f"published_at={ended_at.isoformat()}"
        )
    elif active_trend_run_seq is not None:
        print(f"[run_all] trend_run_seq={active_trend_run_seq} left unpublished because at least one step failed")

    print(f"[run_all] knows: started_at={started_at.isoformat()} ended_at={ended_at.isoformat()}")


if __name__ == "__main__":
    main()
