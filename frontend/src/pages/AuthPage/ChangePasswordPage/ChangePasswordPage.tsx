// frontend/src/pages/AuthPage/ChangePasswordPage/ChangePasswordPage.tsx
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChangePasswordCard from "../../../components/Auth/ChangePassword/ChangePWCard/ChangePasswordCard";
import { changePassword } from "../../../api/accounts";
import { getErrorMessage } from "../../../api/types";
import { useAuth } from "../../../hooks/useAuth";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    document.title = "비밀번호 변경 | Newsight";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const handleSubmit = useCallback(
    async (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
      const body = {
        current_password: (payload.currentPassword ?? "").trim(),
        new_password: (payload.newPassword ?? "").trim(),
        new_password_confirm: (payload.confirmPassword ?? "").trim(),
      };

      // 카드에서 1차 검증하지만 방어 코드로 유지
      if (!body.current_password) {
        throw new Error("현재 비밀번호를 입력해주세요.");
      }
      if (!body.new_password) {
        throw new Error("새 비밀번호를 입력해주세요.");
      }
      if (!body.new_password_confirm) {
        throw new Error("새 비밀번호를 한 번 더 입력해주세요.");
      }

      try {
        const res = await changePassword(body);

        // 비밀번호 변경 후 재로그인 유도: 로컬 인증 상태도 정리 시도
        try {
          await logout();
        } catch {
          // change-password에서 refresh 쿠키가 이미 무효화되었을 수 있으므로 무시
        }

        const message =
          typeof res.message === "string" && res.message.trim()
            ? res.message.trim()
            : "비밀번호가 변경되었습니다. 다시 로그인 해주세요.";

        alert(message);
        navigate("/auth/login?pwChanged=1", { replace: true });
      } catch (error) {
        const message = getErrorMessage(error, "비밀번호 변경 요청 중 오류가 발생했습니다.");
        throw new Error(message);
      }
    },
    [logout, navigate]
  );

  return <ChangePasswordCard cardWidth={420} onSubmit={handleSubmit} />;
}
