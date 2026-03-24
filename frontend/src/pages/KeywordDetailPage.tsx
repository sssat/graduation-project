// frontend/src/pages/KeywordDetailPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  getAiSummary,
  getCommentWordcloud,
  getContentSentiment,
  getCoocNetwork,
  getKeywordMeta,
  getTitleBiasByMedia,
  getTitleWordcloud,
  type CoocNetworkEdge,
  type CoocNetworkNode,
  type ContentSentimentResponse,
  type KeywordMetaResponse,
  type TitleBiasByMediaItem,
} from "../api/analytics";

type KeywordPeriod = "D7" | "D14";

type RenderWordItem = {
  text: string;
  weight: number;
};

type KeywordDetailViewData = {
  meta: KeywordMetaResponse;
  summaryText: string;
  titleWordcloud: RenderWordItem[];
  commentWordcloud: RenderWordItem[];
  sentiment: ContentSentimentResponse;
  biasItems: TitleBiasByMediaItem[];
  coocNodes: CoocNetworkNode[];
  coocEdges: CoocNetworkEdge[];
};

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

function toPeriodParam(raw: string | null | undefined): KeywordPeriod {
  if (!raw) return "D7";
  const normalized = raw.toUpperCase();
  if (normalized === "D14" || normalized === "14D" || normalized === "14") return "D14";
  return "D7";
}

