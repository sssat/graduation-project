// frontend/src/layouts/AppLayout.tsx
import { Outlet } from "react-router-dom";
import Header from "../../shared/components/layout/Header";
import Footer from "../../shared/components/layout/Footer";
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
