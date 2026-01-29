# data-pipeline/src/analyzer/cooc_network/tokenize/cooc_tokenize.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Set

from src.config.settings import settings
from src.analyzer.wordcloud.tokenize.wdc_tokenize import (
    TokenizeOptions,
    tokenize_text,
    load_stopwords_from_csv,
    load_stopwords_from_file,
)


@dataclass(frozen=True)
class CoocTokenizeOptions:
    """
    공동언급 토큰화 옵션(.env -> settings)
    """
    min_len: int
    max_len: int
    drop_numeric_only: bool


def default_cooc_tokenize_options_from_settings() -> CoocTokenizeOptions:
    return CoocTokenizeOptions(
        min_len=int(getattr(settings, "cooc_token_min_len", 2)),
        max_len=int(getattr(settings, "cooc_token_max_len", 30)),
        drop_numeric_only=bool(getattr(settings, "cooc_drop_numeric_only", True)),
    )


def default_cooc_stopwords_from_settings() -> Set[str]:
    """
    공동언급 불용어(.env -> settings)
    - COOC_STOPWORDS_CSV
    - COOC_STOPWORDS_FILE (상대경로면 PROJECT_ROOT 기준으로 settings에서 절대경로로 정규화됨)
    """
    sw: Set[str] = set()

    csv_text = str(getattr(settings, "cooc_stopwords_csv", "") or "").strip()
    file_path = str(getattr(settings, "cooc_stopwords_file", "") or "").strip()

    if csv_text:
        sw |= load_stopwords_from_csv(csv_text)

    if file_path:
        p = Path(file_path)
        if p.exists() and p.is_file():
            sw |= load_stopwords_from_file(file_path)

    return sw


def tokenize_for_cooc(
    text: str,
    *,
    opt: Optional[CoocTokenizeOptions] = None,
    stopwords: Optional[Set[str]] = None,
) -> list[str]:
    """
    공동언급 토큰화(공백 기반) + 필터링
    - 내부적으로 wordcloud tokenize 로직을 재사용한다.
    """
    opt = opt or default_cooc_tokenize_options_from_settings()
    stopwords = stopwords if stopwords is not None else default_cooc_stopwords_from_settings()

    tok_opt = TokenizeOptions(
        min_len=max(1, int(opt.min_len)),
        max_len=max(1, int(opt.max_len)),
        drop_numeric_only=bool(opt.drop_numeric_only),
    )

    return tokenize_text(text, opt=tok_opt, stopwords=stopwords)