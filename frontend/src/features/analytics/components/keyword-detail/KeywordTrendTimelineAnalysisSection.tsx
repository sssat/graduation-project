import { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";
import type { SearchTimelinePoint, SearchTimelineResponse } from "../../../../api/analytics";
import styles from "./KeywordTrendTimelineAnalysisSection.module.css";

type KeywordTrendTimelineAnalysisSectionProps = {
  fallbackRangeLabel: string;
  displayKeyword: string;
  trendTimeline: SearchTimelineResponse;
};

function formatCompactDateLabel(isoDate: string): string {
  if (!isoDate) return "";

  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;

  return `${year}.${month}.${day}`;
}

function parseIsoDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  return new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
}

function formatIsoDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatKoreanRange(start: string, end: string) {
  if (!start || !end) return "-";
  return `${start} ~ ${end}`;
}

function buildTimelineTickIndexes(itemCount: number, maxTickCount: number): Set<number> {
  if (itemCount <= 0) return new Set();
  if (itemCount <= maxTickCount) {
    return new Set(Array.from({ length: itemCount }, (_, index) => index));
  }

  const lastIndex = itemCount - 1;
  const step = lastIndex / Math.max(1, maxTickCount - 1);
  const indexes = new Set<number>();

  for (let index = 0; index < maxTickCount; index += 1) {
    indexes.add(Math.round(index * step));
  }

  indexes.add(0);
  indexes.add(lastIndex);

  return indexes;
}

function buildDailyTrendTimeline(
  timeline: SearchTimelineResponse,
): {
  periodStart: string | null;
  periodEnd: string | null;
  items: SearchTimelinePoint[];
} {
  const rawItems = [...(timeline.items ?? [])]
    .filter((item) => item?.observed_date)
    .sort((a, b) => a.observed_date.localeCompare(b.observed_date));

  if (!rawItems.length) {
    return {
      periodStart: timeline.period_start ?? null,
      periodEnd: timeline.period_end ?? null,
      items: [],
    };
  }

  const firstItemDate = parseIsoDateOnly(rawItems[0]?.observed_date);
  const lastItemDate = parseIsoDateOnly(rawItems[rawItems.length - 1]?.observed_date);
  const explicitStartDate = parseIsoDateOnly(timeline.period_start) ?? firstItemDate;
  const explicitEndDate = parseIsoDateOnly(timeline.period_end) ?? lastItemDate;
  const resolvedStartDate = explicitStartDate ?? firstItemDate;
  const resolvedEndDate = explicitEndDate ?? lastItemDate;

  if (!resolvedStartDate || !resolvedEndDate) {
    return {
      periodStart: timeline.period_start ?? rawItems[0]?.observed_date ?? null,
      periodEnd: timeline.period_end ?? rawItems[rawItems.length - 1]?.observed_date ?? null,
      items: rawItems,
    };
  }

  const itemMap = new Map<string, SearchTimelinePoint>();
  rawItems.forEach((item) => {
    itemMap.set(item.observed_date, item);
  });

  const filledItems: SearchTimelinePoint[] = [];
  for (
    let cursor = new Date(resolvedStartDate.getTime());
    cursor.getTime() <= resolvedEndDate.getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    const observedDate = formatIsoDateOnly(cursor);
    filledItems.push(
      itemMap.get(observedDate) ?? {
        observed_date: observedDate,
        interest_score: 0,
        is_partial: false,
      },
    );
  }

  return {
    periodStart: filledItems[0]?.observed_date ?? null,
    periodEnd: filledItems[filledItems.length - 1]?.observed_date ?? null,
    items: filledItems,
  };
}

