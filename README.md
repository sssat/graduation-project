# Newsight

Newsight는 실시간 이슈 키워드와 뉴스 데이터를 수집하고, 키워드별 기사량, 감성, 편향, 워드클라우드, 공동 언급 네트워크, 검색 관심도 흐름을 제공하는 뉴스 빅데이터 분석 서비스입니다.

프로젝트는 세 영역으로 나뉩니다.

- `backend`: Spring Boot 기반 REST API 서버
- `frontend`: React 기반 사용자/관리자 화면
- `data-pipeline`: Python 기반 키워드 수집, 뉴스 크롤링, 분석 배치

## 주요 기능

### 사용자 기능

- 실시간 이슈 키워드 기반 뉴스 분석 조회
- 키워드 상세 분석: 기사 수, 언론사 수, AI 요약, 검색 관심도, 감성 분석, 워드클라우드, 공동 언급 네트워크
- 언론사 비교 분석: 기사량, 감성, 제목 편향, 프레이밍 단어 비교
- 회원가입, 로그인, 아이디 찾기, 임시 비밀번호 발급, 비밀번호 변경
- 문의 게시판 작성 및 답변 확인

### 관리자 기능

- 관리자 대시보드 요약
  - 오늘 가입자 수
  - 오늘 고유 방문자 수
  - 오늘 수집 기사 수
  - 처리 중 문의 수
- 방문자 기록 조회
- 로그인 시도 기록 조회
- 문의 답변 등록/수정/삭제
- 관리자 사용자 관리

### 데이터 파이프라인

- Google Trends 키워드 수집
- Naver News 기사/댓글 수집
- 기사/댓글 전처리
- 키워드별 기사량 집계
- 최종 키워드 순위 산정
- OpenAI API 기반 AI 요약 생성
- 제목/본문 감성 분석
- 제목/본문 편향 분석
- 제목/댓글 워드클라우드 생성
- 공동 언급 네트워크 생성
- Naver DataLab 기반 검색 관심도 시계열 수집

## 아키텍처

```text
사용자 / 관리자
      │
      ▼
Nginx ──> React 정적 빌드
      │
      └─ /api ─> Spring Boot API ─> MySQL
                     ▲              ▲
                     │              │
Google Trends ─┐     │              │
Naver News ────┼─────┴─> Python Data Pipeline
Naver DataLab ─┤
OpenAI API ────┘
```

운영 서버는 React 빌드 결과를 Nginx가 정적 파일로 제공하고, `/api` 요청은 Spring Boot API로 전달합니다. 데이터 파이프라인은 별도 EC2에서 실행되며 수집/분석 결과를 같은 MySQL 스키마에 저장합니다.

방문자 기록은 프론트엔드의 `VisitTracker`가 `POST /api/public/visits`로 전송하고, 백엔드는 `T_DAILY_VISITOR`에 일자별 고유 방문자와 Page View를 누적합니다.

상세 설계 다이어그램은 다음 문서에 정리되어 있습니다.

```text
docs/architecture-draft.md
```

## 기술 스택

### Backend

- Java 21
- Spring Boot 3.5.10
- Spring Web
- Spring Security
- OAuth2 Resource Server
- Spring Data JPA
- Spring JDBC
- Flyway
- Spring Mail
- Springdoc OpenAPI
- JJWT
- MySQL Connector/J
- Gradle

### Frontend

- React 19.2
- TypeScript 5.9
- Vite 7.2
- React Router 7.10
- Axios
- Chart.js
- D3 Force
- D3 Cloud

### Data Pipeline

- Python 3.11
- PyMySQL
- pandas / numpy
- requests / aiohttp / beautifulsoup4 / selenium
- KoNLPy Komoran / JPype1
- Hugging Face Transformers
- PyTorch CPU
- OpenAI Python SDK
- Naver DataLab Open API

### Infra

- Ubuntu EC2
- MySQL 8.0
- Docker Compose
- Nginx 정적 파일 배포
- Git / GitHub

## 저장소 구조

```text
graduation-project/
├─ backend/         # Spring Boot API 서버
├─ frontend/        # React 프론트엔드
├─ data-pipeline/   # 데이터 수집/분석 배치
├─ docs/            # API/아키텍처 문서
├─ tools/           # 보조 도구
└─ README.md
```

## 주요 화면 라우트

