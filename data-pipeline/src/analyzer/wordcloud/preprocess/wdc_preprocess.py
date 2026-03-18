# data-pipeline/src/analyzer/wordcloud/preprocess/wdc_preprocess.py
# 워드클라우드 입력 텍스트에 대한 추가 전처리 모듈
#
# 방향:
# - 공통 전처리(clean_text)는 그대로 사용한다.
# - 워드클라우드 전용 전처리는 과하게 의미를 바꾸지 않고,
#   형태소 분석(Komoran) 전에 입력 문자열을 안정화하는 최소 정리만 수행한다.
# - 과거 프로젝트의 "정규식 최소 정리 + 형태소 분석 기반 명사 추출" 흐름에 맞춘다.

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Optional

from src.config.settings import settings

_WS_RE = re.compile(r"\s+")
_REPEAT_KO_RE = re.compile(r"([가-힣])\1{3,}")
_REPEAT_EN_RE = re.compile(r"([A-Za-z])\1{3,}")


@dataclass(frozen=True)
class WdcPreprocessOptions:
    """
    워드클라우드 입력 전처리 옵션
    - lowercase_english: 영문 소문자화
    - normalize_repeats: 과한 반복 축약
    - max_len: 너무 긴 텍스트 길이 상한(0이면 제한 없음)
    """

    lowercase_english: bool
    normalize_repeats: bool
    max_len: int


def _default_options_from_settings() -> WdcPreprocessOptions:
    return WdcPreprocessOptions(
        lowercase_english=bool(settings.wordcloud_pre_lowercase_english),
        normalize_repeats=bool(settings.wordcloud_pre_normalize_repeats),
        max_len=max(0, int(settings.wordcloud_pre_max_len)),
    )


def _normalize_whitespace(s: str) -> str:
    return _WS_RE.sub(" ", (s or "").strip())


def _normalize_repeats(s: str) -> str:
    """
    과한 반복은 2회로 축약한다.
    - 공통 전처리 단계에서 자모(ㅋㅋ, ㅎㅎ 등)는 대부분 제거되므로
      여기서는 한글/영문 반복만 가볍게 줄인다.
    """
    t = s
    t = _REPEAT_KO_RE.sub(r"\1\1", t)
    t = _REPEAT_EN_RE.sub(r"\1\1", t)
    return t


def preprocess_for_wordcloud(text: object, *, opt: Optional[WdcPreprocessOptions] = None) -> str:
    """
    워드클라우드 입력용 추가 전처리(단일 문자열)

    전제:
    - 입력은 이미 공통 전처리(clean_text)를 거친 *_CLEAN 문자열이다.
    - 여기서는 형태소 분석 전에 필요한 최소한의 안정화만 수행한다.
    """
    if text is None:
        return ""

    opt = opt or _default_options_from_settings()

    t = str(text)

    max_len = max(0, int(opt.max_len))
    if max_len > 0 and len(t) > max_len:
        t = t[:max_len]

    if opt.normalize_repeats:
        t = _normalize_repeats(t)

    t = _normalize_whitespace(t)

    if opt.lowercase_english:
        t = t.lower()

    return t.strip()


def preprocess_many_for_wordcloud(
    texts: Iterable[object],
    *,
    opt: Optional[WdcPreprocessOptions] = None,
) -> list[str]:
    """
    워드클라우드 입력용 추가 전처리(복수 문자열)
    """
    opt = opt or _default_options_from_settings()

    out: list[str] = []
    for x in texts:
        s = preprocess_for_wordcloud(x, opt=opt)
        if s:
            out.append(s)
    return out
