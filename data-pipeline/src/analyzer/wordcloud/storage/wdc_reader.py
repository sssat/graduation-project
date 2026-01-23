# data-pipeline/src/analyzer/wordcloud/storage/wdc_reader.py
# 워드클라우드 입력용 DB 조회(reader)
# - 최신 TREND_RUN_SEQ
# - BASE_DATE
# - 요약/워드클라우드 대상 키워드 목록: "스냅샷 순위(T_TREND_KEYWORD_SNAPSHOT.TREND_RANK)" 기준
# - (run, keyword, media, period, wc_type) 단위로 입력 텍스트 후보 조회
#
# 주의:
# - 댓글 테이블 컬럼명은 프로젝트마다 조금씩 다를 수 있다.
#   아래 COMMENT 쿼리는 "T_NEWS_COMMENT(COMMENT_SEQ, ARTICLE_SEQ, COMMENT_CLEAN)" 형태를 가정한다.
#   실제 스키마와 다르면 쿼리의 컬럼명만 맞춰서 수정하면 된다.
#
# 수정:
# - period에 D14(최근 14일: base_date-13 ~ base_date) 지원 추가

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import List, Literal, Tuple
from zoneinfo import ZoneInfo

from src.config.settings import settings

PeriodFilter = Literal["TODAY", "D7", "D14"]
WcType = Literal["TITLE", "CONTENT", "COMMENT"]

PERIOD_TODAY: PeriodFilter = "TODAY"
PERIOD_D7: PeriodFilter = "D7"
PERIOD_D14: PeriodFilter = "D14"

WC_TITLE: WcType = "TITLE"
WC_CONTENT: WcType = "CONTENT"
WC_COMMENT: WcType = "COMMENT"

_ALLOWED_PERIODS = {PERIOD_TODAY, PERIOD_D7, PERIOD_D14}
_ALLOWED_TYPES = {WC_TITLE, WC_CONTENT, WC_COMMENT}


@dataclass(frozen=True)
class TextInputRow:
    """
    워드클라우드 입력 텍스트 1건
    - source_seq: 기사/댓글의 식별자(ARTICLE_SEQ 또는 COMMENT_SEQ)
    - text: *_CLEAN 텍스트
    """
    source_seq: int
    text: str


def require_period(period: str) -> PeriodFilter:
    p = (period or "").strip().upper()
    if p not in _ALLOWED_PERIODS:
        raise ValueError(f"지원하지 않는 period 입니다: {period!r} (allowed={sorted(_ALLOWED_PERIODS)})")
    return p  # type: ignore[return-value]


def require_type(wc_type: str) -> WcType:
    t = (wc_type or "").strip().upper()
    if t not in _ALLOWED_TYPES:
        raise ValueError(f"지원하지 않는 wc_type 입니다: {wc_type!r} (allowed={sorted(_ALLOWED_TYPES)})")
    return t  # type: ignore[return-value]


def resolve_date_window(*, base_date: date, period: PeriodFilter) -> tuple[date, date]:
    """
    period에 따라 [start_date, end_date] (둘 다 date, end_date 포함)을 계산한다.
    - TODAY: base_date 하루 (start=end=base_date)
    - D7:  base_date 포함 과거 7일 (base_date-6  ~ base_date)
    - D14: base_date 포함 과거 14일(base_date-13 ~ base_date)
    """
    if period == PERIOD_TODAY:
        return base_date, base_date
    if period == PERIOD_D7:
        return base_date - timedelta(days=6), base_date
    if period == PERIOD_D14:
        return base_date - timedelta(days=13), base_date
    raise ValueError(f"지원하지 않는 period 입니다: {period!r}")


def _to_datetime_range_in_tz(*, start_date: date, end_date_inclusive: date) -> Tuple[datetime, datetime]:
    """
    date 범위([start_date, end_date_inclusive])를 datetime 범위([start_dt, end_dt))로 변환한다.
    - start_dt: start_date 00:00:00 (settings.tz)
    - end_dt: (end_date_inclusive + 1일) 00:00:00 (settings.tz)
    """
    tz = ZoneInfo(settings.tz)
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=tz)
    end_dt = datetime.combine(end_date_inclusive + timedelta(days=1), datetime.min.time(), tzinfo=tz)
    return start_dt, end_dt


def get_latest_trend_run_seq(*, conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT MAX(TREND_RUN_SEQ) AS mx FROM T_TREND_RUN")
        row = cur.fetchone() or {}
        mx = row.get("mx")
        if mx is None:
            raise RuntimeError("T_TREND_RUN이 비어있습니다. 먼저 run_trend를 실행해 주세요.")
        return int(mx)


def get_base_date_for_run(*, conn, trend_run_seq: int) -> date:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT BASE_DATE AS base_date
            FROM T_TREND_RUN
            WHERE TREND_RUN_SEQ = %s
            """,
            (int(trend_run_seq),),
        )
        row = cur.fetchone() or {}
        base = row.get("base_date")
        if base is None:
            raise RuntimeError(f"T_TREND_RUN에서 BASE_DATE를 찾지 못했습니다. trend_run_seq={trend_run_seq}")
        return base


def select_keywords_for_wordcloud(
    *,
    conn,
    trend_run_seq: int,
) -> List[int]:
    """
    워드클라우드 대상 키워드 목록을 "스냅샷 순위(TREND_RANK)" 기준으로 조회한다.

    - settings.wordcloud_top_n > 0: 상위 N개만
    - settings.wordcloud_top_n == 0: 이번 run의 전체 키워드(스냅샷에 있는 만큼 전부)
    """
    top_n = max(0, int(settings.wordcloud_top_n))

    with conn.cursor() as cur:
        if top_n > 0:
            cur.execute(
                """
                SELECT KEYWORD_SEQ AS keyword_seq
                FROM T_TREND_KEYWORD_SNAPSHOT
                WHERE TREND_RUN_SEQ = %s
                ORDER BY TREND_RANK ASC
                LIMIT %s
                """,
                (int(trend_run_seq), int(top_n)),
            )
        else:
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


def select_keyword_name(*, conn, keyword_seq: int) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT KEYWORD_NAME AS keyword_name
            FROM T_TREND_KEYWORD_MASTER
            WHERE KEYWORD_SEQ = %s
            """,
            (int(keyword_seq),),
        )
        row = cur.fetchone() or {}
        return str(row.get("keyword_name") or "")


