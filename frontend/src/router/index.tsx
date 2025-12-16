// frontend/src/router/index.tsx
// (상세 라우트 추가 + import 추가)

import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import HomePage from "../pages/HomePage";
import KeywordDetailPage from "../pages/KeywordDetailPage";
import MediaComparePage from "../pages/MediaComparePage";
import InquiryBoardPage from "../pages/InquiryBoardPage";
import InquiryDetailPage from "../pages/InquiryDetailPage";

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

        <Route path="auth/login" element={<Navigate to="/" replace />} />
        <Route path="auth/signup" element={<Navigate to="/" replace />} />

        <Route path="admin" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
