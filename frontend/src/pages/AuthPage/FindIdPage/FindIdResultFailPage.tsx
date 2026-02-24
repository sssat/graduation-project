// frontend/src/pages/AuthPage/FindIdPage/FindIdResultFailPage.tsx
// 목적: 아이디 찾기 "실패 결과" 페이지.
// message는 location.state.message -> 쿼리파라미터 ?message= -> 기본 문구 순으로 사용.

import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import FindIdResultFail from "../../../components/Auth/FindID/FindIDResultFail/FindIdResultFail";

function readStringFromState(state: unknown, key: string): string | undefined {
  if (typeof state !== "object" || state === null) return undefined;
  const v = (state as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

export default function FindIdResultFailPage() {
  const location = useLocation();
  const [params] = useSearchParams();

  const message =
    readStringFromState(location.state, "message") ??
    params.get("message") ??
    "조회 결과가 없습니다.";

  useEffect(() => {
    document.title = "아이디 찾기 실패 | Newsight";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return <FindIdResultFail message={message} />;
}
