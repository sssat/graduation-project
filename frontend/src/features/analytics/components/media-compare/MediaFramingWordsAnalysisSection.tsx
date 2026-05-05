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

function getMediaMark(label: string) {
  const compact = String(label ?? "").replace(/\s+/g, "");
  if (compact === "한겨레") {
    return { text: "한겨레", isWide: false, isStacked: false };
  }
  if (compact === "오마이뉴스") {
    return { text: "오마이\n뉴스", isWide: false, isStacked: true };
  }

  return { text: compact.slice(0, 2) || "NS", isWide: false, isStacked: false };
}

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
        <>
          <div className={styles.framingList}>
            {rows.map((row) => {
              const words = row.topWords.filter((word) => String(word ?? "").trim());
              const leadWord = words[0];
              const supportingWords = words.slice(1, 5);
              const mediaMark = getMediaMark(row.label);

              return (
                <section key={row.key} className={styles.framingItem}>
                  <div className={styles.framingTop}>
                    <div className={styles.framingIdentity}>
                      <div
                        className={`${styles.mediaOrb} ${mediaMark.isWide ? styles.mediaOrbWide : ""} ${
                          mediaMark.isStacked ? styles.mediaOrbStacked : ""
                        }`}
                        aria-hidden="true"
                      >
                        {mediaMark.text}
                      </div>
                      <div className={styles.framingMediaBlock}>
                        <div className={styles.framingEyebrow}>프레이밍 관점</div>
                        <div className={styles.framingMedia}>{row.label}</div>
                      </div>
                    </div>
                  </div>

                  {leadWord ? (
                    <>
                      <div className={styles.heroWordBlock}>
                        <div className={styles.heroWordLabel}>가장 많이 등장한 단어</div>
                        <div className={styles.heroWord}>{leadWord}</div>
                        <div className={styles.heroWordCaption}>
                          상위 빈도 기준 첫 번째 단어입니다.
                        </div>
                      </div>

                      <div className={styles.framingKeywords} aria-label={`${row.label} 대표 단어`}>
                        {supportingWords.length > 0 ? (
                          supportingWords.map((word, index) => (
                            <div
                              key={`${row.key}-${word}-${index}`}
                              className={styles.keywordCard}
                            >
                              <span className={styles.keywordIndex}>
                                {String(index + 2).padStart(2, "0")}
                              </span>
                              <span className={styles.keywordText}>{word}</span>
                            </div>
                          ))
                        ) : (
                          <div className={styles.emptyState}>추가 대표 단어가 없습니다.</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={styles.emptyState}>표시할 대표 단어가 없습니다.</div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
