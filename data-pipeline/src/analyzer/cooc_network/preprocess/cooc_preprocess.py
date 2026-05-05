# data-pipeline/src/analyzer/cooc_network/preprocess/cooc_preprocess.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

from src.config.settings import settings
from src.analyzer.wordcloud.preprocess.wdc_preprocess import (
    WdcPreprocessOptions,
    preprocess_for_wordcloud,
    preprocess_many_for_wordcloud,
)


@dataclass(frozen=True)
class CoocPreprocessOptions:
    """
    공동언급 입력 전처리 옵션(.env -> settings)
    - wordcloud 전처리 로직을 재사용하되, 옵션은 cooc 전용으로 분리한다.
    """
    lowercase_english: bool
    normalize_repeats: bool
    max_len: int


def _to_wdc_opt(opt: CoocPreprocessOptions) -> WdcPreprocessOptions:
    return WdcPreprocessOptions(
        lowercase_english=bool(opt.lowercase_english),
        normalize_repeats=bool(opt.normalize_repeats),
        max_len=max(0, int(opt.max_len)),
    )


def default_cooc_preprocess_options_from_settings() -> CoocPreprocessOptions:
    return CoocPreprocessOptions(
        lowercase_english=bool(getattr(settings, "cooc_pre_lowercase_english", True)),
        normalize_repeats=bool(getattr(settings, "cooc_pre_normalize_repeats", True)),
        max_len=max(0, int(getattr(settings, "cooc_pre_max_len", 5000))),
    )


def preprocess_for_cooc(text: object, *, opt: Optional[CoocPreprocessOptions] = None) -> str:
    """
    공동언급 입력용 전처리(단일 문자열)
    - wordcloud 전처리 함수를 그대로 재사용한다.
    """
    opt = opt or default_cooc_preprocess_options_from_settings()
    return preprocess_for_wordcloud(text, opt=_to_wdc_opt(opt))


def preprocess_many_for_cooc(texts: Iterable[object], *, opt: Optional[CoocPreprocessOptions] = None) -> list[str]:
    """
    공동언급 입력용 전처리(복수 문자열)
    """
    opt = opt or default_cooc_preprocess_options_from_settings()
    return preprocess_many_for_wordcloud(texts, opt=_to_wdc_opt(opt))