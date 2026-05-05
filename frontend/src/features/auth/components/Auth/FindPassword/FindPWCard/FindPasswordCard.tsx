// frontend/src/components/Auth/FindPassword/FindPWCard/FindPasswordCard.tsx
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import styles from "./FindPasswordCard.module.css";

type Props = {
  cardWidth?: number | string;
  onSubmit?: (payload: { user_id: string; name: string; email: string }) => Promise<void> | void;
  toSignup?: string;
  toLogin?: string;
};

type StyleWithCardVar = CSSProperties & {
  ["--card-width"]?: string;
};

export default function FindPasswordCard({
  cardWidth,
  onSubmit,
  toSignup = "/auth/signup",
  toLogin = "/auth/login",
}: Props) {
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ user_id?: string; name?: string; email?: string }>({});

  const cssVarStyle: StyleWithCardVar | undefined = useMemo(() => {
    if (cardWidth == null) return undefined;
    return { ["--card-width"]: typeof cardWidth === "number" ? `${cardWidth}px` : cardWidth };
  }, [cardWidth]);

  const validate = () => {
    const e: { user_id?: string; name?: string; email?: string } = {};
    const tUserId = userId.trim();
    const tName = name.trim();
    const tEmail = email.trim();

    if (!tName) e.name = "이름을 입력해주세요.";

    if (!tUserId) {
      e.user_id = "아이디를 입력해주세요.";
    } else if (/[A-Z]/.test(tUserId)) {
      e.user_id = "아이디에는 대문자를 사용할 수 없습니다.";
    }

    if (!tEmail) {
      e.email = "이메일을 입력해주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tEmail)) {
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
        await onSubmit({ user_id: userId.trim(), name: name.trim(), email: email.trim() });
      } else {
        await new Promise((r) => setTimeout(r, 600));
        alert("요청이 접수되었습니다. 입력 정보와 일치하는 계정이 있다면 이메일로 안내를 보냈습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.section} aria-label="비밀번호 찾기">
      <div className={styles.wrap} style={cssVarStyle}>
        <div className={styles.card}>
          <h1 className={styles.title}>비밀번호 찾기</h1>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label htmlFor="findpw-name" className={styles.srOnly}>
              이름
            </label>
            <input
              id="findpw-name"
              className={styles.input}
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={loading}
            />
            {errors.name ? <p className={styles.error}>{errors.name}</p> : null}

            <label htmlFor="findpw-userid" className={styles.srOnly}>
              아이디
            </label>
            <input
              id="findpw-userid"
              className={styles.input}
              placeholder="아이디"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />
            {errors.user_id ? <p className={styles.error}>{errors.user_id}</p> : null}

            <label htmlFor="findpw-email" className={styles.srOnly}>
              이메일
            </label>
            <input
              id="findpw-email"
              className={styles.input}
              placeholder="이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
            {errors.email ? <p className={styles.error}>{errors.email}</p> : null}

            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "처리 중…" : "확인"}
            </button>
          </form>
        </div>

        <nav className={styles.linksBar} aria-label="비밀번호 찾기 관련 링크">
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
