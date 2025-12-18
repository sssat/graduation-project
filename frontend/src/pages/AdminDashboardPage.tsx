// frontend/src/pages/AdminDashboardPage.tsx

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import styles from "./AdminDashboardPage.module.css";
import {
  getAllInquiries,
  type InquiryItem as InquiryDataItem,
  type InquiryTypeKey,
  type StatusKey,
} from "../mocks/inquiryMockData";

type LogStatus = "success" | "fail";

type CrawlLog = {
  startedAt: string;
  endedAt: string;
  articleCount: string;
  message: string;
  status: LogStatus;
};

type AnalyzeLog = {
  startedAt: string;
  endedAt: string;
  keywordCount: string;
  message: string;
  status: LogStatus;
};

const PAGE_SIZE = 10;

const ADMIN_OVERRIDE_KEY = "NS_INQUIRIES_ADMIN_OVERRIDE_V1";
type AdminOverride = {
  status?: Exclude<StatusKey, "all">;
  answer?: InquiryDataItem["answer"];
};
type AdminStore = {
  overrides: Record<number, AdminOverride>;
  deletedIds: number[];
};

function readAdminStore(): AdminStore {
  try {
    const raw = localStorage.getItem(ADMIN_OVERRIDE_KEY);
    if (!raw) return { overrides: {}, deletedIds: [] };
    const parsed = JSON.parse(raw) as AdminStore;
    if (!parsed || typeof parsed !== "object") return { overrides: {}, deletedIds: [] };
    return {
      overrides: parsed.overrides ?? {},
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
    };
  } catch {
    return { overrides: {}, deletedIds: [] };
  }
}

