# data-pipeline/src/preprocess/core/preprocess.py
# 네이버 뉴스 기사/뉴스 댓글의 전처리를 담당하는 핵심 모듈
# 매우 기초적인 전처리만 수행
# 세부 전처리가 필요한 경우 해당 분석을 진행하기 앞서 각각의 분석에 맞게 추가 전처리 예정

from __future__ import annotations

import html
import re
import unicodedata

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_ALLOWED_RE = re.compile(r"[^가-힣A-Za-z0-9\u4E00-\u9FFF\s]")


def clean_text(text: object) -> str:
    if text is None:
        return ""

    t = str(text)

    # 1) HTML 엔티티 복원 (&#34;, &lt;br&gt; 같은 숫자/문자 엔티티 포함)
    t = html.unescape(t)

    # 2) HTML 태그 제거
    t = _HTML_TAG_RE.sub(" ", t)

    # 3) 제로폭/nbsp 정리
    t = t.replace("\u200b", " ").replace("\xa0", " ")

    # 4) 허용 문자 외 제거
    t = _ALLOWED_RE.sub(" ", t)

    # 5) 공백 정리
    t = _WS_RE.sub(" ", t).strip()

    # 6) NFC 정규화
    return unicodedata.normalize("NFC", t)