function parsePositiveInt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function formatKoreanRange(start: string, end: string): string {
  if (!start || !end) return "-";
  return `${start} ~ ${end}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error !== null) {
    const anyErr = error as {
      response?: { data?: { message?: string; details?: string } };
      message?: string;
    };

    const message =
      anyErr.response?.data?.message ||
      anyErr.response?.data?.details ||
      anyErr.message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "요청 처리 중 오류가 발생했습니다.";
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

type ChartColors = {
  sentPos: string;
  sentNeu: string;
  sentNeg: string;
  biasPos: string;
  biasNeg: string;
};

function readCssVar(style: CSSStyleDeclaration, name: string) {
  return (style.getPropertyValue(name) || "").trim();
}

function getChartColors(el: HTMLElement | null): ChartColors {
  const base = el ?? document.documentElement;
  const style = window.getComputedStyle(base);

  const sentPos = readCssVar(style, "--ns-sent-pos") || "#22c55e";
  const sentNeu = readCssVar(style, "--ns-sent-neu") || "#e5e7eb";
  const sentNeg = readCssVar(style, "--ns-sent-neg") || "#ef4444";
  const biasPos = readCssVar(style, "--ns-bias-pos") || "#38bdf8";
  const biasNeg = readCssVar(style, "--ns-bias-neg") || "#f97316";

  return { sentPos, sentNeu, sentNeg, biasPos, biasNeg };
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
  items: RenderWordItem[];
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

    const rafId = window.requestAnimationFrame(() => {
      const next = Math.max(260, Math.floor(el.clientWidth));
      setWidth(next);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!width || !height) return;
    if (!items.length) {
      return;
    }

    const maxWeight = Math.max(...items.map((w) => w.weight));
    const minWeight = Math.min(...items.map((w) => w.weight));

    const toPx = (weight: number) => {
      if (!Number.isFinite(weight)) return 22;
      if (maxWeight <= 0 && minWeight <= 0) return 24;
      if (maxWeight === minWeight) return 30;
      const ratio = (weight - minWeight) / (maxWeight - minWeight);
      return clamp(18 + ratio * 38, 16, 58);
    };

    const seedValue = hashInt(`${seed}-${width}-${height}`);
    const rand = mulberry32(seedValue);

    const layout = cloud<CloudWord>()
      .size([width, height])
      .words(
        items.map((w) => ({
          text: w.text,
          size: toPx(w.weight),
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

  if (!items.length) {
    return (
      <div ref={wrapRef} className={styles.wordcloudClassic}>
        <div className={styles.emptyBox}>표시할 워드클라우드 데이터가 없습니다.</div>
      </div>
    );
  }

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
                  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, sans-serif",
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

type GraphPaletteItem = {
  fill: string;
  stroke: string;
  line: string;
};

// 화면에 보여질 노드 수 상한
const COOC_RENDER_MAX_NODES = 20;

// 화면에 보여질 엣지 수 상한
const COOC_RENDER_MAX_LINKS = 60;

// 실제로 화면에 보이게 할 상위 노드 수 상한
const COOC_LABEL_TOP_N = 12;

function normalizeGraphLabel(label: unknown): string {
  return String(label ?? "")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, " ")
    .trim();
}

function getGraphNodeRadius(node: Pick<GraphNode, "value">) {
  return clamp(10 + (node.value ?? 0) * 2.0, 14, 34);
}

const NETWORK_PAD_X = 20;
const NETWORK_PAD_TOP = 20;
const NETWORK_PAD_BOTTOM = 44;

function clampGraphNodeToBounds(node: GraphNode, width: number, height: number) {
  const r = getGraphNodeRadius(node);

  const minX = NETWORK_PAD_X + r;
  const maxX = Math.max(minX, width - NETWORK_PAD_X - r);

  const minY = NETWORK_PAD_TOP + r;
  const maxY = Math.max(minY, height - NETWORK_PAD_BOTTOM - r);

  if (typeof node.x === "number") {
    node.x = clamp(node.x, minX, maxX);
  }
  if (typeof node.y === "number") {
    node.y = clamp(node.y, minY, maxY);
  }

  if (typeof node.fx === "number") {
    node.fx = clamp(node.fx, minX, maxX);
  }
  if (typeof node.fy === "number") {
    node.fy = clamp(node.fy, minY, maxY);
  }
}

function getGraphPalette() {
  return [
    { fill: "#2563eb", stroke: "rgba(147,197,253,0.82)", line: "rgba(96,165,250,0.96)" },
    { fill: "#f59e0b", stroke: "rgba(253,230,138,0.88)", line: "rgba(245,158,11,0.96)" },
    { fill: "#dc2626", stroke: "rgba(254,202,202,0.88)", line: "rgba(239,68,68,0.96)" },
    { fill: "#14b8a6", stroke: "rgba(153,246,228,0.84)", line: "rgba(45,212,191,0.96)" },
    { fill: "#8b5cf6", stroke: "rgba(221,214,254,0.84)", line: "rgba(167,139,250,0.96)" },
  ] satisfies GraphPaletteItem[];
}

function getGraphNodePalette(node: Pick<GraphNode, "group">, palette: GraphPaletteItem[]) {
  return palette[node.group % palette.length];
}

function buildApiCoMentionGraph(
  keyword: string,
  apiNodes: CoocNetworkNode[],
  apiEdges: CoocNetworkEdge[],
  seed: string
): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  const normalizedKeyword = String(keyword ?? "").trim();
  const seedValue = hashInt(`graph-${seed}-${normalizedKeyword}`);
  const rand = mulberry32(seedValue);

  const validApiNodes = (apiNodes ?? []).filter((n) => normalizeGraphLabel(n.label));
  const validNodeIdSet = new Set(validApiNodes.map((n) => String(n.id)));
  const validApiEdges = (apiEdges ?? []).filter(
    (e) => validNodeIdSet.has(String(e.source)) && validNodeIdSet.has(String(e.target))
  );

  const maxNodeSize = validApiNodes.length ? Math.max(...validApiNodes.map((n) => n.size || 0)) : 1;
  const safeMaxNodeSize = maxNodeSize > 0 ? maxNodeSize : 1;

  const sortedNodes = [...validApiNodes].sort((a, b) => (b.size || 0) - (a.size || 0));
  const keywordNodeIds = sortedNodes
    .filter((n) => normalizeGraphLabel(n.label) === normalizedKeyword)
    .map((n) => String(n.id));

  const selectedNodeIds = new Set<string>();
  for (const id of keywordNodeIds) selectedNodeIds.add(id);
  for (const n of sortedNodes) {
    if (selectedNodeIds.size >= COOC_RENDER_MAX_NODES) break;
    selectedNodeIds.add(String(n.id));
  }

  const filteredEdges = [...validApiEdges]
    .filter((e) => selectedNodeIds.has(String(e.source)) && selectedNodeIds.has(String(e.target)))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, COOC_RENDER_MAX_LINKS);

  const linkedNodeIds = new Set<string>();
  for (const e of filteredEdges) {
    linkedNodeIds.add(String(e.source));
    linkedNodeIds.add(String(e.target));
  }
  for (const id of keywordNodeIds) linkedNodeIds.add(id);

  let finalApiNodes = sortedNodes.filter(
    (n) => selectedNodeIds.has(String(n.id)) && linkedNodeIds.has(String(n.id))
  );

  if (!finalApiNodes.length) {
    finalApiNodes = sortedNodes.slice(0, Math.min(sortedNodes.length, COOC_RENDER_MAX_NODES));
  }

  const nodeIdSet = new Set(finalApiNodes.map((n) => String(n.id)));

  const nodes: GraphNode[] = finalApiNodes.map((n) => {
    const normalizedLabel = normalizeGraphLabel(n.label);
    const size = Number.isFinite(n.size) ? n.size : 0;
    const normalizedValue = clamp(3 + (size / safeMaxNodeSize) * 7, 3, 10);

    return {
      id: String(n.id),
      label: normalizedLabel,
      group: hashInt(normalizedLabel) % 5,
      value: normalizedValue,
      x: (rand() - 0.5) * 80,
      y: (rand() - 0.5) * 80,
    };
  });

  const maxEdgeWeight = filteredEdges.length ? Math.max(...filteredEdges.map((e) => e.weight || 0)) : 1;
  const safeMaxEdgeWeight = maxEdgeWeight > 0 ? maxEdgeWeight : 1;

  const links: GraphLink[] = filteredEdges
    .filter((e) => nodeIdSet.has(String(e.source)) && nodeIdSet.has(String(e.target)))
    .map((e) => {
      const weight = Number.isFinite(e.weight) ? e.weight : 0;
      const normalizedWeight = clamp(0.6 + (weight / safeMaxEdgeWeight) * 2.4, 0.6, 3.0);

      return {
        source: String(e.source),
        target: String(e.target),
        value: normalizedWeight,
      };
    });

  return { nodes, links };
}

function NetworkGraph({
  keyword,
  apiNodes,
  apiEdges,
  height = 260,
  seed = "default",
}: {
  keyword: string;
  apiNodes: CoocNetworkNode[];
  apiEdges: CoocNetworkEdge[];
  height?: number;
  seed?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [width, setWidth] = useState(520);
  const [tick, setTick] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const draggingRef = useRef<{ node: GraphNode | null; pointerId: number | null }>({
    node: null,
    pointerId: null,
  });

  const palette = useMemo(() => getGraphPalette(), []);

  useEffect(() => {
    if (!wrapRef.current) return;

    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const next = Math.max(280, Math.floor(el.clientWidth));
      setWidth(next);
    });

    ro.observe(el);

    const rafId = window.requestAnimationFrame(() => {
      const next = Math.max(280, Math.floor(el.clientWidth));
      setWidth(next);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const simData = useMemo(() => {
    const baseGraph = buildApiCoMentionGraph(keyword, apiNodes, apiEdges, seed);

    const nodes: GraphNode[] = baseGraph.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = baseGraph.links.map((l) => ({ ...l }));

    const posSeed = hashInt(`pos-${seed}-${keyword}-${width}-${height}`);
    const randPos = mulberry32(posSeed);

    for (const n of nodes) {
      if (typeof n.x !== "number") n.x = width / 2 + (randPos() - 0.5) * 40;
      if (typeof n.y !== "number") n.y = height / 2 + (randPos() - 0.5) * 40;
      clampGraphNodeToBounds(n, width, height);
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n] as const));
    return { nodes, links, nodeMap };
  }, [keyword, apiNodes, apiEdges, seed, width, height]);

  const labelVisibleIds = useMemo(() => {
    const sorted = [...simData.nodes].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const ids = new Set<string>();
    const normalizedKeyword = normalizeGraphLabel(keyword);

    for (const n of simData.nodes) {
      if (normalizeGraphLabel(n.label) === normalizedKeyword) {
        ids.add(n.id);
      }
    }
    for (const n of sorted.slice(0, COOC_LABEL_TOP_N)) {
      ids.add(n.id);
    }

    return ids;
  }, [keyword, simData.nodes]);

  const renderedNodeIds = labelVisibleIds;

  const hoveredNeighborIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();

    const ids = new Set<string>([hoveredNodeId]);

    for (const link of simData.links) {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (sourceId === hoveredNodeId) ids.add(targetId);
      if (targetId === hoveredNodeId) ids.add(sourceId);
    }

    return ids;
  }, [hoveredNodeId, simData.links]);

  const hoveredNodeColor = useMemo(() => {
    if (!hoveredNodeId) return null;
    const node = simData.nodeMap.get(hoveredNodeId);
    if (!node) return null;
    return getGraphNodePalette(node, palette).line;
  }, [hoveredNodeId, palette, simData.nodeMap]);

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

    setHoveredNodeId(node.id);

    const p = pointerToSvg(e);
    node.fx = p.x;
    node.fy = p.y;
    clampGraphNodeToBounds(node, width, height);

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
    clampGraphNodeToBounds(d.node, width, height);
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

    if (!simData.nodes.length) return;

    const sim = forceSimulation<GraphNode>(simData.nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(simData.links)
          .id((d: GraphNode) => d.id)
          .distance((l: GraphLink) => {
            const v = l.value ?? 1;
            return clamp(180 - v * 30, 96, 210);
          })
          .strength((l: GraphLink) => {
            const v = l.value ?? 1;
            return clamp(0.22 + v * 0.06, 0.18, 0.45);
          })
      )
      .force("charge", forceManyBody().strength(-320))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<GraphNode>().radius((d: GraphNode) => getGraphNodeRadius(d) + 12)
      );

    let raf = 0;
    sim.on("tick", () => {
      for (const node of simData.nodes) {
        clampGraphNodeToBounds(node, width, height);
      }

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

  void tick;

  if (!simData.nodes.length) {
    return (
      <div ref={wrapRef} className={styles.networkWrap}>
        <div className={styles.emptyBox}>표시할 공동 언급 네트워크 데이터가 없습니다.</div>
      </div>
    );
  }

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
        onPointerLeave={() => {
          if (!draggingRef.current.node) {
            setHoveredNodeId(null);
          }
        }}
      >
        <g className={styles.networkLinks}>
          {simData.links.map((l, idx) => {
            const s = resolveNode(l.source);
            const t = resolveNode(l.target);
            if (!s || !t) return null;
            if (!renderedNodeIds.has(s.id) || !renderedNodeIds.has(t.id)) return null;

            const isHoveredConnection = Boolean(
              hoveredNodeId && (s.id === hoveredNodeId || t.id === hoveredNodeId)
            );
            const w = clamp(l.value ?? 1, 0.6, 3.0);
            const strokeW = isHoveredConnection
              ? clamp(2.2 + w * 1.2, 2.2, 5.4)
              : clamp(1.4 + w * 0.9, 1.4, 4.2);
            const opacity = hoveredNodeId
              ? isHoveredConnection
                ? 0.95
                : 0.12
              : clamp(0.18 + w * 0.18, 0.2, 0.75);
            const stroke = isHoveredConnection
              ? hoveredNodeColor ?? "rgba(148, 163, 184, 0.9)"
              : "rgba(148, 163, 184, 0.55)";

            return (
              <line
                key={`link-${idx}`}
                x1={s.x ?? 0}
                y1={s.y ?? 0}
                x2={t.x ?? 0}
                y2={t.y ?? 0}
                className={styles.networkLink}
                style={{ strokeWidth: strokeW, opacity, stroke }}
              />
            );
          })}
        </g>

        <g className={styles.networkNodes}>
          {simData.nodes.map((n) => {
            if (!renderedNodeIds.has(n.id)) return null;

            const c = getGraphNodePalette(n, palette);
            const r = getGraphNodeRadius(n);
            const x = n.x ?? width / 2;
            const y = n.y ?? height / 2;
            const isHovered = hoveredNodeId === n.id;
            const isNeighborHighlighted = hoveredNodeId ? hoveredNeighborIds.has(n.id) : false;
            const circleOpacity = hoveredNodeId ? (isNeighborHighlighted ? 1 : 0.38) : 1;
            const labelOpacity = hoveredNodeId ? (isNeighborHighlighted ? 1 : 0.45) : 1;

            return (
              <g
                key={n.id}
                transform={`translate(${x}, ${y})`}
                className={styles.networkNode}
                onPointerDown={(e) => onNodePointerDown(e, n)}
                onPointerEnter={() => setHoveredNodeId(n.id)}
                onPointerLeave={() => {
                  if (draggingRef.current.node?.id !== n.id) {
                    setHoveredNodeId(null);
                  }
                }}
                role="button"
                aria-label={`${n.label} 노드`}
              >
                <circle
                  r={r}
                  className={styles.networkCircle}
                  style={{
                    fill: c.fill,
                    stroke: c.stroke,
                    strokeWidth: isHovered ? 2.8 : 1.6,
                    opacity: circleOpacity,
                    filter: isHovered
                      ? `drop-shadow(0 0 14px ${c.line}) drop-shadow(0 10px 18px rgba(2, 6, 23, 0.75))`
                      : "drop-shadow(0 10px 18px rgba(2, 6, 23, 0.6))",
                  }}
                />
                {n.label ? (
                  <text
                    className={styles.networkLabel}
                    textAnchor="middle"
                    y={r + 16}
                    style={{ opacity: labelOpacity }}
                  >
                    {n.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      <div className={styles.networkHint}>
        상위 핵심 노드의 연결만 표시합니다. 노드에 마우스를 올리면 연결된 관계를 강조해 볼 수 있고, 드래그 후 놓으면 고정되며 다시 누르면 고정이 해제됩니다.
      </div>
    </div>
  );
}

/* ---------- 페이지 ---------- */

export default function KeywordDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const routeParams = params as Record<string, string | undefined>;

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

  const keywordFallback = useMemo(() => safeDecode(rawKeywordFallback || ""), [rawKeywordFallback]);

  const [period, setPeriod] = useState<KeywordPeriod>(() => toPeriodParam(searchParams.get("period")));
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewData, setViewData] = useState<KeywordDetailViewData | null>(null);

  const rootRef = useRef<HTMLElement | null>(null);
  const redirectedInsufficientRef = useRef<string | null>(null);

  const sentimentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const biasCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const sentimentChartRef = useRef<Chart | null>(null);
  const biasChartRef = useRef<Chart | null>(null);

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
            titleWordcloud: [],
            commentWordcloud: [],
            sentiment: { positive: 0, neutral: 0, negative: 0 },
            biasItems: [],
            coocNodes: [],
            coocEdges: [],
          });
          setLoading(false);
          return;
        }

        const [
          summaryRes,
          titleWordcloudRes,
          sentimentRes,
          biasRes,
          coocRes,
          commentWordcloudRes,
        ] = await Promise.all([
          getAiSummary(targetKeywordSeq, { period }),
          getTitleWordcloud(targetKeywordSeq, { period }),
          getContentSentiment(targetKeywordSeq, { period }),
          getTitleBiasByMedia(targetKeywordSeq, { period }),
          getCoocNetwork(targetKeywordSeq, { period }),
          getCommentWordcloud(targetKeywordSeq, { period }),
        ]);

        if (cancelled) return;

        setViewData({
          meta,
          summaryText: summaryRes.summary_text ?? "",
          titleWordcloud: normalizeWordcloudItems(titleWordcloudRes.items ?? []),
          commentWordcloud: normalizeWordcloudItems(commentWordcloudRes.items ?? []),
          sentiment: roundSentiment(sentimentRes),
          biasItems: (biasRes.items ?? []).slice(),
          coocNodes: coocRes.nodes ?? [],
          coocEdges: coocRes.edges ?? [],
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
    if (!isInsufficient || !meta || !keywordSeq) return;

    const key = `${keywordSeq}-${period}`;
    if (redirectedInsufficientRef.current === key) return;
    redirectedInsufficientRef.current = key;

    window.alert("데이터가 부족하여 분석을 제공하지 않습니다. (ALL + 최근 7일 기사 수 10건 미만)");
    navigate("/", { replace: true });
  }, [isInsufficient, keywordSeq, meta, navigate, period]);

  useEffect(() => {
    if (!viewData || isInsufficient) return;
    if (!sentimentCanvasRef.current) return;

    const ctx = sentimentCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const chartColors = getChartColors(rootRef.current);

    if (sentimentChartRef.current) {
      sentimentChartRef.current.destroy();
      sentimentChartRef.current = null;
    }

    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["긍정", "중립", "부정"],
        datasets: [
          {
            data: [
              viewData.sentiment.positive,
              viewData.sentiment.neutral,
              viewData.sentiment.negative,
            ],
            backgroundColor: [chartColors.sentPos, chartColors.sentNeu, chartColors.sentNeg],
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

    sentimentChartRef.current = chart;

    return () => {
      chart.destroy();
      sentimentChartRef.current = null;
    };
  }, [isInsufficient, viewData]);

  useEffect(() => {
    if (!viewData || isInsufficient) return;
    if (!biasCanvasRef.current) return;

    const ctx = biasCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const chartColors = getChartColors(rootRef.current);

    if (biasChartRef.current) {
      biasChartRef.current.destroy();
      biasChartRef.current = null;
    }

    const labels = viewData.biasItems.map((b) => b.media_name);
    const data = viewData.biasItems.map((b) => b.bias_score);

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
              return raw >= 0 ? chartColors.biasPos : chartColors.biasNeg;
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
            min: -10,
            max: 10,
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

    biasChartRef.current = chart;

    return () => {
      chart.destroy();
      biasChartRef.current = null;
    };
  }, [isInsufficient, viewData]);

  useEffect(() => {
    return () => {
      if (sentimentChartRef.current) {
        sentimentChartRef.current.destroy();
        sentimentChartRef.current = null;
      }
      if (biasChartRef.current) {
        biasChartRef.current.destroy();
        biasChartRef.current = null;
      }
    };
  }, []);

  if (!keywordSeq) {
    return (
      <main className={styles.pageRoot}>
        <section className={styles.keywordHeader}>
          <div className={styles.breadcrumb}>
            <Link to="/">메인</Link>
            <span className={styles.breadcrumbSep}>›</span>
            <span>키워드 상세 분석</span>
          </div>
        </section>

        <section className={styles.grid1}>
          <article className={`${styles.card} ${styles.statusCard}`}>
            <div className={styles.statusTitle}>잘못된 접근입니다</div>
            <div className={styles.statusActions}>
              <Link to="/" className={styles.primaryLinkButton}>
                메인으로 이동
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (loading) {
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
                키워드 <span className={styles.keywordChipStrong}>{displayKeyword}</span>
              </div>
              <h1 className={styles.keywordMainTitle}>{displayKeyword} 키워드 상세 분석</h1>
              <div className={styles.keywordMeta}>데이터를 불러오는 중입니다...</div>
            </div>

            <div className={styles.filterBar}>
              <div className={styles.filterLabel}>기간</div>
              <div className={styles.filterChipGroup} role="tablist" aria-label="분석 기간 선택">
                <button
                  type="button"
                  className={`${styles.filterChip} ${period === "D7" ? styles.active : ""}`}
                  onClick={() => setPeriod("D7")}
                  role="tab"
                  aria-selected={period === "D7"}
                >
                  최근 7일
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${period === "D14" ? styles.active : ""}`}
                  onClick={() => setPeriod("D14")}
                  role="tab"
                  aria-selected={period === "D14"}
                >
                  최근 14일
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.grid1}>
          <article className={`${styles.card} ${styles.statusCard}`}>
            <div className={styles.statusTitle}>분석 데이터를 불러오는 중입니다</div>
            <div className={styles.statusText}>잠시 후 자동으로 표시됩니다.</div>
          </article>
        </section>
      </main>
    );
  }

  if (errorMessage) {
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
                키워드 <span className={styles.keywordChipStrong}>{displayKeyword}</span>
              </div>
              <h1 className={styles.keywordMainTitle}>{displayKeyword} 키워드 상세 분석</h1>
              <div className={styles.keywordMeta}>조회 실패</div>
            </div>
          </div>
        </section>

        <section className={styles.grid1}>
          <article className={`${styles.card} ${styles.statusCard}`}>
            <div className={styles.statusTitle}>데이터를 불러오지 못했습니다</div>
            <div className={styles.statusText}>{errorMessage}</div>
            <div className={styles.statusActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => window.location.reload()}>
                새로고침
              </button>
              <Link to="/" className={styles.primaryLinkButton}>
                메인으로 이동
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (!viewData || !meta || isInsufficient) {
    return null;
  }

  const sentiment = viewData.sentiment;

  return (
    <main ref={rootRef} className={styles.pageRoot}>
      <section className={styles.keywordHeader}>
        <div className={styles.breadcrumb}>
          <Link to="/">메인</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>키워드 상세 분석</span>
        </div>

        <div className={styles.keywordTitleRow}>
          <div className={styles.keywordTitleBlock}>
            <div className={styles.keywordChip}>
              키워드 <span className={styles.keywordChipStrong}>{displayKeyword}</span>
            </div>
            <h1 className={styles.keywordMainTitle}>{displayKeyword} 키워드 상세 분석</h1>
            <div className={styles.keywordMeta}>
              분석 기간: {rangeLabel} · 기사 수: {meta.article_count}건 · 분석 언론사: {meta.media_count}개
            </div>
          </div>

          <div className={styles.filterBar}>
            <div className={styles.filterLabel}>기간</div>
            <div className={styles.filterChipGroup} role="tablist" aria-label="분석 기간 선택">
              <button
                type="button"
                className={`${styles.filterChip} ${period === "D7" ? styles.active : ""}`}
                onClick={() => setPeriod("D7")}
                role="tab"
                aria-selected={period === "D7"}
              >
                최근 7일
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${period === "D14" ? styles.active : ""}`}
                onClick={() => setPeriod("D14")}
                role="tab"
                aria-selected={period === "D14"}
              >
                최근 14일
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.grid1}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>키워드 분석 요약</div>
              <div className={styles.cardSub}>수집된 기사 내용을 바탕으로 생성한 AI 요약입니다.</div>
            </div>
            <span className={styles.badgeSoft}>요약 리포트</span>
          </div>
          <div className={styles.summaryText}>
            {viewData.summaryText?.trim() ? viewData.summaryText : "요약 데이터가 없습니다."}
          </div>
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

          <WordCloudD3 items={viewData.titleWordcloud} height={220} seed={`${displayKeyword}-${period}-title`} />
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>감성 분석 결과</div>
              <div className={styles.cardSub}>기사 본문을 기반으로 긍정/중립/부정 비율을 집계했습니다.</div>
            </div>
            <span className={styles.badgeSoft}>텍스트 감성</span>
          </div>

          <div className={styles.chartWrapper}>
            <canvas ref={sentimentCanvasRef} />
          </div>

          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.swatchPositive}`} />
              긍정 (Positive) <strong>{sentiment.positive}%</strong>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.swatchNeutral}`} />
              중립 (Neutral) <strong>{sentiment.neutral}%</strong>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.swatchNegative}`} />
              부정 (Negative) <strong>{sentiment.negative}%</strong>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.grid2}>
        <article className={`${styles.card} ${styles.cardFill}`}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>언론사별 편향도 지수</div>
              <div className={styles.cardSub}>
                기사들의 제목 톤을 기반으로 산출한 지표입니다 (0에 가까울수록 중립).
              </div>
            </div>
            <span className={styles.badgeSoft}>편향 분석</span>
          </div>

          {viewData.biasItems.length ? (
            <>
              <div className={`${styles.chartWrapper} ${styles.chartWrapperStretch}`}>
                <canvas ref={biasCanvasRef} />
              </div>

              <div className={styles.biasCaption}>
                <strong>양수</strong>일수록 긍정적인 톤, <strong>음수</strong>일수록 비판적인 톤이 강한 언론사입니다. 점수가 <strong>0에 가까운 경우</strong>에는 그래프상에서 눈에 잘 띄지 않거나 거의 표시되지 않을 수 있습니다.
              </div>
            </>
          ) : (
            <div className={styles.emptyBox}>표시할 편향도 데이터가 없습니다.</div>
          )}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>관계도 분석</div>
              <div className={styles.cardSub}>
                {displayKeyword}과(와) 함께 언급되는 인물·조직·단어를 공동 언급 관계로 연결해 시각화했습니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>공동 출현 네트워크</span>
          </div>

          <NetworkGraph
            keyword={displayKeyword}
            apiNodes={viewData.coocNodes}
            apiEdges={viewData.coocEdges}
            height={340}
            seed={`${displayKeyword}-${period}-cooc`}
          />
        </article>
      </section>

      <section className={styles.grid2Bottom}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>뉴스 댓글 워드 클라우드</div>
              <div className={styles.cardSub}>뉴스 댓글에서 자주 등장한 단어를 시각화한 결과입니다.</div>
            </div>
            <span className={styles.badgeSoft}>댓글 기반</span>
          </div>

          <WordCloudD3 items={viewData.commentWordcloud} height={220} seed={`${displayKeyword}-${period}-comment`} />
        </article>
      </section>
    </main>
  );
}
