# data-pipeline/src/crawler/news.py
# news.py를 단독 실행하면(news.py의 main 실행), keyword_reader.py / article_writer.py는 import(로딩)되고,
# 실행 중 fetch_keywords_for_trend_run(), persist_articles() 호출로 DB 조회/적재가 수행된다.
# 네이버 뉴스 수집/파싱(링크 수집 + 본문/날짜 추출 + 선택적 댓글 수집) 담당
# DB 적재는 article_writer.py가 수행
# 현재는 news.py만 단독실행하면 생성되는 로그 파일은 없다.

from __future__ import annotations

import argparse
import asyncio
import hashlib
import math
import random
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import aiohttp
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from zoneinfo import ZoneInfo

from src.config.settings import settings
from crawler.news.storage.article_writer import (
    CrawledArticle,
    CrawledCommentBundle,
    persist_articles,
)
from crawler.news.storage.keyword_reader import fetch_keywords_for_trend_run

# 네이버 뉴스 검색 결과에서 기사 링크 정규식(백업용)
ARTICLE_URL_RE = re.compile(r"(https://n\.news\.naver\.com/mnews/article/\d+/\d+)")

# 기본 동작 파라미터(.env -> settings로 관리)
DEFAULT_DAYS_BACK: int = int(settings.news_days_back)
DEFAULT_START_PAGE: int = int(settings.news_start_page)
DEFAULT_END_PAGE: int = int(settings.news_end_page)

# 타임존(환경변수 TZ는 settings.tz로 관리)
APP_TZ = ZoneInfo(settings.tz)

# ───────────────────────────────────────────────────────────────
# 런타임 튜닝 값: settings 기반(없으면 기본값 사용)
# ───────────────────────────────────────────────────────────────

# 기사 본문 크롤링 동시성(코루틴 워커 수)
ARTICLE_CONCURRENCY: int = int(getattr(settings, "news_article_concurrency", 20))

# aiohttp 커넥션 제한(안정성/차단 리스크 완화)
HTTP_CONN_LIMIT: int = int(getattr(settings, "news_http_conn_limit", 80))
HTTP_CONN_LIMIT_PER_HOST: int = int(getattr(settings, "news_http_conn_limit_per_host", 20))

# 댓글 최대 수집 개수(기사 1건당)
MAX_COMMENTS_PER_ARTICLE: int = int(getattr(settings, "news_max_comments_per_article", 30))

# 댓글 수집 샘플링(언론사×키워드별 기사 중 일부만)
# - 0.2 = 20%
# - 샘플링은 "안정 샘플링"으로, 같은 URL 리스트에 대해 항상 같은 결과를 만들도록 설계
COMMENT_SAMPLE_RATE: float = float(getattr(settings, "news_comment_sample_rate", 1.0))  # 기본은 전수(기존 동작 유지)
COMMENT_SAMPLE_MIN: int = int(getattr(settings, "news_comment_sample_min", 1))

# 네이버 언론사 코드(= T_MEDIA seed와 동일해야 함)
# 필요한 언론사만 켜서 쓰면 됨
PRESS_CODES: Dict[str, int] = {
    "조선일보": 1023,
    "중앙일보": 1025,
    "동아일보": 1020,
    "한겨레": 1028,
    "경향신문": 1032,
    "프레시안": 1002,
    "한국일보": 1469,
    "서울신문": 1081,
    "연합뉴스": 1001,
}


def _app_now() -> datetime:
    return datetime.now(tz=APP_TZ)


def _date_range_app_tz(*, base_date: date, days_back: int) -> tuple[str, str]:
    """
    네이버 검색 파라미터(ds, de)에 넣을 날짜 문자열(YYYY.MM.DD) 생성
    - base_date 기준으로 days_back 전부터 base_date까지
    """
    end = datetime(base_date.year, base_date.month, base_date.day, tzinfo=APP_TZ).date()
    start = end - timedelta(days=days_back)
    return start.strftime("%Y.%m.%d"), end.strftime("%Y.%m.%d")


