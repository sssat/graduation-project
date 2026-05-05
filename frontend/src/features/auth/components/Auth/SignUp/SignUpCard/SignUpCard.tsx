// src/components/Auth/SignUp/SignUpCard/SignUpCard.tsx
import { useMemo, useState } from "react";
import { validateEmail, validateUserId } from "../../../../../../utils/signupValidators";
import styles from "./SignUpCard.module.css";
import logo from "../../../../../../assets/logo.png";

export type SignUpForm = {
  username: string;
  password: string;
  password2: string;
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  gender: "" | "male" | "female" | "other";
  email: string;
  agree: boolean;
};

type LocalErrors = Partial<
  Record<
    | "username"
    | "password"
    | "password2"
    | "name"
    | "birth"
    | "gender"
    | "email"
    | "agree"
    | "general",
    string
  >
>;

type SignUpCardProps = {
  cardWidth?: number | string;
  onSubmit?: (data: SignUpForm) => Promise<void> | void;
  onCheckId: (username: string) => Promise<boolean>;
  onCheckEmail: (email: string) => Promise<boolean>;
  errors?: LocalErrors;
  onClearError?: (field: keyof LocalErrors) => void;
};

export default function SignUpCard({
  cardWidth = 360,
  onSubmit,
  onCheckId,
  onCheckEmail,
  errors: externalErrors,
  onClearError,
}: SignUpCardProps) {
  const [form, setForm] = useState<SignUpForm>({
    username: "",
    password: "",
    password2: "",
    name: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    gender: "",
    email: "",
    agree: false,
  });

  const [localErrors, setLocalErrors] = useState<LocalErrors>({});
  const [checkingId, setCheckingId] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [idChecked, setIdChecked] = useState<boolean | null>(null);
  const [emailChecked, setEmailChecked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const uiErrors: LocalErrors = useMemo(() => {
    const cleanExternal = Object.fromEntries(
      Object.entries(externalErrors ?? {}).filter(([, v]) => v != null && v !== "")
    ) as LocalErrors;
    return { ...localErrors, ...cleanExternal };
  }, [externalErrors, localErrors]);

  type StyleVars = React.CSSProperties & { ["--card-width"]?: string };
  const styleVars: StyleVars = useMemo(
    () => ({
      ["--card-width"]: typeof cardWidth === "number" ? `${cardWidth}px` : String(cardWidth),
    }),
    [cardWidth]
  );

  const set = <K extends keyof SignUpForm>(key: K, value: SignUpForm[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
  };

  const handleCheckId = async () => {
    setLocalErrors((e) => ({ ...e, username: undefined }));
    onClearError?.("username");

    const userIdError = validateUserId(form.username);
    if (userIdError) {
      setLocalErrors((e) => ({ ...e, username: userIdError }));
      return;
    }

    setCheckingId(true);
    try {
      const ok = await onCheckId(form.username);
      setIdChecked(ok);
      if (!ok) setLocalErrors((e) => ({ ...e, username: "이미 사용 중인 아이디입니다." }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "아이디 확인에 실패했습니다.";
      setIdChecked(false);
      setLocalErrors((e) => ({ ...e, username: msg }));
    } finally {
      setCheckingId(false);
    }
  };

  const handleCheckEmail = async () => {
    setLocalErrors((e) => ({ ...e, email: undefined }));
    onClearError?.("email");

    const emailError = validateEmail(form.email);
    if (emailError) {
      setLocalErrors((e) => ({ ...e, email: emailError }));
      return;
    }

    setCheckingEmail(true);
    try {
      const ok = await onCheckEmail(form.email);
      setEmailChecked(ok);
      if (!ok) setLocalErrors((e) => ({ ...e, email: "이미 사용 중인 이메일입니다." }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "이메일 확인에 실패했습니다.";
      setEmailChecked(false);
      setLocalErrors((e) => ({ ...e, email: msg }));
    } finally {
      setCheckingEmail(false);
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!onSubmit) return;
    setLoading(true);
    try {
      await onSubmit(form);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.section} aria-label="회원가입">
      <div className={styles.wrap} style={styleVars}>
        <div className={styles.card}>
          <img src={logo} alt="MARKET STAGE" className={styles.logo} />

          {uiErrors.general && (
            <div className={styles.error} role="alert" style={{ marginBottom: 8 }}>
              {uiErrors.general}
            </div>
          )}

          <form className={styles.form} onSubmit={submit} noValidate>
            <div className={styles.row}>
              <label htmlFor="username" className={styles.label}>아이디</label>
              <div className={styles.inlineOut}>
                <input
                  id="username"
                  className={styles.input}
                  autoComplete="username"
                  placeholder="아이디"
                  value={form.username}
                  onChange={(e) => {
                    set("username", e.target.value);
                    setIdChecked(null);
                    setLocalErrors((er) => ({ ...er, username: undefined }));
                    onClearError?.("username");
                  }}
                />
                <button
                  type="button"
                  className={styles.sideBtn}
                  onClick={handleCheckId}
                  disabled={checkingId || !form.username.trim()}
                >
                  {checkingId ? "확인중…" : "ID 중복확인"}
                </button>
              </div>
            </div>
            {uiErrors.username && <p className={styles.errorText}>{uiErrors.username}</p>}
            {idChecked === true && <p className={styles.okText}>사용 가능한 아이디입니다.</p>}

            <div className={styles.row}>
              <label htmlFor="password" className={styles.label}>비밀번호</label>
              <input
                id="password"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호"
                value={form.password}
                onChange={(e) => {
                  set("password", e.target.value);
                  onClearError?.("password");
                }}
              />
            </div>
            {uiErrors.password && <p className={styles.errorText}>{uiErrors.password}</p>}

            <div className={styles.row}>
              <label htmlFor="password2" className={styles.label}>비밀번호 확인</label>
              <input
                id="password2"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호 확인"
                value={form.password2}
                onChange={(e) => {
                  set("password2", e.target.value);
                  onClearError?.("password2");
                }}
              />
            </div>
            {uiErrors.password2 && <p className={styles.errorText}>{uiErrors.password2}</p>}

            <div className={styles.row}>
              <label htmlFor="name" className={styles.label}>이름</label>
              <input
                id="name"
                className={styles.input}
                placeholder="이름"
                value={form.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  onClearError?.("name");
                }}
              />
            </div>
            {uiErrors.name && <p className={styles.errorText}>{uiErrors.name}</p>}

            <div className={styles.row}>
              <span className={styles.label}>생년월일</span>
              <div className={styles.triple}>
                <input
                  id="birthYear"
                  className={styles.input}
                  placeholder="년(4자)"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.birthYear}
                  onChange={(e) => {
                    set("birthYear", e.target.value.replace(/\D/g, ""));
                    onClearError?.("birth");
                  }}
                />
                <input
                  id="birthMonth"
                  className={styles.input}
                  placeholder="월"
                  inputMode="numeric"
                  maxLength={2}
                  value={form.birthMonth}
                  onChange={(e) => {
                    set("birthMonth", e.target.value.replace(/\D/g, ""));
                    onClearError?.("birth");
                  }}
                />
                <input
                  id="birthDay"
                  className={styles.input}
                  placeholder="일"
                  inputMode="numeric"
                  maxLength={2}
                  value={form.birthDay}
                  onChange={(e) => {
                    set("birthDay", e.target.value.replace(/\D/g, ""));
                    onClearError?.("birth");
                  }}
                />
              </div>
            </div>
            {uiErrors.birth && <p className={styles.errorText}>{uiErrors.birth}</p>}

            <div className={styles.row}>
              <label htmlFor="gender" className={styles.label}>성별</label>
              <select
                id="gender"
                className={styles.select}
                value={form.gender}
                onChange={(e) => {
                  set("gender", e.target.value as SignUpForm["gender"]);
                  onClearError?.("gender");
                }}
              >
                <option value="">선택</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>
            {uiErrors.gender && <p className={styles.errorText}>{uiErrors.gender}</p>}

            <div className={styles.row}>
              <label htmlFor="email" className={styles.label}>이메일</label>
              <div className={styles.inlineOut}>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  placeholder="이메일"
                  value={form.email}
                  onChange={(e) => {
                    set("email", e.target.value);
                    setEmailChecked(null);
                    setLocalErrors((er) => ({ ...er, email: undefined }));
                    onClearError?.("email");
                  }}
                />
                <button
                  type="button"
                  className={styles.sideBtn}
                  onClick={handleCheckEmail}
                  disabled={checkingEmail || !form.email.trim()}
                >
                  {checkingEmail ? "확인중…" : "Email 중복확인"}
                </button>
              </div>
            </div>
            {uiErrors.email && <p className={styles.errorText}>{uiErrors.email}</p>}
            {emailChecked === true && <p className={styles.okText}>사용 가능한 이메일입니다.</p>}

            <label className={styles.terms}>
              <input
                type="checkbox"
                checked={form.agree}
                onChange={(e) => {
                  set("agree", e.target.checked);
                  onClearError?.("agree");
                }}
              />
              <span>이용약관 개인정보 수집 및 정보이용에 동의합니다.</span>
            </label>
            {uiErrors.agree && <p className={styles.errorText}>{uiErrors.agree}</p>}

            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "처리 중…" : "가입하기"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
