"""`.env`를 읽어 공통 설정을 관리하고, 필요한 최소한의 정규화를 적용한다."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env", override=True)


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
    0/1 형식의 환경 변수를 Optional[bool]로 읽는다.
    - 값이 없으면 None
    - 값이 있으면 True 또는 False
    """
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return None
    return v.strip() == "1"


def _get_csv_ints(key: str, default: tuple[int, ...]) -> tuple[int, ...]:
    """쉼표로 구분된 정수 목록을 파싱한다."""
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
    """`.env`에 들어 있는 문자열 `\\n`을 실제 줄바꿈으로 바꾼다."""
    if not s:
        return ""
    return s.replace("\\n", "\n").strip()


@dataclass(frozen=True)
class Settings:
    # 기본 애플리케이션 설정
    app_env: str = _get_str("APP_ENV", "local")
    tz: str = _get_str("TZ", "Asia/Seoul")

    # 데이터베이스 설정
    db_host: str = _get_str("DB_HOST", "127.0.0.1")
    db_port: int = _get_int("DB_PORT", 3307)
    db_name: str = _get_str("DB_NAME", "newsight")
    db_user: str = _get_str("DB_USER", "newsight")
    db_password: str = _get_str("DB_PASSWORD", "newspass")

    # 로그 설정
    log_level: str = _get_str("LOG_LEVEL", "INFO")
    log_dir_trend: str = _get_str("LOG_DIR_TREND", "")
    log_dir_news: str = _get_str("LOG_DIR_NEWS", "")
    log_dir_preprocess: str = _get_str("LOG_DIR_PREPROCESS", "")
    log_dir_aggregate: str = _get_str("LOG_DIR_AGGREGATE", "")
    log_dir_final_rank: str = _get_str("LOG_DIR_FINAL_RANK", "")
    log_dir_search_timeline: str = _get_str("LOG_DIR_SEARCH_TIMELINE", "")
    log_dir_summary: str = _get_str("LOG_DIR_SUMMARY", "")
    log_dir_sentiment_title: str = _get_str("LOG_DIR_SENTIMENT_TITLE", "")
    log_dir_sentiment_content: str = _get_str("LOG_DIR_SENTIMENT_CONTENT", "")
    log_dir_bias_title: str = _get_str("LOG_DIR_BIAS_TITLE", "")
    log_dir_bias_content: str = _get_str("LOG_DIR_BIAS_CONTENT", "")
    log_dir_wordcloud: str = _get_str("LOG_DIR_WORDCLOUD", "")
    log_dir_cooc_network: str = _get_str("LOG_DIR_COOC_NETWORK", "")

    # 크롤러 및 공통 런타임 설정
    headless: bool = _get_bool01("HEADLESS", True)
    selenium_wait_seconds: int = _get_int("SELENIUM_WAIT_SECONDS", 30)
    trends_url: str = _get_str(
        "TRENDS_URL",
        "https://trends.google.com/trending?geo=KR&hours=168&sort=search-volume",
    )
    retention_keep_last_n: int = _get_int("RETENTION_KEEP_LAST_N", 15)

    # trend 단계
    trend_top_n: int = _get_int("TREND_TOP_N", 25)

    # news 단계
    news_keyword_top_n: int = _get_int("NEWS_KEYWORD_TOP_N", 0)
    news_trend_run_seq: int = _get_int("NEWS_TREND_RUN_SEQ", 0)
    news_refresh_same_run: bool = _get_bool01("NEWS_REFRESH_SAME_RUN", True)
    news_base_date: str = _get_str("NEWS_BASE_DATE", "")
    news_press_codes: tuple[int, ...] = _get_csv_ints(
        "NEWS_PRESS_CODES",
        (1023, 1025, 1020, 1028, 1032, 1002, 1469, 1081, 1001),
    )
    news_days_back: int = _get_int("NEWS_DAYS_BACK", 30)
    news_start_page: int = _get_int("NEWS_START_PAGE", 1)
    news_end_page: int = _get_int("NEWS_END_PAGE", 4)
    article_upsert_batch_size: int = _get_int("ARTICLE_UPSERT_BATCH_SIZE", 400)
    comment_insert_batch_size: int = _get_int("COMMENT_INSERT_BATCH_SIZE", 500)
    keyword_in_query_batch_size: int = _get_int("KEYWORD_IN_QUERY_BATCH_SIZE", 500)
    news_article_concurrency: int = _get_int("NEWS_ARTICLE_CONCURRENCY", 20)
    news_http_conn_limit: int = _get_int("NEWS_HTTP_CONN_LIMIT", 80)
    news_http_conn_limit_per_host: int = _get_int("NEWS_HTTP_CONN_LIMIT_PER_HOST", 20)
    news_max_comments_per_article: int = _get_int("NEWS_MAX_COMMENTS_PER_ARTICLE", 30)
    news_comment_sample_rate: float = _get_float("NEWS_COMMENT_SAMPLE_RATE", 0.2)
    news_comment_sample_min: int = _get_int("NEWS_COMMENT_SAMPLE_MIN", 1)
    news_search_processes: int = _get_int("NEWS_SEARCH_PROCESSES", 3)
    news_comment_processes: int = _get_int("NEWS_COMMENT_PROCESSES", 3)
    include_comments: bool = _get_bool01("INCLUDE_COMMENTS", True)

    # preprocess 단계
    preprocess_trend_run_seq: int = _get_int("PREPROCESS_TREND_RUN_SEQ", 0)
    preprocess_refresh: bool = _get_bool01("PREPROCESS_REFRESH", False)
    preprocess_max_rounds: int = _get_int("PREPROCESS_MAX_ROUNDS", 0)
    preprocess_article_batch_size: int = _get_int("PREPROCESS_ARTICLE_BATCH_SIZE", 300)
    preprocess_comment_batch_size: int = _get_int("PREPROCESS_COMMENT_BATCH_SIZE", 500)

    # aggregate 단계
    agg_trend_run_seq: int = _get_int("AGG_TREND_RUN_SEQ", 0)
    agg_periods: str = _get_str("AGG_PERIODS", "TODAY,D7,D14,D30")
    agg_refresh: bool = _get_bool01("AGG_REFRESH", True)
    agg_insert_chunk_size: int = _get_int("AGG_INSERT_CHUNK_SIZE", 800)

    # final_rank 단계
    final_rank_trend_run_seq: int = _get_int("FINAL_RANK_TREND_RUN_SEQ", 0)
    final_rank_periods: str = _get_str("FINAL_RANK_PERIODS", "TODAY,D7,D14,D30")
    final_rank_refresh: bool = _get_bool01("FINAL_RANK_REFRESH", True)
    keyword_english_whitelist: str = _get_str("KEYWORD_ENGLISH_WHITELIST", "chat gpt,chatgpt,gpt")

    # search_timeline 단계
    search_timeline_trend_run_seq: int = _get_int("SEARCH_TIMELINE_TREND_RUN_SEQ", 0)
    search_timeline_keyword_top_n: int = _get_int("SEARCH_TIMELINE_KEYWORD_TOP_N", 0)
    search_timeline_batch_size: int = _get_int("SEARCH_TIMELINE_BATCH_SIZE", 0)
    search_timeline_refresh: bool = _get_bool01("SEARCH_TIMELINE_REFRESH", True)
    search_timeline_timeframe: str = _get_str("SEARCH_TIMELINE_TIMEFRAME", "today 3-m")
    search_timeline_sleep_min_seconds: float = _get_float("SEARCH_TIMELINE_SLEEP_MIN_SECONDS", 0.8)
    search_timeline_sleep_max_seconds: float = _get_float("SEARCH_TIMELINE_SLEEP_MAX_SECONDS", 1.2)
    naver_datalab_client_id: str = _get_str("NAVER_DATALAB_CLIENT_ID", "")
    naver_datalab_client_secret: str = _get_str("NAVER_DATALAB_CLIENT_SECRET", "")
    naver_datalab_device: str = _get_str("NAVER_DATALAB_DEVICE", "")
    naver_datalab_gender: str = _get_str("NAVER_DATALAB_GENDER", "")
    naver_datalab_ages: str = _get_str("NAVER_DATALAB_AGES", "")
    naver_datalab_request_timeout_seconds: float = _get_float("NAVER_DATALAB_REQUEST_TIMEOUT_SECONDS", 20.0)

    # summary 단계
    openai_api_key: str = _get_str("OPENAI_API_KEY", "")
    ai_summary_model: str = _get_str("AI_SUMMARY_MODEL", "gpt-4o-mini")
    ai_summary_temperature: float = _get_float("AI_SUMMARY_TEMPERATURE", 0.2)
    ai_summary_max_output_tokens: int = _get_int("AI_SUMMARY_MAX_OUTPUT_TOKENS", 600)
    ai_summary_keyword_top_n: int = _get_int("AI_SUMMARY_KEYWORD_TOP_N", 0)
    ai_summary_per_media_limit: int = _get_int("AI_SUMMARY_PER_MEDIA_LIMIT", 1)
    ai_summary_content_min_chars: int = _get_int("AI_SUMMARY_CONTENT_MIN_CHARS", 300)
    ai_summary_content_clip_max: int = _get_int("AI_SUMMARY_CONTENT_CLIP_MAX", 1200)
    ai_summary_min_articles: int = _get_int("AI_SUMMARY_MIN_ARTICLES", 1)
    ai_summary_system_prompt: str = _get_str(
        "AI_SUMMARY_SYSTEM_PROMPT",
        "너는 한국어 뉴스 요약 전문가다. 출력은 반드시 한국어로 한다.",
    )
    ai_summary_user_prompt_template: str = _get_str(
        "AI_SUMMARY_USER_PROMPT_TEMPLATE",
        (
            "너는 뉴스 요약 전문가다.\n"
            "키워드: {keyword_name}\n\n"
            "아래는 여러 언론사 기사 제목/본문(일부)이다. 중복을 제거하고 핵심 흐름만 사실 중심으로 요약해라.\n"
            "과장하거나 기사에 없는 내용을 추측해 추가하지 마라.\n\n"
            "출력 규칙:\n"
            "- 번호(1),2),3))나 불릿(-, •)을 사용하지 말고, 문단으로만 작성한다.\n"
            "- 전체는 3~4개 문단으로 구성한다.\n"
            "- 첫 문단은 전체 흐름을 한두 문장으로 압축한다.\n"
            "- 다음 문단(들)은 핵심 전개/원인·영향/주요 쟁점을 자연스러운 서술로 정리한다.\n"
            "- 고유명사(기관/인물/정책/지역)와 날짜·수치는 기사 입력에 등장한 범위에서만 사용한다.\n\n"
            "기사 입력:\n"
            "{articles_block}"
        ),
    )
    summary_trend_run_seq: int = _get_int("SUMMARY_TREND_RUN_SEQ", 0)
    summary_refresh: bool = _get_bool01("SUMMARY_REFRESH", True)

    # title_sentiment 단계
    sentiment_title_model_name: str = _get_str("SENTIMENT_TITLE_MODEL_NAME", "snunlp/KR-FinBert-SC")
    sentiment_title_device: str = _get_str("SENTIMENT_TITLE_DEVICE", "cpu")
    sentiment_title_batch_size: int = _get_int("SENTIMENT_TITLE_BATCH_SIZE", 64)
    sentiment_title_max_length: int = _get_int("SENTIMENT_TITLE_MAX_LENGTH", 128)
    sentiment_title_keyword_top_n: int = _get_int("SENTIMENT_TITLE_KEYWORD_TOP_N", 0)
    sentiment_title_min_articles_per_group: int = _get_int("SENTIMENT_TITLE_MIN_ARTICLES_PER_GROUP", 0)
    sentiment_title_min_articles_overall: int = _get_int("SENTIMENT_TITLE_MIN_ARTICLES_OVERALL", 0)
    sentiment_title_trend_run_seq: int = _get_int("SENTIMENT_TITLE_TREND_RUN_SEQ", 0)
    sentiment_title_periods: str = _get_str("SENTIMENT_TITLE_PERIODS", "D7,D14")
    sentiment_title_refresh: bool = _get_bool01("SENTIMENT_TITLE_REFRESH", True)

    # content_sentiment 단계
    sentiment_content_model_name: str = _get_str("SENTIMENT_CONTENT_MODEL_NAME", "snunlp/KR-FinBert-SC")
    sentiment_content_device: str = _get_str("SENTIMENT_CONTENT_DEVICE", "cpu")
    sentiment_content_batch_size: int = _get_int("SENTIMENT_CONTENT_BATCH_SIZE", 16)
    sentiment_content_max_length: int = _get_int("SENTIMENT_CONTENT_MAX_LENGTH", 256)
    sentiment_content_keyword_top_n: int = _get_int("SENTIMENT_CONTENT_KEYWORD_TOP_N", 0)
    sentiment_content_chunk_size_chars: int = _get_int("SENTIMENT_CONTENT_CHUNK_SIZE_CHARS", 1200)
    sentiment_content_chunk_overlap_chars: int = _get_int("SENTIMENT_CONTENT_CHUNK_OVERLAP_CHARS", 200)
    sentiment_content_max_chunks: int = _get_int("SENTIMENT_CONTENT_MAX_CHUNKS", 6)
    sentiment_content_min_chars: int = _get_int("SENTIMENT_CONTENT_MIN_CHARS", 200)
    sentiment_content_trend_run_seq: int = _get_int("SENTIMENT_CONTENT_TREND_RUN_SEQ", 0)
    sentiment_content_periods: str = _get_str("SENTIMENT_CONTENT_PERIODS", "D7,D14")
    sentiment_content_refresh: bool = _get_bool01("SENTIMENT_CONTENT_REFRESH", True)
    sentiment_content_min_articles_per_group: int = _get_int("SENTIMENT_CONTENT_MIN_ARTICLES_PER_GROUP", 0)
    sentiment_content_min_articles_overall: int = _get_int("SENTIMENT_CONTENT_MIN_ARTICLES_OVERALL", 0)

    # title_bias 단계
    bias_title_trend_run_seq: int = _get_int("BIAS_TITLE_TREND_RUN_SEQ", 0)
    bias_title_periods: str = _get_str("BIAS_TITLE_PERIODS", "D7,D14")
    bias_title_period_legacy: str = _get_str("BIAS_TITLE_PERIOD", "")
    bias_title_refresh: bool = _get_bool01("BIAS_TITLE_REFRESH", True)
    bias_title_delta_scale: float = _get_float("BIAS_TITLE_DELTA_SCALE", 15.0)

    # content_bias 단계
    bias_content_trend_run_seq: int = _get_int("BIAS_CONTENT_TREND_RUN_SEQ", 0)
    bias_content_periods: str = _get_str("BIAS_CONTENT_PERIODS", "D7,D14")
    bias_content_refresh: bool = _get_bool01("BIAS_CONTENT_REFRESH", True)
    bias_content_delta_scale: float = _get_float(
        "BIAS_CONTENT_DELTA_SCALE",
        _get_float("BIAS_CONTENT_DELTA_SCALE_POS_NEG", 15.0),
    )

    # wordcloud 단계
    wordcloud_top_n: int = _get_int("WORDCLOUD_TOP_N", 0)
    wordcloud_text_min_chars_title: int = _get_int("WORDCLOUD_TEXT_MIN_CHARS_TITLE", 2)
    wordcloud_text_min_chars_content: int = _get_int("WORDCLOUD_TEXT_MIN_CHARS_CONTENT", 200)
    wordcloud_text_min_chars_comment: int = _get_int("WORDCLOUD_TEXT_MIN_CHARS_COMMENT", 5)
    wordcloud_limit_rows_title: int = _get_int("WORDCLOUD_LIMIT_ROWS_TITLE", 0)
    wordcloud_limit_rows_content: int = _get_int("WORDCLOUD_LIMIT_ROWS_CONTENT", 0)
    wordcloud_limit_rows_comment: int = _get_int("WORDCLOUD_LIMIT_ROWS_COMMENT", 0)
    wordcloud_pre_lowercase_english: bool = _get_bool01("WORDCLOUD_PRE_LOWERCASE_ENGLISH", True)
    wordcloud_pre_normalize_repeats: bool = _get_bool01("WORDCLOUD_PRE_NORMALIZE_REPEATS", True)
    wordcloud_pre_max_len: int = _get_int("WORDCLOUD_PRE_MAX_LEN", 5000)
    wordcloud_token_min_len: int = _get_int("WORDCLOUD_TOKEN_MIN_LEN", 2)
    wordcloud_token_max_len: int = _get_int("WORDCLOUD_TOKEN_MAX_LEN", 30)
    wordcloud_drop_numeric_only: bool = _get_bool01("WORDCLOUD_DROP_NUMERIC_ONLY", True)
    wordcloud_stopwords_csv: str = _get_str("WORDCLOUD_STOPWORDS_CSV", "")
    wordcloud_stopwords_file: str = _get_str("WORDCLOUD_STOPWORDS_FILE", "./src/analyzer/wordcloud/stopwords.txt")
    wordcloud_top_k: int = _get_int("WORDCLOUD_TOP_K", 60)
    wordcloud_weight_mode: str = _get_str("WORDCLOUD_WEIGHT_MODE", "log")
    wordcloud_trend_run_seq: int = _get_int("WORDCLOUD_TREND_RUN_SEQ", 0)
    wordcloud_periods: str = _get_str("WORDCLOUD_PERIODS", "D7,D14")
    wordcloud_types: str = _get_str("WORDCLOUD_TYPES", "TITLE,CONTENT,COMMENT")
    wordcloud_refresh: bool = _get_bool01("WORDCLOUD_REFRESH", True)
    wordcloud_media_codes: tuple[int, ...] = _get_csv_ints("WORDCLOUD_MEDIA_CODES", ())

    # cooc_network 단계
    cooc_trend_run_seq: int = _get_int("COOC_TREND_RUN_SEQ", 0)
    cooc_periods: str = _get_str("COOC_PERIODS", "D7,D14")
    cooc_keyword_top_n: int = _get_int("COOC_KEYWORD_TOP_N", 0)
    cooc_refresh: bool = _get_bool01("COOC_REFRESH", False)
    cooc_text_source: str = _get_str("COOC_TEXT_SOURCE", "CONTENT")
    cooc_min_text_chars: int = _get_int("COOC_MIN_TEXT_CHARS", 120)
    cooc_pre_lowercase_english: bool = _get_bool01("COOC_PRE_LOWERCASE_ENGLISH", True)
    cooc_pre_normalize_repeats: bool = _get_bool01("COOC_PRE_NORMALIZE_REPEATS", True)
    cooc_pre_max_len: int = _get_int("COOC_PRE_MAX_LEN", 5000)
    cooc_token_min_len: int = _get_int("COOC_TOKEN_MIN_LEN", 2)
    cooc_token_max_len: int = _get_int("COOC_TOKEN_MAX_LEN", 30)
    cooc_drop_numeric_only: bool = _get_bool01("COOC_DROP_NUMERIC_ONLY", True)
    cooc_stopwords_csv: str = _get_str("COOC_STOPWORDS_CSV", "그리고,하지만,때문에,관련,대한,기자,뉴스,속보")
    cooc_stopwords_file: str = _get_str("COOC_STOPWORDS_FILE", "./src/analyzer/wordcloud/stopwords.txt")
    cooc_mode: str = _get_str("COOC_MODE", "doc")
    cooc_window_size: int = _get_int("COOC_WINDOW_SIZE", 20)
    cooc_max_tokens_per_doc: int = _get_int("COOC_MAX_TOKENS_PER_DOC", 30)
    cooc_node_top_k: int = _get_int("COOC_NODE_TOP_K", 20)
    cooc_edge_top_k: int = _get_int("COOC_EDGE_TOP_K", 60)
    cooc_min_edge_weight: int = _get_int("COOC_MIN_EDGE_WEIGHT", 2)
    cooc_min_docs_used: int = _get_int("COOC_MIN_DOCS_USED", 5)

    # 전체 파이프라인 실행 설정
    run_all_steps: str = _get_str(
        "RUN_ALL_STEPS",
        "trend,news,preprocess,aggregate,final_rank,search_timeline,summary,title_sentiment,content_sentiment,title_bias,content_bias,wordcloud,cooc_network",
    )
    run_all_fail_fast: bool = _get_bool01("RUN_ALL_FAIL_FAST", True)

    def __post_init__(self) -> None:
        def _resolve_dir(path_str: str) -> str:
            p = (path_str or "").strip()
            if not p:
                return ""
            path = Path(p)
            if not path.is_absolute():
                path = PROJECT_ROOT / path
            return str(path)

        # 공통 런타임 보정
        object.__setattr__(self, "trend_top_n", max(1, int(self.trend_top_n)))
        object.__setattr__(self, "retention_keep_last_n", max(1, int(self.retention_keep_last_n)))
        object.__setattr__(self, "selenium_wait_seconds", max(1, int(self.selenium_wait_seconds)))

        # news 단계 보정
        object.__setattr__(self, "news_trend_run_seq", max(0, int(self.news_trend_run_seq)))
        object.__setattr__(self, "news_refresh_same_run", bool(self.news_refresh_same_run))
        object.__setattr__(self, "news_base_date", (self.news_base_date or "").strip())
        object.__setattr__(self, "news_keyword_top_n", max(0, int(self.news_keyword_top_n)))

        days_back = max(1, int(self.news_days_back))
        start_page = max(1, int(self.news_start_page))
        end_page = max(start_page, int(self.news_end_page))
        object.__setattr__(self, "news_days_back", days_back)
        object.__setattr__(self, "news_start_page", start_page)
        object.__setattr__(self, "news_end_page", end_page)

        object.__setattr__(self, "article_upsert_batch_size", max(1, int(self.article_upsert_batch_size)))
        object.__setattr__(self, "comment_insert_batch_size", max(1, int(self.comment_insert_batch_size)))
        object.__setattr__(self, "keyword_in_query_batch_size", max(1, int(self.keyword_in_query_batch_size)))

        object.__setattr__(self, "news_article_concurrency", max(1, int(self.news_article_concurrency)))
        object.__setattr__(self, "news_http_conn_limit", max(1, int(self.news_http_conn_limit)))
        object.__setattr__(self, "news_http_conn_limit_per_host", max(1, int(self.news_http_conn_limit_per_host)))
        object.__setattr__(self, "news_max_comments_per_article", max(1, int(self.news_max_comments_per_article)))
        object.__setattr__(self, "news_comment_sample_min", max(1, int(self.news_comment_sample_min)))
        object.__setattr__(self, "news_search_processes", max(1, int(self.news_search_processes)))
        object.__setattr__(self, "news_comment_processes", max(1, int(self.news_comment_processes)))

        rate = float(self.news_comment_sample_rate)
        rate = min(1.0, max(0.0, rate))
        object.__setattr__(self, "news_comment_sample_rate", rate)

        pcs = list(self.news_press_codes or ())
        if not pcs:
            pcs = [1023, 1025, 1020, 1028, 1032, 1002, 1469, 1081, 1001]
        seen_press_codes: set[int] = set()
        deduped_press_codes: list[int] = []
        for x in pcs:
            if x in seen_press_codes:
                continue
            seen_press_codes.add(x)
            deduped_press_codes.append(int(x))
        object.__setattr__(self, "news_press_codes", tuple(deduped_press_codes))

        # preprocess 단계 보정
        object.__setattr__(self, "preprocess_trend_run_seq", max(0, int(self.preprocess_trend_run_seq)))
        object.__setattr__(self, "preprocess_refresh", bool(self.preprocess_refresh))
        object.__setattr__(self, "preprocess_max_rounds", max(0, int(self.preprocess_max_rounds)))
        object.__setattr__(self, "preprocess_article_batch_size", max(1, int(self.preprocess_article_batch_size)))
        object.__setattr__(self, "preprocess_comment_batch_size", max(1, int(self.preprocess_comment_batch_size)))

        # aggregate 단계 보정
        object.__setattr__(self, "agg_trend_run_seq", max(0, int(self.agg_trend_run_seq)))
        object.__setattr__(self, "agg_insert_chunk_size", max(1, int(self.agg_insert_chunk_size)))
        agg_periods = (self.agg_periods or "").strip()
        if not agg_periods:
            agg_periods = "TODAY,D7,D14,D30"
        object.__setattr__(self, "agg_periods", agg_periods)
        object.__setattr__(self, "agg_refresh", bool(self.agg_refresh))

        # final_rank 단계 보정
        object.__setattr__(self, "final_rank_trend_run_seq", max(0, int(self.final_rank_trend_run_seq)))
        final_rank_periods = (self.final_rank_periods or "").strip()
        if not final_rank_periods:
            final_rank_periods = "TODAY,D7,D14,D30"
        object.__setattr__(self, "final_rank_periods", final_rank_periods)
        object.__setattr__(self, "final_rank_refresh", bool(self.final_rank_refresh))

        # search_timeline 단계 보정
        object.__setattr__(self, "search_timeline_trend_run_seq", max(0, int(self.search_timeline_trend_run_seq)))
        object.__setattr__(self, "search_timeline_keyword_top_n", max(0, int(self.search_timeline_keyword_top_n)))
        object.__setattr__(self, "search_timeline_batch_size", max(0, int(self.search_timeline_batch_size)))
        object.__setattr__(
            self,
            "search_timeline_timeframe",
            (self.search_timeline_timeframe or "today 3-m").strip() or "today 3-m",
        )
        object.__setattr__(
            self,
            "search_timeline_sleep_min_seconds",
            max(0.0, float(self.search_timeline_sleep_min_seconds)),
        )
        object.__setattr__(
            self,
            "search_timeline_sleep_max_seconds",
            max(0.0, float(self.search_timeline_sleep_max_seconds)),
        )
        if self.search_timeline_sleep_max_seconds < self.search_timeline_sleep_min_seconds:
            object.__setattr__(
                self,
                "search_timeline_sleep_max_seconds",
                float(self.search_timeline_sleep_min_seconds),
            )

        object.__setattr__(self, "naver_datalab_client_id", (self.naver_datalab_client_id or "").strip())
        object.__setattr__(self, "naver_datalab_client_secret", (self.naver_datalab_client_secret or "").strip())

        device = (self.naver_datalab_device or "").strip().lower()
        if device not in {"", "pc", "mo"}:
            device = ""
        object.__setattr__(self, "naver_datalab_device", device)

        gender = (self.naver_datalab_gender or "").strip().lower()
        if gender not in {"", "m", "f"}:
            gender = ""
        object.__setattr__(self, "naver_datalab_gender", gender)

        ages = ",".join(
            part
            for part in ((self.naver_datalab_ages or "").replace(" ", "").split(","))
            if part in {"1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"}
        )
        object.__setattr__(self, "naver_datalab_ages", ages)
        object.__setattr__(
            self,
            "naver_datalab_request_timeout_seconds",
            max(1.0, float(self.naver_datalab_request_timeout_seconds)),
        )

        # summary 단계 보정
        object.__setattr__(self, "ai_summary_max_output_tokens", max(64, int(self.ai_summary_max_output_tokens)))
        object.__setattr__(self, "ai_summary_keyword_top_n", max(0, int(self.ai_summary_keyword_top_n)))
        object.__setattr__(self, "ai_summary_per_media_limit", max(1, int(self.ai_summary_per_media_limit)))
        object.__setattr__(self, "ai_summary_content_min_chars", max(0, int(self.ai_summary_content_min_chars)))
        object.__setattr__(self, "ai_summary_content_clip_max", max(0, int(self.ai_summary_content_clip_max)))
        object.__setattr__(self, "ai_summary_min_articles", max(1, int(self.ai_summary_min_articles)))

        sys_prompt = _unescape_newlines(self.ai_summary_system_prompt)
        user_tpl = _unescape_newlines(self.ai_summary_user_prompt_template)
        if not sys_prompt:
            sys_prompt = "너는 한국어 뉴스 요약 전문가다. 출력은 반드시 한국어로 한다."
        if not user_tpl:
            user_tpl = "{articles_block}"
        object.__setattr__(self, "ai_summary_system_prompt", sys_prompt)
        object.__setattr__(self, "ai_summary_user_prompt_template", user_tpl)

        object.__setattr__(self, "summary_trend_run_seq", max(0, int(self.summary_trend_run_seq)))
        object.__setattr__(self, "summary_refresh", bool(self.summary_refresh))

        # title_sentiment 단계 보정
        object.__setattr__(self, "sentiment_title_batch_size", max(1, int(self.sentiment_title_batch_size)))
        object.__setattr__(self, "sentiment_title_max_length", max(16, int(self.sentiment_title_max_length)))
        object.__setattr__(self, "sentiment_title_keyword_top_n", max(0, int(self.sentiment_title_keyword_top_n)))
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
        object.__setattr__(self, "sentiment_title_trend_run_seq", max(0, int(self.sentiment_title_trend_run_seq)))
        sentiment_title_periods = (self.sentiment_title_periods or "").strip()
        if not sentiment_title_periods:
            sentiment_title_periods = "D7,D14"
        object.__setattr__(self, "sentiment_title_periods", sentiment_title_periods)
        object.__setattr__(self, "sentiment_title_refresh", bool(self.sentiment_title_refresh))

        # content_sentiment 단계 보정
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
        object.__setattr__(self, "sentiment_content_trend_run_seq", max(0, int(self.sentiment_content_trend_run_seq)))
        sentiment_content_periods = (self.sentiment_content_periods or "").strip()
        if not sentiment_content_periods:
            sentiment_content_periods = "D7,D14"
        object.__setattr__(self, "sentiment_content_periods", sentiment_content_periods)
        object.__setattr__(self, "sentiment_content_refresh", bool(self.sentiment_content_refresh))
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

        # title_bias 단계 보정
        object.__setattr__(self, "bias_title_trend_run_seq", max(0, int(self.bias_title_trend_run_seq)))
        object.__setattr__(self, "bias_title_refresh", bool(self.bias_title_refresh))
        object.__setattr__(self, "bias_title_delta_scale", max(0.0, float(self.bias_title_delta_scale)))

        raw_periods = (self.bias_title_periods or "").strip()
        if not raw_periods:
            raw_periods = (self.bias_title_period_legacy or "").strip()
        if not raw_periods:
            raw_periods = "D7,D14"

        allowed_title_periods = {"TODAY", "D7", "D14", "D30"}
        normalized_title_periods: list[str] = []
        seen_title_periods: set[str] = set()
        for part in raw_periods.split(","):
            pf = part.strip().upper()
            if not pf:
                continue
            if pf not in allowed_title_periods:
                continue
            if pf in seen_title_periods:
                continue
            seen_title_periods.add(pf)
            normalized_title_periods.append(pf)
        if not normalized_title_periods:
            normalized_title_periods = ["D7", "D14"]
        object.__setattr__(self, "bias_title_periods", ",".join(normalized_title_periods))

        # content_bias 단계 보정
        object.__setattr__(self, "bias_content_trend_run_seq", max(0, int(self.bias_content_trend_run_seq)))
        object.__setattr__(self, "bias_content_refresh", bool(self.bias_content_refresh))
        object.__setattr__(self, "bias_content_delta_scale", max(0.0, float(self.bias_content_delta_scale)))

        raw_content_bias_periods = (self.bias_content_periods or "").strip()
        if not raw_content_bias_periods:
            raw_content_bias_periods = "D7,D14"

        allowed_content_bias_periods = {"TODAY", "D7", "D14", "D30"}
        normalized_content_bias_periods: list[str] = []
        seen_content_bias_periods: set[str] = set()
        for part in raw_content_bias_periods.split(","):
            pf = part.strip().upper()
            if not pf:
                continue
            if pf not in allowed_content_bias_periods:
                continue
            if pf in seen_content_bias_periods:
                continue
            seen_content_bias_periods.add(pf)
            normalized_content_bias_periods.append(pf)
        if not normalized_content_bias_periods:
            normalized_content_bias_periods = ["D7", "D14"]
        object.__setattr__(self, "bias_content_periods", ",".join(normalized_content_bias_periods))

        # wordcloud 단계 보정
        object.__setattr__(self, "wordcloud_top_n", max(0, int(self.wordcloud_top_n)))
        object.__setattr__(self, "wordcloud_text_min_chars_title", max(0, int(self.wordcloud_text_min_chars_title)))
        object.__setattr__(self, "wordcloud_text_min_chars_content", max(0, int(self.wordcloud_text_min_chars_content)))
        object.__setattr__(self, "wordcloud_text_min_chars_comment", max(0, int(self.wordcloud_text_min_chars_comment)))
        object.__setattr__(self, "wordcloud_limit_rows_title", max(0, int(self.wordcloud_limit_rows_title)))
        object.__setattr__(self, "wordcloud_limit_rows_content", max(0, int(self.wordcloud_limit_rows_content)))
        object.__setattr__(self, "wordcloud_limit_rows_comment", max(0, int(self.wordcloud_limit_rows_comment)))
        object.__setattr__(self, "wordcloud_pre_lowercase_english", bool(self.wordcloud_pre_lowercase_english))
        object.__setattr__(self, "wordcloud_pre_normalize_repeats", bool(self.wordcloud_pre_normalize_repeats))
        object.__setattr__(self, "wordcloud_pre_max_len", max(0, int(self.wordcloud_pre_max_len)))
        object.__setattr__(self, "wordcloud_top_k", max(1, int(self.wordcloud_top_k)))

        weight_mode = (self.wordcloud_weight_mode or "").strip().lower()
        if weight_mode not in {"log", "count"}:
            weight_mode = "log"
        object.__setattr__(self, "wordcloud_weight_mode", weight_mode)

        wordcloud_token_min_len = max(1, int(self.wordcloud_token_min_len))
        wordcloud_token_max_len = max(wordcloud_token_min_len, int(self.wordcloud_token_max_len))
        object.__setattr__(self, "wordcloud_token_min_len", wordcloud_token_min_len)
        object.__setattr__(self, "wordcloud_token_max_len", wordcloud_token_max_len)
        object.__setattr__(self, "wordcloud_drop_numeric_only", bool(self.wordcloud_drop_numeric_only))
        object.__setattr__(self, "wordcloud_stopwords_csv", (self.wordcloud_stopwords_csv or "").strip())

        wordcloud_stopwords_file = (self.wordcloud_stopwords_file or "").strip()
        if wordcloud_stopwords_file:
            p = Path(wordcloud_stopwords_file)
            if not p.is_absolute():
                p = PROJECT_ROOT / p
            wordcloud_stopwords_file = str(p)
        object.__setattr__(self, "wordcloud_stopwords_file", wordcloud_stopwords_file)

        object.__setattr__(self, "wordcloud_trend_run_seq", max(0, int(self.wordcloud_trend_run_seq)))
        object.__setattr__(self, "wordcloud_refresh", bool(self.wordcloud_refresh))

        raw_wordcloud_periods = (self.wordcloud_periods or "").strip()
        if not raw_wordcloud_periods:
            raw_wordcloud_periods = "D7,D14"
        allowed_wordcloud_periods = {"TODAY", "D7", "D14", "D30"}
        normalized_wordcloud_periods: list[str] = []
        seen_wordcloud_periods: set[str] = set()
        for part in raw_wordcloud_periods.split(","):
            pf = part.strip().upper()
            if not pf or pf not in allowed_wordcloud_periods or pf in seen_wordcloud_periods:
                continue
            seen_wordcloud_periods.add(pf)
            normalized_wordcloud_periods.append(pf)
        if not normalized_wordcloud_periods:
            normalized_wordcloud_periods = ["D7", "D14"]
        object.__setattr__(self, "wordcloud_periods", ",".join(normalized_wordcloud_periods))

        raw_wordcloud_types = (self.wordcloud_types or "").strip()
        if not raw_wordcloud_types:
            raw_wordcloud_types = "TITLE,CONTENT,COMMENT"
        allowed_wordcloud_types = {"TITLE", "CONTENT", "COMMENT"}
        normalized_wordcloud_types: list[str] = []
        seen_wordcloud_types: set[str] = set()
        for part in raw_wordcloud_types.split(","):
            token = part.strip().upper()
            if not token or token not in allowed_wordcloud_types or token in seen_wordcloud_types:
                continue
            seen_wordcloud_types.add(token)
            normalized_wordcloud_types.append(token)
        if not normalized_wordcloud_types:
            normalized_wordcloud_types = ["TITLE", "CONTENT", "COMMENT"]
        object.__setattr__(self, "wordcloud_types", ",".join(normalized_wordcloud_types))

        media_codes = list(self.wordcloud_media_codes or ())
        if not media_codes:
            media_codes = [0, *list(self.news_press_codes or ())]
        seen_media_codes: set[int] = set()
        deduped_media_codes: list[int] = []
        for x in media_codes:
            ix = int(x)
            if ix in seen_media_codes:
                continue
            seen_media_codes.add(ix)
            deduped_media_codes.append(ix)
        object.__setattr__(self, "wordcloud_media_codes", tuple(deduped_media_codes))

        # cooc_network 단계 보정
        object.__setattr__(self, "cooc_trend_run_seq", max(0, int(self.cooc_trend_run_seq)))
        object.__setattr__(self, "cooc_refresh", bool(self.cooc_refresh))

        raw_cooc_periods = (self.cooc_periods or "").strip()
        if not raw_cooc_periods:
            raw_cooc_periods = "D7,D14"
        allowed_cooc_periods = {"TODAY", "D7", "D14", "D30"}
        normalized_cooc_periods: list[str] = []
        seen_cooc_periods: set[str] = set()
        for part in raw_cooc_periods.split(","):
            pf = part.strip().upper()
            if not pf or pf not in allowed_cooc_periods or pf in seen_cooc_periods:
                continue
            seen_cooc_periods.add(pf)
            normalized_cooc_periods.append(pf)
        if not normalized_cooc_periods:
            normalized_cooc_periods = ["D7", "D14"]
        object.__setattr__(self, "cooc_periods", ",".join(normalized_cooc_periods))

        text_source = (self.cooc_text_source or "").strip().upper()
        if text_source not in {"TITLE", "CONTENT", "BOTH"}:
            text_source = "CONTENT"
        object.__setattr__(self, "cooc_text_source", text_source)

        object.__setattr__(self, "cooc_keyword_top_n", max(0, int(self.cooc_keyword_top_n)))
        object.__setattr__(self, "cooc_min_text_chars", max(0, int(self.cooc_min_text_chars)))
        object.__setattr__(self, "cooc_pre_max_len", max(0, int(self.cooc_pre_max_len)))
        object.__setattr__(self, "cooc_pre_lowercase_english", bool(self.cooc_pre_lowercase_english))
        object.__setattr__(self, "cooc_pre_normalize_repeats", bool(self.cooc_pre_normalize_repeats))

        cooc_token_min_len = max(1, int(self.cooc_token_min_len))
        cooc_token_max_len = max(cooc_token_min_len, int(self.cooc_token_max_len))
        object.__setattr__(self, "cooc_token_min_len", cooc_token_min_len)
        object.__setattr__(self, "cooc_token_max_len", cooc_token_max_len)
        object.__setattr__(self, "cooc_drop_numeric_only", bool(self.cooc_drop_numeric_only))
        object.__setattr__(self, "cooc_stopwords_csv", (self.cooc_stopwords_csv or "").strip())

        cooc_stopwords_file = (self.cooc_stopwords_file or "").strip()
        if cooc_stopwords_file:
            p = Path(cooc_stopwords_file)
            if not p.is_absolute():
                p = PROJECT_ROOT / p
            cooc_stopwords_file = str(p)
        object.__setattr__(self, "cooc_stopwords_file", cooc_stopwords_file)

        cooc_mode = (self.cooc_mode or "").strip().lower()
        if cooc_mode not in {"doc", "window"}:
            cooc_mode = "doc"
        object.__setattr__(self, "cooc_mode", cooc_mode)
        object.__setattr__(self, "cooc_window_size", max(2, int(self.cooc_window_size)))
        object.__setattr__(self, "cooc_max_tokens_per_doc", max(0, int(self.cooc_max_tokens_per_doc)))
        object.__setattr__(self, "cooc_node_top_k", max(0, int(self.cooc_node_top_k)))
        object.__setattr__(self, "cooc_edge_top_k", max(0, int(self.cooc_edge_top_k)))
        object.__setattr__(self, "cooc_min_edge_weight", max(1, int(self.cooc_min_edge_weight)))
        object.__setattr__(self, "cooc_min_docs_used", max(0, int(self.cooc_min_docs_used)))

        # run_all 단계 보정
        allowed_steps = {
            "trend",
            "search_timeline",
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
            raw_steps = "trend,news,preprocess,aggregate,final_rank,search_timeline,summary,title_sentiment,content_sentiment,title_bias,content_bias,wordcloud,cooc_network"

        normalized_steps: list[str] = []
        seen_steps: set[str] = set()
        for part in raw_steps.split(","):
            step = part.strip().lower()
            if not step or step not in allowed_steps or step in seen_steps:
                continue
            seen_steps.add(step)
            normalized_steps.append(step)

        if not normalized_steps:
            normalized_steps = [
                "trend",
                "news",
                "preprocess",
                "aggregate",
                "final_rank",
                "search_timeline",
                "summary",
                "title_sentiment",
                "content_sentiment",
                "title_bias",
                "content_bias",
                "wordcloud",
                "cooc_network",
            ]

        object.__setattr__(self, "run_all_steps", ",".join(normalized_steps))
        object.__setattr__(self, "run_all_fail_fast", bool(self.run_all_fail_fast))

        # 로그 디렉터리 보정
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

        aggregate_dir = (self.log_dir_aggregate or "").strip()
        if not aggregate_dir:
            aggregate_dir = "src/analyzer/aggregate/logs"
        object.__setattr__(self, "log_dir_aggregate", _resolve_dir(aggregate_dir))

        final_rank_dir = (self.log_dir_final_rank or "").strip()
        if not final_rank_dir:
            final_rank_dir = "src/analyzer/final_rank/logs"
        object.__setattr__(self, "log_dir_final_rank", _resolve_dir(final_rank_dir))

        search_timeline_dir = (self.log_dir_search_timeline or "").strip()
        if not search_timeline_dir:
            search_timeline_dir = "src/analyzer/search_timeline/logs"
        object.__setattr__(self, "log_dir_search_timeline", _resolve_dir(search_timeline_dir))

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

        cooc_dir = (self.log_dir_cooc_network or "").strip()
        if not cooc_dir:
            cooc_dir = "src/analyzer/cooc_network/logs"
        object.__setattr__(self, "log_dir_cooc_network", _resolve_dir(cooc_dir))


settings = Settings()