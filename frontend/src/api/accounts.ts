// frontend/src/api/accounts.ts

import http, {
  clearAccessToken,
  setAccessToken,
  type HttpRequestConfig,
} from './http';
import type { ApiMessageResponse, ApiPageResponse } from './types';

/* =========================================================
 * 공통/기본 타입
 * ======================================================= */

export type PrecheckStatus = 'available' | 'invalid' | 'taken' | string;
export type UserGender = 'M' | 'F';
export type UserRole = string;

/**
 * Spring LocalDate / LocalDateTime는 프론트에서 일단 string으로 받는다.
 * 예:
 * - birth_date: "2000-01-31"
 * - joined_at: "2026-02-26T12:34:56"
 */
export type IsoDateString = string;
export type IsoDateTimeString = string;

/* =========================================================
 * 1) 아이디 사전검사
 * POST /api/auth/register/precheck/user-id
 * ======================================================= */

export interface IdPrecheckRequest {
  user_id: string;
}

export interface IdPrecheckUserIdInfo {
  valid: boolean;
  status: PrecheckStatus;
}

export interface IdPrecheckResponse {
  user_id: IdPrecheckUserIdInfo;
  id_check_token?: string | null;
  expires_in?: number | null;
}

export async function precheckUserId(
  payload: IdPrecheckRequest,
  config?: HttpRequestConfig<IdPrecheckRequest>,
): Promise<IdPrecheckResponse> {
  const response = await http.post<IdPrecheckResponse>(
    '/api/auth/register/precheck/user-id',
    payload,
    { ...config, skipAuth: true } as HttpRequestConfig<IdPrecheckRequest>,
  );
  return response.data;
}

/* =========================================================
 * 2) 이메일 사전검사
 * POST /api/auth/register/precheck/email
 * ======================================================= */

export interface EmailPrecheckRequest {
  email: string;
}

export interface EmailPrecheckEmailInfo {
  valid: boolean;
  status: PrecheckStatus;
}

export interface EmailPrecheckResponse {
  email: EmailPrecheckEmailInfo;
  email_check_token?: string | null;
  expires_in?: number | null;
  message?: string | null;
}

export async function precheckEmail(
  payload: EmailPrecheckRequest,
  config?: HttpRequestConfig<EmailPrecheckRequest>,
): Promise<EmailPrecheckResponse> {
  const response = await http.post<EmailPrecheckResponse>(
    '/api/auth/register/precheck/email',
    payload,
    { ...config, skipAuth: true } as HttpRequestConfig<EmailPrecheckRequest>,
  );
  return response.data;
}

/* =========================================================
 * 3) 회원가입
 * POST /api/auth/register
 * ======================================================= */

export interface SignUpRequest {
  user_id: string;
  email: string;
  password: string;
  password2: string;
  username: string;
  birth_date: IsoDateString;
  gender: UserGender | string;
  agree_whether: boolean;
  id_check_token: string;
  email_check_token: string;
}

export interface SignUpResponse {
  user_seq: number;
  joined_at?: IsoDateTimeString | null;
}

export async function signUp(
  payload: SignUpRequest,
  config?: HttpRequestConfig<SignUpRequest>,
): Promise<SignUpResponse> {
  const response = await http.post<SignUpResponse>(
    '/api/auth/register',
    payload,
    { ...config, skipAuth: true } as HttpRequestConfig<SignUpRequest>,
  );
  return response.data;
}

/* =========================================================
 * 4) 로그인
 * POST /api/auth/login
 * - refresh 토큰은 HttpOnly 쿠키
 * - access 토큰은 응답 body로 수신
 * ======================================================= */

export interface LoginRequest {
  user_id: string;
  password: string;
}

export interface LoginResponse {
  access?: string | null;
  access_token?: string | null;
  role: UserRole;
  user_seq: number;
  user_id: string;
  user_name?: string | null;
  email?: string | null;
  message?: string | null;
}

export async function login(
  payload: LoginRequest,
  config?: HttpRequestConfig<LoginRequest>,
): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>(
    '/api/auth/login',
    payload,
    { ...config, skipAuth: true } as HttpRequestConfig<LoginRequest>,
  );

  const data = response.data;

  const accessToken =
    (typeof data.access === 'string' && data.access.trim() ? data.access.trim() : null) ??
    (typeof data.access_token === 'string' && data.access_token.trim()
      ? data.access_token.trim()
      : null);

  if (accessToken) {
    setAccessToken(accessToken);
  }

  return data;
}

/* =========================================================
 * 5) 토큰 갱신
 * POST /api/auth/refresh
 * - refresh 쿠키 기반
 * - 401 루프 방지를 위해 skipUnauthorizedHandler=true 권장
 * ======================================================= */

