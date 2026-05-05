// frontend/src/components/Auth/FindID/FindIdCard/FindIdCard.tsx
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import styles from "./FindIdCard.module.css";

type Props = {
  cardWidth?: number | string;
  onSubmit?: (payload: { name: string; email: string }) => Promise<void> | void;
  toSignup?: string;
  toLogin?: string;

  // (선택) FindIdPage에서 결과를 내려주고 싶으면 사용
  resultUserId?: string | null;
};

type StyleWithCardVar = CSSProperties & {
  ["--card-width"]?: string;
};

export default function FindIdCard({
  cardWidth,
  onSubmit,
  toSignup = "/auth/signup",
  toLogin = "/auth/login",
  resultUserId = null,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const cssVarStyle: StyleWithCardVar | undefined = useMemo(() => {
    if (cardWidth == null) return undefined;
    return { ["--card-width"]: typeof cardWidth === "number" ? `${cardWidth}px` : cardWidth };
  }, [cardWidth]);

  const validate = () => {
    const e: { name?: string; email?: string } = {};
    const n = name.trim();
    const em = email.trim();

    if (!n) e.name = "이름을 입력해주세요.";

    if (!em) {
      e.email = "이메일을 입력해주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      e.email = "이메일 형식이 올바르지 않습니다.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      if (onSubmit) {
        await onSubmit({ name: name.trim(), email: email.trim() });
      } else {
        await new Promise((r) => setTimeout(r, 600));
        alert("요청이 접수되었습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.section} aria-label="아이디 찾기">
      <div className={styles.wrap} style={cssVarStyle}>
        <div className={styles.card}>
          <h1 className={styles.title}>아이디 찾기</h1>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label htmlFor="findid-name" className={styles.srOnly}>
              이름
            </label>
            <input
              id="findid-name"
              className={styles.input}
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={loading}
            />
            {errors.name ? <p className={styles.error}>{errors.name}</p> : null}

            <label htmlFor="findid-email" className={styles.srOnly}>
              이메일
            </label>
            <input
              id="findid-email"
              className={styles.input}
              placeholder="이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
            {errors.email ? <p className={styles.error}>{errors.email}</p> : null}

            {resultUserId ? (
              <div className={styles.result} role="status" aria-live="polite">
                <span className={styles.resultLabel}>찾은 아이디</span>
                <strong className={styles.resultValue}>{resultUserId}</strong>
              </div>
            ) : null}

            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "처리 중…" : "확인"}
            </button>
          </form>
        </div>

        <nav className={styles.linksBar} aria-label="아이디 찾기 관련 링크">
          <Link className={styles.link} to={toSignup}>
            회원가입 하기
          </Link>

          <Link className={styles.link} to={toLogin}>
            로그인 하기
          </Link>
        </nav>
      </div>
    </section>
  );
}
