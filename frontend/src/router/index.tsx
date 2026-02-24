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
import AdminUserManagementPage from "../pages/AdminUserManagementPage";
import { useAuth } from "../hooks/useAuth";

import FindIdPage from "../pages/AuthPage/FindIdPage/FindIdPage";
import FindIdResultFailPage from "../pages/AuthPage/FindIdPage/FindIdResultFailPage";
import FindIdResultSuccessPage from "../pages/AuthPage/FindIdPage/FindIdResultSuccessPage";

import FindPasswordPage from "../pages/AuthPage/FindPasswordPage/FindPasswordPage";
import FindPasswordResultFailPage from "../pages/AuthPage/FindPasswordPage/FindPasswordResultFailPage";
import FindPasswordResultSuccessPage from "../pages/AuthPage/FindPasswordPage/FindPasswordResultSuccessPage";

// ✅ 추가
import ChangePasswordPage from "../pages/AuthPage/ChangePasswordPage/ChangePasswordPage";

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
  if (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const location = useLocation();

  if (!auth.isAuthed) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }
  if (auth.role !== "SUPER_ADMIN") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
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

        <Route path="auth/find-id" element={<FindIdPage />} />
        <Route path="auth/find-id/fail" element={<FindIdResultFailPage />} />
        <Route path="auth/find-id/success" element={<FindIdResultSuccessPage />} />

        <Route path="auth/find-password" element={<FindPasswordPage />} />
        <Route path="auth/find-password/fail" element={<FindPasswordResultFailPage />} />
        <Route path="auth/find-password/success" element={<FindPasswordResultSuccessPage />} />

        {/* ✅ 플레이스홀더 제거 + 실제 페이지 연결 */}
        <Route
          path="auth/change-password"
          element={
            <RequireAuth>
              <ChangePasswordPage />
            </RequireAuth>
          }
        />

        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />

        <Route
          path="admin/users"
          element={
            <RequireSuperAdmin>
              <AdminUserManagementPage />
            </RequireSuperAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
