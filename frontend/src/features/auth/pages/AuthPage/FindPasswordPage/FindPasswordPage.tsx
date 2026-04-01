// frontend/src/pages/AuthPage/FindPasswordPage/FindPasswordPage.tsx
import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import FindPasswordCard from "../../../components/Auth/FindPassword/FindPWCard/FindPasswordCard";
import { findPassword } from "../../../../../api/accounts";
import { getErrorMessage } from "../../../../../api/types";

export default function FindPasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.title = "비밀번호 찾기 | Newsight";
  }, []);

  const handleSubmit = useCallback(
    async (payload: { user_id: string; name: string; email: string }) => {
      const body = {
        user_id: (payload.user_id ?? "").trim(),
        name: (payload.name ?? "").trim(),
        email: (payload.email ?? "").trim(),
      };

      // 카드 컴포넌트에서 선검증하지만 방어 코드로 유지
      if (!body.user_id) return;
      if (/[A-Z]/.test(body.user_id)) return;
      if (!body.name) return;
      if (!body.email) return;

      try {
        const data = await findPassword({
          user_id: body.user_id,
          name: body.name,
          email: body.email,
        });

        const tempPassword =
          typeof data.temp_password === "string" && data.temp_password.trim()
            ? data.temp_password.trim()
            : undefined;

        const successMessage =
          typeof data.message === "string" && data.message.trim()
            ? data.message.trim()
            : undefined;

        // 성공 응답은 임시 비밀번호가 포함될 수도 있고(개발/관리자용),
        // 보안 정책상 포함되지 않고 이메일 발송 안내만 올 수도 있음.
        navigate("/auth/find-password/success", {
          state: {
            ...(tempPassword ? { password: tempPassword } : {}),
            ...(successMessage ? { message: successMessage } : {}),
          },
          replace: false,
        });
      } catch (error) {
        const message = getErrorMessage(error, "비밀번호 찾기 요청 중 오류가 발생했습니다.");

        navigate("/auth/find-password/fail", {
          state: { message },
          replace: false,
        });
      }
    },
    [navigate]
  );

  return <FindPasswordCard onSubmit={handleSubmit} />;
}
