import styles from "./MediaSummaryAnalysisSection.module.css";

type MediaSummaryAnalysisSectionProps = {
  summaryCardError: string | null;
  isSummaryCardLoading: boolean;
  selectedKeywordSeq: number | null;
  selectedKeywordLabel: string;
  aiSummaryText: string;
};

export default function MediaSummaryAnalysisSection({
  summaryCardError,
  isSummaryCardLoading,
  selectedKeywordSeq,
  selectedKeywordLabel,
  aiSummaryText,
}: MediaSummaryAnalysisSectionProps) {
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
        {summaryCardError ? (
          <span className={styles.statusError}>{summaryCardError}</span>
        ) : isSummaryCardLoading ? (
          "데이터를 불러오는 중입니다..."
        ) : selectedKeywordSeq == null || !selectedKeywordLabel ? (
          "최근 7일 기준으로 비교 가능한 키워드가 없습니다."
        ) : aiSummaryText.trim() ? (
          aiSummaryText
        ) : (
          "요약 데이터가 없습니다."
        )}
      </div>
    </article>
  );
}
