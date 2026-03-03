# data-pipeline/src/analyzer/wordcloud/tokenize/wdc_tokenize.py
# 워드클라우드 토큰화/필터링 모듈
# - 형태소 분석기 없이도 MVP로 쓸 수 있는 "공백 기반 토큰화" 제공
# - 불용어/길이/숫자 토큰 필터 제공
# - 한국어 조사(은/는/이/가/을/를 등) 휴리스틱 제거로 워드클라우드 품질 개선
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

# 한글만으로 이뤄진 토큰(조사 제거 휴리스틱 적용 대상)
_KOREAN_ONLY_RE = re.compile(r"^[가-힣]+$")

# 한국어 조사/붙임표현(긴 것부터 우선 제거되도록 정렬하여 사용)
# - 과도한 오탐을 줄이기 위해 "명사+조사"에 자주 붙는 표현 위주로만 포함
# - 100% 정확한 형태소 분석 대체용이 아니라 워드클라우드 품질 개선용 휴리스틱
_KOREAN_JOSA_SUFFIXES: tuple[str, ...] = tuple(
    sorted(
        {
            # 복합 조사/자주 보이는 결합형
            "으로부터", "으로써", "으로서",
            "에게서는", "에게서", "에게는", "에게도", "에게",
            "한테서는", "한테서", "한테는", "한테도", "한테",
            "에서는", "에서는요", "에선", "에서", "에는", "에도", "에만",
            "으로는", "으로도", "으로만", "으로",
            "로는", "로도", "로만", "로",
            "까지는", "까지도", "까지",
            "부터는", "부터도", "부터",
            "처럼", "같이", "마다", "보다",
            "이라는", "라는", "이라고", "라고",
            "이라도", "라도", "이나마", "나마",
            "이라", "라",  # 드물지만 댓글에서 축약형이 섞일 수 있음
            "이랑", "랑",
            "와의", "과의",
            # 단일 조사
            "은", "는", "이", "가", "을", "를", "의", "도", "만",
            "와", "과", "에", "서", "께",
        },
        key=len,
        reverse=True,
    )
)


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


def _strip_korean_josa_heuristic(token: str, *, min_stem_len: int = 2) -> str:
    """
    한국어 토큰 끝의 조사/붙임표현을 휴리스틱으로 제거한다.

    예:
    - 내란이 -> 내란
    - 내란을 -> 내란
    - 윤석열은 -> 윤석열

    주의:
    - 형태소 분석기가 아니므로 100% 정확하진 않다.
    - 워드클라우드에서 같은 명사를 하나로 모으는 목적의 "가벼운 정규화"이다.
    - 과도한 축약 방지를 위해 줄인 뒤 최소 길이(min_stem_len)를 보장해야 반영한다.
    """
    t = (token or "").strip()
    if not t:
        return t

    # 한글-only 토큰에만 적용 (영문/숫자/한자는 원형 유지)
    if not _KOREAN_ONLY_RE.match(t):
        return t

    cur = t
    # 2회까지만 제거 시도 (예: "내란에는" -> "내란")
    for _ in range(2):
        changed = False
        for suffix in _KOREAN_JOSA_SUFFIXES:
            if not cur.endswith(suffix):
                continue

            stem = cur[: -len(suffix)]
            if len(stem) < min_stem_len:
                continue

            cur = stem
            changed = True
            break

        if not changed:
            break

    return cur



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
    - 한국어 토큰은 조사 제거 휴리스틱을 적용해 명사 형태를 최대한 합친다.
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

        if not _TOKEN_ALLOWED_RE.match(t):
            continue

        if opt.drop_numeric_only and _NUMERIC_ONLY_RE.match(t):
            continue

        # 한국어 조사 정규화 (예: 내란이/내란을 -> 내란)
        t = _strip_korean_josa_heuristic(t, min_stem_len=min_len)
        if not t:
            continue

        # 정규화 후 길이 기준 재검사
        if len(t) < min_len or len(t) > max_len:
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
