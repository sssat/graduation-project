// frontend/src/components/Auth/FindPassword/FindPWResultFail/FindPasswordResultFail.tsx
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import styles from "./FindPasswordResultFail.module.css";

type Props = {
  /** 카드 폭(px 또는 CSS 단위). 기본 420 */
  cardWidth?: number | string;
  /** 실패 메시지(기본: "조회 결과가 없습니다.") */
  message?: string;
  /** 버튼 라우트 커스터마이즈 */
  toSignup?: string;
  toFindPassword?: string;
};

type StyleWithCardVar = CSSProperties & {
  ["--card-width"]?: string;
};

export default function FindPasswordResultFail({
  cardWidth = 420,
  message = "조회 결과가 없습니다.",
  toSignup = "/auth/signup",
  toFindPassword = "/auth/find-password",
}: Props) {
  const vars: StyleWithCardVar = useMemo(
    () => ({
      ["--card-width"]: typeof cardWidth === "number" ? `${cardWidth}px` : String(cardWidth),
    }),
    [cardWidth]
  );

  return (
    <section className={styles.section} aria-label="비밀번호 찾기 실패">
      <div className={styles.wrap} style={vars}>
        <div className={styles.card}>
          <h1 className={styles.title}>입력하신 정보를 확인해 주세요</h1>

          <p className={styles.message} aria-live="polite">
            {message}
          </p>

          <div className={styles.actions}>
            <Link to={toSignup} className={`${styles.btn} ${styles.secondary}`}>
              회원가입
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
