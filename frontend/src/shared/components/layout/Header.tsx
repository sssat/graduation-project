// frontend/src/components/layout/Header.tsx

import {
  Link,
  NavLink,
  type NavLinkRenderProps,
  useNavigate,
} from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Header.module.css";
import logo from "../../../assets/logo.png";
import { useAuth } from "../../../features/auth/hooks/useAuth";

type HeaderScrollState = "top" | "visible" | "hidden";
type HeaderScrollDirection = "up" | "down" | null;

const HEADER_TOP_THRESHOLD = 20;
const HEADER_HIDE_THRESHOLD = 132;
const HEADER_LOCK_HIDDEN_THRESHOLD = 180;
const HEADER_REVEAL_THRESHOLD = 72;
const HEADER_HIDE_DISTANCE = 28;
const HEADER_SHOW_DISTANCE = 18;

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

function HamburgerIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Header() {
  const nav = useNavigate();
  const { auth, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const headerRef = useRef<HTMLElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastScrollYRef = useRef(0);
  const scrollStateRef = useRef<HeaderScrollState>("top");
  const scrollDirectionRef = useRef<HeaderScrollDirection>(null);
  const scrollTravelRef = useRef(0);
  const hiddenLockRef = useRef(false);
  const menusOpenRef = useRef(false);

  const linkClass = (navData: NavLinkRenderProps) =>
    navData.isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;

  const mobileLinkClass = (navData: NavLinkRenderProps) =>
    navData.isActive
      ? `${styles.mobileNavLink} ${styles.mobileNavLinkActive}`
      : styles.mobileNavLink;

  const displayName = useMemo(() => {
    return auth.userName?.trim() || auth.userId?.trim() || "내 계정";
  }, [auth.userId, auth.userName]);

  const isAdminLike = auth.role === "ADMIN" || auth.role === "SUPER_ADMIN";
  const isSuperAdmin = auth.role === "SUPER_ADMIN";
  const adminLabel = isSuperAdmin ? "SUPER ADMIN" : "ADMIN";

  const closeDesktopMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const closeAllMenus = useCallback(() => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }, []);

  const toggleDesktopMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMenuOpen(false);
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const setHeaderScrollState = useCallback((nextState: HeaderScrollState) => {
    const headerEl = headerRef.current;
    if (!headerEl || scrollStateRef.current === nextState) return;

    headerEl.dataset.scrollState = nextState;
    scrollStateRef.current = nextState;
  }, []);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;

      const userMenuEl = userMenuRef.current;
      if (userMenuEl && !userMenuEl.contains(target)) {
        closeDesktopMenu();
      }

      const mobileMenuEl = mobileMenuRef.current;
      const mobileButtonEl = mobileMenuButtonRef.current;
      const clickedInsideMobileMenu = mobileMenuEl?.contains(target) ?? false;
      const clickedMobileButton = mobileButtonEl?.contains(target) ?? false;
      if (!clickedInsideMobileMenu && !clickedMobileButton) {
        closeMobileMenu();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAllMenus();
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAllMenus, closeDesktopMenu, closeMobileMenu]);

  useEffect(() => {
    menusOpenRef.current = menuOpen || mobileMenuOpen;

    if (menusOpenRef.current) {
      setHeaderScrollState("visible");
    }
  }, [menuOpen, mobileMenuOpen, setHeaderScrollState]);

  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    let rafId: number | null = null;

    headerEl.dataset.scrollState = "top";
    scrollStateRef.current = "top";
    lastScrollYRef.current = window.scrollY || 0;

    const updateHeaderOnScroll = () => {
      rafId = null;

      const currentScrollY = Math.max(window.scrollY || 0, 0);
      const previousScrollY = lastScrollYRef.current;
      const delta = currentScrollY - previousScrollY;
      const absDelta = Math.abs(delta);

      if (menusOpenRef.current) {
        lastScrollYRef.current = currentScrollY;
        scrollDirectionRef.current = null;
        scrollTravelRef.current = 0;
        hiddenLockRef.current = false;
        setHeaderScrollState("visible");
        return;
      }

      if (currentScrollY <= HEADER_TOP_THRESHOLD) {
        scrollDirectionRef.current = null;
        scrollTravelRef.current = 0;
        hiddenLockRef.current = false;
        setHeaderScrollState("top");
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (currentScrollY >= HEADER_LOCK_HIDDEN_THRESHOLD) {
        scrollDirectionRef.current = null;
        scrollTravelRef.current = 0;
        hiddenLockRef.current = true;
        setHeaderScrollState("hidden");
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (hiddenLockRef.current) {
        if (currentScrollY <= HEADER_REVEAL_THRESHOLD) {
          hiddenLockRef.current = false;
          scrollDirectionRef.current = null;
          scrollTravelRef.current = 0;
          setHeaderScrollState("visible");
        } else {
          setHeaderScrollState("hidden");
        }

        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (currentScrollY <= HEADER_REVEAL_THRESHOLD) {
        scrollDirectionRef.current = null;
        scrollTravelRef.current = 0;
        setHeaderScrollState("visible");
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (absDelta < 2) {
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const nextDirection: HeaderScrollDirection = delta > 0 ? "down" : "up";

      if (scrollDirectionRef.current !== nextDirection) {
        scrollDirectionRef.current = nextDirection;
        scrollTravelRef.current = 0;
      }

      scrollTravelRef.current += absDelta;

      if (
        nextDirection === "down" &&
        currentScrollY >= HEADER_HIDE_THRESHOLD &&
        scrollTravelRef.current >= HEADER_HIDE_DISTANCE
      ) {
        setHeaderScrollState("hidden");
        scrollTravelRef.current = 0;
      } else if (
        nextDirection === "up" &&
        scrollTravelRef.current >= HEADER_SHOW_DISTANCE
      ) {
        setHeaderScrollState("visible");
        scrollTravelRef.current = 0;
      }

      lastScrollYRef.current = currentScrollY;
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateHeaderOnScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      window.removeEventListener("scroll", onScroll);
    };
  }, [setHeaderScrollState]);

  const handleLogout = useCallback(async () => {
    closeAllMenus();
    await logout();
    nav("/", { replace: true });
  }, [closeAllMenus, logout, nav]);

  return (
    <header ref={headerRef} className={styles.siteHeader} data-scroll-state="top">
      <div className={styles.headerInner}>
        <div className={styles.logoArea}>
          <Link
            to="/"
            className={styles.logoLink}
            aria-label="Newsight 홈으로"
            onClick={closeAllMenus}
          >
            <div className={styles.logoBadge}>
              <img src={logo} alt="Newsight 로고" className={styles.logoImage} />
            </div>
          </Link>

          <div className={styles.brandCopy}>
            <span className={styles.brandEyebrow}>NEWS DASHBOARD</span>
            <span className={styles.brandTagline}>데이터로 읽는 오늘의 뉴스 흐름</span>
          </div>
        </div>

        <nav className={styles.mainNav} aria-label="메인 메뉴">
          <NavLink to="/" end className={linkClass} onClick={closeAllMenus}>
            메인
          </NavLink>

          <NavLink to="/media" className={linkClass} onClick={closeAllMenus}>
            언론사 비교
          </NavLink>

          <NavLink to="/inquiries" className={linkClass} onClick={closeAllMenus}>
            문의하기
          </NavLink>

          <div className={styles.authGroup}>
            {auth.isAuthed ? (
              <div className={styles.userMenu} ref={userMenuRef}>
                <button
                  type="button"
                  className={styles.userButton}
                  onClick={toggleDesktopMenu}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className={styles.userNameWrap}>
                    {isAdminLike ? (
                      <span
                        className={
                          isSuperAdmin
                            ? `${styles.adminBadge} ${styles.superBadge}`
                            : styles.adminBadge
                        }
                      >
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
                            onClick={closeDesktopMenu}
                          >
                            회원 관리
                          </NavLink>
                        ) : null}

                        {isSuperAdmin ? <div className={styles.dropdownDivider} /> : null}

                        <NavLink
                          to="/admin"
                          className={styles.dropdownItem}
                          role="menuitem"
                          onClick={closeDesktopMenu}
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
                      onClick={closeDesktopMenu}
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
                <NavLink to="/auth/login" className={linkClass} onClick={closeAllMenus}>
                  로그인
                </NavLink>
                <span className={styles.authSeparator} aria-hidden="true">
                  |
                </span>
                <NavLink to="/auth/signup" className={linkClass} onClick={closeAllMenus}>
                  회원가입
                </NavLink>
              </>
            )}
          </div>
        </nav>

        <button
          ref={mobileMenuButtonRef}
          type="button"
          className={styles.mobileMenuButton}
          aria-label={mobileMenuOpen ? "모바일 메뉴 닫기" : "모바일 메뉴 열기"}
          aria-controls="mobile-navigation"
          aria-expanded={mobileMenuOpen}
          onClick={toggleMobileMenu}
        >
          <HamburgerIcon className={styles.mobileMenuIcon} />
        </button>
      </div>

      {mobileMenuOpen ? (
        <div id="mobile-navigation" className={styles.mobileMenuPanel} ref={mobileMenuRef}>
          <nav className={styles.mobileNav} aria-label="모바일 메인 메뉴">
            <NavLink to="/" end className={mobileLinkClass} onClick={closeMobileMenu}>
              메인
            </NavLink>

            <NavLink to="/media" className={mobileLinkClass} onClick={closeMobileMenu}>
              언론사 비교
            </NavLink>

            <NavLink to="/inquiries" className={mobileLinkClass} onClick={closeMobileMenu}>
              문의하기
            </NavLink>
          </nav>

          <div className={styles.mobileMenuDivider} />

          {auth.isAuthed ? (
            <div className={styles.mobileAccountSection}>
              <div className={styles.mobileAccountSummary}>
                <div className={styles.mobileAccountTitle}>내 계정</div>
                <div className={styles.mobileAccountNameRow}>
                  {isAdminLike ? (
                    <span
                      className={
                        isSuperAdmin
                          ? `${styles.adminBadge} ${styles.superBadge}`
                          : styles.adminBadge
                      }
                    >
                      <AdminShieldIcon className={styles.adminShield} />
                      <span className={styles.adminBadgeText}>{adminLabel}</span>
                    </span>
                  ) : null}
                  <span className={styles.mobileAccountName}>{displayName}님</span>
                </div>
              </div>

              <div className={styles.mobileActionGroup}>
                {isAdminLike ? (
                  <>
                    {isSuperAdmin ? (
                      <NavLink
                        to="/admin/users"
                        className={styles.mobileActionLink}
                        onClick={closeMobileMenu}
                      >
                        회원 관리
                      </NavLink>
                    ) : null}

                    <NavLink to="/admin" className={styles.mobileActionLink} onClick={closeMobileMenu}>
                      관리자 페이지
                    </NavLink>
                  </>
                ) : null}

                <NavLink
                  to="/auth/change-password"
                  className={styles.mobileActionLink}
                  onClick={closeMobileMenu}
                >
                  비밀번호 변경
                </NavLink>

                <button type="button" className={styles.mobileActionButton} onClick={handleLogout}>
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.mobileGuestActions}>
              <NavLink to="/auth/login" className={styles.mobilePrimaryLink} onClick={closeMobileMenu}>
                로그인
              </NavLink>
              <NavLink to="/auth/signup" className={styles.mobileSecondaryLink} onClick={closeMobileMenu}>
                회원가입
              </NavLink>
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}
