# Newsight 아키텍처 설계서

## 1. 시스템 전체 아키텍처

```mermaid
flowchart LR
  User["일반 사용자"]
  Admin["관리자 / 최고 관리자"]

  subgraph AppServer["EC2 t3.small<br/>프론트 / 백엔드 / DB 공용 서버"]
    Nginx["Nginx"]
    Frontend["프론트엔드"]
    Backend["백엔드"]
    DB[("MySQL")]
  end

  subgraph BatchServer["EC2 m6i.xlarge<br/>크롤링 및 분석 전용 서버"]
    Scheduler["자동 스케줄러"]
    Pipeline["데이터 파이프라인"]
  end

  subgraph External["외부 데이터 / AI 서비스"]
    GoogleTrends["Google Trends"]
    NaverNews["Naver News"]
    NaverDataLab["Naver DataLab Open API"]
    OpenAI["OpenAI API"]
  end

  Mail["메일 서버"]

  User -->|"웹 접속"| Nginx
  Admin -->|"관리자 화면 접속"| Nginx
  Nginx -->|"화면 파일 제공"| Frontend
  Nginx -->|"API 요청 전달"| Backend
  Frontend -->|"HTTP REST / JWT Access Token"| Backend
  Backend -->|"JPA / JDBC"| DB
  Backend -->|"메일 발송"| Mail

  Scheduler -->|"서버 시작 / 배치 실행 / 서버 종료"| Pipeline
  Pipeline -->|"트렌드 키워드 수집"| GoogleTrends
  Pipeline -->|"기사 / 댓글 수집"| NaverNews
  Pipeline -->|"검색 관심도 조회"| NaverDataLab
  Pipeline -->|"AI 요약 요청"| OpenAI
  Pipeline -->|"수집/분석 결과 저장"| DB

  Backend -->|"분석 결과 조회"| DB

  classDef actor fill:#EAF2FF,stroke:#4C78A8,color:#1F2937,stroke-width:1.5px
  classDef app fill:#E9F7EF,stroke:#3E8E5A,color:#1F2937,stroke-width:1.5px
  classDef api fill:#FFF3CD,stroke:#C69026,color:#1F2937,stroke-width:1.5px
  classDef batch fill:#F2E7FE,stroke:#7E57C2,color:#1F2937,stroke-width:1.5px
  classDef db fill:#FCE8E6,stroke:#C5221F,color:#1F2937,stroke-width:1.5px
  classDef external fill:#F8F9FA,stroke:#6B7280,color:#1F2937,stroke-width:1.5px
  class User,Admin actor
  class Nginx,Frontend app
  class Backend api
  class Scheduler,Pipeline batch
  class DB db
  class GoogleTrends,NaverNews,NaverDataLab,OpenAI,Mail external
  style AppServer fill:#F8FAFC,stroke:#64748B,stroke-width:1.5px
  style BatchServer fill:#FAF5FF,stroke:#7E57C2,stroke-width:1.5px
  style External fill:#F9FAFB,stroke:#9CA3AF,stroke-width:1.5px
```

## 2. 백엔드 아키텍처

```mermaid
flowchart TB
  Client["프론트엔드"]

  subgraph Backend["백엔드: Spring Boot"]
    subgraph FeatureModules["기능 모듈"]
      Accounts["accounts<br/>계정 / 인증"]
      Analytics["analytics<br/>뉴스 분석 조회"]
      Inquiries["inquiries<br/>문의 기능"]
      Admins["admin<br/>관리자 기능"]
    end

    Presentation["Presentation Layer<br/>Controller<br/>Request / Response DTO"]
    Application["Application Layer<br/>Service<br/>"]
    Domain["Domain Layer<br/>Entity / Domain Model<br/>"]
    Infrastructure["Infrastructure Layer<br/>Repository / JPA / JDBC<br/>Security / Mail"]
    Common["Common<br/>공통 예외 처리 / 웹 설정"]
  end

  DB[("MySQL")]
  Mail["메일 서버"]

  Client -->|"HTTP REST"| Presentation
  FeatureModules -.-> Presentation
  FeatureModules -.-> Application
  FeatureModules -.-> Domain
  FeatureModules -.-> Infrastructure

  Presentation --> Application
  Application --> Domain
  Application --> Infrastructure
  Infrastructure --> DB
  Infrastructure --> Mail
  Common -.-> Presentation
  Common -.-> Application

  classDef client fill:#EAF2FF,stroke:#4C78A8,color:#1F2937,stroke-width:1.5px
  classDef module fill:#F2E7FE,stroke:#7E57C2,color:#1F2937,stroke-width:1.5px
  classDef presentation fill:#E9F7EF,stroke:#3E8E5A,color:#1F2937,stroke-width:1.5px
  classDef application fill:#FFF3CD,stroke:#C69026,color:#1F2937,stroke-width:1.5px
  classDef domain fill:#FCE8E6,stroke:#C5221F,color:#1F2937,stroke-width:1.5px
  classDef infra fill:#E8F0FE,stroke:#3F51B5,color:#1F2937,stroke-width:1.5px
  classDef external fill:#F8F9FA,stroke:#6B7280,color:#1F2937,stroke-width:1.5px
  class Client client
  class Accounts,Analytics,Inquiries,Admins module
  class Presentation presentation
  class Application application
  class Domain domain
  class Infrastructure,Common infra
  class DB,Mail external
  style Backend fill:#F8FAFC,stroke:#64748B,stroke-width:1.5px
  style FeatureModules fill:#FAF5FF,stroke:#7E57C2,stroke-width:1.5px
```