export interface TokenRefreshResponse {
  access?: string | null;
  access_token?: string | null;
  message?: string | null;
}

export async function refreshToken(
  config?: HttpRequestConfig<undefined>,
): Promise<TokenRefreshResponse> {
  const mergedConfig: HttpRequestConfig<undefined> = {
    ...config,
    skipAuth: true,
    skipUnauthorizedHandler: true,
  };

  const response = await http.post<TokenRefreshResponse>(
    '/api/auth/refresh',
    undefined,
    mergedConfig,
  );

  const data = response.data;

  const accessToken =
    (typeof data.access === 'string' && data.access.trim() ? data.access.trim() : null) ??
    (typeof data.access_token === 'string' && data.access_token.trim()
      ? data.access_token.trim()
      : null);

  if (accessToken) {
    setAccessToken(accessToken);
  }

  return data;
}

/* =========================================================
 * 6) 로그아웃
 * POST /api/auth/logout
 * - 서버 refresh 쿠키 제거 + 프론트 access 토큰 제거
 * ======================================================= */

export type LogoutResponse = ApiMessageResponse;

export async function logout(
  config?: HttpRequestConfig<undefined>,
): Promise<LogoutResponse> {
  const response = await http.post<LogoutResponse>(
    '/api/auth/logout',
    undefined,
    config,
  );

  clearAccessToken();
  return response.data;
}

/**
 * 서버 호출 없이 프론트에 저장된 access 토큰만 제거
 * (예: 강제 로그아웃 UI 처리, 초기화)
 */
export function clearClientAuth(): void {
  clearAccessToken();
}

/* =========================================================
 * 7) 아이디 찾기
 * POST /api/auth/find-id
 * ======================================================= */

export interface FindIdRequest {
  email: string;
  name: string;
}

export interface FindIdResponse {
  user_id?: string | null;
  message?: string | null;
}

export async function findId(
  payload: FindIdRequest,
  config?: HttpRequestConfig<FindIdRequest>,
): Promise<FindIdResponse> {
  const response = await http.post<FindIdResponse>(
    '/api/auth/find-id',
    payload,
    { ...config, skipAuth: true } as HttpRequestConfig<FindIdRequest>,
  );
  return response.data;
}

/* =========================================================
 * 8) 비밀번호 찾기
 * POST /api/auth/find-password
 * ======================================================= */

export interface FindPasswordRequest {
  user_id: string;
  name: string;
  email: string;
}

export interface FindPasswordResponse {
  message?: string | null;
  temp_password?: string | null;
}

export async function findPassword(
  payload: FindPasswordRequest,
  config?: HttpRequestConfig<FindPasswordRequest>,
): Promise<FindPasswordResponse> {
  const response = await http.post<FindPasswordResponse>(
    '/api/auth/find-password',
    payload,
    { ...config, skipAuth: true } as HttpRequestConfig<FindPasswordRequest>,
  );
  return response.data;
}

/* =========================================================
 * 9) 비밀번호 변경 (로그인 필요)
 * POST /api/auth/change-password
 * ======================================================= */

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface ChangePasswordResponse {
  message: string;
  clear_refresh_cookie?: boolean | null;
}

export async function changePassword(
  payload: ChangePasswordRequest,
  config?: HttpRequestConfig<ChangePasswordRequest>,
): Promise<ChangePasswordResponse> {
  const response = await http.post<ChangePasswordResponse>(
    '/api/auth/change-password',
    payload,
    config,
  );
  return response.data;
}

/* =========================================================
 * 10) 회원 목록 (슈퍼 관리자)
 * GET /api/admins/users?page=&size=&q=
 * ======================================================= */

export interface UserListParams {
  page?: number;
  size?: number;
  q?: string;
}

export interface UserListItem {
  user_seq: number;
  user_id: string;
  user_name: string;
  grade_code: number;
  grade_name: string;
}

export interface UserListResponse extends ApiPageResponse<UserListItem> {
  message?: string | null;
}

export async function listUsers(
  params?: UserListParams,
  config?: HttpRequestConfig<undefined>,
): Promise<UserListResponse> {
  const response = await http.get<UserListResponse>('/api/admins/users', {
    ...config,
    params,
  } as HttpRequestConfig<undefined>);

  return response.data;
}

/* =========================================================
 * 10-1) 관리자 대시보드 로그인 로그 조회 (관리자 이상)
 * GET /api/admins/dashboard/login-logs?page=&size=
 * ======================================================= */

export interface AdminDashboardLoginLogsParams {
  page?: number;
  size?: number;
}

export interface AdminDashboardLoginLogItem {
  login_log_seq: number;
  input_id: string;
  attempted_at: IsoDateTimeString;
  user_seq?: number | null;
  is_success: boolean;
  ip_address: string;
  user_agent?: string | null;
}

