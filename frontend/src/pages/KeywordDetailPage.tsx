// frontend/src/pages/KeywordDetailPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Chart from "chart.js/auto";
import cloud from "d3-cloud";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import styles from "./KeywordDetailPage.module.css";
import {
  getKeywordDetailMock,
  MEDIA_LABEL_MAP,
  type KeywordPeriod,
  type MediaKey,
  type WordItem,
  type BiasItem,
} from "../mocks/keywordMockData";

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
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

/* ---------- 워드클라우드 ---------- */

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

/* ---------- 네트워크(관계도) 그래프 ---------- */

type GraphNode = SimulationNodeDatum & {
  id: string;
  label: string;
  group: number;
  value: number;
  pinned?: boolean;
};

type GraphLink = SimulationLinkDatum<GraphNode> & {
  value: number;
  source: string | GraphNode;
  target: string | GraphNode;
};

function buildMockCoMentionGraph(keyword: string, entities: string[], seed: string): {
  nodes: GraphNode[];
  links: GraphLink[];
  kwId: string;
} {
  const seedValue = hashInt(`graph-${seed}-${keyword}-${entities.join("|")}`);
  const rand = mulberry32(seedValue);

  const kwId = `kw:${keyword}`;
  const kwNode: GraphNode = {
    id: kwId,
    label: keyword,
    group: 0,
    value: 10,
    x: 0,
    y: 0,
  };

  const uniq = Array.from(new Set(entities)).filter(Boolean).slice(0, 18);

  const nodes: GraphNode[] = [
    kwNode,
    ...uniq.map((name) => {
      const h = hashInt(name);
      const v = 3 + Math.floor(rand() * 6);
      return {
        id: `ent:${name}`,
        label: name,
        group: 1 + (h % 3),
        value: v,
        x: (rand() - 0.5) * 80,
        y: (rand() - 0.5) * 80,
      };
    }),
  ];

  const links: GraphLink[] = [];
  for (const n of nodes) {
    if (n.id === kwId) continue;
    links.push({
      source: kwId,
      target: n.id,
      value: clamp(0.8 + rand() * 2.2, 0.8, 3.0),
    });
  }

  const entityNodes = nodes.filter((n) => n.id !== kwId);
  const extraEdges = Math.min(12, Math.floor(entityNodes.length * 1.2));
  const used = new Set<string>();

  const keyOf = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);

  let guard = 0;
  while (used.size < extraEdges && guard < 2000) {
    guard += 1;
    const a = entityNodes[Math.floor(rand() * entityNodes.length)];
    const b = entityNodes[Math.floor(rand() * entityNodes.length)];
    if (!a || !b || a.id === b.id) continue;

    const k = keyOf(a.id, b.id);
    if (used.has(k)) continue;

    const sameGroup = a.group === b.group;
    const p = sameGroup ? 0.55 : 0.22;
    if (rand() > p) continue;

    used.add(k);
    links.push({
      source: a.id,
      target: b.id,
      value: clamp(0.6 + rand() * 2.0, 0.6, 2.6),
    });
  }

  return { nodes, links, kwId };
}

