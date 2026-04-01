# Newsight

뉴스 트렌드 데이터를 수집하고 분석한 뒤, 사용자에게 시각화된 인사이트를 제공하는 서비스입니다.  
이 저장소는 `Spring Boot` 기반 백엔드, `Python` 기반 데이터 파이프라인, `React` 기반 프론트엔드로 구성되어 있습니다.

## 프로젝트 개요

- 실시간 이슈 키워드를 수집하고 관련 뉴스 데이터를 적재합니다.
- 전처리 및 집계를 거쳐 요약, 감성 분석, 편향 분석, 워드클라우드, 공동 출현 네트워크 데이터를 생성합니다.
- 생성된 분석 결과를 백엔드 API로 제공하고, 프론트엔드에서 대시보드 형태로 시각화합니다.
- 회원가입, 로그인, 비밀번호 변경, 문의 게시판, 관리자 대시보드, 회원 관리 기능을 함께 제공합니다.

## 핵심 기능

### 1. 인증 및 계정 관리

- 회원가입 전 `아이디/이메일 사전 검증` 제공
- JWT Access Token + `HttpOnly Refresh Cookie` 기반 인증 처리
- 로그인 기록 저장
- 아이디 찾기, 임시 비밀번호 발급, 비밀번호 변경 지원
- 사용자, 관리자, 슈퍼관리자 권한 분리

### 2. 관리자 기능

- 관리자 대시보드 요약 지표 제공
- 회원 목록 조회
- 관리자 권한 승급/강등
- 사용자 강제 탈퇴
- 문의 게시글 답변 및 처리 상태 관리

### 3. 뉴스 분석 기능

- 인기 키워드 TOP 조회
- 키워드별 기사 수, 언론사 수, 기간 정보 제공
- AI 요약 제공
- 제목/댓글 워드클라우드 제공
- 본문 감성 분석 제공
- 언론사별 제목 편향 분석 제공
- 공동 출현 네트워크 제공
- 언론사 비교 페이지용 기사 수/감성/상위 단어 API 제공

### 4. 데이터 파이프라인

- 트렌드 키워드 수집
- 키워드별 뉴스 기사/댓글 수집
- 전처리 및 집계
- 최종 랭킹 산출
- OpenAI 기반 요약 생성
- 감성/편향/워드클라우드/공동 출현 분석 배치 실행

## 아키텍처

```text
[Google Trends / News Source]
            |
            v
[Python Data Pipeline]
  - trend crawler
  - news crawler
  - preprocess
  - aggregate/final_rank
  - summary/sentiment/bias/wordcloud/cooc
            |
            v
        [MySQL]
            ^
            |
[Spring Boot Backend API]
  - auth/accounts
  - inquiries
  - analytics
  - admin dashboard
            ^
            |
   [React Frontend]
```

## 기술 스택

### Backend

- Java 21
- Spring Boot 3
- Spring Web
- Spring Security
- OAuth2 Resource Server
- Spring Data JPA
- Flyway
- MySQL
- JJWT

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Axios
- Chart.js
- D3 Force / D3 Cloud

### Data Pipeline

- Python
- PyMySQL
- pandas / numpy
- selenium / beautifulsoup4 / aiohttp
- transformers / torch
- OpenAI Python SDK

## 저장소 구조

```text
graduation-project/
├─ backend/         # Spring Boot API 서버
├─ data-pipeline/   # 뉴스 수집/분석 배치
├─ frontend/        # React 클라이언트
└─ README.md
```

### backend

- 계정 인증/인가
- 관리자 기능
- 문의 게시판
- 분석 결과 조회 API
- Flyway 기반 DB 마이그레이션

### data-pipeline

- 트렌드/뉴스 수집
- 전처리
- 분석 배치
- 요약 및 NLP 처리

### frontend

- 홈 대시보드
- 키워드 상세 분석 페이지
- 언론사 비교 페이지
- 인증 화면
- 관리자 화면

## 주요 설계 특징

