// frontend/src/pages/InquiryBoardPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import styles from "./InquiryBoardPage.module.css";
import InquiryCreateModal, {
  type InquiryCreateFormPayload,
  type InquiryTypeKey,
} from "../components/inquiries/InquiryCreateModal";
import { createInquiry, listInquiries, type InquiryListItem } from "../api/inquiries";
import { useAuth } from "../hooks/useAuth";

type StatusKey = "all" | "processing" | "done";
type InquiryTypeFilterKey = "all" | InquiryTypeKey;

type InquiryRowView = {
  id: number;
  typeKey: InquiryTypeKey;
  typeLabel: string;
  title: string;
  date: string;
  createdAt: string;
  status: Exclude<StatusKey, "all">;
  statusLabel: string;
  isPrivate: boolean;
  author: string;
  isMine: boolean;
};

const PAGE_SIZE = 10;

const INQUIRY_TYPE_FILTERS: Array<{ key: InquiryTypeFilterKey; label: string }> = [
  { key: "all", label: "전체" },
  { key: "bug", label: "오류 제보" },
  { key: "idea", label: "기능 제안" },
  { key: "data", label: "데이터 문의" },
  { key: "account", label: "계정/로그인" },
  { key: "etc", label: "기타" },
];

const INQUIRY_STATUS_FILTERS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "전체" },
  { key: "processing", label: "처리 중" },
  { key: "done", label: "답변 완료" },
];

const TYPE_LABEL: Record<InquiryTypeKey, string> = {
  bug: "오류 제보",
  idea: "기능 제안",
  data: "데이터 문의",
  account: "계정/로그인",
  etc: "기타",
};

const INQUIRY_TYPE_TO_BACKEND_CODE: Record<InquiryTypeKey, string> = {
  // 백엔드 enum/string 코드 기준 (필요시 이 매핑만 맞추면 됨)
  bug: "BUG_REPORT",
  idea: "FEATURE_REQUEST",
  data: "DATA_INQUIRY",
  account: "ACCOUNT_LOGIN",
  etc: "ETC",
};

const STATUS_FILTER_TO_BACKEND_CODE: Record<Exclude<StatusKey, "all">, string> = {
  // 현재 백엔드가 대문자 enum 코드를 쓰는 경우를 기준으로 전송
  processing: "PROCESSING",
  done: "DONE",
};

