// frontend/src/pages/AdminUserManagementPage.tsx

import { useMemo, useState } from "react";
import styles from "./AdminUserManagementPage.module.css";
import { getAllUsers, type UserItem, type UserRole, type Gender } from "../mocks/userMockData";

const PAGE_SIZE = 10;

// 로컬스토리지(목업) 상태 저장 키 (승급/강등/삭제 반영)
const ADMIN_USERS_STORE_KEY = "NS_ADMIN_USERS_STORE_V1";

type UserOverride = Partial<
  Pick<UserItem, "role" | "grantedAt" | "lastLoginAt" | "passwordChangedAt" | "email" | "name">
>;

type UserStore = {
  overrides: Record<number, UserOverride>;
  deletedSeqs: number[];
};

function readUserStore(): UserStore {
  try {
    const raw = localStorage.getItem(ADMIN_USERS_STORE_KEY);
    if (!raw) return { overrides: {}, deletedSeqs: [] };
    const parsed = JSON.parse(raw) as UserStore;
    if (!parsed || typeof parsed !== "object") return { overrides: {}, deletedSeqs: [] };
    return {
      overrides: parsed.overrides ?? {},
      deletedSeqs: Array.isArray(parsed.deletedSeqs) ? parsed.deletedSeqs : [],
    };
  } catch {
    return { overrides: {}, deletedSeqs: [] };
  }
}

