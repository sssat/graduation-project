// frontend/src/contexts/AuthProvider.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ctx, type Auth, type Role } from "./AuthContext";
import {
  clearClientAuth,
  login as loginApi,
  logout as logoutApi,
  refreshToken,
  type LoginResponse,
} from "../../../api/accounts";
import { getAccessToken, setUnauthorizedHandler } from "../../../api/http";

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
  if (typeof window === "undefined") return DEFAULT_AUTH;

  const roleRaw = localStorage.getItem(LS_ROLE);
  const role: Role | null =
    roleRaw === "SUPER_ADMIN" || roleRaw === "ADMIN" || roleRaw === "USER" ? roleRaw : null;

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
  if (typeof window === "undefined") return;
  if (!next.isAuthed) return;

  if (next.role) localStorage.setItem(LS_ROLE, next.role);
  if (next.userSeq != null) localStorage.setItem(LS_USERSEQ, String(next.userSeq));
  if (next.userId) localStorage.setItem(LS_USERID, next.userId);
  if (next.userName) localStorage.setItem(LS_USERNAME, next.userName);
  else localStorage.removeItem(LS_USERNAME);
}

function clearAuthLS(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_ROLE);
  localStorage.removeItem(LS_USERSEQ);
  localStorage.removeItem(LS_USERID);
  localStorage.removeItem(LS_USERNAME);
}

function clearAuthAll(setAuth: React.Dispatch<React.SetStateAction<Auth>>): void {
  clearAuthLS();
  clearClientAuth();
  setAuth(DEFAULT_AUTH);
}

function normalizeRole(input: unknown): Role {
  const raw = String(input ?? "").trim().toUpperCase();

  if (raw === "SUPER_ADMIN" || raw === "SUPERADMIN" || raw === "SUPER-ADMIN") return "SUPER_ADMIN";
  if (raw === "ADMIN") return "ADMIN";
  return "USER";
}

function buildAuthFromLoginResponse(data: LoginResponse, fallbackUserId: string): Auth {
  const userId = (data.user_id ?? fallbackUserId ?? "").trim();
  const userName =
    typeof data.user_name === "string" && data.user_name.trim()
      ? data.user_name.trim()
      : userId || null;

  return {
    isAuthed: true,
    role: normalizeRole(data.role),
    userSeq: Number.isFinite(Number(data.user_seq)) ? Number(data.user_seq) : null,
    userId: userId || null,
    userName,
  };
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Auth>(() => loadAuthFromLS());

  // 동시 refresh 중복 호출 방지
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);

  const runRefresh = useCallback(async (): Promise<boolean> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const task = (async () => {
      try {
        const res = await refreshToken();
        const nextAccess =
          typeof res.access === "string" && res.access.trim()
            ? res.access.trim()
            : typeof res.access_token === "string" && res.access_token.trim()
            ? res.access_token.trim()
            : null;

        return Boolean(nextAccess);
      } catch {
        return false;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = task;
    return task;
  }, []);

  const login = useCallback(async (id: string, pw: string) => {
    const userId = (id ?? "").trim();
    const password = pw ?? "";

    if (!userId || !password) {
      throw new Error("아이디와 비밀번호를 입력하세요.");
    }

    if (/[A-Z]/.test(userId)) {
      throw new Error("아이디에는 대문자를 사용할 수 없습니다.");
    }

    const data = await loginApi({
      user_id: userId,
      password,
    });

    const next = buildAuthFromLoginResponse(data, userId);

    if (!next.userSeq || !next.userId) {
      throw new Error("로그인 응답 형식이 올바르지 않습니다.");
    }

    saveAuthToLS(next);
    setAuth(next);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // 서버 로그아웃 호출 실패 시에도 클라이언트 상태는 정리
    } finally {
      clearAuthAll(setAuth);
    }
  }, []);

  // 앱 시작 시 localStorage auth는 있는데 access 토큰이 없으면 refresh 쿠키로 복구 시도
  useEffect(() => {
    let active = true;

    (async () => {
      if (!auth.isAuthed) return;
      if (getAccessToken()) return;

      const ok = await runRefresh();
      if (!ok && active) {
        clearAuthAll(setAuth);
      }
    })();

    return () => {
      active = false;
    };
  }, [auth.isAuthed, runRefresh]);

  // 401 전역 처리: refresh 1회 시도, 실패하면 auth 정리
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      if (!auth.isAuthed) return;

      const ok = await runRefresh();
      if (!ok) {
        clearAuthAll(setAuth);
      }
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [auth.isAuthed, runRefresh]);

  const value = useMemo(() => ({ auth, login, logout }), [auth, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
