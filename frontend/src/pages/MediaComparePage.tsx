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
  hasBias: boolean;
  sentiment: { positive: number; neutral: number; negative: number };
  hasSentiment: boolean;
  topWords: string[];
};

type DetailAvailability = {
  hasVolume: boolean;
  hasBias: boolean;
  hasSentiment: boolean;
  hasFraming: boolean;
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
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
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
  const positiveValue = Number.isFinite(positiveRaw) ? Math.max(0, positiveRaw) : 0;
  const neutralValue = Number.isFinite(neutralRaw) ? Math.max(0, neutralRaw) : 0;
  const negativeValue = Number.isFinite(negativeRaw) ? Math.max(0, negativeRaw) : 0;

  const total = positiveValue + neutralValue + negativeValue;
  if (total <= 0) {
    return { positive: 0, neutral: 0, negative: 0 };
  }

  const positive = Math.round((positiveValue / total) * 100);
  let neutral = Math.round((neutralValue / total) * 100);
  let negative = Math.round((negativeValue / total) * 100);

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

function getSentimentTotal(sentiment: { positive: number; neutral: number; negative: number }) {
  return sentiment.positive + sentiment.neutral + sentiment.negative;
}

async function loadOptional<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
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
        hasBias: false,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        hasSentiment: false,
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
      row.hasBias = false;
      return;
    }

    const score = Number(item.bias_score);
    row.bias = Number.isFinite(score) ? clamp(Math.round(score * 10) / 10, -10, 10) : 0;
    row.hasBias = true;
  });

  (sentiments.items ?? []).forEach((item) => {
    const row = ensureRow(item.media_name);
    if (!row) return;

    const normalized = normalizePercentTriplet(
      Number(item.positive),
      Number(item.neutral),
      Number(item.negative)
    );

    row.sentiment = normalized;
    row.hasSentiment = getSentimentTotal(normalized) > 0;
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

  const totalVol = rows.reduce((acc, row) => acc + row.volume, 0);
  if (totalVol <= 0) return null;

  const weightedPositive =
    rows.reduce((acc, row) => acc + row.sentiment.positive * row.volume, 0) / Math.max(1, totalVol);
  const weightedNeutral =
    rows.reduce((acc, row) => acc + row.sentiment.neutral * row.volume, 0) / Math.max(1, totalVol);
  const weightedNegative =
    rows.reduce((acc, row) => acc + row.sentiment.negative * row.volume, 0) / Math.max(1, totalVol);

  return {
    key: "overall",
    label: "전체",
    volume: totalVol,
    bias: 0,
    hasBias: false,
    sentiment: normalizePercentTriplet(weightedPositive, weightedNeutral, weightedNegative),
    hasSentiment: true,
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

export default function MediaComparePage() {
  const [period, setPeriod] = useState<Period>("7d");

  const [headerData, setHeaderData] = useState<MediaCompareTopKeywordsResponse | null>(null);
  const [selectedKeywordSeq, setSelectedKeywordSeq] = useState<number | null>(null);

  const [rows, setRows] = useState<MediaRow[]>([]);
  const [detailAvailability, setDetailAvailability] = useState<DetailAvailability>({
    hasVolume: false,
    hasBias: false,
    hasSentiment: false,
    hasFraming: false,
  });

  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [aiSummaryText, setAiSummaryText] = useState("");
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);

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
        setDetailAvailability({
          hasVolume: false,
          hasBias: false,
          hasSentiment: false,
          hasFraming: false,
        });
        setHeaderError(getErrorMessage(err));
      } finally {
        if (!cancelled) setIsHeaderLoading(false);
      }
    }

    void loadHeader();

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
          loadOptional(
            () => getMediaArticleCounts(keywordSeq, { period: apiPeriod }),
            { items: [] } as MediaArticleCountsResponse
          ),
          loadOptional(
            () => getTitleBiasByMedia(keywordSeq, { period: apiPeriod }),
            { items: [] } as TitleBiasByMediaResponse
          ),
          loadOptional(
            () => getMediaCompareContentSentiment(keywordSeq, { period: apiPeriod }),
            { items: [] } as MediaContentSentimentCompareResponse
          ),
          loadOptional(
            () => getMediaCompareTitleTopWords(keywordSeq, { period: apiPeriod, top_n: 5 }),
            { items: [] } as MediaTitleTopWordsResponse
          ),
        ]);

        if (cancelled) return;

        const mergedRows = buildRowsFromResponses(articleCounts, biasByMedia, sentiments, framingWords);

        setRows(mergedRows);
        setDetailAvailability({
          hasVolume: mergedRows.some((row) => row.volume > 0),
          hasBias: mergedRows.some((row) => row.hasBias),
          hasSentiment: mergedRows.some((row) => row.hasSentiment),
          hasFraming: mergedRows.some((row) => row.topWords.length > 0),
        });
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setDetailAvailability({
          hasVolume: false,
          hasBias: false,
          hasSentiment: false,
          hasFraming: false,
        });
        setDetailError(getErrorMessage(err));
      } finally {
        if (!cancelled) setIsDetailLoading(false);
      }
    }

    if (selectedKeywordSeq == null) {
      setRows([]);
      setDetailAvailability({
        hasVolume: false,
        hasBias: false,
        hasSentiment: false,
        hasFraming: false,
      });
      setDetailError(null);
      setIsDetailLoading(false);
      return;
    }

    void loadDetails(selectedKeywordSeq);

    return () => {
      cancelled = true;
    };
  }, [period, selectedKeywordSeq]);

  useEffect(() => {
    let cancelled = false;

    async function loadAiSummary(keywordSeq: number) {
      setIsAiSummaryLoading(true);

      const data = await loadOptional(
        () => getAiSummary(keywordSeq, { period: toApiPeriod(period) }),
        { summary_text: "" }
      );

      if (cancelled) return;

      setAiSummaryText(String(data.summary_text ?? ""));
      setIsAiSummaryLoading(false);
    }

    if (selectedKeywordSeq == null) {
      setAiSummaryText("");
      setIsAiSummaryLoading(false);
      return;
    }

    void loadAiSummary(selectedKeywordSeq);

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

  const biasRows = useMemo(() => rows.filter((row) => row.hasBias), [rows]);

  const sentimentSourceRows = useMemo(
    () => rows.filter((row) => row.hasSentiment && getSentimentTotal(row.sentiment) > 0),
    [rows]
  );

  const overallRow = useMemo(() => buildOverallRow(sentimentSourceRows), [sentimentSourceRows]);

  const sentimentRows = useMemo(
    () => (overallRow ? [overallRow, ...sentimentSourceRows] : sentimentSourceRows),
    [overallRow, sentimentSourceRows]
  );

  const framingRows = useMemo(
    () => rows.filter((row) => row.topWords.length > 0),
    [rows]
  );

  const summary = useMemo(() => {
    const totalArticles = rows.reduce((acc, row) => acc + row.volume, 0);
    const mediaCount = rows.filter((row) => row.volume > 0).length;

    const sortedByVol = [...rows].sort((a, b) => b.volume - a.volume);
    const topVol = sortedByVol
      .filter((row) => row.volume > 0)
      .slice(0, 2)
      .map((row) => row.label)
      .join("·");

    const sortedByAbsBias = [...biasRows].sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));
    const mostBiased = sortedByAbsBias[0]?.label ?? "-";

    return {
      mediaCount,
      totalArticles,
      topVol: topVol || "-",
      mostBiased,
    };
  }, [biasRows, rows]);

  const metaRangeLabel = useMemo(() => formatRangeLabelFromApi(headerData, period), [headerData, period]);

  const rangeLabel = period === "7d" ? "최근 7일" : "최근 14일";

  const noKeywordAvailable = !isHeaderLoading && !headerError && keywordItems.length === 0;

  const hasSummaryCard =
    !isHeaderLoading &&
    !isAiSummaryLoading &&
    selectedKeywordSeq != null &&
    Boolean(selectedKeywordLabel) &&
    Boolean(aiSummaryText.trim());

  const hasVolumeCard = !isDetailLoading && detailAvailability.hasVolume && rows.length > 0;
  const hasBiasCard = !isDetailLoading && detailAvailability.hasBias && biasRows.length > 0;
  const hasSentimentCard = !isDetailLoading && detailAvailability.hasSentiment && sentimentRows.length > 0;
  const hasFramingCard = !isDetailLoading && detailAvailability.hasFraming && framingRows.length > 0;

  const visibleAnalysisCount =
    Number(hasSummaryCard) +
    Number(hasVolumeCard) +
    Number(hasBiasCard) +
    Number(hasSentimentCard) +
    Number(hasFramingCard);

  const topSectionCount = Number(hasVolumeCard) + Number(hasBiasCard);
  const bottomSectionCount = Number(hasSentimentCard) + Number(hasFramingCard);

  useEffect(() => {
    if (!volumeCanvasRef.current || !hasVolumeCard) return;

    const ctx = volumeCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = rows.map((row) => row.label);
    const data = rows.map((row) => row.volume);

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
  }, [hasVolumeCard, rows]);

  useEffect(() => {
    if (!biasCanvasRef.current || !hasBiasCard) return;

    const ctx = biasCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = biasRows.map((row) => row.label);
    const data = biasRows.map((row) => row.bias);

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
  }, [biasRows, hasBiasCard]);

  useEffect(() => {
    if (!sentimentCanvasRef.current || !hasSentimentCard) return;

    const ctx = sentimentCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = sentimentRows.map((row) => row.label);
    const positive = sentimentRows.map((row) => row.sentiment.positive);
    const neutral = sentimentRows.map((row) => row.sentiment.neutral);
    const negative = sentimentRows.map((row) => row.sentiment.negative);

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
  }, [hasSentimentCard, sentimentRows]);

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

      {hasSummaryCard && (
        <section className={styles.grid1}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>키워드 분석 요약</div>
                <div className={styles.cardSub}>수집된 기사 내용을 바탕으로 생성한 AI 요약입니다.</div>
              </div>
              <span className={styles.badgeSoft}>요약 리포트</span>
            </div>

            <div className={styles.summaryText}>{aiSummaryText}</div>
          </article>
        </section>
      )}

      {topSectionCount > 0 && (
        <section className={topSectionCount === 1 ? styles.grid1 : styles.grid2}>
          {hasVolumeCard && (
            <article className={styles.card}>
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

          {hasBiasCard && (
            <article className={styles.card}>
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
        </section>
      )}

      {bottomSectionCount > 0 && (
        <section className={bottomSectionCount === 1 ? styles.grid1 : styles.grid2}>
          {hasSentimentCard && (
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

          {hasFramingCard && (
            <article className={styles.card}>
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
                {framingRows.map((row) => (
                  <div key={row.key} className={styles.framingItem}>
                    <div className={styles.framingMedia}>{row.label}</div>

                    <div className={styles.framingKeywords} aria-label={`${row.label} 대표 단어`}>
                      {row.topWords.map((word, index) => (
                        <span key={`${row.key}-${word}-${index}`} className={styles.keywordTagNeutral}>
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>
      )}

      {!isHeaderLoading &&
        !isDetailLoading &&
        !isAiSummaryLoading &&
        selectedKeywordSeq != null &&
        visibleAnalysisCount === 0 && (
          <section className={styles.grid1}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>표시할 비교 분석 데이터가 없습니다</div>
                  <div className={styles.cardSub}>
                    {selectedKeywordLabel || rangeLabel} 기준으로 노출 가능한 비교 분석 결과가 없습니다.
                  </div>
                </div>
                <span className={styles.badgeSoft}>비교 분석</span>
              </div>

              <div className={styles.summaryText}>
                {headerError || detailError
                  ? headerError || detailError
                  : "현재 선택한 기간에는 노출 가능한 언론사 비교 분석 결과가 없습니다. 다른 기간이나 다른 키워드를 선택해 주세요."}
              </div>
            </article>
          </section>
        )}
    </main>
  );
}
