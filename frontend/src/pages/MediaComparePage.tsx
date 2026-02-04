// frontend/src/pages/MediaComparePage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Chart from "chart.js/auto";
import styles from "./MediaComparePage.module.css";

type Period = "7d" | "14d";

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

function formatDateYYYYMMDD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function readCssVar(varName: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function pickTopWords(mediaKey: string, keyword: string, rand: () => number) {
  const pools: Record<string, string[]> = {
    overall: ["종합", "분석", "쟁점", "논의", "현안", "대응", "확대", "전망", "검증"],
    yonhap: ["속보", "발표", "공식", "현안", "논의", "쟁점", "동향", "점검", "대응"],
    pressian: ["비판", "논평", "쟁점", "정책", "현장", "논란", "검증", "대응", "분석"],
    donga: ["단독", "취재", "파장", "대책", "혼선", "현안", "발언", "후속", "검증"],
    chosun: ["의사", "파업", "반발", "혼란", "쟁점", "논란", "현장", "확대", "갈등"],
    joongang: ["진통", "협상", "조정", "갈등", "분석", "쟁점", "속보", "대응", "논의"],
    hani: ["공공의료", "확대", "지역", "불균형", "현장", "권리", "책임", "논의", "쟁점"],
    kyunghyang: ["현장", "증언", "쟁점", "후속", "점검", "문제", "대응", "논란", "기준"],
    seoul: ["정책", "논의", "쟁점", "해명", "대책", "점검", "현안", "조정", "갈등"],
    hankookilbo: ["분석", "여론", "쟁점", "논의", "대응", "검증", "현안", "조사", "파장"],
  };

  const base = pools[mediaKey] ?? pools.overall;
  const uniq = new Set<string>();

  if (keyword.trim()) uniq.add(keyword.trim());

  while (uniq.size < 5) {
    const w = base[Math.floor(rand() * base.length)];
    uniq.add(w);
  }

  return Array.from(uniq).slice(0, 5);
}

/**
 * ✅ 기사수(volume)를 "랜덤/시드"가 아니라 "고정 매핑"으로 제공
 * - period별로 값이 다르게 나오도록 7d/14d를 따로 둠
 * - 키워드/언론사 조합별로 항상 동일한 기사수가 나오게 됨
 *
 * 필요하면 이 테이블만 백엔드 응답으로 교체하면 됨.
 */
const FIXED_VOLUMES: Record<Period, Record<string, Record<string, number>>> = {
  "7d": {
    쿠팡: {
      yonhap: 42,
      pressian: 18,
      donga: 31,
      chosun: 28,
      joongang: 26,
      hani: 17,
      kyunghyang: 15,
      seoul: 19,
      hankookilbo: 21,
    },
    문재인: {
      yonhap: 22,
      pressian: 14,
      donga: 16,
      chosun: 15,
      joongang: 13,
      hani: 12,
      kyunghyang: 11,
      seoul: 10,
      hankookilbo: 12,
    },
    윤석열: {
      yonhap: 38,
      pressian: 20,
      donga: 24,
      chosun: 26,
      joongang: 22,
      hani: 19,
      kyunghyang: 18,
      seoul: 17,
      hankookilbo: 20,
    },
    데이터: {
      yonhap: 16,
      pressian: 10,
      donga: 11,
      chosun: 12,
      joongang: 10,
      hani: 9,
      kyunghyang: 8,
      seoul: 9,
      hankookilbo: 10,
    },
    "개인정보 유출": {
      yonhap: 27,
      pressian: 12,
      donga: 18,
      chosun: 16,
      joongang: 15,
      hani: 11,
      kyunghyang: 10,
      seoul: 12,
      hankookilbo: 13,
    },
    삼성: {
      yonhap: 33,
      pressian: 12,
      donga: 22,
      chosun: 21,
      joongang: 19,
      hani: 10,
      kyunghyang: 9,
      seoul: 12,
      hankookilbo: 14,
    },
    금리: {
      yonhap: 25,
      pressian: 10,
      donga: 14,
      chosun: 13,
      joongang: 15,
      hani: 9,
      kyunghyang: 8,
      seoul: 11,
      hankookilbo: 12,
    },
    부동산: {
      yonhap: 29,
      pressian: 11,
      donga: 16,
      chosun: 17,
      joongang: 15,
      hani: 10,
      kyunghyang: 9,
      seoul: 12,
      hankookilbo: 13,
    },
    AI: {
      yonhap: 20,
      pressian: 9,
      donga: 12,
      chosun: 11,
      joongang: 10,
      hani: 8,
      kyunghyang: 7,
      seoul: 9,
      hankookilbo: 10,
    },
    전기차: {
      yonhap: 1,
      pressian: 1,
      donga: 1,
      chosun: 2,
      joongang: 0,
      hani: 0,
      kyunghyang: 0,
      seoul: 1,
      hankookilbo: 1,
    },
  },
  "14d": {
    쿠팡: {
      yonhap: 71,
      pressian: 30,
      donga: 52,
      chosun: 47,
      joongang: 44,
      hani: 28,
      kyunghyang: 25,
      seoul: 31,
      hankookilbo: 35,
    },
    문재인: {
      yonhap: 36,
      pressian: 22,
      donga: 24,
      chosun: 23,
      joongang: 20,
      hani: 19,
      kyunghyang: 17,
      seoul: 16,
      hankookilbo: 18,
    },
    윤석열: {
      yonhap: 64,
      pressian: 34,
      donga: 41,
      chosun: 44,
      joongang: 38,
      hani: 33,
      kyunghyang: 30,
      seoul: 29,
      hankookilbo: 33,
    },
    데이터: {
      yonhap: 24,
      pressian: 15,
      donga: 17,
      chosun: 18,
      joongang: 15,
      hani: 13,
      kyunghyang: 12,
      seoul: 13,
      hankookilbo: 14,
    },
    "개인정보 유출": {
      yonhap: 45,
      pressian: 20,
      donga: 29,
      chosun: 27,
      joongang: 25,
      hani: 18,
      kyunghyang: 16,
      seoul: 19,
      hankookilbo: 21,
    },
    삼성: {
      yonhap: 55,
      pressian: 20,
      donga: 35,
      chosun: 34,
      joongang: 31,
      hani: 17,
      kyunghyang: 15,
      seoul: 19,
      hankookilbo: 22,
    },
    금리: {
      yonhap: 40,
      pressian: 16,
      donga: 23,
      chosun: 21,
      joongang: 24,
      hani: 14,
      kyunghyang: 12,
      seoul: 16,
      hankookilbo: 18,
    },
    부동산: {
      yonhap: 47,
      pressian: 18,
      donga: 25,
      chosun: 27,
      joongang: 24,
      hani: 16,
      kyunghyang: 14,
      seoul: 18,
      hankookilbo: 20,
    },
    AI: {
      yonhap: 32,
      pressian: 13,
      donga: 19,
      chosun: 18,
      joongang: 16,
      hani: 12,
      kyunghyang: 11,
      seoul: 13,
      hankookilbo: 15,
    },
    전기차: {
      yonhap: 29,
      pressian: 12,
      donga: 17,
      chosun: 16,
      joongang: 14,
      hani: 11,
      kyunghyang: 10,
      seoul: 12,
      hankookilbo: 13,
    },
  },
};

function getFixedVolume(keyword: string, period: Period, mediaKey: string) {
  const byPeriod = FIXED_VOLUMES[period];
  const byKeyword = byPeriod?.[keyword];
  const v = byKeyword?.[mediaKey];
  // 테이블에 없으면 0으로(= 기사 수 부족/비표시 정책에 걸릴 수 있음)
  return typeof v === "number" ? v : 0;
}

function buildMockRows(keyword: string, period: Period): MediaRow[] {
  const medias: { key: string; label: string }[] = [
    { key: "yonhap", label: "연합뉴스" },
    { key: "pressian", label: "프레시안" },
    { key: "donga", label: "동아일보" },
    { key: "chosun", label: "조선일보" },
    { key: "joongang", label: "중앙일보" },
    { key: "hani", label: "한겨레" },
    { key: "kyunghyang", label: "경향신문" },
    { key: "seoul", label: "서울신문" },
    { key: "hankookilbo", label: "한국일보" },
  ];

  // ✅ volume은 고정값, 나머지(편향/감성/대표단어)는 기존처럼 시드 기반으로 유지
  // (원하면 이것들도 고정 테이블로 바꿀 수 있음)
  const seed = hashInt(`${keyword}-${period}-media-compare`);
  const rand = mulberry32(seed);

  return medias.map((m) => {
    const volume = getFixedVolume(keyword, period, m.key);

    const bias = clamp(Math.round((rand() * 12 - 6) * 10) / 10, -6, 6);

    const p = Math.floor(15 + rand() * 30);
    const n = Math.floor(20 + rand() * 25);
    let neg = 100 - (p + n);

    if (neg < 10) neg = 10;
    if (neg > 70) neg = 70;

    const neutral = clamp(100 - (p + neg), 10, 60);
    const positive = clamp(p, 5, 70);
    const negative = clamp(neg, 5, 80);

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

function buildOverallRow(rows: MediaRow[], keyword: string, period: Period): MediaRow | null {
  if (rows.length === 0) return null;

  const totalVol = rows.reduce((acc, r) => acc + r.volume, 0);
  if (totalVol <= 0) return null;

  const biasWeighted = rows.reduce((acc, r) => acc + r.bias * r.volume, 0) / Math.max(1, totalVol);
  const bias = clamp(Math.round(biasWeighted * 10) / 10, -6, 6);

  const posW = rows.reduce((acc, r) => acc + r.sentiment.positive * r.volume, 0) / totalVol;
  const neuW = rows.reduce((acc, r) => acc + r.sentiment.neutral * r.volume, 0) / totalVol;
  const negW = rows.reduce((acc, r) => acc + r.sentiment.negative * r.volume, 0) / totalVol;

  const positive = clamp(Math.round(posW), 0, 100);
  const negative = clamp(Math.round(negW), 0, 100);
  let neutral = clamp(Math.round(neuW), 0, 100);

  const sum = positive + neutral + negative;
  const fix = 100 - sum;
  neutral = clamp(neutral + fix, 0, 100);

  const wordRand = mulberry32(hashInt(`${keyword}-${period}-overall-words`));
  const topWords = pickTopWords("overall", keyword, wordRand);

  return {
    key: "overall",
    label: "전체",
    volume: totalVol,
    bias,
    sentiment: { positive, neutral, negative },
    topWords,
  };
}

export default function MediaComparePage() {
  const [period, setPeriod] = useState<Period>("7d");

  // 키워드 후보(원본). 여기서 "기간별 기사 수"로 정렬/필터링해서 화면에 뿌린다.
  const ALL_KEYWORDS = useMemo(
    () => ["쿠팡", "문재인", "윤석열", "데이터", "개인정보 유출", "삼성", "금리", "부동산", "AI", "전기차"],
    []
  );

  // period 기준으로 키워드별 총 기사 수(=9개 언론사 volume 합)를 계산
  // - 기사 수 10 미만은 아예 숨김
  // - 기사 수 내림차순으로 칩 배치
  const keywordStats = useMemo(() => {
    const stats = ALL_KEYWORDS.map((k) => {
      const r = buildMockRows(k, period);
      const totalArticles = r.reduce((acc, row) => acc + row.volume, 0);
      return { keyword: k, totalArticles };
    })
      .filter((x) => x.totalArticles >= 10)
      .sort((a, b) => b.totalArticles - a.totalArticles);

    return stats;
  }, [ALL_KEYWORDS, period]);

  const visibleKeywords = useMemo(() => keywordStats.map((x) => x.keyword), [keywordStats]);

  // 사용자가 마지막으로 클릭한 "의도" 키워드
  const [keyword, setKeyword] = useState<string>(() => ALL_KEYWORDS[0] ?? "");

  // 실제로 화면/분석에 쓰는 키워드(목록에서 사라지면 자동으로 1등 키워드로 대체)
  // useEffect에서 setState로 맞추지 않고, 파생값으로 처리해서 React 경고를 제거한다.
  const selectedKeyword = useMemo(() => {
    if (visibleKeywords.length === 0) return "";
    if (visibleKeywords.includes(keyword)) return keyword;
    return visibleKeywords[0];
  }, [visibleKeywords, keyword]);

  const rows = useMemo(() => {
    if (!selectedKeyword) return [];
    return buildMockRows(selectedKeyword, period);
  }, [selectedKeyword, period]);

  const overallRow = useMemo(
    () => (selectedKeyword ? buildOverallRow(rows, selectedKeyword, period) : null),
    [rows, selectedKeyword, period]
  );

  const biasRows = useMemo(() => (overallRow ? [overallRow, ...rows] : rows), [overallRow, rows]);
  const sentimentRows = useMemo(() => (overallRow ? [overallRow, ...rows] : rows), [overallRow, rows]);

  const summary = useMemo(() => {
    const mediaCount = rows.length; // 9개(키워드가 있으면)
    const totalArticles = rows.reduce((acc, r) => acc + r.volume, 0);

    const sortedByVol = [...rows].sort((a, b) => b.volume - a.volume);
    const topVol = sortedByVol.slice(0, 2).map((r) => r.label).join("·");

    const sortedByAbsBias = [...rows].sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));
    const mostBiased = sortedByAbsBias[0]?.label ?? "-";

    return {
      mediaCount,
      totalArticles,
      topVol: topVol || "-",
      mostBiased,
    };
  }, [rows]);

  const metaRangeLabel = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);

    const daysBack = period === "7d" ? 6 : 13;
    const start = new Date(end);
    start.setDate(start.getDate() - daysBack);

    return `${formatDateYYYYMMDD(start)} ~ ${formatDateYYYYMMDD(end)}`;
  }, [period]);

  const volumeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const biasCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sentimentCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 기사량 차트 (언론사 9개만)
  useEffect(() => {
    if (!volumeCanvasRef.current) return;
    const ctx = volumeCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = rows.map((r) => r.label);
    const data = rows.map((r) => r.volume);

    const blue = readCssVar("--ns-accent-blue", "#38bdf8");

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "기사량(건)",
            data,
            backgroundColor: blue,
            borderWidth: 0,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 11 } } },
          y: { grid: { color: "rgba(55,65,81,0.5)" }, ticks: { color: "#9ca3af", font: { size: 11 } } },
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

  // 편향도 차트 (맨 왼쪽 "전체" 포함)
  useEffect(() => {
    if (!biasCanvasRef.current) return;
    const ctx = biasCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = biasRows.map((r) => r.label);
    const data = biasRows.map((r) => r.bias);

    const posColor = readCssVar("--ns-bias-pos", "#38bdf8");
    const negColor = readCssVar("--ns-bias-neg", "#f97316");

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
              return raw >= 0 ? posColor : negColor;
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 11 } } },
          y: { grid: { color: "rgba(55,65,81,0.5)" }, ticks: { color: "#9ca3af", font: { size: 11 } } },
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
  }, [biasRows]);

  // 감성(스택) 차트 (맨 왼쪽 "전체" 포함)
  useEffect(() => {
    if (!sentimentCanvasRef.current) return;
    const ctx = sentimentCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = sentimentRows.map((r) => r.label);
    const positive = sentimentRows.map((r) => r.sentiment.positive);
    const neutral = sentimentRows.map((r) => r.sentiment.neutral);
    const negative = sentimentRows.map((r) => r.sentiment.negative);

    const sentPos = readCssVar("--ns-sent-pos", "#22c55e");
    const sentNeu = readCssVar("--ns-sent-neu", "#e5e7eb");
    const sentNeg = readCssVar("--ns-sent-neg", "#ef4444");

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "긍정", data: positive, backgroundColor: sentPos, borderWidth: 0 },
          { label: "중립", data: neutral, backgroundColor: sentNeu, borderWidth: 0 },
          { label: "부정", data: negative, backgroundColor: sentNeg, borderWidth: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 11 } } },
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
          legend: { labels: { color: "#e5e7eb", font: { size: 11 } } },
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
  }, [sentimentRows]);

  const rangeLabel = period === "7d" ? "최근 7일" : "최근 14일";

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
              분석 기간: {metaRangeLabel} · 기사 수: {summary.totalArticles}건 · 분석 언론사: {summary.mediaCount}개
            </p>
          </div>
        </div>

        <div className={styles.keywordFilterRow}>
          <div className={styles.keywordChipGroup} aria-label="TOP 키워드 선택">
            {visibleKeywords.map((k) => (
              <button
                key={k}
                type="button"
                className={`${styles.keywordChip} ${selectedKeyword === k ? styles.keywordChipActive : ""}`}
                onClick={() => setKeyword(k)}
              >
                {k}
              </button>
            ))}
          </div>

          <div className={styles.periodFilterInline}>
            <div className={styles.filterLabel}>기간</div>
            <div className={styles.filterChipGroup} role="tablist" aria-label="분석 기간 선택">
              <button
                type="button"
                className={`${styles.filterChip} ${period === "7d" ? styles.active : ""}`}
                onClick={() => setPeriod("7d")}
                role="tab"
                aria-selected={period === "7d"}
              >
                최근 7일
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${period === "14d" ? styles.active : ""}`}
                onClick={() => setPeriod("14d")}
                role="tab"
                aria-selected={period === "14d"}
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
              <div className={styles.cardTitle}>오늘의 키워드 분석 요약</div>
              <div className={styles.cardSub}>수집된 기사 내용을 바탕으로 생성한 AI 요약입니다.</div>
            </div>
            <span className={styles.badgeSoft}>요약 리포트</span>
          </div>

          <div className={styles.summaryText}>
            {selectedKeyword ? (
              <>
                {rangeLabel} 기준 {summary.mediaCount}개 언론사가 키워드 {selectedKeyword}을(를) 다룬 기사량은 총{" "}
                {summary.totalArticles}건입니다. 기사량 상위 언론사는 {summary.topVol}이며, 편향도 절댓값 기준으로
                변동 폭이 큰 언론사는 {summary.mostBiased}입니다.
              </>
            ) : (
              <>
                {rangeLabel} 기준으로 기사 수 10건 이상인 키워드가 없어 목록에 표시할 키워드가 없습니다.
              </>
            )}
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
            막대가 길수록 {rangeLabel} 선택 키워드에 대해 더 많은 기사를 보도한 언론사입니다.
          </div>
        </article>

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
      </section>

      <section className={styles.grid2}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>언론사별 감성 비율 비교</div>
              <div className={styles.cardSub}>
                선택 키워드 기사 본문을 기반으로 긍정/중립/부정 비율을 비교한 결과입니다.
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
