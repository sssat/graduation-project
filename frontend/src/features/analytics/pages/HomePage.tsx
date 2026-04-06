// frontend/src/pages/HomePage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./HomePage.module.css";
import {
  getAnalyticsOverview,
  type AnalyticsOverviewTopKeywordItem,
} from "../../../api/analytics";
import { getErrorMessage } from "../../../api/types";

type HomeTopKeywordItem = {
  rank: number;
  keywordSeq: number | null;
  label: string;
  count: number;
  isAnalyzable: boolean;
};

const TOP_KEYWORD_LIMIT = 10;
const TOP_KEYWORD_LEFT_COLUMN_COUNT = 5;

function parseDateOnly(value: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  };
}

function formatStoredBaseDate(value: string | null | undefined): string | null {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;

  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
  }).format(new Date(parsed.year, parsed.month - 1, parsed.day));

  return `${parsed.year}년 ${parsed.month}월 ${parsed.day}일 (${weekday})`;
}

function formatStoredStartedAt(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = /([zZ]|[+-]\d{2}:\d{2})$/.test(value)
    ? value
    : `${value.replace(" ", "T")}+09:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";

  if (!year || !month || !day || !hour || !minute) return null;

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function toPositiveIntOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function readKeywordSeqFromOverviewItem(item: AnalyticsOverviewTopKeywordItem): number | null {
  // 구버전 응답과의 호환을 위해 optional로 읽는다.
  const candidate = (item as AnalyticsOverviewTopKeywordItem & { keyword_seq?: unknown }).keyword_seq;
  return toPositiveIntOrNull(candidate);
}

function mapTopKeywordItem(
  item: AnalyticsOverviewTopKeywordItem,
): HomeTopKeywordItem {
  const seqFromOverview = readKeywordSeqFromOverviewItem(item);

  return {
    rank: item.rank_no,
    keywordSeq: seqFromOverview,
    label: item.keyword,
    count: item.article_count,
    isAnalyzable: item.is_analyzable,
  };
}

function showNotAnalyzableAlert(count: number): void {
  window.alert(
    `해당 키워드는 기사 수가 ${count.toLocaleString(
      "ko-KR",
    )}건으로 10건 미만이라 분석 결과를 제공하지 않습니다.`,
  );
}

function showMissingKeywordSeqAlert(keyword: string): void {
  window.alert(
    `'${keyword}' 키워드의 상세 분석 링크 정보(keyword_seq)를 찾지 못했습니다.\n\n` +
      "백엔드 overview 응답 또는 프론트 매핑을 확인해주세요.",
  );
}

export default function HomePage() {
  const [collectedNewsCount, setCollectedNewsCount] = useState<number>(0);
  const [topKeywords, setTopKeywords] = useState<HomeTopKeywordItem[]>([]);
  const [dataBaseDate, setDataBaseDate] = useState<string | null>(null);
  const [dataStartedAt, setDataStartedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOverview = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const overviewData = await getAnalyticsOverview();

        if (cancelled) return;

        const mapped = overviewData.top_keywords
          .slice(0, TOP_KEYWORD_LIMIT)
          .map(mapTopKeywordItem);

        setCollectedNewsCount(overviewData.collected_article_count);
        setDataBaseDate(overviewData.data_base_date ?? null);
        setDataStartedAt(overviewData.data_started_at ?? null);
        setTopKeywords(mapped);
      } catch (error: unknown) {
        if (cancelled) return;

        setErrorMessage(getErrorMessage(error, "홈 화면 데이터를 불러오지 못했습니다."));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  const left = useMemo(
    () => topKeywords.slice(0, TOP_KEYWORD_LEFT_COLUMN_COUNT),
    [topKeywords],
  );
  const right = useMemo(
    () => topKeywords.slice(TOP_KEYWORD_LEFT_COLUMN_COUNT, TOP_KEYWORD_LIMIT),
    [topKeywords],
  );

  const dateText = formatStoredBaseDate(dataBaseDate) ?? "데이터 준비 중";
  const updatedAtText = formatStoredStartedAt(dataStartedAt) ?? "-";

  const renderItem = (item: HomeTopKeywordItem) => {
    if (!item.isAnalyzable) {
      return (
        <button
          key={item.rank}
          type="button"
          className={styles.statItem}
          onClick={() => showNotAnalyzableAlert(item.count)}
          aria-label={`${item.label} 키워드: 데이터 부족으로 분석 제공 불가 안내 보기`}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            color: "inherit",
            font: "inherit",
          }}
        >
          <div className={styles.statLabel}>
            <span className={styles.statIndex}>{item.rank}</span>
            {item.label}
          </div>
          <div className={styles.statCount}>
            {item.count.toLocaleString("ko-KR")}
            <span className={styles.statUnit}>건</span>
          </div>
        </button>
      );
    }

    if (!item.keywordSeq) {
      return (
        <button
          key={item.rank}
          type="button"
          className={styles.statItem}
          onClick={() => showMissingKeywordSeqAlert(item.label)}
          aria-label={`${item.label} 키워드 상세 분석 링크 정보 없음 안내 보기`}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            color: "inherit",
            font: "inherit",
          }}
        >
          <div className={styles.statLabel}>
            <span className={styles.statIndex}>{item.rank}</span>
            {item.label}
          </div>
          <div className={styles.statCount}>
            {item.count.toLocaleString("ko-KR")}
            <span className={styles.statUnit}>건</span>
          </div>
        </button>
      );
    }

    return (
      <Link
        key={item.rank}
        // 기존 라우트 패턴(/keywords/:keyword)을 유지하면서 숫자 keyword_seq를 path param으로 전달
        // KeywordDetailPage.updated.v3.tsx는 route param 숫자를 keyword_seq로 인식 가능
        to={`/keywords/${item.keywordSeq}?keyword=${encodeURIComponent(item.label)}`}
        className={styles.statItem}
        aria-label={`${item.label} 키워드 상세 보기`}
      >
        <div className={styles.statLabel}>
          <span className={styles.statIndex}>{item.rank}</span>
          {item.label}
        </div>
        <div className={styles.statCount}>
          {item.count.toLocaleString("ko-KR")}
          <span className={styles.statUnit}>건</span>
        </div>
      </Link>
    );
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="대시보드 소개">
        <div className={styles.heroInner}>
          <p className={styles.heroKicker}>최신 뉴스 데이터 모니터링</p>

          <h1 className={styles.heroTitle}>
            오늘의 뉴스, 감으로 보지 말고
            <br />
            <span className={styles.highlight}>데이터</span>로 한 번에 확인하기
          </h1>

          <p className={styles.heroSub}>
            오늘 수집된 키워드와 개별 이슈량까지 한 화면에서 정리해서 보여주는 인사이트
            대시보드입니다.
          </p>

          <div className={styles.heroCards}>
            <article className={styles.heroCard}>
              <div className={styles.heroCardLabel}>최신 수집 뉴스</div>
              <div className={styles.heroCardCount}>
                {collectedNewsCount.toLocaleString("ko-KR")}
                <span className={styles.unit}>건</span>
              </div>
              <div className={styles.heroCardCaption}>
                하루마다 갱신되는 금일 수집 뉴스 건수입니다.
              </div>
            </article>

            <article className={`${styles.heroCard} ${styles.secondary}`}>
              <div className={styles.heroCardLabel}>분석 대상 키워드</div>
              <div className={styles.heroCardCount}>
                {TOP_KEYWORD_LIMIT.toLocaleString("ko-KR")}
                <span className={styles.unit}>개</span>
              </div>
              <div className={styles.heroCardCaption}>
                최신 상위 키워드 10개 기준으로 수집된 뉴스 데이터를 바탕으로 다양한 지표
                분석과 인사이트를 제공합니다.
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.statsSection} aria-label="최신 키워드 통계">
        <div className={styles.statsInner}>
          <div className={styles.statsDate}>{dateText}</div>

          <div className={styles.statsBoard}>
            <div className={styles.statsHeaderRow}>
              <div className={styles.statsTitle}>
                최신 상위 키워드 <span className={styles.statsTitleEm}>Top 10</span>
              </div>
              <div className={styles.statsPill}>단위: 기사 건수</div>
            </div>

            {isLoading && (
              <div style={{ padding: "12px 4px", fontSize: "14px" }} aria-live="polite">
                데이터를 불러오는 중...
              </div>
            )}

            {!isLoading && errorMessage && (
              <div
                role="alert"
                style={{ padding: "12px 4px", fontSize: "14px", color: "#b42318" }}
              >
                {errorMessage}
              </div>
            )}

            {!isLoading && !errorMessage && (
              <>
                <div className={styles.statsGrid}>
                  <div className={styles.statsCol}>{left.map(renderItem)}</div>
                  <div className={styles.statsCol}>{right.map(renderItem)}</div>
                </div>

                {topKeywords.length === 0 && (
                  <div style={{ padding: "12px 4px", fontSize: "14px" }}>
                    표시할 키워드 데이터가 없습니다.
                  </div>
                )}
              </>
            )}

            <div className={styles.statsFooterNote}>데이터 기준 시각: {updatedAtText} KST</div>
          </div>
        </div>
      </section>
    </div>
  );
}
