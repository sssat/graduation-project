import { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";
import { readThemeVar } from "../shared/chartTheme";
import styles from "./MediaSentimentAnalysisSection.module.css";

type MediaSentimentRow = {
  label: string;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
};

type MediaSentimentAnalysisSectionProps = {
  rows: MediaSentimentRow[];
  detailError: string | null;
};

type SentimentKey = "positive" | "neutral" | "negative";

const SENTIMENT_ITEMS: Array<{
  key: SentimentKey;
  label: string;
  fillClassName: "fillPositive" | "fillNeutral" | "fillNegative";
}> = [
  {
    key: "positive",
    label: "긍정",
    fillClassName: "fillPositive",
  },
  {
    key: "neutral",
    label: "중립",
    fillClassName: "fillNeutral",
  },
  {
    key: "negative",
    label: "부정",
    fillClassName: "fillNegative",
  },
];

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function findDominantSentiment(row: MediaSentimentRow | null) {
  if (!row) return null;

  return SENTIMENT_ITEMS.reduce((best, item) => {
    const currentValue = row.sentiment[item.key];
    if (!best || currentValue > best.value) {
      return {
        key: item.key,
        label: item.label,
        value: currentValue,
      };
    }

    return best;
  }, null as null | { key: SentimentKey; label: string; value: number });
}

function findTopMediaRow(rows: MediaSentimentRow[], key: SentimentKey) {
  if (!rows.length) return null;

  return rows.reduce((best, row) => {
    if (!best || row.sentiment[key] > best.sentiment[key]) {
      return row;
    }

    return best;
  }, null as MediaSentimentRow | null);
}

export default function MediaSentimentAnalysisSection({
  rows,
  detailError,
}: MediaSentimentAnalysisSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);
  const overallRow = useMemo(() => rows.find((row) => row.label === "전체") ?? null, [rows]);
  const mediaRows = useMemo(() => rows.filter((row) => row.label !== "전체"), [rows]);
  const dominantSentiment = useMemo(() => findDominantSentiment(overallRow), [overallRow]);
  const mostPositiveRow = useMemo(() => findTopMediaRow(mediaRows, "positive"), [mediaRows]);
  const mostNegativeRow = useMemo(() => findTopMediaRow(mediaRows, "negative"), [mediaRows]);
  const chartHeight = Math.max(320, mediaRows.length * 52 + 48);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    if (!mediaRows.length) return;

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: mediaRows.map((row) => row.label),
        datasets: [
          {
            label: "긍정",
            data: mediaRows.map((row) => row.sentiment.positive),
            backgroundColor: readThemeVar(canvasRef.current, "--ns-sent-pos", "#22c55e"),
            borderWidth: 0,
            borderRadius: {
              topLeft: 6,
              topRight: 6,
              bottomLeft: 6,
              bottomRight: 6,
            },
            borderSkipped: false,
            barPercentage: 0.82,
            categoryPercentage: 0.72,
          },
          {
            label: "중립",
            data: mediaRows.map((row) => row.sentiment.neutral),
            backgroundColor: readThemeVar(canvasRef.current, "--ns-sent-neu", "#3b82f6"),
            borderWidth: 0,
            borderRadius: {
              topLeft: 6,
              topRight: 6,
              bottomLeft: 6,
              bottomRight: 6,
            },
            borderSkipped: false,
            barPercentage: 0.82,
            categoryPercentage: 0.72,
          },
          {
            label: "부정",
            data: mediaRows.map((row) => row.sentiment.negative),
            backgroundColor: readThemeVar(canvasRef.current, "--ns-sent-neg", "#ef4444"),
            borderWidth: 0,
            borderRadius: {
              topLeft: 6,
              topRight: 6,
              bottomLeft: 6,
              bottomRight: 6,
            },
            borderSkipped: false,
            barPercentage: 0.82,
            categoryPercentage: 0.72,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            grid: { color: "rgba(148,163,184,0.24)" },
            ticks: {
              color: "#64748b",
              font: { size: 11 },
              callback(value) {
                return `${value}%`;
              },
            },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { color: "#334155", font: { size: 12, weight: 700 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${context.parsed.x}%`;
              },
            },
          },
        },
      },
    });

    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [mediaRows]);

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>언론사별 감성 비율 비교</div>
          <div className={styles.cardSub}>
            선택 키워드 기사 본문을 기반으로 긍정/중립/부정 비율을 비교한 결과입니다.
          </div>
        </div>
        <span className={styles.badgeSoft}>감성 분석</span>
      </div>

      {rows.length ? (
        <>
          <div className={styles.summaryStrip}>
            <section className={`${styles.summaryCard} ${styles.summaryCardWide}`}>
              <div className={styles.summaryLabel}>전체 감성 흐름</div>
              {overallRow && dominantSentiment ? (
                <>
                  <div className={`${styles.summaryBody} ${styles.summaryBodyWide}`}>
                    <div>
                      <div className={styles.summaryHeadline}>{dominantSentiment.label} 우세</div>
                      <div className={styles.summarySub}>
                        전체 기사 본문 기준으로 가장 큰 비중을 차지한 감성입니다.
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.summaryFooter} ${styles.summaryFooterWide}`}>
                    <div className={styles.overallBreakdown}>
                    {SENTIMENT_ITEMS.map((item) => (
                      <div key={item.key} className={styles.meterItem}>
                        <div className={styles.meterHeader}>
                          <span className={styles.meterLabel}>{item.label}</span>
                          <strong className={styles.meterValue}>
                            {formatPercent(overallRow.sentiment[item.key])}
                          </strong>
                        </div>
                        <div className={styles.meterTrack}>
                          <div
                            className={`${styles.meterFill} ${styles[item.fillClassName]}`}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, overallRow.sentiment[item.key]),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.statusText}>전체 감성 요약 데이터가 없습니다.</div>
              )}
            </section>

            <section
              className={`${styles.summaryCard} ${styles.summaryCardCompact} ${styles.summaryCardPositiveTone}`}
            >
              <div className={styles.summaryLabel}>가장 긍정적</div>
              <div className={styles.summaryBody}>
                <div className={styles.metricName}>{mostPositiveRow?.label ?? "-"}</div>
                <div className={styles.metricSub}>
                  {mostPositiveRow
                    ? `긍정 ${formatPercent(mostPositiveRow.sentiment.positive)}`
                    : "비교 가능한 데이터 없음"}
                </div>
              </div>

              <div className={styles.summaryFooter}>
                <div className={styles.footerMetricRow}>
                  <span className={styles.footerMetricLabel}>긍정 비중</span>
                  <strong className={styles.footerMetricValue}>
                    {mostPositiveRow ? formatPercent(mostPositiveRow.sentiment.positive) : "-"}
                  </strong>
                </div>
                <div className={styles.footerTrack}>
                  <div
                    className={`${styles.footerFill} ${styles.fillPositive}`}
                    style={{
                      width: `${
                        mostPositiveRow
                          ? Math.max(0, Math.min(100, mostPositiveRow.sentiment.positive))
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </section>

            <section
              className={`${styles.summaryCard} ${styles.summaryCardCompact} ${styles.summaryCardNegativeTone}`}
            >
              <div className={styles.summaryLabel}>가장 부정적</div>
              <div className={styles.summaryBody}>
                <div className={styles.metricName}>{mostNegativeRow?.label ?? "-"}</div>
                <div className={styles.metricSub}>
                  {mostNegativeRow
                    ? `부정 ${formatPercent(mostNegativeRow.sentiment.negative)}`
                    : "비교 가능한 데이터 없음"}
                </div>
              </div>

              <div className={styles.summaryFooter}>
                <div className={styles.footerMetricRow}>
                  <span className={styles.footerMetricLabel}>부정 비중</span>
                  <strong className={styles.footerMetricValue}>
                    {mostNegativeRow ? formatPercent(mostNegativeRow.sentiment.negative) : "-"}
                  </strong>
                </div>
                <div className={styles.footerTrack}>
                  <div
                    className={`${styles.footerFill} ${styles.fillNegative}`}
                    style={{
                      width: `${
                        mostNegativeRow
                          ? Math.max(0, Math.min(100, mostNegativeRow.sentiment.negative))
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </section>
          </div>

          {mediaRows.length ? (
            <div className={styles.chartWrapperTall} style={{ height: `${chartHeight}px` }}>
              <canvas ref={canvasRef} />
            </div>
          ) : (
            <div className={styles.statusText}>표시할 감성 비교 데이터가 없습니다.</div>
          )}
        </>
      ) : (
        <div className={styles.statusText}>표시할 감성 비교 데이터가 없습니다.</div>
      )}

      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchPositive}`} />
          긍정 (Positive)
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchNeutral}`} />
          중립 (Neutral)
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchNegative}`} />
          부정 (Negative)
        </div>
      </div>
      {detailError && <div className={styles.statusError}>{detailError}</div>}
    </article>
  );
}
