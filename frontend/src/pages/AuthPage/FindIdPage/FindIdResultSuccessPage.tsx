// frontend/src/pages/AuthPage/FindIdPage/FindIdResultSuccessPage.tsx
// 목적: 아이디 찾기 "성공 결과" 페이지.
// 전달 경로: location.state.userId -> 쿼리파라미터 ?userId= -> 빈 문자열

import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import FindIdResultSuccess from "../../../components/Auth/FindID/FindIDResultSuccess/FindIdResultSuccess";

function readStringFromState(state: unknown, key: string): string | undefined {
  if (typeof state !== "object" || state === null) return undefined;
  const v = (state as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

export default function FindIdResultSuccessPage() {
  const location = useLocation();
  const [params] = useSearchParams();

  const userId =
    readStringFromState(location.state, "userId") ?? params.get("userId") ?? "";

  useEffect(() => {
    document.title = "아이디 찾기 결과 | Newsight";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return <FindIdResultSuccess userId={userId} />;
}
