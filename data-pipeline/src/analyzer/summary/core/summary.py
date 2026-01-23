# data-pipeline/src/analyzer/summary/core/summary.py
# 키워드 AI 요약 생성(core)
# - DB 조회는 reader에 위임
# - DB 적재는 writer에 위임
# - jobs/run_summary.py가 엔트리포인트를 담당한다.

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, List

from src.common.db import get_conn
from src.config.settings import settings

from src.analyzer.summary.core.openai_summary_client import call_openai_summary
from src.analyzer.summary.storage.summary_reader import (
    PERIOD_D14,
    ArticleInput,
    get_base_date_for_run,
    select_articles_for_keyword_d14,
    select_keyword_name,
    select_keywords_for_summary,
)
from src.analyzer.summary.storage.summary_writer import (
    delete_summary_for_keyword,
    replace_mapping_rows,
    upsert_summary_header,
)


def _clip_content(text: str, *, clip_max: int) -> str:
    """
    CONTENT_CLEAN을 최대 clip_max까지만 잘라서 사용
    """
    s = (text or "").strip()
    if not s:
        return ""
    if len(s) > clip_max:
        return s[:clip_max].strip()
    return s


def _build_articles_block(*, articles: List[ArticleInput]) -> str:
    """
    템플릿에 주입할 기사 블록 문자열을 만든다.
    """
    lines: List[str] = []
    for idx, a in enumerate(articles, start=1):
        content = _clip_content(a.content_clean, clip_max=int(settings.ai_summary_content_clip_max))
        lines.append(f"[{idx}] MEDIA_CODE={a.media_code} PUBLISHED_AT={a.published_at.isoformat(sep=' ')}")
        lines.append(f"TITLE: {a.title_clean}")
        lines.append(f"CONTENT: {content}")
        lines.append("")  # 기사 간 빈 줄
    return "\n".join(lines).strip()


def _build_prompt(*, keyword_name: str, start_date: date, end_date: date, articles: List[ArticleInput]) -> str:
    """
    settings.ai_summary_user_prompt_template 기반으로 user 프롬프트를 생성한다.
    - {keyword_name}, {start_date}, {end_date}, {articles_block} 치환
    """
    tpl = (settings.ai_summary_user_prompt_template or "").strip()
    if not tpl:
        tpl = "{articles_block}"

    articles_block = _build_articles_block(articles=articles)

    vars_map: Dict[str, Any] = {
        "keyword_name": keyword_name,
        "start_date": str(start_date),
        "end_date": str(end_date),
        "articles_block": articles_block,
    }

    try:
        return tpl.format(**vars_map).strip()
    except Exception:
        # 템플릿이 잘못되었거나 포맷 실패 시, 최소한 기사 블록이라도 전달되도록 폴백
        return articles_block.strip()


def _print_keyword_log(payload: Dict[str, Any]) -> None:
    """
    키워드별 처리 현황을 콘솔에 한 줄 JSON으로 출력
    """
    try:
        print(json.dumps(payload, ensure_ascii=False))
    except Exception:
        # 콘솔 출력 실패는 전체 작업을 깨지 않도록 무시
        pass


