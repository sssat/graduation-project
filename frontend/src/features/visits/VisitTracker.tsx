import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { trackVisit } from "../../api/analytics";

const VISITOR_ID_STORAGE_KEY = "newsight.visitorId";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateVisitorId(): string {
  if (!canUseStorage()) return createVisitorId();

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();

    const next = createVisitorId();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return createVisitorId();
  }
}

export default function VisitTracker() {
  const location = useLocation();
  const path = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );

  useEffect(() => {
    const clientVisitorId = getOrCreateVisitorId();
    void trackVisit({
      client_visitor_id: clientVisitorId,
      path,
      referrer: document.referrer || undefined,
      language: navigator.language || undefined,
      client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
      screen_width: window.screen?.width,
      screen_height: window.screen?.height,
    }).catch(() => undefined);
  }, [path]);

  return null;
}
