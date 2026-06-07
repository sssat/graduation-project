import { useEffect, useMemo, useState } from "react";
import {
  getAiSummary,
  getContentSentiment,
  getKeywordMeta,
  getMediaArticleCounts,
  getMediaCompareContentSentiment,
  getMediaCompareTitleTopWords,
  getMediaCompareTopKeywords,
  getContentBiasByMedia,
  type ContentSentimentResponse,
  type KeywordMetaResponse,
  type MediaArticleCountsResponse,
  type MediaCompareTopKeywordsResponse,
  type MediaContentSentimentCompareResponse,
  type MediaTitleTopWordsResponse,
  type TitleBiasByMediaResponse,
} from "../../../api/analytics";

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

type UseMediaCompareAnalysisResult = {
  period: Period;
  setPeriod: (period: Period) => void;
  keywordItems: MediaCompareTopKeywordsResponse["items"];
  selectedKeywordSeq: number | null;
  setSelectedKeywordSeq: (keywordSeq: number) => void;
  selectedKeywordLabel: string;
  rows: MediaRow[];
  sentimentRows: MediaRow[];
  isHeaderLoading: boolean;
  isDetailLoading: boolean;
  detailError: string | null;
  aiSummaryText: string;
  summaryCardError: string | null;
  isSummaryCardLoading: boolean;
  noKeywordAvailable: boolean;
  metaRangeLabel: string;
  headerArticleCount: number;
  headerMediaCount: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatDateYYYYMMDD(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toApiPeriod(period: Period): ApiPeriod {
  return period === "7d" ? "D7" : "D14";
}

function normalizeMediaName(name: string) {
  return String(name ?? "").trim();
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const maybe = error as {
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
  negativeRaw: number,
) {
  const positiveSeed = Number.isFinite(positiveRaw) ? Math.max(0, positiveRaw) : 0;
  const neutralSeed = Number.isFinite(neutralRaw) ? Math.max(0, neutralRaw) : 0;
  const negativeSeed = Number.isFinite(negativeRaw) ? Math.max(0, negativeRaw) : 0;

  const total = positiveSeed + neutralSeed + negativeSeed;
  if (total <= 0) {
    return { positive: 0, neutral: 0, negative: 0 };
  }

  const positive = Math.round((positiveSeed / total) * 100);
  let neutral = Math.round((neutralSeed / total) * 100);
  let negative = Math.round((negativeSeed / total) * 100);

  const diff = 100 - (positive + neutral + negative);
  neutral = clamp(neutral + diff, 0, 100);

  const remain = 100 - (positive + neutral + negative);
  if (remain !== 0) {
    negative = clamp(negative + remain, 0, 100);
  }

  return { positive, neutral, negative };
}

function roundSentimentForDisplay(sentiment: ContentSentimentResponse): ContentSentimentResponse {
  return {
    positive: Math.round(sentiment.positive ?? 0),
    neutral: Math.round(sentiment.neutral ?? 0),
    negative: Math.round(sentiment.negative ?? 0),
  };
}

function buildRowsFromResponses(
  articleCounts: MediaArticleCountsResponse,
  biasByMedia: TitleBiasByMediaResponse,
  sentiments: MediaContentSentimentCompareResponse,
  framingWords: MediaTitleTopWordsResponse,
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

    row.volume = Number.isFinite(item.article_count)
      ? Math.max(0, Math.round(item.article_count))
      : 0;
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
      Number(item.negative),
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

export default function useMediaCompareAnalysis(): UseMediaCompareAnalysisResult {
  const [period, setPeriod] = useState<Period>("7d");
  const [headerData, setHeaderData] = useState<MediaCompareTopKeywordsResponse | null>(null);
  const [selectedKeywordSeq, setSelectedKeywordSeq] = useState<number | null>(null);
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [keywordMeta, setKeywordMeta] = useState<KeywordMetaResponse | null>(null);
  const [overallSentiment, setOverallSentiment] = useState<ContentSentimentResponse | null>(null);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [aiSummaryText, setAiSummaryText] = useState("");
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

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
        setSelectedKeywordSeq((previousKeywordSeq) => {
          if (
            previousKeywordSeq != null &&
            items.some((item) => item.keyword_seq === previousKeywordSeq)
          ) {
            return previousKeywordSeq;
          }

          if (typeof data.selected_keyword_seq === "number") {
            return data.selected_keyword_seq;
          }

          return items[0]?.keyword_seq ?? null;
        });
      } catch (error) {
        if (cancelled) return;

        setHeaderData(null);
        setSelectedKeywordSeq(null);
        setKeywordMeta(null);
        setRows([]);
        setOverallSentiment(null);
        setHeaderError(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsHeaderLoading(false);
        }
      }
    }

    void loadHeader();

    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    let cancelled = false;

    async function loadKeywordMeta(keywordSeq: number) {
      try {
        const data = await getKeywordMeta(keywordSeq, { period: toApiPeriod(period) });
        if (cancelled) return;
        setKeywordMeta(data);
      } catch {
        if (cancelled) return;
        setKeywordMeta(null);
      }
    }

    if (selectedKeywordSeq == null) {
      setKeywordMeta(null);
      return;
    }

    void loadKeywordMeta(selectedKeywordSeq);

    return () => {
      cancelled = true;
    };
  }, [period, selectedKeywordSeq]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails(keywordSeq: number) {
      setIsDetailLoading(true);
      setDetailError(null);

      try {
        const apiPeriod = toApiPeriod(period);

        const [articleCounts, biasByMedia, sentiments, framingWords, overallSentimentResponse] =
          await Promise.all([
            getMediaArticleCounts(keywordSeq, { period: apiPeriod }),
            getContentBiasByMedia(keywordSeq, { period: apiPeriod }),
            getMediaCompareContentSentiment(keywordSeq, { period: apiPeriod }),
            getMediaCompareTitleTopWords(keywordSeq, { period: apiPeriod, top_n: 5 }),
            getContentSentiment(keywordSeq, { period: apiPeriod }),
          ]);

        if (cancelled) return;

        setRows(buildRowsFromResponses(articleCounts, biasByMedia, sentiments, framingWords));
        setOverallSentiment(roundSentimentForDisplay(overallSentimentResponse));
      } catch (error) {
        if (cancelled) return;

        setRows([]);
        setOverallSentiment(null);
        setDetailError(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    }

    if (selectedKeywordSeq == null) {
      setRows([]);
      setOverallSentiment(null);
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
      setAiSummaryError(null);

      try {
        const data = await getAiSummary(keywordSeq, { period: toApiPeriod(period) });
        if (cancelled) return;
        setAiSummaryText(String(data.summary_text ?? ""));
      } catch (error) {
        if (cancelled) return;

        setAiSummaryText("");
        setAiSummaryError(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsAiSummaryLoading(false);
        }
      }
    }

    if (selectedKeywordSeq == null) {
      setAiSummaryText("");
      setAiSummaryError(null);
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

  const overallRow = useMemo<MediaRow | null>(() => {
    if (!overallSentiment) {
      return null;
    }

    return {
      key: "overall",
      label: "전체",
      volume: rows.reduce((sum, row) => sum + row.volume, 0),
      bias: 0,
      sentiment: {
        positive: overallSentiment.positive,
        neutral: overallSentiment.neutral,
        negative: overallSentiment.negative,
      },
      topWords: [],
    };
  }, [overallSentiment, rows]);

  const sentimentRows = useMemo(
    () => (overallRow ? [overallRow, ...rows] : rows),
    [overallRow, rows],
  );

  const summary = useMemo(() => {
    const totalArticles = rows.reduce((sum, row) => sum + row.volume, 0);
    const mediaCount = rows.filter((row) => row.volume > 0).length;

    return {
      totalArticles,
      mediaCount,
    };
  }, [rows]);

  const metaRangeLabel = useMemo(() => {
    if (keywordMeta?.period_start && keywordMeta?.period_end) {
      return `${keywordMeta.period_start} ~ ${keywordMeta.period_end}`;
    }

    return formatRangeLabelFromApi(headerData, period);
  }, [headerData, keywordMeta, period]);

  const summaryCardError = headerError || aiSummaryError;
  const isSummaryCardLoading = isHeaderLoading || isAiSummaryLoading;
  const noKeywordAvailable = !isHeaderLoading && !headerError && keywordItems.length === 0;
  const headerArticleCount = keywordMeta?.article_count ?? summary.totalArticles;
  const headerMediaCount = keywordMeta?.media_count ?? summary.mediaCount;

  return {
    period,
    setPeriod,
    keywordItems,
    selectedKeywordSeq,
    setSelectedKeywordSeq,
    selectedKeywordLabel,
    rows,
    sentimentRows,
    isHeaderLoading,
    isDetailLoading,
    detailError,
    aiSummaryText,
    summaryCardError,
    isSummaryCardLoading,
    noKeywordAvailable,
    metaRangeLabel,
    headerArticleCount,
    headerMediaCount,
  };
}
