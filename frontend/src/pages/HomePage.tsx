// frontend/src/pages/HomePage.tsx
import styles from "./HomePage.module.css";

type KeywordItem = {
  rank: number;
  label: string;
  count: number;
};

export default function HomePage() {
  const collectedNewsCount = 12300;
  const keywordCount = 10;

  const topKeywords: KeywordItem[] = [
    { rank: 1, label: "쿠팡", count: 104 },
    { rank: 2, label: "문재인", count: 94 },
    { rank: 3, label: "윤석열", count: 87 },
    { rank: 4, label: "데이터", count: 65 },
    { rank: 5, label: "개인정보 유출", count: 54 },
    { rank: 6, label: "경제", count: 47 },
    { rank: 7, label: "부동산", count: 41 },
    { rank: 8, label: "증시", count: 35 },
    { rank: 9, label: "AI", count: 28 },
    { rank: 10, label: "환율", count: 12 },
  ];

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
            오늘의 실시간 키워드와 개별 이슈량까지 한 화면에서 정리해서 보여주는
            인사이트 대시보드입니다.
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
                오늘 수집된 뉴스에서 선정한 상위 키워드 10개에 대해 기사량·편향도·감성
                분석을 수행합니다.
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
              <div className={styles.statsCol}>
                {left.map((item) => (
                  <div key={item.rank} className={styles.statItem}>
                    <div className={styles.statLabel}>
                      <span className={styles.statIndex}>{item.rank}</span>
                      {item.label}
                    </div>
                    <div className={styles.statCount}>
                      {item.count.toLocaleString("ko-KR")}
                      <span className={styles.statUnit}>건</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.statsCol}>
                {right.map((item) => (
                  <div key={item.rank} className={styles.statItem}>
                    <div className={styles.statLabel}>
                      <span className={styles.statIndex}>{item.rank}</span>
                      {item.label}
                    </div>
                    <div className={styles.statCount}>
                      {item.count.toLocaleString("ko-KR")}
                      <span className={styles.statUnit}>건</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.statsFooterNote}>
              데이터 기준 시각: {updatedAtText} KST
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