def make_search_urls_for_press(
    *,
    query: str,
    press_id: int,
    start_page: int,
    end_page: int,
    start_date: str,
    end_date: str,
) -> List[str]:
    """
    네이버 뉴스 검색(언론사 지정) 페이지 URL 리스트 생성.
    - start_page=1, end_page=3 => start 파라미터: 1, 11, 21
    """
    urls: List[str] = []
    q = quote_plus(query)

    ds_nodot = start_date.replace(".", "")
    de_nodot = end_date.replace(".", "")

    for pg in range(start_page, end_page + 1):
        start = 1 + (pg - 1) * 10
        url = (
            f"https://search.naver.com/search.naver?"
            f"ssc=tab.news.all&query={q}&start={start}"
            f"&sm=tab_opt&sort=0&photo=0&field=0"
            f"&pd=3&ds={start_date}&de={end_date}"
            f"&docid=&related=0&mynews=1"
            f"&office_type=1&office_section_code=1"
            f"&news_office_checked={press_id}"
            f"&nso=so%3Ar%2Cp%3Afrom{ds_nodot}to{de_nodot}"
            f"&is_sug_officeid=0&office_category=0&service_area=0"
        )
        urls.append(url)

    return urls


def _build_chrome_options(*, headless: bool = True) -> webdriver.ChromeOptions:
    options = webdriver.ChromeOptions()

    if headless:
        options.add_argument("--headless=new")

    # 서버/도커 환경 안정성 옵션
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,720")
    options.add_argument("--lang=ko-KR")

    # 불필요 리소스 로딩 최소화(약간의 속도/안정성 개선)
    prefs = {
        "profile.managed_default_content_settings.images": 2,  # 이미지 로드 차단
        "profile.default_content_setting_values.notifications": 2,
    }
    options.add_experimental_option("prefs", prefs)

    return options


def _normalize_article_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    url = url.replace("m.news.naver.com", "n.news.naver.com")
    url = url.split("?", 1)[0]
    return url


def _stable_hash_int(s: str) -> int:
    return int(hashlib.sha256(s.encode("utf-8")).hexdigest(), 16)


def _sample_urls_for_comments(urls: List[str], *, rate: float, min_count: int) -> List[str]:
    """
    언론사×키워드 내 기사 URL 중 일부만 댓글 수집 대상으로 샘플링.

    정책:
    - rate 비율만큼 선택(ceil)
    - 최소 min_count 보장(단, 전체 개수 이하)
    - "안정 샘플링": 같은 URL 목록이면 매번 같은 샘플이 나오도록 hash 기준 정렬 후 상위 k개 선택
    """
    if not urls:
        return []

    # 정규화 + 중복 제거(순서 유지)
    normed: List[str] = []
    seen: set[str] = set()
    for u in urls:
        nu = _normalize_article_url(u)
        if not nu:
            continue
        if nu in seen:
            continue
        seen.add(nu)
        normed.append(nu)

    if not normed:
        return []

    rr = max(0.0, float(rate))
    if rr >= 1.0:
        return normed

    n = len(normed)
    k = int(math.ceil(n * rr))
    k = max(int(min_count), k)
    k = min(k, n)

    # URL의 해시값 기준으로 정렬해 상위 k개 선택(랜덤처럼 보이지만 재실행해도 동일)
    ranked = sorted(normed, key=_stable_hash_int)
    return ranked[:k]


