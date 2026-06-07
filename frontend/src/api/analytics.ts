// frontend/src/api/analytics.ts

import http, { type HttpRequestConfig } from './http';

/* =========================================================
 * 공통 타입
 * ======================================================= */

export type AnalyticsPeriod = 'D7' | 'D14' | string;
export type IsoDateString = string;

export interface AnalyticsPeriodParams {
  period?: AnalyticsPeriod;
}

/**
 * 공개 분석 API 공통 옵션
 * - skipAuth: Authorization 헤더 자동 첨부 방지
 * - skipUnauthorizedHandler: 공개 API에서 401 핸들러(리프레시 등) 불필요
 */
function publicConfig<D = undefined>(
  config?: HttpRequestConfig<D>,
): HttpRequestConfig<D> {
  return {
    ...config,
    skipAuth: true,
    skipUnauthorizedHandler: true,
  };
}

/* =========================================================
 * 1) 개요(홈 상단) - 공개
 * GET /analytics/overview
 * ======================================================= */

export interface AnalyticsOverviewTopKeywordItem {
  rank_no: number;
  keyword_seq?: number | null;
  keyword: string;
  article_count: number;
  is_analyzable: boolean;
}

export interface AnalyticsOverviewResponse {
  collected_article_count: number;
  data_base_date: IsoDateString | null;
  data_started_at: string | null;
  top_keywords: AnalyticsOverviewTopKeywordItem[];
}

