// frontend/src/pages/InquiryBoardPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import styles from "./InquiryBoardPage.module.css";
import {
  INQUIRY_STATUS_FILTERS,
  INQUIRY_TYPE_FILTERS,
  addInquiryToStorage,
  getAllInquiries,
  getNextInquiryId,
  type InquiryItem,
  type InquiryTypeKey,
  type StatusKey,
} from "../mocks/inquiryMockData";
import InquiryCreateModal from "../components/inquiries/InquiryCreateModal";
import { useAuth } from "../hooks/useAuth";

const PAGE_SIZE = 10;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateTime(d: Date) {
  return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const TYPE_LABEL: Record<InquiryItem["typeKey"], string> = {
  bug: "오류 제보",
  idea: "기능 제안",
  data: "데이터 문의",
  account: "계정/로그인",
  etc: "기타",
};

export default function InquiryBoardPage() {
  const { auth } = useAuth();
  const location = useLocation();

  const [typeFilter, setTypeFilter] = useState<InquiryTypeKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [items, setItems] = useState<InquiryItem[]>(() => getAllInquiries());

  // 내 문의만 켤 때, 기존에 선택했던 유형을 기억해뒀다가 끌 때 복원
  const lastTypeBeforeMineRef = useRef<InquiryTypeKey>("all");

  const myAuthorTokens = useMemo(() => {
    const set = new Set<string>();
    if (auth.userId?.trim()) set.add(auth.userId.trim());
    if (auth.userName?.trim()) set.add(auth.userName.trim());
    set.add("newsight_user_me");
    return set;
  }, [auth.userId, auth.userName]);

  const isMine = useCallback(
    (item: InquiryItem) => {
      const a = (item.author ?? "").trim();
      return a !== "" && myAuthorTokens.has(a);
    },
    [myAuthorTokens]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) setIsModalOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const typeOk = typeFilter === "all" ? true : item.typeKey === typeFilter;
      const statusOk = statusFilter === "all" ? true : item.status === statusFilter;
      const mineOk = !mineOnly ? true : isMine(item);
      return typeOk && statusOk && mineOk;
    });
  }, [items, typeFilter, statusFilter, mineOnly, isMine]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    [filtered.length]
  );

  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    const count = Math.min(totalPages, maxButtons);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [totalPages]);

  const showEllipsis = totalPages > 5;

  const pillClassByType = (typeKey: InquiryItem["typeKey"]) => {
    if (typeKey === "bug") return `${styles.inquiryTypePill} ${styles.bug}`;
    if (typeKey === "idea") return `${styles.inquiryTypePill} ${styles.idea}`;
    if (typeKey === "data") return `${styles.inquiryTypePill} ${styles.data}`;
    if (typeKey === "etc") return `${styles.inquiryTypePill} ${styles.etc}`;
    if (typeKey === "account") return `${styles.inquiryTypePill} ${styles.admin}`;
    return styles.inquiryTypePill;
  };

  const applyTypeFilter = (next: InquiryTypeKey) => {
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

  const handleCreateInquiry = (payload: {
    typeKey: InquiryItem["typeKey"];
    title: string;
    body: string;
    isPrivate: boolean;
  }) => {
    const now = new Date();
    const newId = getNextInquiryId();

    const author = (auth.userId?.trim() || auth.userName?.trim() || "newsight_user_me").trim();

    const newItem: InquiryItem = {
      id: newId,
      typeKey: payload.typeKey,
      typeLabel: TYPE_LABEL[payload.typeKey],
      title: payload.title,
      date: formatDate(now),
      status: "processing",
      isPrivate: payload.isPrivate,
      author,
      createdAt: formatDateTime(now),
      body: payload.body,
    };

    addInquiryToStorage(newItem);

    setItems(getAllInquiries());
    setPage(1);
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

          {pagedItems.map((row, idx) => {
          // 필터링된 전체 결과(filtered) 기준으로 내림차순 번호 표시
          // 예: filtered.length=14이면 첫 행 14, 다음 13 ... (페이지 이동도 반영)
          const displayNo = filtered.length - ((safePage - 1) * PAGE_SIZE + idx);

          return (
            <div key={row.id} className={styles.inquiryRow}>
              <div className={styles.inquiryIndex}>{displayNo}</div>

                <div>
                  <span className={pillClassByType(row.typeKey)}>{row.typeLabel}</span>
                </div>

                <div className={styles.inquiryTitleCell}>
                  {isMine(row) ? <span className={styles.myPill}>MY</span> : null}
                  {row.isPrivate ? <span className={styles.lockPill}>🔒비공개</span> : null}

                  <Link to={`/inquiries/${row.id}`} className={styles.inquiryTitleLink}>
                    {row.title}
                  </Link>
                </div>

                <div className={styles.inquiryDate}>{row.date}</div>

                <div>
                  <span className={styles.statusBadge}>
                    <span
                      className={`${styles.statusDot} ${
                        row.status === "processing" ? styles.processing : styles.done
                      }`}
                    />
                    {row.status === "processing" ? "처리 중" : "답변 완료"}
                  </span>
                </div>
              </div>
            );
          })}

          <div className={styles.inquiryPagination}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
              aria-label="첫 페이지"
            >
              {"<<"}
            </button>

            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="이전 페이지"
            >
              {"<"}
            </button>

            {pageNumbers.map((p) => (
              <button
                key={p}
                className={`${styles.pageBtn} ${safePage === p ? styles.pageActive : ""}`}
                onClick={() => setPage(p)}
                aria-current={safePage === p ? "page" : undefined}
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
              disabled={safePage >= totalPages}
              aria-label="다음 페이지"
            >
              {">"}
            </button>

            <button
              className={styles.pageBtn}
              onClick={() => setPage(totalPages)}
              disabled={safePage >= totalPages}
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
