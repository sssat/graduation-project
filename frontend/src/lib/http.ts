// src/lib/tokenStore.ts
let accessToken: string | null = null;
let userSeq: number | null = null;
let role: "USER" | "ADMIN" | "SUPER_ADMIN" | null = null;
let userId: string | null = null;

export function setSession(next: {
  access: string | null;
  userSeq?: number | null;
  role?: "USER" | "ADMIN" | "SUPER_ADMIN" | null;
  userId?: string | null;
}) {
  accessToken = next.access;
  if (next.userSeq !== undefined) userSeq = next.userSeq;
  if (next.role !== undefined) role = next.role;
  if (next.userId !== undefined) userId = next.userId;
}

export function getAccessToken() {
  return accessToken;
}

export function getSession() {
  return { accessToken, userSeq, role, userId };
}

export function clearSession() {
  accessToken = null;
  userSeq = null;
  role = null;
  userId = null;
}