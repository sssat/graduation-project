# data-pipeline/src/crawler/news/storage/article_writer.py
# 네이버 뉴스 크롤링 결과를 DB에 적재하는 모듈

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from src.common.db import get_conn
from src.config.settings import settings


def _chunked(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    if size <= 0:
        yield seq
        return
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def _normalize_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    u = u.replace("m.news.naver.com", "n.news.naver.com")
    u = u.split("?", 1)[0]
    return u


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _has_article_payload(*, title: str, content_text: str) -> bool:
    return bool((title or "").strip() or (content_text or "").strip())


def _batch_sizes() -> tuple[int, int, int]:
    """
    배치 3종은 settings(.env)에서 중앙 관리한다.
    """
    a = max(1, int(settings.article_upsert_batch_size))
    c = max(1, int(settings.comment_insert_batch_size))
    k = max(1, int(settings.keyword_in_query_batch_size))
    return a, c, k


@dataclass(frozen=True)
class CrawledArticle:
    keyword_name: str
    trend_run_seq: int
    media_code: int
    source_url: str
    published_at: Optional[datetime]
    title: str
    content_text: str
    title_clean: Optional[str]
    content_clean: Optional[str]
    preprocessed_at: Optional[datetime]


@dataclass(frozen=True)
class CrawledCommentBundle:
    keyword_name: str
    trend_run_seq: int
    media_code: int
    source_url: str
    comments: List[str]



def _resolve_keyword_seq_map(conn, keyword_names: Sequence[str]) -> Dict[str, int]:
    """
    키워드 이름 -> KEYWORD_SEQ 매핑 조회
    전제: keyword_writer가 이미 T_TREND_KEYWORD_MASTER에 upsert 해두었음

    - IN (...) 파라미터도 안전하게 청크 처리
    """
    _article_batch, _comment_batch, keyword_in_query_batch_size = _batch_sizes()

    names = [n.strip() for n in keyword_names if (n or "").strip()]
    if not names:
        return {}

    out: Dict[str, int] = {}
    with conn.cursor() as cur:
        for chunk in _chunked(names, keyword_in_query_batch_size):
            placeholders = ",".join(["%s"] * len(chunk))
            cur.execute(
                f"""
                SELECT KEYWORD_SEQ, KEYWORD_NAME
                FROM T_TREND_KEYWORD_MASTER
                WHERE KEYWORD_NAME IN ({placeholders})
                """,
                list(chunk),
            )
            rows = cur.fetchall() or []
            for r in rows:
                out[str(r["KEYWORD_NAME"])] = int(r["KEYWORD_SEQ"])
    return out


def _delete_articles_by_run(*, conn, trend_run_seq: int) -> int:
    """
    같은 회차(trend_run_seq) 재실행 시:
    - 해당 회차의 기사 전부 삭제
    - 댓글은 FK ON DELETE CASCADE로 자동 삭제됨
    """
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM T_NEWS_ARTICLE WHERE TREND_RUN_SEQ = %s",
            (trend_run_seq,),
        )
        return int(cur.rowcount or 0)


