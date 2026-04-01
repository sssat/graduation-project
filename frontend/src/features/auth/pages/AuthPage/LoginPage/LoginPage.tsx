// frontend/src/pages/AuthPage/LoginPage/LoginPage.tsx

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LoginCard from "../../../components/Auth/LoginCard/LoginCard";
import { useAuth } from "../../../hooks/useAuth";

export default function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();

  const handleSubmit = useCallback(
    async (userId: string, password: string) => {
      await login(userId, password);
      nav("/", { replace: true });
    },
    [login, nav]
  );

  return <LoginCard onSubmit={handleSubmit} />;
}
