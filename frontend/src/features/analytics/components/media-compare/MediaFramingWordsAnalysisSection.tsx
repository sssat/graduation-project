import styles from "./MediaFramingWordsAnalysisSection.module.css";

type MediaFramingRow = {
  key: string;
  label: string;
  topWords: string[];
};

type MediaFramingWordsAnalysisSectionProps = {
  isDetailLoading: boolean;
  detailError: string | null;
  rows: MediaFramingRow[];
};

export default function MediaFramingWordsAnalysisSection({
  isDetailLoading,
  detailError,
  rows,
}: MediaFramingWordsAnalysisSectionProps) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>언론사별 대표 단어 비교</div>
          <div className={styles.cardSub}>
            선택한 키워드 기사에서 각 언론사별로 상위 5개 단어를 뽑아 어떤 관점으로 보도하는지
            비교합니다.
          </div>
        </div>
        <span className={styles.badgeSoft}>텍스트 프레이밍</span>
      </div>

      {isDetailLoading ? (
        <div className={styles.statusText}>대표 단어 데이터를 불러오는 중입니다...</div>
      ) : detailError ? (
        <div className={styles.statusError}>{detailError}</div>
      ) : rows.length === 0 ? (
        <div className={styles.statusText}>표시할 대표 단어 데이터가 없습니다.</div>
      ) : (
        <div className={styles.framingList}>
          {rows.map((row) => (
            <div key={row.key} className={styles.framingItem}>
              <div className={styles.framingMedia}>{row.label}</div>

              <div className={styles.framingKeywords} aria-label={`${row.label} 대표 단어`}>
                {row.topWords.length > 0 ? (
                  row.topWords.map((word, index) => (
                    <span key={`${row.key}-${word}-${index}`} className={styles.keywordTagNeutral}>
                      {word}
                    </span>
                  ))
                ) : (
                  <span className={styles.statusText}>단어 데이터 없음</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
