// frontend/src/mocks/userMockData.ts

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export type Gender = "M" | "F";

export type UserItem = {
  userSeq: number;
  name: string;
  userId: string;
  role: UserRole;
  email: string;
  birthDate: string; // "YYYY-MM-DD"
  gender: Gender;
  lastLoginAt: string; // "YYYY-MM-DD HH:mm" or "—"
  grantedAt: string; // ADMIN 등급 부여일시 (없으면 "—")
  passwordChangedAt: string; // 비밀번호 변경일시 (없으면 "—")
  joinedAt: string; // 최초가입일시
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatYYYYMMDDHHmm(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function daysAgoLabel(daysAgo: number, hh = 9, mi = 20) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mi, 0, 0);
  return formatYYYYMMDDHHmm(d);
}

function defaultBirthDateBySeq(userSeq: number) {
  // 목업용: userSeq로부터 일관된 생년월일 생성 (랜덤이지만 재현 가능)
  const year = 1988 + (userSeq % 12); // 1988~1999
  const month = (userSeq % 12) + 1; // 1~12
  const day = ((userSeq * 7) % 28) + 1; // 1~28
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function makeUser(
  userSeq: number,
  name: string,
  userId: string,
  role: UserRole,
  email: string,
  gender: Gender,
  opts?: Partial<
    Pick<UserItem, "lastLoginAt" | "grantedAt" | "passwordChangedAt" | "joinedAt" | "birthDate">
  >
): UserItem {
  return {
    userSeq,
    name,
    userId,
    role,
    email,
    birthDate: opts?.birthDate ?? defaultBirthDateBySeq(userSeq),
    gender,
    lastLoginAt: opts?.lastLoginAt ?? "—",
    grantedAt: opts?.grantedAt ?? "—",
    passwordChangedAt: opts?.passwordChangedAt ?? "—",
    joinedAt: opts?.joinedAt ?? daysAgoLabel(90, 10, 10),
  };
}

/**
 * 퍼블리싱 단계 목업: 회원 데이터 리스트
 * - 총 29명 샘플
 * - 규칙: userSeq가 낮을수록 joinedAt(최초가입일시)이 더 과거(빠름)
 * - SUPER_ADMIN은 승급/강등 불가, 삭제 불가(UI에서 처리)
 */
export function getAllUsers(): UserItem[] {
  // userSeq 낮을수록 오래된 가입(큰 daysAgo), userSeq 높을수록 최근 가입(작은 daysAgo)
  const base: UserItem[] = [
    makeUser(1, "슈퍼관리자", "super_admin", "SUPER_ADMIN", "superadmin@newsight.io", "M", {
      joinedAt: daysAgoLabel(360, 9, 10),
      lastLoginAt: daysAgoLabel(0, 16, 40),
      passwordChangedAt: daysAgoLabel(30, 14, 10),
      grantedAt: daysAgoLabel(360, 9, 10),
      birthDate: "1990-01-10",
    }),
    makeUser(50, "관리자", "admin_master", "ADMIN", "admin@newsight.io", "F", {
      joinedAt: daysAgoLabel(240, 10, 10),
      lastLoginAt: daysAgoLabel(1, 11, 35),
      grantedAt: daysAgoLabel(120, 9, 0),
      passwordChangedAt: daysAgoLabel(45, 10, 5),
      birthDate: "1992-07-18",
    }),
    makeUser(120, "이호균", "newsight_user_me", "USER", "me@example.com", "M", {
      joinedAt: daysAgoLabel(140, 13, 15),
      lastLoginAt: daysAgoLabel(0, 17, 5),
      passwordChangedAt: daysAgoLabel(20, 9, 30),
      birthDate: "1999-03-21",
    }),
  ];

  const names = [
    "김민준",
    "이서연",
    "박지훈",
    "최유진",
    "정현우",
    "한지민",
    "오세훈",
    "장하늘",
    "윤지호",
    "서지우",
    "홍서준",
    "강다은",
    "조유나",
    "임도윤",
    "신예린",
    "배시우",
    "문하준",
    "유지안",
    "송건우",
    "남지민",
    "류서아",
    "백도현",
    "노하린",
    "심지후",
    "성유빈",
    "권서윤",
  ];

  const extra: UserItem[] = names.map((n, i) => {
    const idx = i + 1;
    const userSeq = 200 + idx; // 201~226 (base(1/50/120)보다 큼 -> 더 최근 가입)

    // ADMIN 섞기
    const isAdmin = idx % 4 === 0; // 6명 ADMIN
    const role: UserRole = isAdmin ? "ADMIN" : "USER";

    const userId = isAdmin ? `admin_${idx}` : `user_${idx}`;
    const email = `${userId}@example.com`;
    const gender: Gender = idx % 2 === 0 ? "F" : "M";

    // 핵심 규칙: userSeq 낮을수록 오래된 가입(큰 daysAgo)
    // idx 1(userSeq 201)은 더 오래된 가입, idx 26(userSeq 226)은 더 최근 가입
    const joinedDaysAgo = 10 + (names.length - idx) * 2; // 60..10
    const joinedAt = daysAgoLabel(joinedDaysAgo, 10, 10);

    const lastLoginAt = idx % 4 === 1 ? "—" : daysAgoLabel(idx % 15, 8 + (idx % 10), 10 + (idx % 40));
    const passwordChangedAt = idx % 5 === 0 ? "—" : daysAgoLabel(5 + (idx % 40), 12, 0);
    const grantedAt = role === "ADMIN" ? daysAgoLabel(20 + (idx % 60), 9, 0) : "—";

    const birthYear = 1989 + (idx % 10); // 1989~1998
    const birthMonth = (idx % 12) + 1;
    const birthDay = ((idx * 3) % 28) + 1;
    const birthDate = `${birthYear}-${pad2(birthMonth)}-${pad2(birthDay)}`;

    return makeUser(userSeq, n, userId, role, email, gender, {
      joinedAt,
      lastLoginAt,
      passwordChangedAt,
      grantedAt,
      birthDate,
    });
  });

  return [...base, ...extra];
}
