// frontend/src/pages/AuthPage/ChangePasswordPage/ChangePasswordPage.tsx
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChangePasswordCard from "../../../components/Auth/ChangePassword/ChangePWCard/ChangePasswordCard";

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "비밀번호 변경 | Newsight";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const handleSubmit = useCallback(
    async (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
      await new Promise((r) => setTimeout(r, 600));

      const cur = (payload.currentPassword ?? "").trim();

      // 목업 서버 에러 규칙: 현재 비밀번호에 "wrong" 포함 시 실패
      if (cur.toLowerCase().includes("wrong")) {
        throw new Error("현재 비밀번호가 올바르지 않습니다.");
      }

      alert("비밀번호가 변경되었습니다. 다시 로그인 해주세요.");
      navigate("/auth/login?pwChanged=1", { replace: true });
    },
    [navigate]
  );

  return <ChangePasswordCard cardWidth={420} onSubmit={handleSubmit} />;
}
