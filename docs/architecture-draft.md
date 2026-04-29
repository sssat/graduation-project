# Newsight 아키텍처 설계서

## 1. 시스템 전체 아키텍처

```mermaid
flowchart LR
  User["일반 사용자"]
  Admin["관리자 / 최고 관리자"]

  subgraph Newsight["Newsight 서비스"]
    Frontend["프론트엔드<br/>React, Vite, TypeScript<br/>분석 화면 / 문의 게시판 / 관리자 화면"]
    Backend["백엔드 API<br/>Spring Boot<br/>인증, 계정, 문의, 분석 조회 API"]
    Pipeline["데이터 파이프라인<br/>Python<br/>뉴스/트렌드 수집 및 분석 배치"]
    DB[("MySQL<br/>회원/문의/뉴스/분석 결과")]
  end

  GoogleTrends["Google Trends"]
  NaverNews["Naver News"]
  NaverDataLab["Naver DataLab Open API"]
  OpenAI["OpenAI API<br/>뉴스 요약 생성"]
  Mail["메일 서버<br/>임시 비밀번호 등"]

  User -->|"웹 화면 이용"| Frontend
  Admin -->|"관리자 화면 이용"| Frontend
  Frontend -->|"HTTP REST / JWT Access Token"| Backend
  Backend -->|"JPA / JDBC"| DB
  Backend -->|"메일 발송"| Mail

  Pipeline -->|"크롤링"| GoogleTrends
  Pipeline -->|"기사 / 댓글 수집"| NaverNews
  Pipeline -->|"검색 관심도 조회"| NaverDataLab
  Pipeline -->|"AI 요약 요청"| OpenAI
  Pipeline -->|"수집/분석 결과 저장"| DB

  Backend -->|"분석 결과 조회"| DB
```

## 2. 컨테이너 및 컴포넌트 구조

```mermaid
flowchart TB
  subgraph Client["프론트엔드: React + TypeScript"]
    Router["라우팅<br/>홈 / 키워드 상세 / 언론사 비교 / 문의 / 관리자"]
    ApiClient["API 클라이언트<br/>Axios<br/>accounts / analytics / inquiries"]
    AuthState["인증 상태 관리<br/>Access Token in memory/localStorage"]
    Charts["시각화<br/>Chart.js / D3 Force / D3 Cloud"]
  end

  subgraph Api["백엔드: Spring Boot"]
    Security["Spring Security<br/>JWT, Refresh Cookie, CORS"]
    Accounts["계정 모듈<br/>회원가입, 로그인, 비밀번호, 관리자 권한"]
    Analytics["분석 모듈<br/>상위 키워드, 상세 분석, 언론사 비교, 대시보드"]
    Inquiries["문의 모듈<br/>문의 등록/조회/관리자 답변"]
    Persistence["영속성 계층<br/>Spring Data JPA + Spring JDBC"]
    Flyway["DB 마이그레이션<br/>Flyway<br/>계정/문의 스키마 관리"]
  end

  subgraph Batch["데이터 파이프라인: Python"]
    TrendCrawler["트렌드 수집기<br/>Google Trends 키워드 수집"]
    NewsCrawler["뉴스 수집기<br/>Naver 기사/댓글 수집"]
    Preprocess["전처리<br/>공통 데이터 정제"]
    AnalysisJobs["분석 작업<br/>집계, 최종 랭킹, 요약, 감성, 편향,<br/>워드클라우드, 공동언급 네트워크, 검색량"]
    PipelineConfig["pipeline.env / settings.py"]
  end

  MySQL[("MySQL 8.0<br/>Docker Compose: newsight-mysql<br/>local 3307 -> container 3306")]

  Router --> ApiClient
  AuthState --> ApiClient
  Charts --> Router
  ApiClient -->|"REST API"| Security
  Security --> Accounts
  Security --> Analytics
  Security --> Inquiries
  Accounts --> Persistence
  Analytics --> Persistence
  Inquiries --> Persistence
  Persistence --> MySQL
  Flyway --> MySQL

  PipelineConfig --> TrendCrawler
  PipelineConfig --> NewsCrawler
  TrendCrawler --> Preprocess
  NewsCrawler --> Preprocess
  Preprocess --> AnalysisJobs
  AnalysisJobs --> MySQL
```

## 3. 데이터 파이프라인 흐름

