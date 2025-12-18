// frontend/src/router/index.tsx

import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import HomePage from "../pages/HomePage";
import KeywordDetailPage from "../pages/KeywordDetailPage";
import MediaComparePage from "../pages/MediaComparePage";
import InquiryBoardPage from "../pages/InquiryBoardPage";
import InquiryDetailPage from "../pages/InquiryDetailPage";

import LoginPage from "../pages/AuthPage/LoginPage/LoginPage";
import SignUpPage from "../pages/AuthPage/SignUpPage/SignUpPage";
import SignUpSuccessPage from "../pages/AuthPage/SignUpPage/SignUpSuccessPage";

import AdminDashboardPage from "../pages/AdminDashboardPage";
import { useAuth } from "../hooks/useAuth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const location = useLocation();

  if (!auth.isAuthed) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const location = useLocation();

  if (!auth.isAuthed) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }
  if (auth.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function ChangePasswordPlaceholder() {
  return (
    <main style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: "28px 18px" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>비밀번호 변경</h1>
      <p style={{ marginTop: 10, color: "#9ca3af", fontSize: 13 }}>
        이 페이지는 아직 연결만 해둔 상태입니다. ChangePasswordPage 컴포넌트가 준비되면
        여기 대신 라우트 element를 교체하면 됩니다.
      </p>
    </main>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />

        <Route path="keywords/:keyword" element={<KeywordDetailPage />} />
        <Route path="keywords" element={<KeywordDetailPage />} />

        <Route path="media" element={<MediaComparePage />} />

        <Route path="inquiries" element={<InquiryBoardPage />} />
        <Route path="inquiries/:inquiryId" element={<InquiryDetailPage />} />

        <Route path="auth/login" element={<LoginPage />} />
        <Route path="auth/signup" element={<SignUpPage />} />
        <Route path="auth/signup/success" element={<SignUpSuccessPage />} />

        <Route
          path="auth/change-password"
          element={
            <RequireAuth>
              <ChangePasswordPlaceholder />
            </RequireAuth>
          }
        />

        {/* 관리자도 AppLayout(기존 Header/Footer) 안에서 렌더링 */}
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