def crawl_article_links_for_press(
    task: Tuple[str, int, Dict[str, List[str]], bool]
) -> Tuple[str, Dict[str, List[str]]]:
    """
    (멀티프로세싱 워커)
    특정 언론사(press_name)의 검색 결과 페이지들을 순회하면서
    키워드별 기사 URL(https://n.news.naver.com/mnews/article/...)을 수집한다.
    """
    press_name, _press_id, search_urls_by_keyword, headless = task

    options = _build_chrome_options(headless=headless)
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(40)
    driver.implicitly_wait(6)

    results: Dict[str, List[str]] = {}

    try:
        for kw, urls in search_urls_by_keyword.items():
            news_links: List[str] = []
            seen: set[str] = set()

            for url in urls:
                try:
                    driver.get(url)
                except Exception:
                    continue

                try:
                    WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located(
                            (
                                By.CSS_SELECTOR,
                                'a[cru^="https://n.news.naver.com/mnews/article"], a[href*="n.news.naver.com/mnews/article"]',
                            )
                        )
                    )
                except TimeoutException:
                    continue

                # 과도한 대기는 전체 실행을 크게 늘림. 최소 지터만 유지
                time.sleep(random.uniform(0.15, 0.45))

                # 1) cru 속성 기반
                for a in driver.find_elements(
                    By.CSS_SELECTOR, 'a[cru^="https://n.news.naver.com/mnews/article"]'
                ):
                    link = (a.get_attribute("cru") or "").strip()
                    link = _normalize_article_url(link)
                    if link and link not in seen:
                        seen.add(link)
                        news_links.append(link)

                # 2) href 기반(백업)
                for a in driver.find_elements(
                    By.CSS_SELECTOR, 'a[href*="n.news.naver.com/mnews/article"]'
                ):
                    href = (a.get_attribute("href") or "").strip()
                    m = ARTICLE_URL_RE.search(href)
                    if m:
                        link = _normalize_article_url(m.group(1))
                        if link and link not in seen:
                            seen.add(link)
                            news_links.append(link)

            results[kw] = news_links

    finally:
        driver.quit()

    return press_name, results


class RetryableHttpError(RuntimeError):
    def __init__(self, status: int, url: str) -> None:
        super().__init__(f"retryable http status={status} url={url}")
        self.status = status
        self.url = url


async def _fetch_html(session: aiohttp.ClientSession, url: str) -> str:
    """
    HTML 다운로드
    - 상태 코드 기반으로 재시도 가능한 오류를 구분
    """
    async with session.get(url, allow_redirects=True) as resp:
        # 429/5xx는 보통 잠깐 쉬면 풀리거나(429), 서버 상황(5xx)이므로 백오프로 재시도 대상
        if resp.status in (429, 500, 502, 503, 504):
            raise RetryableHttpError(resp.status, url)

        # 403은 차단 가능성이 높지만, 일시적인 경우도 있으니 재시도 대상으로 둠
        if resp.status == 403:
            raise RetryableHttpError(resp.status, url)

        resp.raise_for_status()
        return await resp.text()


def _extract_title(soup: BeautifulSoup) -> str:
    sel = soup.select_one("#title_area")
    if sel:
        t = sel.get_text(strip=True)
        if t:
            return t

    sel = soup.select_one("h2#title_area span")
    if sel:
        t = sel.get_text(strip=True)
        if t:
            return t

    og = soup.select_one('meta[property="og:title"]')
    if og and og.get("content"):
        return str(og["content"]).strip()

    return ""


def _parse_published_at(text_or_iso: str) -> Optional[datetime]:
    s = (text_or_iso or "").strip()
    if not s:
        return None

    # 1) data-date-time 등: 2025-12-31 15:20:00 / 2025-12-31 15:20
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt
        except Exception:
            pass

    # 2) ISO: 2025-12-31T15:20:00+09:00
    try:
        dt2 = datetime.fromisoformat(s.replace("Z", "+00:00"))
        # APP_TZ 기준 naive로 정규화
        if dt2.tzinfo is not None:
            dt2 = dt2.astimezone(APP_TZ).replace(tzinfo=None)
        return dt2
    except Exception:
        pass

    # 3) 한글 표기: 2025.12.31. 오후 3:20
    m = re.search(
        r"(\d{4})\.(\d{2})\.(\d{2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2})",
        s,
    )
    if m:
        y, mo, d, ampm, hh, mm = m.groups()
        h = int(hh)
        if ampm == "오후" and h != 12:
            h += 12
        if ampm == "오전" and h == 12:
            h = 0
        try:
            return datetime(int(y), int(mo), int(d), h, int(mm))
        except Exception:
            return None

    return None


def _extract_published_at(soup: BeautifulSoup) -> Optional[datetime]:
    node = soup.select_one("span.media_end_head_info_datestamp_time")
    if node and node.get("data-date-time"):
        return _parse_published_at(str(node["data-date-time"]))

    if node:
        t = node.get_text(strip=True)
        dt = _parse_published_at(t)
        if dt:
            return dt

    meta = soup.select_one('meta[property="article:published_time"]')
    if meta and meta.get("content"):
        return _parse_published_at(str(meta["content"]))

    meta2 = soup.select_one('meta[property="og:article:published_time"]')
    if meta2 and meta2.get("content"):
        return _parse_published_at(str(meta2["content"]))

    return None


