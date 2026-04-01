// frontend/src/components/Auth/FindID/FindIDResultSuccess/FindIdResultSuccess.tsx
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import styles from "./FindIdResultSuccess.module.css";

type Props = {
  /** 카드 폭(px 또는 CSS 단위). 기본 420 */
  cardWidth?: number | string;
  /** 표시할 사용자 아이디 */
  userId: string;
  /** 버튼 라우트 커스터마이즈 */
  toLogin?: string;
  toFindPassword?: string;
};

type StyleWithCardVar = CSSProperties & {
  ["--card-width"]?: string;
};

export default function FindIdResultSuccess({
  cardWidth = 420,
  userId,
  toLogin = "/auth/login",
  toFindPassword = "/auth/find-password",
}: Props) {
  const vars: StyleWithCardVar = useMemo(
    () => ({
      ["--card-width"]: typeof cardWidth === "number" ? `${cardWidth}px` : String(cardWidth),
    }),
    [cardWidth]
  );

  return (
    <section className={styles.section} aria-label="아이디 찾기 성공">
      <div className={styles.wrap} style={vars}>
        <div className={styles.card}>
          <h1 className={styles.title}>회원님의 아이디를 확인해 주세요</h1>

          <div className={styles.resultBox} aria-live="polite">
            <span className={styles.resultId}>{userId || "-"}</span>
          </div>

          <div className={styles.actions}>
            <Link to={toLogin} className={`${styles.btn} ${styles.secondary}`}>
              로그인
            </Link>
            <Link to={toFindPassword} className={`${styles.btn} ${styles.primary}`}>
              비밀번호 찾기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
