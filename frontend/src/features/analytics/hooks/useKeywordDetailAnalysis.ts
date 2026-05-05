import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getAiSummary,
  getCommentWordcloud,
  getContentSentiment,
  getCoocNetwork,
  getSearchTimeline,
  getKeywordMeta,
  getTitleWordcloud,
  type CoocNetworkEdge,
  type CoocNetworkNode,
  type ContentSentimentResponse,
  type KeywordMetaResponse,
  type SearchTimelineResponse,
} from "../../../api/analytics";

export type KeywordPeriod = "D7" | "D14";

export type RenderWordItem = {
  text: string;
  weight: number;
};

export type KeywordDetailViewData = {
  meta: KeywordMetaResponse;
  summaryText: string;
  trendTimeline: SearchTimelineResponse;
  titleWordcloud: RenderWordItem[];
  commentWordcloud: RenderWordItem[];
  sentiment: ContentSentimentResponse;
  coocNodes: CoocNetworkNode[];
  coocEdges: CoocNetworkEdge[];
};

type UseKeywordDetailAnalysisResult = {
  keywordSeq: number | null;
  period: KeywordPeriod;
  setPeriod: (period: KeywordPeriod) => void;
  loading: boolean;
  errorMessage: string | null;
  viewData: KeywordDetailViewData | null;
  meta: KeywordMetaResponse | null;
  displayKeyword: string;
  rangeLabel: string;
  isInsufficient: boolean;
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toPeriodParam(raw: string | null | undefined): KeywordPeriod {
  if (!raw) return "D7";

  const normalized = raw.toUpperCase();
  if (normalized === "D14" || normalized === "14D" || normalized === "14") {
    return "D14";
  }

  return "D7";
}

function parsePositiveInt(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function formatKoreanRange(start: string, end: string) {
  if (!start || !end) return "-";
  return `${start} ~ ${end}`;
}

function createEmptyTrendTimeline(): SearchTimelineResponse {
  return {
    period_start: null,
    period_end: null,
    latest_score: null,
    peak_score: null,
    average_score: null,
    has_partial: false,
    items: [],
  };
}

function normalizeWordcloudItems(items: Array<{ word: string; weight: number }>): RenderWordItem[] {
  return (items ?? [])
    .filter((item) => item && typeof item.word === "string" && item.word.trim())
    .map((item) => ({
      text: item.word.trim(),
      weight: Number.isFinite(item.weight) ? Number(item.weight) : 0,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 80);
}

function roundSentiment(sentiment: ContentSentimentResponse): ContentSentimentResponse {
  return {
    positive: Math.round(sentiment.positive ?? 0),
    neutral: Math.round(sentiment.neutral ?? 0),
    negative: Math.round(sentiment.negative ?? 0),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const anyError = error as {
      response?: { data?: { message?: string; details?: string } };
      message?: string;
    };

    const message =
      anyError.response?.data?.message ||
      anyError.response?.data?.details ||
      anyError.message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "요청 처리 중 오류가 발생했습니다.";
}

export default function useKeywordDetailAnalysis(): UseKeywordDetailAnalysisResult {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const routeParams = params as Record<string, string | undefined>;
  const redirectedInsufficientRef = useRef<string | null>(null);

  const keywordSeq =
    parsePositiveInt(routeParams.keywordSeq) ??
    parsePositiveInt(routeParams.keyword_seq) ??
    parsePositiveInt(routeParams.seq) ??
    parsePositiveInt(routeParams.id) ??
    parsePositiveInt(searchParams.get("keyword_seq")) ??
    parsePositiveInt(searchParams.get("keywordSeq")) ??
    parsePositiveInt(searchParams.get("seq")) ??
    parsePositiveInt(routeParams.keyword);

  const rawKeywordFallback =
    routeParams.keyword ??
    searchParams.get("keyword") ??
    searchParams.get("q") ??
    "";

  const keywordFallback = useMemo(
    () => safeDecode(rawKeywordFallback || ""),
    [rawKeywordFallback],
  );

  const [period, setPeriod] = useState<KeywordPeriod>(() => toPeriodParam(searchParams.get("period")));
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewData, setViewData] = useState<KeywordDetailViewData | null>(null);

  useEffect(() => {
    if (!keywordSeq) {
      return;
    }

    const targetKeywordSeq = keywordSeq;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const meta = await getKeywordMeta(targetKeywordSeq, { period });
        if (cancelled) return;

        if (!meta.is_analyzable) {
          setViewData({
            meta,
            summaryText: "",
            trendTimeline: createEmptyTrendTimeline(),
            titleWordcloud: [],
            commentWordcloud: [],
            sentiment: { positive: 0, neutral: 0, negative: 0 },
            coocNodes: [],
            coocEdges: [],
          });
          setLoading(false);
          return;
        }

        const [
          summaryResponse,
          trendTimelineResponse,
          titleWordcloudResponse,
          sentimentResponse,
          coocResponse,
          commentWordcloudResponse,
        ] = await Promise.all([
          getAiSummary(targetKeywordSeq, { period }),
          getSearchTimeline(targetKeywordSeq),
          getTitleWordcloud(targetKeywordSeq, { period }),
          getContentSentiment(targetKeywordSeq, { period }),
          getCoocNetwork(targetKeywordSeq, { period }),
          getCommentWordcloud(targetKeywordSeq, { period }),
        ]);

        if (cancelled) return;

        setViewData({
          meta,
          summaryText: summaryResponse.summary_text ?? "",
          trendTimeline: trendTimelineResponse ?? createEmptyTrendTimeline(),
          titleWordcloud: normalizeWordcloudItems(titleWordcloudResponse.items ?? []),
          commentWordcloud: normalizeWordcloudItems(commentWordcloudResponse.items ?? []),
          sentiment: roundSentiment(sentimentResponse),
          coocNodes: coocResponse.nodes ?? [],
          coocEdges: coocResponse.edges ?? [],
        });
      } catch (error) {
        if (cancelled) return;

        setViewData(null);
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [keywordSeq, period]);

  const meta = viewData?.meta ?? null;
  const displayKeyword = meta?.keyword || keywordFallback || `키워드 #${keywordSeq ?? "-"}`;
  const rangeLabel = meta ? formatKoreanRange(meta.period_start, meta.period_end) : "-";
  const isInsufficient = Boolean(meta && !meta.is_analyzable);

  useEffect(() => {
    if (!isInsufficient || !meta || !keywordSeq) {
      return;
    }

    const key = `${keywordSeq}-${period}`;
    if (redirectedInsufficientRef.current === key) {
      return;
    }

    redirectedInsufficientRef.current = key;
    window.alert("데이터가 부족하여 분석을 제공하지 않습니다. (ALL + 최근 7일 기사 수 10건 미만)");
    navigate("/", { replace: true });
  }, [isInsufficient, keywordSeq, meta, navigate, period]);

  return {
    keywordSeq,
    period,
    setPeriod,
    loading,
    errorMessage,
    viewData,
    meta,
    displayKeyword,
    rangeLabel,
    isInsufficient,
  };
}
