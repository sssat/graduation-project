// frontend/src/pages/AdminDashboardPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import styles from "./AdminDashboardPage.module.css";
import { listAdminDashboardLoginLogs } from "../../../api/accounts";
import {
  getAdminDashboardSummary,
  listAdminDashboardVisits,
  type AdminDashboardVisitItem,
  type AdminDashboardSummaryResponse,
} from "../../../api/analytics";
import {
  deleteAdminInquiry,
  getAdminInquiryDetail,
  listAdminInquiries,
  saveOrUpdateAdminInquiryAnswer,
  type AdminInquiryDetail,
  type AdminInquiryListItem,
} from "../../../api/inquiries";
import { getErrorMessage } from "../../../api/types";

const PAGE_SIZE = 10;
const LOGIN_PAGE_SIZE = 10;
const VISIT_PAGE_SIZE = 10;

type LogStatus = "success" | "fail";
type InquiryTypeKey = "bug" | "idea" | "data" | "account" | "etc";
type InquiryStatusKey = "processing" | "done";
type InquiryPanelMode = "view" | "edit";

type DashboardSummaryVm = {
  signupsToday: number;
  signupsMeta: string;
  visitorsToday: number;
  visitorsMeta: string;
  articlesToday: number;
  articlesMeta: string;
  inquiriesInProgress: number;
  inquiriesMeta: string;
};

type LoginLogRowVm = {
  loginLogSeq: number;
  inputId: string;
  attemptedAt: string;
  isSuccess: boolean;
  ipAddress: string;
  userAgent: string | null;
  userSeq: number | null;
};

type VisitLogRowVm = {
  visitorDailySeq: number;
  firstVisitedAt: string;
  lastVisitedAt: string;
  pageViewCount: number;
  ipAddress: string;
  userAgent: string | null;
  referrer: string | null;
  acceptLanguage: string | null;
  clientTimeZone: string | null;
  screenSize: string;
  firstPath: string | null;
  lastPath: string | null;
};

type InquiryListRowVm = {
  id: number;
  typeKey: InquiryTypeKey;
  typeLabel: string;
  title: string;
  author: string;
  date: string;
  status: InquiryStatusKey;
};

type SelectedInquiryVm = {
  id: number;
  typeKey: InquiryTypeKey;
  typeLabel: string;
  title: string;
  author: string;
  createdAt: string;
  body: string;
  status: InquiryStatusKey;
  answer: {
    teamLabel: string;
    answeredAt: string;
    body: string;
  } | null;
};

const DEFAULT_SUMMARY: DashboardSummaryVm = {
  signupsToday: 0,
  signupsMeta: "-",
  visitorsToday: 0,
  visitorsMeta: "-",
  articlesToday: 0,
  articlesMeta: "-",
  inquiriesInProgress: 0,
  inquiriesMeta: "-",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function formatDisplayDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const normalized = value.replace("T", " ");
  return normalized.length >= 19 ? normalized.slice(0, 19) : normalized;
}

function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatIpAddress(value: string | null | undefined): string {
  if (!value) return "-";
  const ip = value.trim();
  if (!ip) return "-";
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "localhost";
  if (ip.startsWith("::ffff:")) return ip.slice("::ffff:".length);
  return ip;
}

function formatNullableText(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : "-";
}

function formatScreenSize(width: number | null | undefined, height: number | null | undefined): string {
  if (!width || !height) return "-";
  return `${width}x${height}`;
}

function formatVisitEnvironment(row: VisitLogRowVm): string {
  return [row.clientTimeZone, row.acceptLanguage, row.screenSize]
    .map(formatNullableText)
    .filter((value) => value !== "-")
    .join(" / ") || "-";
}

