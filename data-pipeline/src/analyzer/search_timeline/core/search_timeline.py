from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Literal
from zoneinfo import ZoneInfo

# Ignore local TLS key-log settings that can break requests initialization
# in locked-down environments.
os.environ.pop("SSLKEYLOGFILE", None)

import requests
from dateutil.relativedelta import relativedelta

from src.config.settings import settings


@dataclass(frozen=True)
class SearchTimelinePoint:
    observed_date: date
    interest_score: int
    is_partial: bool


@dataclass(frozen=True)
class SearchTimelineFetchResult:
    status: Literal["success", "rate_limited", "no_data"]
    points: List[SearchTimelinePoint]
    attempts: int


def _today_in_tz() -> date:
    return datetime.now(tz=ZoneInfo(settings.tz)).date()


def _resolve_date_window(timeframe: str) -> tuple[date, date]:
    today = _today_in_tz()
    raw = (timeframe or "").strip().lower()

    if not raw:
        return today - relativedelta(months=3), today

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}\s+\d{4}-\d{2}-\d{2}", raw):
        start_text, end_text = raw.split()
        start_date = date.fromisoformat(start_text)
        end_date = date.fromisoformat(end_text)
        return (start_date, end_date) if start_date <= end_date else (end_date, start_date)

    match = re.fullmatch(r"today\s+(\d+)-([dmy])", raw)
    if not match:
        return today - relativedelta(months=3), today

    amount = max(1, int(match.group(1)))
    unit = match.group(2)

    if unit == "d":
        start_date = today - relativedelta(days=amount)
    elif unit == "m":
        start_date = today - relativedelta(months=amount)
    else:
        start_date = today - relativedelta(years=amount)

    return start_date, today


def _naver_headers() -> dict[str, str]:
    client_id = settings.naver_datalab_client_id
    client_secret = settings.naver_datalab_client_secret
    if not client_id or not client_secret:
        raise RuntimeError(
            "NAVER_DATALAB_CLIENT_ID and NAVER_DATALAB_CLIENT_SECRET must be set before running this job."
        )

    return {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
        "Content-Type": "application/json",
    }


def _build_naver_payload(*, keyword: str, timeframe: str) -> dict:
    start_date, end_date = _resolve_date_window(timeframe)
    payload = {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "timeUnit": "date",
        # DataLab ratios are normalized inside each request, so we query one keyword
        # per call to keep a keyword's timeline scale stable across runs.
        "keywordGroups": [
            {
                "groupName": keyword,
                "keywords": [keyword],
            }
        ],
    }

    if settings.naver_datalab_device:
        payload["device"] = settings.naver_datalab_device
    if settings.naver_datalab_gender:
        payload["gender"] = settings.naver_datalab_gender
    if settings.naver_datalab_ages:
        payload["ages"] = settings.naver_datalab_ages.split(",")

    return payload


def _raise_http_error(response: requests.Response) -> None:
    body_snippet = response.text[:300].replace("\n", " ").strip()
    raise RuntimeError(
        f"Naver DataLab API request failed with status={response.status_code}. body={body_snippet}"
    )


def _create_http_session() -> requests.Session:
    session = requests.Session()
    # Ignore shell-level proxy variables so the batch job always talks to
    # Naver directly unless code explicitly sets a proxy.
    session.trust_env = False
    return session


def fetch_search_timeline(
    *,
    keyword_name: str,
    timeframe: str,
) -> SearchTimelineFetchResult:
    keyword = (keyword_name or "").strip()
    if not keyword:
        return SearchTimelineFetchResult(status="no_data", points=[], attempts=0)

    max_attempts = 3
    base_sleep_seconds = max(1.0, float(settings.search_timeline_sleep_max_seconds))
    payload = _build_naver_payload(keyword=keyword, timeframe=timeframe)
    headers = _naver_headers()
    session = _create_http_session()
    try:
        for attempt in range(1, max_attempts + 1):
            try:
                response = session.post(
                    "https://openapi.naver.com/v1/datalab/search",
                    headers=headers,
                    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                    timeout=float(settings.naver_datalab_request_timeout_seconds),
                )
            except requests.RequestException as exc:
                if attempt >= max_attempts:
                    raise RuntimeError(f"Naver DataLab API request failed: {exc}") from exc
                time.sleep(base_sleep_seconds * attempt)
                continue

            if response.status_code == 429:
                if attempt >= max_attempts:
                    return SearchTimelineFetchResult(status="rate_limited", points=[], attempts=attempt)
                time.sleep(base_sleep_seconds * attempt * 2.0)
                continue

            if response.status_code >= 500:
                if attempt >= max_attempts:
                    _raise_http_error(response)
                time.sleep(base_sleep_seconds * attempt)
                continue

            if response.status_code != 200:
                _raise_http_error(response)

            try:
                body = response.json()
            except ValueError as exc:
                raise RuntimeError("Naver DataLab API returned non-JSON response.") from exc

            results = body.get("results") or []
            if not results:
                return SearchTimelineFetchResult(status="no_data", points=[], attempts=attempt)

            data_points = results[0].get("data") or []
            if not data_points:
                return SearchTimelineFetchResult(status="no_data", points=[], attempts=attempt)

            points: List[SearchTimelinePoint] = []
            for item in data_points:
                observed_date_raw = str(item.get("period") or "").strip()
                if not observed_date_raw:
                    continue

                try:
                    observed_date = date.fromisoformat(observed_date_raw[:10])
                except ValueError:
                    continue

                raw_ratio = item.get("ratio", 0)
                try:
                    ratio = float(raw_ratio)
                except (TypeError, ValueError):
                    ratio = 0.0

                points.append(
                    SearchTimelinePoint(
                        observed_date=observed_date,
                        interest_score=max(0, min(100, int(round(ratio)))),
                        is_partial=False,
                    )
                )

            if not points:
                return SearchTimelineFetchResult(status="no_data", points=[], attempts=attempt)

            points.sort(key=lambda point: point.observed_date)
            return SearchTimelineFetchResult(status="success", points=points, attempts=attempt)
    finally:
        session.close()

    return SearchTimelineFetchResult(status="no_data", points=[], attempts=max_attempts)
