import http from "k6/http";
import { check, sleep } from "k6";

const API_BASE_URL = (__ENV.API_BASE_URL || "http://localhost:8080/api").replace(/\/+$/, "");
const PERIOD = __ENV.PERIOD || "D7";
const VUS = Number.parseInt(__ENV.VUS || "10", 10);
const DURATION_SECONDS = Number.parseInt(__ENV.DURATION_SECONDS || "60", 10);
const THINK_TIME_SECONDS = Number.parseFloat(__ENV.THINK_TIME_SECONDS || "0.25");
const KEYWORD_SEQ = Number.parseInt(__ENV.KEYWORD_SEQ || "0", 10);

export const options = {
  scenarios: {
    public_analytics: {
      executor: "constant-vus",
      vus: VUS,
      duration: `${DURATION_SECONDS}s`,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

function getJson(path) {
  const res = http.get(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
    },
    tags: {
      endpoint: "setup",
    },
  });

  if (res.status < 200 || res.status >= 400) {
    throw new Error(`GET ${path} returned ${res.status}`);
  }

  return res.json();
}

function resolveKeywordSeq() {
  if (KEYWORD_SEQ > 0) return KEYWORD_SEQ;

  const overview = getJson("/analytics/overview");
  const overviewKeyword = (overview.top_keywords || []).find(
    (item) => item.keyword_seq && item.is_analyzable !== false,
  );
  if (overviewKeyword && overviewKeyword.keyword_seq) return overviewKeyword.keyword_seq;

  const mediaTop = getJson(
    `/analytics/media-compare/keywords/top?period=${encodeURIComponent(PERIOD)}&limit=10`,
  );
  if (mediaTop.selected_keyword_seq) return mediaTop.selected_keyword_seq;
  if (mediaTop.items && mediaTop.items[0] && mediaTop.items[0].keyword_seq) {
    return mediaTop.items[0].keyword_seq;
  }

  throw new Error("Could not resolve KEYWORD_SEQ. Set KEYWORD_SEQ manually and retry.");
}

export function setup() {
  return {
    keywordSeq: resolveKeywordSeq(),
  };
}

function scenario(keywordSeq) {
  const period = encodeURIComponent(PERIOD);
  return [
    { label: "overview", weight: 14, path: "/analytics/overview" },
    {
      label: "media-top-keywords",
      weight: 12,
      path: `/analytics/media-compare/keywords/top?period=${period}&limit=10`,
    },
    {
      label: "keyword-meta",
      weight: 12,
      path: `/analytics/keywords/${keywordSeq}?period=${period}`,
    },
    {
      label: "ai-summary",
      weight: 8,
      path: `/analytics/keywords/${keywordSeq}/summary?period=${period}`,
    },
    {
      label: "title-wordcloud",
      weight: 10,
      path: `/analytics/keywords/${keywordSeq}/wordcloud/title?period=${period}`,
    },
    {
      label: "comment-wordcloud",
      weight: 6,
      path: `/analytics/keywords/${keywordSeq}/wordcloud/comment?period=${period}`,
    },
    {
      label: "search-timeline",
      weight: 10,
      path: `/analytics/keywords/${keywordSeq}/search-timeline`,
    },
    {
      label: "content-sentiment",
      weight: 8,
      path: `/analytics/keywords/${keywordSeq}/sentiment/content?period=${period}`,
    },
    {
      label: "title-bias",
      weight: 6,
      path: `/analytics/keywords/${keywordSeq}/bias/title?period=${period}`,
    },
    {
      label: "cooc-network",
      weight: 4,
      path: `/analytics/keywords/${keywordSeq}/cooc-network?period=${period}`,
    },
    {
      label: "media-article-counts",
      weight: 4,
      path: `/analytics/media-compare/keywords/${keywordSeq}/media-article-counts?period=${period}`,
    },
    {
      label: "media-sentiment",
      weight: 3,
      path: `/analytics/media-compare/keywords/${keywordSeq}/sentiment/content?period=${period}`,
    },
    {
      label: "media-title-top-words",
      weight: 3,
      path: `/analytics/media-compare/keywords/${keywordSeq}/framing/title-top-words?period=${period}&top_n=5`,
    },
  ];
}

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

export default function (data) {
  const target = pickWeighted(scenario(data.keywordSeq));
  const res = http.get(`${API_BASE_URL}${target.path}`, {
    headers: {
      Accept: "application/json",
    },
    tags: {
      endpoint: target.label,
    },
  });

  check(res, {
    "status is 2xx or 3xx": (r) => r.status >= 200 && r.status < 400,
  });

  sleep(THINK_TIME_SECONDS + Math.random() * THINK_TIME_SECONDS);
}

export function handleSummary(data) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const summary = textSummary(data);
  return {
    stdout: summary,
    [`tools/load-test/results/k6-summary-${stamp}.json`]: JSON.stringify(data, null, 2),
    [`tools/load-test/results/k6-summary-${stamp}.md`]: markdownSummary(data),
  };
}