function NetworkGraph({
  keyword,
  entities,
  height = 260,
  seed = "default",
}: {
  keyword: string;
  entities: string[];
  height?: number;
  seed?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [width, setWidth] = useState(520);
  const [tick, setTick] = useState(0);

  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const draggingRef = useRef<{ node: GraphNode | null; pointerId: number | null }>({
    node: null,
    pointerId: null,
  });

  const palette = useMemo(
    () => [
      { fill: "#1e293b", stroke: "rgba(148,163,184,0.55)" },
      { fill: "#2563eb", stroke: "rgba(147,197,253,0.8)" },
      { fill: "#f59e0b", stroke: "rgba(253,230,138,0.85)" },
      { fill: "#dc2626", stroke: "rgba(254,202,202,0.85)" },
    ],
    []
  );

  useEffect(() => {
    if (!wrapRef.current) return;

    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const next = Math.max(280, Math.floor(el.clientWidth));
      setWidth(next);
    });

    ro.observe(el);
    setWidth(Math.max(280, Math.floor(el.clientWidth)));

    return () => ro.disconnect();
  }, []);

  // ✅ 렌더에서 쓸 nodes/links는 useMemo로 “결정적으로” 생성 (setState 필요 없음)
  const simData = useMemo(() => {
    const baseGraph = buildMockCoMentionGraph(keyword, entities, seed);

    const nodes: GraphNode[] = baseGraph.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = baseGraph.links.map((l) => ({ ...l }));

    // Math.random 금지 대응: 결정적 랜덤
    const posSeed = hashInt(`pos-${seed}-${keyword}-${width}-${height}`);
    const randPos = mulberry32(posSeed);

    for (const n of nodes) {
      if (typeof n.x !== "number") n.x = width / 2 + (randPos() - 0.5) * 40;
      if (typeof n.y !== "number") n.y = height / 2 + (randPos() - 0.5) * 40;
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n] as const));
    return { nodes, links, nodeMap };
  }, [keyword, entities, seed, width, height]);

  const resolveNode = (x: string | GraphNode) => {
    if (typeof x === "string") return simData.nodeMap.get(x) ?? null;
    return x;
  };

  const pointerToSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: e.clientX, y: e.clientY };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onNodePointerDown = (e: React.PointerEvent, node: GraphNode) => {
    const sim = simRef.current;
    const svg = svgRef.current;
    if (!sim || !svg) return;

    svg.setPointerCapture(e.pointerId);

    draggingRef.current.node = node;
    draggingRef.current.pointerId = e.pointerId;

    const p = pointerToSvg(e);
    node.fx = p.x;
    node.fy = p.y;

    sim.alphaTarget(0.25).restart();
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const sim = simRef.current;
    if (!sim) return;

    const d = draggingRef.current;
    if (!d.node) return;

    const p = pointerToSvg(e);
    d.node.fx = p.x;
    d.node.fy = p.y;
  };

  const onSvgPointerUp = (e: React.PointerEvent) => {
    const sim = simRef.current;
    if (!sim) return;

    const d = draggingRef.current;
    if (!d.node) return;

    if (d.pointerId === e.pointerId) {
      const n = d.node;
      if (n.pinned) {
        n.pinned = false;
        n.fx = null;
        n.fy = null;
      } else {
        n.pinned = true;
      }
    }

    draggingRef.current.node = null;
    draggingRef.current.pointerId = null;
    sim.alphaTarget(0);
  };

  useEffect(() => {
    if (simRef.current) {
      simRef.current.stop();
      simRef.current = null;
    }

    const sim = forceSimulation<GraphNode>(simData.nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(simData.links)
          .id((d: GraphNode) => d.id)
          .distance((l: GraphLink) => {
            const v = l.value ?? 1;
            return clamp(140 - v * 30, 70, 160);
          })
          .strength((l: GraphLink) => {
            const v = l.value ?? 1;
            return clamp(0.25 + v * 0.08, 0.2, 0.6);
          })
      )
      .force("charge", forceManyBody().strength(-240))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<GraphNode>().radius((d: GraphNode) => clamp(10 + d.value * 1.8, 14, 34) + 6)
      );

    let raf = 0;
    sim.on("tick", () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setTick((t) => (t + 1) % 100000);
      });
    });

    simRef.current = sim;

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      sim.stop();
    };
  }, [simData, width, height]);

  // tick은 렌더 트리거 역할
  void tick;

  return (
    <div ref={wrapRef} className={styles.networkWrap} aria-label="관계도 네트워크">
      <svg
        ref={svgRef}
        className={styles.networkSvg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="공동 언급 네트워크"
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
      >
        <g className={styles.networkLinks}>
          {simData.links.map((l, idx) => {
            const s = resolveNode(l.source);
            const t = resolveNode(l.target);
            if (!s || !t) return null;

            const w = clamp(l.value ?? 1, 0.6, 3.0);
            const strokeW = clamp(1.4 + w * 0.9, 1.4, 4.2);
            const opacity = clamp(0.18 + w * 0.18, 0.2, 0.75);

            return (
              <line
                key={`link-${idx}`}
                x1={s.x ?? 0}
                y1={s.y ?? 0}
                x2={t.x ?? 0}
                y2={t.y ?? 0}
                className={styles.networkLink}
                style={{ strokeWidth: strokeW, opacity }}
              />
            );
          })}
        </g>

        <g className={styles.networkNodes}>
          {simData.nodes.map((n) => {
            const idx = n.id.startsWith("kw:") ? 0 : n.group;
            const c = palette[idx % palette.length];

            const r = clamp(10 + n.value * 2.0, 14, 34);
            const x = n.x ?? width / 2;
            const y = n.y ?? height / 2;

            return (
              <g
                key={n.id}
                transform={`translate(${x}, ${y})`}
                className={styles.networkNode}
                onPointerDown={(e) => onNodePointerDown(e, n)}
                role="button"
                aria-label={`${n.label} 노드`}
              >
                <circle
                  r={r}
                  className={styles.networkCircle}
                  style={{
                    fill: c.fill,
                    stroke: c.stroke,
                    strokeWidth: n.id.startsWith("kw:") ? 2.2 : 1.6,
                  }}
                />
                <text className={styles.networkLabel} textAnchor="middle" y={r + 16}>
                  {n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className={styles.networkHint}>
        노드를 드래그해 배치할 수 있습니다. 놓으면 고정되고, 다시 누르면 고정이 해제됩니다.
      </div>
    </div>
  );
} 

/* ---------- 페이지 ---------- */

const MEDIA_ORDER: MediaKey[] = [
  "all",
  "chosun",
  "joongang",
  "hani",
  "kbs",
  "mbc",
  "sbs",
  "jtbc",
  "ytn",
  "yonhap",
  "hankyung",
];

const MEDIA_OPTIONS: { value: MediaKey; label: string }[] = MEDIA_ORDER.map((value) => ({
  value,
  label: MEDIA_LABEL_MAP[value],
}));

export default function KeywordDetailPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const rawKeyword =
    params.keyword ?? searchParams.get("keyword") ?? searchParams.get("q") ?? "쿠팡";

  const keyword = useMemo(() => safeDecode(rawKeyword), [rawKeyword]);

  const [period, setPeriod] = useState<KeywordPeriod>("today");
  const [media, setMedia] = useState<MediaKey>("all");

  const detail = useMemo(() => getKeywordDetailMock(keyword, period, media), [keyword, period, media]);

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
              <div className={styles.cardSub}>수집된 데이터와 다양한 분석 지표를 종합해 생성된 ai 요약입니다.</div>
            </div>
            <span className={styles.badgeSoft}>요약 리포트</span>
          </div>
          <div className={styles.summaryText}>{detail.summary}</div>
        </article>
      </section>

      <section className={styles.grid2}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>제목 워드 클라우드</div>
              <div className={styles.cardSub}>수집된 기사 제목에서 자주 등장한 단어를 시각화한 결과입니다.</div>
            </div>
            <span className={styles.badgeSoft}>제목 기반</span>
          </div>

          <WordCloudD3 items={titleWordCloud} height={220} seed={`${keyword}-${period}-${media}-title`} />
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>감성 분석 결과</div>
              <div className={styles.cardSub}>제목 텍스트를 기반으로 긍정/중립/부정 비율을 집계했습니다.</div>
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

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>관계도 분석</div>
              <div className={styles.cardSub}>
                {keyword}과(와) 함께 언급되는 인물·조직을 공동 언급 관계로 연결해 시각화했습니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>공동 언급 네트워크</span>
          </div>

          <NetworkGraph keyword={keyword} entities={entities} height={260} seed={`${keyword}-${period}-${media}`} />
        </article>
      </section>

      <section className={styles.grid2Bottom}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>독자 반응 워드 클라우드</div>
              <div className={styles.cardSub}>뉴스 댓글에서 자주 등장한 단어를 시각화한 결과입니다.</div>
            </div>
            <span className={styles.badgeSoft}>댓글 기반</span>
          </div>

          <WordCloudD3 items={reactionWordCloud} height={220} seed={`${keyword}-${period}-${media}-reaction`} />
        </article>
      </section>
    </main>
  );
}
