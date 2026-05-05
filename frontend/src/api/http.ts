// frontend/src/api/http.ts

import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiClientError, toApiClientError } from './types';

/**
 * axios 요청 옵션에 추가로 사용할 메타 필드
 * - skipAuth: access token 자동 첨부 건너뜀 (로그인/리프레시 등에 사용)
 * - skipUnauthorizedHandler: 401 전역 처리 콜백 건너뜀
 */
export interface HttpRequestMeta {
  skipAuth?: boolean;
  skipUnauthorizedHandler?: boolean;
}

/**
 * 도메인 API 파일에서 사용할 요청 config 타입
 */
export type HttpRequestConfig<D = unknown> = AxiosRequestConfig<D> & HttpRequestMeta;

const ACCESS_TOKEN_STORAGE_KEY = 'newsight.access';
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * AccountsController에서 refresh 토큰을 HttpOnly 쿠키로 사용하는 구조를 고려하여
 * withCredentials=true를 기본 적용한다.
 */
function resolveApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  // 기본값도 /api까지 포함해 두어 각 도메인 API 파일에서는 '/auth/...', '/analytics/...', '/inquiries/...'
  // 형태의 상대 경로만 사용하도록 통일한다.
  const base = envUrl && envUrl.length > 0 ? envUrl : 'http://localhost:8080/api';

  // 마지막 슬래시 제거
  return base.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

let accessTokenMemory: string | null = null;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadAccessTokenFromStorage(): string | null {
  if (!canUseStorage()) return null;

  try {
    const value = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

// 초기 로드 시 localStorage → 메모리 복원
accessTokenMemory = loadAccessTokenFromStorage();

/**
 * 액세스 토큰 저장
 * - 현재는 localStorage + 메모리 동시 저장
 * - 나중에 메모리 전용으로 바꾸고 싶으면 localStorage 부분만 제거하면 됨
 */
export function setAccessToken(token: string | null | undefined): void {
  const normalized = token && token.trim() ? token.trim() : null;
  accessTokenMemory = normalized;

  if (!canUseStorage()) return;

  try {
    if (normalized) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    // 저장소 접근 실패는 치명적이지 않으므로 무시
  }
}

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

/**
 * 401 응답 시 앱 레벨에서 처리할 콜백
 * 예: 토큰 리프레시 시도 / 로그아웃 / 로그인 페이지 이동
 */
type UnauthorizedHandler = (error: ApiClientError) => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function getRequestMeta(config: InternalAxiosRequestConfig): HttpRequestMeta {
  return config as InternalAxiosRequestConfig & HttpRequestMeta;
}

function getErrorRequestMeta(error: unknown): HttpRequestMeta | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  if (!error.config) return undefined;

  return error.config as AxiosRequestConfig & HttpRequestMeta;
}

function attachAuthorizationHeader(
  config: InternalAxiosRequestConfig,
  token: string,
): InternalAxiosRequestConfig {
  const headers = AxiosHeaders.from(config.headers);
  const currentAuth = headers.get('Authorization');

  if (!currentAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  config.headers = headers;
  return config;
}

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

/**
 * 요청 인터셉터
 * - 기본적으로 access token이 있으면 Authorization 헤더 자동 첨부
 * - 로그인/리프레시 등은 { skipAuth: true } 로 건너뛸 수 있음
 */
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const meta = getRequestMeta(config);

    if (meta.skipAuth) return config;

    const token = getAccessToken();
    if (!token) return config;

    return attachAuthorizationHeader(config, token);
  },
  (error: unknown) => Promise.reject(toApiClientError(error)),
);

/**
 * 응답 인터셉터
 * - 에러를 ApiClientError로 정규화
 * - 401일 때 전역 콜백 실행 가능
 */
http.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: unknown) => {
    const meta = getErrorRequestMeta(error);
    const normalized = toApiClientError(error);

    const shouldRunUnauthorizedHandler =
      normalized.status === 401 && !meta?.skipUnauthorizedHandler;

    if (shouldRunUnauthorizedHandler && unauthorizedHandler) {
      try {
        await unauthorizedHandler(normalized);
      } catch {
        // 전역 핸들러 실패는 원래 에러를 덮지 않도록 무시
      }
    }

    return Promise.reject(normalized);
  },
);

export default http;