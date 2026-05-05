// frontend/src/api/types.ts

import axios from 'axios';

/**
 * 백엔드 GlobalExceptionHandler.ApiErrorResponse 형식
 * - timestamp는 Spring Instant 직렬화 결과(ISO 문자열)로 수신됨
 */
export interface ApiErrorResponse {
  message: string;
  details: string | null;
  status: number;
  path: string;
  timestamp: string;
}

/**
 * message만 내려오는 단순 응답 공통 타입
 */
export interface ApiMessageResponse {
  message: string;
}

/**
 * 공통 페이징 응답 타입
 * (accounts/inquiries/admin 목록 계열에서 재사용 가능)
 */
export interface ApiPageResponse<T> {
  items: T[];
  page: number;
  size: number;
  total_count: number;
  total_pages: number;
  message?: string | null;
}

/**
 * 프론트에서 일관되게 다루기 위한 정규화 에러 객체
 */
export class ApiClientError extends Error {
  status?: number;
  code?: string;
  path?: string;
  details?: string | null;
  timestamp?: string;
  data?: ApiErrorResponse;
  raw?: unknown;
  isNetworkError: boolean;

  constructor(params: {
    message: string;
    status?: number;
    code?: string;
    path?: string;
    details?: string | null;
    timestamp?: string;
    data?: ApiErrorResponse;
    raw?: unknown;
    isNetworkError?: boolean;
  }) {
    super(params.message);
    this.name = 'ApiClientError';
    this.status = params.status;
    this.code = params.code;
    this.path = params.path;
    this.details = params.details;
    this.timestamp = params.timestamp;
    this.data = params.data;
    this.raw = params.raw;
    this.isNetworkError = Boolean(params.isNetworkError);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 백엔드 공통 에러 응답 포맷인지 검사
 */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value)) return false;

  const message = value['message'];
  const details = value['details'];
  const status = value['status'];
  const path = value['path'];
  const timestamp = value['timestamp'];

  return (
    typeof message === 'string' &&
    (typeof details === 'string' || details === null || typeof details === 'undefined') &&
    typeof status === 'number' &&
    typeof path === 'string' &&
    typeof timestamp === 'string'
  );
}

/**
 * 다양한 에러 형태에서 사용자 표시용 메시지를 안전하게 추출
 */
export function getErrorMessage(
  error: unknown,
  fallback = '요청 처리 중 오류가 발생했습니다.',
): string {
  if (error instanceof ApiClientError) return error.message;

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    if (isApiErrorResponse(data)) {
      return data.message;
    }

    if (isRecord(data)) {
      const message = data['message'];
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  if (isRecord(error)) {
    const message = error['message'];
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

/**
 * axios/일반 에러를 프론트 공통 에러 타입으로 정규화
 */
export function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const code = error.code;
    const responseData = error.response?.data;

    if (isApiErrorResponse(responseData)) {
      return new ApiClientError({
        message: responseData.message || '요청 처리 중 오류가 발생했습니다.',
        status: responseData.status ?? status,
        code,
        path: responseData.path,
        details: responseData.details ?? null,
        timestamp: responseData.timestamp,
        data: responseData,
        raw: error,
        isNetworkError: !error.response,
      });
    }

    if (isRecord(responseData)) {
      const message = responseData['message'];
      if (typeof message === 'string' && message.trim()) {
        return new ApiClientError({
          message,
          status,
          code,
          raw: error,
          isNetworkError: !error.response,
        });
      }
    }

    if (!error.response) {
      return new ApiClientError({
        message: '서버에 연결할 수 없습니다. 네트워크 또는 CORS 설정을 확인해주세요.',
        status,
        code,
        raw: error,
        isNetworkError: true,
      });
    }

    return new ApiClientError({
      message: error.message || '요청 처리 중 오류가 발생했습니다.',
      status,
      code,
      raw: error,
      isNetworkError: false,
    });
  }

  if (error instanceof Error) {
    return new ApiClientError({
      message: error.message || '요청 처리 중 오류가 발생했습니다.',
      raw: error,
      isNetworkError: false,
    });
  }

  return new ApiClientError({
    message: '알 수 없는 오류가 발생했습니다.',
    raw: error,
    isNetworkError: false,
  });
}