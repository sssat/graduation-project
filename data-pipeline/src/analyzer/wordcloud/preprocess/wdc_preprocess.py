# data-pipeline/src/analyzer/wordcloud/preprocess/wdc_preprocess.py
# 워드클라우드 입력 텍스트에 대한 "추가 전처리" 모듈
# - DB에 저장된 *_CLEAN은 공통 최소 정제(HTML 제거/허용문자만 남김)로 유지하고,
#   워드클라우드에서만 필요한 추가 정규화는 여기서 수행한다.
#
# 원칙:
# - 의미를 크게 훼손하는 강한 정제는 피한다(분석 목적별 편차가 큼).
# - 워드클라우드 품질을 위해 "반복문자/공백/영문 표기" 같은 부분만 안정화한다.

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Optional

from src.config.settings import settings

_WS_RE = re.compile(r"\s+")

# 한국어/영어 반복 문자 축약용 (댓글에서 자주 등장)
_REPEAT_KO_RE = re.compile(r"([가-힣])\1{3,}")  # 같은 한글 4회 이상 -> 2회로
_REPEAT_EN_RE = re.compile(r"([A-Za-z])\1{3,}")  # 같은 영문 4회 이상 -> 2회로

# 자음/모음 반복(ㅋㅋㅋㅋ, ㅎㅎㅎㅎ, ㅠㅠㅠㅠ 등)
_REPEAT_JAMO_RE = re.compile(r"([ㄱ-ㅎㅏ-ㅣ])\1{3,}")  # 4회 이상 -> 2회로


@dataclass(frozen=True)
class WdcPreprocessOptions:
    """
    워드클라우드 입력 전처리 옵션
    - lowercase_english: 영문 소문자화
    - normalize_repeats: 반복 문자 축약(댓글 품질 안정화)
    - max_len: 너무 긴 텍스트는 잘라서 처리(극단적 outlier 방지)
    """
    lowercase_english: bool
    normalize_repeats: bool
    max_len: int


def _normalize_whitespace(s: str) -> str:
    return _WS_RE.sub(" ", (s or "").strip())


def _normalize_repeats(s: str) -> str:
    """
    과한 반복을 적당히 줄인다.
    - 완전 제거가 아니라 "줄이기"만 해서 감정/강조 뉘앙스를 조금은 남긴다.
    """
    t = s
    t = _REPEAT_JAMO_RE.sub(r"\1\1", t)
    t = _REPEAT_KO_RE.sub(r"\1\1", t)
    t = _REPEAT_EN_RE.sub(r"\1\1", t)
    return t


def _default_options_from_settings() -> WdcPreprocessOptions:
    return WdcPreprocessOptions(
        lowercase_english=bool(settings.wordcloud_pre_lowercase_english),
        normalize_repeats=bool(settings.wordcloud_pre_normalize_repeats),
        max_len=max(0, int(settings.wordcloud_pre_max_len)),
    )


def preprocess_for_wordcloud(text: object, *, opt: Optional[WdcPreprocessOptions] = None) -> str:
    """
    워드클라우드 입력용 추가 전처리(단일 문자열)
    - 이 함수는 DB의 *_CLEAN 텍스트를 입력으로 받는 것을 전제로 한다.
    - opt를 주지 않으면 .env -> settings 값을 기본 옵션으로 사용한다.
    """
    if text is None:
        return ""

    opt = opt or _default_options_from_settings()

    t = str(text)

    # 길이 상한(극단적으로 긴 본문/댓글이 들어오는 경우 대비)
    max_len = max(0, int(opt.max_len))
    if max_len > 0 and len(t) > max_len:
        t = t[:max_len]

    if opt.normalize_repeats:
        t = _normalize_repeats(t)

    t = _normalize_whitespace(t)

    if opt.lowercase_english:
        t = t.lower()

    return t.strip()


def preprocess_many_for_wordcloud(texts: Iterable[object], *, opt: Optional[WdcPreprocessOptions] = None) -> list[str]:
    """
    워드클라우드 입력용 추가 전처리(복수 문자열)
    - opt를 주지 않으면 .env -> settings 값을 기본 옵션으로 사용한다.
    """
    opt = opt or _default_options_from_settings()

    out: list[str] = []
    for x in texts:
        s = preprocess_for_wordcloud(x, opt=opt)
        if s:
            out.append(s)
    return out
