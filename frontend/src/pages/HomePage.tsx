// frontend/src/pages/HomePage.tsx
import { Link } from "react-router-dom";
import styles from "./HomePage.module.css";
import { getTopKeywords, type TopKeywordItem } from "../mocks/keywordMockData";

export default function HomePage() {
  const collectedNewsCount = 12300;
  const keywordCount = 10;

  const topKeywords: TopKeywordItem[] = getTopKeywords();
  const left = topKeywords.slice(0, 5);
  const right = topKeywords.slice(5, 10);

  const now = new Date();

  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

  const dateText = `${year}년 ${month} ${day}일 (${weekday})`;

  const updatedAtText = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(now)
    .replace(/\./g, "-")
    .replace(/\s/g, " ")
    .replace(/- /g, "-")
    .replace(/: /g, ":");

  const renderItem = (item: TopKeywordItem) => (
    <Link
      key={item.rank}
      to={`/keywords/${encodeURIComponent(item.label)}`}
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

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="대시보드 소개">
        <div className={styles.heroInner}>
          <p className={styles.heroKicker}>실시간 뉴스 데이터 모니터링</p>

          <h1 className={styles.heroTitle}>
            실시간 뉴스, 감으로 보지 말고
            <br />
            <span className={styles.highlight}>데이터</span>로 한 번에 확인하기
          </h1>

          <p className={styles.heroSub}>
            오늘의 실시간 키워드와 개별 이슈량까지 한 화면에서 정리해서 보여주는 인사이트
            대시보드입니다.
          </p>

          <div className={styles.heroCards}>
            <article className={styles.heroCard}>
              <div className={styles.heroCardLabel}>오늘 수집된 뉴스</div>
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
                {keywordCount.toLocaleString("ko-KR")}
                <span className={styles.unit}>개</span>
              </div>
              <div className={styles.heroCardCaption}>
                오늘 수집된 뉴스에서 선정한 상위 키워드 10개에 대해 기사량·편향도·감성 분석을
                수행합니다.
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.statsSection} aria-label="오늘의 키워드 통계">
        <div className={styles.statsInner}>
          <div className={styles.statsDate}>{dateText}</div>

          <div className={styles.statsBoard}>
            <div className={styles.statsHeaderRow}>
              <div className={styles.statsTitle}>
                오늘의 상위 키워드 <span className={styles.statsTitleEm}>Top 10</span>
              </div>
              <div className={styles.statsPill}>단위: 기사 건수</div>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statsCol}>{left.map(renderItem)}</div>
              <div className={styles.statsCol}>{right.map(renderItem)}</div>
            </div>

            <div className={styles.statsFooterNote}>데이터 기준 시각: {updatedAtText} KST</div>
          </div>
        </div>
      </section>
    </div>
  );
}
