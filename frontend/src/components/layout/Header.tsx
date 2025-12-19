// frontend/src/components/layout/Header.tsx

import { Link, NavLink, type NavLinkRenderProps, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Header.module.css";
import logo from "../../assets/logo.png";
import { useAuth } from "../../hooks/useAuth";

function AdminShieldIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2.5c3.2 2.2 6.3 3 8.8 3.5v7.1c0 5.4-3.6 9.1-8.8 10.9C6.8 22.2 3.2 18.5 3.2 13.1V6c2.5-.5 5.6-1.3 8.8-3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 12.2l2.6 2.6 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

  const isAdminLike = auth.role === "ADMIN" || auth.role === "SUPER_ADMIN";
  const isSuperAdmin = auth.role === "SUPER_ADMIN";
  const adminLabel = isSuperAdmin ? "SUPER ADMIN" : "ADMIN";

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
                  <span className={styles.userNameWrap}>
                    {isAdminLike ? (
                      <span className={isSuperAdmin ? `${styles.adminBadge} ${styles.superBadge}` : styles.adminBadge}>
                        <AdminShieldIcon className={styles.adminShield} />
                        <span className={styles.adminBadgeText}>{adminLabel}</span>
                      </span>
                    ) : null}

                    <span className={styles.userNameText}>{displayName}님</span>
                  </span>

                  <span className={menuOpen ? styles.caretUp : styles.caretDown} aria-hidden="true" />
                </button>

                {menuOpen ? (
                  <div className={styles.dropdown} role="menu">
                    {isAdminLike ? (
                      <>
                        {isSuperAdmin ? (
                          <NavLink
                            to="/admin/users"
                            className={styles.dropdownItem}
                            role="menuitem"
                            onClick={closeMenu}
                          >
                            회원 관리
                          </NavLink>
                        ) : null}

                        {isSuperAdmin ? <div className={styles.dropdownDivider} /> : null}

                        <NavLink
                          to="/admin"
                          className={styles.dropdownItem}
                          role="menuitem"
                          onClick={closeMenu}
                        >
                          관리자 페이지
                        </NavLink>

                        <div className={styles.dropdownDivider} />
                      </>
                    ) : null}

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
