# Newsight

Newsight는 트렌드 키워드와 뉴스 데이터를 수집하고, 이를 바탕으로 키워드 상세 분석과 언론사 비교 분석을 제공하는 뉴스 빅데이터 서비스입니다.

프로젝트는 다음 세 부분으로 구성되어 있습니다.

- `backend`: Spring Boot 기반 API 서버
- `data-pipeline`: Python 기반 수집·전처리·분석 배치
- `frontend`: React 기반 사용자 화면

## 프로젝트 개요

- Google Trends에서 실시간 인기 키워드를 수집합니다.
- 수집된 키워드를 기준으로 Naver 뉴스 기사와 댓글 일부를 수집합니다.
- 기사/댓글 전처리 후 기사량 집계, 최종 순위, AI 요약, 감성분석, 언론사 편향도 비교, 워드클라우드, 공동언급 네트워크, 검색 관심도 흐름 데이터를 생성합니다.
- 워드클라우드와 공동언급 네트워크 분석에서는 보호 단어 파일을 통해 고유명사와 복합어가 형태소 분석 과정에서 불필요하게 분리되지 않도록 관리합니다.
- 검색 관심도 흐름 데이터는 Naver DataLab Open API를 기준으로 수집합니다.
- 분석 결과는 MySQL에 저장되고, backend API를 통해 frontend에 제공됩니다.

## 핵심 기능

### 1. 계정 및 관리자 기능

- 회원가입 사전 검증
- localStorage + in-memory Access Token, HttpOnly Refresh Cookie 기반 인증
- 로그인 기록 관리
- 아이디 찾기 / 임시 비밀번호 발급 / 비밀번호 변경
- 관리자 대시보드 요약
- 문의 게시판 및 처리 상태 관리

### 2. 뉴스 분석 기능

- 최종 순위 기준 상위 키워드 조회
- 키워드 상세 페이지에서 키워드 메타 정보, AI 요약, 검색 관심도 흐름 차트 제공
- 키워드 상세 페이지에서 본문 감성분석, 제목 워드클라우드, 댓글 워드클라우드, 공동언급 네트워크 제공
- 언론사 비교 페이지에서 기사량 비교 제공
- 언론사 비교 페이지에서 제목 편향도 비교 제공
- 언론사 비교 페이지에서 감성 비교와 대표 단어 비교 제공

### 3. 데이터 파이프라인

- Google Trends 키워드 크롤링
- 검색 관심도 타임라인 수집
- Naver 뉴스 기사/댓글 수집
- 공통 전처리
- 기사량 집계
- 최종 순위 재산정
- AI 요약 생성
- 감성 / 편향 / 워드클라우드 / 공동언급 네트워크 분석
- 워드클라우드·공동언급 네트워크 보호 단어 관리

## 아키텍처

```text
[Google Trends] ----\
                     \
                      > [Python Data Pipeline] --> [MySQL] --> [Spring Boot API] --> [React Frontend]
                     /
[Naver News] -------/

[Naver DataLab Open API] --> [Python Data Pipeline]
```

## 기술 스택

### Backend

- Java 21
- Spring Boot 3.5.10
- Spring Web
- Spring Security
- OAuth2 Resource Server
- JJWT
- Spring Data JPA
- Spring Validation
- Spring Mail
- Flyway
- MySQL

### Frontend

- React 19
- TypeScript
- Vite 7
- React Router 7
- Axios
- Chart.js
- D3 Force / D3 Cloud

### Data Pipeline

- Python 3.11
- PyMySQL
- pandas / numpy
- selenium / beautifulsoup4 / aiohttp
- KoNLPy Komoran
- transformers / torch
- OpenAI Python SDK
- Naver DataLab Open API
- networkx
- requests

## 저장소 구조

```text
graduation-project/
├─ backend/         # Spring Boot API 서버
├─ data-pipeline/   # 데이터 수집 / 분석 배치
├─ frontend/        # React 클라이언트
└─ README.md
```

## DB 구성

계정/문의 관련 스키마는 backend의 Flyway가 관리하고, 분석 관련 데이터는 data-pipeline이 MySQL에 적재합니다.

주요 수집/분석 테이블은 다음과 같습니다.