def _extract_content(soup: BeautifulSoup) -> str:
    node = soup.select_one("#dic_area")
    if node:
        return node.get_text("\n", strip=True)

    node = soup.select_one("#newsct_article")
    if node:
        return node.get_text("\n", strip=True)

    return ""


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
}

TIMEOUT = aiohttp.ClientTimeout(total=30, sock_connect=7, sock_read=12)


async def fetch_article(
    session: aiohttp.ClientSession, url: str, retry: int = 2
) -> tuple[Optional[datetime], str, str]:
    """
    개별 기사에서 (published_at, title, content)만 추출

    정책:
    - excerpt는 저장 정책에서 제외(미사용)하므로 여기서 만들지 않음
    - clean 계열도 전처리 단계에서 만들 예정이므로 여기서 만들지 않음
    """
    norm_url = _normalize_article_url(url)
    if not norm_url:
        return None, "", ""

    for attempt in range(retry + 1):
        try:
            # 너무 공격적으로 요청하지 않도록 아주 작은 지터
            await asyncio.sleep(random.uniform(0.02, 0.12))

            html_text = await _fetch_html(session, norm_url)
            soup = BeautifulSoup(html_text, "html.parser")

            title = _extract_title(soup)
            published_at = _extract_published_at(soup)
            content = _extract_content(soup)

            # 제목/본문이 모두 비어있으면 실패로 보고 재시도
            if not title and not content:
                raise RuntimeError("empty title/content (blocked/dom changed)")

            return published_at, title, content

        except RetryableHttpError:
            if attempt >= retry:
                return None, "", ""
            # 403/429/5xx는 충분히 쉬었다가 재시도(지수 백오프 + 지터)
            await asyncio.sleep(0.9 * (2**attempt) + random.uniform(0.2, 0.6))

        except Exception:
            if attempt >= retry:
                return None, "", ""
            await asyncio.sleep(0.6 * (2**attempt) + random.uniform(0.0, 0.4))

    return None, "", ""


async def crawl_article_contents_async(
    links_by_press: Dict[str, Dict[str, List[str]]],
) -> Dict[str, Dict[str, List[tuple[Optional[datetime], str, str]]]]:
    """
    입력:
      links_by_press = {press: {keyword: [article_url, ...]}}
    출력:
      parsed_by_press = {press: {keyword: [(published_at, title, content), ...]}}

    개선 포인트:
    - 전체 URL을 큐에 넣고 워커가 소비(Queue+worker)하여 press/keyword 간 동시성이 고르게 분산됨
    - URL 전역 캐시 + inflight 공유로 동일 URL 중복 요청을 방지
    """
    empty: tuple[Optional[datetime], str, str] = (None, "", "")
    parsed_by_press: Dict[str, Dict[str, List[tuple[Optional[datetime], str, str]]]] = {}

    queue: asyncio.Queue[tuple[str, str, int, str]] = asyncio.Queue()

    total_jobs = 0
    for press, kw_dict in links_by_press.items():
        parsed_by_press[press] = {}
        for kw, urls in kw_dict.items():
            parsed_by_press[press][kw] = [empty] * len(urls)
            for idx, url in enumerate(urls):
                queue.put_nowait((press, kw, idx, url))
                total_jobs += 1

    connector = aiohttp.TCPConnector(
        limit=HTTP_CONN_LIMIT,
        limit_per_host=HTTP_CONN_LIMIT_PER_HOST,
        ttl_dns_cache=300,
        enable_cleanup_closed=True,
    )

    cache_lock = asyncio.Lock()
    cache: dict[str, tuple[Optional[datetime], str, str]] = {}
    inflight: dict[str, asyncio.Future[tuple[Optional[datetime], str, str]]] = {}

    async def get_or_fetch(
        session: aiohttp.ClientSession, url: str
    ) -> tuple[Optional[datetime], str, str]:
        """
        동일 URL에 대해:
        - 최초 1명만 fetch 수행(owner)
        - 나머지는 inflight Future를 await
        """
        norm = _normalize_article_url(url)
        if not norm:
            return empty

        owner = False
        fut: asyncio.Future[tuple[Optional[datetime], str, str]]

        async with cache_lock:
            cached = cache.get(norm)
            if cached is not None:
                return cached

            existing = inflight.get(norm)
            if existing is None:
                fut = asyncio.get_running_loop().create_future()
                inflight[norm] = fut
                owner = True
            else:
                fut = existing

        if owner:
            result = empty
            try:
                result = await fetch_article(session, norm)
            except Exception:
                result = empty
            finally:
                async with cache_lock:
                    cache[norm] = result
                    inflight.pop(norm, None)
                    if not fut.done():
                        fut.set_result(result)
            return result

        # owner가 아니라면 결과를 기다림
        try:
            return await fut
        except Exception:
            return empty

    async def worker(session: aiohttp.ClientSession) -> None:
        while True:
            try:
                press, kw, idx, url = await queue.get()
            except asyncio.CancelledError:
                return

            try:
                result = await get_or_fetch(session, url)
                parsed_by_press[press][kw][idx] = result
            except Exception:
                parsed_by_press[press][kw][idx] = empty
            finally:
                queue.task_done()

    if total_jobs == 0:
        return parsed_by_press

    async with aiohttp.ClientSession(headers=HEADERS, timeout=TIMEOUT, connector=connector) as session:
        worker_count = max(1, ARTICLE_CONCURRENCY)
        workers = [asyncio.create_task(worker(session)) for _ in range(worker_count)]

        await queue.join()

        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)

    return parsed_by_press


