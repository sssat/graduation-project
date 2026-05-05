# data-pipeline/src/jobs/run_all.py
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime
from typing import Dict, List
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings


def _now() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _parse_steps(raw: str) -> List[str]:
    return [s.strip().lower() for s in (raw or "").split(",") if s.strip()]


def _slice_steps_from(steps: List[str], from_step: str | None) -> List[str]:
    if not from_step:
        return steps

    target = from_step.strip().lower()
    if target not in steps:
        raise ValueError(f"RUN_ALL_STEPS에 없는 시작 단계입니다: {from_step}")

    return steps[steps.index(target):]


def _fetch_latest_trend_run_seq() -> int:
    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT TREND_RUN_SEQ AS trend_run_seq
                FROM T_TREND_RUN
                ORDER BY TREND_RUN_SEQ DESC
                LIMIT 1
                """
            )
            row = cur.fetchone()
            if not row or not row.get("trend_run_seq"):
                raise RuntimeError("T_TREND_RUN이 비어 있어 TREND_RUN_SEQ를 찾을 수 없습니다.")
            return int(row["trend_run_seq"])
    finally:
        conn.close()


def _fetch_created_trend_run_seq(previous_latest_seq: int | None) -> int:
    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            if previous_latest_seq is None:
                cur.execute(
                    """
                    SELECT TREND_RUN_SEQ AS trend_run_seq
                    FROM T_TREND_RUN
                    ORDER BY TREND_RUN_SEQ DESC
                    LIMIT 1
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT TREND_RUN_SEQ AS trend_run_seq
                    FROM T_TREND_RUN
                    WHERE TREND_RUN_SEQ > %s
                    ORDER BY TREND_RUN_SEQ DESC
                    LIMIT 1
                    """,
                    (int(previous_latest_seq),),
                )

            row = cur.fetchone()
            if not row or not row.get("trend_run_seq"):
                raise RuntimeError("이번 배치에서 생성된 TREND_RUN_SEQ를 찾을 수 없습니다.")
            return int(row["trend_run_seq"])
    finally:
        conn.close()


def _fetch_optional_latest_trend_run_seq() -> int | None:
    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT TREND_RUN_SEQ AS trend_run_seq
                FROM T_TREND_RUN
                ORDER BY TREND_RUN_SEQ DESC
                LIMIT 1
                """
            )
            row = cur.fetchone()
            if not row or not row.get("trend_run_seq"):
                return None
            return int(row["trend_run_seq"])
    finally:
        conn.close()


