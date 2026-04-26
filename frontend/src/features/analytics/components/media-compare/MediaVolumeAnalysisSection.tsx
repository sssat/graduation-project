import styles from "./MediaVolumeAnalysisSection.module.css";

type MediaVolumeRow = {
  label: string;
  volume: number;
};

type MediaVolumeAnalysisSectionProps = {
  rows: MediaVolumeRow[];
  detailError: string | null;
};

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("ko-KR") : "0";
}

function formatShare(value: number) {
  return `${Math.round(value)}%`;
}

export default function MediaVolumeAnalysisSection({
  rows,
  detailError,
}: MediaVolumeAnalysisSectionProps) {
  const rankedRows = [...rows].sort((a, b) => b.volume - a.volume);
  const totalVolume = rankedRows.reduce((total, row) => total + row.volume, 0);
  const topRow = rankedRows[0] ?? null;
  const bottomRow = rankedRows[rankedRows.length - 1] ?? null;
  const maxVolume = Math.max(...rankedRows.map((row) => row.volume), 0);
  const topShare = topRow && totalVolume > 0 ? (topRow.volume / totalVolume) * 100 : 0;
  const bottomShare = bottomRow && totalVolume > 0 ? (bottomRow.volume / totalVolume) * 100 : 0;

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>언론사별 기사량 TOP</div>
          <div className={styles.cardSub}>
            선택한 키워드에 대해 수집된 기사 건수를 언론사별로 정렬한 결과입니다.
          </div>
        </div>
        <span className={styles.badgeSoft}>기사량 지표</span>
      </div>

      {rows.length ? (
        <>
          <div className={styles.summaryStrip}>
            <section className={`${styles.summaryPanel} ${styles.summaryPanelLead}`}>
              <div className={styles.summaryLabel}>최다 보도 언론사</div>
              <div className={styles.summaryValue}>{topRow?.label ?? "-"}</div>
              <div className={styles.summarySub}>
                {topRow
                  ? `${formatNumber(topRow.volume)}건 · 전체 대비 ${formatShare(topShare)}`
                  : "기사량 데이터 없음"}
              </div>
            </section>

            <section className={`${styles.summaryPanel} ${styles.summaryPanelLow}`}>
              <div className={styles.summaryLabel}>최소 보도 언론사</div>
              <div className={styles.summaryValue}>{bottomRow?.label ?? "-"}</div>
              <div className={styles.summarySub}>
                {bottomRow
                  ? `${formatNumber(bottomRow.volume)}건 · 전체 대비 ${formatShare(bottomShare)}`
                  : "기사량 데이터 없음"}
              </div>
            </section>

            <section className={styles.summaryPanel}>
              <div className={styles.summaryLabel}>전체 기사 수</div>
              <div className={styles.summaryValue}>{formatNumber(totalVolume)}</div>
              <div className={styles.summarySub}>전체 언론사 합산 기준</div>
            </section>
          </div>

          <div className={styles.rankList} aria-label="언론사별 기사량 순위">
            {rankedRows.map((row, index) => {
              const rank = index + 1;
              const width = maxVolume > 0 ? (row.volume / maxVolume) * 100 : 0;
              const share = totalVolume > 0 ? (row.volume / totalVolume) * 100 : 0;

              return (
                <div
                  key={row.label}
                  className={`${styles.rankRow} ${rank === 1 ? styles.rankRowTop : ""}`}
                >
                  <div className={styles.rankMeta}>
                    <span className={styles.rankNo}>{String(rank).padStart(2, "0")}</span>
                    <span className={styles.rankTextGroup}>
                      <span className={styles.rankLabel}>{row.label}</span>
                      <span className={styles.rankValue}>
                        <strong>{formatNumber(row.volume)}건</strong>
                        <span>{formatShare(share)}</span>
                      </span>
                    </span>
                  </div>

                  <div className={styles.rankBarCell}>
                    <div className={styles.rankTrack}>
                      <div className={styles.rankFill} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.statusText}>표시할 기사량 데이터가 없습니다.</div>
      )}

      <div className={styles.biasCaption}>
        기사 수는 선택 키워드와 분석 기간에 포함된 수집 기사 기준입니다.
      </div>
      {detailError && <div className={styles.statusError}>{detailError}</div>}
    </article>
  );
}
