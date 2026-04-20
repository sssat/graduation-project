import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import styles from "./BiasAnalysisChart.module.css";
import { readThemeVar } from "./chartTheme";

export type BiasAnalysisPoint = {
  label: string;
  score: number;
};

type BiasAnalysisChartProps = {
  points: BiasAnalysisPoint[];
  className: string;
};

function resolveBiasAxis(maxAbsValue: number): { axisMax: number; stepSize: number } {
  const safeMax = Number.isFinite(maxAbsValue) ? Math.max(0, Math.abs(maxAbsValue)) : 0;
  const niceAxisCandidates = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100,
  ];

  let axisMax =
    niceAxisCandidates.find((candidate) => safeMax <= candidate) ??
    Math.ceil(safeMax / 20) * 20;
  if (!Number.isFinite(axisMax) || axisMax <= 0) axisMax = 1;

  let stepSize = 1;
  if (axisMax <= 2) stepSize = 0.5;
  else if (axisMax <= 5) stepSize = 1;
  else if (axisMax <= 10) stepSize = 2;
  else if (axisMax <= 30) stepSize = 5;
  else stepSize = 10;

  return { axisMax, stepSize };
}

export default function BiasAnalysisChart({ points, className }: BiasAnalysisChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = points.map((point) => point.label);
    const data = points.map((point) => point.score);

    const maxAbsBias = data.reduce((maxValue, value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return maxValue;
      return Math.max(maxValue, Math.abs(numeric));
    }, 0);
    const { axisMax: yAxisAbsMax, stepSize: yAxisStepSize } = resolveBiasAxis(maxAbsBias);

    const positiveColor = readThemeVar(canvasRef.current, "--ns-bias-pos", "#38bdf8");
    const negativeColor = readThemeVar(canvasRef.current, "--ns-bias-neg", "#f97316");

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "편향도",
            data,
            borderWidth: 0,
            borderRadius: 6,
            backgroundColor(context) {
              const raw = Number(context.raw ?? 0);
              return raw >= 0 ? positiveColor : negativeColor;
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          axis: "x",
          intersect: false,
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
          y: {
            min: -yAxisAbsMax,
            max: yAxisAbsMax,
            grid: { color: "rgba(148,163,184,0.32)" },
            ticks: { color: "#64748b", font: { size: 11 }, stepSize: yAxisStepSize },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              title(context) {
                return context[0]?.label ?? "";
              },
              label(context) {
                const value = Number(context.parsed.y ?? 0);
                return `편향도 점수: ${value.toFixed(1)}`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [points]);

  return (
    <div className={className ? `${styles.chart} ${className}` : styles.chart}>
      <canvas ref={canvasRef} />
    </div>
  );
}
