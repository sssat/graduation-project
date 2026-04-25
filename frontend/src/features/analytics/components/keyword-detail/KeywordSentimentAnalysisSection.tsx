import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { ContentSentimentResponse } from "../../../../api/analytics";
import { readThemeVar } from "../shared/chartTheme";
import styles from "./KeywordSentimentAnalysisSection.module.css";

type KeywordSentimentAnalysisSectionProps = {
  sentiment: ContentSentimentResponse;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function KeywordSentimentAnalysisSection({
  sentiment,
}: KeywordSentimentAnalysisSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"doughnut"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const colors = {
      positive: readThemeVar(canvasRef.current, "--ns-sent-pos", "#22c55e"),
      neutral: readThemeVar(canvasRef.current, "--ns-sent-neu", "#3b82f6"),
      negative: readThemeVar(canvasRef.current, "--ns-sent-neg", "#ef4444"),
    };

    const sentimentPieCalloutPlugin = {
      id: "sentimentPieCallout",
      afterDatasetsDraw(chartInstance: Chart<"doughnut">) {
        const dataset = chartInstance.data.datasets[0];
        if (!dataset) return;

        const labels = (chartInstance.data.labels ?? []).map((label) => String(label ?? ""));
        const values = (dataset.data as Array<number | string | null | undefined>).map((value) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : 0;
        });
        const total = values.reduce((sum, value) => sum + value, 0);
        if (total <= 0) return;

        const backgroundColors = Array.isArray(dataset.backgroundColor)
          ? dataset.backgroundColor
          : [dataset.backgroundColor];
        const arcs = chartInstance.getDatasetMeta(0).data;
        const {
          ctx: chartCtx,
          chartArea: { top, right, bottom, left },
        } = chartInstance;

        chartCtx.save();
        chartCtx.font = '700 14px "Segoe UI", sans-serif';
        chartCtx.textBaseline = "middle";

        const calloutRadialOffset = 38;
        const calloutHorizontalOffset = 78;

        arcs.forEach((arc, index) => {
          const value = values[index] ?? 0;
          if (value <= 0) return;

          const arcElement = arc as unknown as {
            x: number;
            y: number;
            startAngle: number;
            endAngle: number;
            outerRadius: number;
          };

          const midAngle = (arcElement.startAngle + arcElement.endAngle) / 2;
          const cos = Math.cos(midAngle);
          const sin = Math.sin(midAngle);
          const isRight = cos >= 0;

          const startX = arcElement.x + cos * (arcElement.outerRadius * 0.98);
          const startY = arcElement.y + sin * (arcElement.outerRadius * 0.98);
          const bendX = arcElement.x + cos * (arcElement.outerRadius + calloutRadialOffset);
          const bendY = arcElement.y + sin * (arcElement.outerRadius + calloutRadialOffset);

          const endX = clamp(
            bendX + (isRight ? calloutHorizontalOffset : -calloutHorizontalOffset),
            left + 12,
            right - 12,
          );
          const endY = clamp(bendY + sin * 6, top + 14, bottom - 14);

          const color = String(backgroundColors[index] ?? backgroundColors[0] ?? "#334155");
          chartCtx.beginPath();
          chartCtx.moveTo(startX, startY);
          chartCtx.quadraticCurveTo(bendX, bendY, endX, endY);
          chartCtx.lineWidth = 2;
          chartCtx.strokeStyle = color;
          chartCtx.globalAlpha = 0.65;
          chartCtx.stroke();

          chartCtx.globalAlpha = 1;
          chartCtx.beginPath();
          chartCtx.arc(endX, endY, 5.5, 0, Math.PI * 2);
          chartCtx.fillStyle = color;
          chartCtx.fill();

          const percent = Math.round((value / total) * 100);
          chartCtx.textAlign = isRight ? "left" : "right";
          chartCtx.fillStyle = "#334155";
          chartCtx.fillText(`${labels[index] ?? ""} ${percent}%`, endX + (isRight ? 10 : -10), endY);
        });

        chartCtx.restore();
      },
    };

    const chart = new Chart(ctx, {
      type: "doughnut",
      plugins: [sentimentPieCalloutPlugin],
      data: {
        labels: ["긍정", "중립", "부정"],
        datasets: [
          {
            data: [sentiment.positive, sentiment.neutral, sentiment.negative],
            backgroundColor: [colors.positive, colors.neutral, colors.negative],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        radius: "86%",
        cutout: "43%",
        layout: {
          padding: {
            top: 18,
            right: 58,
            bottom: 18,
            left: 58,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label ?? ""}: ${context.parsed ?? 0}%`;
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
  }, [sentiment]);

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>감성 분석 결과</div>
          <div className={styles.cardSub}>기사 본문을 기반으로 긍정/중립/부정 비율을 집계했습니다.</div>
        </div>
        <span className={styles.badgeSoft}>텍스트 감성</span>
      </div>

      <div className={styles.sentimentLayout}>
        <div className={styles.sentimentSummary}>
          <div className={`${styles.sentimentMetric} ${styles.sentimentMetricPositive}`}>
            <div className={styles.sentimentMetricHeader}>
              <span className={`${styles.sentimentMetricSwatch} ${styles.swatchPositive}`} />
              <span className={styles.sentimentMetricLabel}>긍정 (Positive)</span>
            </div>
            <div className={styles.sentimentMetricValueRow}>
              <div className={styles.sentimentMetricValue}>{sentiment.positive}</div>
              <span className={styles.sentimentMetricUnit}>%</span>
            </div>
          </div>

          <div className={`${styles.sentimentMetric} ${styles.sentimentMetricNeutral}`}>
            <div className={styles.sentimentMetricHeader}>
              <span className={`${styles.sentimentMetricSwatch} ${styles.swatchNeutral}`} />
              <span className={styles.sentimentMetricLabel}>중립 (Neutral)</span>
            </div>
            <div className={styles.sentimentMetricValueRow}>
              <div className={styles.sentimentMetricValue}>{sentiment.neutral}</div>
              <span className={styles.sentimentMetricUnit}>%</span>
            </div>
          </div>

          <div className={`${styles.sentimentMetric} ${styles.sentimentMetricNegative}`}>
            <div className={styles.sentimentMetricHeader}>
              <span className={`${styles.sentimentMetricSwatch} ${styles.swatchNegative}`} />
              <span className={styles.sentimentMetricLabel}>부정 (Negative)</span>
            </div>
            <div className={styles.sentimentMetricValueRow}>
              <div className={styles.sentimentMetricValue}>{sentiment.negative}</div>
              <span className={styles.sentimentMetricUnit}>%</span>
            </div>
          </div>
        </div>

        <div className={`${styles.chartWrapper} ${styles.sentimentChartWrapper}`}>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </article>
  );
}
