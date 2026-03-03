// frontend/src/components/Auth/LoginCard/LoginCard.tsx
import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import styles from "./LoginCard.module.css";
import logo from "../../../assets/logo.png";

type LoginCardProps = {
  onSubmit?: (username: string, password: string) => Promise<void> | void;
  cardWidth?: number | string;
};

type StyleWithCardVar = CSSProperties & {
  ["--card-width"]?: string;
};

export default function LoginCard({ onSubmit, cardWidth }: LoginCardProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const uid = username.trim();

    if (!uid || !password) {
      setError("아이디와 비밀번호를 입력하세요.");
      return;
    }

    if (/[A-Z]/.test(uid)) {
      setError("아이디에는 대문자를 사용할 수 없습니다.");
      return;
    }

    try {
      setLoading(true);

      if (onSubmit) {
        await onSubmit(uid, password);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        alert(`로그인(샘플)\n아이디: ${uid}\n비밀번호: ${"*".repeat(password.length)}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const cssVarStyle: StyleWithCardVar | undefined =
    cardWidth != null
      ? { ["--card-width"]: typeof cardWidth === "number" ? `${cardWidth}px` : cardWidth }
      : undefined;

  return (
    <section className={styles.section} aria-label="로그인">
      <div className={styles.wrap} style={cssVarStyle}>
        <div className={styles.card}>
          <img src={logo} alt="MARKET STAGE" className={styles.logo} />

          <form className={styles.form} onSubmit={handleSubmit}>
            <label htmlFor="login-username" className={styles.srOnly}>
              아이디
            </label>
            <input
              id="login-username"
              className={styles.input}
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />

            <label htmlFor="login-password" className={styles.srOnly}>
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              className={styles.input}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />

            {error ? (
              <div role="alert" className={styles.error}>
                {error}
              </div>
            ) : null}

            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "로그인 중…" : "로그인"}
            </button>
          </form>
        </div>

        <nav className={styles.linksBar} aria-label="로그인 관련 링크">
          <Link className={styles.link} to="/auth/signup">
            회원가입 하기
          </Link>

          <div className={styles.rightLinks}>
            <Link className={styles.link} to="/auth/find-id">
              아이디 찾기
            </Link>
            <span className={styles.sep} aria-hidden />
            <Link className={styles.link} to="/auth/find-password">
              비밀번호 찾기
            </Link>
          </div>
        </nav>
      </div>
    </section>
  );
}
