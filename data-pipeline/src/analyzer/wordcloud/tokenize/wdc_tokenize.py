# data-pipeline/src/analyzer/wordcloud/tokenize/wdc_tokenize.py
# 워드클라우드 토큰화/필터링 모듈
#
# 방향:
# - 과거 프로젝트에서 품질이 좋았던 "Komoran 명사 추출 + 불용어 제거" 흐름으로 변경한다.
# - 공통 전처리(clean_text)는 그대로 두고, 워드클라우드 전용 단계에서 형태소 분석을 적용한다.
# - 제목/본문/댓글 모두 명사 중심 토큰으로 통일해 품질을 높인다.

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
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
    - min_len: 최소 토큰 길이(과거 프로젝트와 동일하게 기본 2)
    - max_len: 너무 긴 토큰 제거
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

        # 한 줄에 콤마 구분 또는 탭 구분으로 들어와도 처리
        parts = [s]
        if "," in s:
            parts = s.split(",")
        elif "\t" in s:
            parts = s.split("\t")

        for part in parts:
            w = part.strip()
            if w:
                out.add(w)
    return out


def load_stopwords_from_file(path: str) -> Set[str]:
    """
    불용어 파일 로드.
    - 한 줄 1개 / 콤마 구분 / 탭 구분 모두 허용
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
    .env -> settings 불용어를 사용한다.
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


@lru_cache(maxsize=1)
def _get_komoran():
    """
    Komoran 분석기를 지연 로드한다.
    - 워드클라우드 실행 중 1회만 생성해서 재사용한다.
    - konlpy/Java 환경이 없으면 명확한 메시지로 실패시킨다.
    """
    try:
        from konlpy.tag import Komoran  # type: ignore
    except Exception as e:  # pragma: no cover - 실행 환경 의존
        raise RuntimeError(
            "워드클라우드 명사 추출을 위해 konlpy의 Komoran이 필요합니다. "
            "과거 프로젝트와 동일한 방식으로 바꾼 상태이므로, 실행 환경에 konlpy와 Java(JDK)를 설치해 주세요."
        ) from e

    return Komoran()


def _normalize_token(token: str) -> str:
    return (token or "").strip()


def _keep_token(token: str, *, opt: TokenizeOptions, stopwords: Set[str]) -> bool:
    t = _normalize_token(token)
    if not t:
        return False

    if not _TOKEN_ALLOWED_RE.match(t):
        return False

    if opt.drop_numeric_only and _NUMERIC_ONLY_RE.match(t):
        return False

    if len(t) < int(opt.min_len) or len(t) > int(opt.max_len):
        return False

    if t in stopwords:
        return False

    return True


def tokenize_text(
    text: str,
    *,
    opt: Optional[TokenizeOptions] = None,
    stopwords: Optional[Set[str]] = None,
) -> list[str]:
    """
    Komoran 기반 명사 추출 + 필터링.

    과거 프로젝트와 동일한 핵심 규칙:
    - komoran.nouns()로 명사만 추출
    - 길이 2 이상 명사만 사용
    - 불용어 제거

    추가로 현재 프로젝트 운영 안전을 위해:
    - 숫자-only 토큰 제거 옵션
    - 최대 길이 컷
    - 허용 문자 범위 필터
    를 유지한다.
    """
    opt = opt or default_tokenize_options_from_settings()
    stopwords = stopwords or default_stopwords_from_settings()

    min_len = max(1, int(opt.min_len))
    max_len = max(min_len, int(opt.max_len))
    local_opt = TokenizeOptions(min_len=min_len, max_len=max_len, drop_numeric_only=bool(opt.drop_numeric_only))

    s = (text or "").strip()
    if not s:
        return []

    komoran = _get_komoran()
    nouns = komoran.nouns(s)

    tokens: list[str] = []
    for noun in nouns:
        t = _normalize_token(noun)
        if not _keep_token(t, opt=local_opt, stopwords=stopwords):
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
    - Komoran 인스턴스는 내부에서 1회만 생성/재사용된다.
    """
    opt = opt or default_tokenize_options_from_settings()
    stopwords = stopwords or default_stopwords_from_settings()

    out: list[str] = []
    for s in texts:
        out.extend(tokenize_text(s, opt=opt, stopwords=stopwords))
    return out