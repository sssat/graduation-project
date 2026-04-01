// frontend/src/components/WordCloudD3.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import cloud from "d3-cloud";

type WordItem = {
  text: string;
  size: 1 | 2 | 3;
};

type CloudWord = {
  text: string;
  size: number; // px
  x: number;
  y: number;
  rotate: number;
};

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

function sizeToPx(s: 1 | 2 | 3, minPx: number, midPx: number, maxPx: number) {
  if (s === 1) return minPx;
  if (s === 2) return midPx;
  return maxPx;
}

export default function WordCloudD3NoRotate({
  items,
  height = 220,
  padding = 3,
  seed = "default",
  className,
  minPx = 16,
  midPx = 26,
  maxPx = 40,
  fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, sans-serif",
}: {
  items: WordItem[];
  height?: number;
  padding?: number;
  seed?: string;
  className?: string;
  minPx?: number;
  midPx?: number;
  maxPx?: number;
  fontFamily?: string;
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

    const layout = cloud<CloudWord>()
      .size([width, height])
      .words(
        items.map((w) => ({
          text: w.text,
          size: sizeToPx(w.size, minPx, midPx, maxPx),
          x: 0,
          y: 0,
          rotate: 0,
        }))
      )
      .padding(padding)
      .rotate(() => 0) // 회전 없음
      .font(fontFamily)
      .fontSize((d) => d.size)
      .random(() => rand()) // 항상 같은 seed면 같은 배치(결정적)
      .spiral("archimedean")
      .on("end", (out) => {
        setWords(out as CloudWord[]);
      });

    layout.start();

    return () => {
      layout.stop();
    };
  }, [items, width, height, padding, seed, minPx, midPx, maxPx, fontFamily]);

  return (
    <div ref={wrapRef} className={className} style={{ width: "100%", height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="워드 클라우드">
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
                  fontFamily,
                  fontWeight: 700,
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