```mermaid
flowchart LR
  Start["run_all.py<br/>배치 시작"]
  Trend["trend<br/>실시간 트렌드 키워드 수집"]
  News["news<br/>키워드 기반 기사/댓글 수집"]
  Preprocess["preprocess<br/>본문/댓글 정제"]
  Aggregate["aggregate<br/>기사/언론사 통계 집계"]
  FinalRank["final_rank<br/>최종 키워드 순위 계산"]
  Summary["summary<br/>OpenAI 기반 AI 요약"]
  Sentiment["sentiment<br/>제목/본문 감성 분석"]
  Bias["bias<br/>제목/본문 편향 분석"]
  Wordcloud["wordcloud<br/>제목/댓글 주요 단어"]
  Cooc["cooc_network<br/>공동언급 네트워크"]
  SearchTimeline["search_timeline<br/>Naver DataLab 검색 관심도"]
  DB[("MySQL 분석 테이블")]

  Start --> Trend --> News --> Preprocess --> Aggregate --> FinalRank
  FinalRank --> Summary
  FinalRank --> Sentiment
  FinalRank --> Bias
  FinalRank --> Wordcloud
  FinalRank --> Cooc
  FinalRank --> SearchTimeline

  Trend --> DB
  News --> DB
  Preprocess --> DB
  Aggregate --> DB
  FinalRank --> DB
  Summary --> DB
  Sentiment --> DB
  Bias --> DB
  Wordcloud --> DB
  Cooc --> DB
  SearchTimeline --> DB
```

## 4. 키워드 상세 조회 흐름

```mermaid
sequenceDiagram
  actor U as 사용자
  participant F as 프론트엔드
  participant B as 백엔드 API
  participant D as MySQL
  participant P as 데이터 파이프라인
  participant E as 외부 API

  P->>E: Google Trends / Naver News / Naver DataLab / OpenAI 호출
  E-->>P: 트렌드, 기사, 댓글, 검색량, 요약 결과
  P->>D: 수집 데이터와 분석 결과 저장

  U->>F: 키워드 상세 페이지 진입
  F->>B: GET /analytics/keywords/{keyword_seq}
  B->>D: 키워드 메타 조회
  D-->>B: 기간, 기사 수, 언론사 수
  B-->>F: 키워드 메타 반환

  F->>B: 요약/감성/워드클라우드/네트워크/검색량 API 요청
  B->>D: 분석 결과 조회
  D-->>B: 저장된 분석 결과
  B-->>F: JSON 응답
  F-->>U: 차트, 워드클라우드, 네트워크로 시각화
```

## 5. 인증 흐름

```mermaid
sequenceDiagram
  actor U as 사용자
  participant F as 프론트엔드
  participant B as 백엔드 인증 API
  participant D as MySQL

  U->>F: 로그인 정보 입력
  F->>B: POST /auth/login
  B->>D: 사용자 조회 및 비밀번호 검증
  D-->>B: 사용자/권한 정보
  B-->>F: Access Token 반환 + HttpOnly Refresh Cookie 설정
  F->>F: Access Token 저장

  F->>B: 보호 API 요청<br/>Authorization: Bearer access
  B-->>F: API 응답

  F->>B: Access Token 만료 시 POST /auth/refresh
  B-->>F: 새 Access Token 반환
```

## 6. 다이어그램 표기 기준

- 큰 그림에서는 `Frontend`, `Backend API`, `Data Pipeline`, `MySQL`, `External APIs`만 보여준다.
- 상세 그림에서는 기능 단위를 `Accounts`, `Analytics`, `Inquiries`, `Pipeline Jobs`로 나눈다.
- 화살표에는 통신 방식이나 데이터 성격을 적는다: `REST API`, `JWT`, `JPA/JDBC`, `수집 데이터`, `분석 결과`.
- 외부 시스템은 서비스 바깥에 둔다: Google Trends, Naver News, Naver DataLab, OpenAI API, Mail Server.
- DB는 계정/문의 데이터와 분석 데이터를 구분해서 표현한다.
- 발표 자료에서는 시스템 전체 아키텍처와 데이터 파이프라인 흐름을 중심으로 구성한다.
- 구현 설명에서는 컨테이너 및 컴포넌트 구조와 주요 기능 흐름을 함께 사용한다.
