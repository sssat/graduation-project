// frontend/src/App.tsx
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./router";
import AuthProvider from "../features/auth/context/AuthProvider";
import VisitTracker from "../features/visits/VisitTracker";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <VisitTracker />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
