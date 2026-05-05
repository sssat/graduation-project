// frontend/src/components/Auth/SignUp/SignUpSuccessCard/SignUpSuccessCard.tsx
import { useMemo } from "react";
import { Link } from "react-router-dom";
import styles from "./SignUpSuccessCard.module.css";
import logo from "../../../../../../assets/logo.png";

type Props = {
  name?: string;
  cardWidth?: number | string;
  toLogin?: string; // 기본 "/auth/login"
  toHome?: string;  // 기본 "/"
};

type CSSVar = `--${string}`;
type StyleWithVars = React.CSSProperties & Record<CSSVar, string>;

const toUnit = (v: number | string) => (typeof v === "number" ? `${v}px` : String(v));

export default function SignUpSuccessCard({
  name,
  cardWidth = 420,
  toLogin = "/auth/login",
  toHome = "/",
}: Props) {
  const displayName = (name && name.trim()) || "회원";

  const styleVars = useMemo<StyleWithVars>(
    () => ({ "--card-width": toUnit(cardWidth) }),
    [cardWidth]
  );

  return (
    <section className={styles.section} aria-label="회원가입 완료">
      <div className={styles.wrap} style={styleVars}>
        <div className={styles.card}>
          <img src={logo} alt="MARKET STAGE" className={styles.logo} />

          <p className={styles.title}>회원가입이 완료 되었습니다.</p>
          <p className={styles.sub}>{displayName}님의 회원가입을 축하합니다.</p>

          <hr className={styles.hr} />

          <div className={styles.btnRow}>
            <Link to={toLogin} className={`${styles.btn} ${styles.btnPrimary}`}>
              로그인
            </Link>
            <Link to={toHome} className={`${styles.btn} ${styles.btnSecondary}`}>
              홈으로
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
