// frontend/src/pages/KeywordDetailPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Chart from "chart.js/auto";
import cloud from "d3-cloud";
import styles from "./KeywordDetailPage.module.css";
import {
  getKeywordDetailMock,
  type KeywordPeriod,
  type MediaKey,
  type WordItem,
  type BiasItem,
} from "../mocks/keywordMockData";

function renderSummaryWithHighlight(summary: string, keyword: string) {
  const k = (keyword ?? "").trim();
  if (!k) return summary;

  const idx = summary.indexOf(k);
  if (idx < 0) {
    return (
      <>
        <span className={styles.summaryHighlight}>{keyword}</span> {summary}
      </>
    );
  }

  const before = summary.slice(0, idx);
  const after = summary.slice(idx + k.length);

  return (
    <>
      {before}
      <span className={styles.summaryHighlight}>{keyword}</span>
      {after}
    </>
  );
}

function hashInt(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type CloudWord = {
  text: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
};

function WordCloudD3({
  items,
  height = 220,
  seed = "default",
}: {
  items: WordItem[];
  height?: number;
  seed?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(520);
  const [words, setWords] = useState<CloudWord[]>([]);

  const palette = useMemo(
    () => [
      "#ef4444",
      "#f97316",
      "#facc15",
      "#84cc16",
      "#22c55e",
      "#14b8a6",
      "#06b6d4",
      "#38bdf8",
      "#3b82f6",
      "#8b5cf6",
      "#a855f7",
      "#ec4899",
    ],
    []
  );

  useEffect(() => {
    if (!wrapRef.current) return;

    const el = wrapRef.current;

    const ro = new ResizeObserver(() => {
      const next = Math.max(260, Math.floor(el.clientWidth));
      setWidth(next);
    });

    ro.observe(el);
    setWidth(Math.max(260, Math.floor(el.clientWidth)));

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !height) return;

    const seedValue = hashInt(`${seed}-${width}-${height}`);
    const rand = mulberry32(seedValue);

    const toPx = (s: 1 | 2 | 3) => {
      if (s === 1) return 54;
      if (s === 2) return 34;
      return 20;
    };

    const layout = cloud<CloudWord>()
      .size([width, height])
      .words(
        items.map((w) => ({
          text: w.text,
          size: toPx(w.size),
          x: 0,
          y: 0,
          rotate: 0,
        }))
      )
      .padding(4)
      .rotate(() => 0)
      .font("system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, sans-serif")
      .fontSize((d) => d.size)
      .random(() => rand())
      .spiral("archimedean")
      .on("end", (out) => {
        const normalized = (out as CloudWord[]).map((w) => ({
          ...w,
          rotate: 0,
          size: clamp(w.size, 14, 64),
        }));
        setWords(normalized);
      });

    layout.start();

    return () => {
      layout.stop();
    };
  }, [items, width, height, seed]);

  return (
    <div ref={wrapRef} className={styles.wordcloudClassic} aria-label="워드 클라우드">
      <svg
        className={styles.wordcloudSvg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="워드 클라우드"
      >
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          {words.map((w, i) => {
            const cSeed = hashInt(`${seed}-${w.text}-${i}`);
            const color = palette[cSeed % palette.length];

            return (
              <text
                key={`${w.text}-${i}`}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`translate(${w.x}, ${w.y})`}
                style={{
                  fill: color,
                  fontSize: w.size,
                  fontFamily:
                    "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, sans-serif",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                {w.text}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

const MEDIA_OPTIONS: { value: MediaKey; label: string }[] = [
  { value: "all", label: "전체 언론사" },
  { value: "chosun", label: "조선일보" },
  { value: "joongang", label: "중앙일보" },
  { value: "hani", label: "한겨레" },
  { value: "kbs", label: "KBS" },
  { value: "mbc", label: "MBC" },
  { value: "sbs", label: "SBS" },
  { value: "jtbc", label: "JTBC" },
  { value: "ytn", label: "YTN" },
  { value: "yonhap", label: "연합" },
  { value: "hankyung", label: "한경" },
];

export default function KeywordDetailPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const keyword =
    params.keyword ??
    searchParams.get("keyword") ??
    searchParams.get("q") ??
    "쿠팡";

  const [period, setPeriod] = useState<KeywordPeriod>("today");
  const [media, setMedia] = useState<MediaKey>("all");

  const detail = useMemo(
    () => getKeywordDetailMock(keyword, period, media),
    [keyword, period, media]
  );

  const meta = useMemo(
    () => ({
      rangeLabel: detail.rangeLabel,
      articleCount: detail.articleCount,
      mediaCount: detail.mediaCount,
    }),
    [detail.rangeLabel, detail.articleCount, detail.mediaCount]
  );

  const titleWordCloud: WordItem[] = detail.titleWordCloud;
  const sentiment = detail.sentiment;
  const biasItems: BiasItem[] = detail.biasItems;
  const entities = detail.entities;
  const reactionWordCloud: WordItem[] = detail.reactionWordCloud;

  const sentimentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const biasCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!sentimentCanvasRef.current) return;

    const ctx = sentimentCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["긍정", "중립", "부정"],
        datasets: [
          {
            data: [sentiment.positive, sentiment.neutral, sentiment.negative],
            backgroundColor: ["#22c55e", "#e5e7eb", "#ef4444"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.label ?? "";
                const v = context.parsed ?? 0;
                return `${label}: ${v}%`;
              },
            },
          },
        },
        cutout: "70%",
      },
    });

    return () => chart.destroy();
  }, [sentiment.positive, sentiment.neutral, sentiment.negative]);

  useEffect(() => {
    if (!biasCanvasRef.current) return;

    const ctx = biasCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = biasItems.map((b) => b.label);
    const data = biasItems.map((b) => b.value);

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
              const raw = context.raw as number;
              return raw >= 0 ? "#38bdf8" : "#f97316";
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#9ca3af", font: { size: 11 } },
          },
          y: {
            grid: { color: "rgba(55,65,81,0.5)" },
            ticks: { color: "#9ca3af", font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `편향도 ${context.parsed.y}`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [biasItems]);

  return (
    <main className={styles.pageRoot}>
      <section className={styles.keywordHeader}>
        <div className={styles.breadcrumb}>
          <Link to="/">메인</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>키워드 상세 분석</span>
        </div>

        <div className={styles.keywordTitleRow}>
          <div className={styles.keywordTitleBlock}>
            <div className={styles.keywordChip}>
              키워드 <span className={styles.keywordChipStrong}>{keyword}</span>
            </div>
            <h1 className={styles.keywordMainTitle}>{keyword} 키워드 상세 분석</h1>
            <div className={styles.keywordMeta}>
              분석 기간: {meta.rangeLabel} · 기사 수: {meta.articleCount}건 · 분석 언론사:{" "}
              {meta.mediaCount}개
            </div>
          </div>

          <div className={styles.filterBar}>
            <div className={styles.filterLabel}>기간</div>
            <div className={styles.filterChipGroup} role="tablist" aria-label="분석 기간 선택">
              <button
                type="button"
                className={`${styles.filterChip} ${period === "today" ? styles.active : ""}`}
                onClick={() => setPeriod("today")}
                role="tab"
                aria-selected={period === "today"}
              >
                오늘
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${period === "7d" ? styles.active : ""}`}
                onClick={() => setPeriod("7d")}
                role="tab"
                aria-selected={period === "7d"}
              >
                최근 7일
              </button>
            </div>

            <div className={styles.filterLabel}>언론사</div>
            <select
              className={styles.filterSelect}
              value={media}
              onChange={(e) => setMedia(e.target.value as MediaKey)}
              aria-label="언론사 선택"
            >
              {MEDIA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className={styles.grid1}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>오늘의 키워드 분석 요약</div>
              <div className={styles.cardSub}>
                기사량·감성·편향도를 함께 고려해 ai로 생성된 요약입니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>요약 리포트</span>
          </div>

          <div className={styles.summaryText}>
            {renderSummaryWithHighlight(detail.summary, keyword)}
          </div>
        </article>
      </section>

      <section className={styles.grid2}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>제목 워드 클라우드</div>
              <div className={styles.cardSub}>
                오늘 수집된 기사 제목에서 자주 등장한 단어를 시각화한 결과입니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>제목 기반</span>
          </div>

          <WordCloudD3 items={titleWordCloud} height={220} seed={`${keyword}-${period}-${media}-title`} />
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>감성 분석 결과</div>
              <div className={styles.cardSub}>
                제목 텍스트를 기반으로 긍정/중립/부정 비율을 집계했습니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>텍스트 감성</span>
          </div>

          <div className={styles.chartWrapper}>
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
      </section>

      <section className={styles.grid2}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>언론사별 편향도 지수</div>
              <div className={styles.cardSub}>
                선택 키워드 기사들의 제목 톤을 기반으로 산출한 편향도 지수입니다 (0에
                가까울수록 중립).
              </div>
            </div>
            <span className={styles.badgeSoft}>편향 분석</span>
          </div>

          <div className={styles.chartWrapper}>
            <canvas ref={biasCanvasRef} />
          </div>

          <div className={styles.biasCaption}>
            <strong>양수</strong>일수록 긍정적인 톤, <strong>음수</strong>일수록 비판적인 톤이 강한
            언론사입니다.
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>관련 인물 관계도</div>
              <div className={styles.cardSub}>
                {keyword}과 함께 자주 언급되는 인물·조직을 연결한 네트워크입니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>공동 언급 네트워크</span>
          </div>

          <div className={styles.entityGraph}>
            <div className={styles.entityCloud} aria-label="관련 인물/조직 칩">
              {entities.map((e) => (
                <span key={e} className={styles.entityChip}>
                  {e}
                </span>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className={styles.grid2Bottom}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>독자 반응 워드 클라우드</div>
              <div className={styles.cardSub}>
                뉴스 댓글에서 자주 등장한 단어를 시각화한 결과입니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>댓글 기반</span>
          </div>

          <WordCloudD3
            items={reactionWordCloud}
            height={220}
            seed={`${keyword}-${period}-${media}-reaction`}
          />
        </article>
      </section>
    </main>
  );
}
