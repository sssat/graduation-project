import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { readThemeVar } from "../shared/chartTheme";
import styles from "./MediaVolumeAnalysisSection.module.css";

type MediaVolumeRow = {
  label: string;
  volume: number;
};

type MediaVolumeAnalysisSectionProps = {
  rows: MediaVolumeRow[];
  detailError: string | null;
};

export default function MediaVolumeAnalysisSection({
  rows,
  detailError,
}: MediaVolumeAnalysisSectionProps) {
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
            label: "기사량(건)",
            data: rows.map((row) => row.volume),
            backgroundColor: readThemeVar(canvasRef.current, "--ns-accent-blue", "#38bdf8"),
            borderWidth: 0,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148,163,184,0.32)" },
            ticks: { color: "#64748b", font: { size: 11 }, precision: 0 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label}: ${context.parsed.y}건`;
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
          <div className={styles.cardTitle}>언론사별 기사량 TOP</div>
          <div className={styles.cardSub}>
            선택한 키워드에 대해 수집된 기사 건수를 언론사별로 정렬한 결과입니다.
          </div>
        </div>
        <span className={styles.badgeSoft}>기사량 지표</span>
      </div>

      {rows.length ? (
        <div className={styles.chartWrapper}>
          <canvas ref={canvasRef} />
        </div>
      ) : (
        <div className={styles.statusText}>표시할 기사량 데이터가 없습니다.</div>
      )}

      <div className={styles.biasCaption}>
        막대가 길수록 선택 키워드에 대해 더 많은 기사를 보도한 언론사입니다.
      </div>
      {detailError && <div className={styles.statusError}>{detailError}</div>}
    </article>
  );
}
