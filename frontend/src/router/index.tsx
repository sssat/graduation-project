// frontend/src/router/index.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import HomePage from "../pages/HomePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />

        {/* 아직 페이지 없으면 임시로 홈으로 리다이렉트 */}
        <Route path="media" element={<Navigate to="/" replace />} />
        <Route path="inquiries" element={<Navigate to="/" replace />} />

        {/* 로그인/회원가입을 분리해서 받을 준비 */}
        <Route path="auth/login" element={<Navigate to="/" replace />} />
        <Route path="auth/signup" element={<Navigate to="/" replace />} />

        <Route path="admin" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