function formatDeltaRate(value: number | null, label: string): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${label} ${sign}${value.toFixed(1)}%`;
}

function formatElapsedDays(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `평균 경과 ${value.toFixed(1)}일`;
}

function getNumberByKeys(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = obj[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      const parsed = Number(raw.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getStringByKeys(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = obj[key];
    if (typeof raw === "string" && raw.trim()) return raw;
  }
  return null;
}

function normalizeStatus(status: string | null | undefined): InquiryStatusKey {
  return (status ?? "").trim().toUpperCase() === "DONE" ? "done" : "processing";
}

function mapTypeCodeToUi(typeCode: string | null | undefined): { key: InquiryTypeKey; label: string } {
  const code = (typeCode ?? "").trim().toUpperCase();
  switch (code) {
    case "BUG_REPORT":
      return { key: "bug", label: "오류 제보" };
    case "FEATURE_REQUEST":
      return { key: "idea", label: "기능 제안" };
    case "DATA_INQUIRY":
      return { key: "data", label: "데이터 문의" };
    case "ACCOUNT_LOGIN":
      return { key: "account", label: "계정/로그인" };
    case "ETC":
      return { key: "etc", label: "기타" };
    default:
      return { key: "etc", label: typeCode?.trim() || "기타" };
  }
}

function mapInquiryRow(item: AdminInquiryListItem): InquiryListRowVm {
  const typeUi = mapTypeCodeToUi(item.type_code);
  return {
    id: item.inquiry_seq,
    typeKey: typeUi.key,
    typeLabel: typeUi.label,
    title: item.title,
    author: item.inquirer_id,
    date: formatDisplayDateTime(item.submitted_at),
    status: normalizeStatus(item.status),
  };
}

function mapLoginRow(item: {
  login_log_seq: number;
  input_id: string;
  attempted_at: string;
  is_success: boolean;
  ip_address: string;
  user_agent?: string | null;
  user_seq?: number | null;
}): LoginLogRowVm {
  return {
    loginLogSeq: item.login_log_seq,
    inputId: item.input_id,
    attemptedAt: formatDisplayDateTime(item.attempted_at),
    isSuccess: item.is_success,
    ipAddress: item.ip_address,
    userAgent: item.user_agent ?? null,
    userSeq: item.user_seq ?? null,
  };
}

function mapVisitRow(item: AdminDashboardVisitItem): VisitLogRowVm {
  return {
    visitorDailySeq: item.visitor_daily_seq,
    firstVisitedAt: formatDisplayDateTime(item.first_visited_at),
    lastVisitedAt: formatDisplayDateTime(item.last_visited_at),
    pageViewCount: item.page_view_count,
    ipAddress: formatIpAddress(item.ip_address),
    userAgent: item.user_agent ?? null,
    referrer: item.referrer ?? null,
    acceptLanguage: item.accept_language ?? null,
    clientTimeZone: item.client_time_zone ?? null,
    screenSize: formatScreenSize(item.screen_width, item.screen_height),
    firstPath: item.first_path ?? null,
    lastPath: item.last_path ?? null,
  };
}

function mapAdminDetailToVm(detail: AdminInquiryDetail): SelectedInquiryVm {
  const typeUi = mapTypeCodeToUi(detail.type_code);
  const status = normalizeStatus(detail.status);
  const extra = detail as unknown as Record<string, unknown>;
  const answerUpdatedAt =
    (typeof extra.answer_updated_at === "string" ? extra.answer_updated_at : null) ??
    (typeof extra.processed_at === "string" ? extra.processed_at : null);
  const adminMessage = typeof detail.admin_message === "string" ? detail.admin_message.trim() : "";

  return {
    id: detail.inquiry_seq,
    typeKey: typeUi.key,
    typeLabel: typeUi.label,
    title: detail.title,
    author: detail.inquirer_id,
    createdAt: formatDisplayDateTime(detail.submitted_at),
    body: detail.message,
    status,
    answer:
      status === "done" && adminMessage
        ? {
            teamLabel: "Newsight 운영팀",
            answeredAt: formatDisplayDateTime(answerUpdatedAt),
            body: adminMessage,
          }
        : null,
  };
}

function mapSummaryResponse(raw: AdminDashboardSummaryResponse, fallbackProcessingCount: number): DashboardSummaryVm {
  const root = asRecord(raw);
  const source = isRecord(root.summary) ? root.summary : root;

  const signupsDeltaRate = getNumberByKeys(source, [
    "today_joined_delta_rate",
    "joined_delta_rate",
    "signups_delta_rate",
  ]);

  const articlesDeltaRate = getNumberByKeys(source, [
    "today_collected_article_delta_rate",
    "collected_article_delta_rate",
    "articles_delta_rate",
  ]);

  const visitorsDeltaRate = getNumberByKeys(source, [
    "today_visitor_delta_rate",
    "visitor_delta_rate",
    "visitors_delta_rate",
  ]);

  const inquiriesAvgElapsedDays = getNumberByKeys(source, [
    "processing_inquiry_avg_elapsed_days",
    "inquiries_avg_elapsed_days",
    "processing_avg_elapsed_days",
  ]);

  return {
    signupsToday:
      getNumberByKeys(source, [
        "signups_today",
        "today_signups",
        "today_signup_count",
        "joined_users_today",
        "users_joined_today",
        "today_joined_count",
        "joined_count_today",
      ]) ?? 0,
    signupsMeta:
      getStringByKeys(source, ["signups_meta", "signups_delta_text", "signups_summary"]) ??
      formatDeltaRate(signupsDeltaRate, "최근 7일 평균 대비"),
    visitorsToday:
      getNumberByKeys(source, [
        "visitors_today",
        "today_visitors",
        "today_visitor_count",
        "daily_visitor_count",
      ]) ?? 0,
    visitorsMeta:
      getStringByKeys(source, ["visitors_meta", "visitors_delta_text", "visitors_summary"]) ??
      formatDeltaRate(visitorsDeltaRate, "최근 7일 평균 대비"),
    articlesToday:
      getNumberByKeys(source, [
        "articles_today",
        "today_articles",
        "today_article_count",
        "collected_articles_today",
        "today_collected_articles",
        "today_collected_article_count",
        "today_article_collected_count",
        "collected_article_count_today",
      ]) ?? 0,
    articlesMeta:
      getStringByKeys(source, ["articles_meta", "articles_delta_text", "articles_summary"]) ??
      formatDeltaRate(articlesDeltaRate, "지난주 동일 요일 대비"),
    inquiriesInProgress:
      getNumberByKeys(source, [
        "inquiries_in_progress",
        "processing_inquiries",
        "inquiry_processing_count",
        "inquiries_processing_count",
        "today_processing_inquiry_count",
        "processing_inquiry_count",
      ]) ?? fallbackProcessingCount,
    inquiriesMeta:
      getStringByKeys(source, ["inquiries_meta", "processing_inquiries_meta", "inquiries_summary"]) ??
      formatElapsedDays(inquiriesAvgElapsedDays),
  };
}

export default function AdminDashboardPage() {
  const inquiryPanelRef = useRef<HTMLDivElement | null>(null);

  const [summary, setSummary] = useState<DashboardSummaryVm>(DEFAULT_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [visitPage, setVisitPage] = useState(1);
  const [visitRows, setVisitRows] = useState<VisitLogRowVm[]>([]);
  const [visitTotalPages, setVisitTotalPages] = useState(1);
  const [visitTotalCount, setVisitTotalCount] = useState(0);
  const [visitLoading, setVisitLoading] = useState(false);
  const [visitError, setVisitError] = useState<string | null>(null);

  const [loginPage, setLoginPage] = useState(1);
  const [loginRows, setLoginRows] = useState<LoginLogRowVm[]>([]);
  const [loginTotalPages, setLoginTotalPages] = useState(1);
  const [loginTotalCount, setLoginTotalCount] = useState(0);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activePage, setActivePage] = useState(1);
  const [inquiryRows, setInquiryRows] = useState<InquiryListRowVm[]>([]);
  const [inquiryTotalPages, setInquiryTotalPages] = useState(1);
  const [inquiryTotalCount, setInquiryTotalCount] = useState(0);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [inquiriesError, setInquiriesError] = useState<string | null>(null);

  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null);
  const [selectedInquiryHint, setSelectedInquiryHint] = useState<InquiryListRowVm | null>(null);
  const [selectedInquiryDetail, setSelectedInquiryDetail] = useState<SelectedInquiryVm | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [inquiryPanelOpen, setInquiryPanelOpen] = useState(false);
  const [inquiryPanelMode, setInquiryPanelMode] = useState<InquiryPanelMode>("view");

  const [answerText, setAnswerText] = useState("");
  const [answerStatus, setAnswerStatus] = useState<InquiryStatusKey>("done");
  const [answerSaving, setAnswerSaving] = useState(false);

  const loadSummary = useCallback(async (fallbackProcessingCount: number) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getAdminDashboardSummary();
      setSummary(mapSummaryResponse(data, fallbackProcessingCount));
    } catch (error) {
      setSummary((prev) => ({ ...prev, inquiriesInProgress: fallbackProcessingCount }));
      setSummaryError(getErrorMessage(error, "대시보드 요약을 불러오지 못했습니다."));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadVisitLogs = useCallback(async (page: number) => {
    setVisitLoading(true);
    setVisitError(null);
    try {
      const data = await listAdminDashboardVisits({ page, size: VISIT_PAGE_SIZE });
      const totalPages = Math.max(1, data.total_pages || 1);
      setVisitRows(data.items.map(mapVisitRow));
      setVisitTotalPages(totalPages);
      setVisitTotalCount(data.total_count || 0);
      if (page > totalPages) setVisitPage(totalPages);
    } catch (error) {
      setVisitRows([]);
      setVisitTotalPages(1);
      setVisitTotalCount(0);
      setVisitError(getErrorMessage(error, "방문자 기록을 불러오지 못했습니다."));
    } finally {
      setVisitLoading(false);
    }
  }, []);

  const loadLoginLogs = useCallback(async (page: number) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const data = await listAdminDashboardLoginLogs({ page, size: LOGIN_PAGE_SIZE });
      const totalPages = Math.max(1, data.total_pages || 1);
      setLoginRows(data.items.map(mapLoginRow));
      setLoginTotalPages(totalPages);
      setLoginTotalCount(data.total_count || 0);
      if (page > totalPages) setLoginPage(totalPages);
    } catch (error) {
      setLoginRows([]);
      setLoginTotalPages(1);
      setLoginTotalCount(0);
      setLoginError(getErrorMessage(error, "로그인 시도 기록을 불러오지 못했습니다."));
    } finally {
      setLoginLoading(false);
    }
  }, []);

  const loadInquiries = useCallback(async (page: number) => {
    setInquiriesLoading(true);
    setInquiriesError(null);
    try {
      const data = await listAdminInquiries({ page, size: PAGE_SIZE });
      const mapped = data.items.map(mapInquiryRow);
      const totalPages = Math.max(1, data.total_pages || 1);
      setInquiryRows(mapped);
      setInquiryTotalPages(totalPages);
      setInquiryTotalCount(data.total_count || 0);
      if (page > totalPages) setActivePage(totalPages);

      const fallbackProcessingCount = mapped.filter((x) => x.status === "processing").length;
      void loadSummary(fallbackProcessingCount);
    } catch (error) {
      setInquiryRows([]);
      setInquiryTotalPages(1);
      setInquiryTotalCount(0);
      setInquiriesError(getErrorMessage(error, "문의 목록을 불러오지 못했습니다."));
      void loadSummary(0);
    } finally {
      setInquiriesLoading(false);
    }
  }, [loadSummary]);

  const loadInquiryDetail = useCallback(async (inquiryId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await getAdminInquiryDetail(inquiryId);
      setSelectedInquiryDetail(mapAdminDetailToVm(data.inquiry));
    } catch (error) {
      setSelectedInquiryDetail(null);
      setDetailError(getErrorMessage(error, "문의 상세를 불러오지 못했습니다."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVisitLogs(visitPage);
  }, [visitPage, loadVisitLogs]);

  useEffect(() => {
    void loadLoginLogs(loginPage);
  }, [loginPage, loadLoginLogs]);

  useEffect(() => {
    void loadInquiries(activePage);
  }, [activePage, loadInquiries]);

  useEffect(() => {
    if (!inquiryPanelOpen) return;
    if (!inquiryPanelRef.current) return;
    inquiryPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [inquiryPanelOpen, selectedInquiryDetail, detailLoading]);

  const selectedInquiry = useMemo(() => {
    if (selectedInquiryDetail && selectedInquiryId === selectedInquiryDetail.id) {
      return selectedInquiryDetail;
    }
    if (selectedInquiryHint && selectedInquiryId === selectedInquiryHint.id) {
      return {
        id: selectedInquiryHint.id,
        typeKey: selectedInquiryHint.typeKey,
        typeLabel: selectedInquiryHint.typeLabel,
        title: selectedInquiryHint.title,
        author: selectedInquiryHint.author,
        createdAt: selectedInquiryHint.date,
        body: "",
        status: selectedInquiryHint.status,
        answer: null,
      } as SelectedInquiryVm;
    }
    return null;
  }, [selectedInquiryDetail, selectedInquiryHint, selectedInquiryId]);

  const isEditingExistingAnswer = useMemo(() => {
    if (!selectedInquiry) return false;
    return selectedInquiry.status === "done";
  }, [selectedInquiry]);

  const canPrev = activePage > 1;
  const canNext = activePage < inquiryTotalPages;
  const visitCanPrev = visitPage > 1;
  const visitCanNext = visitPage < visitTotalPages;
  const loginCanPrev = loginPage > 1;
  const loginCanNext = loginPage < loginTotalPages;

  const pageButtons = useMemo(() => {
    const maxButtons = 7;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, activePage - half);
    const end = Math.min(inquiryTotalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    const arr: number[] = [];
    for (let p = start; p <= end; p += 1) arr.push(p);
    return arr;
  }, [activePage, inquiryTotalPages]);

  const loginPageButtons = useMemo(() => {
    const maxButtons = 7;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, loginPage - half);
    const end = Math.min(loginTotalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    const arr: number[] = [];
    for (let p = start; p <= end; p += 1) arr.push(p);
    return arr;
  }, [loginPage, loginTotalPages]);

  const visitPageButtons = useMemo(() => {
    const maxButtons = 7;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, visitPage - half);
    const end = Math.min(visitTotalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    const arr: number[] = [];
    for (let p = start; p <= end; p += 1) arr.push(p);
    return arr;
  }, [visitPage, visitTotalPages]);

  const panelTitle = useMemo(() => {
    if (!selectedInquiry) return "선택한 문의 상세";
    if (inquiryPanelMode === "edit") {
      return selectedInquiry.status === "done" ? "선택한 문의 답변 수정" : "선택한 문의 답변 하기";
    }
    return selectedInquiry.status === "done" ? "선택한 문의 답변 보기" : "선택한 문의 상세";
  }, [inquiryPanelMode, selectedInquiry]);

  function typePillClass(typeKey: InquiryTypeKey) {
    if (typeKey === "bug") return `${styles.inquiryTypePill} ${styles.inquiryTypePillBug}`;
    if (typeKey === "idea") return `${styles.inquiryTypePill} ${styles.inquiryTypePillIdea}`;
    if (typeKey === "data") return `${styles.inquiryTypePill} ${styles.inquiryTypePillData}`;
    if (typeKey === "account") return `${styles.inquiryTypePill} ${styles.inquiryTypePillAccount}`;
    return `${styles.inquiryTypePill} ${styles.inquiryTypePillEtc}`;
  }

  function statusPillClass(status: InquiryStatusKey) {
    if (status === "done") return `${styles.statusPill} ${styles.statusPillDone}`;
    return `${styles.statusPill} ${styles.statusPillProcessing}`;
  }

  function logStatusClass(status: LogStatus) {
    if (status === "success") return `${styles.logStatus} ${styles.logStatusSuccess}`;
    return `${styles.logStatus} ${styles.logStatusFail}`;
  }

  function closeInquiryPanel() {
    setInquiryPanelOpen(false);
    setInquiryPanelMode("view");
    setSelectedInquiryId(null);
    setSelectedInquiryHint(null);
    setSelectedInquiryDetail(null);
    setDetailError(null);
    setAnswerText("");
    setAnswerStatus("done");
  }

  function openInquiryPanel(row: InquiryListRowVm) {
    setSelectedInquiryId(row.id);
    setSelectedInquiryHint(row);
    setSelectedInquiryDetail(null);
    setDetailError(null);
    setAnswerText("");
    setAnswerStatus("done");
    setInquiryPanelMode(row.status === "done" ? "view" : "edit");
    setInquiryPanelOpen(true);
    void loadInquiryDetail(row.id);
  }

  function startEditAnswer() {
    if (!selectedInquiry) return;
    setInquiryPanelMode("edit");
    setAnswerText(selectedInquiry.answer?.body ?? "");
    setAnswerStatus("done");
  }

  async function submitAnswer(e: FormEvent) {
    e.preventDefault();
    if (!selectedInquiryId) return;

    const body = answerText.trim();
    if (!body) {
      alert("답변 내용을 입력해 주세요.");
      return;
    }

    setAnswerSaving(true);
    try {
      await saveOrUpdateAdminInquiryAnswer(selectedInquiryId, {
        admin_message: body,
        status: "DONE",
      });

      await Promise.all([loadInquiryDetail(selectedInquiryId), loadInquiries(activePage)]);
      setInquiryPanelMode("view");
      setAnswerText("");
      setAnswerStatus("done");
    } catch (error) {
      alert(getErrorMessage(error, "답변 저장에 실패했습니다."));
    } finally {
      setAnswerSaving(false);
    }
  }

  async function onDelete(id: number) {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;

    try {
      await deleteAdminInquiry(id);
      if (selectedInquiryId === id) closeInquiryPanel();

      if (inquiryRows.length === 1 && activePage > 1) {
        setActivePage((prev) => Math.max(1, prev - 1));
      } else {
        await loadInquiries(activePage);
      }
    } catch (error) {
      alert(getErrorMessage(error, "문의 삭제에 실패했습니다."));
    }
  }

  return (
    <main className={styles.pageRoot}>
      <section className={styles.adminHero}>
        <div className={styles.adminHeroMain}>
          <div className={styles.heroKicker}>Admin Console</div>
          <h1 className={styles.heroTitle}>관리자 대시보드</h1>
          <p className={styles.heroSub}>
            오늘 가입한 회원 수, 수집된 기사 수, 문의 처리 현황과 로그인 시도 기록을 한 번에 확인할 수 있는 화면입니다.
          </p>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>오늘 가입한 회원</div>
          <div className={styles.summaryMain}>
            <div>
              <span className={styles.summaryValue}>{formatInteger(summary.signupsToday)}</span>
              <span className={styles.summaryUnit}>명</span>
            </div>
          </div>
          <div className={styles.summaryMeta}>{summary.signupsMeta}</div>
        </article>

        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>오늘 방문자</div>
          <div className={styles.summaryMain}>
            <div>
              <span className={styles.summaryValue}>{formatInteger(summary.visitorsToday)}</span>
              <span className={styles.summaryUnit}>명</span>
            </div>
          </div>
          <div className={styles.summaryMeta}>{summary.visitorsMeta}</div>
        </article>

        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>오늘 수집된 기사 수</div>
          <div className={styles.summaryMain}>
            <div>
              <span className={styles.summaryValue}>{formatInteger(summary.articlesToday)}</span>
              <span className={styles.summaryUnit}>건</span>
            </div>
          </div>
          <div className={styles.summaryMeta}>{summary.articlesMeta}</div>
        </article>

        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>처리 중인 문의</div>
          <div className={styles.summaryMain}>
            <div>
              <span className={styles.summaryValue}>{formatInteger(summary.inquiriesInProgress)}</span>
              <span className={styles.summaryUnit}>건</span>
            </div>
          </div>
          <div className={styles.summaryMeta}>{summary.inquiriesMeta}</div>
        </article>
      </section>

      {summaryLoading ? (
        <section>
          <article className={styles.card}>
            <div className={styles.cardSub}>대시보드 요약을 불러오는 중입니다.</div>
          </article>
        </section>
      ) : null}

      {summaryError ? (
        <section>
          <article className={styles.card}>
            <div className={styles.cardSub}>{summaryError}</div>
          </article>
        </section>
      ) : null}

      <section className={styles.sectionGap}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderMain}>
              <div className={styles.cardTitle}>방문자 기록</div>
              <div className={styles.cardSub}>
                하루 고유 방문자 기준으로 IP, 접속 경로, referrer, 브라우저/화면 정보를 확인합니다.
              </div>
            </div>

            <div className={styles.cardHeaderRight}>
              <div className={styles.tableMetaTop}>
                전체 <strong>{formatInteger(visitTotalCount)}</strong>건
              </div>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => void loadVisitLogs(visitPage)}
                disabled={visitLoading}
              >
                {visitLoading ? "불러오는 중..." : "방문자 새로고침"}
              </button>
            </div>
          </div>

          <div className={styles.logTableFrame} aria-label="방문자 기록 목록">
            <div className={styles.logTableScrollInner}>
              <table className={styles.logTable}>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>번호</th>
                    <th style={{ width: 140 }}>첫 방문</th>
                    <th style={{ width: 140 }}>최근 방문</th>
                    <th style={{ width: 110 }}>Page View</th>
                    <th style={{ width: 140 }}>IP 주소</th>
                    <th style={{ width: 260 }}>환경</th>
                    <th style={{ width: 280 }}>경로</th>
                    <th style={{ width: 240 }}>유입 경로</th>
                    <th style={{ width: 520 }}>User-Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {visitRows.map((row) => (
                    <tr key={row.visitorDailySeq}>
                      <td data-label="번호">{row.visitorDailySeq}</td>
                      <td data-label="첫 방문">{row.firstVisitedAt}</td>
                      <td data-label="최근 방문">{row.lastVisitedAt}</td>
                      <td data-label="Page View">{formatInteger(row.pageViewCount)}</td>
                      <td data-label="IP 주소">{row.ipAddress}</td>
                      <td data-label="환경" className={styles.cellWrap}>
                        {formatVisitEnvironment(row)}
                      </td>
                      <td data-label="경로" className={styles.cellWrap}>
                        첫: {formatNullableText(row.firstPath)}
                        <br />
                        최근: {formatNullableText(row.lastPath)}
                      </td>
                      <td data-label="유입 경로" className={styles.cellWrap}>{formatNullableText(row.referrer)}</td>
                      <td data-label="User-Agent" className={styles.cellWrap}>{formatNullableText(row.userAgent)}</td>
                    </tr>
                  ))}
                  {visitError ? (
                    <tr>
                      <td colSpan={9} className={styles.emptyRow}>{visitError}</td>
                    </tr>
                  ) : null}
                  {!visitError && visitLoading && visitRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={styles.emptyRow}>방문자 기록을 불러오는 중입니다.</td>
                    </tr>
                  ) : null}
                  {!visitError && !visitLoading && visitRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={styles.emptyRow}>표시할 방문자 기록이 없습니다.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.inquiryPagination} aria-label="방문자 기록 페이지 이동">
            <button className={styles.pageBtn} type="button" onClick={() => visitCanPrev && setVisitPage(1)} disabled={!visitCanPrev} aria-label="첫 페이지">
              {"<<"}
            </button>
            <button className={styles.pageBtn} type="button" onClick={() => visitCanPrev && setVisitPage((p) => Math.max(1, p - 1))} disabled={!visitCanPrev} aria-label="이전 페이지">
              {"<"}
            </button>
            {visitPageButtons.map((p) => (
              <button key={p} className={`${styles.pageBtn} ${visitPage === p ? styles.pageActive : ""}`} type="button" onClick={() => setVisitPage(p)}>
                {p}
              </button>
            ))}
            <button className={styles.pageBtn} type="button" onClick={() => visitCanNext && setVisitPage((p) => Math.min(visitTotalPages, p + 1))} disabled={!visitCanNext} aria-label="다음 페이지">
              {">"}
            </button>
            <button className={styles.pageBtn} type="button" onClick={() => visitCanNext && setVisitPage(visitTotalPages)} disabled={!visitCanNext} aria-label="마지막 페이지">
              {">>"}
            </button>
          </div>
        </article>
      </section>

      <section className={styles.sectionGap}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderMain}>
              <div className={styles.cardTitle}>로그인 시도 기록</div>
              <div className={styles.cardSub}>
                회원 로그인 시도 이력(시각, 성공 여부, IP, User-Agent, 입력 ID/회원번호 등)을 확인할 수 있습니다.
              </div>
            </div>

            <div className={styles.cardHeaderRight}>
              <div className={styles.tableMetaTop}>
                전체 <strong>{formatInteger(loginTotalCount)}</strong>건
              </div>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => void loadLoginLogs(loginPage)}
                disabled={loginLoading}
              >
                {loginLoading ? "불러오는 중..." : "로그 새로고침"}
              </button>
            </div>
          </div>

          <div className={styles.logTableFrame} aria-label="로그인 시도 로그 목록">
            <div className={styles.logTableScrollInner}>
              <table className={styles.logTable}>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>시도일련번호</th>
                    <th style={{ width: 140 }}>입력 아이디</th>
                    <th style={{ width: 140 }}>시도 시각</th>
                    <th style={{ width: 140 }}>로그인 성공 여부</th>
                    <th style={{ width: 140 }}>IP주소</th>
                    <th style={{ width: 90 }}>회원일련번호</th>
                    <th style={{ width: 520 }}>User-Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginRows.map((row) => {
                    const status: LogStatus = row.isSuccess ? "success" : "fail";
                    return (
                      <tr key={row.loginLogSeq}>
                        <td data-label="시도일련번호">{row.loginLogSeq}</td>
                        <td data-label="입력 아이디">{row.inputId}</td>
                        <td data-label="시도 시각">{row.attemptedAt}</td>
                        <td data-label="로그인 성공 여부">
                          <span className={logStatusClass(status)}>{row.isSuccess ? "성공" : "실패"}</span>
                        </td>
                        <td data-label="IP주소">{formatIpAddress(row.ipAddress)}</td>
                        <td data-label="회원일련번호">{row.isSuccess ? row.userSeq ?? "—" : "—"}</td>
                        <td data-label="User-Agent" className={styles.cellWrap}>{row.userAgent ?? "—"}</td>
                      </tr>
                    );
                  })}
                  {loginError ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyRow}>{loginError}</td>
                    </tr>
                  ) : null}
                  {!loginError && loginLoading && loginRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyRow}>로그인 시도 기록을 불러오는 중입니다.</td>
                    </tr>
                  ) : null}
                  {!loginError && !loginLoading && loginRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyRow}>표시할 로그가 없습니다.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.inquiryPagination} aria-label="로그인 시도 로그 페이지 이동">
            <button className={styles.pageBtn} type="button" onClick={() => loginCanPrev && setLoginPage(1)} disabled={!loginCanPrev} aria-label="첫 페이지">
              {"<<"}
            </button>
            <button className={styles.pageBtn} type="button" onClick={() => loginCanPrev && setLoginPage((p) => Math.max(1, p - 1))} disabled={!loginCanPrev} aria-label="이전 페이지">
              {"<"}
            </button>
            {loginPageButtons.map((p) => (
              <button key={p} className={`${styles.pageBtn} ${loginPage === p ? styles.pageActive : ""}`} type="button" onClick={() => setLoginPage(p)}>
                {p}
              </button>
            ))}
            <button className={styles.pageBtn} type="button" onClick={() => loginCanNext && setLoginPage((p) => Math.min(loginTotalPages, p + 1))} disabled={!loginCanNext} aria-label="다음 페이지">
              {">"}
            </button>
            <button className={styles.pageBtn} type="button" onClick={() => loginCanNext && setLoginPage(loginTotalPages)} disabled={!loginCanNext} aria-label="마지막 페이지">
              {">>"}
            </button>
          </div>
        </article>
      </section>

      <section className={styles.sectionGap}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderMain}>
              <div className={styles.cardTitle}>문의 게시글 관리</div>
            </div>
            <div className={styles.cardHeaderRight}>
              <div className={styles.tableMetaTop}>
                전체 <strong>{formatInteger(inquiryTotalCount)}</strong>건
              </div>
            </div>
          </div>

          <table className={styles.inquiryTable}>
            <thead>
              <tr>
                <th style={{ width: 56 }}>번호</th>
                <th style={{ width: 120 }}>문의 유형</th>
                <th>제목</th>
                <th style={{ width: 120 }}>작성자</th>
                <th style={{ width: 110 }}>등록일</th>
                <th style={{ width: 100 }}>상태</th>
                <th style={{ width: 120 }}>답변</th>
                <th style={{ width: 90 }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {inquiryRows.map((row) => {
                const isDone = row.status === "done";
                return (
                  <tr key={row.id}>
                    <td data-label="번호">{row.id}</td>
                    <td data-label="문의 유형"><span className={typePillClass(row.typeKey)}>{row.typeLabel}</span></td>
                    <td data-label="제목" className={styles.cellWrap}>{row.title}</td>
                    <td data-label="작성자">{row.author}</td>
                    <td data-label="등록일">{row.date}</td>
                    <td data-label="상태"><span className={statusPillClass(row.status)}>{isDone ? "답변 완료" : "처리 중"}</span></td>
                    <td data-label="답변">
                      <button
                        type="button"
                        className={`${styles.btnTable} ${isDone ? styles.btnViewAnswer : ""}`}
                        onClick={() => openInquiryPanel(row)}
                        title={isDone ? "등록된 답변을 확인합니다." : "답변 작성"}
                      >
                        {isDone ? "답변 보기" : "답변 하기"}
                      </button>
                    </td>
                    <td data-label="삭제">
                      <button type="button" className={`${styles.btnTable} ${styles.btnDelete}`} onClick={() => void onDelete(row.id)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
              {inquiriesError ? (
                <tr>
                  <td colSpan={8} className={styles.emptyRow}>{inquiriesError}</td>
                </tr>
              ) : null}
              {!inquiriesError && inquiriesLoading && inquiryRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyRow}>문의 목록을 불러오는 중입니다.</td>
                </tr>
              ) : null}
              {!inquiriesError && !inquiriesLoading && inquiryRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyRow}>표시할 문의가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className={styles.inquiryPagination} aria-label="문의글 페이지 이동">
            <button className={styles.pageBtn} type="button" onClick={() => canPrev && setActivePage(1)} disabled={!canPrev} aria-label="첫 페이지">
              {"<<"}
            </button>
            <button className={styles.pageBtn} type="button" onClick={() => canPrev && setActivePage((p) => Math.max(1, p - 1))} disabled={!canPrev} aria-label="이전 페이지">
              {"<"}
            </button>
            {pageButtons.map((p) => (
              <button key={p} className={`${styles.pageBtn} ${activePage === p ? styles.pageActive : ""}`} type="button" onClick={() => setActivePage(p)}>
                {p}
              </button>
            ))}
            <button className={styles.pageBtn} type="button" onClick={() => canNext && setActivePage((p) => Math.min(inquiryTotalPages, p + 1))} disabled={!canNext} aria-label="다음 페이지">
              {">"}
            </button>
            <button className={styles.pageBtn} type="button" onClick={() => canNext && setActivePage(inquiryTotalPages)} disabled={!canNext} aria-label="마지막 페이지">
              {">>"}
            </button>
          </div>

          {inquiryPanelOpen && selectedInquiry ? (
            <div ref={inquiryPanelRef} className={styles.viewPanel}>
              <div className={styles.viewHeader}>
                <div>
                  <div className={styles.viewTitle}>{panelTitle}</div>
                  {detailLoading ? <div className={styles.viewSub}>문의 상세를 불러오는 중입니다.</div> : null}
                  {detailError ? <div className={styles.viewSub}>{detailError}</div> : null}
                </div>
                <div className={styles.viewHeaderRight}>
                  {inquiryPanelMode === "view" && selectedInquiry.status === "done" ? (
                    <button type="button" className={styles.btnSecondary} onClick={startEditAnswer}>답변 수정</button>
                  ) : null}
                  <button type="button" className={styles.btnSecondary} onClick={closeInquiryPanel}>닫기</button>
                </div>
              </div>

              <div className={styles.viewMetaInlineRow}>
                <span className={styles.viewMetaLabel}>문의유형</span>
                <span className={typePillClass(selectedInquiry.typeKey)}>{selectedInquiry.typeLabel}</span>
                <span className={styles.viewMetaLabel}>작성자</span>
                <span className={styles.viewMetaValue}>{selectedInquiry.author}</span>
                <span className={styles.viewMetaLabel}>등록일</span>
                <span className={styles.viewMetaValue}>{selectedInquiry.createdAt}</span>
              </div>

              <div className={styles.formRow}>
                <label>문의 제목</label>
                <div className={styles.formReadonly}>{selectedInquiry.title}</div>
              </div>

              <div className={styles.formRow}>
                <label>문의 내용</label>
                <textarea readOnly value={selectedInquiry.body} className={styles.inquiryBodyTextarea} />
              </div>

              {inquiryPanelMode === "view" ? (
                selectedInquiry.answer ? (
                  <div className={styles.answerViewBox} aria-label="관리자 답변">
                    <div className={styles.answerViewHead}>
                      <div className={styles.answerTeam}>{selectedInquiry.answer.teamLabel}</div>
                      <div className={styles.answerAt}>{selectedInquiry.answer.answeredAt}</div>
                    </div>
                    <div className={styles.answerBody}>
                      {selectedInquiry.answer.body
                        .split(/\r?\n\s*\r?\n+/g)
                        .map((p) => p.trim())
                        .filter(Boolean)
                        .map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.answerViewBox} aria-label="관리자 답변">
                    <div className={styles.answerBody}><p>아직 등록된 답변이 없습니다.</p></div>
                  </div>
                )
              ) : (
                <div className={styles.answerPanel}>
                  <div className={styles.answerHeader}>
                    <div className={styles.answerTitle}>관리자 답변 작성</div>
                  </div>

                  <form onSubmit={submitAnswer}>
                    <div className={styles.formRow}>
                      <label htmlFor="answer-content">관리자 답변</label>
                      <textarea
                        id="answer-content"
                        className={styles.answerTextarea}
                        placeholder="회원에게 전달할 답변 내용을 작성하세요. (문단은 빈 줄로 구분)"
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        disabled={answerSaving}
                      />
                    </div>

                    <div className={`${styles.formRow} ${styles.formRowInline}`}>
                      <label htmlFor="answer-status">처리 상태</label>
                      <select
                        id="answer-status"
                        value={answerStatus}
                        onChange={(e) => {
                          if (e.target.value === "done") setAnswerStatus("done");
                        }}
                        disabled
                      >
                        <option value="done">답변 완료</option>
                      </select>
                    </div>

                    <div className={styles.answerActions}>
                      <button type="button" className={styles.btnSecondary} onClick={closeInquiryPanel} disabled={answerSaving}>
                        취소
                      </button>
                      <button type="submit" className={styles.btnPrimary} disabled={answerSaving || detailLoading}>
                        {answerSaving ? "저장 중..." : isEditingExistingAnswer ? "답변 수정" : "답변 저장"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
