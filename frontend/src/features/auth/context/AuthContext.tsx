// frontend/src/contexts/AuthContext.tsx
import { createContext, useContext } from "react";

export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

export type Auth = {
  isAuthed: boolean;
  role: Role | null;
  userSeq: number | null;
  userId: string | null;
  userName: string | null;
};

export type AuthContextValue = {
  auth: Auth;
  login: (id: string, pw: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const Ctx = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 하위에서만 사용할 수 있습니다.");
  }
  return ctx;
}