function textSummary(data) {
  const duration = metricValues(data, "http_req_duration");
  const failed = metricValues(data, "http_req_failed");
  const requests = metricValues(data, "http_reqs");

  return [
    "",
    "Newsight k6 summary",
    `API_BASE_URL: ${API_BASE_URL}`,
    `VUS: ${VUS}`,
    `Duration: ${DURATION_SECONDS}s`,
    `Requests: ${formatNumber(requests.count, 0)}`,
    `Failure rate: ${formatNumber((failed.rate || 0) * 100, 2)}%`,
    `Avg: ${formatNumber(duration.avg, 2)} ms`,
    `p90: ${formatNumber(duration["p(90)"], 2)} ms`,
    `p95: ${formatNumber(duration["p(95)"], 2)} ms`,
    `Max: ${formatNumber(duration.max, 2)} ms`,
    "",
  ].join("\n");
}

function markdownSummary(data) {
  const duration = metricValues(data, "http_req_duration");
  const failed = metricValues(data, "http_req_failed");
  const requests = metricValues(data, "http_reqs");
  const checks = metricValues(data, "checks");
  const iterations = metricValues(data, "iterations");

  return [
    "# Newsight k6 Load Test Summary",
    "",
    "## Test Configuration",
    "",
    "| Item | Value |",
    "| --- | --- |",
    `| API base URL | ${API_BASE_URL} |`,
    `| Virtual users | ${VUS} |`,
    `| Duration | ${DURATION_SECONDS}s |`,
    `| Period | ${PERIOD} |`,
    `| Keyword seq | ${KEYWORD_SEQ > 0 ? KEYWORD_SEQ : "auto"} |`,
    "",
    "## Result Summary",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Total requests | ${formatNumber(requests.count, 0)} |`,
    `| Iterations | ${formatNumber(iterations.count, 0)} |`,
    `| Check success rate | ${formatNumber((checks.rate || 0) * 100, 2)}% |`,
    `| Failure rate | ${formatNumber((failed.rate || 0) * 100, 2)}% |`,
    `| Average response time | ${formatNumber(duration.avg, 2)} ms |`,
    `| Median response time | ${formatNumber(duration.med, 2)} ms |`,
    `| p90 response time | ${formatNumber(duration["p(90)"], 2)} ms |`,
    `| p95 response time | ${formatNumber(duration["p(95)"], 2)} ms |`,
    `| Max response time | ${formatNumber(duration.max, 2)} ms |`,
    "",
    "## Interpretation",
    "",
    interpretation(duration, failed),
    "",
  ].join("\n");
}

function metricValues(data, metricName) {
  return data.metrics?.[metricName]?.values || {};
}

function formatNumber(value, digits) {
  return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);
}

function interpretation(duration, failed) {
  const failureRate = failed.rate || 0;
  const p95 = duration["p(95)"] || 0;

  if (failureRate > 0) {
    return "Requests failed during the test. Review server logs, database status, and the failing endpoint metrics before increasing load.";
  }

  if (p95 <= 2000) {
    return "The test completed within the configured p95 response-time threshold and without failed HTTP requests.";
  }

  return "The test completed without HTTP failures, but p95 exceeded the configured response-time threshold. This is a candidate point for bottleneck analysis.";
}