## 3. 데이터 파이프라인 흐름

```mermaid
flowchart LR
  Start["run_all.py<br/>배치 시작"]

  subgraph Collect["1. 수집"]
    Trend["trend<br/>실시간 트렌드 키워드 수집"]
    News["news<br/>키워드 기반 기사/댓글 수집"]
  end

  subgraph Prepare["2. 전처리 / 집계"]
    Preprocess["preprocess<br/>본문/댓글 정제"]
    Aggregate["aggregate<br/>기사/언론사 통계 집계"]
    FinalRank["final_rank<br/>최종 키워드 순위 계산"]
  end

  subgraph Analyze["3. 분석 결과 생성"]
    Summary["summary<br/>OpenAI 기반 AI 요약"]
    Sentiment["sentiment<br/>제목/본문 감성 분석"]
    Bias["bias<br/>제목/본문 편향 분석"]
    Wordcloud["wordcloud<br/>제목/댓글 주요 단어"]
    Cooc["cooc_network<br/>관계도 분석"]
    SearchTimeline["search_timeline<br/>Naver DataLab 검색 관심도"]
  end

  DB[("MySQL 분석 테이블")]

  Start --> Trend --> News --> Preprocess --> Aggregate --> FinalRank
  FinalRank --> Summary --> Sentiment --> Bias --> Wordcloud --> Cooc --> SearchTimeline

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

  classDef start fill:#EAF2FF,stroke:#4C78A8,color:#1F2937,stroke-width:1.5px
  classDef collect fill:#E9F7EF,stroke:#3E8E5A,color:#1F2937,stroke-width:1.5px
  classDef prepare fill:#FFF3CD,stroke:#C69026,color:#1F2937,stroke-width:1.5px
  classDef analyze fill:#F2E7FE,stroke:#7E57C2,color:#1F2937,stroke-width:1.5px
  classDef db fill:#FCE8E6,stroke:#C5221F,color:#1F2937,stroke-width:1.5px
  class Start start
  class Trend,News collect
  class Preprocess,Aggregate,FinalRank prepare
  class Summary,Sentiment,Bias,Wordcloud,Cooc,SearchTimeline analyze
  class DB db
  style Collect fill:#F0FDF4,stroke:#3E8E5A,stroke-width:1.5px
  style Prepare fill:#FFFBEB,stroke:#C69026,stroke-width:1.5px
  style Analyze fill:#FAF5FF,stroke:#7E57C2,stroke-width:1.5px
```

## 4. 키워드 상세 조회 흐름

```mermaid
sequenceDiagram
  autonumber
  actor U as 사용자
  participant N as Nginx
  participant F as 프론트엔드
  participant B as 백엔드
  participant D as MySQL

  rect rgb(233, 247, 239)
  U->>F: 키워드 상세 페이지 진입
  F->>N: GET /api/analytics/keywords/{keyword_seq}/...
  N->>B: 요청 전달
  B->>D: 분석 결과 조회
  D-->>B: 저장된 분석 결과
  B-->>N: 분석 결과 JSON 응답
  N-->>F: 응답 전달
  F-->>U: 차트, 워드클라우드, 네트워크로 시각화
  end
```

## 5. 인증 흐름

```mermaid
sequenceDiagram
  autonumber
  actor U as 사용자
  participant N as Nginx
  participant F as 프론트엔드
  participant B as 백엔드
  participant D as MySQL

  rect rgb(234, 242, 255)
  U->>F: 로그인 정보 입력
  F->>N: POST /api/auth/login
  N->>B: 로그인 요청 전달
  B->>D: 사용자 조회 및 비밀번호 검증
  D-->>B: 사용자/권한 정보
  B-->>N: Access Token 반환 + HttpOnly Refresh Cookie 설정
  N-->>F: 로그인 응답 전달
  F->>F: Access Token 저장
  end

  rect rgb(233, 247, 239)
  F->>N: 보호 API 요청<br/>Authorization: Bearer access
  N->>B: /api 요청 전달
  B-->>N: API 응답
  N-->>F: API 응답
  end

  rect rgb(255, 243, 205)
  F->>N: Access Token 만료 시 POST /api/auth/refresh
  N->>B: Refresh Cookie 기반 갱신 요청
  B-->>N: 새 Access Token 반환
  N-->>F: 새 Access Token 반환
  end
```
