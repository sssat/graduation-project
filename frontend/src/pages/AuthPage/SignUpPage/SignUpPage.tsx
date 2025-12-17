// frontend/src/pages/AuthPage/SignUpPage/SignUpPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import SignUpCard from "../../../components/Auth/SignUp/SignUpCard/SignUpCard";
import type { SignUpForm } from "../../../components/Auth/SignUp/SignUpCard/SignUpCard";

type FieldErrors = {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
  password2?: string;
  birth?: string;
  gender?: string;
  agree?: string;
  general?: string;
};

type UserRecord = {
  user_id: string;
  email: string;
  user_name: string;
  birth_date: string; // YYYY-MM-DD
  gender: "M" | "F";
};

const USERS_KEY = "NS_USERS";

function loadUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as UserRecord[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: UserRecord[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function validateUserId(v: string): string | null {
  const s = v.trim();
  if (!s) return "아이디를 입력해주세요.";
  if (/[A-Z]/.test(s)) return "아이디에는 대문자를 사용할 수 없습니다.";
  if (!/^[a-z0-9]{5,20}$/.test(s)) return "아이디는 영문 소문자/숫자 5~20자만 가능합니다.";
  return null;
}

function validateName(v: string): string | null {
  const s = v.trim();
  if (!s) return "이름을 입력해주세요.";
  if (s.length < 2) return "이름은 2자 이상 입력해주세요.";
  return null;
}

function validateEmail(v: string): string | null {
  const s = v.trim();
  if (!s) return "이메일을 입력해주세요.";
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (!ok) return "이메일 형식이 올바르지 않습니다.";
  return null;
}

function validatePassword(pw: string, pw2: string, userId: string): string | null {
  if (!pw) return "비밀번호를 입력해주세요.";
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (pw.includes(userId)) return "비밀번호에 아이디를 포함할 수 없습니다.";
  if (pw !== pw2) return "비밀번호 확인이 일치하지 않습니다.";
  return null;
}

function toBirthDate(y: string, m: string, d: string): string {
  if (!y || !m || !d) return "";
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function validateBirth(y: string, m: string, d: string): string | null {
  const birth = toBirthDate(y, m, d);
  if (!birth) return "생년월일을 입력해주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return "생년월일 형식이 올바르지 않습니다.";
  return null;
}

function validateGender(g: SignUpForm["gender"]): string | null {
  if (g !== "male" && g !== "female") return "성별을 선택하세요.";
  return null;
}

function toServerGender(g: SignUpForm["gender"]): "M" | "F" | null {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return null;
}

function issueToken(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export default function SignUpPage() {
  const nav = useNavigate();

  const [idCheckToken, setIdCheckToken] = useState<string | null>(null);
  const [emailCheckToken, setEmailCheckToken] = useState<string | null>(null);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [checkedEmail, setCheckedEmail] = useState<string | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    document.title = "회원가입 | Newsight";
    window.scrollTo(0, 0);
  }, []);

  const handleCheckId = async (username: string) => {
    const msg = validateUserId(username);
    if (msg) throw new Error(msg);

    const userId = username.trim();
    const users = loadUsers();
    const taken = users.some((u) => u.user_id === userId);

    if (taken) throw new Error("이미 사용 중인 아이디입니다.");

    const token = issueToken();
    setIdCheckToken(token);
    setCheckedUserId(userId);
    return true;
  };

  const handleCheckEmail = async (emailInput: string) => {
    const msg = validateEmail(emailInput);
    if (msg) throw new Error(msg);

    const email = emailInput.trim().toLowerCase();
    const users = loadUsers();
    const taken = users.some((u) => u.email.toLowerCase() === email);

    if (taken) throw new Error("이미 사용 중인 이메일입니다.");

    const token = issueToken();
    setEmailCheckToken(token);
    setCheckedEmail(email);
    return true;
  };

  const handleSubmit = async (form: SignUpForm) => {
    setErrors({});

    const user_id = form.username.trim();
    const user_name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;
    const password2 = form.password2;

    const nextErrors: FieldErrors = {};

    const e1 = validateUserId(user_id);
    if (e1) nextErrors.username = e1;

    const e2 = validateName(user_name);
    if (e2) nextErrors.name = e2;

    const e3 = validateEmail(email);
    if (e3) nextErrors.email = e3;

    const e4 = validatePassword(password, password2, user_id);
    if (e4) nextErrors.password = e4;

    const e5 = validateBirth(form.birthYear, form.birthMonth, form.birthDay);
    if (e5) nextErrors.birth = e5;

    const e6 = validateGender(form.gender);
    if (e6) nextErrors.gender = e6;

    if (!form.agree) nextErrors.agree = "이용약관 동의가 필요합니다.";

    const gender = toServerGender(form.gender);
    const birth_date = toBirthDate(form.birthYear, form.birthMonth, form.birthDay);

    if (!idCheckToken) nextErrors.username = nextErrors.username || "아이디 중복확인을 해주세요.";
    else if (checkedUserId !== user_id) nextErrors.username = "아이디가 변경되었습니다. 아이디 중복확인을 다시 해주세요.";

    const normalizedEmail = email.toLowerCase();
    if (!emailCheckToken) nextErrors.email = nextErrors.email || "이메일 중복확인을 해주세요.";
    else if ((checkedEmail ?? "").toLowerCase() !== normalizedEmail) nextErrors.email = "이메일이 변경되었습니다. 이메일 중복확인을 다시 해주세요.";

    if (!gender) nextErrors.gender = nextErrors.gender || "성별을 선택하세요.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      const users = loadUsers();

      if (users.some((u) => u.user_id === user_id)) {
        setErrors({ username: "이미 사용 중인 아이디입니다." });
        return;
      }
      if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        setErrors({ email: "이미 사용 중인 이메일입니다." });
        return;
      }

      const newUser: UserRecord = {
        user_id,
        email: normalizedEmail,
        user_name,
        birth_date,
        gender: gender as "M" | "F",
      };

      saveUsers([newUser, ...users]);

      nav(`/auth/signup/success?name=${encodeURIComponent(user_name)}`, {
        state: { name: user_name },
        replace: true,
      });
    } catch {
      setErrors({ general: "회원가입에 실패했습니다." });
    }
  };

  return (
    <main style={{ padding: "32px 16px" }}>
      <SignUpCard
        onSubmit={handleSubmit}
        onCheckId={handleCheckId}
        onCheckEmail={handleCheckEmail}
        cardWidth={420}
        errors={errors}
        onClearError={(field) =>
          setErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
          })
        }
      />
    </main>
  );
}
