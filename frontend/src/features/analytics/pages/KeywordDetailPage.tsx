import { Link } from "react-router-dom";
import KeywordBiasAnalysisSection from "../components/keyword-detail/KeywordBiasAnalysisSection";
import KeywordNetworkAnalysisSection from "../components/keyword-detail/KeywordNetworkAnalysisSection";
import KeywordSentimentAnalysisSection from "../components/keyword-detail/KeywordSentimentAnalysisSection";
import KeywordSummaryAnalysisSection from "../components/keyword-detail/KeywordSummaryAnalysisSection";
import KeywordTrendTimelineAnalysisSection from "../components/keyword-detail/KeywordTrendTimelineAnalysisSection";
import KeywordWordCloudAnalysisSection from "../components/keyword-detail/KeywordWordCloudAnalysisSection";
import useKeywordDetailAnalysis from "../hooks/useKeywordDetailAnalysis";
import styles from "./KeywordDetailPage.module.css";

export default function KeywordDetailPage() {
  const {
    keywordSeq,
    period,
    setPeriod,
    loading,
    errorMessage,
    viewData,
    meta,
    displayKeyword,
    rangeLabel,
    isInsufficient,
  } = useKeywordDetailAnalysis();

  if (!keywordSeq) {
    return (
      <main className={styles.pageRoot}>
        <section className={styles.keywordHeader}>
          <div className={styles.breadcrumb}>
            <Link to="/">메인</Link>
            <span className={styles.breadcrumbSep}>›</span>
            <span>키워드 상세 분석</span>
          </div>
        </section>

        <section className={styles.grid1}>
          <article className={`${styles.card} ${styles.statusCard}`}>
            <div className={styles.statusTitle}>잘못된 접근입니다</div>
            <div className={styles.statusActions}>
              <Link to="/" className={styles.primaryLinkButton}>
                메인으로 이동
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className={styles.pageRoot}>
        <section className={styles.keywordHeader}>
          <div className={styles.breadcrumb}>
            <Link to="/">메인</Link>
            <span className={styles.breadcrumbSep}>›</span>
            <span>키워드 상세 분석</span>
          </div>
          <div className={styles.keywordTitleRow}>
            <div className={styles.keywordTitleBlock}>
              <div className={styles.keywordChip}>
                키워드 <span className={styles.keywordChipStrong}>{displayKeyword}</span>
              </div>
              <h1 className={styles.keywordMainTitle}>{displayKeyword} 키워드 상세 분석</h1>
              <div className={styles.keywordMeta}>데이터를 불러오는 중입니다...</div>
            </div>

            <div className={styles.filterBar}>
              <div className={styles.filterLabel}>기간</div>
              <div className={styles.filterChipGroup} role="tablist" aria-label="분석 기간 선택">
                <button
                  type="button"
                  className={`${styles.filterChip} ${period === "D7" ? styles.active : ""}`}
                  onClick={() => setPeriod("D7")}
                  role="tab"
                  aria-selected={period === "D7"}
                >
                  최근 7일
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${period === "D14" ? styles.active : ""}`}
                  onClick={() => setPeriod("D14")}
                  role="tab"
                  aria-selected={period === "D14"}
                >
                  최근 14일
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.grid1}>
          <article className={`${styles.card} ${styles.statusCard}`}>
            <div className={styles.statusTitle}>분석 데이터를 불러오는 중입니다</div>
            <div className={styles.statusText}>잠시 후 자동으로 표시됩니다.</div>
          </article>
        </section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className={styles.pageRoot}>
        <section className={styles.keywordHeader}>
          <div className={styles.breadcrumb}>
            <Link to="/">메인</Link>
            <span className={styles.breadcrumbSep}>›</span>
            <span>키워드 상세 분석</span>
          </div>
          <div className={styles.keywordTitleRow}>
            <div className={styles.keywordTitleBlock}>
              <div className={styles.keywordChip}>
                키워드 <span className={styles.keywordChipStrong}>{displayKeyword}</span>
              </div>
              <h1 className={styles.keywordMainTitle}>{displayKeyword} 키워드 상세 분석</h1>
              <div className={styles.keywordMeta}>조회 실패</div>
            </div>
          </div>
        </section>

        <section className={styles.grid1}>
          <article className={`${styles.card} ${styles.statusCard}`}>
            <div className={styles.statusTitle}>데이터를 불러오지 못했습니다</div>
            <div className={styles.statusText}>{errorMessage}</div>
            <div className={styles.statusActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => window.location.reload()}>
                새로고침
              </button>
              <Link to="/" className={styles.primaryLinkButton}>
                메인으로 이동
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (!viewData || !meta || isInsufficient) {
    return null;
  }

  return (
    <main className={styles.pageRoot}>
      <section className={styles.keywordHeader}>
        <div className={styles.breadcrumb}>
          <Link to="/">메인</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>키워드 상세 분석</span>
        </div>

        <div className={styles.keywordTitleRow}>
          <div className={styles.keywordTitleBlock}>
            <div className={styles.keywordChip}>
              키워드 <span className={styles.keywordChipStrong}>{displayKeyword}</span>
            </div>
            <h1 className={styles.keywordMainTitle}>{displayKeyword} 키워드 상세 분석</h1>
            <div className={styles.keywordMeta}>
              분석 기간: {rangeLabel} · 기사 수: {meta.article_count}건 · 분석 언론사: {meta.media_count}개
            </div>
          </div>

          <div className={styles.filterBar}>
            <div className={styles.filterLabel}>기간</div>
            <div className={styles.filterChipGroup} role="tablist" aria-label="분석 기간 선택">
              <button
                type="button"
                className={`${styles.filterChip} ${period === "D7" ? styles.active : ""}`}
                onClick={() => setPeriod("D7")}
                role="tab"
                aria-selected={period === "D7"}
              >
                최근 7일
              </button>
              <button
                className={`${styles.filterChip} ${period === "D14" ? styles.active : ""}`}
                type="button"
                onClick={() => setPeriod("D14")}
                role="tab"
                aria-selected={period === "D14"}
              >
                최근 14일
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.grid1}>
        <KeywordSummaryAnalysisSection summaryText={viewData.summaryText} />
      </section>

      <section className={styles.grid1}>
        <KeywordTrendTimelineAnalysisSection
          fallbackRangeLabel={rangeLabel}
          displayKeyword={displayKeyword}
          trendTimeline={viewData.trendTimeline}
        />
      </section>

      <section className={styles.grid2}>
        <KeywordWordCloudAnalysisSection
          title="제목 워드 클라우드"
          subtitle="수집된 기사 제목에서 자주 등장한 단어를 시각화한 결과입니다."
          badgeText="제목 기반"
          items={viewData.titleWordcloud}
          height={460}
          seed={`${displayKeyword}-${period}-title`}
        />

        <KeywordSentimentAnalysisSection sentiment={viewData.sentiment} />
      </section>

      <section className={styles.grid2}>
        <KeywordBiasAnalysisSection biasItems={viewData.biasItems} />

        <KeywordNetworkAnalysisSection
          displayKeyword={displayKeyword}
          apiNodes={viewData.coocNodes}
          apiEdges={viewData.coocEdges}
          height={500}
          seed={`${displayKeyword}-${period}-cooc`}
        />
      </section>

      <section className={styles.grid2Bottom}>
        <KeywordWordCloudAnalysisSection
          title="댓글 반응 워드 클라우드"
          subtitle="댓글 반응에서 자주 등장한 단어를 시각화한 결과입니다."
          badgeText="댓글 기반"
          items={viewData.commentWordcloud}
          height={460}
          seed={`${displayKeyword}-${period}-comment`}
        />
      </section>
    </main>
  );
}