def _parse_resume_base_date(raw: str | None):
    if raw is None or not raw.strip():
        return _now().date()
    try:
        return datetime.strptime(raw.strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("--resume-base-date는 YYYY-MM-DD 형식이어야 합니다.") from exc


def _fetch_latest_unpublished_trend_run_seq(*, base_date) -> int:
    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT TREND_RUN_SEQ AS trend_run_seq, RUN_STATUS AS run_status, BASE_DATE AS base_date
                FROM T_TREND_RUN
                WHERE RUN_STATUS IN ('IN_PROGRESS', 'FAILED')
                  AND BASE_DATE = %s
                ORDER BY TREND_RUN_SEQ DESC
                LIMIT 1
                """,
                (base_date,),
            )
            row = cur.fetchone()
            if not row or not row.get("trend_run_seq"):
                raise RuntimeError(
                    f"복구할 미공개 TREND_RUN_SEQ(IN_PROGRESS/FAILED)를 찾지 못했습니다. base_date={base_date}"
                )
            return int(row["trend_run_seq"])
    finally:
        conn.close()


def _mark_run_failed(trend_run_seq: int) -> None:
    conn = get_conn(autocommit=False)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE T_TREND_RUN
                SET RUN_STATUS = 'FAILED',
                    COMPLETED_AT = COALESCE(COMPLETED_AT, NOW())
                WHERE TREND_RUN_SEQ = %s
                """,
                (int(trend_run_seq),),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _publish_run(trend_run_seq: int) -> None:
    conn = get_conn(autocommit=False)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE T_TREND_RUN
                SET RUN_STATUS = 'PUBLISHED',
                    COMPLETED_AT = COALESCE(COMPLETED_AT, NOW()),
                    PUBLISHED_AT = NOW()
                WHERE TREND_RUN_SEQ = %s
                """,
                (int(trend_run_seq),),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="전체 데이터 파이프라인 실행")
    parser.add_argument(
        "--steps",
        type=str,
        default=None,
        help="실행 단계 목록(콤마 구분). 미지정 시 RUN_ALL_STEPS 사용",
    )
    parser.add_argument(
        "--from-step",
        type=str,
        default=None,
        help="지정한 단계부터 실행. 예: --from-step wordcloud",
    )
    parser.add_argument(
        "--resume-latest-unpublished",
        action="store_true",
        help="복구 대상 날짜의 최신 IN_PROGRESS/FAILED run을 자동 선택해 실행",
    )
    parser.add_argument(
        "--resume-base-date",
        type=str,
        default=None,
        help="복구 대상 BASE_DATE(YYYY-MM-DD). 미지정 시 오늘 날짜 사용",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

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

    steps_raw = args.steps if args.steps is not None else getattr(settings, "run_all_steps", "")
    steps = _slice_steps_from(_parse_steps(steps_raw), args.from_step)
    fail_fast = bool(getattr(settings, "run_all_fail_fast", True))
    trend_run_steps = set(step_to_module) - {"trend"}
    resume_base_date = _parse_resume_base_date(args.resume_base_date)
    selected_trend_run_seq: int | None = (
        _fetch_latest_unpublished_trend_run_seq(base_date=resume_base_date)
        if bool(args.resume_latest_unpublished)
        else None
    )
    should_publish_selected_run = bool(args.resume_latest_unpublished)
    failed_steps: List[str] = []
    latest_trend_run_seq_before_trend: int | None = None

    if args.resume_latest_unpublished and "trend" in steps:
        steps = [step for step in steps if step != "trend"]
        print("[run_all] resume mode: removed trend step", flush=True)

    started_at = _now()
    batch_started_at = started_at.isoformat()
    child_env = os.environ.copy()
    child_env["NEWSIGHT_BATCH_STARTED_AT"] = batch_started_at

    print(
        "[run_all] "
        f"env={settings.app_env} tz={settings.tz} "
        f"fail_fast={int(fail_fast)} steps={steps} "
        f"resume_latest_unpublished={int(bool(args.resume_latest_unpublished))} "
        f"resume_base_date={resume_base_date} "
        f"selected_trend_run_seq={selected_trend_run_seq or '-'} "
        f"started_at={batch_started_at}",
        flush=True,
    )

    for idx, step in enumerate(steps, start=1):
        module = step_to_module.get(step)
        if not module:
            msg = f"[run_all] ({idx}/{len(steps)}) unknown step: {step}"
            failed_steps.append(step)
            if selected_trend_run_seq is not None and should_publish_selected_run:
                _mark_run_failed(selected_trend_run_seq)
            if fail_fast:
                raise RuntimeError(msg)
            print(msg, flush=True)
            continue

        print(f"[run_all] ({idx}/{len(steps)}) start: {step} -> python -m {module}", flush=True)

        # 각 job은 settings(.env)를 읽어서 동작한다.
        # - run_all은 추가 로그 파일 생성 X
        # - job별 logs 폴더에 기존대로 로그 생성
        cmd = [sys.executable, "-m", module]
        if step in trend_run_steps:
            if selected_trend_run_seq is None:
                selected_trend_run_seq = _fetch_latest_trend_run_seq()
                print(
                    f"[run_all] selected trend_run_seq={selected_trend_run_seq}",
                    flush=True,
                )
            cmd.extend(["--trend-run-seq", str(int(selected_trend_run_seq))])
        elif step == "trend":
            latest_trend_run_seq_before_trend = _fetch_optional_latest_trend_run_seq()

        try:
            subprocess.run(cmd, check=True, env=child_env)
            if step == "trend":
                selected_trend_run_seq = _fetch_created_trend_run_seq(latest_trend_run_seq_before_trend)
                should_publish_selected_run = True
                print(
                    f"[run_all] selected trend_run_seq={selected_trend_run_seq}",
                    flush=True,
                )
            print(f"[run_all] ({idx}/{len(steps)}) done: {step}", flush=True)
        except subprocess.CalledProcessError as e:
            failed_steps.append(step)
            print(f"[run_all] ({idx}/{len(steps)}) FAIL: {step} (exit={e.returncode})", flush=True)
            if selected_trend_run_seq is not None and should_publish_selected_run:
                _mark_run_failed(selected_trend_run_seq)
            if fail_fast:
                raise

    if selected_trend_run_seq is not None and should_publish_selected_run and not failed_steps:
        _publish_run(selected_trend_run_seq)
        print(f"[run_all] published trend_run_seq={selected_trend_run_seq}", flush=True)
    elif selected_trend_run_seq is not None and should_publish_selected_run:
        print(
            f"[run_all] not published trend_run_seq={selected_trend_run_seq} failed_steps={failed_steps}",
            flush=True,
        )

    ended_at = _now()
    print(f"[run_all] knows: started_at={started_at.isoformat()} ended_at={ended_at.isoformat()}", flush=True)


if __name__ == "__main__":
    main()