| 경로 | 설명 |
| --- | --- |
| `/` | 메인 분석 화면 |
| `/keywords/:keyword` | 키워드 상세 분석 |
| `/media` | 언론사 비교 분석 |
| `/inquiries` | 문의 게시판 |
| `/auth/login` | 로그인 |
| `/auth/signup` | 회원가입 |
| `/auth/find-id` | 아이디 찾기 |
| `/auth/find-password` | 임시 비밀번호 발급 |
| `/auth/change-password` | 비밀번호 변경 |
| `/admin` | 관리자 대시보드 |
| `/admin/users` | 관리자 사용자 관리 |

## DB 구성

`backend`는 Flyway로 계정, 문의, 방문자 추적 등 애플리케이션 스키마를 관리합니다.

현재 Flyway 마이그레이션:

- `V1__create_accounts_tables.sql`
- `V2__create_inquiries_tables.sql`
- `V3__add_refresh_token_version.sql`
- `V4__add_trend_run_publish_status.sql`
- `V5__create_daily_visitors_table.sql`

주요 테이블:

- `T_USER_LEVEL`
- `T_USER`
- `T_LOGIN_LOG`
- `T_INQUIRY`
- `T_DAILY_VISITOR`
- `T_TREND_RUN`
- `T_TREND_KEYWORD_MASTER`
- `T_TREND_KEYWORD_SNAPSHOT`
- `T_NEWS_ARTICLE`
- `T_NEWS_COMMENT`
- `T_ANALYZE_MEDIA_STAT`
- `T_TREND_KEYWORD_FINAL_RANK`
- `T_ANALYZE_AI_SUMMARY`
- `T_ANALYZE_SEARCH_TIMELINE`
- `T_ANALYZE_SENTIMENT`
- `T_ANALYZE_MEDIA_BIAS`
- `T_ANALYZE_WORDCLOUD`
- `T_ANALYZE_CO_MENTION_GRAPH`

분석 관련 테이블은 `data-pipeline/db/schema.sql`에 정의되어 있습니다.

## 로컬 실행

### 1. MySQL 실행

```bash
cd data-pipeline
docker compose up -d
```

기본 DB 접속 정보:

```text
host: localhost
port: 3307
database: newsight
user: newsight
password: newspass
```

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

Swagger UI:

```text
http://localhost:8080/api/docs
```

### 3. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

기본 포트는 `5173`입니다.

### 4. Data Pipeline 실행

```bash
cd data-pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.jobs.run_all
```

Windows PowerShell:

```powershell
cd data-pipeline
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m src.jobs.run_all
```

중간 단계부터 복구 실행:

```bash
python -m src.jobs.run_all --resume-latest-unpublished --from-step wordcloud
```

## 개별 배치 실행

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

특정 분석 run을 지정하려면:

```bash
python -m src.analyzer.search_timeline.jobs.run_search_timeline --trend-run-seq 147
```

## EC2 크론 배치

EC2에서는 다음 쉘 스크립트로 전체 파이프라인을 실행할 수 있습니다.

```text
data-pipeline/scripts/run_all_cron.sh
```

주요 동작:

- 로그 파일 생성: `data-pipeline/logs/run_all_cron_YYYY-MM-DD_HHMMSS.log`
- 중복 실행 방지: `flock` 기반 lock 파일 사용
- 기본 타임아웃: `BATCH_TIMEOUT_SECONDS=21600`초, 즉 6시간
- 기본 자동 종료: `AUTO_STOP_EC2_AFTER_BATCH=1`
- 배치 종료 후 EC2 내부에서 `shutdown -h now` 실행

자동 종료를 끄려면:

```bash
AUTO_STOP_EC2_AFTER_BATCH=0 /opt/graduation-project/data-pipeline/scripts/run_all_cron.sh
```

타임아웃을 바꾸려면:

```bash
BATCH_TIMEOUT_SECONDS=10800 /opt/graduation-project/data-pipeline/scripts/run_all_cron.sh
```

## 환경 변수

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
JWT_ACCESS_MINUTES=30
JWT_REFRESH_MINUTES=60

