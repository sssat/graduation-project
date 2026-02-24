// frontend/src/mocks/loginLogMockData.ts

export type LoginAttemptLogItem = {
  loginLogSeq: number;
  inputId: string;
  attemptedAt: string;
  isSuccess: boolean;
  ipAddress: string;
  userAgent?: string | null;
  userSeq: number | null;
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

export function getAllLoginAttemptLogs(): LoginAttemptLogItem[] {
  const base = new Date("2025-12-19T15:42:00+09:00");

  const uaDesktop =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
  const uaMobile =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const uaCrawler =
    "Mozilla/5.0 (compatible; NSBot/1.0; +https://newsight.example.com/bot) AppleWebKit/537.36";

  const ids = ["admin", "user_ho", "guest_123", "tester01", "newsight_ops"];
  const agents = [uaDesktop, uaMobile, uaCrawler];

  const rows: LoginAttemptLogItem[] = [];
  const total = 29;

  for (let i = 0; i < total; i += 1) {
    const loginLogSeq = 200 - i;
    const d = new Date(base.getTime() - i * 7 * 60 * 1000);

    const inputId = ids[i % ids.length];
    const isSuccess = i % 4 !== 1; // 실패 비율 조금 섞기
    const ipAddress = i % 2 === 0 ? "203.0.113.10" : "198.51.100.24";
    const userAgent = agents[i % agents.length];

    // 성공일 때만 회원일련번호를 부여, 실패면 null
    const userSeq = isSuccess ? (inputId === "admin" ? 1 : 40 + (i % 7)) : null;

    rows.push({
      loginLogSeq,
      inputId,
      attemptedAt: formatYYYYMMDDHHmm(d),
      isSuccess,
      ipAddress,
      userAgent,
      userSeq,
    });
  }

  return rows;
}