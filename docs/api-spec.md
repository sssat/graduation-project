# Newsight API 명세서

이 문서는 사람이 빠르게 읽기 위한 API 명세 요약입니다. Swagger/OpenAPI 원본은 `docs/openapi.yaml`을 기준으로 합니다.

## 문서 링크

- 운영 Swagger UI: `https://newsightkr.com/api/docs`
- 로컬 Swagger UI: `http://localhost:8080/api/docs`
- OpenAPI YAML: `docs/openapi.yaml`
- 운영 OpenAPI JSON: `https://newsightkr.com/api/v3/api-docs/all`

## 인증 방식

- 공개 API는 토큰 없이 호출할 수 있습니다.
- 보호 API는 로그인 응답의 `access` 토큰을 `Authorization: Bearer <token>` 헤더로 전달해야 합니다.
- 관리자 API는 JWT의 관리자 등급 권한이 필요합니다.
- Refresh Token은 HttpOnly Cookie로 관리됩니다.

## 공통 오류

| Status | 의미 |
| --- | --- |
| 400 | 요청 값 또는 JSON 형식 오류 |
| 401 | 인증 필요 또는 토큰 오류 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 비즈니스 충돌 |
| 500 | 서버 내부 오류 |

## API 목록

프론트엔드는 마지막 `/`가 없는 경로를 호출하며, 백엔드도 해당 형태를 표준 API 경로로 제공합니다.

### Authentication

| Method | Path | 설명 | 인증 | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | 로그인 | Public | `LoginRequestDto` | `LoginResponseDto` |
| POST | `/api/auth/refresh` | Access Token 재발급 | Public | - | `TokenRefreshResponseDto` |
| POST | `/api/auth/logout` | 로그아웃 | Public | - | `LogoutResponseDto` |

### Registration

| Method | Path | 설명 | 인증 | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/register/precheck/user-id` | 아이디 중복/유효성 확인 | Public | `IdPrecheckRequestDto` | `IdPrecheckResponseDto` |
| POST | `/api/auth/register/precheck/email` | 이메일 중복/유효성 확인 | Public | `EmailPrecheckRequestDto` | `EmailPrecheckResponseDto` |
| POST | `/api/auth/register` | 회원가입 | Public | `SignUpRequestDto` | `SignUpResponseDto` |

### Account Recovery

| Method | Path | 설명 | 인증 | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/find-id` | 아이디 찾기 | Public | `FindIdRequestDto` | `FindIdResponseDto` |
| POST | `/api/auth/find-password` | 임시 비밀번호 발급 | Public | `FindPasswordRequestDto` | `FindPasswordResponseDto` |

### Account Password

| Method | Path | 설명 | 인증 | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/change-password` | 비밀번호 변경 | Required | `ChangePasswordRequestDto` | `ChangePasswordResponseDto` |

### Analytics Overview

| Method | Path | 설명 | 인증 | Query | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/analytics/overview` | 메인 분석 개요 조회 | Public | - | `AnalyticsOverviewResponseDto` |

### Keyword Analytics

