// frontend/src/pages/AuthPage/FindIdPage/FindIdPage.tsx
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FindIdCard from "../../../components/Auth/FindID/FindIDCard/FindIdCard";

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
        alert("이름과 이메일을 모두 입력하세요.");
        return;
      }

      // 목업 지연
      await new Promise((r) => setTimeout(r, 600));

      // ✅ 목업 규칙:
      // - 이름에 'fail' 포함 => 실패 페이지
      // - 그 외 => 성공 페이지 (userId 전달)
      if (trimmedName.toLowerCase().includes("fail")) {
        navigate("/auth/find-id/fail", {
          state: { message: "조회 결과가 없습니다." },
          replace: false,
        });
        return;
      }

      // ✅ 성공: alert 대신 성공 페이지로 이동
      navigate("/auth/find-id/success", {
        state: { userId: "newsight_user01" },
        replace: false,
      });
    },
    [navigate]
  );

  return <FindIdCard onSubmit={handleSubmit} />;
}
