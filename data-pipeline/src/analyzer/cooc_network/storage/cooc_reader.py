# data-pipeline/src/analyzer/cooc_network/storage/cooc_reader.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import List, Sequence, Tuple
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings


@dataclass(frozen=True)
class CoocArticleTextRow:
    article_seq: int
    keyword_seq: int
    media_code: int
    text: str


def _fetch_base_date_for_run(trend_run_seq: int) -> date:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT BASE_DATE AS base_date
                FROM T_TREND_RUN
                WHERE TREND_RUN_SEQ = %s
                """,
                (int(trend_run_seq),),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f"존재하지 않는 TREND_RUN_SEQ 입니다: {trend_run_seq}")
            return row["base_date"]
    finally:
        conn.close()


def _period_range(base_date: date, period_filter: str) -> Tuple[datetime, datetime]:
    """
    기간 필터에 대한 datetime 범위 [start, end)

    - TODAY: base_date 00:00:00 ~ (base_date+1) 00:00:00
    - D7:    (base_date-6) 00:00:00 ~ (base_date+1) 00:00:00
    - D14:   (base_date-13) 00:00:00 ~ (base_date+1) 00:00:00

    주의:
    - DB의 PUBLISHED_AT은 MySQL DATETIME(타임존 정보 없음)이라 tz-aware datetime을 그대로 넘기면
      드라이버/설정에 따라 에러 또는 의도치 않은 변환이 발생할 수 있다.
    - 따라서 settings.tz 기준으로 경계를 계산하되, 최종적으로 tzinfo를 제거한 naive datetime을 반환한다.
    """
    period = (period_filter or "").strip().upper()

    try:
        tz = ZoneInfo(settings.tz)
    except Exception:
        # 잘못된 TZ가 들어온 경우 안전 기본값
        tz = ZoneInfo("Asia/Seoul")

    def _naive_local(dt: datetime) -> datetime:
        # 로컬 기준 "시각"은 유지하되 tzinfo만 제거 (MySQL DATETIME 파라미터 안전화)
        return dt.replace(tzinfo=None)

    if period == "TODAY":
        start_aware = datetime.combine(base_date, datetime.min.time(), tzinfo=tz)
        end_aware = start_aware + timedelta(days=1)
        return _naive_local(start_aware), _naive_local(end_aware)

    if period == "D7":
        start_date = base_date - timedelta(days=6)
        start_aware = datetime.combine(start_date, datetime.min.time(), tzinfo=tz)
        end_aware = datetime.combine(base_date, datetime.min.time(), tzinfo=tz) + timedelta(days=1)
        return _naive_local(start_aware), _naive_local(end_aware)

    if period == "D14":
        start_date = base_date - timedelta(days=13)
        start_aware = datetime.combine(start_date, datetime.min.time(), tzinfo=tz)
        end_aware = datetime.combine(base_date, datetime.min.time(), tzinfo=tz) + timedelta(days=1)
        return _naive_local(start_aware), _naive_local(end_aware)

    raise ValueError(f"지원하지 않는 period_filter: {period_filter}")


def fetch_keyword_seqs_for_trend_run(*, trend_run_seq: int) -> List[int]:
    """
    이번 TREND_RUN_SEQ에 포함된 키워드(KEYWORD_SEQ) 전체 조회
    - 스냅샷 순서(TREND_RANK) 기준으로 정렬
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT KEYWORD_SEQ AS keyword_seq
                FROM T_TREND_KEYWORD_SNAPSHOT
                WHERE TREND_RUN_SEQ = %s
                ORDER BY TREND_RANK ASC
                """,
                (int(trend_run_seq),),
            )
            rows = cur.fetchall() or []
            return [int(r["keyword_seq"]) for r in rows]
    finally:
        conn.close()


def fetch_articles_text_for_cooc(
    *,
    trend_run_seq: int,
    period_filter: str,
    keyword_seqs: Sequence[int],
    text_source: str,  # "TITLE" | "CONTENT" | "BOTH"
    min_text_chars: int,  # CHAR_LENGTH 기준
) -> List[CoocArticleTextRow]:
    """
    공동언급 대상 텍스트 조회
    - 기간은 PUBLISHED_AT 기준
    - TITLE_CLEAN / CONTENT_CLEAN 사용
    """
    if not keyword_seqs:
        return []

    base_date = _fetch_base_date_for_run(int(trend_run_seq))
    start_dt, end_dt = _period_range(base_date, period_filter)

    src = (text_source or "").strip().upper()
    if src not in {"TITLE", "CONTENT", "BOTH"}:
        src = "CONTENT"

    min_text_chars = max(0, int(min_text_chars))

    # 선택 텍스트 구성
    if src == "TITLE":
        select_text = "TITLE_CLEAN"
        not_empty_cond = "TITLE_CLEAN IS NOT NULL AND TRIM(TITLE_CLEAN) <> ''"
        len_cond = "CHAR_LENGTH(TITLE_CLEAN) >= %s" if min_text_chars > 0 else "1=1"
        len_params = [min_text_chars] if min_text_chars > 0 else []
    elif src == "BOTH":
        # '\n' 리터럴 대신 CHAR(10) 사용(안전하게 개행 결합)
        select_text = "CONCAT_WS(CHAR(10), TITLE_CLEAN, CONTENT_CLEAN)"
        not_empty_cond = (
            "( (TITLE_CLEAN IS NOT NULL AND TRIM(TITLE_CLEAN) <> '') "
            "OR (CONTENT_CLEAN IS NOT NULL AND TRIM(CONTENT_CLEAN) <> '') )"
        )
        len_cond = f"CHAR_LENGTH({select_text}) >= %s" if min_text_chars > 0 else "1=1"
        len_params = [min_text_chars] if min_text_chars > 0 else []
    else:
        select_text = "CONTENT_CLEAN"
        not_empty_cond = "CONTENT_CLEAN IS NOT NULL AND TRIM(CONTENT_CLEAN) <> ''"
        len_cond = "CHAR_LENGTH(CONTENT_CLEAN) >= %s" if min_text_chars > 0 else "1=1"
        len_params = [min_text_chars] if min_text_chars > 0 else []

    placeholders = ",".join(["%s"] * len(keyword_seqs))

    sql = f"""
        SELECT
          ARTICLE_SEQ AS article_seq,
          KEYWORD_SEQ AS keyword_seq,
          MEDIA_CODE  AS media_code,
          {select_text} AS text
        FROM T_NEWS_ARTICLE
        WHERE TREND_RUN_SEQ = %s
          AND KEYWORD_SEQ IN ({placeholders})
          AND PUBLISHED_AT >= %s
          AND PUBLISHED_AT <  %s
          AND {not_empty_cond}
          AND {len_cond}
    """

    params = [int(trend_run_seq), *[int(x) for x in keyword_seqs], start_dt, end_dt, *len_params]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall() or []

            out: List[CoocArticleTextRow] = []
            for r in rows:
                out.append(
                    CoocArticleTextRow(
                        article_seq=int(r["article_seq"]),
                        keyword_seq=int(r["keyword_seq"]),
                        media_code=int(r["media_code"]),
                        text=str(r["text"] or ""),
                    )
                )
            return out
    finally:
        conn.close()
