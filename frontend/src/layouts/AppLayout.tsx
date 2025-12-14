// frontend/src/components/layout/AppLayout.tsx
import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import styles from "./AppLayout.module.css";

export default function AppLayout() {
  return (
    <div className={styles.app}>
      <a className={styles.skipLink} href="#main-content">
        본문으로 바로가기
      </a>

      <Header />

      <main id="main-content" className={styles.main}>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
