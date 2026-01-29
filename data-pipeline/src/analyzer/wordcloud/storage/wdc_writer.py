# data-pipeline/src/analyzer/wordcloud/storage/wdc_writer.py
# 워드클라우드 결과 저장(DB write) 모듈
#
# 저장 대상 테이블(ERD 기준):
# - T_ANALYZE_WORDCLOUD (헤더)
# - T_ANALYZE_WORDCLOUD_ITEM (단어 아이템)
#
# 정책:
# - (TREND_RUN_SEQ, KEYWORD_SEQ, MEDIA_CODE, PERIOD_FILTER, WC_TYPE) 조합은 헤더 1행만 존재(UNIQUE)
# - 같은 조합으로 다시 생성 시:
#   1) 헤더는 upsert로 WC_SEQ를 확보하되, CREATED_AT(최초 생성 시각)은 절대 변경하지 않는다.
#   2) 해당 WC_SEQ의 아이템을 전부 삭제 후 재삽입(랭킹/가중치 재생성) -> 아이템 CREATED_AT은 새로 찍힘(정상)
#
# 주의:
# - commit/rollback은 호출자가 관리(바깥에서 트랜잭션 처리)

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence


@dataclass(frozen=True)
class WordcloudItem:
    """
    T_ANALYZE_WORDCLOUD_ITEM 저장 단위(ERD 기준)
    - WORD_COUNT 컬럼이 없으므로 count는 저장하지 않는다.
    """
    rank_no: int
    word_text: str
    weight: Decimal


def upsert_wordcloud_header(
    *,
    conn,
    trend_run_seq: int,
    keyword_seq: int,
    media_code: int,
    period_filter: str,  # 'TODAY' | 'D7' | 'D14'
    wc_type: str,        # 'TITLE' | 'CONTENT' | 'COMMENT'
) -> int:
    """
    헤더 upsert 후 WC_SEQ를 반환한다.
    (ERD 기준: WC_SEQ PK)

    정책:
    - CREATED_AT은 '최초 생성 시각'이므로, 중복 갱신 시 절대 업데이트하지 않는다.
    - INSERT 시 CREATED_AT은 DB DEFAULT(CURRENT_TIMESTAMP)에 맡긴다.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO T_ANALYZE_WORDCLOUD (
              TREND_RUN_SEQ,
              KEYWORD_SEQ,
              MEDIA_CODE,
              PERIOD_FILTER,
              WC_TYPE
            )
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              WC_SEQ = WC_SEQ
            """,
            (int(trend_run_seq), int(keyword_seq), int(media_code), str(period_filter), str(wc_type)),
        )

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT WC_SEQ
            FROM T_ANALYZE_WORDCLOUD
            WHERE TREND_RUN_SEQ = %s
              AND KEYWORD_SEQ = %s
              AND MEDIA_CODE = %s
              AND PERIOD_FILTER = %s
              AND WC_TYPE = %s
            """,
            (int(trend_run_seq), int(keyword_seq), int(media_code), str(period_filter), str(wc_type)),
        )
        row = cur.fetchone() or {}
        wc_seq = row.get("WC_SEQ")
        if wc_seq is None:
            raise RuntimeError("워드클라우드 헤더 UPSERT 후 WC_SEQ를 찾지 못했습니다.")
        return int(wc_seq)


def delete_wordcloud_items_by_wc_seq(*, conn, wc_seq: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM T_ANALYZE_WORDCLOUD_ITEM
            WHERE WC_SEQ = %s
            """,
            (int(wc_seq),),
        )
        return int(cur.rowcount or 0)


def insert_wordcloud_items(
    *,
    conn,
    wc_seq: int,
    items: Sequence[WordcloudItem],
) -> int:
    """
    아이템 INSERT
    - ERD 기준 컬럼: (WC_ITEM_SEQ PK auto), RANK_NO, WORD_TEXT, WEIGHT, CREATED_AT, WC_SEQ
    - 따라서 INSERT에는 WC_ITEM_SEQ/CREATED_AT는 넣지 않는다.
    """
    if not items:
        return 0

    rows = []
    for it in items:
        rows.append(
            (
                int(wc_seq),
                int(it.rank_no),
                str(it.word_text)[:80],  # ERD: VARCHAR(80)
                str(it.weight),          # Decimal -> 문자열로 안전 변환
            )
        )

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO T_ANALYZE_WORDCLOUD_ITEM (
              WC_SEQ,
              RANK_NO,
              WORD_TEXT,
              WEIGHT
            )
            VALUES (%s, %s, %s, %s)
            """,
            rows,
        )
    return len(rows)


def replace_wordcloud_items(
    *,
    conn,
    wc_seq: int,
    items: Sequence[WordcloudItem],
) -> dict:
    """
    (삭제 후 재삽입) 결과 요약을 반환한다.
    - 아이템은 매번 새로 생성되므로 CREATED_AT이 갱신(새로 찍힘)되는 것이 정상이다.
    """
    deleted = delete_wordcloud_items_by_wc_seq(conn=conn, wc_seq=wc_seq)
    inserted = insert_wordcloud_items(conn=conn, wc_seq=wc_seq, items=items)
    return {"wc_seq": int(wc_seq), "deleted": int(deleted), "inserted": int(inserted)}
