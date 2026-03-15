// frontend/src/pages/MediaComparePage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Chart from "chart.js/auto";
import styles from "./MediaComparePage.module.css";
import {
  getAiSummary,
  getMediaArticleCounts,
  getMediaCompareContentSentiment,
  getMediaCompareTitleTopWords,
  getMediaCompareTopKeywords,
  getTitleBiasByMedia,
  type MediaArticleCountsResponse,
  type MediaCompareTopKeywordsResponse,
  type MediaContentSentimentCompareResponse,
  type MediaTitleTopWordsResponse,
  type TitleBiasByMediaResponse,
} from "../api/analytics";

type Period = "7d" | "14d";
type ApiPeriod = "D7" | "D14";

type MediaRow = {
  key: string;
  label: string;
  volume: number;
  bias: number;
  sentiment: { positive: number; neutral: number; negative: number };
  topWords: string[];
};

type DetailSectionState = {
  hasArticleCounts: boolean;
  hasBias: boolean;
  hasSentiment: boolean;
  hasTopWords: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatDateYYYYMMDD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function readCssVar(varName: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function toApiPeriod(period: Period): ApiPeriod {
  return period === "7d" ? "D7" : "D14";
}

function normalizeMediaName(name: string) {
  return String(name ?? "").trim();
}

function getErrorMessage(err: unknown) {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybe = err as {
      response?: { data?: { message?: string; details?: string } };
      message?: string;
    };

    const apiMessage = maybe.response?.data?.message;
    const apiDetails = maybe.response?.data?.details;
    if (apiMessage && apiDetails) return `${apiMessage} (${apiDetails})`;
    if (apiMessage) return apiMessage;
    if (maybe.message) return maybe.message;
  }
  return "데이터를 불러오지 못했습니다.";
}

function normalizePercentTriplet(
  positiveRaw: number,
  neutralRaw: number,
  negativeRaw: number
): { positive: number; neutral: number; negative: number } {
  const p = Number.isFinite(positiveRaw) ? Math.max(0, positiveRaw) : 0;
  const n = Number.isFinite(neutralRaw) ? Math.max(0, neutralRaw) : 0;
  const ng = Number.isFinite(negativeRaw) ? Math.max(0, negativeRaw) : 0;

  const total = p + n + ng;
  if (total <= 0) {
    return { positive: 0, neutral: 0, negative: 0 };
  }

  const positive = Math.round((p / total) * 100);
  let neutral = Math.round((n / total) * 100);
  let negative = Math.round((ng / total) * 100);

  const sum = positive + neutral + negative;
  const diff = 100 - sum;

  neutral = clamp(neutral + diff, 0, 100);

  const finalSum = positive + neutral + negative;
  if (finalSum !== 100) {
    const remain = 100 - finalSum;
    negative = clamp(negative + remain, 0, 100);
  }

  return { positive, neutral, negative };
}

function buildRowsFromResponses(
  articleCounts: MediaArticleCountsResponse,
  biasByMedia: TitleBiasByMediaResponse,
  sentiments: MediaContentSentimentCompareResponse,
  framingWords: MediaTitleTopWordsResponse
): MediaRow[] {
  const rowMap = new Map<string, MediaRow>();
  const orderedNames: string[] = [];

  const ensureRow = (mediaNameRaw: string) => {
    const mediaName = normalizeMediaName(mediaNameRaw);
    if (!mediaName) return null;

    if (!rowMap.has(mediaName)) {
      rowMap.set(mediaName, {
        key: mediaName,
        label: mediaName,
        volume: 0,
        bias: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        topWords: [],
      });
      orderedNames.push(mediaName);
    }

    return rowMap.get(mediaName)!;
  };

  (articleCounts.items ?? []).forEach((item) => {
    const row = ensureRow(item.media_name);
    if (!row) return;
    row.volume = Number.isFinite(item.article_count) ? Math.max(0, Math.round(item.article_count)) : 0;
  });

  (biasByMedia.items ?? []).forEach((item) => {
    const row = ensureRow(item.media_name);
    if (!row) return;

    if (row.label === "전체") {
      row.bias = 0;
      return;
    }

    const score = Number(item.bias_score);
    row.bias = Number.isFinite(score) ? clamp(Math.round(score * 10) / 10, -10, 10) : 0;
  });

  (sentiments.items ?? []).forEach((item) => {
    const row = ensureRow(item.media_name);
    if (!row) return;

    row.sentiment = normalizePercentTriplet(
      Number(item.positive),
      Number(item.neutral),
      Number(item.negative)
    );
  });

  (framingWords.items ?? []).forEach((item) => {
    const row = ensureRow(item.media_name);
    if (!row) return;

    row.topWords = Array.isArray(item.words)
      ? item.words
          .map((word) => String(word).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
  });

  return orderedNames
    .map((name) => rowMap.get(name))
    .filter((row): row is MediaRow => Boolean(row))
    .filter((row) => row.label !== "전체")
    .filter((row) => row.volume > 0);
}

function buildOverallRow(rows: MediaRow[]): MediaRow | null {
  if (rows.length === 0) return null;

  const totalVol = rows.reduce((acc, r) => acc + r.volume, 0);

  if (totalVol <= 0) return null;

  const weightedPositive =
    rows.reduce((acc, r) => acc + r.sentiment.positive * r.volume, 0) / Math.max(1, totalVol || 1);
  const weightedNeutral =
    rows.reduce((acc, r) => acc + r.sentiment.neutral * r.volume, 0) / Math.max(1, totalVol || 1);
  const weightedNegative =
    rows.reduce((acc, r) => acc + r.sentiment.negative * r.volume, 0) / Math.max(1, totalVol || 1);

  return {
    key: "overall",
    label: "전체",
    volume: totalVol,
    bias: 0,
    sentiment: normalizePercentTriplet(weightedPositive, weightedNeutral, weightedNegative),
    topWords: [],
  };
}

function formatRangeLabelFromApi(header: MediaCompareTopKeywordsResponse | null, period: Period) {
  if (header?.period_start && header?.period_end) {
    return `${header.period_start} ~ ${header.period_end}`;
  }

  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - (period === "7d" ? 6 : 13));

  return `${formatDateYYYYMMDD(start)} ~ ${formatDateYYYYMMDD(end)}`;
}

function createEmptyDetailSections(): DetailSectionState {
  return {
    hasArticleCounts: false,
    hasBias: false,
    hasSentiment: false,
    hasTopWords: false,
  };
}

export default function MediaComparePage() {
  const [period, setPeriod] = useState<Period>("7d");

  const [headerData, setHeaderData] = useState<MediaCompareTopKeywordsResponse | null>(null);
  const [selectedKeywordSeq, setSelectedKeywordSeq] = useState<number | null>(null);

  const [rows, setRows] = useState<MediaRow[]>([]);
  const [detailSections, setDetailSections] = useState<DetailSectionState>(createEmptyDetailSections);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [aiSummaryText, setAiSummaryText] = useState("");
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  const volumeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const biasCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sentimentCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHeader() {
      setIsHeaderLoading(true);
      setHeaderError(null);

      try {
        const data = await getMediaCompareTopKeywords({
          period: toApiPeriod(period),
          limit: 10,
        });

        if (cancelled) return;

        setHeaderData(data);

        const items = Array.isArray(data.items) ? data.items : [];
        setSelectedKeywordSeq((prev) => {
          if (prev != null && items.some((item) => item.keyword_seq === prev)) return prev;

          if (typeof data.selected_keyword_seq === "number") return data.selected_keyword_seq;
          return items[0]?.keyword_seq ?? null;
        });
      } catch (err) {
        if (cancelled) return;
        setHeaderData(null);
        setSelectedKeywordSeq(null);
        setRows([]);
        setDetailSections(createEmptyDetailSections());
        setHeaderError(getErrorMessage(err));
      } finally {
        if (!cancelled) setIsHeaderLoading(false);
      }
    }

    loadHeader();

    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails(keywordSeq: number) {
      setIsDetailLoading(true);
      setDetailError(null);

      try {
        const apiPeriod = toApiPeriod(period);

        const [articleCounts, biasByMedia, sentiments, framingWords] = await Promise.all([
          getMediaArticleCounts(keywordSeq, { period: apiPeriod }),
          getTitleBiasByMedia(keywordSeq, { period: apiPeriod }),
          getMediaCompareContentSentiment(keywordSeq, { period: apiPeriod }),
          getMediaCompareTitleTopWords(keywordSeq, { period: apiPeriod, top_n: 5 }),
        ]);

        if (cancelled) return;

        const mergedRows = buildRowsFromResponses(articleCounts, biasByMedia, sentiments, framingWords);

        const hasArticleCounts = (articleCounts.items ?? []).some((item) => Number(item.article_count) > 0);
        const hasBias = (biasByMedia.items ?? []).length > 0;
        const hasSentiment = (sentiments.items ?? []).some((item) => {
          const total = Number(item.positive ?? 0) + Number(item.neutral ?? 0) + Number(item.negative ?? 0);
          return total > 0;
        });
        const hasTopWords = (framingWords.items ?? []).some(
          (item) => Array.isArray(item.words) && item.words.some((word) => String(word).trim())
        );

        setRows(mergedRows);
        setDetailSections({
          hasArticleCounts,
          hasBias,
          hasSentiment,
          hasTopWords,
        });
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setDetailSections(createEmptyDetailSections());
        setDetailError(getErrorMessage(err));
      } finally {
        if (!cancelled) setIsDetailLoading(false);
      }
    }

    if (selectedKeywordSeq == null) {
      setRows([]);
      setDetailSections(createEmptyDetailSections());
      setDetailError(null);
      setIsDetailLoading(false);
      return;
    }

    loadDetails(selectedKeywordSeq);

    return () => {
      cancelled = true;
    };
  }, [period, selectedKeywordSeq]);

  useEffect(() => {
    let cancelled = false;

    async function loadAiSummary(keywordSeq: number) {
      setIsAiSummaryLoading(true);
      setAiSummaryError(null);

      try {
        const data = await getAiSummary(keywordSeq, { period: toApiPeriod(period) });

        if (cancelled) return;

        setAiSummaryText(String(data.summary_text ?? ""));
      } catch (err) {
        if (cancelled) return;
        setAiSummaryText("");
        setAiSummaryError(getErrorMessage(err));
      } finally {
        if (!cancelled) setIsAiSummaryLoading(false);
      }
    }

    if (selectedKeywordSeq == null) {
      setAiSummaryText("");
      setAiSummaryError(null);
      setIsAiSummaryLoading(false);
      return;
    }

    loadAiSummary(selectedKeywordSeq);

    return () => {
      cancelled = true;
    };
  }, [period, selectedKeywordSeq]);

  const keywordItems = useMemo(() => headerData?.items ?? [], [headerData]);

  const selectedKeywordLabel = useMemo(() => {
    if (selectedKeywordSeq == null) return "";
    return (
      keywordItems.find((item) => item.keyword_seq === selectedKeywordSeq)?.keyword ??
      headerData?.selected_keyword ??
      ""
    );
  }, [headerData?.selected_keyword, keywordItems, selectedKeywordSeq]);

  const overallRow = useMemo(() => buildOverallRow(rows), [rows]);

  const biasRows = useMemo(() => rows, [rows]);
  const sentimentRows = useMemo(() => (overallRow ? [overallRow, ...rows] : rows), [overallRow, rows]);

  const summary = useMemo(() => {
    const totalArticles = rows.reduce((acc, r) => acc + r.volume, 0);
    const mediaCount = rows.filter((r) => r.volume > 0).length;

    const sortedByVol = [...rows].sort((a, b) => b.volume - a.volume);
    const topVol = sortedByVol
      .filter((r) => r.volume > 0)
      .slice(0, 2)
      .map((r) => r.label)
      .join("·");

    const sortedByAbsBias = [...rows].sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));
    const mostBiased = sortedByAbsBias[0]?.label ?? "-";

    return {
      mediaCount,
      totalArticles,
      topVol: topVol || "-",
      mostBiased,
    };
  }, [rows]);

  const metaRangeLabel = useMemo(() => formatRangeLabelFromApi(headerData, period), [headerData, period]);

  const rangeLabel = period === "7d" ? "최근 7일" : "최근 14일";

  const hasSummarySection = Boolean(aiSummaryText.trim());
  const hasVolumeSection = detailSections.hasArticleCounts && rows.length > 0;
  const hasBiasSection = detailSections.hasBias && biasRows.length > 0;
  const hasSentimentSection =
    detailSections.hasSentiment &&
    sentimentRows.some(
      (row) => row.sentiment.positive + row.sentiment.neutral + row.sentiment.negative > 0
    );
  const hasFramingSection = detailSections.hasTopWords && rows.some((row) => row.topWords.length > 0);

  const hasAnyAnalysisSection =
    hasSummarySection ||
    hasVolumeSection ||
    hasBiasSection ||
    hasSentimentSection ||
    hasFramingSection;

  useEffect(() => {
    if (!volumeCanvasRef.current) return;
    if (!hasVolumeSection) return;

    const ctx = volumeCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = rows.map((r) => r.label);
    const data = rows.map((r) => r.volume);

    const blue = readCssVar("--ns-accent-blue", "#38bdf8");

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "기사량(건)",
            data,
            backgroundColor: blue,
            borderWidth: 0,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(55,65,81,0.5)" },
            ticks: { color: "#9ca3af", font: { size: 11 }, precision: 0 },
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

    return () => chart.destroy();
  }, [hasVolumeSection, rows]);

  useEffect(() => {
    if (!biasCanvasRef.current) return;
    if (!hasBiasSection) return;

    const ctx = biasCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = biasRows.map((r) => r.label);
    const data = biasRows.map((r) => r.bias);

    const posColor = readCssVar("--ns-bias-pos", "#38bdf8");
    const negColor = readCssVar("--ns-bias-neg", "#f97316");

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
              return raw >= 0 ? posColor : negColor;
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 11 } } },
          y: {
            suggestedMin: -10,
            suggestedMax: 10,
            grid: { color: "rgba(55,65,81,0.5)" },
            ticks: { color: "#9ca3af", font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const value = Number(context.parsed.y ?? 0);
                return `편향도 ${value.toFixed(1)}`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [biasRows, hasBiasSection]);

  useEffect(() => {
    if (!sentimentCanvasRef.current) return;
    if (!hasSentimentSection) return;

    const ctx = sentimentCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = sentimentRows.map((r) => r.label);
    const positive = sentimentRows.map((r) => r.sentiment.positive);
    const neutral = sentimentRows.map((r) => r.sentiment.neutral);
    const negative = sentimentRows.map((r) => r.sentiment.negative);

    const sentPos = readCssVar("--ns-sent-pos", "#22c55e");
    const sentNeu = readCssVar("--ns-sent-neu", "#e5e7eb");
    const sentNeg = readCssVar("--ns-sent-neg", "#ef4444");

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "긍정", data: positive, backgroundColor: sentPos, borderWidth: 0 },
          { label: "중립", data: neutral, backgroundColor: sentNeu, borderWidth: 0 },
          { label: "부정", data: negative, backgroundColor: sentNeg, borderWidth: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 11 } } },
          y: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            grid: { color: "rgba(55,65,81,0.5)" },
            ticks: {
              color: "#9ca3af",
              font: { size: 11 },
              callback(value) {
                return `${value}%`;
              },
            },
          },
        },
        plugins: {
          legend: { labels: { color: "#e5e7eb", font: { size: 11 } } },
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

    return () => chart.destroy();
  }, [hasSentimentSection, sentimentRows]);

  const hasLoadingState = isHeaderLoading || isDetailLoading || isAiSummaryLoading;
  const errorMessage = headerError || detailError || aiSummaryError;
  const noKeywordAvailable = !isHeaderLoading && !headerError && keywordItems.length === 0;

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
              분석 기간: {metaRangeLabel} · 기사 수: {summary.totalArticles}건 · 분석 언론사: {summary.mediaCount}개
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
                disabled={isHeaderLoading}
              >
                {item.keyword}
              </button>
            ))}

            {noKeywordAvailable && (
              <div className={styles.statusText}>표시 가능한 키워드(ALL + 기간 기준 10건 이상)가 없습니다.</div>
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

      {hasAnyAnalysisSection ? (
        <section className={styles.analysisGrid}>
          {hasSummarySection && (
            <article className={`${styles.card} ${styles.cardFill}`}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>키워드 분석 요약</div>
                  <div className={styles.cardSub}>수집된 기사 내용을 바탕으로 생성한 AI 요약입니다.</div>
                </div>
                <span className={styles.badgeSoft}>요약 리포트</span>
              </div>

              <div className={styles.summaryText}>{aiSummaryText}</div>
            </article>
          )}

          {hasVolumeSection && (
            <article className={`${styles.card} ${styles.cardFill}`}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>언론사별 기사량 TOP</div>
                  <div className={styles.cardSub}>
                    선택한 키워드에 대해 {metaRangeLabel} 기준 수집된 기사 건수를 언론사별로 정렬한 결과입니다.
                  </div>
                </div>
                <span className={styles.badgeSoft}>기사량 지표</span>
              </div>

              <div className={styles.chartWrapper}>
                <canvas ref={volumeCanvasRef} />
              </div>

              <div className={styles.biasCaption}>
                막대가 길수록 {metaRangeLabel} 선택 키워드에 대해 더 많은 기사를 보도한 언론사입니다.
              </div>
            </article>
          )}

          {hasBiasSection && (
            <article className={`${styles.card} ${styles.cardFill}`}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>언론사별 편향도 지수</div>
                  <div className={styles.cardSub}>
                    선택 키워드 기사들의 제목 톤을 기반으로 산출한 지표입니다 (0에 가까울수록 중립).
                  </div>
                </div>
                <span className={styles.badgeSoft}>편향 분석</span>
              </div>

              <div className={styles.chartWrapper}>
                <canvas ref={biasCanvasRef} />
              </div>

              <div className={styles.biasCaption}>
                <strong>양수</strong>일수록 긍정적인 톤, <strong>음수</strong>일수록 비판적인 톤이 강한 언론사입니다.
              </div>
            </article>
          )}

          {hasSentimentSection && (
            <article className={`${styles.card} ${styles.cardFill}`}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>언론사별 감성 비율 비교</div>
                  <div className={styles.cardSub}>
                    선택 키워드 기사 본문을 기반으로 긍정/중립/부정 비율을 비교한 결과입니다.
                  </div>
                </div>
                <span className={styles.badgeSoft}>감성 분석</span>
              </div>

              <div className={styles.chartWrapperTall}>
                <canvas ref={sentimentCanvasRef} />
              </div>

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
            </article>
          )}

          {hasFramingSection && (
            <article className={`${styles.card} ${styles.cardFill}`}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>언론사별 대표 단어 비교</div>
                  <div className={styles.cardSub}>
                    선택한 키워드 기사에서 각 언론사별로 상위 5개 단어를 뽑아 어떤 관점으로 보도하는지 비교합니다.
                  </div>
                </div>
                <span className={styles.badgeSoft}>텍스트 프레이밍</span>
              </div>

              <div className={styles.framingList}>
                {rows
                  .filter((row) => row.topWords.length > 0)
                  .map((r) => (
                    <div key={r.key} className={styles.framingItem}>
                      <div className={styles.framingMedia}>{r.label}</div>

                      <div className={styles.framingKeywords} aria-label={`${r.label} 대표 단어`}>
                        {r.topWords.map((w, i) => (
                          <span key={`${r.key}-${w}-${i}`} className={styles.keywordTagNeutral}>
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </article>
          )}
        </section>
      ) : (
        <section className={styles.grid1}>
          <article className={`${styles.card} ${styles.statusCard}`}>
            <div className={styles.statusTitle}>
              {errorMessage
                ? "데이터를 불러오지 못했습니다"
                : hasLoadingState
                  ? "데이터를 불러오는 중입니다"
                  : "표시 가능한 분석 결과가 없습니다"}
            </div>
            <div className={styles.statusText}>
              {errorMessage
                ? errorMessage
                : hasLoadingState
                  ? "잠시 후 자동으로 표시됩니다."
                  : selectedKeywordSeq == null || !selectedKeywordLabel
                    ? `${rangeLabel} 기준으로 비교 가능한 키워드가 없습니다.`
                    : "현재 기간에는 실제로 렌더링할 수 있는 비교 데이터가 없습니다."}
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
