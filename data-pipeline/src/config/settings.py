# data-pipeline/src/config/settings.py
# 프로젝트 설정(환경변수/.env)을 읽어서, 코드 어디서든 환경변수를 settings.xxx로 쓰게 해주고
# 일부 값은 범위 보정/안전화를 수행하는 중앙 설정 파일

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# settings.py 파일 위치 기준으로 위로 2단계 올라가서 프로젝트 루트 폴더 경로를 계산
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# 프로젝트 루트에 있는 .env 파일을 읽어서 환경변수로 로드한다.
# override=True라면 .env 값이 OS 환경변수보다 우선한다.
load_dotenv(PROJECT_ROOT / ".env", override=True)


# .env/환경변수에서 값을 꺼낼 때 형변환 + 기본값 처리를 안전하게 해주는 헬퍼 함수들
def _get_str(key: str, default: str) -> str:
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return default
    return v.strip()


def _get_int(key: str, default: int) -> int:
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return default
    try:
        return int(v)
    except ValueError:
        return default


def _get_float(key: str, default: float) -> float:
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return default
    try:
        return float(v)
    except ValueError:
        return default


def _get_bool01(key: str, default: bool) -> bool:
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return default
    return v.strip() == "1"


def _get_opt_bool01(key: str) -> Optional[bool]:
    """
    0/1 형태의 bool 환경변수를 Optional로 읽는다.
    - 값이 없으면 None
    - 값이 있으면 True/False
    """
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return None
    return v.strip() == "1"


def _get_csv_ints(key: str, default: tuple[int, ...]) -> tuple[int, ...]:
    """
    쉼표로 구분된 정수 목록을 파싱한다.
    예: "1023, 1025,1020" -> (1023, 1025, 1020)
    """
    raw = os.getenv(key)
    if raw is None or raw.strip() == "":
        return default

    items: list[int] = []
    for part in raw.split(","):
        s = part.strip()
        if not s:
            continue
        try:
            items.append(int(s))
        except ValueError:
            continue

    return tuple(items) if items else default


def _unescape_newlines(s: str) -> str:
    """
    .env에 \n 형태로 넣은 문자열을 실제 줄바꿈으로 변환한다.
    - python-dotenv는 멀티라인 env를 다루기 번거로워서, 텍스트 템플릿은 보통 \n로 넣는다.
    """
    if not s:
        return ""
    return s.replace("\\n", "\n").strip()


