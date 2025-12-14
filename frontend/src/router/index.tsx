// frontend/src/router/index.tsx

import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";

function TempHome() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>임시 홈</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        HomePage.tsx 아직 없음. 라우터/레이아웃 연결 확인용 화면.
      </p>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TempHome />} />

        <Route path="/media" element={<Navigate to="/" replace />} />
        <Route path="/inquiries" element={<Navigate to="/" replace />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
