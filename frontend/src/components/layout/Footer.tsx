// frontend/src/components/layout/Footer.tsx

import styles from "./Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.siteFooter}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.brandBlock}>
            <div className={styles.brandTitle}>Newsight</div>
            <p className={styles.brandDesc}>
              실시간 뉴스 데이터를 수집·분석하여 키워드, 언론사 비교, 감성 정보를 한
              화면에서 확인하는 인사이트 대시보드입니다.
            </p>
            <p className={styles.meta}>
              대진대학교 AI빅데이터 · 4학년 20201108 이호균
            </p>
          </div>

          <div className={styles.linkBlock} aria-label="푸터 링크">
            <div className={styles.linkCol}>
              <div className={styles.linkTitle}>서비스</div>
              <a className={styles.link} href="/">
                메인
              </a>
              <a className={styles.link} href="/media">
                언론사 비교
              </a>
              <a className={styles.link} href="/inquiries">
                문의하기
              </a>
            </div>

            <div className={styles.linkCol}>
              <div className={styles.linkTitle}>문의</div>
              <a
                className={styles.link}
                href="mailto:leehk00002@naver.com"
                aria-label="이메일로 문의하기"
              >
                leehk00002@naver.com
              </a>
              <span className={styles.subText}>평일 10:00–18:00 (KST)</span>
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.copy}>© {year} Newsight. Graduation Project.</p>
        </div>
      </div>
    </footer>
  );
}
