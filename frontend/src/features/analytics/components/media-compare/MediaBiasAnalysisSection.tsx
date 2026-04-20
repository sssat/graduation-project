import BiasAnalysisChart from "../shared/BiasAnalysisChart";
import styles from "./MediaBiasAnalysisSection.module.css";

type MediaBiasRow = {
  label: string;
  bias: number;
};

type MediaBiasAnalysisSectionProps = {
  biasRows: MediaBiasRow[];
  detailError: string | null;
};

export default function MediaBiasAnalysisSection({
  biasRows,
  detailError,
}: MediaBiasAnalysisSectionProps) {
  const points = biasRows.map((row) => ({
    label: row.label,
    score: row.bias,
  }));

  return (
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

      {points.length ? (
        <BiasAnalysisChart points={points} className={`${styles.chartWrapper} ${styles.biasChartWrapper}`} />
      ) : (
        <div className={styles.emptyBox}>표시할 편향도 데이터가 없습니다.</div>
      )}

      <div className={styles.biasCaption}>
        <strong>양수</strong>일수록 긍정적인 톤, <strong>음수</strong>일수록 비판적인 톤이 강한
        언론사입니다. 점수가 <strong>0에 가까운 경우</strong>에는 그래프상에서 눈에 잘 띄지
        않거나 거의 표시되지 않을 수 있습니다.
      </div>
      {detailError && <div className={styles.statusError}>{detailError}</div>}
    </article>
  );
}
