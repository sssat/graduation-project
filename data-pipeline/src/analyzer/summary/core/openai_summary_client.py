# data-pipeline/src/analyzer/summary/core/openai_summary_client.py
# OpenAI API 호출 로직을 분리한 모듈
# - settings를 통해서만 환경변수/설정값을 사용한다.

from __future__ import annotations

from src.config.settings import settings


def call_openai_summary(prompt: str) -> str:
    """
    OpenAI 호출.
    - 환경변수는 settings를 통해서만 사용한다.
    - system 프롬프트는 settings.ai_summary_system_prompt로 제어한다.
    """
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY가 비어 있습니다. .env 또는 OS 환경변수에 OPENAI_API_KEY를 설정하세요.")

    try:
        from openai import OpenAI  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "openai 패키지가 설치되어 있지 않습니다. "
            "pip install openai 로 설치한 뒤 다시 실행하세요."
        ) from e

    client = OpenAI(api_key=settings.openai_api_key)

    system_prompt = (settings.ai_summary_system_prompt or "").strip()
    if not system_prompt:
        system_prompt = "너는 한국어 뉴스 요약 전문가다. 출력은 반드시 한국어로 한다."

    user_prompt = (prompt or "").strip()
    if not user_prompt:
        raise RuntimeError("OpenAI에 전달할 prompt가 비었습니다.")

    # Chat Completions 사용(간단/안정)
    resp = client.chat.completions.create(
        model=settings.ai_summary_model,
        temperature=float(settings.ai_summary_temperature),
        max_tokens=int(settings.ai_summary_max_output_tokens),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    text = (resp.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("OpenAI 응답이 비었습니다.")
    return text