def _upsert_articles_batch(
    *,
    conn,
    articles: List[CrawledArticle],
    keyword_seq_map: Dict[str, int],
) -> int:
    """
    댓글을 저장하지 않는 경우: 기사 업서트를 executemany로 처리(빠름)
    - article_upsert_batch_size로 청크 나눠서 executemany 수행
    """
    article_upsert_batch_size, _comment_batch, _keyword_in_query_batch = _batch_sizes()

    values: List[Tuple[Any, ...]] = []

    for a in articles:
        keyword_seq = keyword_seq_map.get(a.keyword_name)
        if keyword_seq is None:
            continue

        url = _normalize_url(a.source_url)
        if not url:
            continue

        title = (a.title or "").strip()
        content_text = (a.content_text or "").strip()
        if not _has_article_payload(title=title, content_text=content_text):
            continue

        url_hash = _sha256_hex(url)

        values.append(
            (
                url,
                url_hash,
                title[:300] if title else "",
                a.published_at,
                content_text if content_text else None,
                a.media_code,
                a.title_clean[:300] if (a.title_clean or "") else None,
                a.content_clean if a.content_clean else None,
                a.preprocessed_at,
                keyword_seq,
                a.trend_run_seq,
            )
        )

    if not values:
        return 0

    sql = """
        INSERT INTO T_NEWS_ARTICLE (
          SOURCE_URL, URL_HASH, TITLE, PUBLISHED_AT, CONTENT_TEXT, MEDIA_CODE,
          TITLE_CLEAN, CONTENT_CLEAN, PREPROCESSED_AT,
          KEYWORD_SEQ, TREND_RUN_SEQ
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
          TITLE = VALUES(TITLE),
          PUBLISHED_AT = VALUES(PUBLISHED_AT),
          CONTENT_TEXT = VALUES(CONTENT_TEXT),
          TITLE_CLEAN = VALUES(TITLE_CLEAN),
          CONTENT_CLEAN = VALUES(CONTENT_CLEAN),
          PREPROCESSED_AT = VALUES(PREPROCESSED_AT)
    """

    with conn.cursor() as cur:
        for chunk in _chunked(values, article_upsert_batch_size):
            cur.executemany(sql, list(chunk))

    return len(values)