def _resolve_min_chars_for_type(wc_type: WcType) -> int:
    if wc_type == WC_TITLE:
        return max(0, int(settings.wordcloud_text_min_chars_title))
    if wc_type == WC_CONTENT:
        return max(0, int(settings.wordcloud_text_min_chars_content))
    if wc_type == WC_COMMENT:
        return max(0, int(settings.wordcloud_text_min_chars_comment))
    return 0


def _resolve_limit_rows_for_type(wc_type: WcType) -> int:
    if wc_type == WC_TITLE:
        return max(0, int(settings.wordcloud_limit_rows_title))
    if wc_type == WC_CONTENT:
        return max(0, int(settings.wordcloud_limit_rows_content))
    if wc_type == WC_COMMENT:
        return max(0, int(settings.wordcloud_limit_rows_comment))
    return 0


def select_article_texts_for_group(
    *,
    conn,
    trend_run_seq: int,
    keyword_seq: int,
    media_code: int,
    start_date: date,
    end_date: date,
    wc_type: WcType,
) -> List[TextInputRow]:
    wc_type = require_type(wc_type)

    if wc_type == WC_TITLE:
        col = "TITLE_CLEAN"
    elif wc_type == WC_CONTENT:
        col = "CONTENT_CLEAN"
    else:
        raise ValueError("COMMENT는 select_comment_texts_for_group()을 사용하세요.")

    text_min_chars = _resolve_min_chars_for_type(wc_type)
    limit_rows = _resolve_limit_rows_for_type(wc_type)

    sql_limit = "LIMIT %s" if limit_rows > 0 else ""

    # media_code=0이면 "전체"로 보고 MEDIA_CODE 조건을 제거한다.
    media_clause = "" if int(media_code) == 0 else "AND MEDIA_CODE = %s"

    start_dt, end_dt = _to_datetime_range_in_tz(start_date=start_date, end_date_inclusive=end_date)

    params: List[object] = [
        int(trend_run_seq),
        int(keyword_seq),
    ]
    if int(media_code) != 0:
        params.append(int(media_code))

    params.extend([start_dt, end_dt, int(text_min_chars)])

    if limit_rows > 0:
        params.append(int(limit_rows))

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
              ARTICLE_SEQ AS source_seq,
              {col} AS txt
            FROM T_NEWS_ARTICLE
            WHERE TREND_RUN_SEQ = %s
              AND KEYWORD_SEQ = %s
              {media_clause}
              AND PUBLISHED_AT IS NOT NULL
              AND PUBLISHED_AT >= %s
              AND PUBLISHED_AT <  %s
              AND {col} IS NOT NULL
              AND CHAR_LENGTH({col}) >= %s
            ORDER BY PUBLISHED_AT DESC, ARTICLE_SEQ DESC
            {sql_limit}
            """,
            tuple(params),
        )
        rows = cur.fetchall() or []

    return [TextInputRow(source_seq=int(r["source_seq"]), text=str(r["txt"] or "").strip()) for r in rows]


def select_comment_texts_for_group(
    *,
    conn,
    trend_run_seq: int,
    keyword_seq: int,
    media_code: int,
    start_date: date,
    end_date: date,
) -> List[TextInputRow]:
    text_min_chars = _resolve_min_chars_for_type(WC_COMMENT)
    limit_rows = _resolve_limit_rows_for_type(WC_COMMENT)

    sql_limit = "LIMIT %s" if limit_rows > 0 else ""

    # media_code=0이면 "전체"로 보고 a.MEDIA_CODE 조건을 제거한다.
    media_clause = "" if int(media_code) == 0 else "AND a.MEDIA_CODE = %s"

    start_dt, end_dt = _to_datetime_range_in_tz(start_date=start_date, end_date_inclusive=end_date)

    params: List[object] = [
        int(trend_run_seq),
        int(keyword_seq),
    ]
    if int(media_code) != 0:
        params.append(int(media_code))

    params.extend([start_dt, end_dt, int(text_min_chars)])

    if limit_rows > 0:
        params.append(int(limit_rows))

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
              c.COMMENT_SEQ AS source_seq,
              c.COMMENT_CLEAN AS txt
            FROM T_NEWS_COMMENT c
            JOIN T_NEWS_ARTICLE a
              ON a.ARTICLE_SEQ = c.ARTICLE_SEQ
            WHERE a.TREND_RUN_SEQ = %s
              AND a.KEYWORD_SEQ = %s
              {media_clause}
              AND a.PUBLISHED_AT IS NOT NULL
              AND a.PUBLISHED_AT >= %s
              AND a.PUBLISHED_AT <  %s
              AND c.COMMENT_CLEAN IS NOT NULL
              AND CHAR_LENGTH(c.COMMENT_CLEAN) >= %s
            ORDER BY a.PUBLISHED_AT DESC, a.ARTICLE_SEQ DESC, c.COMMENT_SEQ DESC
            {sql_limit}
            """,
            tuple(params),
        )
        rows = cur.fetchall() or []

    return [TextInputRow(source_seq=int(r["source_seq"]), text=str(r["txt"] or "").strip()) for r in rows]
