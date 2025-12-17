// frontend/src/router/index.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import HomePage from "../pages/HomePage";
import KeywordDetailPage from "../pages/KeywordDetailPage";
import MediaComparePage from "../pages/MediaComparePage";
import InquiryBoardPage from "../pages/InquiryBoardPage";
import InquiryDetailPage from "../pages/InquiryDetailPage";

// ✅ 추가
import LoginPage from "../pages/AuthPage/LoginPage/LoginPage";
import SignUpPage from "../pages/AuthPage/SignUpPage/SignUpPage";
import SignUpSuccessPage from "../pages/AuthPage/SignUpPage/SignUpSuccessPage";

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

        {/* ✅ 여기부터 변경 */}
        <Route path="auth/login" element={<LoginPage />} />
        <Route path="auth/signup" element={<SignUpPage />} />
        <Route path="auth/signup/success" element={<SignUpSuccessPage />} />

        {/* admin은 아직 막아둬도 됨 */}
        <Route path="admin" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
