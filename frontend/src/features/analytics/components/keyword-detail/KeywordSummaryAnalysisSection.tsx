import styles from "./KeywordSummaryAnalysisSection.module.css";

type KeywordSummaryAnalysisSectionProps = {
  summaryText: string;
};

export default function KeywordSummaryAnalysisSection({
  summaryText,
}: KeywordSummaryAnalysisSectionProps) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>키워드 분석 요약</div>
          <div className={styles.cardSub}>수집된 기사 내용을 바탕으로 생성한 AI 요약입니다.</div>
        </div>
        <span className={styles.badgeSoft}>요약 리포트</span>
      </div>

      <div className={styles.summaryText}>
        {summaryText.trim() ? summaryText : "요약 데이터가 없습니다."}
      </div>
    </article>
  );
}
