// frontend/src/router/index.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import HomePage from "../pages/HomePage";
import KeywordDetailPage from "../pages/KeywordDetailPage";
import MediaComparePage from "../pages/MediaComparePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />

        <Route path="keywords/:keyword" element={<KeywordDetailPage />} />
        <Route path="keywords" element={<KeywordDetailPage />} />

        <Route path="media" element={<MediaComparePage />} />
        <Route path="inquiries" element={<Navigate to="/" replace />} />

        <Route path="auth/login" element={<Navigate to="/" replace />} />
        <Route path="auth/signup" element={<Navigate to="/" replace />} />

        <Route path="admin" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