function writeAdminStore(next: AdminStore) {
  try {
    localStorage.setItem(ADMIN_OVERRIDE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatNowYYYYMMDDHHmm(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminDashboardPage() {
  const viewPanelRef = useRef<HTMLDivElement | null>(null);
  const answerPanelRef = useRef<HTMLDivElement | null>(null);

  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([
    {
      startedAt: "2025-12-16 04:00",
      endedAt: "2025-12-16 04:18",
      articleCount: "12,300",
      message: "CRAWLER_DAILY[2025-12-16] completed successfully (12,300)",
      status: "success",
    },
    {
      startedAt: "2025-12-15 04:00",
      endedAt: "2025-12-15 04:16",
      articleCount: "11,800",
      message: "CRAWLER_DAILY[2025-12-15] completed with retry (11,800)",
      status: "success",
    },
    {
      startedAt: "2025-12-14 04:00",
      endedAt: "2025-12-14 04:03",
      articleCount: "—",
      message: "[ERR-CRAWLER-503] UpstreamTimeout: press-api.example.com",
      status: "fail",
    },
  ]);

  const [analyzeLogs, setAnalyzeLogs] = useState<AnalyzeLog[]>([
    {
      startedAt: "2025-12-16 04:20",
      endedAt: "2025-12-16 04:27",
      keywordCount: "10개",
      message: "ANALYZER_JOB[2025-12-16] finished: 10 keywords processed",
      status: "success",
    },
    {
      startedAt: "2025-12-15 04:17",
      endedAt: "2025-12-15 04:23",
      keywordCount: "10개",
      message: "ANALYZER_JOB[2025-12-15] finished: dictionary updated",
      status: "success",
    },
    {
      startedAt: "2025-12-14 04:05",
      endedAt: "2025-12-14 04:07",
      keywordCount: "5개",
      message: "[ERR-ANALYZER-422] TokenizationError: invalid label index",
      status: "fail",
    },
  ]);

  const [activePage, setActivePage] = useState(1);

  const [viewOpen, setViewOpen] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null);

  const [adminStore, setAdminStore] = useState<AdminStore>(() => readAdminStore());

  const inquiriesAll = useMemo(() => {
    const base = getAllInquiries();
    const deletedSet = new Set(adminStore.deletedIds);

    const merged = base
      .filter((it) => !deletedSet.has(it.id))
      .map((it) => {
        const ov = adminStore.overrides[it.id];
        if (!ov) return it;
        return {
          ...it,
          status: ov.status ?? it.status,
          answer: ov.answer ?? it.answer,
        };
      });

    merged.sort((a, b) => b.id - a.id);
    return merged;
  }, [adminStore.deletedIds, adminStore.overrides]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(inquiriesAll.length / PAGE_SIZE);
    return Math.max(1, n);
  }, [inquiriesAll.length]);

  const activePageSafe = useMemo(() => {
    return Math.min(Math.max(1, activePage), totalPages);
  }, [activePage, totalPages]);

  const pageItems = useMemo(() => {
    const start = (activePageSafe - 1) * PAGE_SIZE;
    return inquiriesAll.slice(start, start + PAGE_SIZE);
  }, [activePageSafe, inquiriesAll]);

  const selectedInquiry = useMemo(() => {
    if (selectedInquiryId == null) return null;
    return inquiriesAll.find((x) => x.id === selectedInquiryId) ?? null;
  }, [inquiriesAll, selectedInquiryId]);

  const [answerText, setAnswerText] = useState("");
  const [answerStatus, setAnswerStatus] = useState<Exclude<StatusKey, "all">>("done");

  const summary = useMemo(() => {
    const signupsToday = 27;
    const articlesToday = "12,300";
    const inquiriesInProgress = inquiriesAll.filter((x) => x.status === "processing").length;

    return {
      signupsToday,
      signupsMeta: "최근 7일 평균 대비 +12%",
      articlesToday,
      articlesMeta: "지난주 동일 요일 대비 +4.2%",
      inquiriesInProgress,
      inquiriesMeta: "평균 처리 소요 시간 1.8일",
    };
  }, [inquiriesAll]);

  useEffect(() => {
    if (!viewOpen) return;
    if (!viewPanelRef.current) return;
    viewPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [viewOpen]);

  useEffect(() => {
    if (!answerOpen) return;
    if (!answerPanelRef.current) return;
    answerPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [answerOpen]);

  function typePillClass(typeKey: InquiryTypeKey) {
    if (typeKey === "bug") return `${styles.inquiryTypePill} ${styles.inquiryTypePillBug}`;
    if (typeKey === "idea") return `${styles.inquiryTypePill} ${styles.inquiryTypePillIdea}`;
    if (typeKey === "data") return `${styles.inquiryTypePill} ${styles.inquiryTypePillData}`;
    if (typeKey === "account") return `${styles.inquiryTypePill} ${styles.inquiryTypePillAccount}`;
    if (typeKey === "etc") return `${styles.inquiryTypePill} ${styles.inquiryTypePillEtc}`;
    return styles.inquiryTypePill;
  }

  function logStatusClass(status: LogStatus) {
    if (status === "success") return `${styles.logStatus} ${styles.logStatusSuccess}`;
    return `${styles.logStatus} ${styles.logStatusFail}`;
  }

  function statusPillClass(status: Exclude<StatusKey, "all">) {
    if (status === "done") return `${styles.statusPill} ${styles.statusPillDone}`;
    return `${styles.statusPill} ${styles.statusPillProcessing}`;
  }

  function closeView() {
    setViewOpen(false);
  }

  function openView(id: number) {
    setSelectedInquiryId(id);
    setViewOpen(true);
  }

  function openAnswer(id: number) {
    const target = inquiriesAll.find((x) => x.id === id);
    if (!target) return;

    setSelectedInquiryId(id);
    setAnswerText("");
    setAnswerStatus(target.status === "done" ? "done" : "done");
    setAnswerOpen(true);
  }

  function cancelAnswer() {
    setAnswerText("");
    setAnswerStatus("done");
    setAnswerOpen(false);
  }

  function persistOverride(id: number, patch: AdminOverride) {
    setAdminStore((prev) => {
      const next: AdminStore = {
        overrides: { ...prev.overrides, [id]: { ...(prev.overrides[id] ?? {}), ...patch } },
        deletedIds: [...prev.deletedIds],
      };
      writeAdminStore(next);
      return next;
    });
  }

  function persistDelete(id: number) {
    setAdminStore((prev) => {
      const deletedIds = prev.deletedIds.includes(id) ? prev.deletedIds : [id, ...prev.deletedIds];
      const overrides = { ...prev.overrides };
      delete overrides[id];
      const next: AdminStore = { overrides, deletedIds };
      writeAdminStore(next);
      return next;
    });
  }

  function submitAnswer(e: FormEvent) {
    e.preventDefault();
    if (!selectedInquiry) return;

    const body = answerText.trim();
    if (!body) {
      alert("답변 내용을 입력해 주세요.");
      return;
    }

    const answeredAt = formatNowYYYYMMDDHHmm();
    const answer = {
      teamLabel: "Newsight 운영팀",
      answeredAt,
      body,
    };

    persistOverride(selectedInquiry.id, {
      status: answerStatus,
      answer: answerStatus === "done" ? answer : selectedInquiry.answer,
    });

    setAnswerText("");
    setAnswerOpen(false);
  }

  function onDelete(id: number) {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;
    persistDelete(id);
    if (selectedInquiryId === id) {
      setSelectedInquiryId(null);
      setViewOpen(false);
      setAnswerOpen(false);
    }
  }

  function refreshLogsDemo() {
    const now = formatNowYYYYMMDDHHmm();
    setCrawlLogs((prev) => [
      {
        startedAt: now,
        endedAt: now,
        articleCount: "—",
        message: "LOG_REFRESH: crawlers fetched latest entries",
        status: "success",
      },
      ...prev,
    ]);
    setAnalyzeLogs((prev) => [
      {
        startedAt: now,
        endedAt: now,
        keywordCount: "—",
        message: "LOG_REFRESH: analyzers fetched latest entries",
        status: "success",
      },
      ...prev,
    ]);
  }

  function runCrawlingDemo() {
    alert("수동 크롤링 실행 요청을 보냈습니다. (UI 데모)");
  }

  const canPrev = activePageSafe > 1;
  const canNext = activePageSafe < totalPages;

  const pageButtons = useMemo(() => {
    const maxButtons = 7;
    const half = Math.floor(maxButtons / 2);

    let start = Math.max(1, activePageSafe - half);
    const end = Math.min(totalPages, start + maxButtons - 1);

    start = Math.max(1, end - maxButtons + 1);

    const arr: number[] = [];
    for (let p = start; p <= end; p += 1) arr.push(p);
    return arr;
  }, [activePageSafe, totalPages]);

  return (
    <main className={styles.pageRoot}>
      <section className={styles.adminHero}>
        <div className={styles.adminHeroMain}>
          <div className={styles.heroKicker}>Admin Console</div>
          <h1 className={styles.heroTitle}>관리자 대시보드</h1>
          <p className={styles.heroSub}>
            오늘 가입한 회원, 수집된 기사 수, 문의 처리 현황과 수집·분석 로그를 한 번에 확인하고
            크롤링을 수동으로 실행할 수 있는 화면입니다.
          </p>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>오늘 가입한 회원</div>
          <div className={styles.summaryMain}>
            <div>
              <span className={styles.summaryValue}>{summary.signupsToday}</span>
              <span className={styles.summaryUnit}>명</span>
            </div>
          </div>
          <div className={styles.summaryMeta}>{summary.signupsMeta}</div>
        </article>

        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>오늘 수집된 기사 수</div>
          <div className={styles.summaryMain}>
            <div>
              <span className={styles.summaryValue}>{summary.articlesToday}</span>
              <span className={styles.summaryUnit}>건</span>
            </div>
          </div>
          <div className={styles.summaryMeta}>{summary.articlesMeta}</div>
        </article>

        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>처리 중인 문의</div>
          <div className={styles.summaryMain}>
            <div>
              <span className={styles.summaryValue}>{summary.inquiriesInProgress}</span>
              <span className={styles.summaryUnit}>건</span>
            </div>
          </div>
          <div className={styles.summaryMeta}>{summary.inquiriesMeta}</div>
        </article>
      </section>

      <section className={styles.grid2col}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderMain}>
              <div className={styles.cardTitle}>크롤링 · 분석 실행 로그</div>
              <div className={styles.cardSub}>
                작업 실행 이력과 시작/종료 시각, 성공/실패 여부 및 로그 메시지를 확인할 수 있습니다.
              </div>
            </div>
          </div>

          <div className={styles.logTabs}>
            <span className={`${styles.logTab} ${styles.logTabActive}`}>크롤링 로그</span>
          </div>

          <div className={styles.logTableScroll} aria-label="크롤링 로그 목록">
            <table className={styles.logTable}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>시작 시각</th>
                  <th style={{ width: 130 }}>종료 시각</th>
                  <th style={{ width: 80 }}>기사 수</th>
                  <th>로그 메시지</th>
                  <th style={{ width: 70 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {crawlLogs.map((row, idx) => (
                  <tr key={`${row.startedAt}-${idx}`}>
                    <td>{row.startedAt}</td>
                    <td>{row.endedAt}</td>
                    <td>{row.articleCount}</td>
                    <td>{row.message}</td>
                    <td>
                      <span className={logStatusClass(row.status)}>
                        {row.status === "success" ? "성공" : "실패"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.logTabs} style={{ marginTop: 14 }}>
            <span className={`${styles.logTab} ${styles.logTabActive}`}>분석 로그</span>
          </div>

          <div className={styles.logTableScroll} aria-label="분석 로그 목록">
            <table className={styles.logTable}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>시작 시각</th>
                  <th style={{ width: 130 }}>종료 시각</th>
                  <th style={{ width: 90 }}>분석 키워드</th>
                  <th>로그 메시지</th>
                  <th style={{ width: 70 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {analyzeLogs.map((row, idx) => (
                  <tr key={`${row.startedAt}-${idx}`}>
                    <td>{row.startedAt}</td>
                    <td>{row.endedAt}</td>
                    <td>{row.keywordCount}</td>
                    <td>{row.message}</td>
                    <td>
                      <span className={logStatusClass(row.status)}>
                        {row.status === "success" ? "성공" : "실패"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderMain}>
              <div className={styles.cardTitle}>수동 크롤링 실행</div>
              <div className={styles.cardSub}>
                기본적으로 매일 새벽 자동 크롤링이 수행되며, 필요 시 여기에서 수동으로 즉시 실행할 수
                있습니다.
              </div>
            </div>
          </div>

          <div className={styles.manualBody}>
            <p>
              · 자동 크롤링 스케줄: 매일 <strong>04:00 KST</strong>
              <br />· 실행 대상: 등록된 모든 언론사 및 섹션
            </p>

            <p className={styles.manualNext}>다음 자동 실행 예정 시각: 2025-12-18 04:00 KST</p>

            <p>즉시 데이터 갱신이 필요할 때만 수동 실행을 사용해 주세요.</p>

            <div className={styles.manualActions}>
              <button type="button" className={styles.btnPrimary} onClick={runCrawlingDemo}>
                지금 바로 크롤링 실행
              </button>
              <button type="button" className={styles.btnSecondary} onClick={refreshLogsDemo}>
                최근 실행 로그 새로고침
              </button>
            </div>
          </div>
        </article>
      </section>

      <section>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderMain}>
              <div className={styles.cardTitle}>문의 게시글 관리</div>
              <div className={styles.cardSub}>
                문의 데이터는 <strong>inquiryMockData.ts</strong> 기반이며, 목록은{" "}
                <strong>페이지당 10개</strong>씩 표시됩니다.
              </div>
            </div>
          </div>

          {viewOpen && selectedInquiry && (
            <div ref={viewPanelRef} className={styles.viewPanel}>
              <div className={styles.viewHeader}>
                <div>
                  <div className={styles.viewTitle}>선택한 문의 상세</div>
                  <div className={styles.viewSub}>
                    작성자/등록일은 별도 행으로 구분했고, 답변이 있으면 아래에 함께 표시합니다.
                  </div>
                </div>
                <button type="button" className={styles.btnSecondary} onClick={closeView}>
                  닫기
                </button>
              </div>

              <div className={styles.formRow}>
                <label>문의 유형</label>
                <div>
                  <span className={typePillClass(selectedInquiry.typeKey)}>{selectedInquiry.typeLabel}</span>
                </div>
              </div>

              <div className={styles.formRow}>
                <label>문의 제목</label>
                <div className={styles.formReadonly}>{selectedInquiry.title}</div>
              </div>

              <div className={styles.formRow}>
                <label>작성자</label>
                <div className={styles.formReadonly}>{selectedInquiry.author}</div>
              </div>

              <div className={styles.formRow}>
                <label>등록일</label>
                <div className={styles.formReadonly}>{selectedInquiry.createdAt}</div>
              </div>

              <div className={styles.formRow}>
                <label>문의 내용</label>
                <textarea readOnly value={selectedInquiry.body} />
              </div>

              {selectedInquiry.answer ? (
                <div className={styles.answerViewBox} aria-label="관리자 답변">
                  <div className={styles.answerViewHead}>
                    <div className={styles.answerTeam}>{selectedInquiry.answer.teamLabel}</div>
                    <div className={styles.answerAt}>{selectedInquiry.answer.answeredAt}</div>
                  </div>
                  <div className={styles.answerBody}>
                    {selectedInquiry.answer.body.split("\n\n").map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <table className={styles.inquiryTable}>
            <thead>
              <tr>
                <th style={{ width: 56 }}>번호</th>
                <th style={{ width: 120 }}>문의 유형</th>
                <th>제목</th>
                <th style={{ width: 120 }}>작성자</th>
                <th style={{ width: 100 }}>상태</th>
                <th style={{ width: 110 }}>등록일</th>
                <th style={{ width: 220 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>
                    <span className={typePillClass(row.typeKey)}>{row.typeLabel}</span>
                  </td>
                  <td>{row.title}</td>
                  <td>{row.author}</td>
                  <td>
                    <span className={statusPillClass(row.status)}>
                      {row.status === "done" ? "답변 완료" : "처리 중"}
                    </span>
                  </td>
                  <td>{row.date}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button type="button" className={styles.btnTable} onClick={() => openView(row.id)}>
                        답변 보기
                      </button>

                      {row.status === "processing" ? (
                        <button type="button" className={styles.btnTable} onClick={() => openAnswer(row.id)}>
                          답변 하기
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className={`${styles.btnTable} ${styles.btnDelete}`}
                        onClick={() => onDelete(row.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyRow}>
                    표시할 문의가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className={styles.inquiryPagination} aria-label="문의글 페이지 이동">
            <button
              className={styles.pageBtn}
              type="button"
              onClick={() => canPrev && setActivePage(1)}
              disabled={!canPrev}
              aria-label="첫 페이지"
            >
              {"<<"}
            </button>

            <button
              className={styles.pageBtn}
              type="button"
              onClick={() => canPrev && setActivePage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              aria-label="이전 페이지"
            >
              {"<"}
            </button>

            {pageButtons.map((p) => (
              <button
                key={p}
                className={`${styles.pageBtn} ${activePageSafe === p ? styles.pageActive : ""}`}
                type="button"
                onClick={() => setActivePage(p)}
              >
                {p}
              </button>
            ))}

            <button
              className={styles.pageBtn}
              type="button"
              onClick={() => canNext && setActivePage((p) => Math.min(totalPages, p + 1))}
              disabled={!canNext}
              aria-label="다음 페이지"
            >
              {">"}
            </button>

            <button
              className={styles.pageBtn}
              type="button"
              onClick={() => canNext && setActivePage(totalPages)}
              disabled={!canNext}
              aria-label="마지막 페이지"
            >
              {">>"}
            </button>
          </div>

          {answerOpen && selectedInquiry ? (
            <div ref={answerPanelRef} className={styles.answerPanel}>
              <div className={styles.answerHeader}>
                <div className={styles.answerTitle}>선택한 문의에 답변 남기기</div>
                <div className={styles.answerSub}>
                  저장 시 해당 문의는 <strong>답변 완료</strong>로 갱신됩니다. (목업 연동: 로컬 저장)
                </div>
              </div>

              <form onSubmit={submitAnswer}>
                <div className={styles.formRow}>
                  <label>문의 제목</label>
                  <div className={styles.formReadonly}>{selectedInquiry.title}</div>
                </div>

                <div className={styles.formRow}>
                  <label htmlFor="answer-content">관리자 답변</label>
                  <textarea
                    id="answer-content"
                    placeholder="회원에게 전달할 답변 내용을 작성하세요. (문단은 빈 줄로 구분)"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                  />
                </div>

                <div className={`${styles.formRow} ${styles.formRowInline}`}>
                  <label htmlFor="answer-status">처리 상태</label>
                  <select
                    id="answer-status"
                    value={answerStatus}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "done" || v === "processing") setAnswerStatus(v);
                    }}
                  >
                    <option value="done">답변 완료</option>
                    <option value="processing">처리 중</option>
                  </select>
                </div>

                <div className={styles.answerActions}>
                  <button type="button" className={styles.btnSecondary} onClick={cancelAnswer}>
                    취소
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    답변 저장
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <div className={styles.tableFootnote}>
            전체 <strong>{inquiriesAll.length}</strong>건 · 페이지 <strong>{activePageSafe}</strong> /{" "}
            <strong>{totalPages}</strong> · 페이지당 <strong>{PAGE_SIZE}</strong>건
          </div>
        </article>
      </section>
    </main>
  );
}
