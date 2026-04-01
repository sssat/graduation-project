// frontend/src/pages/AuthPage/FindPasswordPage/FindPasswordResultSuccessPage.tsx
// 목적: 비밀번호 찾기 "성공 결과" 페이지.
// 전달 경로: location.state.password -> 쿼리파라미터 ?password= -> undefined
import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import FindPasswordResultSuccess from "../../../components/Auth/FindPassword/FindPWResultSuccess/FindPasswordResultSuccess";

function readStringFromState(state: unknown, key: string): string | undefined {
  if (typeof state !== "object" || state === null) return undefined;
  const v = (state as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

export default function FindPasswordResultSuccessPage() {
  const location = useLocation();
  const [params] = useSearchParams();

  const password =
    readStringFromState(location.state, "password") ??
    params.get("password") ??
    undefined;

  useEffect(() => {
    document.title = "비밀번호 찾기 결과 | Newsight";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return <FindPasswordResultSuccess password={password} />;
}