@dataclass(frozen=True)
class Settings:
    # ---------------------------------- 1. .env에서 정의한 환경변수 읽어오는 부분 ----------------------------------
    # App: 실행 환경 이름 + 프로젝트 기본 타임존 관련 환경변수 읽어오기
    app_env: str = _get_str("APP_ENV", "local")
    tz: str = _get_str("TZ", "Asia/Seoul")

    # DB: MySQL 접속 정보 관련 환경변수 읽어오기
    db_host: str = _get_str("DB_HOST", "127.0.0.1")
    db_port: int = _get_int("DB_PORT", 3306)
    db_name: str = _get_str("DB_NAME", "newsight")
    db_user: str = _get_str("DB_USER", "newsight")
    db_password: str = _get_str("DB_PASSWORD", "newspass")

    # Logging: 로그 출력 수준 관련 환경변수 읽어오기
    log_level: str = _get_str("LOG_LEVEL", "INFO")

    # jobs 로그 디렉토리(JSON) 관련 환경변수 읽어오기
    log_dir_trend: str = _get_str("LOG_DIR_TREND", "")
    log_dir_news: str = _get_str("LOG_DIR_NEWS", "")
    log_dir_preprocess: str = _get_str("LOG_DIR_PREPROCESS", "")
    log_dir_final_rank: str = _get_str("LOG_DIR_FINAL_RANK", "")
    log_dir_aggregate: str = _get_str("LOG_DIR_AGGREGATE", "")
    log_dir_summary: str = _get_str("LOG_DIR_SUMMARY", "")
    log_dir_sentiment_title: str = _get_str("LOG_DIR_SENTIMENT_TITLE", "")
    log_dir_sentiment_content: str = _get_str("LOG_DIR_SENTIMENT_CONTENT", "")
    log_dir_bias_title: str = _get_str("LOG_DIR_BIAS_TITLE", "")
    log_dir_bias_content: str = _get_str("LOG_DIR_BIAS_CONTENT", "")
    log_dir_wordcloud: str = _get_str("LOG_DIR_WORDCLOUD", "")

    # Selenium 관련 환경변수 읽어오기
    headless: bool = _get_bool01("HEADLESS", True)
    selenium_wait_seconds: int = _get_int("SELENIUM_WAIT_SECONDS", 30)

    # 구글 트렌드 URL 관련 환경변수 읽어오기
    trends_url: str = _get_str(
        "TRENDS_URL",
        "https://trends.google.com/trending?geo=KR&hours=168&sort=search-volume&status=active",
    )

    # 트렌드 크롤링에서 가져올 상위 키워드 개수
    trend_top_n: int = _get_int("TREND_TOP_N", 20)

    # 네이버 뉴스 크롤러 관련 환경변수 읽어오기
    news_article_concurrency: int = _get_int("NEWS_ARTICLE_CONCURRENCY", 20)
    news_http_conn_limit: int = _get_int("NEWS_HTTP_CONN_LIMIT", 80)
    news_http_conn_limit_per_host: int = _get_int("NEWS_HTTP_CONN_LIMIT_PER_HOST", 20)

    news_max_comments_per_article: int = _get_int("NEWS_MAX_COMMENTS_PER_ARTICLE", 30)
    news_comment_sample_rate: float = _get_float("NEWS_COMMENT_SAMPLE_RATE", 1.0)
    news_comment_sample_min: int = _get_int("NEWS_COMMENT_SAMPLE_MIN", 1)

    news_search_processes: int = _get_int("NEWS_SEARCH_PROCESSES", 3)
    news_comment_processes: int = _get_int("NEWS_COMMENT_PROCESSES", 3)

    news_days_back: int = _get_int("NEWS_DAYS_BACK", 7)
    news_start_page: int = _get_int("NEWS_START_PAGE", 1)
    news_end_page: int = _get_int("NEWS_END_PAGE", 3)

    article_upsert_batch_size: int = _get_int("ARTICLE_UPSERT_BATCH_SIZE", 400)
    comment_insert_batch_size: int = _get_int("COMMENT_INSERT_BATCH_SIZE", 500)
    keyword_in_query_batch_size: int = _get_int("KEYWORD_IN_QUERY_BATCH_SIZE", 500)

    retention_keep_last_n: int = _get_int("RETENTION_KEEP_LAST_N", 10)

    news_keyword_top_n: int = _get_int("NEWS_KEYWORD_TOP_N", 0)
    include_comments: bool = _get_bool01("INCLUDE_COMMENTS", False)

    # (추가) run_news 실행 옵션(NEWS 전용)
    news_trend_run_seq: int = _get_int("NEWS_TREND_RUN_SEQ", 0)
    news_refresh_same_run: bool = _get_bool01("NEWS_REFRESH_SAME_RUN", False)
    news_base_date: str = _get_str("NEWS_BASE_DATE", "")

    # (선택) 언론사 코드 목록을 .env로 바꾸고 싶을 때 사용
    news_press_codes: tuple[int, ...] = _get_csv_ints(
        "NEWS_PRESS_CODES",
        (1023, 1025, 1020, 1028, 1032, 1002, 1469, 1081, 1001),
    )

    # 전처리 관련 환경변수 읽어오기
    preprocess_article_batch_size: int = _get_int("PREPROCESS_ARTICLE_BATCH_SIZE", 300)
    preprocess_comment_batch_size: int = _get_int("PREPROCESS_COMMENT_BATCH_SIZE", 500)

    # (추가) run_preprocess 기본 실행 옵션을 .env로 제어
    preprocess_trend_run_seq: int = _get_int("PREPROCESS_TREND_RUN_SEQ", 0)
    preprocess_refresh: bool = _get_bool01("PREPROCESS_REFRESH", False)
    preprocess_max_rounds: int = _get_int("PREPROCESS_MAX_ROUNDS", 0)

    # 기사량 통계 집계(aggregate) 관련 환경변수 읽어오기
    agg_insert_chunk_size: int = _get_int("AGG_INSERT_CHUNK_SIZE", 800)

    # (추가) run_aggregate 기본 실행 옵션을 .env로 제어
    agg_trend_run_seq: int = _get_int("AGG_TREND_RUN_SEQ", 0)
    agg_periods: str = _get_str("AGG_PERIODS", "TODAY,D7,D14,D30")
    agg_refresh: bool = _get_bool01("AGG_REFRESH", False)

    # 최종순위에서 영문-only 허용 키워드 화이트리스트(콤마 구분 문자열)
    keyword_english_whitelist: str = _get_str("KEYWORD_ENGLISH_WHITELIST", "")

    # (추가) run_final_rank 기본 실행 옵션을 .env로 제어
    final_rank_trend_run_seq: int = _get_int("FINAL_RANK_TREND_RUN_SEQ", 0)
    final_rank_periods: str = _get_str("FINAL_RANK_PERIODS", "TODAY,D7,D14,D30")
    final_rank_refresh: bool = _get_bool01("FINAL_RANK_REFRESH", False)

    # AI 요약 관련 환경변수 읽어오기
    openai_api_key: str = _get_str("OPENAI_API_KEY", "")
    ai_summary_model: str = _get_str("AI_SUMMARY_MODEL", "gpt-4o-mini")
    ai_summary_temperature: float = _get_float("AI_SUMMARY_TEMPERATURE", 0.2)
    ai_summary_max_output_tokens: int = _get_int("AI_SUMMARY_MAX_OUTPUT_TOKENS", 600)

    ai_summary_keyword_top_n: int = _get_int("AI_SUMMARY_KEYWORD_TOP_N", 10)
    ai_summary_per_media_limit: int = _get_int("AI_SUMMARY_PER_MEDIA_LIMIT", 2)

    ai_summary_content_min_chars: int = _get_int("AI_SUMMARY_CONTENT_MIN_CHARS", 300)
    ai_summary_content_clip_max: int = _get_int("AI_SUMMARY_CONTENT_CLIP_MAX", 1200)

    ai_summary_min_articles: int = _get_int("AI_SUMMARY_MIN_ARTICLES", 6)

    # (추가) AI 요약 프롬프트(환경변수)
    ai_summary_system_prompt: str = _get_str(
        "AI_SUMMARY_SYSTEM_PROMPT",
        "너는 한국어 뉴스 요약 전문가다. 출력은 반드시 한국어로 한다.",
    )
    ai_summary_user_prompt_template: str = _get_str(
        "AI_SUMMARY_USER_PROMPT_TEMPLATE",
        (
            "너는 뉴스 요약 전문가다.\n"
            "키워드: {keyword_name}\n"
            "기간: {start_date} ~ {end_date} (최근 7일)\n\n"
            "아래는 여러 언론사 기사 제목/본문(일부)이다. 중복을 제거하고 핵심 흐름만 요약해라.\n"
            "출력은 한국어로, 과장 없이 사실 중심으로 작성해라.\n\n"
            "출력 형식:\n"
            "1) 한 줄 핵심 결론(요약 제목처럼)\n"
            "2) 핵심 흐름 5줄(각 줄은 1문장)\n"
            "3) 쟁점/논점 3개(불릿)\n\n"
            "기사 입력:\n"
            "{articles_block}"
        ),
    )

    # (추가) run_summary 기본 실행 옵션을 .env로 제어
    summary_trend_run_seq: int = _get_int("SUMMARY_TREND_RUN_SEQ", 0)
    summary_refresh: bool = _get_bool01("SUMMARY_REFRESH", False)

    # 제목 감성분석 관련 환경변수 읽어오기
    sentiment_title_model_name: str = _get_str("SENTIMENT_TITLE_MODEL_NAME", "snunlp/KR-FinBert-SC")
    sentiment_title_device: str = _get_str("SENTIMENT_TITLE_DEVICE", "cpu")
    sentiment_title_batch_size: int = _get_int("SENTIMENT_TITLE_BATCH_SIZE", 64)
    sentiment_title_max_length: int = _get_int("SENTIMENT_TITLE_MAX_LENGTH", 256)
    sentiment_title_keyword_top_n: int = _get_int("SENTIMENT_TITLE_KEYWORD_TOP_N", 0)

    # (추가) 제목 감성분석 그룹 최소 기사수 스킵 규칙
    # - 키워드×언론사(media_code!=0) 그룹 최소 기사 수
    # - 키워드×전체(media_code=0) 그룹 최소 기사 수(0이면 적용 안 함)
    sentiment_title_min_articles_per_group: int = _get_int("SENTIMENT_TITLE_MIN_ARTICLES_PER_GROUP", 0)
    sentiment_title_min_articles_overall: int = _get_int("SENTIMENT_TITLE_MIN_ARTICLES_OVERALL", 0)

    # (추가) run_title_sentiment 기본 실행 옵션을 .env로 제어
    sentiment_title_trend_run_seq: int = _get_int("SENTIMENT_TITLE_TREND_RUN_SEQ", 0)
    sentiment_title_periods: str = _get_str("SENTIMENT_TITLE_PERIODS", "TODAY,D7,D14,D30")
    sentiment_title_refresh: bool = _get_bool01("SENTIMENT_TITLE_REFRESH", False)

    # 본문 감성분석 관련 환경변수 읽어오기
    sentiment_content_model_name: str = _get_str("SENTIMENT_CONTENT_MODEL_NAME", "")
    sentiment_content_device: str = _get_str("SENTIMENT_CONTENT_DEVICE", "")
    sentiment_content_batch_size: int = _get_int("SENTIMENT_CONTENT_BATCH_SIZE", 16)
    sentiment_content_max_length: int = _get_int("SENTIMENT_CONTENT_MAX_LENGTH", 256)
    sentiment_content_keyword_top_n: int = _get_int("SENTIMENT_CONTENT_KEYWORD_TOP_N", 0)
    sentiment_content_chunk_size_chars: int = _get_int("SENTIMENT_CONTENT_CHUNK_SIZE_CHARS", 1200)
    sentiment_content_chunk_overlap_chars: int = _get_int("SENTIMENT_CONTENT_CHUNK_OVERLAP_CHARS", 200)
    sentiment_content_max_chunks: int = _get_int("SENTIMENT_CONTENT_MAX_CHUNKS", 6)
    sentiment_content_min_chars: int = _get_int("SENTIMENT_CONTENT_MIN_CHARS", 0)

    # (추가) run_content_sentiment 기본 실행 옵션을 .env로 제어
    sentiment_content_trend_run_seq: int = _get_int("SENTIMENT_CONTENT_TREND_RUN_SEQ", 0)
    sentiment_content_periods: str = _get_str("SENTIMENT_CONTENT_PERIODS", "TODAY,D7,D14,D30")
    sentiment_content_refresh: bool = _get_bool01("SENTIMENT_CONTENT_REFRESH", False)

    # (추가) 본문 감성분석 그룹 최소 기사수 스킵 규칙
    # - 키워드×언론사(media_code!=0) 그룹 최소 기사 수
    # - 키워드×전체(media_code=0) 그룹 최소 기사 수(0이면 적용 안 함)
    sentiment_content_min_articles_per_group: int = _get_int("SENTIMENT_CONTENT_MIN_ARTICLES_PER_GROUP", 0)
    sentiment_content_min_articles_overall: int = _get_int("SENTIMENT_CONTENT_MIN_ARTICLES_OVERALL", 0)

    # ---------------- (추가) 제목 편향도(run_title_bias) 기본 실행 옵션을 .env로 제어 ----------------
    # - BIAS_TITLE_TREND_RUN_SEQ=0 이면 최신 자동
    # - BIAS_TITLE_PERIOD 또는 BIAS_TITLE_PERIODS="TODAY,D7,D14,D30"
    # - BIAS_TITLE_REFRESH=1 이면 같은 run+period 범위에서 제목 점수만 reset 후 재적재
    bias_title_trend_run_seq: int = _get_int("BIAS_TITLE_TREND_RUN_SEQ", 0)

    # 사용자가 .env에 BIAS_TITLE_PERIOD=TODAY,D7,D14,D30 형태로 넣을 수 있으므로,
    # BIAS_TITLE_PERIODS를 먼저 보고 없으면 BIAS_TITLE_PERIOD를 본다(하위호환).
    bias_title_periods: str = _get_str("BIAS_TITLE_PERIODS", "")
    bias_title_period_legacy: str = _get_str("BIAS_TITLE_PERIOD", "")

    bias_title_refresh: bool = _get_bool01("BIAS_TITLE_REFRESH", False)

    # ---------------- (추가) 본문 편향도(run_content_bias) 기본 실행 옵션을 .env로 제어 ----------------
    # - BIAS_CONTENT_TREND_RUN_SEQ=0 이면 최신 자동
    # - BIAS_CONTENT_PERIODS="TODAY,D7,D14,D30"
    # - BIAS_CONTENT_REFRESH=1 이면 같은 run+period 범위에서 본문 점수만 reset 후 재적재
    bias_content_trend_run_seq: int = _get_int("BIAS_CONTENT_TREND_RUN_SEQ", 0)
    bias_content_periods: str = _get_str("BIAS_CONTENT_PERIODS", "TODAY,D7,D14,D30")
    bias_content_refresh: bool = _get_bool01("BIAS_CONTENT_REFRESH", False)

    # ---------------- (추가) 워드클라우드 입력 옵션(wdc_reader) 을 .env로 제어 ----------------
    # - WORDCLOUD_TOP_N=20: 워드클라우드 대상 키워드 상위 N개(0이면 이번 run 전체)
    # - WORDCLOUD_TEXT_MIN_CHARS_*: 입력 텍스트 최소 길이 컷(CHAR_LENGTH 기준)
    # - WORDCLOUD_LIMIT_ROWS_*: 그룹당 입력 텍스트 최대 개수(0이면 제한 없음)
    wordcloud_top_n: int = _get_int("WORDCLOUD_TOP_N", 20)

    wordcloud_text_min_chars_title: int = _get_int("WORDCLOUD_TEXT_MIN_CHARS_TITLE", 2)
    wordcloud_text_min_chars_content: int = _get_int("WORDCLOUD_TEXT_MIN_CHARS_CONTENT", 200)
    wordcloud_text_min_chars_comment: int = _get_int("WORDCLOUD_TEXT_MIN_CHARS_COMMENT", 5)

    wordcloud_limit_rows_title: int = _get_int("WORDCLOUD_LIMIT_ROWS_TITLE", 0)
    wordcloud_limit_rows_content: int = _get_int("WORDCLOUD_LIMIT_ROWS_CONTENT", 0)
    wordcloud_limit_rows_comment: int = _get_int("WORDCLOUD_LIMIT_ROWS_COMMENT", 0)


    # ---------------- (추가) 워드클라우드 전용 추가 전처리(wdc_preprocess) 옵션을 .env로 제어 ----------------
    # - WORDCLOUD_PRE_LOWERCASE_ENGLISH=1: 영문 소문자화
    # - WORDCLOUD_PRE_NORMALIZE_REPEATS=1: 반복 문자 축약
    # - WORDCLOUD_PRE_MAX_LEN=5000: 길이 상한(0이면 제한 없음)
    wordcloud_pre_lowercase_english: bool = _get_bool01("WORDCLOUD_PRE_LOWERCASE_ENGLISH", True)
    wordcloud_pre_normalize_repeats: bool = _get_bool01("WORDCLOUD_PRE_NORMALIZE_REPEATS", True)
    wordcloud_pre_max_len: int = _get_int("WORDCLOUD_PRE_MAX_LEN", 5000)


    # ---------------- (추가) 워드클라우드 토큰화(wdc_tokenize) 옵션을 .env로 제어 ----------------
    # - WORDCLOUD_TOKEN_MIN_LEN / WORDCLOUD_TOKEN_MAX_LEN: 토큰 길이 컷
    # - WORDCLOUD_DROP_NUMERIC_ONLY: 숫자-only 토큰 제거(0/1)
    # - WORDCLOUD_STOPWORDS_CSV: 콤마 구분 불용어
    # - WORDCLOUD_STOPWORDS_FILE: 불용어 파일 경로
    wordcloud_token_min_len: int = _get_int("WORDCLOUD_TOKEN_MIN_LEN", 2)
    wordcloud_token_max_len: int = _get_int("WORDCLOUD_TOKEN_MAX_LEN", 30)
    wordcloud_drop_numeric_only: bool = _get_bool01("WORDCLOUD_DROP_NUMERIC_ONLY", True)
    wordcloud_stopwords_csv: str = _get_str("WORDCLOUD_STOPWORDS_CSV", "")
    wordcloud_stopwords_file: str = _get_str("WORDCLOUD_STOPWORDS_FILE", "")

    # ---------------- (추가) 워드클라우드 계산(core/wordcloud) 옵션을 .env로 제어 ----------------
    # - WORDCLOUD_TOP_K: 결과로 뽑을 단어 상위 K개
    # - WORDCLOUD_WEIGHT_MODE: "log" | "count"
    wordcloud_top_k: int = _get_int("WORDCLOUD_TOP_K", 60)
    wordcloud_weight_mode: str = _get_str("WORDCLOUD_WEIGHT_MODE", "log")

    # ---------------- (추가) 워드클라우드(run_wordcloud) 실행 옵션을 .env로 제어 ----------------
    # - WORDCLOUD_TREND_RUN_SEQ=0 이면 최신 자동
    # - WORDCLOUD_PERIODS="TODAY,D7,D14,D30"
    # - WORDCLOUD_TYPES="TITLE,CONTENT,COMMENT"
    # - WORDCLOUD_REFRESH=1 이면 기존 결과가 있어도 재계산/덮어쓰기
    # - WORDCLOUD_MEDIA_CODES="0,1023,..." (비우면 기본: 0 + news_press_codes)
    wordcloud_trend_run_seq: int = _get_int("WORDCLOUD_TREND_RUN_SEQ", 0)
    wordcloud_periods: str = _get_str("WORDCLOUD_PERIODS", "TODAY,D7,D14,D30")
    wordcloud_types: str = _get_str("WORDCLOUD_TYPES", "TITLE,CONTENT,COMMENT")
    wordcloud_refresh: bool = _get_bool01("WORDCLOUD_REFRESH", False)

    # media codes는 int CSV로 파싱(비어있으면 default로 처리)
    wordcloud_media_codes: tuple[int, ...] = _get_csv_ints("WORDCLOUD_MEDIA_CODES", ())

    # (추가) run_all 실행 옵션을 .env로 제어
    run_all_steps: str = _get_str(
        "RUN_ALL_STEPS",
        "trend,news,preprocess,aggregate,final_rank,summary,title_sentiment,content_sentiment,title_bias,content_bias,wordcloud,cooc_network",
    )
    run_all_fail_fast: bool = _get_bool01("RUN_ALL_FAIL_FAST", True)

    # ---------------- (추가) 공동언급 네트워크(cooc_network) 옵션을 .env로 제어 ----------------
    # 실행 옵션
    cooc_trend_run_seq: int = _get_int("COOC_TREND_RUN_SEQ", 0)
    cooc_periods: str = _get_str("COOC_PERIODS", "TODAY,D7,D14,D30")
    cooc_keyword_top_n: int = _get_int("COOC_KEYWORD_TOP_N", 20)
    cooc_refresh: bool = _get_bool01("COOC_REFRESH", False)

    # 텍스트 소스: TITLE | CONTENT | BOTH
    cooc_text_source: str = _get_str("COOC_TEXT_SOURCE", "CONTENT")

    # 조회 텍스트 최소 길이(CHAR_LENGTH 기준)
    cooc_min_text_chars: int = _get_int("COOC_MIN_TEXT_CHARS", 200)

    # 전처리 옵션(기존 wordcloud 전처리 로직 재사용, 옵션만 cooc 전용)
    cooc_pre_lowercase_english: bool = _get_bool01("COOC_PRE_LOWERCASE_ENGLISH", True)
    cooc_pre_normalize_repeats: bool = _get_bool01("COOC_PRE_NORMALIZE_REPEATS", True)
    cooc_pre_max_len: int = _get_int("COOC_PRE_MAX_LEN", 5000)

    # 토큰화 옵션(공백 기반) + 불용어(.env 지정)
    cooc_token_min_len: int = _get_int("COOC_TOKEN_MIN_LEN", 2)
    cooc_token_max_len: int = _get_int("COOC_TOKEN_MAX_LEN", 30)
    cooc_drop_numeric_only: bool = _get_bool01("COOC_DROP_NUMERIC_ONLY", True)
    cooc_stopwords_csv: str = _get_str("COOC_STOPWORDS_CSV", "")
    cooc_stopwords_file: str = _get_str("COOC_STOPWORDS_FILE", "")

    # 네트워크 생성 옵션
    # - COOC_MODE: "doc" | "window"
    # - window 모드일 때 COOC_WINDOW_SIZE 사용
    cooc_mode: str = _get_str("COOC_MODE", "doc")
    cooc_window_size: int = _get_int("COOC_WINDOW_SIZE", 20)

    # 안전장치/출력 제한
    cooc_max_tokens_per_doc: int = _get_int("COOC_MAX_TOKENS_PER_DOC", 60)
    cooc_node_top_k: int = _get_int("COOC_NODE_TOP_K", 60)
    cooc_edge_top_k: int = _get_int("COOC_EDGE_TOP_K", 300)
    cooc_min_edge_weight: int = _get_int("COOC_MIN_EDGE_WEIGHT", 2)

    # (선택) cooc 로그 디렉토리 (현재 job는 파일 로그를 안 남기지만, 디렉토리는 통일 차원에서 둔다)
    log_dir_cooc_network: str = _get_str("LOG_DIR_COOC_NETWORK", "")


    # -------------------- 2. __post_init__(): 값 "안전 보정/정규화" 하는 부분 (전체 보정 작업 총괄) --------------------
    def __post_init__(self) -> None:
        def _resolve_dir(path_str: str) -> str:
            p = (path_str or "").strip()
            if not p:
                return ""
            path = Path(p)
            if not path.is_absolute():
                path = PROJECT_ROOT / path
            return str(path)

        # 1) trend top_n 안전화
        object.__setattr__(self, "trend_top_n", max(1, int(self.trend_top_n)))

        # 2) News 기본값/입력값 안전화
        days_back = max(1, int(self.news_days_back))
        start_page = max(1, int(self.news_start_page))
        end_page = max(start_page, int(self.news_end_page))

        object.__setattr__(self, "news_days_back", days_back)
        object.__setattr__(self, "news_start_page", start_page)
        object.__setattr__(self, "news_end_page", end_page)

        # 3) News 튜닝 값 안전화(0/음수 방지)
        object.__setattr__(self, "news_article_concurrency", max(1, int(self.news_article_concurrency)))
        object.__setattr__(self, "news_http_conn_limit", max(1, int(self.news_http_conn_limit)))
        object.__setattr__(self, "news_http_conn_limit_per_host", max(1, int(self.news_http_conn_limit_per_host)))
        object.__setattr__(self, "news_max_comments_per_article", max(1, int(self.news_max_comments_per_article)))
        object.__setattr__(self, "news_comment_sample_min", max(1, int(self.news_comment_sample_min)))
        object.__setattr__(self, "news_search_processes", max(1, int(self.news_search_processes)))
        object.__setattr__(self, "news_comment_processes", max(1, int(self.news_comment_processes)))

        # 4) press codes 안전화: 비어있으면 기본값 사용, 중복 제거(순서 유지)
        pcs = list(self.news_press_codes or ())
        if not pcs:
            pcs = [1023, 1025, 1020, 1028, 1032, 1002, 1469, 1081, 1001]
        seen: set[int] = set()
        deduped: list[int] = []
        for x in pcs:
            if x in seen:
                continue
            seen.add(x)
            deduped.append(int(x))
        object.__setattr__(self, "news_press_codes", tuple(deduped))

        # 5) NEWS_COMMENT_SAMPLE_RATE는 0.0~1.0 클램프
        rate = float(self.news_comment_sample_rate)
        rate = min(1.0, max(0.0, rate))
        object.__setattr__(self, "news_comment_sample_rate", rate)

        # 6) 파이프라인 옵션 안전화
        object.__setattr__(self, "news_keyword_top_n", max(0, int(self.news_keyword_top_n)))

        # 7) 배치 사이즈 안전화(0/음수 방지)
        object.__setattr__(self, "article_upsert_batch_size", max(1, int(self.article_upsert_batch_size)))
        object.__setattr__(self, "comment_insert_batch_size", max(1, int(self.comment_insert_batch_size)))
        object.__setattr__(self, "keyword_in_query_batch_size", max(1, int(self.keyword_in_query_batch_size)))

        # 8) retention 안전화
        keep_last_n = max(1, int(self.retention_keep_last_n))
        object.__setattr__(self, "retention_keep_last_n", keep_last_n)

        # 9) selenium wait 안전화
        object.__setattr__(self, "selenium_wait_seconds", max(1, int(self.selenium_wait_seconds)))

        # 10) preprocess 배치 사이즈 안전화
        object.__setattr__(self, "preprocess_article_batch_size", max(1, int(self.preprocess_article_batch_size)))
        object.__setattr__(self, "preprocess_comment_batch_size", max(1, int(self.preprocess_comment_batch_size)))

        # 10-1) run_preprocess 기본 옵션 안전화
        object.__setattr__(self, "preprocess_trend_run_seq", max(0, int(self.preprocess_trend_run_seq)))
        object.__setattr__(self, "preprocess_refresh", bool(self.preprocess_refresh))
        object.__setattr__(self, "preprocess_max_rounds", max(0, int(self.preprocess_max_rounds)))

        # 11) aggregate 안전화
        object.__setattr__(self, "agg_insert_chunk_size", max(1, int(self.agg_insert_chunk_size)))

        # 11-1) run_aggregate 기본 옵션 안전화/정규화
        object.__setattr__(self, "agg_trend_run_seq", max(0, int(self.agg_trend_run_seq)))
        periods = (self.agg_periods or "").strip()
        if not periods:
            periods = "TODAY,D7,D14,D30"
        object.__setattr__(self, "agg_periods", periods)
        object.__setattr__(self, "agg_refresh", bool(self.agg_refresh))

        # 12) run_final_rank 기본 옵션 안전화/정규화
        object.__setattr__(self, "final_rank_trend_run_seq", max(0, int(self.final_rank_trend_run_seq)))
        fr_periods = (self.final_rank_periods or "").strip()
        if not fr_periods:
            fr_periods = "TODAY,D7,D14,D30"
        object.__setattr__(self, "final_rank_periods", fr_periods)
        object.__setattr__(self, "final_rank_refresh", bool(self.final_rank_refresh))

        # 13) AI Summary 안전화
        object.__setattr__(self, "ai_summary_max_output_tokens", max(64, int(self.ai_summary_max_output_tokens)))
        object.__setattr__(self, "ai_summary_keyword_top_n", max(0, int(self.ai_summary_keyword_top_n)))
        object.__setattr__(self, "ai_summary_per_media_limit", max(1, int(self.ai_summary_per_media_limit)))
        object.__setattr__(self, "ai_summary_content_min_chars", max(0, int(self.ai_summary_content_min_chars)))

        clip_max = max(0, int(self.ai_summary_content_clip_max))
        object.__setattr__(self, "ai_summary_content_clip_max", clip_max)


        object.__setattr__(self, "ai_summary_min_articles", max(1, int(self.ai_summary_min_articles)))

        # 13-1) AI Summary 프롬프트 텍스트 정규화(\n 처리)
        sys_prompt = _unescape_newlines(self.ai_summary_system_prompt)
        user_tpl = _unescape_newlines(self.ai_summary_user_prompt_template)
        if not sys_prompt:
            sys_prompt = "너는 한국어 뉴스 요약 전문가다. 출력은 반드시 한국어로 한다."
        if not user_tpl:
            user_tpl = "{articles_block}"
        object.__setattr__(self, "ai_summary_system_prompt", sys_prompt)
        object.__setattr__(self, "ai_summary_user_prompt_template", user_tpl)

        # 13-2) run_summary 기본 옵션 안전화
        object.__setattr__(self, "summary_trend_run_seq", max(0, int(self.summary_trend_run_seq)))
        object.__setattr__(self, "summary_refresh", bool(self.summary_refresh))

        # 14) sentiment(title) 안전화
        object.__setattr__(self, "sentiment_title_batch_size", max(1, int(self.sentiment_title_batch_size)))
        object.__setattr__(self, "sentiment_title_max_length", max(16, int(self.sentiment_title_max_length)))
        object.__setattr__(self, "sentiment_title_keyword_top_n", max(0, int(self.sentiment_title_keyword_top_n)))

        # (추가) 제목 감성분석 그룹 최소 기사수 규칙 안전화
        object.__setattr__(
            self,
            "sentiment_title_min_articles_per_group",
            max(0, int(self.sentiment_title_min_articles_per_group)),
        )
        object.__setattr__(
            self,
            "sentiment_title_min_articles_overall",
            max(0, int(self.sentiment_title_min_articles_overall)),
        )

        # 14-1) run_title_sentiment 기본 옵션 안전화/정규화
        object.__setattr__(self, "sentiment_title_trend_run_seq", max(0, int(self.sentiment_title_trend_run_seq)))
        st_periods = (self.sentiment_title_periods or "").strip()
        if not st_periods:
            st_periods = "TODAY,D7,D14,D30"
        object.__setattr__(self, "sentiment_title_periods", st_periods)
        object.__setattr__(self, "sentiment_title_refresh", bool(self.sentiment_title_refresh))

        # 15) sentiment(content) 안전화
        object.__setattr__(self, "sentiment_content_batch_size", max(1, int(self.sentiment_content_batch_size)))
        object.__setattr__(self, "sentiment_content_max_length", max(16, int(self.sentiment_content_max_length)))
        object.__setattr__(self, "sentiment_content_keyword_top_n", max(0, int(self.sentiment_content_keyword_top_n)))

        chunk_size = max(200, int(self.sentiment_content_chunk_size_chars))
        overlap = max(0, int(self.sentiment_content_chunk_overlap_chars))
        if overlap >= chunk_size:
            overlap = max(0, chunk_size // 4)
        object.__setattr__(self, "sentiment_content_chunk_size_chars", chunk_size)
        object.__setattr__(self, "sentiment_content_chunk_overlap_chars", overlap)
        object.__setattr__(self, "sentiment_content_max_chunks", max(1, int(self.sentiment_content_max_chunks)))
        object.__setattr__(self, "sentiment_content_min_chars", max(0, int(self.sentiment_content_min_chars)))

        # 15-1) run_content_sentiment 기본 옵션 안전화/정규화
        object.__setattr__(self, "sentiment_content_trend_run_seq", max(0, int(self.sentiment_content_trend_run_seq)))
        sc_periods = (self.sentiment_content_periods or "").strip()
        if not sc_periods:
            sc_periods = "TODAY,D7,D14,D30"
        object.__setattr__(self, "sentiment_content_periods", sc_periods)
        object.__setattr__(self, "sentiment_content_refresh", bool(self.sentiment_content_refresh))

        # 15-2) 본문 감성분석 그룹 최소 기사수 규칙 안전화
        object.__setattr__(
            self,
            "sentiment_content_min_articles_per_group",
            max(0, int(self.sentiment_content_min_articles_per_group)),
        )
        object.__setattr__(
            self,
            "sentiment_content_min_articles_overall",
            max(0, int(self.sentiment_content_min_articles_overall)),
        )

        # 16) run_news 실행 옵션 안전화/정규화
        object.__setattr__(self, "news_trend_run_seq", max(0, int(self.news_trend_run_seq)))
        object.__setattr__(self, "news_refresh_same_run", bool(self.news_refresh_same_run))

        # base date는 문자열로만 들고, 실제 파싱은 job에서 한다
        object.__setattr__(self, "news_base_date", (self.news_base_date or "").strip())

        # ---------------- (추가) 제목 편향도(run_title_bias) 옵션 안전화/정규화 ----------------
        object.__setattr__(self, "bias_title_trend_run_seq", max(0, int(self.bias_title_trend_run_seq)))
        object.__setattr__(self, "bias_title_refresh", bool(self.bias_title_refresh))

        # BIAS_TITLE_PERIODS가 비어 있으면 BIAS_TITLE_PERIOD를 사용(하위호환)
        raw_periods = (self.bias_title_periods or "").strip()
        if not raw_periods:
            raw_periods = (self.bias_title_period_legacy or "").strip()
        if not raw_periods:
            raw_periods = "TODAY,D7,D14,D30"

        allowed = {"TODAY", "D7", "D14", "D30"}
        out: list[str] = []
        seen_pf: set[str] = set()

        for part in raw_periods.split(","):
            pf = part.strip().upper()
            if not pf:
                continue
            if pf not in allowed:
                continue
            if pf in seen_pf:
                continue
            seen_pf.add(pf)
            out.append(pf)

        if not out:
            out = ["TODAY", "D7", "D14", "D30"]

        object.__setattr__(self, "bias_title_periods", ",".join(out))

        # ---------------- (추가) 본문 편향도(run_content_bias) 옵션 안전화/정규화 ----------------
        object.__setattr__(self, "bias_content_trend_run_seq", max(0, int(self.bias_content_trend_run_seq)))
        object.__setattr__(self, "bias_content_refresh", bool(self.bias_content_refresh))

        bc_raw = (self.bias_content_periods or "").strip()
        if not bc_raw:
            bc_raw = "TODAY,D7,D14,D30"

        bc_allowed = {"TODAY", "D7", "D14", "D30"}
        bc_out: list[str] = []
        bc_seen: set[str] = set()

        for part in bc_raw.split(","):
            pf = part.strip().upper()
            if not pf:
                continue
            if pf not in bc_allowed:
                continue
            if pf in bc_seen:
                continue
            bc_seen.add(pf)
            bc_out.append(pf)

        if not bc_out:
            bc_out = ["TODAY", "D7", "D14", "D30"]

        object.__setattr__(self, "bias_content_periods", ",".join(bc_out))

        # ---------------- (추가) 워드클라우드 입력 옵션(wdc_reader) 안전화 ----------------
        object.__setattr__(self, "wordcloud_top_n", max(0, int(self.wordcloud_top_n)))

        object.__setattr__(self, "wordcloud_text_min_chars_title", max(0, int(self.wordcloud_text_min_chars_title)))
        object.__setattr__(self, "wordcloud_text_min_chars_content", max(0, int(self.wordcloud_text_min_chars_content)))
        object.__setattr__(self, "wordcloud_text_min_chars_comment", max(0, int(self.wordcloud_text_min_chars_comment)))

        object.__setattr__(self, "wordcloud_limit_rows_title", max(0, int(self.wordcloud_limit_rows_title)))
        object.__setattr__(self, "wordcloud_limit_rows_content", max(0, int(self.wordcloud_limit_rows_content)))
        object.__setattr__(self, "wordcloud_limit_rows_comment", max(0, int(self.wordcloud_limit_rows_comment)))


        # ---------------- (추가) 워드클라우드 추가 전처리(wdc_preprocess) 옵션 안전화 ----------------
        object.__setattr__(self, "wordcloud_pre_lowercase_english", bool(self.wordcloud_pre_lowercase_english))
        object.__setattr__(self, "wordcloud_pre_normalize_repeats", bool(self.wordcloud_pre_normalize_repeats))
        object.__setattr__(self, "wordcloud_pre_max_len", max(0, int(self.wordcloud_pre_max_len)))

        # ---------------- (추가) 워드클라우드 계산(core/wordcloud) 옵션 안전화/정규화 ----------------
        object.__setattr__(self, "wordcloud_top_k", max(1, int(self.wordcloud_top_k)))

        wm = (self.wordcloud_weight_mode or "").strip().lower()
        if wm not in {"log", "count"}:
            wm = "log"
        object.__setattr__(self, "wordcloud_weight_mode", wm)


        # ---------------- (추가) 워드클라우드 토큰화(wdc_tokenize) 옵션 안전화/정규화 ----------------
        tok_min = max(1, int(self.wordcloud_token_min_len))
        tok_max = max(tok_min, int(self.wordcloud_token_max_len))
        object.__setattr__(self, "wordcloud_token_min_len", tok_min)
        object.__setattr__(self, "wordcloud_token_max_len", tok_max)
        object.__setattr__(self, "wordcloud_drop_numeric_only", bool(self.wordcloud_drop_numeric_only))

        sw_csv = (self.wordcloud_stopwords_csv or "").strip()
        object.__setattr__(self, "wordcloud_stopwords_csv", sw_csv)

        sw_file = (self.wordcloud_stopwords_file or "").strip()
        if sw_file:
            p = Path(sw_file)
            if not p.is_absolute():
                p = PROJECT_ROOT / p
            sw_file = str(p)
        object.__setattr__(self, "wordcloud_stopwords_file", sw_file)

        # ---------------- (추가) 워드클라우드(run_wordcloud) 실행 옵션 안전화/정규화 ----------------
        object.__setattr__(self, "wordcloud_trend_run_seq", max(0, int(self.wordcloud_trend_run_seq)))
        object.__setattr__(self, "wordcloud_refresh", bool(self.wordcloud_refresh))

        # periods 정규화: TODAY/D7/D14/D30만 허용, 중복 제거
        raw_p = (self.wordcloud_periods or "").strip()
        if not raw_p:
            raw_p = "TODAY,D7,D14,D30"
        allowed_p = {"TODAY", "D7", "D14", "D30"}
        out_p: list[str] = []
        seen_p: set[str] = set()
        for part in raw_p.split(","):
            pf = part.strip().upper()
            if not pf or pf not in allowed_p or pf in seen_p:
                continue
            seen_p.add(pf)
            out_p.append(pf)
        if not out_p:
            out_p = ["TODAY", "D7", "D14", "D30"]
        object.__setattr__(self, "wordcloud_periods", ",".join(out_p))

        # types 정규화: TITLE/CONTENT/COMMENT만 허용, 중복 제거
        raw_t = (self.wordcloud_types or "").strip()
        if not raw_t:
            raw_t = "TITLE,CONTENT,COMMENT"
        allowed_t = {"TITLE", "CONTENT", "COMMENT"}
        out_t: list[str] = []
        seen_t: set[str] = set()
        for part in raw_t.split(","):
            tt = part.strip().upper()
            if not tt or tt not in allowed_t or tt in seen_t:
                continue
            seen_t.add(tt)
            out_t.append(tt)
        if not out_t:
            out_t = ["TITLE", "CONTENT", "COMMENT"]
        object.__setattr__(self, "wordcloud_types", ",".join(out_t))

        # media codes 정규화
        mcs = list(self.wordcloud_media_codes or ())
        if not mcs:
            # 기본값: 전체(0) + 뉴스 크롤러의 press codes
            mcs = [0, *list(self.news_press_codes or ())]
        # 중복 제거(순서 유지)
        seen_mc: set[int] = set()
        dedup_mc: list[int] = []
        for x in mcs:
            ix = int(x)
            if ix in seen_mc:
                continue
            seen_mc.add(ix)
            dedup_mc.append(ix)
        object.__setattr__(self, "wordcloud_media_codes", tuple(dedup_mc))

        # (추가) run_all steps 정규화
        allowed_steps = {
            "trend",
            "news",
            "preprocess",
            "aggregate",
            "final_rank",
            "summary",
            "title_sentiment",
            "content_sentiment",
            "title_bias",
            "content_bias",
            "wordcloud",
            "cooc_network",
        }

        raw_steps = (self.run_all_steps or "").strip()
        if not raw_steps:
            raw_steps = "trend,news,preprocess,aggregate,final_rank,summary,title_sentiment,content_sentiment,title_bias,content_bias,wordcloud,cooc_network"

        out_steps: list[str] = []
        seen_steps: set[str] = set()
        for part in raw_steps.split(","):
            s = part.strip().lower()
            if not s or s not in allowed_steps or s in seen_steps:
                continue
            seen_steps.add(s)
            out_steps.append(s)

        if not out_steps:
            out_steps = ["trend", "news", "preprocess", "aggregate", "final_rank", "summary", "title_sentiment", "content_sentiment", "title_bias", "content_bias", "wordcloud"]

        object.__setattr__(self, "run_all_steps", ",".join(out_steps))
        object.__setattr__(self, "run_all_fail_fast", bool(self.run_all_fail_fast))

        # ---------------- (추가) 공동언급 네트워크(cooc_network) 옵션 안전화/정규화 ----------------
        object.__setattr__(self, "cooc_trend_run_seq", max(0, int(self.cooc_trend_run_seq)))
        object.__setattr__(self, "cooc_refresh", bool(self.cooc_refresh))

        # periods 정규화: TODAY/D7/D14/D30만 허용, 중복 제거
        raw_cp = (self.cooc_periods or "").strip()
        if not raw_cp:
            raw_cp = "TODAY,D7,D14,D30"
        allowed_cp = {"TODAY", "D7", "D14", "D30"}
        out_cp: list[str] = []
        seen_cp: set[str] = set()
        for part in raw_cp.split(","):
            pf = part.strip().upper()
            if not pf or pf not in allowed_cp or pf in seen_cp:
                continue
            seen_cp.add(pf)
            out_cp.append(pf)
        if not out_cp:
            out_cp = ["TODAY", "D7", "D14", "D30"]
        object.__setattr__(self, "cooc_periods", ",".join(out_cp))

        # text_source 정규화
        ts = (self.cooc_text_source or "").strip().upper()
        if ts not in {"TITLE", "CONTENT", "BOTH"}:
            ts = "CONTENT"
        object.__setattr__(self, "cooc_text_source", ts)

        # 길이/갯수 안전화
        object.__setattr__(self, "cooc_keyword_top_n", max(0, int(self.cooc_keyword_top_n)))
        object.__setattr__(self, "cooc_min_text_chars", max(0, int(self.cooc_min_text_chars)))
        object.__setattr__(self, "cooc_pre_max_len", max(0, int(self.cooc_pre_max_len)))

        # tokenize 옵션
        tok_min = max(1, int(self.cooc_token_min_len))
        tok_max = max(tok_min, int(self.cooc_token_max_len))
        object.__setattr__(self, "cooc_token_min_len", tok_min)
        object.__setattr__(self, "cooc_token_max_len", tok_max)
        object.__setattr__(self, "cooc_drop_numeric_only", bool(self.cooc_drop_numeric_only))

        sw_csv = (self.cooc_stopwords_csv or "").strip()
        object.__setattr__(self, "cooc_stopwords_csv", sw_csv)

        sw_file = (self.cooc_stopwords_file or "").strip()
        if sw_file:
            p = Path(sw_file)
            if not p.is_absolute():
                p = PROJECT_ROOT / p
            sw_file = str(p)
        object.__setattr__(self, "cooc_stopwords_file", sw_file)

        # mode/window 정규화
        cm = (self.cooc_mode or "").strip().lower()
        if cm not in {"doc", "window"}:
            cm = "doc"
        object.__setattr__(self, "cooc_mode", cm)
        object.__setattr__(self, "cooc_window_size", max(2, int(self.cooc_window_size)))

        object.__setattr__(self, "cooc_max_tokens_per_doc", max(0, int(self.cooc_max_tokens_per_doc)))
        object.__setattr__(self, "cooc_node_top_k", max(0, int(self.cooc_node_top_k)))
        object.__setattr__(self, "cooc_edge_top_k", max(0, int(self.cooc_edge_top_k)))
        object.__setattr__(self, "cooc_min_edge_weight", max(1, int(self.cooc_min_edge_weight)))

        # (선택) 로그 디렉토리 기본값 구성
        cooc_dir = (self.log_dir_cooc_network or "").strip()
        if not cooc_dir:
            cooc_dir = "src/analyzer/cooc_network/logs"
        object.__setattr__(self, "log_dir_cooc_network", _resolve_dir(cooc_dir))


        # 17) 로그 디렉토리 기본값 구성
        trend_dir = (self.log_dir_trend or "").strip()
        if not trend_dir:
            trend_dir = "src/crawler/trend/logs"
        object.__setattr__(self, "log_dir_trend", _resolve_dir(trend_dir))

        news_dir = (self.log_dir_news or "").strip()
        if not news_dir:
            news_dir = "src/crawler/news/logs"
        object.__setattr__(self, "log_dir_news", _resolve_dir(news_dir))

        preprocess_dir = (self.log_dir_preprocess or "").strip()
        if not preprocess_dir:
            preprocess_dir = "src/preprocess/logs"
        object.__setattr__(self, "log_dir_preprocess", _resolve_dir(preprocess_dir))

        final_rank_dir = (self.log_dir_final_rank or "").strip()
        if not final_rank_dir:
            final_rank_dir = "src/analyzer/final_rank/logs"
        object.__setattr__(self, "log_dir_final_rank", _resolve_dir(final_rank_dir))

        aggregate_dir = (self.log_dir_aggregate or "").strip()
        if not aggregate_dir:
            aggregate_dir = "src/analyzer/aggregate/logs"
        object.__setattr__(self, "log_dir_aggregate", _resolve_dir(aggregate_dir))

        summary_dir = (self.log_dir_summary or "").strip()
        if not summary_dir:
            summary_dir = "src/analyzer/summary/logs"
        object.__setattr__(self, "log_dir_summary", _resolve_dir(summary_dir))

        sentiment_title_dir = (self.log_dir_sentiment_title or "").strip()
        if not sentiment_title_dir:
            sentiment_title_dir = "src/analyzer/sentiment/title/logs"
        object.__setattr__(self, "log_dir_sentiment_title", _resolve_dir(sentiment_title_dir))

        sentiment_content_dir = (self.log_dir_sentiment_content or "").strip()
        if not sentiment_content_dir:
            sentiment_content_dir = "src/analyzer/sentiment/content/logs"
        object.__setattr__(self, "log_dir_sentiment_content", _resolve_dir(sentiment_content_dir))

        bias_title_dir = (self.log_dir_bias_title or "").strip()
        if not bias_title_dir:
            bias_title_dir = "src/analyzer/bias/title/logs"
        object.__setattr__(self, "log_dir_bias_title", _resolve_dir(bias_title_dir))

        bias_content_dir = (self.log_dir_bias_content or "").strip()
        if not bias_content_dir:
            bias_content_dir = "src/analyzer/bias/content/logs"
        object.__setattr__(self, "log_dir_bias_content", _resolve_dir(bias_content_dir))

        wordcloud_dir = (self.log_dir_wordcloud or "").strip()
        if not wordcloud_dir:
            wordcloud_dir = "src/analyzer/wordcloud/logs"
        object.__setattr__(self, "log_dir_wordcloud", _resolve_dir(wordcloud_dir))


# ---------------------------------- 3. 최종 Settings 인스턴스 생성 ----------------------------------
settings = Settings()