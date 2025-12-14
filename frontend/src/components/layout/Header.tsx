// frontend/src/components/layout/Header.tsx

import { Link, NavLink, type NavLinkRenderProps } from "react-router-dom";
import styles from "./Header.module.css";
import logo from "../../assets/logo.png";

export default function Header() {
  const linkClass = (navData: NavLinkRenderProps) =>
    navData.isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;

  return (
    <header className={styles.siteHeader}>
      <div className={styles.headerInner}>
        <Link to="/" className={styles.logoArea} aria-label="Newsight 홈으로">
          <img src={logo} alt="Newsight 로고" className={styles.logoImage} />
        </Link>

        <nav className={styles.mainNav} aria-label="메인 메뉴">
          <NavLink to="/" end className={linkClass}>
            메인
          </NavLink>

          <NavLink to="/media" className={linkClass}>
            언론사 비교
          </NavLink>

          <NavLink to="/inquiries" className={linkClass}>
            문의하기
          </NavLink>

          <div className={styles.authGroup}>
            <NavLink to="/auth/login" className={linkClass}>
              로그인
            </NavLink>
            <span className={styles.authSeparator} aria-hidden="true">
              |
            </span>
            <NavLink to="/auth/signup" className={linkClass}>
              회원가입
            </NavLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
