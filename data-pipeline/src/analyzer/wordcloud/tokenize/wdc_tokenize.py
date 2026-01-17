# data-pipeline/src/analyzer/wordcloud/tokenize/wdc_tokenize.py
# 워드클라우드 토큰화/필터링 모듈
# - 형태소 분석기 없이도 MVP로 쓸 수 있는 "공백 기반 토큰화" 제공
# - 불용어/길이/숫자 토큰 필터 제공
#
# 주의:
# - 한국어 워드클라우드 품질을 더 올리고 싶으면,
#   나중에 여기에서 형태소 분석(예: Mecab/Okt)로 교체하면 된다.
# - core/wordcloud.py는 tokenize 결과만 받도록 설계하면 교체가 쉬워진다.

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional, Set

from src.config.settings import settings

# 토큰으로 인정할 문자 범위(한글/영문/숫자/한자)
_TOKEN_ALLOWED_RE = re.compile(r"^[가-힣A-Za-z0-9\u4E00-\u9FFF]+$")

# 숫자만으로 이뤄진 토큰
_NUMERIC_ONLY_RE = re.compile(r"^[0-9]+$")


@dataclass(frozen=True)
class TokenizeOptions:
    """
    토큰화 옵션
    - min_len: 최소 토큰 길이(1글자 토큰 제거 등)
    - max_len: 너무 긴 토큰 제거(비정상 토큰 방지)
    - drop_numeric_only: 숫자만 있는 토큰 제거
    """
    min_len: int = 2
    max_len: int = 30
    drop_numeric_only: bool = True


def _parse_stopwords_lines(lines: Iterable[str]) -> Set[str]:
    out: Set[str] = set()
    for line in lines:
        s = (line or "").strip()
        if not s:
            continue
        if s.startswith("#"):
            continue
        # "a,b,c" 형태도 지원
        if "," in s:
            for part in s.split(","):
                w = part.strip()
                if w:
                    out.add(w)
        else:
            out.add(s)
    return out


def load_stopwords_from_file(path: str) -> Set[str]:
    """
    불용어 파일 로드.
    - 한 줄에 1개 또는 콤마 구분도 허용
    - 빈 줄/주석(#) 무시
    """
    p = Path(path)
    if not path or not p.exists() or not p.is_file():
        return set()
    raw = p.read_text(encoding="utf-8")
    return _parse_stopwords_lines(raw.splitlines())


def load_stopwords_from_csv(csv_text: str) -> Set[str]:
    """
    환경변수 등에서 "a,b,c" 형태로 준 불용어 로드.
    """
    if not csv_text or not csv_text.strip():
        return set()
    return _parse_stopwords_lines([csv_text])


def default_tokenize_options_from_settings() -> TokenizeOptions:
    """
    .env -> settings 값을 기본 토큰 옵션으로 사용한다.
    """
    return TokenizeOptions(
        min_len=int(getattr(settings, "wordcloud_token_min_len", 2)),
        max_len=int(getattr(settings, "wordcloud_token_max_len", 30)),
        drop_numeric_only=bool(getattr(settings, "wordcloud_drop_numeric_only", True)),
    )


def default_stopwords_from_settings() -> Set[str]:
    """
    .env -> settings 불용어만 사용한다.
    - CSV(TEXT)와 파일(path) 둘 다 지원
    - 둘 다 비면 빈 set()
    """
    sw: Set[str] = set()

    csv_text = str(getattr(settings, "wordcloud_stopwords_csv", "") or "").strip()
    file_path = str(getattr(settings, "wordcloud_stopwords_file", "") or "").strip()

    if csv_text:
        sw |= load_stopwords_from_csv(csv_text)
    if file_path:
        sw |= load_stopwords_from_file(file_path)

    return sw



def tokenize_text(
    text: str,
    *,
    opt: Optional[TokenizeOptions] = None,
    stopwords: Optional[Set[str]] = None,
) -> list[str]:
    """
    공백 기반 토큰화 + 필터링.
    - 입력은 preprocess_for_wordcloud()를 거친 문자열을 권장한다.
    - opt/stopwords를 주지 않으면 .env -> settings 값을 기본으로 사용한다.
    """
    opt = opt or default_tokenize_options_from_settings()
    stopwords = stopwords or default_stopwords_from_settings()

    min_len = max(1, int(opt.min_len))
    max_len = max(min_len, int(opt.max_len))

    tokens: list[str] = []
    for raw in (text or "").split():
        t = raw.strip()
        if not t:
            continue

        if len(t) < min_len or len(t) > max_len:
            continue

        if not _TOKEN_ALLOWED_RE.match(t):
            continue

        if opt.drop_numeric_only and _NUMERIC_ONLY_RE.match(t):
            continue

        if t in stopwords:
            continue

        tokens.append(t)

    return tokens


def tokenize_many(
    texts: Iterable[str],
    *,
    opt: Optional[TokenizeOptions] = None,
    stopwords: Optional[Set[str]] = None,
) -> list[str]:
    """
    복수 텍스트를 토큰화해서 하나의 토큰 리스트로 합친다.
    - opt/stopwords를 주지 않으면 .env -> settings 값을 기본으로 사용한다.
    """
    opt = opt or default_tokenize_options_from_settings()
    stopwords = stopwords or default_stopwords_from_settings()

    out: list[str] = []
    for s in texts:
        out.extend(tokenize_text(s, opt=opt, stopwords=stopwords))
    return out