def _to_comment_url(article_url: str) -> str:
    """
    https://n.news.naver.com/mnews/article/001/001234
      -> https://n.news.naver.com/mnews/article/comment/001/001234
    """
    url = _normalize_article_url(article_url)
    if "article/comment" in url:
        return url
    return url.replace("article/", "article/comment/", 1)


def _collect_comments_on_current_page(driver: webdriver.Chrome) -> List[str]:
    """
    현재 로드된 댓글 페이지에서 댓글 텍스트들을 최대 MAX_COMMENTS_PER_ARTICLE까지 수집
    """
    collected_texts: List[str] = []
    collected = 0

    while True:
        try:
            comments = driver.find_elements(By.CLASS_NAME, "u_cbox_contents")
        except Exception:
            break

        for c in comments[collected:]:
            t = (c.text or "").strip()
            if t:
                collected_texts.append(t)
                collected += 1
            if collected >= MAX_COMMENTS_PER_ARTICLE:
                break

        if collected >= MAX_COMMENTS_PER_ARTICLE:
            break

        try:
            more_button = driver.find_element(By.CLASS_NAME, "u_cbox_page_more")
            if more_button.is_displayed():
                driver.execute_script("arguments[0].click();", more_button)
                time.sleep(random.uniform(1.2, 1.8))
            else:
                break
        except Exception:
            break

    return collected_texts


def crawl_comments_for_press(
    task: Tuple[str, Dict[str, List[str]], bool]
) -> Tuple[str, Dict[str, Dict[str, List[str]]]]:
    """
    (멀티프로세싱 워커)
    언론사(press) 단위로 드라이버 1개를 재사용하면서,
    모든 키워드/URL의 댓글을 순회 수집한다.

    반환:
      (press, {keyword: {source_url: [댓글...]}})
    """
    press, kw_dict, headless = task

    options = _build_chrome_options(headless=headless)
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(40)
    driver.implicitly_wait(8)

    out: Dict[str, Dict[str, List[str]]] = {}

    try:
        for kw, urls in kw_dict.items():
            url_to_comments: Dict[str, List[str]] = {}

            for url in urls:
                src_url = _normalize_article_url(url)
                if not src_url:
                    continue

                comment_url = _to_comment_url(src_url)
                try:
                    driver.get(comment_url)
                except Exception:
                    url_to_comments[src_url] = []
                    continue

                # 댓글 영역 로딩 대기(짧게)
                time.sleep(random.uniform(1.2, 1.8))

                try:
                    collected_texts = _collect_comments_on_current_page(driver)
                except Exception:
                    collected_texts = []

                url_to_comments[src_url] = collected_texts

            out[kw] = url_to_comments

    finally:
        driver.quit()

    return press, out


