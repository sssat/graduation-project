// src/pages/AuthPage/SignUpPage/SignUpSuccessPage.tsx

import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import SignUpSuccessCard from "../../../components/Auth/SignUp/SignUpSuccessCard/SignUpSuccessCard";

type LocState = { state?: { name?: string } };

export default function SignUpSuccessPage() {
  const location = useLocation() as LocState;
  const [params] = useSearchParams();

  // 새로고침 대비: state -> query(name) -> 빈 문자열
  const name =
    location.state?.name ??
    params.get("name") ??
    "";

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "회원가입 완료 | Newsight";
  }, []);

  return (
    <main style={{ padding: "32px 16px" }}>
      <SignUpSuccessCard name={name} />
    </main>
  );
}
