// frontend/src/router/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import HomePage from "../pages/HomePage";
import KeywordDetailPage from "../pages/KeywordDetailPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />

        {/* params 방식: /keywords/쿠팡 */}
        <Route path="keywords/:keyword" element={<KeywordDetailPage />} />
        {/* query 방식도 허용: /keywords?keyword=쿠팡 or /keywords?q=쿠팡 */}
        <Route path="keywords" element={<KeywordDetailPage />} />

        <Route path="media" element={<Navigate to="/" replace />} />
        <Route path="inquiries" element={<Navigate to="/" replace />} />

        <Route path="auth/login" element={<Navigate to="/" replace />} />
        <Route path="auth/signup" element={<Navigate to="/" replace />} />

        <Route path="admin" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
