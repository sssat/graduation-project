// frontend/src/pages/AuthPage/FindIdPage/FindIdPage.tsx
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FindIdCard from "../../../components/Auth/FindID/FindIDCard/FindIdCard";
import { findId } from "../../../../../api/accounts";
import { getErrorMessage } from "../../../../../api/types";

export default function FindIdPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "아이디 찾기 | Newsight";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const handleSubmit = useCallback(
    async ({ name, email }: { name: string; email: string }) => {
      const trimmedName = (name ?? "").trim();
      const trimmedEmail = (email ?? "").trim();

      if (!trimmedName || !trimmedEmail) {
        // 카드 컴포넌트의 클라이언트 검증이 먼저 동작하지만, 방어 코드로 유지
        return;
      }

      try {
        const data = await findId({
          name: trimmedName,
          email: trimmedEmail,
        });

        const userId = typeof data.user_id === "string" ? data.user_id.trim() : "";

        if (userId) {
          navigate("/auth/find-id/success", {
            state: { userId },
            replace: false,
          });
          return;
        }

        const failMessage =
          (typeof data.message === "string" && data.message.trim()) || "조회 결과가 없습니다.";

        navigate("/auth/find-id/fail", {
          state: { message: failMessage },
          replace: false,
        });
      } catch (error) {
        const message = getErrorMessage(error, "아이디 찾기 요청 중 오류가 발생했습니다.");

        navigate("/auth/find-id/fail", {
          state: { message },
          replace: false,
        });
      }
    },
    [navigate]
  );

  return <FindIdCard onSubmit={handleSubmit} />;
}