- `인증 설계`: Access Token은 응답 본문, Refresh Token은 HttpOnly Cookie로 분리
- `권한 설계`: USER / ADMIN / SUPER_ADMIN 구분
- `운영성`: 로그인 기록 저장, 관리자 대시보드 지표 제공
- `DB 변경 관리`: Flyway 마이그레이션으로 계정/문의 테이블 버전 관리
- `비즈니스 규칙`: 기사 수가 일정 기준 이상일 때만 분석 제공
- `파이프라인 연계`: 수집부터 분석 결과 조회 API까지 한 서비스 안에서 연결

## 주요 도메인

### Accounts

- 회원가입 사전 검증
- 로그인/로그아웃
- 토큰 재발급
- 비밀번호 변경
- 계정 찾기

### Inquiries

- 문의 목록/상세 조회
- 문의 등록
- 관리자 답변 및 처리 상태 관리

### Analytics

- 트렌드 키워드 개요
- 키워드 메타 정보
- AI 요약
- 감성 분석
- 편향 분석
- 워드클라우드
- 공동 출현 네트워크
- 언론사 비교 API

## DB 구성

백엔드는 Flyway를 사용해 계정/문의 관련 스키마를 관리합니다.

- `V1__create_accounts_tables.sql`
  - `T_USER_LEVEL`
  - `T_USER`
  - `T_LOGIN_LOG`
- `V2__create_inquiries_tables.sql`
  - `T_INQUIRY_TYPE`
  - `T_INQUIRY`

분석 관련 데이터는 파이프라인에서 생성하여 MySQL에 적재하고, 백엔드가 이를 조회하는 구조입니다.

## 로컬 실행 방법

### 1. MySQL 실행

`data-pipeline/docker-compose.yml` 기준으로 MySQL 8 컨테이너를 실행합니다.

```bash
cd data-pipeline
docker compose up -d
```

기본 포트는 `3307` 입니다.

### 2. Backend 실행

```bash
cd backend
./gradlew bootRun
```

Windows에서는 다음 명령을 사용할 수 있습니다.

```powershell
cd backend
.\gradlew.bat bootRun
```

기본 포트는 `8080` 입니다.

### 3. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

기본 개발 서버 포트는 Vite 기준 `5173` 입니다.

### 4. Data Pipeline 실행

```bash
cd data-pipeline
pip install -r requirements.txt
python -m src.jobs.run_all
```

필요에 따라 개별 job을 직접 실행할 수도 있습니다.

예시:

```bash
python -m src.crawler.trend.jobs.run_trend
python -m src.crawler.news.jobs.run_news
python -m src.analyzer.summary.jobs.run_summary
```

## 환경변수 예시

실행 환경에 따라 `.env` 또는 OS 환경변수를 사용해 아래 값을 설정할 수 있습니다.

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

메일 기능까지 사용할 경우 아래 값도 추가로 필요합니다.

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

```env
APP_ENV=local
TZ=Asia/Seoul

DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=newsight
DB_USER=newsight
DB_PASSWORD=newspass

OPENAI_API_KEY=your-openai-api-key
AI_SUMMARY_MODEL=gpt-4o-mini

RUN_ALL_STEPS=trend,news,preprocess,aggregate,final_rank,summary,title_sentiment,content_sentiment,title_bias,content_bias,wordcloud,cooc_network
RUN_ALL_FAIL_FAST=1
HEADLESS=1
```

## 향후 개선 과제

- API 문서 정리 및 예시 요청/응답 추가
- 백엔드 통합 테스트 확대
- 파이프라인 실행 예시 로그 및 운영 가이드 보강
- 배포 구조 및 인프라 다이어그램 문서화
- Swagger 또는 Postman 컬렉션 정리

## 참고

- 백엔드 실행 포트: `8080`
- 프론트엔드 기본 API base: `http://localhost:8080/api`
- MySQL 기본 포트: `3307`
- 프론트엔드는 Access Token을 저장하고, Refresh Token은 쿠키 기반으로 재발급 받는 구조입니다.

