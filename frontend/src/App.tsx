// frontend/src/App.tsx
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./router";
import AuthProvider from "./contexts/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