def build_all_search_urls(
    *,
    keywords: List[str],
    start_date: str,
    end_date: str,
    start_page: int,
    end_page: int,
    press_codes: Dict[str, int],
) -> Dict[str, Tuple[int, Dict[str, List[str]]]]:
    """
    언론사별/키워드별 네이버 검색 페이지 URL 생성
    반환:
      {press_name: (press_id, {keyword: [search_urls...]})}
    """
    out: Dict[str, Tuple[int, Dict[str, List[str]]]] = {}
    for press_name, press_id in press_codes.items():
        kw_to_urls: Dict[str, List[str]] = {}
        for kw in keywords:
            kw_to_urls[kw] = make_search_urls_for_press(
                query=kw,
                press_id=press_id,
                start_page=start_page,
                end_page=end_page,
                start_date=start_date,
                end_date=end_date,
            )
        out[press_name] = (press_id, kw_to_urls)
    return out


def run_search_phase(
    all_search_urls: Dict[str, Tuple[int, Dict[str, List[str]]]],
    *,
    processes: int,
    headless: bool,
) -> Dict[str, Dict[str, List[str]]]:
    """
    Selenium 검색 결과에서 기사 URL 수집
    반환:
      links_by_press = {press: {keyword: [article_urls...]}}
    """
    if processes <= 1:
        results = []
        for press_name, (press_id, kw_to_urls) in all_search_urls.items():
            results.append(crawl_article_links_for_press((press_name, press_id, kw_to_urls, headless)))
    else:
        from multiprocessing import get_context

        ctx = get_context("spawn")  # Windows 안정성
        tasks: List[Tuple[str, int, Dict[str, List[str]], bool]] = []
        for press_name, (press_id, kw_to_urls) in all_search_urls.items():
            tasks.append((press_name, press_id, kw_to_urls, headless))

        with ctx.Pool(processes=processes) as pool:
            results = pool.map(crawl_article_links_for_press, tasks)

    links_by_press: Dict[str, Dict[str, List[str]]] = {}
    for press_name, kw_to_links in results:
        links_by_press[press_name] = kw_to_links

    return links_by_press


def run_comment_phase(
    links_by_press: Dict[str, Dict[str, List[str]]],
    *,
    processes: int,
    headless: bool,
) -> Dict[str, Dict[str, Dict[str, List[str]]]]:
    """
    댓글 수집(선택)

    개선:
    - press 단위로 드라이버 1개를 재사용 (프로세스 수만큼만 브라우저)

    반환:
      comments_by_press = {press: {keyword: {source_url: [댓글...]}}}
    """
    if processes <= 1:
        results = []
        for press, kw_dict in links_by_press.items():
            results.append(crawl_comments_for_press((press, kw_dict, headless)))
    else:
        from multiprocessing import get_context

        ctx = get_context("spawn")
        tasks: List[Tuple[str, Dict[str, List[str]], bool]] = []
        for press, kw_dict in links_by_press.items():
            tasks.append((press, kw_dict, headless))

        with ctx.Pool(processes=processes) as pool:
            results = pool.map(crawl_comments_for_press, tasks)

    comments_by_press: Dict[str, Dict[str, Dict[str, List[str]]]] = {}
    for press, kw_to_url_comments in results:
        comments_by_press[press] = kw_to_url_comments

    return comments_by_press


