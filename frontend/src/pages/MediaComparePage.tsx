// frontend/src/pages/MediaComparePage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Chart from "chart.js/auto";
import styles from "./MediaComparePage.module.css";

type Period = "today" | "7d";

type MediaRow = {
  key: string;
  label: string;
  volume: number;
  bias: number; // 음수=비판, 양수=긍정
  sentiment: { positive: number; neutral: number; negative: number }; // 합 100
  topWords: string[];
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pickTopWords(mediaKey: string, keyword: string, rand: () => number) {
  // "상위 단어 카운팅" 느낌의 목업(감성/긍부정 강조 없음)
  const pools: Record<string, string[]> = {
    chosun: ["의사", "파업", "반발", "혼란", "쟁점", "논란", "현장", "확대", "갈등"],
    joongang: ["진통", "협상", "조정", "갈등", "분석", "쟁점", "속보", "대응", "논의"],
    donga: ["단독", "취재", "파장", "대책", "혼선", "현안", "발언", "후속", "검증"],
    hani: ["공공의료", "확대", "지역", "불균형", "현장", "권리", "책임", "논의", "쟁점"],
    kyunghyang: ["현장", "증언", "쟁점", "후속", "점검", "문제", "대응", "논란", "기준"],
    hankyung: ["투자", "성장", "실적", "시장", "전망", "전략", "기업", "지표", "확대"],
    maeil: ["플랫폼", "혁신", "경쟁", "독점", "시장", "규제", "전략", "수요", "확대"],
    kbs: ["정책", "갈등", "협의", "조정", "대책", "논의", "브리핑", "현안", "점검"],
    mbc: ["노동", "안전", "논란", "현장", "취재", "확인", "점검", "대응", "사고"],
    sbs: ["사건", "단독", "취재", "폭로", "후속", "단서", "쟁점", "논란", "현장"],
    jtbc: ["심층", "분석", "AI", "쟁점", "현안", "점검", "논란", "검증", "후속"],
    ytn: ["속보", "브리핑", "현안", "쟁점", "분석", "논의", "점검", "대응", "후속"],
    yonhap: ["속보", "발표", "공식", "현안", "논의", "쟁점", "동향", "점검", "대응"],
  };

  const base = pools[mediaKey] ?? pools.jtbc;
  const uniq = new Set<string>();

  // 키워드도 상위 단어에 섞이도록(하지만 강조/색상 차이 없음)
  if (keyword.trim()) uniq.add(keyword.trim());

  while (uniq.size < 5) {
    const w = base[Math.floor(rand() * base.length)];
    uniq.add(w);
  }

  return Array.from(uniq).slice(0, 5);
}

function buildMockRows(keyword: string, period: Period): MediaRow[] {
  const medias: { key: string; label: string }[] = [
    { key: "chosun", label: "조선일보" },
    { key: "joongang", label: "중앙일보" },
    { key: "donga", label: "동아일보" },
    { key: "hani", label: "한겨레" },
    { key: "kyunghyang", label: "경향신문" },
    { key: "hankyung", label: "한국경제" },
    { key: "maeil", label: "매일경제" },
    { key: "kbs", label: "KBS" },
    { key: "mbc", label: "MBC" },
    { key: "sbs", label: "SBS" },
    // 필요하면 아래도 쉽게 추가 가능
    // { key: "jtbc", label: "JTBC" },
    // { key: "ytn", label: "YTN" },
    // { key: "yonhap", label: "연합뉴스" },
  ];

  const seed = hashInt(`${keyword}-${period}-media-compare`);
  const rand = mulberry32(seed);

  const periodScale = period === "today" ? 1 : 1.6;

  return medias.map((m) => {
    // 기사량(건)
    const baseVol = 50 + Math.floor(rand() * 80); // 50~129
    const volume = Math.floor(baseVol * periodScale);

    // 편향도(-6~+6)
    const bias = clamp(Math.round((rand() * 12 - 6) * 10) / 10, -6, 6);

    // 감성(합 100)
    const p = Math.floor(15 + rand() * 30); // 15~44
    const n = Math.floor(20 + rand() * 25); // 20~44
    let neg = 100 - (p + n);
    // 너무 튀면 보정
    if (neg < 10) neg = 10;
    if (neg > 70) neg = 70;
    const neutral = clamp(100 - (p + neg), 10, 60);
    const positive = clamp(p, 5, 70);
    const negative = clamp(neg, 5, 80);

    // 합을 정확히 100으로 맞추기
    const sum = positive + neutral + negative;
    const fix = 100 - sum;
    const fixedNeutral = clamp(neutral + fix, 0, 100);

    const wordRand = mulberry32(hashInt(`${keyword}-${period}-${m.key}-words`));
    const topWords = pickTopWords(m.key, keyword, wordRand);

    return {
      key: m.key,
      label: m.label,
      volume,
      bias,
      sentiment: { positive, neutral: fixedNeutral, negative },
      topWords,
    };
  });
}

export default function MediaComparePage() {
  const [period, setPeriod] = useState<Period>("today");

  const TOP_KEYWORDS = useMemo(
    () => ["쿠팡", "문재인", "윤석열", "데이터", "개인정보 유출", "삼성", "금리", "부동산", "AI", "전기차"],
    []
  );
  const [keyword, setKeyword] = useState<string>(TOP_KEYWORDS[0]);

  const rows = useMemo(() => buildMockRows(keyword, period), [keyword, period]);

  const summary = useMemo(() => {
    const mediaCount = rows.length;
    const totalArticles = rows.reduce((acc, r) => acc + r.volume, 0);

    const sortedByVol = [...rows].sort((a, b) => b.volume - a.volume);
    const topVol = sortedByVol.slice(0, 2).map((r) => r.label).join("·");

    const sortedByAbsBias = [...rows].sort(
      (a, b) => Math.abs(b.bias) - Math.abs(a.bias)
    );
    const mostBiased = sortedByAbsBias[0]?.label ?? "-";

    return {
      mediaCount,
      totalArticles,
      topVol,
      mostBiased,
    };
  }, [rows]);

  const volumeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const biasCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sentimentCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 기사량 차트
  useEffect(() => {
    if (!volumeCanvasRef.current) return;
    const ctx = volumeCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = rows.map((r) => r.label);
    const data = rows.map((r) => r.volume);

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "기사량(건)",
            data,
            backgroundColor: "#38bdf8",
            borderWidth: 0,
            borderRadius: 6,
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
                return `${context.label}: ${context.parsed.y}건`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [rows]);

  // 편향도 차트
  useEffect(() => {
    if (!biasCanvasRef.current) return;
    const ctx = biasCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = rows.map((r) => r.label);
    const data = rows.map((r) => r.bias);

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
  }, [rows]);

  // 감성(스택) 차트
  useEffect(() => {
    if (!sentimentCanvasRef.current) return;
    const ctx = sentimentCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = rows.map((r) => r.label);
    const positive = rows.map((r) => r.sentiment.positive);
    const neutral = rows.map((r) => r.sentiment.neutral);
    const negative = rows.map((r) => r.sentiment.negative);

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "긍정", data: positive, backgroundColor: "#22c55e", borderWidth: 0 },
          { label: "중립", data: neutral, backgroundColor: "#e5e7eb", borderWidth: 0 },
          { label: "부정", data: negative, backgroundColor: "#ef4444", borderWidth: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: "#9ca3af", font: { size: 11 } },
          },
          y: {
            stacked: true,
            grid: { color: "rgba(55,65,81,0.5)" },
            ticks: {
              color: "#9ca3af",
              font: { size: 11 },
              callback(value) {
                return `${value}%`;
              },
            },
          },
        },
        plugins: {
          legend: {
            labels: { color: "#e5e7eb", font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${context.parsed.y}%`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [rows]);

  const rangeLabel = period === "today" ? "오늘" : "최근 7일";

  return (
    <main className={styles.pageRoot}>
      <section className={styles.compareHeader}>
        <div className={styles.breadcrumb}>
          <Link to="/">메인</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>언론사 키워드 비교</span>
        </div>

        <div className={styles.compareTitleRow}>
          <div className={styles.compareTitleBlock}>
            <h1 className={styles.compareMainTitle}>언론사별 키워드 보도 비교 대시보드</h1>
            <p className={styles.compareSub}>
              선택한 키워드를 기준으로 주요 언론사의 기사량·편향도·감성·대표 단어 차이를 한 화면에서 비교합니다.
            </p>
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
          </div>
        </div>

        <div className={styles.keywordFilterRow}>
          <div className={styles.keywordChipGroup} aria-label="TOP 키워드 선택">
            {TOP_KEYWORDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`${styles.keywordChip} ${keyword === k ? styles.keywordChipActive : ""}`}
                onClick={() => setKeyword(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.grid1}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>선택 키워드 언론사 비교 요약</div>
              <div className={styles.cardSub}>
                수집된 데이터와 다양한 분석 지표를 종합해 생성된 ai 요약입니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>요약 리포트</span>
          </div>

          <div className={styles.summaryText}>
            {rangeLabel} 기준 {summary.mediaCount}개 언론사가 키워드 {keyword}을(를) 다룬 기사량은 총{" "}
            {summary.totalArticles}건입니다. 기사량 상위 언론사는 {summary.topVol}이며, 편향도 절댓값 기준으로 변동 폭이
            큰 언론사는 {summary.mostBiased}입니다.
          </div>
        </article>
      </section>

      <section className={styles.grid2}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>언론사별 기사량 TOP</div>
              <div className={styles.cardSub}>
                선택한 키워드에 대해 {rangeLabel} 기준 수집된 기사 건수를 언론사별로 정렬한 결과입니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>기사량 지표</span>
          </div>

          <div className={styles.chartWrapper}>
            <canvas ref={volumeCanvasRef} />
          </div>

          <div className={styles.biasCaption}>
            막대가 길수록 {rangeLabel} 선택 키워드에 대해 더 많은 기사를 송고한 언론사입니다.
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>언론사별 편향도 지수</div>
              <div className={styles.cardSub}>
                선택 키워드 기사들의 제목 톤을 기반으로 산출한 편향도 지수입니다 (0에 가까울수록 중립).
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
      </section>

      <section className={styles.grid2}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>언론사별 감성 비율 비교</div>
              <div className={styles.cardSub}>
                선택 키워드 기사 제목을 기반으로 긍정/중립/부정 비율을 비교한 결과입니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>감성 분석</span>
          </div>

          <div className={styles.chartWrapperTall}>
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

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>언론사별 대표 단어 비교</div>
              <div className={styles.cardSub}>
                선택한 키워드 기사에서 각 언론사별로 상위 5개 단어를 뽑아 어떤 관점으로 보도하는지 비교합니다.
              </div>
            </div>
            <span className={styles.badgeSoft}>텍스트 프레이밍</span>
          </div>

          <div className={styles.framingList}>
            {rows.map((r) => (
              <div key={r.key} className={styles.framingItem}>
                <div className={styles.framingMedia}>{r.label}</div>

                <div className={styles.framingKeywords} aria-label={`${r.label} 대표 단어`}>
                  {r.topWords.map((w, i) => (
                    // 강조(alt) 완전 제거: 전부 동일 색상/스타일
                    <span key={`${r.key}-${w}-${i}`} className={styles.keywordTagNeutral}>
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
