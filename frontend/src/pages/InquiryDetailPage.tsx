// frontend/src/pages/InquiryDetailPage.tsx

import { useMemo } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import styles from "./InquiryDetailPage.module.css";
import { getInquiryById } from "../mocks/inquiryMockData";
import { useAuth } from "../hooks/useAuth";

function toNumberSafe(v: string | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function splitParagraphs(text: string) {
  return (text ?? "")
    .split(/\n{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function InquiryDetailPage() {
  // Hook은 항상 최상단에서 동일한 순서로 호출되어야 함
  const { auth } = useAuth();
  const location = useLocation();
  const params = useParams();

  const inquiryId = toNumberSafe(params.inquiryId);

  // 로그인 여부와 상관없이 Hook은 "항상" 실행되도록 위로 올림 (rules-of-hooks 대응)
  const myAuthorTokens = useMemo(() => {
    const set = new Set<string>();
    if (auth.userId?.trim()) set.add(auth.userId.trim());
    if (auth.userName?.trim()) set.add(auth.userName.trim());
    set.add("newsight_user_me");
    return set;
  }, [auth.userId, auth.userName]);

  const inquiry = useMemo(() => {
    if (!Number.isFinite(inquiryId)) return undefined;
    return getInquiryById(inquiryId);
  }, [inquiryId]);

  // 1) 로그인한 사용자만 접속 가능 (Hook 아래에서 처리)
  if (!auth.isAuthed) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  // 추가: 관리자 여부
  const isAdmin = auth.role === "ADMIN" || auth.role === "SUPER_ADMIN";

  if (!inquiry) {
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
              <div className={styles.cardTitle}>존재하지 않는 문의입니다.</div>
            </div>
            <span className={styles.badgeSoft}>오류</span>
          </div>

          <div className={styles.bodyText}>요청하신 문의 번호를 찾을 수 없습니다.</div>
        </article>
      </main>
    );
  }

  const statusLabel = inquiry.status === "processing" ? "처리 중" : "답변 완료";
  const isMine = myAuthorTokens.has((inquiry.author ?? "").trim());

  // 수정: 비공개 글은 "작성자 또는 관리자"만 허용
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

          <div className={styles.bodyText}>작성자 본인만 확인할 수 있습니다.</div>
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
              {statusLabel}
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
            {splitParagraphs(inquiry.body).map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
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
