// frontend/src/components/Auth/FindPassword/FindPWResultSuccess/FindPasswordResultSuccess.tsx
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import styles from "./FindPasswordResultSuccess.module.css";

type Props = {
  /** 카드 폭(px 또는 CSS 단위). 기본 420 */
  cardWidth?: number | string;

  /** 임시 비밀번호 (개발/디버그 모드에서만 전달될 수도 있음) */
  password?: string;

  /** 버튼 라우트 */
  toLogin?: string;
  toChangePassword?: string; // 유지(호환성), 사용은 안 함
};

type StyleWithCardVar = CSSProperties & {
  ["--card-width"]?: string;
};

export default function FindPasswordResultSuccess({
  cardWidth = 420,
  password,
  toLogin = "/auth/login",
}: Props) {
  const vars: StyleWithCardVar = useMemo(
    () => ({
      ["--card-width"]:
        typeof cardWidth === "number" ? `${cardWidth}px` : String(cardWidth),
    }),
    [cardWidth]
  );

  const hasPassword = typeof password === "string" && password.trim().length > 0;

  return (
    <section className={styles.section} aria-label="비밀번호 찾기 성공">
      <div className={styles.wrap} style={vars}>
        <div className={styles.card}>
          <h1 className={styles.title} aria-live="polite">
            임시 비밀번호가 발급되었습니다
          </h1>

          {hasPassword ? (
            <>
              <p className={styles.desc}>
                아래 임시 비밀번호로 로그인한 뒤, 반드시 비밀번호를 변경해 주세요.
              </p>

              <div className={styles.pwBox} aria-label="임시 비밀번호">
                <span className={styles.pw}>{password}</span>
              </div>

              <p className={styles.notice}>*안전을 위해 비밀번호를 변경해 주세요.</p>
            </>
          ) : (
            <>
              <p className={styles.desc}>
                등록하신 이메일로 임시 비밀번호 안내를 전송했습니다. 메일함을 확인해 주세요.
              </p>
              <p className={styles.subDesc}>
                메일이 보이지 않으면 스팸함을 확인하거나, 잠시 후 다시 시도해 주세요.
              </p>
              <p className={styles.notice}>*안전을 위해 비밀번호를 변경해 주세요.</p>
            </>
          )}

          <div className={styles.actions}>
            <Link to={toLogin} className={`${styles.btn} ${styles.primary}`}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