function getErrorMessage(error: unknown, fallback = "요청 처리 중 오류가 발생했습니다.") {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error !== null) {
    const anyErr = error as {
      response?: { data?: { message?: string; details?: string } };
      message?: string;
    };
    const serverMessage = anyErr.response?.data?.message ?? anyErr.response?.data?.details;
    if (typeof serverMessage === "string" && serverMessage.trim()) return serverMessage.trim();
    if (typeof anyErr.message === "string" && anyErr.message.trim()) return anyErr.message.trim();
  }

  return fallback;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateOnly(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.length >= 10 ? value.slice(0, 10) : value;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${formatDateOnly(value)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function normalizeTypeKey(raw: string): InquiryTypeKey {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "bug" || v === "idea" || v === "data" || v === "account" || v === "etc") return v;

  if (v.includes("오류") || v.includes("bug") || v.includes("error")) return "bug";
  if (v.includes("기능") || v.includes("feature") || v.includes("idea") || v.includes("suggest")) return "idea";
  if (v.includes("데이터") || v.includes("data")) return "data";
  if (v.includes("계정") || v.includes("로그인") || v.includes("account") || v.includes("login")) {
    return "account";
  }
  return "etc";
}

function normalizeStatusKey(raw: string): Exclude<StatusKey, "all"> {
  const v = (raw ?? "").trim().toLowerCase();

  if (
    v === "done" ||
    v === "completed" ||
    v === "complete" ||
    v === "processed" ||
    v === "resolved" ||
    v === "answer_completed" ||
    v === "답변완료" ||
    v === "처리완료"
  ) {
    return "done";
  }

  return "processing";
}

function buildAuthorTokens(auth: { userId: string | null; userName: string | null }) {
  const set = new Set<string>();
  if (auth.userId?.trim()) set.add(auth.userId.trim());
  if (auth.userName?.trim()) set.add(auth.userName.trim());
  set.add("newsight_user_me");
  return set;
}

function mapListItemToView(item: InquiryListItem, myAuthorTokens: Set<string>): InquiryRowView {
  const typeKey = normalizeTypeKey(item.inquiry_type);
  const status = normalizeStatusKey(item.status);
  const author = (item.writer_user_id ?? "").trim();

  return {
    id: Number(item.inquiry_seq),
    typeKey,
    typeLabel: TYPE_LABEL[typeKey],
    title: item.title ?? "(제목 없음)",
    date: formatDateOnly(item.created_at),
    createdAt: formatDateTime(item.created_at),
    status,
    statusLabel: status === "processing" ? "처리 중" : "답변 완료",
    isPrivate: Boolean(item.is_private),
    author,
    isMine: author !== "" && myAuthorTokens.has(author),
  };
}

function readPageItems<T>(data: unknown): T[] {
  if (!data || typeof data !== "object") return [];
  const d = data as { items?: unknown; content?: unknown; list?: unknown };
  if (Array.isArray(d.items)) return d.items as T[];
  if (Array.isArray(d.content)) return d.content as T[];
  if (Array.isArray(d.list)) return d.list as T[];
  return [];
}

function readPageMeta(data: unknown) {
  const d = (data ?? {}) as {
    page?: number;
    size?: number;
    total_count?: number;
    total_pages?: number;
    totalPages?: number;
    totalElements?: number;
  };

  const totalCount = Number(
    d.total_count ?? d.totalElements ?? (Number.isFinite(Number(d.size)) ? 0 : 0),
  );
  const totalPages = Number(d.total_pages ?? d.totalPages ?? 1);
  const page = Number(d.page ?? 1);
  const size = Number(d.size ?? PAGE_SIZE);

  return {
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    size: Number.isFinite(size) && size > 0 ? size : PAGE_SIZE,
  };
}

export default function InquiryBoardPage() {
  const { auth } = useAuth();
  const location = useLocation();

  const [typeFilter, setTypeFilter] = useState<InquiryTypeFilterKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [items, setItems] = useState<InquiryRowView[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // 내 문의만 켤 때, 기존에 선택했던 유형을 기억해뒀다가 끌 때 복원
  const lastTypeBeforeMineRef = useRef<InquiryTypeFilterKey>("all");

  const myAuthorTokens = useMemo(
    () => buildAuthorTokens({ userId: auth.userId, userName: auth.userName }),
    [auth.userId, auth.userName],
  );

  const fetchList = useCallback(async () => {
    if (!auth.isAuthed) return;

    setIsListLoading(true);
    setListError(null);

    try {
      const data = await listInquiries({
        page,
        size: PAGE_SIZE,
        inquiry_type:
          typeFilter === "all" ? undefined : INQUIRY_TYPE_TO_BACKEND_CODE[typeFilter],
        status:
          statusFilter === "all" ? undefined : STATUS_FILTER_TO_BACKEND_CODE[statusFilter],
        mine: mineOnly || undefined,
      });

      const rawItems = readPageItems<InquiryListItem>(data);
      const meta = readPageMeta(data);

      setItems(rawItems.map((item) => mapListItemToView(item, myAuthorTokens)));
      setTotalCount(meta.totalCount);
      setTotalPages(meta.totalPages);
      setCurrentPage(meta.page);

      if (meta.totalPages > 0 && page > meta.totalPages) {
        setPage(meta.totalPages);
      }
    } catch (error) {
      setItems([]);
      setTotalCount(0);
      setTotalPages(1);
      setListError(getErrorMessage(error, "문의 목록을 불러오지 못했습니다."));
    } finally {
      setIsListLoading(false);
    }
  }, [auth.isAuthed, mineOnly, myAuthorTokens, page, statusFilter, typeFilter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) setIsModalOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    const safeTotal = Math.max(1, totalPages);
    const safeCurrent = Math.min(Math.max(1, currentPage || page), safeTotal);

    let start = Math.max(1, safeCurrent - 2);
    const end = Math.min(safeTotal, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    const result: number[] = [];
    for (let p = start; p <= end; p += 1) result.push(p);
    return result;
  }, [currentPage, page, totalPages]);

  const showEllipsis = totalPages > 5 && pageNumbers[pageNumbers.length - 1] !== totalPages;

  const pillClassByType = (typeKey: InquiryTypeKey) => {
    if (typeKey === "bug") return `${styles.inquiryTypePill} ${styles.bug}`;
    if (typeKey === "idea") return `${styles.inquiryTypePill} ${styles.idea}`;
    if (typeKey === "data") return `${styles.inquiryTypePill} ${styles.data}`;
    if (typeKey === "etc") return `${styles.inquiryTypePill} ${styles.etc}`;
    if (typeKey === "account") return `${styles.inquiryTypePill} ${styles.admin}`;
    return styles.inquiryTypePill;
  };

  const applyTypeFilter = (next: InquiryTypeFilterKey) => {
    if (mineOnly) setMineOnly(false);
    setTypeFilter(next);
    setPage(1);
  };

  const applyStatusFilter = (next: StatusKey) => {
    setStatusFilter(next);
    setPage(1);
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleMineOnlyChipClick = () => {
    if (mineOnly) {
      setMineOnly(false);
      setTypeFilter(lastTypeBeforeMineRef.current ?? "all");
      setPage(1);
      return;
    }

    lastTypeBeforeMineRef.current = typeFilter;
    setTypeFilter("all");
    setMineOnly(true);
    setPage(1);
  };

  const handleCreateInquiry = async (payload: InquiryCreateFormPayload) => {
    await createInquiry({
      inquiry_type: INQUIRY_TYPE_TO_BACKEND_CODE[payload.typeKey],
      title: payload.title,
      message: payload.body,
      is_private: payload.isPrivate,
    });

    // 등록 후 첫 페이지로 이동해 최신 문의를 다시 조회
    if (page !== 1) {
      setPage(1);
      return;
    }
    await fetchList();
  };

  if (!auth.isAuthed) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <main className={styles.pageRoot}>
      <div className={styles.breadcrumb}>
        <Link to="/">메인</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <span>문의 게시판</span>
      </div>

      <section className={styles.inquiryHero}>
        <h1 className={styles.inquiryTitle}>문의 게시판</h1>

        <div className={styles.inquiryFilterBar}>
          <div className={styles.filterLeft}>
            <span className={styles.filterLabel}>문의 유형</span>

            <div className={styles.categoryChips}>
              {INQUIRY_TYPE_FILTERS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={[
                    styles.categoryChip,
                    !mineOnly && typeFilter === t.key ? styles.activeChip : "",
                  ].join(" ")}
                  onClick={() => applyTypeFilter(t.key)}
                >
                  {t.label}
                </button>
              ))}

              <button
                type="button"
                className={[styles.categoryChip, mineOnly ? styles.activeChip : ""].join(" ")}
                onClick={handleMineOnlyChipClick}
                aria-pressed={mineOnly}
                title="내가 작성한 문의만 보기"
              >
                내 문의만
              </button>
            </div>
          </div>

          <div className={styles.filterRightGroup}>
            <div className={styles.filterRight}>
              <span className={styles.filterLabel}>처리 상태</span>
              <div className={styles.statusFilter}>
                {INQUIRY_STATUS_FILTERS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`${styles.statusChip} ${statusFilter === s.key ? styles.activeStatusChip : ""}`}
                    onClick={() => applyStatusFilter(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className={styles.inquiryOpenBtn} onClick={openModal}>
              문의하기
            </button>
          </div>
        </div>
      </section>

      <section className={styles.boardSection}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>문의 게시판</div>
            <span className={styles.badgeSoft}>게시판 목록</span>
          </div>

          <div className={styles.inquiryListHeader}>
            <div>번호</div>
            <div>유형</div>
            <div>제목</div>
            <div>등록일</div>
            <div>처리 상태</div>
          </div>

          {isListLoading ? (
            <div className={`${styles.inquiryRow} ${styles.feedbackRow}`}>
              <div className={styles.feedbackMessage}>문의 목록을 불러오는 중입니다...</div>
            </div>
          ) : listError ? (
            <div className={`${styles.inquiryRow} ${styles.feedbackRow}`}>
              <div className={styles.feedbackMessage}>{listError}</div>
            </div>
          ) : items.length === 0 ? (
            <div className={`${styles.inquiryRow} ${styles.feedbackRow}`}>
              <div className={styles.feedbackMessage}>조건에 맞는 문의가 없습니다.</div>
            </div>
          ) : (
            items.map((row, idx) => {
              const displayNo = Math.max(1, totalCount - ((currentPage - 1) * PAGE_SIZE + idx));

              return (
                <div key={row.id} className={styles.inquiryRow}>
                  <div className={styles.inquiryIndex}>
                    <span className={styles.mobileMetaLabel}>번호</span>
                    <span>{displayNo}</span>
                  </div>

                  <div className={styles.inquiryTypeCell}>
                    <span className={styles.mobileMetaLabel}>유형</span>
                    <span className={pillClassByType(row.typeKey)}>{row.typeLabel}</span>
                  </div>

                  <div className={styles.inquiryTitleCell}>
                    <div className={styles.titleMetaRow}>
                      {row.isMine ? <span className={styles.myPill}>MY</span> : null}
                      {row.isPrivate ? <span className={styles.lockPill}>🔒비공개</span> : null}
                    </div>

                    <Link to={`/inquiries/${row.id}`} className={styles.inquiryTitleLink}>
                      {row.title}
                    </Link>
                  </div>

                  <div className={styles.inquiryDate}>
                    <span className={styles.mobileMetaLabel}>등록일</span>
                    <span>{row.date}</span>
                  </div>

                  <div className={styles.statusCell}>
                    <span className={styles.mobileMetaLabel}>처리 상태</span>
                    <span className={styles.statusBadge} title={row.createdAt}>
                      <span
                        className={`${styles.statusDot} ${
                          row.status === "processing" ? styles.processing : styles.done
                        }`}
                      />
                      {row.statusLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          <div className={styles.inquiryPagination}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage(1)}
              disabled={page <= 1 || isListLoading}
              aria-label="첫 페이지"
            >
              {"<<"}
            </button>

            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isListLoading}
              aria-label="이전 페이지"
            >
              {"<"}
            </button>

            {pageNumbers.map((p) => (
              <button
                key={p}
                className={`${styles.pageBtn} ${page === p ? styles.pageActive : ""}`}
                onClick={() => setPage(p)}
                aria-current={page === p ? "page" : undefined}
                disabled={isListLoading}
              >
                {p}
              </button>
            ))}

            {showEllipsis ? (
              <button className={styles.pageBtn} disabled aria-hidden="true">
                …
              </button>
            ) : null}

            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isListLoading}
              aria-label="다음 페이지"
            >
              {">"}
            </button>

            <button
              className={styles.pageBtn}
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isListLoading}
              aria-label="마지막 페이지"
            >
              {">>"}
            </button>
          </div>
        </article>
      </section>

      {isModalOpen ? <InquiryCreateModal onClose={closeModal} onSubmit={handleCreateInquiry} /> : null}
    </main>
  );
}