def crawl_and_save_news_to_db(
    *,
    trend_run_seq: int,
    base_date: date,
    keywords: List[str],
    days_back: int = DEFAULT_DAYS_BACK,
    start_page: int = DEFAULT_START_PAGE,
    end_page: int = DEFAULT_END_PAGE,
    press_codes: Dict[str, int] = PRESS_CODES,
    headless: bool | None = None,
    search_processes: int | None = None,
    include_comments: bool = False,
    comment_processes: int | None = None,
    refresh_same_run: bool = False,
) -> Dict[str, Any]:
    """
    전체 실행:
      1) (언론사별/키워드별) 검색 URL 생성
      2) 기사 URL 수집
      3) 기사 본문/제목/날짜 수집(aiohttp)
      4) (선택) 댓글 수집(selenium) - 샘플링 가능
      5) DB 적재(T_NEWS_ARTICLE, 선택: T_ARTICLE_COMMENT)

    저장 정책:
    - 크롤링 단계에서는 원문(title/content_text)만 저장하고,
      title_clean/content_clean/preprocessed_at는 NULL로 둔다(전처리 단계에서 채움).

    반환: 간단 통계(dict)
    """
    if headless is None:
        headless = bool(getattr(settings, "headless", True))

    if search_processes is None:
        search_processes = int(getattr(settings, "news_search_processes", 3))

    if comment_processes is None:
        comment_processes = int(getattr(settings, "news_comment_processes", 3))

    start_date, end_date = _date_range_app_tz(base_date=base_date, days_back=days_back)

    all_search_urls = build_all_search_urls(
        keywords=keywords,
        start_date=start_date,
        end_date=end_date,
        start_page=start_page,
        end_page=end_page,
        press_codes=press_codes,
    )

    t0 = time.time()
    links_by_press = run_search_phase(all_search_urls, processes=search_processes, headless=headless)
    t1 = time.time()

    parsed_by_press = asyncio.run(crawl_article_contents_async(links_by_press))
    t2 = time.time()

    comments_by_press: Optional[Dict[str, Dict[str, Dict[str, List[str]]]]] = None

    # 댓글 수집 대상 샘플링(언론사×키워드 기준)
    comment_target_count = 0
    comment_total_candidates = 0

    if include_comments:
        sampled_links_by_press: Dict[str, Dict[str, List[str]]] = {}
        for press_name, kw_dict in links_by_press.items():
            sampled_links_by_press[press_name] = {}
            for kw, urls in kw_dict.items():
                candidates = [_normalize_article_url(u) for u in urls if _normalize_article_url(u)]
                comment_total_candidates += len(candidates)

                sampled = _sample_urls_for_comments(
                    candidates, rate=COMMENT_SAMPLE_RATE, min_count=COMMENT_SAMPLE_MIN
                )
                sampled_links_by_press[press_name][kw] = sampled
                comment_target_count += len(sampled)

        comments_by_press = run_comment_phase(
            sampled_links_by_press, processes=comment_processes, headless=headless
        )

    t3 = time.time()

    # DB 적재용으로 평탄화
    articles: List[CrawledArticle] = []
    comment_bundles: List[CrawledCommentBundle] = []

    for press_name, kw_dict in links_by_press.items():
        media_code = press_codes.get(press_name)
        if media_code is None:
            continue

        for kw, urls in kw_dict.items():
            parsed_list = parsed_by_press.get(press_name, {}).get(kw, [])
            url_to_comments: Optional[Dict[str, List[str]]] = None
            if include_comments and comments_by_press is not None:
                url_to_comments = comments_by_press.get(press_name, {}).get(kw, {})

            for i, url in enumerate(urls):
                published_at, title, content = (
                    parsed_list[i] if i < len(parsed_list) else (None, "", "")
                )

                src_url = _normalize_article_url(url)

                art = CrawledArticle(
                    keyword_name=kw,
                    trend_run_seq=trend_run_seq,
                    media_code=media_code,
                    source_url=src_url,
                    published_at=published_at,
                    title=title,
                    content_text=content,
                    title_clean=None,
                    content_clean=None,
                    preprocessed_at=None,
                )
                articles.append(art)

                if include_comments and url_to_comments is not None and src_url:
                    comments = url_to_comments.get(src_url)
                    if comments is not None:
                        comment_bundles.append(
                            CrawledCommentBundle(
                                keyword_name=kw,
                                trend_run_seq=trend_run_seq,
                                media_code=media_code,
                                source_url=src_url,
                                comments=comments,
                            )
                        )

    stats = persist_articles(
        articles=articles,
        comment_bundles=comment_bundles if include_comments else None,
        refresh_same_run=refresh_same_run,
    )

    stats["timing_seconds"] = {
        "search_links": round(t1 - t0, 2),
        "fetch_articles": round(t2 - t1, 2),
        "fetch_comments": round(t3 - t2, 2),
        "total": round(time.time() - t0, 2),
    }
    stats["runtime_config"] = {
        "article_concurrency": ARTICLE_CONCURRENCY,
        "http_conn_limit": HTTP_CONN_LIMIT,
        "http_conn_limit_per_host": HTTP_CONN_LIMIT_PER_HOST,
        "max_comments_per_article": MAX_COMMENTS_PER_ARTICLE,
        "search_processes": search_processes,
        "comment_processes": comment_processes if include_comments else 0,
        "comment_sample_rate": COMMENT_SAMPLE_RATE if include_comments else 0.0,
        "comment_sample_min": COMMENT_SAMPLE_MIN if include_comments else 0,
        "comment_candidates": comment_total_candidates if include_comments else 0,
        "comment_targets": comment_target_count if include_comments else 0,
        "comment_sample_mode": "stable_hash_topk" if include_comments else "off",
    }
    return stats