function writeUserStore(next: UserStore) {
  try {
    localStorage.setItem(ADMIN_USERS_STORE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatNowYYYYMMDDHHmm(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function parseYYYYMMDDHHmmToMs(s: string) {
  if (!s || s === "—") return 0;
  const [datePart, timePart] = s.split(" ");
  if (!datePart || !timePart) return 0;

  const [y, m, d] = datePart.split("-").map((x) => Number(x));
  const [hh, mi] = timePart.split(":").map((x) => Number(x));
  if (![y, m, d, hh, mi].every((x) => Number.isFinite(x))) return 0;

  return new Date(y, m - 1, d, hh, mi, 0, 0).getTime();
}

function roleLabel(r: UserRole) {
  if (r === "SUPER_ADMIN") return "SUPER ADMIN";
  return r;
}

function genderLabel(g: Gender) {
  return g === "M" ? "남" : "여";
}

export default function AdminUserManagementPage() {
  const [store, setStore] = useState<UserStore>(() => readUserStore());
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");

  const allUsersMerged = useMemo(() => {
    const base = getAllUsers();
    const deletedSet = new Set(store.deletedSeqs);

    const merged = base
      .filter((u) => !deletedSet.has(u.userSeq))
      .map((u) => {
        const ov = store.overrides[u.userSeq];
        if (!ov) return u;
        return { ...u, ...ov };
      });

    // 가입일 기준: 최근 가입자가 위(내림차순)
    merged.sort((a, b) => {
      const aMs = parseYYYYMMDDHHmmToMs(a.joinedAt);
      const bMs = parseYYYYMMDDHHmmToMs(b.joinedAt);
      if (bMs !== aMs) return bMs - aMs;
      return b.userSeq - a.userSeq;
    });

    return merged;
  }, [store.deletedSeqs, store.overrides]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return allUsersMerged.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!query) return true;

      // 검색 범위: 이름/아이디만
      const hay = [u.name, u.userId].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [allUsersMerged, q, roleFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length]);
  const pageSafe = useMemo(() => Math.min(Math.max(1, page), totalPages), [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  const canPrev = pageSafe > 1;
  const canNext = pageSafe < totalPages;

  const pageButtons = useMemo(() => {
    const maxButtons = 7;
    const half = Math.floor(maxButtons / 2);

    let start = Math.max(1, pageSafe - half);
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    const arr: number[] = [];
    for (let p = start; p <= end; p += 1) arr.push(p);
    return arr;
  }, [pageSafe, totalPages]);

  function persistOverride(userSeq: number, patch: UserOverride) {
    setStore((prev) => {
      const next: UserStore = {
        overrides: { ...prev.overrides, [userSeq]: { ...(prev.overrides[userSeq] ?? {}), ...patch } },
        deletedSeqs: [...prev.deletedSeqs],
      };
      writeUserStore(next);
      return next;
    });
  }

  function persistDelete(userSeq: number) {
    setStore((prev) => {
      const deletedSeqs = prev.deletedSeqs.includes(userSeq) ? prev.deletedSeqs : [userSeq, ...prev.deletedSeqs];
      const overrides = { ...prev.overrides };
      delete overrides[userSeq];
      const next: UserStore = { overrides, deletedSeqs };
      writeUserStore(next);
      return next;
    });
  }

  function onToggleRole(u: UserItem) {
    if (u.role === "SUPER_ADMIN") return;

    const now = formatNowYYYYMMDDHHmm();

    if (u.role === "USER") {
      const ok = window.confirm(`"${u.userId}" 사용자를 ADMIN으로 승급하시겠습니까?`);
      if (!ok) return;

      persistOverride(u.userSeq, {
        role: "ADMIN",
        grantedAt: now,
      });
      return;
    }

    if (u.role === "ADMIN") {
      const ok = window.confirm(`"${u.userId}" 사용자를 USER로 강등하시겠습니까?`);
      if (!ok) return;

      persistOverride(u.userSeq, {
        role: "USER",
        grantedAt: "—",
      });
    }
  }

  function onDeleteUser(u: UserItem) {
    if (u.role === "SUPER_ADMIN") return;

    const ok = window.confirm(
      `"${u.userId}" 회원을 탈퇴 처리(삭제)하시겠습니까?\n\n이 동작은 목업 단계에서는 로컬스토리지에서만 삭제 처리됩니다.`
    );
    if (!ok) return;

    persistDelete(u.userSeq);
  }

  function onQueryChange(v: string) {
    setQ(v);
    setPage(1);
  }

  function onRoleFilterChange(v: string) {
    if (v === "ALL" || v === "USER" || v === "ADMIN" || v === "SUPER_ADMIN") {
      setRoleFilter(v);
      setPage(1);
    }
  }

  return (
    <main className={styles.pageRoot}>
      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroKicker}>User Management</div>
          <h1 className={styles.heroTitle}>회원 관리</h1>
          <p className={styles.heroSub}>
            회원 기본 정보, 접속/보안 관련 시각 정보를 확인하고 ADMIN 승급·강등 및 회원 탈퇴(삭제)를 관리합니다.
          </p>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>회원 목록</div>
          <div className={styles.cardMeta}>
            전체 <strong>{filtered.length}</strong>명
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchBox}>
            <label className={styles.ctrlLabel} htmlFor="user-search">
              검색
            </label>
            <input
              id="user-search"
              className={styles.input}
              placeholder="이름 / 아이디 검색"
              value={q}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>

          <div className={styles.filterBox}>
            <label className={styles.ctrlLabel} htmlFor="role-filter">
              역할
            </label>
            <select
              id="role-filter"
              className={styles.select}
              value={roleFilter}
              onChange={(e) => onRoleFilterChange(e.target.value)}
            >
              <option value="ALL">전체</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER ADMIN</option>
            </select>
          </div>
        </div>

        <div className={styles.tableScroll} aria-label="회원 목록">
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 70 }}>NO</th>
                <th style={{ width: 120 }}>이름</th>
                <th style={{ width: 140 }}>아이디</th>
                <th style={{ width: 140 }}>역할</th>
                <th style={{ width: 220 }}>이메일</th>
                <th style={{ width: 120 }}>생년월일</th>
                <th style={{ width: 80 }}>성별</th>
                <th style={{ width: 150 }}>최근 로그인 시간</th>
                <th style={{ width: 150 }}>회원가입 날짜</th>
                <th style={{ width: 120 }}>회원일련번호</th>
                <th style={{ width: 160 }}>관리자 등급 부여일시</th>
                <th style={{ width: 160 }}>비밀번호 변경일시</th>
                <th style={{ width: 150 }}>승급/강등</th>
                <th style={{ width: 130 }}>회원탈퇴</th>
              </tr>
            </thead>

            <tbody>
              {pageItems.map((u, idx) => {
                const no = filtered.length - ((pageSafe - 1) * PAGE_SIZE + idx);
                const isSuper = u.role === "SUPER_ADMIN";

                const rolePill =
                  u.role === "SUPER_ADMIN"
                    ? `${styles.rolePill} ${styles.roleSuper}`
                    : u.role === "ADMIN"
                    ? `${styles.rolePill} ${styles.roleAdmin}`
                    : `${styles.rolePill} ${styles.roleUser}`;

                const actionLabel =
                  u.role === "USER" ? "ADMIN 승급" : u.role === "ADMIN" ? "USER 강등" : "수정 불가";

                const actionBtnClass =
                  u.role === "USER"
                    ? `${styles.btnTable} ${styles.btnPromote}`
                    : u.role === "ADMIN"
                    ? `${styles.btnTable} ${styles.btnDemote}`
                    : styles.btnTable;

                return (
                  <tr key={u.userSeq}>
                    <td>{no}</td>
                    <td className={styles.cellStrong}>{u.name}</td>
                    <td>{u.userId}</td>
                    <td>
                      <span className={rolePill}>{roleLabel(u.role)}</span>
                    </td>
                    <td className={styles.cellWrap}>{u.email}</td>
                    <td>{u.birthDate}</td>
                    <td>{genderLabel(u.gender)}</td>
                    <td>{u.lastLoginAt}</td>
                    <td>{u.joinedAt}</td>
                    <td>{u.userSeq}</td>
                    <td>{u.grantedAt}</td>
                    <td>{u.passwordChangedAt}</td>

                    <td>
                      <button
                        type="button"
                        className={actionBtnClass}
                        onClick={() => onToggleRole(u)}
                        disabled={isSuper}
                        title={isSuper ? "SUPER ADMIN은 수정할 수 없습니다." : "승급/강등"}
                      >
                        {actionLabel}
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={`${styles.btnTable} ${styles.btnDanger}`}
                        onClick={() => onDeleteUser(u)}
                        disabled={isSuper}
                        title={isSuper ? "SUPER ADMIN은 삭제할 수 없습니다." : "회원 탈퇴(삭제)"}
                      >
                        회원 탈퇴
                      </button>
                    </td>
                  </tr>
                );
              })}

              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className={styles.emptyRow}>
                    표시할 회원이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination} aria-label="회원 목록 페이지 이동">
          <button
            className={styles.pageBtn}
            type="button"
            onClick={() => canPrev && setPage(1)}
            disabled={!canPrev}
            aria-label="첫 페이지"
          >
            {"<<"}
          </button>

          <button
            className={styles.pageBtn}
            type="button"
            onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            aria-label="이전 페이지"
          >
            {"<"}
          </button>

          {pageButtons.map((p) => (
            <button
              key={p}
              className={`${styles.pageBtn} ${pageSafe === p ? styles.pageActive : ""}`}
              type="button"
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}

          <button
            className={styles.pageBtn}
            type="button"
            onClick={() => canNext && setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
            aria-label="다음 페이지"
          >
            {">"}
          </button>

          <button
            className={styles.pageBtn}
            type="button"
            onClick={() => canNext && setPage(totalPages)}
            disabled={!canNext}
            aria-label="마지막 페이지"
          >
            {">>"}
          </button>
        </div>
      </section>
    </main>
  );
}
