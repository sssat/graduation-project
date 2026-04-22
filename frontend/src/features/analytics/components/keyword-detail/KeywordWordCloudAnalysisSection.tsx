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

type CloudWordLayout = {
  key: string;
  words: CloudWord[];
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

const WORDCLOUD_MIN_FONT_SIZE = 24;
const WORDCLOUD_MAX_FONT_SIZE = 136;
const WORDCLOUD_DEFAULT_FONT_SIZE = 52;
const WORDCLOUD_EQUAL_WEIGHT_FONT_SIZE = 58;
const WORDCLOUD_SIZE_POWER = 1.75;
const WORDCLOUD_FONT_FAMILY =
  "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, sans-serif";
const WORDCLOUD_FONT_WEIGHT = 800;
const WORDCLOUD_MIN_PLACED_RATIO = 0.92;
const WORDCLOUD_SCALE_ATTEMPTS = [1, 0.92, 0.84, 0.76];

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
  const [wordLayout, setWordLayout] = useState<CloudWordLayout>({ key: "", words: [] });

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

  const layoutKey = useMemo(
    () =>
      JSON.stringify({
        seed,
        width,
        height,
        items: items.map((item) => [item.text, item.weight]),
      }),
    [height, items, seed, width],
  );

  const words = wordLayout.key === layoutKey ? wordLayout.words : [];

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
      return;
    }

    const finiteWeights = items
      .map((item) => item.weight)
      .filter((weight) => Number.isFinite(weight));
    const maxWeight = finiteWeights.length ? Math.max(...finiteWeights) : 0;
    const minWeight = finiteWeights.length ? Math.min(...finiteWeights) : 0;

    const toPixelSize = (weight: number) => {
      if (!Number.isFinite(weight)) return WORDCLOUD_DEFAULT_FONT_SIZE;
      if (maxWeight <= 0 && minWeight <= 0) return WORDCLOUD_DEFAULT_FONT_SIZE;
      if (maxWeight === minWeight) return WORDCLOUD_EQUAL_WEIGHT_FONT_SIZE;

      const ratio = (weight - minWeight) / (maxWeight - minWeight);
      const emphasizedRatio = Math.pow(clamp(ratio, 0, 1), WORDCLOUD_SIZE_POWER);
      return clamp(
        WORDCLOUD_MIN_FONT_SIZE +
          emphasizedRatio * (WORDCLOUD_MAX_FONT_SIZE - WORDCLOUD_MIN_FONT_SIZE),
        WORDCLOUD_MIN_FONT_SIZE,
        WORDCLOUD_MAX_FONT_SIZE,
      );
    };

    const layoutItems = [...items].sort(
      (left, right) =>
        (right.weight ?? 0) - (left.weight ?? 0) || left.text.localeCompare(right.text, "ko"),
    );
    let stopped = false;
    let activeLayout: ReturnType<typeof cloud<CloudWord>> | null = null;

    const runLayout = (attemptIndex: number) => {
      const scale = WORDCLOUD_SCALE_ATTEMPTS[attemptIndex] ?? WORDCLOUD_SCALE_ATTEMPTS.at(-1) ?? 1;
      const random = mulberry32(hashInt(`${seed}-${width}-${height}-${attemptIndex}`));

      activeLayout = cloud<CloudWord>()
        .size([width, height])
        .words(
          layoutItems.map((item) => ({
            text: item.text,
            size: clamp(
              toPixelSize(item.weight) * scale,
              WORDCLOUD_MIN_FONT_SIZE,
              WORDCLOUD_MAX_FONT_SIZE,
            ),
            x: 0,
            y: 0,
            rotate: 0,
          })),
        )
        .padding((word) => clamp((word.size ?? WORDCLOUD_DEFAULT_FONT_SIZE) * 0.1, 5, 14))
        .rotate(() => 0)
        .font(WORDCLOUD_FONT_FAMILY)
        .fontWeight(WORDCLOUD_FONT_WEIGHT)
        .fontSize((word) => word.size)
        .random(() => random())
        .spiral("archimedean")
        .on("end", (result) => {
          if (stopped) return;

          const normalized = (result as CloudWord[]).map((word) => ({
            ...word,
            rotate: 0,
            size: clamp(word.size, WORDCLOUD_MIN_FONT_SIZE, WORDCLOUD_MAX_FONT_SIZE),
          }));
          const placedRatio = normalized.length / Math.max(1, layoutItems.length);
          const canRetry = attemptIndex < WORDCLOUD_SCALE_ATTEMPTS.length - 1;

          if (placedRatio < WORDCLOUD_MIN_PLACED_RATIO && canRetry) {
            runLayout(attemptIndex + 1);
            return;
          }

          setWordLayout({ key: layoutKey, words: normalized });
        });

      activeLayout.start();
    };

    runLayout(0);

    return () => {
      stopped = true;
      activeLayout?.stop();
    };
  }, [height, items, layoutKey, seed, width]);

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
                          fontFamily: WORDCLOUD_FONT_FAMILY,
                          fontWeight: WORDCLOUD_FONT_WEIGHT,
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