APP_PRECHECK_SECRET=change-me-precheck-secret
APP_ALLOWED_EMAIL_DOMAINS=gmail.com,naver.com,kakao.com
ANALYTICS_TREND_RUN_OFFSET=0
```

메일 기능:

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

운영 환경에서는 실제 API 주소를 지정합니다.

```env
VITE_API_BASE_URL=https://newsightkr.com/api
```

### Data Pipeline

`data-pipeline/config/pipeline.env`는 공용 기본값을 관리하고, `data-pipeline/.env`는 로컬/서버별 민감값과 override를 관리합니다.

주요 설정:

```env
APP_ENV=local
TZ=Asia/Seoul

DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=newsight
DB_USER=newsight
DB_PASSWORD=newspass

OPENAI_API_KEY=your-openai-api-key
NAVER_DATALAB_CLIENT_ID=your-client-id
NAVER_DATALAB_CLIENT_SECRET=your-client-secret

RUN_ALL_STEPS=trend,news,preprocess,aggregate,final_rank,summary,title_sentiment,content_sentiment,title_bias,content_bias,wordcloud,cooc_network,search_timeline
RUN_ALL_FAIL_FAST=1
HEADLESS=1

WORDCLOUD_STOPWORDS_FILE=./src/analyzer/wordcloud/stopwords.txt
WORDCLOUD_PROTECTED_TERMS_FILE=./src/analyzer/wordcloud/protected_terms.txt
WORDCLOUD_REFRESH=1
COOC_REFRESH=1

SEARCH_TIMELINE_REFRESH=1
SEARCH_TIMELINE_TIMEFRAME=today 3-m
SEARCH_TIMELINE_SLEEP_MIN_SECONDS=0.2
SEARCH_TIMELINE_SLEEP_MAX_SECONDS=0.5
NAVER_DATALAB_REQUEST_TIMEOUT_SECONDS=20
```

## 배포

### Frontend 정적 파일 배포

EC2의 프론트엔드 소스를 최신화한 뒤 빌드합니다.

```bash
cd ~/graduation-project
git pull

cd frontend
npm install
npm run build

sudo rm -rf /var/www/newsight/*
sudo cp -a dist/. /var/www/newsight/
sudo chown -R www-data:www-data /var/www/newsight
sudo find /var/www/newsight -type d -exec chmod 755 {} \;
sudo find /var/www/newsight -type f -exec chmod 644 {} \;
```

배포 후 화면이 그대로라면 서버의 빌드 산출물과 브라우저 캐시를 확인합니다.

```bash
grep -R "Page View\|유입 경로" /var/www/newsight/assets/*.js
```

문자열이 나오는데 화면이 그대로면 브라우저 강력 새로고침을 합니다.

```text
Windows/Linux: Ctrl + Shift + R
macOS: Cmd + Shift + R
```

### Backend 배포 시 주의

Flyway가 켜져 있으므로 backend를 최신 코드로 재시작하면 누락된 마이그레이션이 반영됩니다.

방문자 기록 기능을 사용하려면 `V5__create_daily_visitors_table.sql`이 운영 DB에 적용되어야 합니다.

## 보호 단어 관리

워드클라우드와 공동 언급 네트워크 분석에서 고유명사나 복합명사가 부자연스럽게 쪼개지지 않도록 보호 단어 파일을 사용합니다.

```text
data-pipeline/src/analyzer/wordcloud/protected_terms.txt
```

설정값:

```env
WORDCLOUD_PROTECTED_TERMS_FILE=./src/analyzer/wordcloud/protected_terms.txt
```

기존 분석 결과에 다시 반영하려면:

```env
WORDCLOUD_REFRESH=1
COOC_REFRESH=1
```

## 검증 명령

Backend:

```bash
cd backend
./gradlew test --no-daemon
```

Windows:

```powershell
cd backend
.\gradlew.bat test --no-daemon
```

Frontend:

```bash
cd frontend
npm run build
```

Data Pipeline:

```bash
cd data-pipeline
python -m src.jobs.run_all --help
```

## 참고

- 데이터 파이프라인 결과는 수집 시점과 외부 API 응답 상태에 따라 달라질 수 있습니다.
- 검색 관심도는 절대 검색량이 아니라 Naver DataLab의 정규화된 상대 지표입니다.
- 방문자 수는 실제 사람 수가 아니라 브라우저 저장소 기반 익명 고유 방문자 수입니다.
- IP 주소와 User-Agent는 개인정보 또는 개인정보에 가까운 정보로 볼 수 있으므로 운영 시 보관 기간과 접근 권한을 관리해야 합니다.
