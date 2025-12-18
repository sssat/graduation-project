// frontend/src/contexts/AuthProvider.tsx
import React, { useCallback, useMemo, useState } from "react";
import { Ctx, type Auth, type Role } from "./AuthContext";

/* 로컬스토리지 키 */
const LS_ROLE = "auth.role";
const LS_USERSEQ = "auth.userSeq";
const LS_USERID = "auth.userId";
const LS_USERNAME = "auth.userName";

const DEFAULT_AUTH: Auth = {
  isAuthed: false,
  role: null,
  userSeq: null,
  userId: null,
  userName: null,
};

function loadAuthFromLS(): Auth {
  const roleRaw = localStorage.getItem(LS_ROLE);
  const role: Role | null = roleRaw === "ADMIN" || roleRaw === "USER" ? roleRaw : null;

  const userSeqRaw = localStorage.getItem(LS_USERSEQ);
  const userSeq = userSeqRaw ? Number(userSeqRaw) : null;

  const userId = localStorage.getItem(LS_USERID);
  const userName = localStorage.getItem(LS_USERNAME);

  if (role && userSeq !== null && Number.isFinite(userSeq) && userId) {
    return {
      isAuthed: true,
      role,
      userSeq,
      userId,
      userName: userName ?? null,
    };
  }
  return DEFAULT_AUTH;
}

function saveAuthToLS(next: Auth): void {
  if (!next.isAuthed) return;
  if (next.role) localStorage.setItem(LS_ROLE, next.role);
  if (next.userSeq != null) localStorage.setItem(LS_USERSEQ, String(next.userSeq));
  if (next.userId) localStorage.setItem(LS_USERID, next.userId);
  if (next.userName) localStorage.setItem(LS_USERNAME, next.userName);
  else localStorage.removeItem(LS_USERNAME);
}

function clearAuthLS(): void {
  localStorage.removeItem(LS_ROLE);
  localStorage.removeItem(LS_USERSEQ);
  localStorage.removeItem(LS_USERID);
  localStorage.removeItem(LS_USERNAME);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  // 퍼블리싱 단계: 부팅 시 localStorage로 즉시 복원
  const [auth, setAuth] = useState<Auth>(() => loadAuthFromLS());

  const login = useCallback(async (id: string, pw: string) => {
    const userId = (id ?? "").trim();
    const password = pw ?? "";

    if (!userId || !password) {
      throw new Error("아이디와 비밀번호를 입력하세요.");
    }

    if (/[A-Z]/.test(userId)) {
      throw new Error("아이디에는 대문자를 사용할 수 없습니다.");
    }

    // 퍼블리싱 단계 mock: 약간의 딜레이 후 성공 처리
    await new Promise((r) => setTimeout(r, 300));

    const isAdmin = userId.toLowerCase().includes("admin");

    const next: Auth = {
      isAuthed: true,
      role: isAdmin ? "ADMIN" : "USER",
      userSeq: isAdmin ? 999 : 1,
      userId,
      userName: userId,
    };

    saveAuthToLS(next);
    setAuth(next);
  }, []);

  const logout = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 150));
    clearAuthLS();
    setAuth(DEFAULT_AUTH);
  }, []);

  const value = useMemo(() => ({ auth, login, logout }), [auth, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
