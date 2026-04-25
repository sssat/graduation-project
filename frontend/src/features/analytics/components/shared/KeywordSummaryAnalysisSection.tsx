import styles from "./KeywordSummaryAnalysisSection.module.css";

type KeywordSummaryAnalysisSectionProps = {
  summaryText: string;
  errorMessage?: string | null;
  isLoading?: boolean;
  isUnavailable?: boolean;
  unavailableMessage?: string;
  loadingMessage?: string;
  emptyMessage?: string;
};

function splitSummaryParagraphs(summaryText: string) {
  return summaryText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function KeywordSummaryAnalysisSection({
  summaryText,
  errorMessage = null,
  isLoading = false,
  isUnavailable = false,
  unavailableMessage = "요약 가능한 키워드가 없습니다.",
  loadingMessage = "데이터를 불러오는 중입니다...",
  emptyMessage = "요약 데이터가 없습니다.",
}: KeywordSummaryAnalysisSectionProps) {
  const trimmedSummary = summaryText.trim();
  const summaryParagraphs = splitSummaryParagraphs(trimmedSummary);
  const statusMessage = errorMessage
    ? errorMessage
    : isLoading
      ? loadingMessage
      : isUnavailable
        ? unavailableMessage
        : emptyMessage;
  const hasSummary = !errorMessage && !isLoading && !isUnavailable && summaryParagraphs.length > 0;

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>키워드 분석 요약</div>
          <div className={styles.cardSub}>수집된 기사 내용을 바탕으로 생성한 AI 요약입니다.</div>
        </div>
        <span className={styles.badgeSoft}>요약 리포트</span>
      </div>

      <div className={`${styles.reportPanel} ${!hasSummary ? styles.reportPanelState : ""}`}>
        <div className={styles.reportMeta}>
          <span className={styles.reportKicker}>AI SUMMARY</span>
          <span className={styles.reportDivider} aria-hidden="true" />
          <span>기사 기반 자동 요약</span>
        </div>

        {hasSummary ? (
          <div className={styles.summaryBody}>
            {summaryParagraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <div className={`${styles.stateText} ${errorMessage ? styles.stateError : ""}`}>
            {statusMessage}
          </div>
        )}
      </div>
    </article>
  );
}