export default function KeywordTrendTimelineAnalysisSection({
  fallbackRangeLabel,
  displayKeyword,
  trendTimeline,
}: KeywordTrendTimelineAnalysisSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  const dailyTrendTimeline = useMemo(
    () => buildDailyTrendTimeline(trendTimeline),
    [trendTimeline],
  );

  const trendTimelineRangeLabel =
    dailyTrendTimeline.periodStart && dailyTrendTimeline.periodEnd
      ? formatKoreanRange(dailyTrendTimeline.periodStart, dailyTrendTimeline.periodEnd)
      : fallbackRangeLabel;

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const items = dailyTrendTimeline.items;
    if (!items.length) return;
    const xTickIndexes = buildTimelineTickIndexes(items.length, items.length > 60 ? 10 : 7);

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(37, 99, 235, 0.26)");
    gradient.addColorStop(1, "rgba(37, 99, 235, 0.03)");

    const trendTimelineGuidePlugin = {
      id: "trendTimelineGuide",
      afterDraw(chartInstance: Chart<"line">) {
        const activeElements = chartInstance.tooltip?.getActiveElements?.() ?? [];
        if (!activeElements.length) return;

        const x = activeElements[0]?.element?.x;
        if (typeof x !== "number") return;

        const { ctx: chartCtx, chartArea } = chartInstance;
        chartCtx.save();
        chartCtx.beginPath();
        chartCtx.moveTo(x, chartArea.top);
        chartCtx.lineTo(x, chartArea.bottom);
        chartCtx.lineWidth = 1;
        chartCtx.strokeStyle = "rgba(37, 99, 235, 0.5)";
        chartCtx.setLineDash([4, 4]);
        chartCtx.stroke();
        chartCtx.restore();
      },
    };

    const chart = new Chart(ctx, {
      type: "line",
      plugins: [trendTimelineGuidePlugin],
      data: {
        labels: items.map((item) => formatCompactDateLabel(item.observed_date)),
        datasets: [
          {
            label: "검색 관심도",
            data: items.map((item) => item.interest_score),
            borderColor: "#2563eb",
            backgroundColor: gradient,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 4,
            pointHitRadius: 18,
            pointBackgroundColor: "#2563eb",
            pointBorderWidth: 0,
            clip: false,
            tension: 0.28,
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
        layout: {
          padding: {
            top: 8,
            right: 18,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#64748b",
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: false,
              callback(_value, index) {
                if (!xTickIndexes.has(index)) return "";
                return formatCompactDateLabel(items[index]?.observed_date ?? "");
              },
            },
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: "rgba(148,163,184,0.22)" },
            ticks: {
              color: "#64748b",
              font: { size: 11 },
              stepSize: 20,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              title(context) {
                const index = context[0]?.dataIndex ?? 0;
                return items[index]?.observed_date ?? "";
              },
              label(context) {
                const item = items[context.dataIndex];
                const partialLabel = item?.is_partial
                  ? " (마지막 데이터는 집계 중인 값일 수 있습니다.)"
                  : "";
                return `관심도: ${context.parsed.y}${partialLabel}`;
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
  }, [dailyTrendTimeline]);

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>검색 관심도 흐름</div>
          <div className={styles.cardSub}>
            {trendTimelineRangeLabel} 기준 {displayKeyword} 키워드의 검색 관심도 변화를 보여줍니다.
          </div>
        </div>
        <span className={styles.badgeSoft}>관심도 변화</span>
      </div>

      {dailyTrendTimeline.items.length ? (
        <>
          <div className={styles.timelineStats}>
            <div className={styles.timelineStatCard}>
              <div className={styles.timelineStatLabel}>최신 점수</div>
              <div className={styles.timelineStatValue}>{trendTimeline.latest_score ?? "-"}</div>
            </div>
            <div className={styles.timelineStatCard}>
              <div className={styles.timelineStatLabel}>기간 최고치</div>
              <div className={styles.timelineStatValue}>{trendTimeline.peak_score ?? "-"}</div>
            </div>
            <div className={styles.timelineStatCard}>
              <div className={styles.timelineStatLabel}>기간 평균</div>
              <div className={styles.timelineStatValue}>
                {trendTimeline.average_score == null ? "-" : trendTimeline.average_score.toFixed(1)}
              </div>
            </div>
          </div>

          <div className={`${styles.chartWrapper} ${styles.timelineChartWrapper}`}>
            <canvas ref={canvasRef} />
          </div>

          <div className={styles.timelineCaption}>
            이 지수는 실제 검색량이 아니라 해당 기간 내 상대 점수(0~100)입니다.
            {trendTimeline.has_partial ? " 마지막 데이터는 집계 중인 값일 수 있습니다." : ""}
          </div>
        </>
      ) : (
        <div className={styles.emptyBox}>표시할 검색 관심도 시계열 데이터가 없습니다.</div>
      )}
    </article>
  );
}
