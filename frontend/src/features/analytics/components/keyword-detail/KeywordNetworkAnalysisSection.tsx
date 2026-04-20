import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import type { CoocNetworkEdge, CoocNetworkNode } from "../../../../api/analytics";
import styles from "./KeywordNetworkAnalysisSection.module.css";

type KeywordNetworkAnalysisSectionProps = {
  displayKeyword: string;
  apiNodes: CoocNetworkNode[];
  apiEdges: CoocNetworkEdge[];
  height?: number;
  seed?: string;
};

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

const COOC_RENDER_MAX_NODES = 20;
const COOC_RENDER_MAX_LINKS = 60;
const COOC_VISIBLE_MAX_NODES = 18;
const GRAPH_NODE_COLOR_VARIANTS = 6;
const NETWORK_PAD_X = 28;
const NETWORK_PAD_TOP = 28;
const NETWORK_PAD_BOTTOM = 56;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashInt(text: string) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function rand() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeGraphLabel(label: unknown): string {
  return String(label ?? "")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, " ")
    .trim();
}

function getGraphNodeRadius(node: Pick<GraphNode, "value">) {
  return clamp(14 + (node.value ?? 0) * 2.55, 20, 42);
}

function clampGraphNodeToBounds(node: GraphNode, width: number, height: number) {
  const radius = getGraphNodeRadius(node);
  const minX = NETWORK_PAD_X + radius;
  const maxX = Math.max(minX, width - NETWORK_PAD_X - radius);
  const minY = NETWORK_PAD_TOP + radius;
  const maxY = Math.max(minY, height - NETWORK_PAD_BOTTOM - radius);

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

function getGraphPalette(): GraphPaletteItem[] {
  return [
    { fill: "#2563eb", stroke: "rgba(147,197,253,0.82)", line: "rgba(96,165,250,0.96)" },
    { fill: "#f59e0b", stroke: "rgba(253,230,138,0.88)", line: "rgba(245,158,11,0.96)" },
    { fill: "#dc2626", stroke: "rgba(254,202,202,0.88)", line: "rgba(239,68,68,0.96)" },
    { fill: "#14b8a6", stroke: "rgba(153,246,228,0.84)", line: "rgba(45,212,191,0.96)" },
    { fill: "#8b5cf6", stroke: "rgba(221,214,254,0.84)", line: "rgba(167,139,250,0.96)" },
    { fill: "#ec4899", stroke: "rgba(251,207,232,0.9)", line: "rgba(236,72,153,0.96)" },
  ];
}

function getGraphNodePalette(node: Pick<GraphNode, "group">, palette: GraphPaletteItem[]) {
  return palette[node.group % palette.length];
}

function buildApiCoMentionGraph(
  keyword: string,
  apiNodes: CoocNetworkNode[],
  apiEdges: CoocNetworkEdge[],
  seed: string,
) {
  const normalizedKeyword = String(keyword ?? "").trim();
  const random = mulberry32(hashInt(`graph-${seed}-${normalizedKeyword}`));

  const validApiNodes = (apiNodes ?? []).filter((node) => normalizeGraphLabel(node.label));
  const validNodeIds = new Set(validApiNodes.map((node) => String(node.id)));
  const validApiEdges = (apiEdges ?? []).filter(
    (edge) => validNodeIds.has(String(edge.source)) && validNodeIds.has(String(edge.target)),
  );

  const maxNodeSize = validApiNodes.length
    ? Math.max(...validApiNodes.map((node) => node.size || 0))
    : 1;
  const safeMaxNodeSize = maxNodeSize > 0 ? maxNodeSize : 1;

  const sortedNodes = [...validApiNodes].sort((left, right) => (right.size || 0) - (left.size || 0));
  const keywordNodeIds = sortedNodes
    .filter((node) => normalizeGraphLabel(node.label) === normalizedKeyword)
    .map((node) => String(node.id));

  const selectedNodeIds = new Set<string>();
  keywordNodeIds.forEach((id) => selectedNodeIds.add(id));
  sortedNodes.forEach((node) => {
    if (selectedNodeIds.size >= COOC_RENDER_MAX_NODES) return;
    selectedNodeIds.add(String(node.id));
  });

  const filteredEdges = [...validApiEdges]
    .filter(
      (edge) =>
        selectedNodeIds.has(String(edge.source)) && selectedNodeIds.has(String(edge.target)),
    )
    .sort((left, right) => (right.weight || 0) - (left.weight || 0))
    .slice(0, COOC_RENDER_MAX_LINKS);

  const linkedNodeIds = new Set<string>();
  filteredEdges.forEach((edge) => {
    linkedNodeIds.add(String(edge.source));
    linkedNodeIds.add(String(edge.target));
  });
  keywordNodeIds.forEach((id) => linkedNodeIds.add(id));

  let finalApiNodes = sortedNodes.filter(
    (node) => selectedNodeIds.has(String(node.id)) && linkedNodeIds.has(String(node.id)),
  );

  if (!finalApiNodes.length) {
    finalApiNodes = sortedNodes.slice(0, Math.min(sortedNodes.length, COOC_RENDER_MAX_NODES));
  }

  const nodeIdSet = new Set(finalApiNodes.map((node) => String(node.id)));

  const nodes: GraphNode[] = finalApiNodes.map((node) => {
    const normalizedLabel = normalizeGraphLabel(node.label);
    const size = Number.isFinite(node.size) ? node.size : 0;
    const normalizedValue = clamp(3 + (size / safeMaxNodeSize) * 7, 3, 10);

    return {
      id: String(node.id),
      label: normalizedLabel,
      group:
        hashInt(`graph-color-${seed}-${normalizedLabel}-${node.id}`) % GRAPH_NODE_COLOR_VARIANTS,
      value: normalizedValue,
      x: (random() - 0.5) * 80,
      y: (random() - 0.5) * 80,
    };
  });

  const maxEdgeWeight = filteredEdges.length
    ? Math.max(...filteredEdges.map((edge) => edge.weight || 0))
    : 1;
  const safeMaxEdgeWeight = maxEdgeWeight > 0 ? maxEdgeWeight : 1;

  const links: GraphLink[] = filteredEdges
    .filter(
      (edge) => nodeIdSet.has(String(edge.source)) && nodeIdSet.has(String(edge.target)),
    )
    .map((edge) => {
      const weight = Number.isFinite(edge.weight) ? edge.weight : 0;
      const normalizedWeight = clamp(0.6 + (weight / safeMaxEdgeWeight) * 2.4, 0.6, 3.0);

      return {
        source: String(edge.source),
        target: String(edge.target),
        value: normalizedWeight,
      };
    });

  return { nodes, links };
}

export default function KeywordNetworkAnalysisSection({
  displayKeyword,
  apiNodes,
  apiEdges,
  height = 500,
  seed = "default",
}: KeywordNetworkAnalysisSectionProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const draggingRef = useRef<{ node: GraphNode | null; pointerId: number | null }>({
    node: null,
    pointerId: null,
  });

  const [width, setWidth] = useState(520);
  const [tick, setTick] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const palette = useMemo(() => getGraphPalette(), []);

  useEffect(() => {
    if (!wrapRef.current) return;

    const element = wrapRef.current;
    const observer = new ResizeObserver(() => {
      setWidth(Math.max(280, Math.floor(element.clientWidth)));
    });

    observer.observe(element);

    const frameId = window.requestAnimationFrame(() => {
      setWidth(Math.max(280, Math.floor(element.clientWidth)));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  const simData = useMemo(() => {
    const baseGraph = buildApiCoMentionGraph(displayKeyword, apiNodes, apiEdges, seed);
    const nodes = baseGraph.nodes.map((node) => ({ ...node }));
    const links = baseGraph.links.map((link) => ({ ...link }));
    const random = mulberry32(hashInt(`pos-${seed}-${displayKeyword}-${width}-${height}`));

    nodes.forEach((node) => {
      if (typeof node.x !== "number") {
        node.x = width / 2 + (random() - 0.5) * 40;
      }
      if (typeof node.y !== "number") {
        node.y = height / 2 + (random() - 0.5) * 40;
      }
      clampGraphNodeToBounds(node, width, height);
    });

    return {
      nodes,
      links,
      nodeMap: new Map(nodes.map((node) => [node.id, node] as const)),
    };
  }, [apiEdges, apiNodes, displayKeyword, height, seed, width]);

  const labelVisibleIds = useMemo(() => {
    const sorted = [...simData.nodes].sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
    const ids = new Set<string>();
    const normalizedKeyword = normalizeGraphLabel(displayKeyword);

    simData.nodes.forEach((node) => {
      if (normalizeGraphLabel(node.label) === normalizedKeyword) {
        ids.add(node.id);
      }
    });

    sorted.forEach((node) => {
      if (ids.size >= COOC_VISIBLE_MAX_NODES) return;
      ids.add(node.id);
    });

    return ids;
  }, [displayKeyword, simData.nodes]);

  const hoveredNeighborIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();

    const ids = new Set<string>([hoveredNodeId]);
    simData.links.forEach((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (sourceId === hoveredNodeId) ids.add(targetId);
      if (targetId === hoveredNodeId) ids.add(sourceId);
    });

    return ids;
  }, [hoveredNodeId, simData.links]);

  const hoveredNodeColor = useMemo(() => {
    if (!hoveredNodeId) return null;
    const node = simData.nodeMap.get(hoveredNodeId);
    if (!node) return null;
    return getGraphNodePalette(node, palette).line;
  }, [hoveredNodeId, palette, simData.nodeMap]);

  useEffect(() => {
    if (simRef.current) {
      simRef.current.stop();
      simRef.current = null;
    }

    if (!simData.nodes.length) return;

    const simulation = forceSimulation<GraphNode>(simData.nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(simData.links)
          .id((node) => node.id)
          .distance((link) => clamp(296 - (link.value ?? 1) * 20, 196, 356))
          .strength((link) => clamp(0.18 + (link.value ?? 1) * 0.04, 0.14, 0.32)),
      )
      .force("charge", forceManyBody().strength(-620))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<GraphNode>().radius((node) => getGraphNodeRadius(node) + 30),
      );

    let frameId = 0;
    simulation.on("tick", () => {
      simData.nodes.forEach((node) => {
        clampGraphNodeToBounds(node, width, height);
      });

      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        setTick((value) => (value + 1) % 100000);
      });
    });

    simRef.current = simulation;

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      simulation.stop();
    };
  }, [height, simData, width]);

  const resolveNode = (candidate: string | GraphNode) => {
    if (typeof candidate === "string") {
      return simData.nodeMap.get(candidate) ?? null;
    }

    return candidate;
  };

  const pointerToSvg = (event: ReactPointerEvent<SVGSVGElement | SVGGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return { x: event.clientX, y: event.clientY };
    }

    const rect = svg.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const onNodePointerDown = (event: ReactPointerEvent<SVGGElement>, node: GraphNode) => {
    const simulation = simRef.current;
    const svg = svgRef.current;
    if (!simulation || !svg) return;

    svg.setPointerCapture(event.pointerId);
    draggingRef.current.node = node;
    draggingRef.current.pointerId = event.pointerId;
    setHoveredNodeId(node.id);

    const point = pointerToSvg(event);
    node.fx = point.x;
    node.fy = point.y;
    clampGraphNodeToBounds(node, width, height);

    simulation.alphaTarget(0.25).restart();
  };

  const onSvgPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const simulation = simRef.current;
    if (!simulation) return;

    const dragging = draggingRef.current;
    if (!dragging.node) return;

    const point = pointerToSvg(event);
    dragging.node.fx = point.x;
    dragging.node.fy = point.y;
    clampGraphNodeToBounds(dragging.node, width, height);
  };

  const onSvgPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const simulation = simRef.current;
    if (!simulation) return;

    const dragging = draggingRef.current;
    if (!dragging.node || dragging.pointerId !== event.pointerId) return;

    if (dragging.node.pinned) {
      dragging.node.pinned = false;
      dragging.node.fx = null;
      dragging.node.fy = null;
    } else {
      dragging.node.pinned = true;
    }

    draggingRef.current.node = null;
    draggingRef.current.pointerId = null;
    simulation.alphaTarget(0);
  };

  void tick;

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>관계도 분석</div>
          <div className={styles.cardSub}>
            {displayKeyword}와(과) 함께 자주 언급되는 단어를 공동 출현 관계로 연결해 시각화했습니다.
          </div>
        </div>
        <span className={styles.badgeSoft}>공동 출현 네트워크</span>
      </div>

      {!simData.nodes.length ? (
        <div ref={wrapRef} className={styles.networkWrap}>
          <div className={styles.networkStageHost}>
            <div className={styles.networkStage}>
              <div className={`${styles.emptyBox} ${styles.networkEmptyBox}`}>
                표시할 공동 언급 네트워크 데이터가 없습니다.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={wrapRef} className={styles.networkWrap} aria-label="관계도 네트워크">
            <div className={styles.networkStageHost}>
              <div className={styles.networkStage}>
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
                    {simData.links.map((link, index) => {
                      const source = resolveNode(link.source);
                      const target = resolveNode(link.target);
                      if (!source || !target) return null;
                      if (!labelVisibleIds.has(source.id) || !labelVisibleIds.has(target.id)) {
                        return null;
                      }

                      const isHoveredConnection = Boolean(
                        hoveredNodeId &&
                          (source.id === hoveredNodeId || target.id === hoveredNodeId),
                      );
                      const weight = clamp(link.value ?? 1, 0.6, 3.0);
                      const strokeWidth = isHoveredConnection
                        ? clamp(2.2 + weight * 1.2, 2.2, 5.4)
                        : clamp(1.4 + weight * 0.9, 1.4, 4.2);
                      const opacity = hoveredNodeId
                        ? isHoveredConnection
                          ? 0.95
                          : 0.12
                        : clamp(0.18 + weight * 0.18, 0.2, 0.75);
                      const stroke = isHoveredConnection
                        ? hoveredNodeColor ?? "rgba(148, 163, 184, 0.9)"
                        : "rgba(148, 163, 184, 0.55)";

                      return (
                        <line
                          key={`link-${index}`}
                          x1={source.x ?? 0}
                          y1={source.y ?? 0}
                          x2={target.x ?? 0}
                          y2={target.y ?? 0}
                          className={styles.networkLink}
                          style={{ strokeWidth, opacity, stroke }}
                        />
                      );
                    })}
                  </g>

                  <g className={styles.networkNodes}>
                    {simData.nodes.map((node) => {
                      if (!labelVisibleIds.has(node.id)) return null;

                      const paletteItem = getGraphNodePalette(node, palette);
                      const radius = getGraphNodeRadius(node);
                      const x = node.x ?? width / 2;
                      const y = node.y ?? height / 2;
                      const isHovered = hoveredNodeId === node.id;
                      const isNeighborHighlighted = hoveredNodeId
                        ? hoveredNeighborIds.has(node.id)
                        : false;
                      const circleOpacity = hoveredNodeId ? (isNeighborHighlighted ? 1 : 0.38) : 1;
                      const labelOpacity = hoveredNodeId ? (isNeighborHighlighted ? 1 : 0.45) : 1;

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${x}, ${y})`}
                          className={styles.networkNode}
                          onPointerDown={(event) => onNodePointerDown(event, node)}
                          onPointerEnter={() => setHoveredNodeId(node.id)}
                          onPointerLeave={() => {
                            if (draggingRef.current.node?.id !== node.id) {
                              setHoveredNodeId(null);
                            }
                          }}
                          role="button"
                          aria-label={`${node.label} 노드`}
                        >
                          <circle
                            r={radius}
                            className={styles.networkCircle}
                            style={{
                              fill: paletteItem.fill,
                              stroke: paletteItem.stroke,
                              strokeWidth: isHovered ? 2.8 : 1.6,
                              opacity: circleOpacity,
                              filter: isHovered
                                ? `drop-shadow(0 0 14px ${paletteItem.line}) drop-shadow(0 10px 18px rgba(2, 6, 23, 0.75))`
                                : "drop-shadow(0 10px 18px rgba(2, 6, 23, 0.6))",
                            }}
                          />
                          {node.label ? (
                            <text
                              className={styles.networkLabel}
                              textAnchor="middle"
                              y={radius + 20}
                              style={{ opacity: labelOpacity }}
                            >
                              {node.label}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </div>
          </div>

          <div className={styles.networkHint}>
            상위 연결 노드만 표시됩니다. 노드에 마우스를 올리면 연결 관계가 강조되고, 드래그하면
            위치를 고정할 수 있습니다.
          </div>
        </>
      )}
    </article>
  );
}