| Method | Path | 설명 | 인증 | Query | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/analytics/keywords/{keyword_seq}` | 키워드 메타 정보 조회 | Public | `period` | `KeywordMetaResponseDto` |
| GET | `/api/analytics/keywords/{keyword_seq}/summary` | AI 요약 조회 | Public | `period` | `AiSummaryResponseDto` |
| GET | `/api/analytics/keywords/{keyword_seq}/wordcloud/title` | 제목 워드클라우드 조회 | Public | `period` | `WordcloudResponseDto` |
| GET | `/api/analytics/keywords/{keyword_seq}/wordcloud/comment` | 댓글 워드클라우드 조회 | Public | `period` | `WordcloudResponseDto` |
| GET | `/api/analytics/keywords/{keyword_seq}/search-timeline` | 검색 관심도 타임라인 조회 | Public | `period` | `SearchTimelineResponseDto` |
| GET | `/api/analytics/keywords/{keyword_seq}/sentiment/content` | 본문 감성 분석 조회 | Public | `period` | `ContentSentimentResponseDto` |
| GET | `/api/analytics/keywords/{keyword_seq}/bias/title` | 언론사별 제목 편향 조회 | Public | `period` | `TitleBiasByMediaResponseDto` |
| GET | `/api/analytics/keywords/{keyword_seq}/cooc-network` | 공동 언급 네트워크 조회 | Public | `period` | `CoocNetworkResponseDto` |

### Media Compare Analytics

| Method | Path | 설명 | 인증 | Query | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/analytics/media-compare/keywords/top` | 언론사 비교용 상위 키워드 조회 | Public | `period`, `limit` | `MediaCompareTopKeywordsResponseDto` |
| GET | `/api/analytics/media-compare/keywords/{keyword_seq}/media-article-counts` | 언론사별 기사 수 조회 | Public | `period` | `MediaArticleCountsResponseDto` |
| GET | `/api/analytics/media-compare/keywords/{keyword_seq}/sentiment/content` | 언론사별 본문 감성 비교 조회 | Public | `period` | `MediaContentSentimentCompareResponseDto` |
| GET | `/api/analytics/media-compare/keywords/{keyword_seq}/framing/title-top-words` | 언론사별 제목 주요 단어 조회 | Public | `period`, `top_n` | `MediaTitleTopWordsResponseDto` |

### User Inquiries

| Method | Path | 설명 | 인증 | Query | Request | Response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/inquiries` | 문의 목록 조회 | Required | `inquiry_type`, `status`, `mine`, `page`, `size` | - | `InquiryListResponseDto` |
| GET | `/api/inquiries/{inquiry_seq}` | 문의 상세 조회 | Required | - | - | `InquiryDetailResponseDto` |
| POST | `/api/inquiries` | 문의 등록 | Required | - | `InquiryCreateRequestDto` | `InquiryCreateResponseDto` |

### Admin Dashboard

| Method | Path | 설명 | 인증 | Query | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/admins/dashboard/summary` | 관리자 대시보드 요약 조회 | Required | - | `AdminDashboardSummaryResponseDto` |
| GET | `/api/admins/dashboard/login-logs` | 로그인 로그 목록 조회 | Required | `page`, `size` | `AdminDashboardLoginLogsResponseDto` |

### Admin Users

| Method | Path | 설명 | 인증 | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/admins/users` | 사용자 목록 조회 | Required | - | `UserListResponseDto` |
| POST | `/api/admins/promote` | 사용자 관리자 승격 | Required | `AdminPromoteRequestDto` | `AdminPromoteResponseDto` |
| POST | `/api/admins/demote` | 관리자 일반 사용자 강등 | Required | `AdminDemoteRequestDto` | `AdminDemoteResponseDto` |
| POST | `/api/admins/users/withdraw` | 사용자 탈퇴 처리 | Required | `WithdrawRequestDto` | `WithdrawResponseDto` |

### Admin Inquiries

| Method | Path | 설명 | 인증 | Query | Request | Response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/admins/inquiries` | 관리자 문의 목록 조회 | Required | `page`, `size` | - | `AdminInquiryListResponseDto` |
| GET | `/api/admins/inquiries/{inquiry_seq}` | 관리자 문의 상세 조회 | Required | - | - | `AdminInquiryDetailResponseDto` |
| PUT | `/api/admins/inquiries/{inquiry_seq}/answer` | 관리자 답변 등록/수정 | Required | - | `AdminInquiryAnswerRequestDto` | `AdminInquiryAnswerResponseDto` |
| DELETE | `/api/admins/inquiries/{inquiry_seq}` | 문의 삭제 | Required | - | - | `AdminInquiryDeleteResponseDto` |

## 갱신 방법

API 코드가 변경되면 백엔드를 실행한 뒤 OpenAPI YAML을 다시 생성합니다.

```powershell
cd backend
.\gradlew.bat bootRun
```

다른 터미널에서:

```powershell
Invoke-WebRequest http://localhost:8080/api/v3/api-docs.yaml/all -OutFile docs/openapi.yaml
```

이 문서(`docs/api-spec.md`)는 사람이 읽기 쉽게 정리한 요약이므로 API가 추가되거나 삭제되면 함께 갱신합니다.
