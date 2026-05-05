# data-pipeline/src/crawler/trend/core/trend.py
# 구글 트렌드에서 실시간 검색어를 크롤링하는 핵심 로직

from __future__ import annotations

from typing import List, Optional

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

from src.config.settings import settings


def crawl_trends(
    url: Optional[str] = None,
    top_n: int | None = None,
    headless: bool | None = None,
) -> List[str]:
    if url is None:
        url = settings.trends_url

    if top_n is None:
        # 기본값은 settings(.env)에서 제어
        top_n = settings.trend_top_n

    if headless is None:
        # 기본값은 settings(.env)에서 제어
        headless = settings.headless

    options = Options()
    options.add_argument("--lang=ko-KR")

    if headless:
        # EC2/서버 환경에서 안정적으로 돌아가게 하는 옵션들
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1280,720")

    driver = webdriver.Chrome(options=options)

    try:
        driver.get(url)

        row_xpath = "//*[@id='trend-table']//tbody[2]/tr"

        WebDriverWait(driver, settings.selenium_wait_seconds).until(
            EC.presence_of_element_located((By.XPATH, row_xpath))
        )

        rows = driver.find_elements(By.XPATH, row_xpath)

        keywords: List[str] = []
        for row in rows[: max(1, int(top_n))]:
            try:
                keyword = row.find_element(By.XPATH, "./td[2]/div[1]").text.strip()
            except Exception:
                continue

            if keyword:
                keywords.append(keyword)

        if not keywords:
            raise RuntimeError("트렌드 키워드를 가져오지 못했습니다. (DOM 변경/차단/로딩 실패 가능)")

        return keywords

    finally:
        driver.quit()


# if __name__ == "__main__": 이 파일을 이곳에서 직접 실행할 때만 돌아가는 실행 진입점(entrypoint)
# 로컬 테스트용 명령어: python -m src.crawler.trend.core.trend
# 만약 이 코드가 없으면 python -m src.crawler.trend.core.trend 명령어로는 실행해도 함수 호출이 없어서 아무 동작 없이 종료되기 때문에
# python -m src.crawler.trend.jobs.run_trend 와 같은 명령어로 실행해야한다.
# 하지만 if __name__ == "__main__" 블록에서 crawl_trends() 함수를 호출하기 때문에 python -m src.crawler.trend.core.trend와 같은 로컬 명령어로 단독 실행할 수 있다.
if __name__ == "__main__":
    items = crawl_trends()
    for i, kw in enumerate(items, start=1):
        print(i, kw)