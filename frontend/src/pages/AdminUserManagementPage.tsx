// frontend/src/pages/AdminUserManagementPage.tsx

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import styles from "./AdminUserManagementPage.module.css";
import {
  demoteAdmin,
  listUsers,
  promoteAdmin,
  withdrawUser,
  type UserListItem,
} from "../api/accounts";
import { getErrorMessage } from "../api/types";

const PAGE_SIZE = 10;

type AdminUiRole = "USER" | "ADMIN" | "SUPER_ADMIN";
type Gender = "M" | "F" | null;

type AdminUserRow = {
  userSeq: number;
  userId: string;
  name: string;
  role: AdminUiRole;
  gradeCode: number;
  gradeName: string;
  email: string;
  birthDate: string;
  gender: Gender;
  lastLoginAt: string;
  joinedAt: string;
  grantedAt: string;
  passwordChangedAt: string;
};

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

function formatIsoDateTimeForTable(input?: string | null) {
  if (!input || typeof input !== "string") return "—";
  const s = input.trim();
  if (!s) return "—";

  // 이미 화면 포맷이면 그대로 사용
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(s)) return s;

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;

  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(
    dt.getHours(),
  )}:${pad2(dt.getMinutes())}`;
}

function normalizeRoleFromApi(item: UserListItem): AdminUiRole {
  const gradeNameUpper = String(item.grade_name ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  // grade_name이 내려오면 이름을 우선 신뢰하고, 없거나 불명확할 때만 grade_code로 보정한다.
  // 현재 시스템(DB 기준): 0=USER, 1=ADMIN, 2=SUPER_ADMIN
  if (gradeNameUpper.includes("SUPER")) return "SUPER_ADMIN";
  if (gradeNameUpper === "ADMIN" || gradeNameUpper.includes("관리자")) return "ADMIN";
  if (gradeNameUpper === "USER" || gradeNameUpper.includes("회원")) return "USER";

  if (item.grade_code === 2) return "SUPER_ADMIN";
  if (item.grade_code === 1) return "ADMIN";
  return "USER";
}

function roleLabel(r: AdminUiRole) {
  if (r === "SUPER_ADMIN") return "SUPER ADMIN";
  return r;
}

function genderLabel(g: Gender) {
  if (g === "M") return "남";
  if (g === "F") return "여";
  return "—";
}

function getOptionalStringField<T extends object>(obj: T, key: string): string | null {
  const value = (obj as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getOptionalGenderField<T extends object>(obj: T, key: string): Gender {
  const value = (obj as Record<string, unknown>)[key];
  if (value === "M" || value === "F") return value;
  return null;
}

function mapUserListItemToRow(item: UserListItem): AdminUserRow {
  // 현재 /api/admins/users DTO는 최소 필드만 내려주므로, 없는 필드는 "—"로 표시한다.
  // 추후 백엔드가 필드를 확장하면 자동으로 매핑되도록 런타임 키도 함께 확인한다.
  const email = getOptionalStringField(item, "email") ?? "—";
  const birthDate = getOptionalStringField(item, "birth_date") ?? "—";
  const lastLoginAt = formatIsoDateTimeForTable(getOptionalStringField(item, "last_login_at"));
  const joinedAt = formatIsoDateTimeForTable(getOptionalStringField(item, "joined_at"));
  const grantedAt = formatIsoDateTimeForTable(getOptionalStringField(item, "granted_at"));
  const passwordChangedAt = formatIsoDateTimeForTable(getOptionalStringField(item, "password_changed_at"));

  return {
    userSeq: item.user_seq,
    userId: item.user_id,
    name: item.user_name,
    role: normalizeRoleFromApi(item),
    gradeCode: item.grade_code,
    gradeName: item.grade_name,
    email,
    birthDate,
    gender: getOptionalGenderField(item, "gender"),
    lastLoginAt,
    joinedAt,
    grantedAt,
    passwordChangedAt,
  };
}

async function fetchAllUsersByQuery(q: string): Promise<AdminUserRow[]> {
  const trimmedQ = q.trim();
  const size = 200;

  const first = await listUsers({ page: 1, size, q: trimmedQ || undefined });
  const totalPages = Math.max(1, Number(first.total_pages ?? 1));
  const allItems: UserListItem[] = [...(first.items ?? [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listUsers({ page, size, q: trimmedQ || undefined });
    allItems.push(...(next.items ?? []));
  }

  const rows = allItems.map(mapUserListItemToRow);

  rows.sort((a, b) => {
    // 가입일이 있으면 가입일 우선, 없으면 userSeq 내림차순
    const aJoined = a.joinedAt === "—" ? 0 : new Date(a.joinedAt.replace(" ", "T")).getTime() || 0;
    const bJoined = b.joinedAt === "—" ? 0 : new Date(b.joinedAt.replace(" ", "T")).getTime() || 0;
    if (bJoined !== aJoined) return bJoined - aJoined;
    return b.userSeq - a.userSeq;
  });

  return rows;
}

export default function AdminUserManagementPage() {
  const [allUsers, setAllUsers] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  const [roleFilter, setRoleFilter] = useState<AdminUiRole | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actingUserSeq, setActingUserSeq] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const rows = await fetchAllUsersByQuery(submittedQ);
        if (cancelled) return;
        setAllUsers(rows);
      } catch (error) {
        if (cancelled) return;
        setAllUsers([]);
        setErrorMessage(getErrorMessage(error, "회원 목록을 불러오지 못했습니다."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [submittedQ, searchVersion]);

  const filtered = useMemo(() => {
    return allUsers.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      return true;
    });
  }, [allUsers, roleFilter]);

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

  async function onToggleRole(u: AdminUserRow) {
    if (u.role === "SUPER_ADMIN") return;
    if (actingUserSeq != null) return;

    try {
      setActingUserSeq(u.userSeq);

      if (u.role === "USER") {
        const ok = window.confirm(`"${u.userId}" 사용자를 ADMIN으로 승급하시겠습니까?`);
        if (!ok) return;

        const res = await promoteAdmin({ user_seq: u.userSeq });
        const grantedAt = formatIsoDateTimeForTable(res.granted_at) || formatNowYYYYMMDDHHmm();

        setAllUsers((prev) =>
          prev.map((row) =>
            row.userSeq === u.userSeq
              ? {
                  ...row,
                  role: "ADMIN",
                  gradeCode: 1,
                  gradeName: "ADMIN",
                  grantedAt: grantedAt === "—" ? formatNowYYYYMMDDHHmm() : grantedAt,
                }
              : row,
          ),
        );

        if (res.message) window.alert(res.message);
        return;
      }

      if (u.role === "ADMIN") {
        const ok = window.confirm(`"${u.userId}" 사용자를 USER로 강등하시겠습니까?`);
        if (!ok) return;

        const res = await demoteAdmin({ user_seq: u.userSeq });

        setAllUsers((prev) =>
          prev.map((row) =>
            row.userSeq === u.userSeq
              ? {
                  ...row,
                  role: "USER",
                  gradeCode: 0,
                  gradeName: "USER",
                  grantedAt: "—",
                }
              : row,
          ),
        );

        if (res.message) window.alert(res.message);
      }
    } catch (error) {
      window.alert(getErrorMessage(error, "권한 변경 중 오류가 발생했습니다."));
    } finally {
      setActingUserSeq(null);
    }
  }

  async function onDeleteUser(u: AdminUserRow) {
    if (u.role === "SUPER_ADMIN") return;
    if (actingUserSeq != null) return;

    const ok = window.confirm(
      `"${u.userId}" 회원을 탈퇴 처리(삭제)하시겠습니까?\n\n이 작업은 실제 accounts API를 호출합니다.`,
    );
    if (!ok) return;

    try {
      setActingUserSeq(u.userSeq);
      await withdrawUser({ user_seq: u.userSeq });
      setAllUsers((prev) => prev.filter((row) => row.userSeq !== u.userSeq));
      window.alert("회원 탈퇴 처리가 완료되었습니다.");
    } catch (error) {
      window.alert(getErrorMessage(error, "회원 탈퇴 처리 중 오류가 발생했습니다."));
    } finally {
      setActingUserSeq(null);
    }
  }

  function onQueryChange(v: string) {
    setSearchInput(v);
  }

  function onSubmitSearch(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setPage(1);
    setSubmittedQ(searchInput.trim());
    setSearchVersion((prev) => prev + 1);
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
            회원 기본 정보와 등급을 확인하고 ADMIN 승급·강등 및 회원 탈퇴(삭제)를 관리합니다.
          </p>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>회원 목록</div>
          <div className={styles.cardMeta}>
            전체 <strong>{filtered.length}</strong>명
            <br />
            검색어: <strong>{submittedQ || "전체"}</strong>
          </div>
        </div>

        <div className={styles.controls}>
          <form className={styles.searchForm} onSubmit={onSubmitSearch}>
            <div className={styles.searchBox}>
              <label className={styles.ctrlLabel} htmlFor="user-search">
                검색
              </label>
              <input
                id="user-search"
                className={styles.input}
                placeholder="이름 / 아이디 검색"
                value={searchInput}
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </div>

            <div className={styles.searchActionBox}>
              <span className={styles.ctrlLabel}>&nbsp;</span>
              <button
                type="submit"
                className={styles.searchButton}
                disabled={isLoading || actingUserSeq != null}
              >
                {isLoading ? "조회 중..." : "검색"}
              </button>
            </div>
          </form>

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

        {errorMessage ? (
          <div className={styles.cardMeta} style={{ marginBottom: 10, color: "#fca5a5", textAlign: "left" }}>
            {errorMessage}
          </div>
        ) : null}

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
                const no = filtered.length - (pageSafe - 1) * PAGE_SIZE - idx;
                const isSuper = u.role === "SUPER_ADMIN";
                const isActingThisRow = actingUserSeq === u.userSeq;

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
                        onClick={() => void onToggleRole(u)}
                        disabled={isSuper || actingUserSeq != null}
                        title={isSuper ? "SUPER ADMIN은 수정할 수 없습니다." : "승급/강등"}
                      >
                        {isActingThisRow ? "처리 중..." : actionLabel}
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={`${styles.btnTable} ${styles.btnDanger}`}
                        onClick={() => void onDeleteUser(u)}
                        disabled={isSuper || actingUserSeq != null}
                        title={isSuper ? "SUPER ADMIN은 삭제할 수 없습니다." : "회원 탈퇴(삭제)"}
                      >
                        {isActingThisRow ? "처리 중..." : "회원 탈퇴"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className={styles.emptyRow}>
                    {isLoading ? "회원 목록을 불러오는 중입니다..." : "표시할 회원이 없습니다."}
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
