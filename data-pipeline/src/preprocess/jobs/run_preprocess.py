# data-pipeline/src/preprocess/jobs/run_preprocess.py
# 네이버 뉴스 본문/제목/댓글의 전처리 파이프라인을 실행 가능한 형태로 묶는 실행 스크립트
#
# 목표:
# - 기본 실행 옵션(trend_run_seq, refresh)을 .env -> settings로 제어
# - 최종적으로 python -m src.preprocess.jobs.run_preprocess 만으로 실행 가능
# - (디버깅용) CLI로 옵션을 줄 수도 있지만, 안 줘도 settings 기본값으로 동작

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings
from src.preprocess.core.preprocess import clean_text
from src.preprocess.storage.preprocess_reader import (
    select_pending_articles,
    select_pending_comments,
)
from src.preprocess.storage.preprocess_writer import (
    update_articles,
    update_comments,
)


def _settings_summary_one_line(*, refresh: bool, trend_run_seq: int | None) -> str:
    tr = "all" if trend_run_seq is None else str(int(trend_run_seq))
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"preprocess(batch_article={settings.preprocess_article_batch_size},batch_comment={settings.preprocess_comment_batch_size}) "
        f"trend_run_seq={tr} "
        f"refresh={int(bool(refresh))}"
    )


def _now_naive_in_app_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz)).replace(tzinfo=None)


def _run_one_round(
    *,
    conn,
    article_take: int,
    comment_take: int,
    refresh: bool,
    after_article_seq: Optional[int],
    after_comment_seq: Optional[int],
    trend_run_seq: Optional[int],
) -> Dict[str, Any]:
    """
    전처리 1라운드:
    - reader로 배치 조회
    - clean_text 적용
    - writer로 UPDATE
    - commit은 호출자(run_preprocess)가 수행
    """
    batch_article = int(settings.preprocess_article_batch_size)
    batch_comment = int(settings.preprocess_comment_batch_size)

    # 1) SELECT (reader)
    articles = select_pending_articles(
        conn=conn,
        take=article_take,
        refresh=refresh,
        after_article_seq=after_article_seq if refresh else None,
        trend_run_seq=trend_run_seq,
    )
    comments = select_pending_comments(
        conn=conn,
        take=comment_take,
        refresh=refresh,
        after_comment_seq=after_comment_seq if refresh else None,
        trend_run_seq=trend_run_seq,
    )

    # 2) CLEAN + UPDATE (writer)
    now = _now_naive_in_app_tz()

    article_update_rows: List[Tuple[Any, ...]] = []
    for r in articles:
        title_clean = clean_text(r.title) or None
        content_clean = clean_text(r.content_text) or None
        article_update_rows.append((title_clean, content_clean, now, r.article_seq))

    comment_update_rows: List[Tuple[Any, ...]] = []
    for r in comments:
        comment_clean = clean_text(r.comment_text) or None
        comment_update_rows.append((comment_clean, now, r.comment_seq))

    articles_updated = update_articles(
        conn=conn,
        update_rows=article_update_rows,
        batch=batch_article,
        refresh=refresh,
    )
    comments_updated = update_comments(
        conn=conn,
        update_rows=comment_update_rows,
        batch=batch_comment,
        refresh=refresh,
    )

    a_last = max((int(r.article_seq) for r in articles), default=None)
    c_last = max((int(r.comment_seq) for r in comments), default=None)

    return {
        "trend_run_seq": int(trend_run_seq) if trend_run_seq is not None else None,
        "refresh": bool(refresh),
        "articles_selected": len(articles),
        "articles_updated": int(articles_updated),
        "articles_last_seq": a_last,
        "comments_selected": len(comments),
        "comments_updated": int(comments_updated),
        "comments_last_seq": c_last,
        "batch": {"article": int(batch_article), "comment": int(batch_comment)},
    }