- `T_NEWS_MEDIA`
- `T_TREND_RUN`
- `T_TREND_KEYWORD_MASTER`
- `T_TREND_KEYWORD_SNAPSHOT`
- `T_NEWS_ARTICLE`
- `T_NEWS_COMMENT`
- `T_ANALYZE_MEDIA_STAT`
- `T_TREND_KEYWORD_FINAL_RANK`
- `T_ANALYZE_AI_SUMMARY`
- `T_ANALYZE_AI_SUMMARY_ARTICLE`
- `T_ANALYZE_SEARCH_TIMELINE`
- `T_ANALYZE_SENTIMENT`
- `T_ANALYZE_MEDIA_BIAS`
- `T_ANALYZE_WORDCLOUD`
- `T_ANALYZE_WORDCLOUD_ITEM`
- `T_ANALYZE_CO_MENTION_GRAPH`
- `T_ANALYZE_CO_MENTION_NODE`
- `T_ANALYZE_CO_MENTION_EDGE`

새 환경에서는 `data-pipeline/db/schema.sql`에 정의된 분석 테이블들이 DB에 반영되어 있어야 합니다.

## 로컬 실행 방법

### 1. MySQL 실행

```bash
cd data-pipeline
docker compose up -d
```

기본 포트는 `3307`입니다.

### 2. Backend 실행

Linux/macOS:

```bash
cd backend
./gradlew bootRun
```

Windows:

```powershell
cd backend
.\gradlew.bat bootRun
```

기본 포트는 `8080`입니다.

### 3. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

기본 포트는 `5173`입니다.

### 4. Data Pipeline 전체 실행

```bash
cd data-pipeline
pip install -r requirements.txt
python -m src.jobs.run_all
```

## 개별 배치 수동 실행

예시:

```bash
cd data-pipeline

python -m src.crawler.trend.jobs.run_trend
python -m src.crawler.news.jobs.run_news
python -m src.preprocess.jobs.run_preprocess
python -m src.analyzer.aggregate.jobs.run_aggregate
python -m src.analyzer.final_rank.jobs.run_final_rank
python -m src.analyzer.summary.jobs.run_summary
python -m src.analyzer.sentiment.title.jobs.run_title_sentiment
python -m src.analyzer.sentiment.content.jobs.run_content_sentiment
python -m src.analyzer.bias.title.jobs.run_title_bias
python -m src.analyzer.bias.content.jobs.run_content_bias
python -m src.analyzer.wordcloud.jobs.run_wordcloud
python -m src.analyzer.cooc_network.jobs.run_cooc_network
python -m src.analyzer.search_timeline.jobs.run_search_timeline
```

특정 트렌드 회차를 직접 지정하고 싶다면:

```bash
python -m src.analyzer.search_timeline.jobs.run_search_timeline --trend-run-seq 22
```

## 환경변수 예시

### Backend

```env
DB_HOST=localhost
DB_PORT=3307
DB_NAME=newsight
DB_USER=newsight
DB_PASSWORD=newspass

JWT_SECRET=change-me-please-32bytes-minimum
JWT_ISSUER=newsight
JWT_AUDIENCE=newsight

APP_PRECHECK_SECRET=change-me-precheck-secret
APP_ALLOWED_EMAIL_DOMAINS=gmail.com,naver.com,kakao.com
```

메일 기능을 사용할 경우:

```env
SPRING_MAIL_HOST=smtp.naver.com
SPRING_MAIL_PORT=465
SPRING_MAIL_USERNAME=your-account
SPRING_MAIL_PASSWORD=your-app-password
APP_MAIL_FROM=your-account
```

### Frontend

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

### Data Pipeline

`data-pipeline`은 설정을 두 파일로 나눠 관리합니다.

- `data-pipeline/config/pipeline.env`: 공용 튜닝값 / 기본 실행값
- `data-pipeline/.env`: 민감값 / 로컬·서버별 override 값

`settings.py`는 `config/pipeline.env`를 먼저 읽고, 이후 `.env`를 읽어 같은 키를 덮어씁니다.

공용 튜닝값 예시(`data-pipeline/config/pipeline.env`):

