import { Link } from "react-router-dom";
import MediaBiasAnalysisSection from "../components/media-compare/MediaBiasAnalysisSection";
import MediaFramingWordsAnalysisSection from "../components/media-compare/MediaFramingWordsAnalysisSection";
import MediaSentimentAnalysisSection from "../components/media-compare/MediaSentimentAnalysisSection";
import MediaSummaryAnalysisSection from "../components/media-compare/MediaSummaryAnalysisSection";
import MediaVolumeAnalysisSection from "../components/media-compare/MediaVolumeAnalysisSection";
import useMediaCompareAnalysis from "../hooks/useMediaCompareAnalysis";
import styles from "./MediaComparePage.module.css";

export default function MediaComparePage() {
  const {
    period,
    setPeriod,
    keywordItems,
    selectedKeywordSeq,
    setSelectedKeywordSeq,
    selectedKeywordLabel,
    rows,
    sentimentRows,
    isDetailLoading,
    detailError,
    aiSummaryText,
    summaryCardError,
    isSummaryCardLoading,
    noKeywordAvailable,
    metaRangeLabel,
    headerArticleCount,
    headerMediaCount,
  } = useMediaCompareAnalysis();

  return (
    <main className={styles.pageRoot}>
      <section className={styles.compareHeader}>
        <div className={styles.breadcrumb}>
          <Link to="/">메인</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>언론사 키워드 비교</span>
        </div>

        <div className={styles.compareTitleRow}>
          <div className={styles.compareTitleBlock}>
            <h1 className={styles.compareMainTitle}>언론사별 키워드 보도 비교 대시보드</h1>

            <p className={styles.compareSub}>
              분석 기간: {metaRangeLabel} · 기사 수: {headerArticleCount}건 · 분석 언론사:{" "}
              {headerMediaCount}개
            </p>
          </div>
        </div>

        <div className={styles.keywordFilterRow}>
          <div className={styles.keywordChipGroup} aria-label="TOP 키워드 선택">
            {keywordItems.map((item) => (
              <button
                key={item.keyword_seq}
                type="button"
                className={`${styles.keywordChip} ${
                  selectedKeywordSeq === item.keyword_seq ? styles.keywordChipActive : ""
                }`}
                onClick={() => setSelectedKeywordSeq(item.keyword_seq)}
              >
                {item.keyword}
              </button>
            ))}

            {noKeywordAvailable && (
              <div className={styles.statusText}>
                표시 가능한 키워드(최근 7일 기사 수 10건 이상)가 없습니다.
              </div>
            )}
          </div>

          <div className={styles.periodFilterInline}>
            <div className={styles.filterLabel}>기간</div>
            <div className={styles.filterChipGroup} role="tablist" aria-label="분석 기간 선택">
              <button
                type="button"
                className={`${styles.filterChip} ${period === "7d" ? styles.active : ""}`}
                onClick={() => setPeriod("7d")}
                role="tab"
                aria-selected={period === "7d"}
              >
                최근 7일
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${period === "14d" ? styles.active : ""}`}
                onClick={() => setPeriod("14d")}
                role="tab"
                aria-selected={period === "14d"}
              >
                최근 14일
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.grid1}>
        <MediaSummaryAnalysisSection
          summaryCardError={summaryCardError}
          isSummaryCardLoading={isSummaryCardLoading}
          selectedKeywordSeq={selectedKeywordSeq}
          selectedKeywordLabel={selectedKeywordLabel}
          aiSummaryText={aiSummaryText}
        />
      </section>

      <section className={styles.grid2}>
        <MediaVolumeAnalysisSection
          rows={rows.map((row) => ({ label: row.label, volume: row.volume }))}
          detailError={detailError}
        />

        <MediaBiasAnalysisSection
          biasRows={rows.map((row) => ({ label: row.label, bias: row.bias }))}
          detailError={detailError}
        />
      </section>

      <section className={styles.grid2}>
        <MediaSentimentAnalysisSection rows={sentimentRows} detailError={detailError} />

        <MediaFramingWordsAnalysisSection
          isDetailLoading={isDetailLoading}
          detailError={detailError}
          rows={rows.map((row) => ({ key: row.key, label: row.label, topWords: row.topWords }))}
        />
      </section>
    </main>
  );
}