def main() -> None:
    parser = argparse.ArgumentParser()

    # 디버깅/특수 실행을 위해 CLI 오버라이드 허용(안 주면 settings 값 사용)
    parser.add_argument(
        "--trend-run-seq",
        type=int,
        default=None,
        help="특정 TREND_RUN_SEQ만 전처리(미지정이면 settings(PREPROCESS_TREND_RUN_SEQ) 사용, 0이면 전체)",
    )
    parser.add_argument(
        "--max-rounds",
        type=int,
        default=None,
        help="전처리 반복 최대 회수(미지정이면 무제한). 안전장치용",
    )
    parser.add_argument(
        "--refresh",
        default=None,
        action=argparse.BooleanOptionalAction,
        help="이미 전처리된 데이터까지 포함해 CLEAN/시간을 재생성(덮어쓰기). 미지정이면 settings(PREPROCESS_REFRESH) 사용",
    )
    args = parser.parse_args()

    # 1) settings 기본값 + (선택) CLI 오버라이드 적용
    refresh = bool(settings.preprocess_refresh) if args.refresh is None else bool(args.refresh)

    # settings: 0이면 전체 / 양수면 특정 run
    base_tr = int(settings.preprocess_trend_run_seq)
    if args.trend_run_seq is None:
        trend_run_seq_arg = base_tr
    else:
        trend_run_seq_arg = int(args.trend_run_seq)

    trend_run_seq = None if trend_run_seq_arg <= 0 else trend_run_seq_arg

    # max_rounds: 미지정이면 무제한(0)
    max_rounds = 0 if args.max_rounds is None else int(args.max_rounds)

    print(_settings_summary_one_line(refresh=refresh, trend_run_seq=trend_run_seq))

    logs_dir = Path(settings.log_dir_preprocess)
    logs_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(tz=ZoneInfo(settings.tz))
    ts = now.strftime("%Y%m%d_%H%M%S")

    # take 값: 별도 환경변수/옵션을 두지 않고, batch_size를 그대로 사용
    article_take = int(settings.preprocess_article_batch_size)
    comment_take = int(settings.preprocess_comment_batch_size)

    rounds = []
    total = {
        "articles_selected": 0,
        "articles_updated": 0,
        "comments_selected": 0,
        "comments_updated": 0,
    }

    round_no = 0
    stopped_reason = None

    # refresh 모드에서만 사용하는 SEQ 커서
    after_article_seq: Optional[int] = None
    after_comment_seq: Optional[int] = None

    conn = get_conn()
    try:
        while True:
            round_no += 1
            if max_rounds > 0 and round_no > max_rounds:
                stopped_reason = f"max_rounds_reached({max_rounds})"
                break

            try:
                r = _run_one_round(
                    conn=conn,
                    article_take=article_take,
                    comment_take=comment_take,
                    refresh=refresh,
                    after_article_seq=after_article_seq,
                    after_comment_seq=after_comment_seq,
                    trend_run_seq=trend_run_seq,
                )
                conn.commit()
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise

            for k in total:
                total[k] += int(r.get(k, 0))

            # refresh 모드면 커서 갱신
            if refresh:
                a_last = r.get("articles_last_seq")
                c_last = r.get("comments_last_seq")
                if a_last is not None:
                    after_article_seq = int(a_last)
                if c_last is not None:
                    after_comment_seq = int(c_last)

            rounds.append({"round": round_no, **r})
            print(json.dumps({"round": round_no, **r}, ensure_ascii=False))

            # 종료 조건: 이번 라운드에 읽을 게 없으면 종료
            if int(r.get("articles_selected", 0)) == 0 and int(r.get("comments_selected", 0)) == 0:
                break

    finally:
        try:
            conn.close()
        except Exception:
            pass

    result = {
        "mode": "preprocess_refresh" if refresh else "preprocess",
        "ran_at": now.isoformat(),
        "settings_summary": _settings_summary_one_line(refresh=refresh, trend_run_seq=trend_run_seq),
        "trend_run_seq": int(trend_run_seq) if trend_run_seq is not None else None,
        "take": {"article": int(article_take), "comment": int(comment_take)},
        "total": total,
        "rounds": rounds,
        "last": rounds[-1] if rounds else None,
        "stopped_reason": stopped_reason,
    }

    tr_tag = f"trend_{int(trend_run_seq)}_" if trend_run_seq is not None else ""
    out_path = logs_dir / f"run_preprocess_{tr_tag}{'refresh_' if refresh else ''}all_{ts}.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(result["total"], ensure_ascii=False, indent=2))
    print(f"saved: {out_path}")


if __name__ == "__main__":
    main()
