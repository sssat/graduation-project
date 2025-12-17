// frontend/src/components/layout/Header.tsx

import { Link, NavLink, type NavLinkRenderProps, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Header.module.css";
import logo from "../../assets/logo.png";
import { useAuth } from "../../hooks/useAuth";

export default function Header() {
  const nav = useNavigate();
  const { auth, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const linkClass = (navData: NavLinkRenderProps) =>
    navData.isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;

  const displayName = useMemo(() => {
    return auth.userName?.trim() || auth.userId?.trim() || "내 계정";
  }, [auth.userId, auth.userName]);

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((v) => !v);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) closeMenu();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    nav("/", { replace: true });
  };

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
            {auth.isAuthed ? (
              <div className={styles.userMenu} ref={menuRef}>
                <button
                  type="button"
                  className={styles.userButton}
                  onClick={toggleMenu}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className={styles.userNameText}>{displayName}님</span>
                  <span className={menuOpen ? styles.caretUp : styles.caretDown} aria-hidden="true" />
                </button>

                {menuOpen ? (
                  <div className={styles.dropdown} role="menu">
                    <NavLink
                      to="/auth/change-password"
                      className={styles.dropdownItem}
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      비밀번호 변경
                    </NavLink>

                    <div className={styles.dropdownDivider} />

                    <button
                      type="button"
                      className={styles.dropdownButton}
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      로그아웃
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <NavLink to="/auth/login" className={linkClass}>
                  로그인
                </NavLink>
                <span className={styles.authSeparator} aria-hidden="true">
                  |
                </span>
                <NavLink to="/auth/signup" className={linkClass}>
                  회원가입
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
