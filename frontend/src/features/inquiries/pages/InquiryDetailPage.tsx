// frontend/src/pages/InquiryDetailPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import styles from "./InquiryDetailPage.module.css";
import { getInquiryDetail, type InquiryDetail } from "../../../api/inquiries";
import { ApiClientError } from "../../../api/types";
import { useAuth } from "../../auth/hooks/useAuth";
import type { InquiryTypeKey } from "../components/InquiryCreateModal";

type InquiryDetailView = {
  inquirySeq: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  status: "processing" | "done";
  statusLabel: string;
  isPrivate: boolean;
  typeKey: InquiryTypeKey;
  typeLabel: string;
  answer?: {
    teamLabel: string;
    answeredAt: string;
    body: string;
  };
};

type InquiryDetailUiError = {
  title: string;
  body: string;
  badgeLabel: string;
};

const TYPE_LABEL: Record<InquiryTypeKey, string> = {
  bug: "오류 제보",
  idea: "기능 제안",
  data: "데이터 문의",
  account: "계정/로그인",
  etc: "기타",
};

function toNumberSafe(v: string | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function splitParagraphs(text: string) {
  return (text ?? "")
    .split(/\r?\n\s*\r?\n+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )}`;
}

function normalizeTypeKey(raw: string): InquiryTypeKey {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "bug" || v === "idea" || v === "data" || v === "account" || v === "etc") return v;

  if (v.includes("오류") || v.includes("bug") || v.includes("error")) return "bug";
  if (v.includes("기능") || v.includes("idea") || v.includes("suggest")) return "idea";
  if (v.includes("데이터") || v.includes("data")) return "data";
  if (v.includes("계정") || v.includes("로그인") || v.includes("account") || v.includes("login")) {
    return "account";
  }
  return "etc";
}

function normalizeStatusKey(raw: string): "processing" | "done" {
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

function mapInquiryDetailToView(item: InquiryDetail): InquiryDetailView {
  const typeKey = normalizeTypeKey(item.inquiry_type);
  const status = normalizeStatusKey(item.status);

  const body = (typeof item.content === "string" && item.content.trim()
    ? item.content
    : typeof item.message === "string"
      ? item.message
      : ""
  ).trim();

  const answerBody = (item.admin_message ?? "").trim();
  const answerAt = item.answered_at ?? item.answer_updated_at ?? item.processed_at ?? null;
  const answerTeamLabel = "Newsight 운영팀";

  return {
    inquirySeq: Number(item.inquiry_seq),
    title: item.title ?? "(제목 없음)",
    body,
    author: item.writer_user_id ?? "-",
    createdAt: formatDateTime(item.created_at),
    status,
    statusLabel: status === "processing" ? "처리 중" : "답변 완료",
    isPrivate: Boolean(item.is_private),
    typeKey,
    typeLabel: TYPE_LABEL[typeKey],
    answer:
      answerBody.length > 0
        ? {
            teamLabel: answerTeamLabel,
            answeredAt: formatDateTime(answerAt),
            body: answerBody,
          }
        : undefined,
  };
}

function resolveInquiryDetailUiError(error: unknown): InquiryDetailUiError {
  if (error instanceof ApiClientError) {
    if (error.isNetworkError) {
      return {
        title: "서버에 연결할 수 없습니다.",
        body: "네트워크 연결 상태를 확인한 뒤 잠시 후 다시 시도해주세요.",
        badgeLabel: "연결 오류",
      };
    }

    if (error.status === 403) {
      return {
        title: "비공개 문의입니다.",
        body: "비공개 문의글은 작성자만 열람할 수 있습니다.",
        badgeLabel: "접근 제한",
      };
    }

    if (error.status === 404) {
      return {
        title: "문의를 찾을 수 없습니다.",
        body: "삭제되었거나 존재하지 않는 문의입니다.",
        badgeLabel: "없음",
      };
    }
  }

  return {
    title: "문의를 불러올 수 없습니다.",
    body: "잠시 후 다시 시도해주세요.",
    badgeLabel: "오류",
  };
}

export default function InquiryDetailPage() {
  const { auth } = useAuth();
  const location = useLocation();
  const params = useParams();

  const inquiryId = toNumberSafe(params.inquiryId);
  const [isLoading, setIsLoading] = useState(true);
  const [uiError, setUiError] = useState<InquiryDetailUiError | null>(null);
  const [inquiry, setInquiry] = useState<InquiryDetailView | null>(null);

  const myAuthorTokens = useMemo(() => {
    const set = new Set<string>();
    if (auth.userId?.trim()) set.add(auth.userId.trim());
    if (auth.userName?.trim()) set.add(auth.userName.trim());
    set.add("newsight_user_me");
    return set;
  }, [auth.userId, auth.userName]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!auth.isAuthed) return;

      if (!Number.isFinite(inquiryId)) {
        setInquiry(null);
        setUiError({
          title: "잘못된 문의 번호입니다.",
          body: "문의 번호를 다시 확인한 뒤 목록에서 다시 선택해주세요.",
          badgeLabel: "잘못된 요청",
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setUiError(null);

      try {
        const res = await getInquiryDetail(inquiryId);
        if (cancelled) return;
        setInquiry(mapInquiryDetailToView(res.inquiry));
      } catch (error) {
        if (cancelled) return;
        console.error("문의 상세 조회 실패", error);
        setInquiry(null);
        setUiError(resolveInquiryDetailUiError(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthed, inquiryId]);

  if (!auth.isAuthed) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  const isAdmin = auth.role === "ADMIN" || auth.role === "SUPER_ADMIN";
  const isMine = inquiry ? myAuthorTokens.has((inquiry.author ?? "").trim()) : false;

  if (isLoading) {
    return (
      <main className={styles.pageRoot}>
        <div className={styles.breadcrumb}>
          <Link to="/">메인</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <Link to="/inquiries">문의 게시판</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>문의 상세</span>
        </div>

        <Link to="/inquiries" className={styles.backLink}>
          <span className={styles.arrow}>←</span> 목록으로 돌아가기
        </Link>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>문의 상세를 불러오는 중입니다.</div>
            </div>
            <span className={styles.badgeSoft}>로딩</span>
          </div>
        </article>
      </main>
    );
  }

  if (uiError || !inquiry) {
    return (
      <main className={styles.pageRoot}>
        <div className={styles.breadcrumb}>
          <Link to="/">메인</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <Link to="/inquiries">문의 게시판</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>문의 상세</span>
        </div>

        <Link to="/inquiries" className={styles.backLink}>
          <span className={styles.arrow}>←</span> 목록으로 돌아가기
        </Link>

        <section className={styles.detailHero}>
          <div className={styles.detailTitleBlock}>
            <h1 className={styles.detailTitle}>문의 상세</h1>
          </div>
        </section>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>{uiError?.title ?? "문의를 불러올 수 없습니다."}</div>
            </div>
            <span className={styles.badgeSoft}>{uiError?.badgeLabel ?? "오류"}</span>
          </div>

          <div className={styles.bodyText}>{uiError?.body ?? "잠시 후 다시 시도해주세요."}</div>
        </article>
      </main>
    );
  }

  if (inquiry.isPrivate && !isMine && !isAdmin) {
    return (
      <main className={styles.pageRoot}>
        <div className={styles.breadcrumb}>
          <Link to="/">메인</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <Link to="/inquiries">문의 게시판</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>문의 상세</span>
        </div>

        <Link to="/inquiries" className={styles.backLink}>
          <span className={styles.arrow}>←</span> 목록으로 돌아가기
        </Link>

        <section className={styles.detailHero}>
          <div className={styles.detailTitleBlock}>
            <h1 className={styles.detailTitle}>문의 상세</h1>
          </div>
        </section>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>비공개 문의입니다.</div>
            </div>
            <span className={styles.badgeSoft}>접근 제한</span>
          </div>

          <div className={styles.bodyText}>비공개 문의글은 작성자 또는 관리자만 열람할 수 있습니다.</div>
        </article>
      </main>
    );
  }

  return (
    <main className={styles.pageRoot}>
      <div className={styles.breadcrumb}>
        <Link to="/">메인</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <Link to="/inquiries">문의 게시판</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <span>문의 상세</span>
      </div>

      <Link to="/inquiries" className={styles.backLink}>
        <span className={styles.arrow}>←</span> 목록으로 돌아가기
      </Link>

      <section className={styles.detailHero}>
        <div className={styles.detailTitleBlock}>
          <h1 className={styles.detailTitle}>문의 상세</h1>
        </div>
      </section>

      <section className={styles.detailLayout}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>{inquiry.title}</div>
            </div>
            <span className={styles.badgeSoft}>문의 글</span>
          </div>

          <div className={styles.metaRowTop}>
            <span className={`${styles.inquiryTypePill} ${styles[inquiry.typeKey] ?? ""}`}>
              {inquiry.typeLabel}
            </span>

            {isMine ? <span className={styles.myPill}>MY</span> : null}
            {inquiry.isPrivate ? <span className={styles.lockPill}>🔒비공개</span> : null}

            <span className={styles.statusBadge}>
              <span
                className={`${styles.statusDot} ${
                  inquiry.status === "processing" ? styles.dotProcessing : styles.dotDone
                }`}
              />
              {inquiry.statusLabel}
            </span>
          </div>

          <div className={styles.metaRowBottom}>
            <div>
              <span className={styles.metaItemLabel}>작성자</span>
              <span className={styles.metaItemValue}>{inquiry.author}</span>
            </div>
            <div>
              <span className={styles.metaItemLabel}>등록일</span>
              <span className={styles.metaItemValue}>{inquiry.createdAt}</span>
            </div>
          </div>

          <div className={styles.dividerLine} />

          <div className={styles.inquiryBody}>
            {splitParagraphs(inquiry.body).length > 0 ? (
              splitParagraphs(inquiry.body).map((p, idx) => <p key={idx}>{p}</p>)
            ) : (
              <p>문의 내용이 없습니다.</p>
            )}
          </div>
        </article>

        {inquiry.answer ? (
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>관리자 답변</div>
              </div>
              <span className={styles.badgeSoft}>운영팀</span>
            </div>

            <div className={styles.answerMeta}>
              {inquiry.answer.teamLabel} · {inquiry.answer.answeredAt}
            </div>

            <div className={styles.dividerLine} />

            <div className={styles.answerBody}>
              {splitParagraphs(inquiry.answer.body).map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
