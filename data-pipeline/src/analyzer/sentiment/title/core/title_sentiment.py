# data-pipeline/src/analyzer/sentiment/title/core/title_sentiment.py
# 제목(TITLE_CLEAN) 기반 감성분석(LLM 미사용)
# - 사전학습 분류 모델(Transformers)을 사용해 pos/neu/neg soft 확률을 산출
# - 기사 단위 확률을 그룹 단위(키워드×언론사×기간필터)로 평균내어 퍼센트로 변환
# - 설정값은 src.config.settings(settings)를 통해 .env에서 조정 가능

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Tuple

# transformers/torch는 프로젝트 환경에 따라 미설치일 수 있으므로,
# 실제 실행 시 에러가 나면 requirements에 추가해야 함.
try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
except Exception as e:  # pragma: no cover
    torch = None  # type: ignore
    AutoModelForSequenceClassification = None  # type: ignore
    AutoTokenizer = None  # type: ignore
    _IMPORT_ERROR = e
else:
    _IMPORT_ERROR = None

from src.config.settings import settings


@dataclass(frozen=True)
class SentimentProba:
    positive: float
    neutral: float
    negative: float


def _normalize_label(label: str) -> str:
    s = (label or "").strip().lower()
    s = s.replace("label_", "")
    return s


def _infer_label_order(model_id2label: dict[int, str]) -> Tuple[int, int, int]:
    """
    모델 출력 로짓의 index -> (pos_idx, neu_idx, neg_idx)로 매핑.
    다양한 레이블 네이밍을 최대한 흡수한다.

    기대 레이블 예시:
    - "positive", "neutral", "negative"
    - "pos", "neu", "neg"
    - "LABEL_0" 같은 경우는 순서를 확정할 수 없으므로 fallback 규칙 적용
    """
    # 1) 문자열 기반 매칭
    pos_idx = neu_idx = neg_idx = -1
    for i, raw in model_id2label.items():
        lab = _normalize_label(raw)

        if lab in ("positive", "pos", "p"):
            pos_idx = i
        elif lab in ("neutral", "neu", "n", "none"):
            neu_idx = i
        elif lab in ("negative", "neg"):
            neg_idx = i

        # 한국어/기타 흔한 키워드도 일부 매칭
        if "긍정" in lab:
            pos_idx = i
        if "중립" in lab:
            neu_idx = i
        if "부정" in lab:
            neg_idx = i

    # 2) 완전 매칭 실패 시 fallback
    if pos_idx < 0 or neu_idx < 0 or neg_idx < 0:
        for i, raw in model_id2label.items():
            lab = _normalize_label(raw)
            if pos_idx < 0 and "pos" in lab:
                pos_idx = i
            if neg_idx < 0 and "neg" in lab:
                neg_idx = i
            if neu_idx < 0 and "neu" in lab:
                neu_idx = i

    if pos_idx < 0 or neu_idx < 0 or neg_idx < 0:
        # 최후 fallback: (neg, neu, pos)
        neg_idx = 0
        neu_idx = 1
        pos_idx = 2

    return (pos_idx, neu_idx, neg_idx)


def _resolve_device(requested: str | None) -> str:
    """
    device 결정 우선순위:
    1) 생성자 인자(device)
    2) settings.sentiment_title_device (.env)
    3) 자동 선택(cuda 가능하면 cuda, 아니면 cpu)
    """
    if requested is not None and requested.strip():
        return requested.strip().lower()

    conf = (settings.sentiment_title_device or "").strip().lower()
    if conf:
        return conf

    assert torch is not None
    return "cuda" if torch.cuda.is_available() else "cpu"


class SentimentModel:
    """
    Transformers 기반 감성분석 모델 래퍼.
    - 입력: 텍스트 리스트
    - 출력: (pos, neu, neg) 확률
    """

    def __init__(
        self,
        model_name: str | None = None,
        *,
        device: str | None = None,
        max_length: int | None = None,
    ) -> None:
        if _IMPORT_ERROR is not None:  # pragma: no cover
            raise RuntimeError(
                "sentiment 분석을 위해 transformers/torch가 필요합니다. "
                "pip install transformers torch 를 설치하거나 requirements에 추가하세요."
            ) from _IMPORT_ERROR

        assert torch is not None
        assert AutoTokenizer is not None
        assert AutoModelForSequenceClassification is not None

        # 모델명 우선순위: 인자 -> settings(.env)
        model_name = (model_name or "").strip() or (settings.sentiment_title_model_name or "").strip()
        if not model_name:
            raise ValueError(
                "SENTIMENT_TITLE_MODEL_NAME이 비어 있습니다. "
                ".env에 SENTIMENT_TITLE_MODEL_NAME을 설정하거나 SentimentModel(model_name=...)로 지정하세요."
            )

        self.model_name = model_name

        # 제목 감성분석은 보통 짧은 텍스트이므로 64~128을 권장
        if max_length is None:
            max_length = int(settings.sentiment_title_max_length)
        self.max_length = max(8, int(max_length))

        # device 설정: "cpu" 또는 "cuda"
        self.device = _resolve_device(device)
        self.torch_device = torch.device(self.device)

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self.model.to(self.torch_device)
        self.model.eval()

        # 레이블 매핑 준비
        id2label = getattr(self.model.config, "id2label", None) or {}
        if not isinstance(id2label, dict) or len(id2label) == 0:
            id2label = {0: "negative", 1: "neutral", 2: "positive"}
        self.pos_idx, self.neu_idx, self.neg_idx = _infer_label_order(id2label)

    @torch.no_grad()
    def predict_proba(self, texts: List[str], *, batch_size: int | None = None) -> List[SentimentProba]:
        assert torch is not None

        if batch_size is None:
            batch_size = int(settings.sentiment_title_batch_size)
        batch_size = max(1, int(batch_size))

        out: List[SentimentProba] = []

        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            enc = self.tokenizer(
                chunk,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            enc = {k: v.to(self.torch_device) for k, v in enc.items()}

            logits = self.model(**enc).logits  # (B, C)
            probs = torch.softmax(logits, dim=-1).detach().cpu().tolist()

            for p in probs:
                pos = float(p[self.pos_idx])
                neu = float(p[self.neu_idx])
                neg = float(p[self.neg_idx])
                out.append(SentimentProba(positive=pos, neutral=neu, negative=neg))

        return out


def mean_proba(items: Iterable[SentimentProba]) -> SentimentProba:
    """
    soft 확률 평균
    """
    s_pos = s_neu = s_neg = 0.0
    n = 0

    for it in items:
        n += 1
        s_pos += float(it.positive)
        s_neu += float(it.neutral)
        s_neg += float(it.negative)

    if n <= 0:
        return SentimentProba(positive=0.0, neutral=0.0, negative=0.0)

    return SentimentProba(
        positive=s_pos / n,
        neutral=s_neu / n,
        negative=s_neg / n,
    )


def to_pct(p: SentimentProba) -> Tuple[float, float, float]:
    """
    DB 저장용 percent(0~100) 변환 (소수점 2자리까지는 writer에서 반올림 처리 권장)
    """
    return (p.positive * 100.0, p.neutral * 100.0, p.negative * 100.0)
