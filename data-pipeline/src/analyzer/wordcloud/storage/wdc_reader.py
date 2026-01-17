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

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Literal

from src.config.settings import settings

PeriodFilter = Literal["TODAY", "D7"]
WcType = Literal["TITLE", "CONTENT", "COMMENT"]

PERIOD_TODAY: PeriodFilter = "TODAY"
PERIOD_D7: PeriodFilter = "D7"

WC_TITLE: WcType = "TITLE"
WC_CONTENT: WcType = "CONTENT"
WC_COMMENT: WcType = "COMMENT"

_ALLOWED_PERIODS = {PERIOD_TODAY, PERIOD_D7}
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
    period에 따라 [start_date, end_date]를 계산한다.
    - TODAY: base_date 하루
    - D7: base_date 포함 과거 7일(base_date-6 ~ base_date)
    """
    if period == PERIOD_TODAY:
        return base_date, base_date
    return base_date - timedelta(days=6), base_date


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
            SELECT BASE_DATE
            FROM T_TREND_RUN
            WHERE TREND_RUN_SEQ = %s
            """,
            (int(trend_run_seq),),
        )
        row = cur.fetchone()
        if not row or not row.get("BASE_DATE"):
            raise RuntimeError(f"T_TREND_RUN에서 BASE_DATE를 찾지 못했습니다. trend_run_seq={trend_run_seq}")
        return row["BASE_DATE"]


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
                SELECT KEYWORD_SEQ
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
                SELECT KEYWORD_SEQ
                FROM T_TREND_KEYWORD_SNAPSHOT
                WHERE TREND_RUN_SEQ = %s
                ORDER BY TREND_RANK ASC
                """,
                (int(trend_run_seq),),
            )

        rows = cur.fetchall() or []
        return [int(r["KEYWORD_SEQ"]) for r in rows]


def select_keyword_name(*, conn, keyword_seq: int) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT KEYWORD_NAME
            FROM T_TREND_KEYWORD_MASTER
            WHERE KEYWORD_SEQ = %s
            """,
            (int(keyword_seq),),
        )
        row = cur.fetchone() or {}
        return str(row.get("KEYWORD_NAME") or "")


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
    """
    기사 기반(TITLE/CONTENT) 입력 텍스트 조회.
    - 기간 필터는 기사 PUBLISHED_AT 기준
    - *_CLEAN이 NULL이면 제외
    - text_min_chars / limit_rows 는 settings에서 읽는다.
    """
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
    params = [
        int(trend_run_seq),
        int(keyword_seq),
        int(media_code),
        start_date,
        end_date,
        int(text_min_chars),
    ]
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
              AND MEDIA_CODE = %s
              AND PUBLISHED_AT IS NOT NULL
              AND DATE(PUBLISHED_AT) BETWEEN %s AND %s
              AND {col} IS NOT NULL
              AND CHAR_LENGTH({col}) >= %s
            ORDER BY PUBLISHED_AT DESC, ARTICLE_SEQ DESC
            {sql_limit}
            """,
            tuple(params),
        )
        rows = cur.fetchall() or []

    out: List[TextInputRow] = []
    for r in rows:
        out.append(TextInputRow(source_seq=int(r["source_seq"]), text=str(r["txt"] or "").strip()))
    return out


def select_comment_texts_for_group(
    *,
    conn,
    trend_run_seq: int,
    keyword_seq: int,
    media_code: int,
    start_date: date,
    end_date: date,
) -> List[TextInputRow]:
    """
    댓글 기반(COMMENT) 입력 텍스트 조회.

    가정:
    - T_NEWS_COMMENT: (COMMENT_SEQ, ARTICLE_SEQ, COMMENT_CLEAN, ...)
    - T_NEWS_ARTICLE: (ARTICLE_SEQ, TREND_RUN_SEQ, KEYWORD_SEQ, MEDIA_CODE, PUBLISHED_AT)

    기간 필터:
    - 댓글 작성일 컬럼이 확실하지 않은 경우가 많아서,
      기사 PUBLISHED_AT 기준으로 period 윈도우를 맞춘다.

    text_min_chars / limit_rows 는 settings에서 읽는다.
    """
    text_min_chars = _resolve_min_chars_for_type(WC_COMMENT)
    limit_rows = _resolve_limit_rows_for_type(WC_COMMENT)

    sql_limit = "LIMIT %s" if limit_rows > 0 else ""
    params = [
        int(trend_run_seq),
        int(keyword_seq),
        int(media_code),
        start_date,
        end_date,
        int(text_min_chars),
    ]
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
              AND a.MEDIA_CODE = %s
              AND a.PUBLISHED_AT IS NOT NULL
              AND DATE(a.PUBLISHED_AT) BETWEEN %s AND %s
              AND c.COMMENT_CLEAN IS NOT NULL
              AND CHAR_LENGTH(c.COMMENT_CLEAN) >= %s
            ORDER BY a.PUBLISHED_AT DESC, a.ARTICLE_SEQ DESC, c.COMMENT_SEQ DESC
            {sql_limit}
            """,
            tuple(params),
        )
        rows = cur.fetchall() or []

    out: List[TextInputRow] = []
    for r in rows:
        out.append(TextInputRow(source_seq=int(r["source_seq"]), text=str(r["txt"] or "").strip()))
    return out
