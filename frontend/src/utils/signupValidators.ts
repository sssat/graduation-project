// src/utils/signupValidators.ts

export const USER_ID_RE = /^[a-z0-9]{5,20}$/;
const ALLOWED_EMAIL_DOMAINS = new Set(["gmail.com", "naver.com", "kakao.com"]);

/** 이름 규칙: 2~20자, 한글/영문과 공백만 */
export const NAME_RE = /^(?=.{2,20}$)[가-힣a-zA-Z]+(?: [가-힣a-zA-Z]+)*$/;

export type UiGender = "" | "male" | "female" | "other";

export function validateUserId(userId: string): string | null {
  const v = userId.trim();
  if (!v) return "아이디를 입력하세요.";
  if (!USER_ID_RE.test(v)) return "아이디는 5~20자의 영문 소문자/숫자만 사용가능합니다.";
  return null;
}

/** 이름 검증: 규칙 위반이면 통일 문구로 반환 */
export function validateName(name: string): string | null {
  const v = name.trim();
  if (!v) return "이름을 입력해주세요.";
  if (!NAME_RE.test(v)) return "사용 불가능한 이름입니다.";
  return null;
}

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return "이메일을 입력하세요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "이메일 형식이 올바르지 않습니다.";
  const domain = v.split("@")[1]?.toLowerCase();
  if (!ALLOWED_EMAIL_DOMAINS.has(domain)) {
    return "허용된 도메인만 사용할 수 있습니다. (gmail/naver/kakao)";
  }
  return null;
}

function has3Of4Kinds(pw: string): boolean {
  let kinds = 0;
  if (/[A-Z]/.test(pw)) kinds++;
  if (/[a-z]/.test(pw)) kinds++;
  if (/[0-9]/.test(pw)) kinds++;
  if (/[^A-Za-z0-9]/.test(pw)) kinds++;
  return kinds >= 3;
}

function hasFourSequentialDigits(pw: string): boolean {
  for (let i = 0; i <= pw.length - 4; i++) {
    const s = pw.slice(i, i + 4);
    if (/^\d{4}$/.test(s)) {
      const n0 = Number(s[0]), n1 = Number(s[1]), n2 = Number(s[2]), n3 = Number(s[3]);
      const asc  = n1 === n0 + 1 && n2 === n1 + 1 && n3 === n2 + 1;
      const desc = n1 === n0 - 1 && n2 === n1 - 1 && n3 === n2 - 1;
      if (asc || desc) return true;
    }
  }
  return false;
}

export function validatePassword(pw: string, pw2: string, userId?: string): string | null {
  if (!pw) return "비밀번호를 입력하세요.";
  if (pw.length < 8 || pw.length > 16) return "비밀번호는 8~16자이어야 합니다.";
  if (pw !== pw2) return "비밀번호 확인이 일치하지 않습니다.";
  if (!has3Of4Kinds(pw)) return "영문 대/소문자/숫자/특수문자 중 3종 이상 포함해야 합니다.";
  if (hasFourSequentialDigits(pw)) return "연속된 숫자 4자(예: 1234/4321)는 사용할 수 없습니다.";
  if (userId && pw.toLowerCase().includes(userId.trim().toLowerCase())) {
    return "비밀번호에 아이디를 포함할 수 없습니다.";
  }
  return null;
}

export function validateBirth(y: string, m: string, d: string): string | null {
  if (!y || !m || !d) return "생년월일을 입력해주세요.";
  const yyyy = Number(y), mm = Number(m), dd = Number(d);

  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) {
    return "생년월일이 올바르지 않습니다.";
  }

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();

  const age = todayY - yyyy - ((todayM < mm) || (todayM === mm && todayD < dd) ? 1 : 0);

  if (age < 14 && age >= 0) return "만 14세 이상만 가입할 수 있습니다.";
  if (age < 0 || age >= 120) return "생년월일이 올바르지 않습니다.";
  return null;
}

export function validateGender(gender: UiGender): string | null {
  if (gender !== "male" && gender !== "female") return "성별을 선택해야 합니다.";
  return null;
}