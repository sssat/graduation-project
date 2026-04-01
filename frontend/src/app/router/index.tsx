// frontend/src/router/index.tsx

import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import HomePage from "../../features/analytics/pages/HomePage";
import KeywordDetailPage from "../../features/analytics/pages/KeywordDetailPage";
import MediaComparePage from "../../features/analytics/pages/MediaComparePage";
import InquiryBoardPage from "../../features/inquiries/pages/InquiryBoardPage";
import InquiryDetailPage from "../../features/inquiries/pages/InquiryDetailPage";

import LoginPage from "../../features/auth/pages/AuthPage/LoginPage/LoginPage";
import SignUpPage from "../../features/auth/pages/AuthPage/SignUpPage/SignUpPage";
import SignUpSuccessPage from "../../features/auth/pages/AuthPage/SignUpPage/SignUpSuccessPage";

import AdminDashboardPage from "../../features/admin/pages/AdminDashboardPage";
import AdminUserManagementPage from "../../features/admin/pages/AdminUserManagementPage";
import { useAuth } from "../../features/auth/hooks/useAuth";

import FindIdPage from "../../features/auth/pages/AuthPage/FindIdPage/FindIdPage";
import FindIdResultFailPage from "../../features/auth/pages/AuthPage/FindIdPage/FindIdResultFailPage";
import FindIdResultSuccessPage from "../../features/auth/pages/AuthPage/FindIdPage/FindIdResultSuccessPage";

import FindPasswordPage from "../../features/auth/pages/AuthPage/FindPasswordPage/FindPasswordPage";
import FindPasswordResultFailPage from "../../features/auth/pages/AuthPage/FindPasswordPage/FindPasswordResultFailPage";
import FindPasswordResultSuccessPage from "../../features/auth/pages/AuthPage/FindPasswordPage/FindPasswordResultSuccessPage";

// ✅ 추가
import ChangePasswordPage from "../../features/auth/pages/AuthPage/ChangePasswordPage/ChangePasswordPage";

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
