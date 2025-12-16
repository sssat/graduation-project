// frontend/src/pages/InquiryDetailPage.tsx

import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import styles from "./InquiryDetailPage.module.css";
import { getInquiryById } from "../mocks/inquiryMockData";

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
  const params = useParams();
  const inquiryId = toNumberSafe(params.inquiryId);

  const inquiry = useMemo(() => {
    if (!Number.isFinite(inquiryId)) return undefined;
    return getInquiryById(inquiryId);
  }, [inquiryId]);

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
        {/* 카드 1: 문의 글 */}
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

        {/* 카드 2: 관리자 답변 (있을 때만) */}
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
