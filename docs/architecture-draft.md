# Newsight Architecture Draft

이 문서는 현재 저장소 구조를 기준으로 작성한 아키텍처 그림 초안입니다.

## 1. System Context

```mermaid
flowchart LR
  User["일반 사용자"]
  Admin["관리자 / 최고 관리자"]

  subgraph Newsight["Newsight 서비스"]
    Frontend["React Frontend<br/>Vite, TypeScript<br/>분석 화면 / 문의 게시판 / 관리자 화면"]
    Backend["Spring Boot Backend API<br/>인증, 계정, 문의, 분석 조회 API"]
    Pipeline["Python Data Pipeline<br/>뉴스/트렌드 수집 및 분석 배치"]
    DB[("MySQL<br/>회원/문의/뉴스/분석 결과")]
  end

  GoogleTrends["Google Trends"]
  NaverNews["Naver News"]
  NaverDataLab["Naver DataLab Open API"]
  OpenAI["OpenAI API<br/>뉴스 요약 생성"]
  Mail["Mail Server<br/>임시 비밀번호 등"]

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

## 2. Container / Component View

```mermaid
flowchart TB
  subgraph Client["Frontend: React + TypeScript"]
    Router["React Router<br/>Home / Keyword Detail / Media Compare / Inquiry / Admin"]
    ApiClient["Axios API Client<br/>accounts / analytics / inquiries"]
    AuthState["Auth Context<br/>Access Token in memory/localStorage"]
    Charts["Visualization<br/>Chart.js / D3 Force / D3 Cloud"]
  end

  subgraph Api["Backend: Spring Boot"]
    Security["Spring Security<br/>JWT, Refresh Cookie, CORS"]
    Accounts["Accounts Module<br/>회원가입, 로그인, 비밀번호, 관리자 권한"]
    Analytics["Analytics Module<br/>상위 키워드, 상세 분석, 언론사 비교, 대시보드"]
    Inquiries["Inquiries Module<br/>문의 등록/조회/관리자 답변"]
    Persistence["Persistence Layer<br/>Spring Data JPA + Spring JDBC"]
    Flyway["Flyway Migration<br/>계정/문의 스키마 관리"]
  end

  subgraph Batch["Data Pipeline: Python"]
    TrendCrawler["Trend Crawler<br/>Google Trends 키워드 수집"]
    NewsCrawler["News Crawler<br/>Naver 기사/댓글 수집"]
    Preprocess["Preprocess<br/>공통 전처리"]
    AnalysisJobs["Analysis Jobs<br/>집계, 최종 랭킹, 요약, 감성, 편향,<br/>워드클라우드, 공동언급 네트워크, 검색량"]
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

## 3. Data Pipeline Flow

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

## 4. Keyword Detail Sequence

```mermaid
sequenceDiagram
  actor U as 사용자
  participant F as React Frontend
  participant B as Spring Boot API
  participant D as MySQL
  participant P as Python Data Pipeline
  participant E as External APIs

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

## 5. Authentication Flow

```mermaid
sequenceDiagram
  actor U as 사용자
  participant F as React Frontend
  participant B as Spring Boot Auth API
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

## 6. Diagram Rules For This Project

- 큰 그림에서는 `Frontend`, `Backend API`, `Data Pipeline`, `MySQL`, `External APIs`만 보여준다.
- 상세 그림에서는 기능 단위를 `Accounts`, `Analytics`, `Inquiries`, `Pipeline Jobs`로 나눈다.
- 화살표에는 통신 방식이나 데이터 성격을 적는다: `REST API`, `JWT`, `JPA/JDBC`, `수집 데이터`, `분석 결과`.
- 외부 시스템은 서비스 바깥에 둔다: Google Trends, Naver News, Naver DataLab, OpenAI API, Mail Server.
- DB 테이블을 전부 한 장에 넣지 말고, 필요할 때만 계정/문의 테이블과 분석 테이블을 나누어 보인다.
- 발표용은 System Context 1장 + Data Pipeline Flow 1장 조합이 가장 무난하다.
- 구현 설명용은 Container / Component View와 Sequence Diagram을 함께 사용한다.

