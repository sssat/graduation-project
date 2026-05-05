# data-pipeline/src/preprocess/storage/preprocess_reader.py
# 전처리를 진행하기 앞서 DB의 제목, 본문, 댓글 칼럼의 데이터를 읽어오는 코드
# refresh=False 모드라면 PREPROCESSED_AT IS NULL 인 기사/댓글을 배치 단위로 읽어오고, 
# refresh=True 모드라면 전처리 여부와 무관하게 모든 행을 대상으로 이미 전처리된 행까지 포함해서 읽어온다.
# 여기에 trend_run_seq가 지정되면 해당 TREND_RUN_SEQ 데이터만 대상으로 조회한다.


from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class PendingArticleRow:
    article_seq: int
    title: Optional[str]
    content_text: Optional[str]


@dataclass(frozen=True)
class PendingCommentRow:
    comment_seq: int
    comment_text: Optional[str]


def select_pending_articles(
    *,
    conn,
    take: int,
    refresh: bool = False,
    after_article_seq: Optional[int] = None,
    trend_run_seq: Optional[int] = None,
) -> List[PendingArticleRow]:
    take = max(1, int(take))

    conds: List[str] = []
    params: List[object] = []

    if not refresh:
        conds.append("PREPROCESSED_AT IS NULL")
    if after_article_seq is not None:
        conds.append("ARTICLE_SEQ > %s")
        params.append(int(after_article_seq))
    if trend_run_seq is not None:
        conds.append("TREND_RUN_SEQ = %s")
        params.append(int(trend_run_seq))

    where_sql = ""
    if conds:
        where_sql = "WHERE " + " AND ".join(conds)

    sql = f"""
        SELECT ARTICLE_SEQ, TITLE, CONTENT_TEXT
        FROM T_NEWS_ARTICLE
        {where_sql}
        ORDER BY ARTICLE_SEQ ASC
        LIMIT %s
    """
    params.append(take)

    with conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        rows = cur.fetchall() or []

    out: List[PendingArticleRow] = []
    for r in rows:
        out.append(
            PendingArticleRow(
                article_seq=int(r["ARTICLE_SEQ"]),
                title=r.get("TITLE"),
                content_text=r.get("CONTENT_TEXT"),
            )
        )
    return out


def select_pending_comments(
    *,
    conn,
    take: int,
    refresh: bool = False,
    after_comment_seq: Optional[int] = None,
    trend_run_seq: Optional[int] = None,
) -> List[PendingCommentRow]:
    take = max(1, int(take))

    conds: List[str] = []
    params: List[object] = []

    if not refresh:
        conds.append("C.PREPROCESSED_AT IS NULL")
    if after_comment_seq is not None:
        conds.append("C.COMMENT_SEQ > %s")
        params.append(int(after_comment_seq))
    if trend_run_seq is not None:
        # 댓글 테이블이 ARTICLE_SEQ(FK)를 가진다는 전제에서,
        # 기사 테이블과 JOIN하여 특정 TREND_RUN_SEQ만 필터링한다.
        conds.append("A.TREND_RUN_SEQ = %s")
        params.append(int(trend_run_seq))

    where_sql = ""
    if conds:
        where_sql = "WHERE " + " AND ".join(conds)

    sql = f"""
        SELECT C.COMMENT_SEQ, C.COMMENT_TEXT
        FROM T_NEWS_COMMENT C
        JOIN T_NEWS_ARTICLE A ON A.ARTICLE_SEQ = C.ARTICLE_SEQ
        {where_sql}
        ORDER BY C.COMMENT_SEQ ASC
        LIMIT %s
    """
    params.append(take)

    with conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        rows = cur.fetchall() or []

    out: List[PendingCommentRow] = []
    for r in rows:
        out.append(
            PendingCommentRow(
                comment_seq=int(r["COMMENT_SEQ"]),
                comment_text=r.get("COMMENT_TEXT"),
            )
        )
    return out