# ───────────────────────────────────────────────────────────────
# 단독 실행(디버그용)
# ───────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class RunConfig:
    trend_run_seq: int
    base_date: date
    days_back: int
    start_page: int
    end_page: int
    show_browser: bool
    search_proc: int
    include_comments: bool
    comment_proc: int
    refresh_same_run: bool


def parse_args() -> RunConfig:
    p = argparse.ArgumentParser(description="네이버 뉴스 수집 -> DB 적재")
    p.add_argument("--trend-run-seq", type=int, required=True, help="T_TREND_RUN의 TREND_RUN_SEQ")
    p.add_argument("--base-date", default=None, help="기준일(YYYY-MM-DD). 미입력 시 APP_TZ 오늘")
    p.add_argument("--days-back", type=int, default=DEFAULT_DAYS_BACK, help="조회 기간(기준일 기준 N일 전부터)")
    p.add_argument("--start-page", type=int, default=DEFAULT_START_PAGE, help="검색 시작 페이지(1부터)")
    p.add_argument("--end-page", type=int, default=DEFAULT_END_PAGE, help="검색 종료 페이지(1부터)")
    p.add_argument("--show-browser", action="store_true", help="Selenium 브라우저 창 표시(디버그)")
    p.add_argument("--search-proc", type=int, default=2, help="검색 URL 수집 프로세스 수")
    p.add_argument("--include-comments", action="store_true", help="댓글도 수집/저장")
    p.add_argument("--comment-proc", type=int, default=2, help="댓글 수집 프로세스 수")
    p.add_argument(
        "--refresh-same-run",
        action="store_true",
        help="같은 trend_run_seq 재실행 시 해당 회차 기사/댓글을 삭제 후 재삽입",
    )
    args = p.parse_args()

    if args.base_date:
        bd = datetime.strptime(args.base_date, "%Y-%m-%d").date()
    else:
        bd = _app_now().date()

    return RunConfig(
        trend_run_seq=int(args.trend_run_seq),
        base_date=bd,
        days_back=int(args.days_back),
        start_page=int(args.start_page),
        end_page=int(args.end_page),
        show_browser=bool(args.show_browser),
        search_proc=int(args.search_proc),
        include_comments=bool(args.include_comments),
        comment_proc=int(args.comment_proc),
        refresh_same_run=bool(args.refresh_same_run),
    )


def main() -> None:
    cfg = parse_args()

    # 이번 TREND_RUN에 속한 키워드를 DB에서 가져옴(랭크 순)
    kw_rows = fetch_keywords_for_trend_run(cfg.trend_run_seq)
    keywords = [r.keyword_name for r in kw_rows]

    if not keywords:
        raise RuntimeError("trend_run_seq에 해당하는 키워드를 찾지 못했습니다. T_TREND_KEYWORD 데이터를 확인하세요.")

    stats = crawl_and_save_news_to_db(
        trend_run_seq=cfg.trend_run_seq,
        base_date=cfg.base_date,
        keywords=keywords,
        days_back=cfg.days_back,
        start_page=cfg.start_page,
        end_page=cfg.end_page,
        press_codes=PRESS_CODES,
        headless=not cfg.show_browser,
        search_processes=cfg.search_proc,
        include_comments=cfg.include_comments,
        comment_processes=cfg.comment_proc,
        refresh_same_run=cfg.refresh_same_run,
    )

    print("DB 적재 완료")
    print(stats)


if __name__ == "__main__":
    main()
