import BiasAnalysisChart from "../shared/BiasAnalysisChart";
import styles from "./MediaBiasAnalysisSection.module.css";

type MediaBiasRow = {
  label: string;
  bias: number;
};

type MediaBiasAnalysisSectionProps = {
  biasRows: MediaBiasRow[];
  detailError: string | null;
};

type BiasPoint = {
  label: string;
  score: number;
};

function formatBiasScore(score: number) {
  const numeric = Number.isFinite(score) ? score : 0;
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(1)}`;
}

function getMostPositive(points: BiasPoint[]) {
  if (!points.length) return null;
  return [...points].sort((a, b) => b.score - a.score)[0] ?? null;
}

function getMostNegative(points: BiasPoint[]) {
  if (!points.length) return null;
  return [...points].sort((a, b) => a.score - b.score)[0] ?? null;
}

function getMostNeutral(points: BiasPoint[]) {
  if (!points.length) return null;
  return [...points].sort((a, b) => Math.abs(a.score) - Math.abs(b.score))[0] ?? null;
}

export default function MediaBiasAnalysisSection({
  biasRows,
  detailError,
}: MediaBiasAnalysisSectionProps) {
  const points = biasRows.map((row) => ({
    label: row.label,
    score: row.bias,
  }));
  const mostPositive = getMostPositive(points);
  const mostNegative = getMostNegative(points);
  const mostNeutral = getMostNeutral(points);

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>언론사별 편향도 지수</div>
          <div className={styles.cardSub}>
            선택 키워드 기사들의 본문 감성 흐름을 기반으로 산출한 지표입니다 (0에 가까울수록 중립).
          </div>
        </div>
        <span className={styles.badgeSoft}>편향도 분석</span>
      </div>

      {points.length ? (
        <>
          <div className={styles.summaryStrip}>
            <section className={`${styles.summaryCard} ${styles.summaryCardPositive}`}>
              <div className={styles.summaryLabel}>가장 우호적</div>
              <div className={styles.summaryBody}>
                <div className={styles.summaryMedia}>{mostPositive?.label ?? "-"}</div>
                <div className={styles.summaryCopy}>우호적인 표현이 상대적으로 많았습니다.</div>
              </div>
              <div className={styles.summaryFooter}>
                <span className={`${styles.scorePill} ${styles.scorePillPositive}`}>
                  {formatBiasScore(mostPositive?.score ?? 0)}
                </span>
              </div>
            </section>

            <section className={`${styles.summaryCard} ${styles.summaryCardNeutral}`}>
              <div className={styles.summaryLabel}>편향도 낮음</div>
              <div className={styles.summaryBody}>
                <div className={styles.summaryMedia}>{mostNeutral?.label ?? "-"}</div>
                <div className={styles.summaryCopy}>한쪽으로 크게 치우치지 않은 편입니다.</div>
              </div>
              <div className={styles.summaryFooter}>
                <span className={`${styles.scorePill} ${styles.scorePillNeutral}`}>
                  {formatBiasScore(mostNeutral?.score ?? 0)}
                </span>
              </div>
            </section>

            <section className={`${styles.summaryCard} ${styles.summaryCardNegative}`}>
              <div className={styles.summaryLabel}>가장 비판적</div>
              <div className={styles.summaryBody}>
                <div className={styles.summaryMedia}>{mostNegative?.label ?? "-"}</div>
                <div className={styles.summaryCopy}>비판적인 표현이 상대적으로 많았습니다.</div>
              </div>
              <div className={styles.summaryFooter}>
                <span className={`${styles.scorePill} ${styles.scorePillNegative}`}>
                  {formatBiasScore(mostNegative?.score ?? 0)}
                </span>
              </div>
            </section>
          </div>

          <div className={styles.chartShell}>
            <div className={styles.biasLegend} aria-label="편향도 해석 안내">
              <div className={`${styles.legendItem} ${styles.legendItemNegative}`}>
                <span className={styles.legendDot} aria-hidden="true" />
                <span>음수는 비판적 경향</span>
              </div>
              <div className={`${styles.legendItem} ${styles.legendItemNeutral}`}>
                <span className={styles.legendDot} aria-hidden="true" />
                <span>0은 편향도 낮음</span>
              </div>
              <div className={`${styles.legendItem} ${styles.legendItemPositive}`}>
                <span className={styles.legendDot} aria-hidden="true" />
                <span>양수는 우호적 경향</span>
              </div>
            </div>

            <BiasAnalysisChart
              points={points}
              className={`${styles.chartWrapper} ${styles.biasChartWrapper}`}
            />
          </div>
        </>
      ) : (
        <div className={styles.emptyBox}>표시할 편향도 데이터가 없습니다.</div>
      )}

      <div className={styles.biasCaption}>
        편향도 지수는 본문 감성 분석을 바탕으로 계산되지만, 단순 감성 비율이 아니라 보도 흐름이
        어느 방향의 경향을 보이는지를 보여줍니다. 점수의 <strong>절대값이 클수록</strong>{" "}
        특정 방향성이 더 뚜렷하며, <strong>0에 가까울수록</strong> 상대적으로 균형적인 해석이
        가능합니다.
      </div>
      {detailError && <div className={styles.statusError}>{detailError}</div>}
    </article>
  );
}