def _upsert_one_article_return_seq(
    *,
    conn,
    article: CrawledArticle,
    keyword_seq: int,
) -> Optional[int]:
    """
    댓글 저장이 필요한 경우: 기사 1건 업서트 후 ARTICLE_SEQ를 얻는다.
    - ON DUPLICATE에서 ARTICLE_SEQ=LAST_INSERT_ID(ARTICLE_SEQ) 트릭으로 기존행도 lastrowid로 받음
    """
    url = _normalize_url(article.source_url)
    if not url:
        return None

    title = (article.title or "").strip()
    content_text = (article.content_text or "").strip()
    if not _has_article_payload(title=title, content_text=content_text):
        return None

    url_hash = _sha256_hex(url)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO T_NEWS_ARTICLE (
              SOURCE_URL, URL_HASH, TITLE, PUBLISHED_AT, CONTENT_TEXT, MEDIA_CODE,
              TITLE_CLEAN, CONTENT_CLEAN, PREPROCESSED_AT,
              KEYWORD_SEQ, TREND_RUN_SEQ
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              ARTICLE_SEQ = LAST_INSERT_ID(ARTICLE_SEQ),
              TITLE = VALUES(TITLE),
              PUBLISHED_AT = VALUES(PUBLISHED_AT),
              CONTENT_TEXT = VALUES(CONTENT_TEXT),
              TITLE_CLEAN = VALUES(TITLE_CLEAN),
              CONTENT_CLEAN = VALUES(CONTENT_CLEAN),
              PREPROCESSED_AT = VALUES(PREPROCESSED_AT)
            """,
            (
                url,
                url_hash,
                title[:300] if title else "",
                article.published_at,
                content_text if content_text else None,
                article.media_code,
                article.title_clean[:300] if (article.title_clean or "") else None,
                article.content_clean if article.content_clean else None,
                article.preprocessed_at,
                keyword_seq,
                article.trend_run_seq,
            ),
        )
        return int(cur.lastrowid) if cur.lastrowid else None


def _insert_comments_for_article(
    *,
    conn,
    article_seq: int,
    comments: List[str],
) -> int:
    """
    댓글 저장:
    - 입력 리스트 내부 중복만 제거한 뒤 INSERT 한다.
    - DB 중복 방지를 위해 COMMENT_HASH(sha256) 계산 후 저장한다.
      (유니크 충돌은 INSERT IGNORE로 무시)
    """
    _article_batch, comment_insert_batch_size, _keyword_in_query_batch = _batch_sizes()

    seen: set[str] = set()
    texts: List[str] = []
    for c in comments:
        t = (c or "").strip()
        if not t:
            continue
        if t in seen:
            continue
        seen.add(t)
        texts.append(t)

    if not texts:
        return 0

    # NOTE: T_NEWS_COMMENT에 COMMENT_HASH 컬럼이 있고
    # (ARTICLE_SEQ, COMMENT_HASH) 유니크 제약이 있다는 전제
    sql = """
        INSERT IGNORE INTO T_NEWS_COMMENT (
          ARTICLE_SEQ, COMMENT_TEXT, COMMENT_HASH, COMMENT_CLEAN, PREPROCESSED_AT
        )
        VALUES (%s, %s, %s, NULL, NULL)
    """

    rows: List[Tuple[Any, ...]] = []
    for t in texts:
        # 본문 기준으로 해시를 계산(전처리 clean은 나중 단계에서 채움)
        comment_hash = _sha256_hex(t)
        rows.append((article_seq, t, comment_hash))

    inserted = 0
    with conn.cursor() as cur:
        for chunk in _chunked(rows, comment_insert_batch_size):
            cur.executemany(sql, list(chunk))
            # INSERT IGNORE는 "시도한 행 수" != "실제 삽입된 행 수"일 수 있음
            # rowcount는 MySQL 드라이버에서 보통 "실제 삽입된 행 수"로 잡히는 편이라 합산
            inserted += int(cur.rowcount or 0)

    return inserted


def persist_articles(
    *,
    articles: List[CrawledArticle],
    comment_bundles: Optional[List[CrawledCommentBundle]] = None,
    refresh_same_run: bool = False,
) -> Dict[str, Any]:
    """
    기사/댓글 DB 적재

    - comment_bundles가 없으면 기사만 batch upsert
    - comment_bundles가 있으면 기사 1건씩 upsert하여 ARTICLE_SEQ 확보 후 댓글 insert

    - refresh_same_run=True 이면, articles에 포함된 trend_run_seq의 기존 기사들을 먼저 삭제한다.
      (댓글은 CASCADE로 자동 삭제)
    """
    conn = get_conn()
    try:
        if refresh_same_run:
            run_seqs = sorted({int(a.trend_run_seq) for a in articles if a.trend_run_seq})
            deleted_articles = 0
            for rs in run_seqs:
                deleted_articles += _delete_articles_by_run(conn=conn, trend_run_seq=rs)
        else:
            deleted_articles = 0

        keyword_names = list({a.keyword_name for a in articles})
        keyword_seq_map = _resolve_keyword_seq_map(conn, keyword_names)

        total_articles = 0
        total_comments = 0

        if not comment_bundles:
            total_articles = _upsert_articles_batch(conn=conn, articles=articles, keyword_seq_map=keyword_seq_map)
            conn.commit()
            return {
                "articles_written": total_articles,
                "comments_written": 0,
                "mode": "articles_only_batch_refresh" if refresh_same_run else "articles_only_batch",
                "deleted_articles": deleted_articles,
            }

        bundle_map: Dict[Tuple[str, int, int, str], List[str]] = {}
        for b in comment_bundles:
            key = (b.keyword_name, b.trend_run_seq, b.media_code, _normalize_url(b.source_url))
            bundle_map[key] = b.comments

        for a in articles:
            keyword_seq = keyword_seq_map.get(a.keyword_name)
            if keyword_seq is None:
                continue

            article_seq = _upsert_one_article_return_seq(conn=conn, article=a, keyword_seq=keyword_seq)
            if not article_seq:
                continue

            total_articles += 1

            bkey = (a.keyword_name, a.trend_run_seq, a.media_code, _normalize_url(a.source_url))
            comments = bundle_map.get(bkey)
            if comments is not None:
                total_comments += _insert_comments_for_article(conn=conn, article_seq=article_seq, comments=comments)

        conn.commit()
        return {
            "articles_written": total_articles,
            "comments_written": total_comments,
            "mode": "articles_and_comments_refresh_run" if refresh_same_run else "articles_and_comments_insert",
            "deleted_articles": deleted_articles,
        }

    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()
