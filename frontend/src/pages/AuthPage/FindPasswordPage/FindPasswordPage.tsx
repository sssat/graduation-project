// frontend/src/pages/AuthPage/FindPasswordPage/FindPasswordPage.tsx
import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import FindPasswordCard from "../../../components/Auth/FindPassword/FindPWCard/FindPasswordCard";

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

      if (!body.user_id) return alert("아이디를 입력하세요.");
      if (/[A-Z]/.test(body.user_id)) return alert("아이디에는 대문자를 사용할 수 없습니다.");
      if (!body.name) return alert("이름을 입력하세요.");
      if (!body.email) return alert("이메일을 입력하세요.");

      await new Promise((r) => setTimeout(r, 600));

      if (body.name.toLowerCase().includes("fail")) {
        navigate("/auth/find-password/fail", {
          state: { message: "조회 결과가 없습니다." },
          replace: false,
        });
        return;
      }

      const isDebug = body.user_id.toLowerCase().includes("debug");
      navigate("/auth/find-password/success", {
        state: isDebug ? { password: "Tmp-1234-ABCD" } : undefined,
        replace: false,
      });
    },
    [navigate]
  );

  return <FindPasswordCard onSubmit={handleSubmit} />;
}