export type AdminDashboardLoginLogsResponse =
  Omit<ApiPageResponse<AdminDashboardLoginLogItem>, 'message'>;

export async function listAdminDashboardLoginLogs(
  params?: AdminDashboardLoginLogsParams,
  config?: HttpRequestConfig<undefined>,
): Promise<AdminDashboardLoginLogsResponse> {
  const response = await http.get<AdminDashboardLoginLogsResponse>(
    '/api/admins/dashboard/login-logs',
    {
      ...config,
      params,
    } as HttpRequestConfig<undefined>,
  );

  return response.data;
}


/* =========================================================
 * 10-2) 관리자 대시보드 요약 조회 (관리자 이상)
 * GET /api/admins/dashboard/summary
 * - 구현 버전에 따라 응답 필드명이 다를 수 있어 넓은 타입으로 정의
 * ======================================================= */

export interface AdminDashboardSummaryResponse {
  [key: string]: unknown;
  summary?: Record<string, unknown>;
  signups_today?: number | string;
  today_signups?: number | string;
  today_signup_count?: number | string;
  today_joined_count?: number | string;
  joined_count_today?: number | string;
  articles_today?: number | string;
  today_articles?: number | string;
  collected_articles_today?: number | string;
  today_collected_articles?: number | string;
  today_collected_article_count?: number | string;
  today_article_collected_count?: number | string;
  inquiries_in_progress?: number | string;
  processing_inquiries?: number | string;
  inquiry_processing_count?: number | string;
  processing_inquiry_count?: number | string;
  today_processing_inquiry_count?: number | string;
  signups_meta?: string | null;
  articles_meta?: string | null;
  inquiries_meta?: string | null;
}

export async function getAdminDashboardSummary(
  config?: HttpRequestConfig<undefined>,
): Promise<AdminDashboardSummaryResponse> {
  const response = await http.get<AdminDashboardSummaryResponse>(
    '/api/admins/dashboard/summary',
    config as HttpRequestConfig<undefined> | undefined,
  );
  return response.data;
}

/* =========================================================
 * 11) 관리자 승격 (슈퍼 관리자)
 * POST /api/admins/promote
 * ======================================================= */

export interface AdminPromoteRequest {
  user_seq: number;
}

export interface AdminPromoteResponse {
  user_seq?: number | null;
  acted_seq?: number | null;
  admin_level?: string | null;
  granted_at?: IsoDateTimeString | null;
  message?: string | null;
}

export async function promoteAdmin(
  payload: AdminPromoteRequest,
  config?: HttpRequestConfig<AdminPromoteRequest>,
): Promise<AdminPromoteResponse> {
  const response = await http.post<AdminPromoteResponse>(
    '/api/admins/promote',
    payload,
    config,
  );
  return response.data;
}

/* =========================================================
 * 12) 관리자 강등 (슈퍼 관리자)
 * POST /api/admins/demote
 * ======================================================= */

export interface AdminDemoteRequest {
  user_seq: number;
}

export interface AdminDemoteResponse {
  user_seq?: number | null;
  acted_seq?: number | null;
  demoted_at?: IsoDateTimeString | null;
  message?: string | null;
}

export async function demoteAdmin(
  payload: AdminDemoteRequest,
  config?: HttpRequestConfig<AdminDemoteRequest>,
): Promise<AdminDemoteResponse> {
  const response = await http.post<AdminDemoteResponse>(
    '/api/admins/demote',
    payload,
    config,
  );
  return response.data;
}

/* =========================================================
 * 13) 강제 탈퇴 (슈퍼 관리자)
 * POST /api/admins/users/withdraw
 * ======================================================= */

export interface WithdrawUserRequest {
  user_seq: number;
}

export interface WithdrawUserResponse {
  user_seq: number;
  deleted_at: IsoDateTimeString;
  acted_seq: number;
}

export async function withdrawUser(
  payload: WithdrawUserRequest,
  config?: HttpRequestConfig<WithdrawUserRequest>,
): Promise<WithdrawUserResponse> {
  const response = await http.post<WithdrawUserResponse>(
    '/api/admins/users/withdraw',
    payload,
    config,
  );
  return response.data;
}

/* =========================================================
 * 편의 객체 export (선택)
 * ======================================================= */

export const accountsApi = {
  precheckUserId,
  precheckEmail,
  signUp,
  login,
  refreshToken,
  logout,
  clearClientAuth,
  findId,
  findPassword,
  changePassword,
  listUsers,
  listAdminDashboardLoginLogs,
  getAdminDashboardSummary,
  promoteAdmin,
  demoteAdmin,
  withdrawUser,
};

export default accountsApi;