def run_keyword_ai_summary_for_run(
    *,
    trend_run_seq: int,
    refresh_same_run: bool = False,
) -> Dict[str, Any]:
    """
    키워드 AI 요약 실행(비즈니스 로직):
    - 기간: D14 고정
    - 키워드: FINAL_RANK(D14) 상위 N(없으면 TREND_RANK 상위 N)
    - 기사: 언론사별 최신 N개(per_media_limit)
    - 요약 1건/키워드/런
    - 사용 기사 전부 매핑 저장
    """
    conn = get_conn(autocommit=False)
    try:
        base_date = get_base_date_for_run(conn=conn, trend_run_seq=trend_run_seq)
        start_date = base_date - timedelta(days=6)
        end_date = base_date

        keyword_seqs = select_keywords_for_summary(
            conn=conn,
            trend_run_seq=trend_run_seq,
            top_n=int(settings.ai_summary_keyword_top_n),
        )

        if not keyword_seqs:
            return {
                "trend_run_seq": trend_run_seq,
                "base_date": str(base_date),
                "period": PERIOD_D14,
                "keywords": 0,
                "written": 0,
                "skipped": 0,
                "deleted": 0,
                "note": "요약할 키워드를 찾지 못했습니다(FINAL_RANK, TREND_KEYWORD 모두 비어있음).",
            }

        deleted = 0
        written = 0
        skipped = 0
        details: List[Dict[str, Any]] = []

        # 실행 시작 로그(콘솔에서 refresh 여부가 바로 보이게)
        _print_keyword_log(
            {
                "event": "summary_start",
                "trend_run_seq": int(trend_run_seq),
                "period": PERIOD_D14,
                "base_date": str(base_date),
                "refresh": bool(refresh_same_run),
                "keywords": len(keyword_seqs),
            }
        )

        for idx, kseq in enumerate(keyword_seqs, start=1):
            kw_name = select_keyword_name(conn=conn, keyword_seq=kseq)

            deleted_this = 0
            if refresh_same_run:
                deleted_this = delete_summary_for_keyword(conn=conn, trend_run_seq=trend_run_seq, keyword_seq=kseq)
                deleted += deleted_this

                # 삭제가 실제로 발생했을 때만 로그를 찍으면 refresh 티가 확 남
                if deleted_this > 0:
                    _print_keyword_log(
                        {
                            "event": "refresh_deleted",
                            "trend_run_seq": int(trend_run_seq),
                            "keyword_seq": int(kseq),
                            "keyword_name": kw_name,
                            "deleted": int(deleted_this),
                            "progress": f"{idx}/{len(keyword_seqs)}",
                        }
                    )

            articles = select_articles_for_keyword_d14(
                conn=conn,
                trend_run_seq=trend_run_seq,
                keyword_seq=kseq,
                start_date=start_date,
                end_date=end_date,
                per_media_limit=int(settings.ai_summary_per_media_limit),
                content_min_chars=int(settings.ai_summary_content_min_chars),
            )

            if len(articles) < int(settings.ai_summary_min_articles):
                skipped += 1
                reason = f"선정 기사 수가 최소 기준({settings.ai_summary_min_articles}) 미만"

                details.append(
                    {
                        "keyword_seq": kseq,
                        "keyword_name": kw_name,
                        "articles_selected": len(articles),
                        "status": "skipped",
                        "reason": reason,
                    }
                )

                _print_keyword_log(
                    {
                        "event": "keyword_done",
                        "trend_run_seq": int(trend_run_seq),
                        "keyword_seq": int(kseq),
                        "keyword_name": kw_name,
                        "status": "skipped",
                        "articles_selected": int(len(articles)),
                        "reason": reason,
                        "deleted_before": int(deleted_this),
                        "progress": f"{idx}/{len(keyword_seqs)}",
                    }
                )
                continue

            prompt = _build_prompt(keyword_name=kw_name, start_date=start_date, end_date=end_date, articles=articles)
            summary_text = call_openai_summary(prompt)

            summary_seq = upsert_summary_header(
                conn=conn,
                trend_run_seq=trend_run_seq,
                keyword_seq=kseq,
                summary_text=summary_text,
            )

            article_seqs = [a.article_seq for a in articles]
            replace_mapping_rows(conn=conn, summary_seq=summary_seq, article_seqs_in_order=article_seqs)

            conn.commit()
            written += 1

            details.append(
                {
                    "keyword_seq": kseq,
                    "keyword_name": kw_name,
                    "summary_seq": summary_seq,
                    "articles_selected": len(articles),
                    "status": "written",
                }
            )

            _print_keyword_log(
                {
                    "event": "keyword_done",
                    "trend_run_seq": int(trend_run_seq),
                    "keyword_seq": int(kseq),
                    "keyword_name": kw_name,
                    "status": "written",
                    "summary_seq": int(summary_seq),
                    "articles_selected": int(len(articles)),
                    "deleted_before": int(deleted_this),
                    "progress": f"{idx}/{len(keyword_seqs)}",
                }
            )

        return {
            "trend_run_seq": trend_run_seq,
            "base_date": str(base_date),
            "period": PERIOD_D14,
            "keywords": len(keyword_seqs),
            "written": written,
            "skipped": skipped,
            "deleted": deleted,
            "policy": {
                "per_media_limit": int(settings.ai_summary_per_media_limit),
                "content_clip_max": int(settings.ai_summary_content_clip_max),
                "content_min_chars": int(settings.ai_summary_content_min_chars),
                "min_articles": int(settings.ai_summary_min_articles),
                "keyword_top_n": int(settings.ai_summary_keyword_top_n),
            },
            "details": details,
        }

    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()
