import { useEffect, useRef } from "react";
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

export default function MediaSentimentAnalysisSection({
  rows,
  detailError,
}: MediaSentimentAnalysisSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    if (!rows.length) return;

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: rows.map((row) => row.label),
        datasets: [
          {
            label: "긍정",
            data: rows.map((row) => row.sentiment.positive),
            backgroundColor: readThemeVar(canvasRef.current, "--ns-sent-pos", "#38bdf8"),
            borderWidth: 0,
          },
          {
            label: "중립",
            data: rows.map((row) => row.sentiment.neutral),
            backgroundColor: readThemeVar(canvasRef.current, "--ns-sent-neu", "#2563eb"),
            borderWidth: 0,
          },
          {
            label: "부정",
            data: rows.map((row) => row.sentiment.negative),
            backgroundColor: readThemeVar(canvasRef.current, "--ns-sent-neg", "#1e3a8a"),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: "#64748b", font: { size: 11 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            grid: { color: "rgba(148,163,184,0.32)" },
            ticks: {
              color: "#64748b",
              font: { size: 11 },
              callback(value) {
                return `${value}%`;
              },
            },
          },
        },
        plugins: {
          legend: { labels: { color: "#334155", font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${context.parsed.y}%`;
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
  }, [rows]);

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
        <div className={styles.chartWrapperTall}>
          <canvas ref={canvasRef} />
        </div>
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
