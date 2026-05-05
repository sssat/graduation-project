// frontend/src/pages/AuthPage/SignUpPage/SignUpPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import SignUpCard from "../../../components/Auth/SignUp/SignUpCard/SignUpCard";
import type { SignUpForm } from "../../../components/Auth/SignUp/SignUpCard/SignUpCard";
import {
  precheckEmail,
  precheckUserId,
  signUp,
  type UserGender,
} from "../../../../../api/accounts";
import { getErrorMessage } from "../../../../../api/types";
import {
  validateBirth,
  validateEmail,
  validateGender,
  validateName,
  validatePassword,
  validateUserId,
} from "../../../../../utils/signupValidators";

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

function toBirthDate(y: string, m: string, d: string): string {
  if (!y || !m || !d) return "";
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function toServerGender(g: SignUpForm["gender"]): UserGender | null {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return null;
}

function getUserIdPrecheckMessage(status: string | undefined, valid: boolean | undefined): string {
  if (valid === false || status === "invalid") {
    return "사용할 수 없는 아이디 형식입니다.";
  }
  if (status === "taken") {
    return "이미 사용 중인 아이디입니다.";
  }
  return "아이디 확인에 실패했습니다.";
}

function getEmailPrecheckMessage(status: string | undefined, valid: boolean | undefined): string {
  if (valid === false || status === "invalid") {
    return "이메일 형식이 올바르지 않거나 허용되지 않은 도메인입니다.";
  }
  if (status === "taken") {
    return "이미 사용 중인 이메일입니다.";
  }
  return "이메일 확인에 실패했습니다.";
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

    const res = await precheckUserId({ user_id: userId });
    const status = res.user_id?.status;
    const valid = res.user_id?.valid;

    if (status !== "available" || valid !== true || !res.id_check_token) {
      throw new Error(getUserIdPrecheckMessage(status, valid));
    }

    setIdCheckToken(res.id_check_token);
    setCheckedUserId(userId);
    return true;
  };

  const handleCheckEmail = async (emailInput: string) => {
    const msg = validateEmail(emailInput);
    if (msg) throw new Error(msg);

    const email = emailInput.trim().toLowerCase();

    const res = await precheckEmail({ email });
    const status = res.email?.status;
    const valid = res.email?.valid;

    if (status !== "available" || valid !== true || !res.email_check_token) {
      throw new Error(getEmailPrecheckMessage(status, valid));
    }

    setEmailCheckToken(res.email_check_token);
    setCheckedEmail(email);
    return true;
  };

  const handleSubmit = async (form: SignUpForm) => {
    setErrors({});

    const user_id = form.username.trim();
    const user_name = form.name.trim();
    const email = form.email.trim().toLowerCase();
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
    if (e4) {
      if (e4.includes("비밀번호 확인이 일치하지 않습니다")) {
        nextErrors.password2 = e4;
      } else {
        nextErrors.password = e4;
      }
    }

    const e5 = validateBirth(form.birthYear, form.birthMonth, form.birthDay);
    if (e5) nextErrors.birth = e5;

    const e6 = validateGender(form.gender);
    if (e6) nextErrors.gender = e6;

    if (!form.agree) nextErrors.agree = "이용약관 동의가 필요합니다.";

    const gender = toServerGender(form.gender);
    const birth_date = toBirthDate(form.birthYear, form.birthMonth, form.birthDay);

    if (!idCheckToken) nextErrors.username = nextErrors.username || "아이디 중복확인을 해주세요.";
    else if (checkedUserId !== user_id) {
      nextErrors.username = "아이디가 변경되었습니다. 아이디 중복확인을 다시 해주세요.";
    }

    if (!emailCheckToken) nextErrors.email = nextErrors.email || "이메일 중복확인을 해주세요.";
    else if ((checkedEmail ?? "").toLowerCase() !== email) {
      nextErrors.email = "이메일이 변경되었습니다. 이메일 중복확인을 다시 해주세요.";
    }

    if (!gender) nextErrors.gender = nextErrors.gender || "성별을 선택해야 합니다.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // TypeScript 안전성 보강: 위 검증 로직상 여기 도달하면 gender는 반드시 존재해야 함
    if (!gender) {
      setErrors({ gender: "성별을 선택해야 합니다." });
      return;
    }

    try {
      await signUp({
        user_id,
        email,
        password,
        password2,
        username: user_name,
        birth_date,
        gender,
        agree_whether: Boolean(form.agree),
        id_check_token: idCheckToken!,
        email_check_token: emailCheckToken!,
      });

      nav(`/auth/signup/success?name=${encodeURIComponent(user_name)}`, {
        state: { name: user_name },
        replace: true,
      });
    } catch (error) {
      const msg = getErrorMessage(error, "회원가입에 실패했습니다.");

      // 백엔드 메시지에 따라 필드 에러로 최대한 매핑
      if (msg.includes("아이디") && (msg.includes("중복") || msg.includes("사용 중") || msg.includes("precheck"))) {
        setErrors({ username: msg });
        return;
      }
      if (msg.includes("이메일") && (msg.includes("중복") || msg.includes("사용 중") || msg.includes("precheck"))) {
        setErrors({ email: msg });
        return;
      }
      if (msg.includes("비밀번호")) {
        setErrors({ password: msg });
        return;
      }
      if (msg.includes("생년월일")) {
        setErrors({ birth: msg });
        return;
      }

      setErrors({ general: msg });
    }
  };

  return (
    <main style={{ padding: 0 }}>
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