```env
RUN_ALL_STEPS=trend,news,preprocess,aggregate,final_rank,summary,title_sentiment,content_sentiment,title_bias,content_bias,wordcloud,cooc_network,search_timeline
RUN_ALL_FAIL_FAST=1
HEADLESS=1

WORDCLOUD_STOPWORDS_FILE=./src/analyzer/wordcloud/stopwords.txt
WORDCLOUD_PROTECTED_TERMS_FILE=./src/analyzer/wordcloud/protected_terms.txt
WORDCLOUD_REFRESH=1
COOC_REFRESH=1

SEARCH_TIMELINE_KEYWORD_TOP_N=0
SEARCH_TIMELINE_BATCH_SIZE=0
SEARCH_TIMELINE_REFRESH=1
SEARCH_TIMELINE_TIMEFRAME=today 3-m
SEARCH_TIMELINE_SLEEP_MIN_SECONDS=0.2
SEARCH_TIMELINE_SLEEP_MAX_SECONDS=0.5

NAVER_DATALAB_CLIENT_ID=
NAVER_DATALAB_CLIENT_SECRET=
NAVER_DATALAB_DEVICE=
NAVER_DATALAB_GENDER=
NAVER_DATALAB_AGES=
NAVER_DATALAB_REQUEST_TIMEOUT_SECONDS=20
```

민감값 / 환경별 override 예시(`data-pipeline/.env`):

```env
APP_ENV=local
TZ=Asia/Seoul

DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=newsight
DB_USER=newsight
DB_PASSWORD=newspass

OPENAI_API_KEY=your-openai-api-key
NAVER_DATALAB_CLIENT_ID=
NAVER_DATALAB_CLIENT_SECRET=
```

`NAVER_DATALAB_DEVICE`, `NAVER_DATALAB_GENDER`, `NAVER_DATALAB_AGES`를 비워두면 전체 조건으로 조회합니다.

권장 운영 방식:

- `config/pipeline.env`는 git으로 공유
- `.env`는 git에 올리지 않고 로컬/서버마다 별도로 관리

## 워드클라우드 / 관계도 보호 단어

- `data-pipeline/src/analyzer/wordcloud/protected_terms.txt`에 한 줄에 하나씩 보존할 단어를 입력합니다.
- 파일 경로는 `WORDCLOUD_PROTECTED_TERMS_FILE` 환경변수로 지정하며, 상대경로는 `data-pipeline` 루트를 기준으로 해석됩니다.
- 보호 단어는 Komoran 형태소 분석 전에 먼저 추출되므로 `SK 하이닉스`, `삼성 전자`처럼 공백이 포함된 표현도 한 단어로 유지할 수 있습니다.
- 워드클라우드와 공동언급 네트워크는 같은 토큰화 로직을 사용하므로 보호 단어 설정이 두 분석에 함께 적용됩니다.
- 기존 분석 결과를 다시 반영하려면 워드클라우드는 `WORDCLOUD_REFRESH=1`, 관계도는 `COOC_REFRESH=1`로 설정한 뒤 해당 배치를 재실행합니다.

## 검색 관심도 타임라인

- 검색 관심도 흐름은 키워드 상세 분석의 기본 구성 요소 중 하나입니다.
- 수집 배치는 `run_search_timeline`이며, Naver DataLab Open API 응답을 `T_ANALYZE_SEARCH_TIMELINE`에 저장합니다.
- backend는 `NAVER_DATALAB` source 기준으로 검색 관심도 데이터를 조회합니다.
- 점수는 절대 검색량이 아니라 해당 기간 안에서 정규화된 상대 관심도(0~100)입니다.
- 프론트에서는 최근 3개월 기준 라인 차트와 최신 점수, 기간 최고점, 기간 평균을 함께 제공합니다.
- 일 단위 데이터는 제공 시점에 따라 당일이 아니라 전날까지 내려올 수 있습니다.

## 참고 사항

- 실시간 키워드 수집은 Google Trends 기반입니다.
- 뉴스 수집은 Naver 뉴스 검색 결과 기반입니다.
- 검색 관심도 흐름은 Naver 데이터 랩 검색 관심도 API 기반입니다.
- frontend에서 표시하는 타임라인 기간은 최근 3개월 고정입니다.

## 향후 개선 과제

- API 문서 정리
- 테스트 보강
- 배치 운영 가이드 보강
- 배포 환경 마이그레이션 자동화
- 분석 결과 설명 문구 개선
