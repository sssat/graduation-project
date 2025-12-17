// frontend/src/pages/AuthPage/LoginPage/LoginPage.tsx

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LoginCard from "../../../components/Auth/LoginCard/LoginCard";
import { useAuth } from "../../../hooks/useAuth";

export default function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();

  const handleSubmit = useCallback(
    async (...args: unknown[]) => {
      let userId = "";
      let password = "";

      if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        const payload = args[0] as Partial<{
          user_id: string;
          userId: string;
          id: string;
          password: string;
        }>;
        userId = payload.user_id ?? payload.userId ?? payload.id ?? "";
        password = payload.password ?? "";
      } else if (args.length === 1 && Array.isArray(args[0])) {
        const arr = args[0] as unknown[];
        userId = (arr[0] as string) ?? "";
        password = (arr[1] as string) ?? "";
      } else if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "string") {
        userId = args[0];
        password = args[1];
      }

      const uid = (userId ?? "").trim();

      if (/[A-Z]/.test(uid)) {
        alert("아이디에는 대문자를 사용할 수 없습니다.");
        return;
      }
      if (!uid || !password) {
        alert("아이디와 비밀번호를 입력하세요.");
        return;
      }

      try {
        await login(uid, password); // AuthProvider(mock)가 auth.* 저장 + 상태 갱신
        nav("/", { replace: true });
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "로그인 실패");
      }
    },
    [login, nav]
  );

  return <LoginCard onSubmit={handleSubmit} />;
}