export async function getAnalyticsOverview(
  config?: HttpRequestConfig<undefined>,
): Promise<AnalyticsOverviewResponse> {
  const response = await http.get<AnalyticsOverviewResponse>(
    '/analytics/overview',
    publicConfig(config) as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 2) 키워드 메타 - 공개
 * GET /analytics/keywords/{keyword_seq}?period=D7|D14
 * ======================================================= */

export type KeywordMetaParams = AnalyticsPeriodParams;

export interface KeywordMetaResponse {
  keyword_seq: number;
  keyword: string;
  period_start: IsoDateString;
  period_end: IsoDateString;
  article_count: number;
  media_count: number;
  is_analyzable: boolean;
}

export async function getKeywordMeta(
  keywordSeq: number,
  params?: KeywordMetaParams,
  config?: HttpRequestConfig<undefined>,
): Promise<KeywordMetaResponse> {
  const response = await http.get<KeywordMetaResponse>(
    `/analytics/keywords/${keywordSeq}`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 3) AI 요약 - 공개
 * GET /analytics/keywords/{keyword_seq}/summary?period=D7|D14
 * ======================================================= */

export type AiSummaryParams = AnalyticsPeriodParams;

export interface AiSummaryResponse {
  summary_text: string;
}

export async function getAiSummary(
  keywordSeq: number,
  params?: AiSummaryParams,
  config?: HttpRequestConfig<undefined>,
): Promise<AiSummaryResponse> {
  const response = await http.get<AiSummaryResponse>(
    `/analytics/keywords/${keywordSeq}/summary`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 4) 워드클라우드 (제목) - 공개
 * GET /analytics/keywords/{keyword_seq}/wordcloud/title?period=D7|D14
 * ======================================================= */

export interface WordcloudItem {
  word: string;
  weight: number;
}

export interface WordcloudResponse {
  items: WordcloudItem[];
}

export async function getTitleWordcloud(
  keywordSeq: number,
  params?: AnalyticsPeriodParams,
  config?: HttpRequestConfig<undefined>,
): Promise<WordcloudResponse> {
  const response = await http.get<WordcloudResponse>(
    `/analytics/keywords/${keywordSeq}/wordcloud/title`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 5) 워드클라우드 (댓글/코멘트) - 공개
 * GET /analytics/keywords/{keyword_seq}/wordcloud/comment?period=D7|D14
 * ======================================================= */

export async function getCommentWordcloud(
  keywordSeq: number,
  params?: AnalyticsPeriodParams,
  config?: HttpRequestConfig<undefined>,
): Promise<WordcloudResponse> {
  const response = await http.get<WordcloudResponse>(
    `/analytics/keywords/${keywordSeq}/wordcloud/comment`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 6) Naver DataLab 검색 관심도 시계열 - 공개
 * GET /analytics/keywords/{keyword_seq}/search-timeline
 * ======================================================= */

export interface SearchTimelinePoint {
  observed_date: IsoDateString;
  interest_score: number;
  is_partial: boolean;
}

export interface SearchTimelineResponse {
  period_start: IsoDateString | null;
  period_end: IsoDateString | null;
  latest_score: number | null;
  peak_score: number | null;
  average_score: number | null;
  has_partial: boolean;
  items: SearchTimelinePoint[];
}

export async function getSearchTimeline(
  keywordSeq: number,
  config?: HttpRequestConfig<undefined>,
): Promise<SearchTimelineResponse> {
  const response = await http.get<SearchTimelineResponse>(
    `/analytics/keywords/${keywordSeq}/search-timeline`,
    {
      ...publicConfig(config),
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 7) 본문 감성 분석 - 공개
 * GET /analytics/keywords/{keyword_seq}/sentiment/content?period=D7|D14
 * ======================================================= */

export interface ContentSentimentResponse {
  positive: number;
  neutral: number;
  negative: number;
}

export async function getContentSentiment(
  keywordSeq: number,
  params?: AnalyticsPeriodParams,
  config?: HttpRequestConfig<undefined>,
): Promise<ContentSentimentResponse> {
  const response = await http.get<ContentSentimentResponse>(
    `/analytics/keywords/${keywordSeq}/sentiment/content`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 8) 제목 편향도(언론사별) - 공개
 * GET /analytics/keywords/{keyword_seq}/bias/title?period=D7|D14
 * ======================================================= */

export interface TitleBiasByMediaItem {
  media_name: string;
  bias_score: number;
}

export interface TitleBiasByMediaResponse {
  items: TitleBiasByMediaItem[];
}

export async function getTitleBiasByMedia(
  keywordSeq: number,
  params?: AnalyticsPeriodParams,
  config?: HttpRequestConfig<undefined>,
): Promise<TitleBiasByMediaResponse> {
  const response = await http.get<TitleBiasByMediaResponse>(
    `/analytics/keywords/${keywordSeq}/bias/title`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

export async function getContentBiasByMedia(
  keywordSeq: number,
  params?: AnalyticsPeriodParams,
  config?: HttpRequestConfig<undefined>,
): Promise<TitleBiasByMediaResponse> {
  const response = await http.get<TitleBiasByMediaResponse>(
    `/analytics/keywords/${keywordSeq}/bias/content`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 9) 동시언급 네트워크 - 공개
 * GET /analytics/keywords/{keyword_seq}/cooc-network?period=D7|D14
 * ======================================================= */

export interface CoocNetworkNode {
  id: number;
  label: string;
  size: number;
}

export interface CoocNetworkEdge {
  source: number;
  target: number;
  weight: number;
}

export interface CoocNetworkResponse {
  nodes: CoocNetworkNode[];
  edges: CoocNetworkEdge[];
}

export async function getCoocNetwork(
  keywordSeq: number,
  params?: AnalyticsPeriodParams,
  config?: HttpRequestConfig<undefined>,
): Promise<CoocNetworkResponse> {
  const response = await http.get<CoocNetworkResponse>(
    `/analytics/keywords/${keywordSeq}/cooc-network`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 9) 미디어 비교용 상위 키워드 - 공개
 * GET /analytics/media-compare/keywords/top?period=D7|D14&limit=10
 * ======================================================= */

export interface MediaCompareTopKeywordsParams extends AnalyticsPeriodParams {
  limit?: number;
}

export interface MediaCompareKeywordPillItem {
  keyword_seq: number;
  keyword: string;
}

export interface MediaCompareTopKeywordsResponse {
  period_start: IsoDateString;
  period_end: IsoDateString;
  selected_keyword: string;
  selected_article_count: number;
  selected_media_count: number;
  items: MediaCompareKeywordPillItem[];
  selected_keyword_seq?: number | null;
}

export async function getMediaCompareTopKeywords(
  params?: MediaCompareTopKeywordsParams,
  config?: HttpRequestConfig<undefined>,
): Promise<MediaCompareTopKeywordsResponse> {
  const response = await http.get<MediaCompareTopKeywordsResponse>(
    '/analytics/media-compare/keywords/top',
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 10) 미디어별 기사 수 - 공개
 * GET /analytics/media-compare/keywords/{keyword_seq}/media-article-counts?period=D7|D14
 * ======================================================= */

export interface MediaArticleCountItem {
  media_name: string;
  article_count: number;
}

export interface MediaArticleCountsResponse {
  items: MediaArticleCountItem[];
}

export async function getMediaArticleCounts(
  keywordSeq: number,
  params?: AnalyticsPeriodParams,
  config?: HttpRequestConfig<undefined>,
): Promise<MediaArticleCountsResponse> {
  const response = await http.get<MediaArticleCountsResponse>(
    `/analytics/media-compare/keywords/${keywordSeq}/media-article-counts`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 11) 미디어별 본문 감성 비교 - 공개
 * GET /analytics/media-compare/keywords/{keyword_seq}/sentiment/content?period=D7|D14
 * ======================================================= */

export interface MediaContentSentimentCompareItem {
  media_name: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface MediaContentSentimentCompareResponse {
  items: MediaContentSentimentCompareItem[];
}

export async function getMediaCompareContentSentiment(
  keywordSeq: number,
  params?: AnalyticsPeriodParams,
  config?: HttpRequestConfig<undefined>,
): Promise<MediaContentSentimentCompareResponse> {
  const response = await http.get<MediaContentSentimentCompareResponse>(
    `/analytics/media-compare/keywords/${keywordSeq}/sentiment/content`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 12) 미디어별 제목 상위 단어(프레이밍 비교) - 공개
 * GET /analytics/media-compare/keywords/{keyword_seq}/framing/title-top-words?period=D7|D14&top_n=5
 * ======================================================= */

export interface MediaTitleTopWordsParams extends AnalyticsPeriodParams {
  top_n?: number;
}

export interface MediaTitleTopWordsItem {
  media_name: string;
  words: string[];
}

export interface MediaTitleTopWordsResponse {
  items: MediaTitleTopWordsItem[];
}

export async function getMediaCompareTitleTopWords(
  keywordSeq: number,
  params?: MediaTitleTopWordsParams,
  config?: HttpRequestConfig<undefined>,
): Promise<MediaTitleTopWordsResponse> {
  const response = await http.get<MediaTitleTopWordsResponse>(
    `/analytics/media-compare/keywords/${keywordSeq}/framing/title-top-words`,
    {
      ...publicConfig(config),
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 13) 관리자 대시보드 요약 (인증 필요)
 * GET /admins/dashboard/summary
 * ======================================================= */

export interface AdminDashboardSummaryResponse {
  today_joined_count: number;
  today_joined_delta_rate: number | null;
  today_visitor_count: number;
  today_visitor_delta_rate: number | null;
  today_collected_article_count: number;
  today_collected_article_delta_rate: number | null;
  processing_inquiry_count: number;
  processing_inquiry_avg_elapsed_days: number | null;
}

export async function getAdminDashboardSummary(
  config?: HttpRequestConfig<undefined>,
): Promise<AdminDashboardSummaryResponse> {
  const response = await http.get<AdminDashboardSummaryResponse>(
    '/admins/dashboard/summary',
    config as HttpRequestConfig<undefined> | undefined,
  );
  return response.data;
}

/* =========================================================
 * 14) Anonymous visit tracking - public
 * POST /public/visits
 * ======================================================= */

export interface VisitTrackRequest {
  client_visitor_id: string;
  path?: string;
  referrer?: string;
  language?: string;
  client_time_zone?: string;
  screen_width?: number;
  screen_height?: number;
}

export interface VisitTrackResponse {
  visit_date: string;
  tracked: boolean;
}

export async function trackVisit(
  payload: VisitTrackRequest,
  config?: HttpRequestConfig<VisitTrackRequest>,
): Promise<VisitTrackResponse> {
  const response = await http.post<VisitTrackResponse>(
    '/public/visits',
    payload,
    publicConfig(config) as HttpRequestConfig<VisitTrackRequest>,
  );
  return response.data;
}

/* =========================================================
 * 15) Admin visitor logs - authenticated
 * GET /admins/dashboard/visits
 * ======================================================= */

export interface AdminDashboardVisitsParams {
  page?: number;
  size?: number;
}

export interface AdminDashboardVisitItem {
  visitor_daily_seq: number;
  first_visited_at: string;
  last_visited_at: string;
  page_view_count: number;
  ip_address?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
  accept_language?: string | null;
  client_time_zone?: string | null;
  screen_width?: number | null;
  screen_height?: number | null;
  first_path?: string | null;
  last_path?: string | null;
}

export interface AdminDashboardVisitsResponse {
  items: AdminDashboardVisitItem[];
  page: number;
  size: number;
  total_count: number;
  total_pages: number;
}

export async function listAdminDashboardVisits(
  params?: AdminDashboardVisitsParams,
  config?: HttpRequestConfig<undefined>,
): Promise<AdminDashboardVisitsResponse> {
  const response = await http.get<AdminDashboardVisitsResponse>(
    '/admins/dashboard/visits',
    {
      ...config,
      params,
    } as HttpRequestConfig<undefined>,
  );
  return response.data;
}

/* =========================================================
 * 편의 export
 * ======================================================= */

export const analyticsApi = {
  getAnalyticsOverview,
  getKeywordMeta,
  getAiSummary,
  getTitleWordcloud,
  getCommentWordcloud,
  getSearchTimeline,
  getContentSentiment,
  getTitleBiasByMedia,
  getContentBiasByMedia,
  getCoocNetwork,
  getMediaCompareTopKeywords,
  getMediaArticleCounts,
  getMediaCompareContentSentiment,
  getMediaCompareTitleTopWords,
  getAdminDashboardSummary,
  trackVisit,
  listAdminDashboardVisits,
};

export default analyticsApi;
