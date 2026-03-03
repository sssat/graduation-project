// frontend/src/api/inquiries.ts

import http, { type HttpRequestConfig } from './http';
import type { ApiPageResponse } from './types';

/* =========================================================
 * 공통 타입
 * ======================================================= */

export type IsoDateTimeString = string;

/**
 * 문의 타입/상태 값은 백엔드 정책에 따라 문자열 코드로 관리
 * (초기에는 string으로 열어두고, UI에서 실제 값 확인 후 좁혀도 됨)
 */
export type InquiryTypeCode = string;
export type InquiryStatus = string;

/* =========================================================
 * 1) 사용자 문의 목록 조회
 * GET /api/inquiries
 * ======================================================= */

export interface InquiryListParams {
  inquiry_type?: string;
  status?: string;
  mine?: boolean;
  page?: number;
  size?: number;
}

export interface InquiryListItem {
  inquiry_seq: number;
  inquiry_type: string;
  title: string;
  writer_user_id: string;
  created_at: IsoDateTimeString;
  status: string;
  is_private: boolean;
}

export type InquiryListResponse = ApiPageResponse<InquiryListItem>;

export async function listInquiries(
  params?: InquiryListParams,
  config?: HttpRequestConfig<undefined>,
): Promise<InquiryListResponse> {
  const response = await http.get<InquiryListResponse>('/api/inquiries', {
    ...config,
    params,
  } as HttpRequestConfig<undefined>);

  return response.data;
}

/* =========================================================
 * 2) 사용자 문의 상세 조회
 * GET /api/inquiries/{inquiry_seq}
 * ======================================================= */

export interface InquiryDetail {
  inquiry_seq: number;
  inquiry_type: string;
  title: string;
  content: string;
  /** 일부 백엔드 구현에서 content 대신 message를 쓰는 경우 대응 */
  message?: string;
  writer_user_id: string;
  created_at: IsoDateTimeString;
  status: string;
  is_private: boolean;

  /** 선택적 답변/처리 정보 (구현 버전별 편차 대응) */
  admin_message?: string | null;
  processed_at?: IsoDateTimeString | null;
  answer_updated_at?: IsoDateTimeString | null;
  answered_at?: IsoDateTimeString | null;
  answer_team_label?: string | null;
  answered_by?: string | null;
}

export interface InquiryDetailResponse {
  inquiry: InquiryDetail;
}

export async function getInquiryDetail(
  inquirySeq: number,
  config?: HttpRequestConfig<undefined>,
): Promise<InquiryDetailResponse> {
  const response = await http.get<InquiryDetailResponse>(
    `/api/inquiries/${inquirySeq}`,
    config as HttpRequestConfig<undefined> | undefined,
  );

  return response.data;
}

/* =========================================================
 * 3) 사용자 문의 등록
 * POST /api/inquiries
 * ======================================================= */

export interface CreateInquiryRequest {
  inquiry_type: InquiryTypeCode;
  title: string;
  message: string;
  is_private?: boolean | null;
}

export interface CreateInquiryResponse {
  inquiry_seq: number;
  submitted_at: IsoDateTimeString;
}

export async function createInquiry(
  payload: CreateInquiryRequest,
  config?: HttpRequestConfig<CreateInquiryRequest>,
): Promise<CreateInquiryResponse> {
  const response = await http.post<CreateInquiryResponse>(
    '/api/inquiries',
    payload,
    config,
  );

  return response.data;
}

/* =========================================================
 * 4) 관리자 문의 목록 조회
 * GET /api/admins/inquiries
 * ======================================================= */

export interface AdminInquiryListParams {
  page?: number;
  size?: number;
}

export interface AdminInquiryListItem {
  inquiry_seq: number;
  type_code: string;
  title: string;
  inquirer_id: string;
  submitted_at: IsoDateTimeString;
  status: string;
}

export type AdminInquiryListResponse = ApiPageResponse<AdminInquiryListItem>;

export async function listAdminInquiries(
  params?: AdminInquiryListParams,
  config?: HttpRequestConfig<undefined>,
): Promise<AdminInquiryListResponse> {
  const response = await http.get<AdminInquiryListResponse>(
    '/api/admins/inquiries',
    {
      ...config,
      params,
    } as HttpRequestConfig<undefined>,
  );

  return response.data;
}

/* =========================================================
 * 5) 관리자 문의 상세 조회
 * GET /api/admins/inquiries/{inquiry_seq}
 * ======================================================= */

export interface AdminInquiryDetail {
  inquiry_seq: number;
  type_code: string;
  title: string;
  message: string;
  inquirer_id: string;
  submitted_at: IsoDateTimeString;
  status: string;
  admin_message: string | null;
}

export interface AdminInquiryDetailResponse {
  inquiry: AdminInquiryDetail;
}

export async function getAdminInquiryDetail(
  inquirySeq: number,
  config?: HttpRequestConfig<undefined>,
): Promise<AdminInquiryDetailResponse> {
  const response = await http.get<AdminInquiryDetailResponse>(
    `/api/admins/inquiries/${inquirySeq}`,
    config as HttpRequestConfig<undefined> | undefined,
  );

  return response.data;
}

/* =========================================================
 * 6) 관리자 답변 저장/수정 + 처리상태 변경
 * PUT /api/admins/inquiries/{inquiry_seq}/answer
 * ======================================================= */

export interface AdminInquiryAnswerRequest {
  admin_message: string;
  status: InquiryStatus;
}

export interface AdminInquiryAnswerResponse {
  inquiry_seq: number;
  status: string;
  processed_at: IsoDateTimeString | null;
  answer_updated_at: IsoDateTimeString | null;
}

export async function saveOrUpdateAdminInquiryAnswer(
  inquirySeq: number,
  payload: AdminInquiryAnswerRequest,
  config?: HttpRequestConfig<AdminInquiryAnswerRequest>,
): Promise<AdminInquiryAnswerResponse> {
  const response = await http.put<AdminInquiryAnswerResponse>(
    `/api/admins/inquiries/${inquirySeq}/answer`,
    payload,
    config,
  );

  return response.data;
}

/* =========================================================
 * 7) 관리자 문의 삭제
 * DELETE /api/admins/inquiries/{inquiry_seq}
 * ======================================================= */

export interface AdminInquiryDeleteResponse {
  inquiry_seq: number;
}

export async function deleteAdminInquiry(
  inquirySeq: number,
  config?: HttpRequestConfig<undefined>,
): Promise<AdminInquiryDeleteResponse> {
  const response = await http.delete<AdminInquiryDeleteResponse>(
    `/api/admins/inquiries/${inquirySeq}`,
    config as HttpRequestConfig<undefined> | undefined,
  );

  return response.data;
}

/* =========================================================
 * 편의 export
 * ======================================================= */

export const inquiriesApi = {
  listInquiries,
  getInquiryDetail,
  createInquiry,
  listAdminInquiries,
  getAdminInquiryDetail,
  saveOrUpdateAdminInquiryAnswer,
  deleteAdminInquiry,
};

export default inquiriesApi;
