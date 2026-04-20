import { useEffect, useMemo, useRef, useState } from "react";
import cloud from "d3-cloud";
import styles from "./KeywordWordCloudAnalysisSection.module.css";

type RenderWordItem = {
  text: string;
  weight: number;
};

type CloudWord = {
  text: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
};

type KeywordWordCloudAnalysisSectionProps = {
  title: string;
  subtitle: string;
  badgeText: string;
  items: RenderWordItem[];
  height?: number;
  seed?: string;
};

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

export default function KeywordWordCloudAnalysisSection({
  title,
  subtitle,
  badgeText,
  items,
  height = 460,
  seed = "default",
}: KeywordWordCloudAnalysisSectionProps) {
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
    [],
  );

  useEffect(() => {
    if (!wrapRef.current) return;

    const element = wrapRef.current;
    const observer = new ResizeObserver(() => {
      setWidth(Math.max(260, Math.floor(element.clientWidth)));
    });

    observer.observe(element);

    const frameId = window.requestAnimationFrame(() => {
      setWidth(Math.max(260, Math.floor(element.clientWidth)));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!width || !height) return;

    if (!items.length) {
      setWords([]);
      return;
    }

    const maxWeight = Math.max(...items.map((item) => item.weight));
    const minWeight = Math.min(...items.map((item) => item.weight));

    const toPixelSize = (weight: number) => {
      if (!Number.isFinite(weight)) return 30;
      if (maxWeight <= 0 && minWeight <= 0) return 34;
      if (maxWeight === minWeight) return 42;

      const ratio = (weight - minWeight) / (maxWeight - minWeight);
      return clamp(30 + ratio * 54, 24, 86);
    };

    const random = mulberry32(hashInt(`${seed}-${width}-${height}`));

    const layout = cloud<CloudWord>()
      .size([width, height])
      .words(
        items.map((item) => ({
          text: item.text,
          size: toPixelSize(item.weight),
          x: 0,
          y: 0,
          rotate: 0,
        })),
      )
      .padding(4)
      .rotate(() => 0)
      .font("system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, sans-serif")
      .fontSize((word) => word.size)
      .random(() => random())
      .spiral("archimedean")
      .on("end", (result) => {
        const normalized = (result as CloudWord[]).map((word) => ({
          ...word,
          rotate: 0,
          size: clamp(word.size, 22, 90),
        }));
        setWords(normalized);
      });

    layout.start();

    return () => {
      layout.stop();
    };
  }, [height, items, seed, width]);

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>{title}</div>
          <div className={styles.cardSub}>{subtitle}</div>
        </div>
        <span className={styles.badgeSoft}>{badgeText}</span>
      </div>

      {!items.length ? (
        <div ref={wrapRef} className={styles.wordcloudClassic}>
          <div className={styles.wordcloudStageHost}>
            <div className={styles.wordcloudStage}>
              <div className={`${styles.emptyBox} ${styles.wordcloudEmptyBox}`}>
                워드 클라우드 데이터가 없습니다.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={wrapRef}
          className={styles.wordcloudClassic}
          style={{ height }}
          aria-label="워드 클라우드"
        >
          <div className={styles.wordcloudStageHost}>
            <div className={styles.wordcloudStage}>
              <svg
                className={styles.wordcloudSvg}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="워드 클라우드"
              >
                <g transform={`translate(${width / 2}, ${height / 2})`}>
                  {words.map((word, index) => {
                    const color = palette[hashInt(`${seed}-${word.text}-${index}`) % palette.length];

                    return (
                      <text
                        key={`${word.text}-${index}`}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`translate(${word.x}, ${word.y})`}
                        style={{
                          fill: color,
                          fontSize: word.size,
                          fontFamily:
                            "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, sans-serif",
                          fontWeight: 800,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {word.text}
                      </text>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
