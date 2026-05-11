"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { trackPageView } from "@/lib/api";
import { getToken } from "@/lib/auth";

const VISITOR_ID_KEY = "recruitr_visitor_id";
const PAGEVIEW_SESSION_PREFIX = "recruitr_pageview_seen:";
const PAGEVIEW_DEDUPE_MS = 15_000;

function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;

    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() ?? "";

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    const path = queryString ? `${pathname}?${queryString}` : pathname;

    try {
      const sessionKey = `${PAGEVIEW_SESSION_PREFIX}${path}`;
      const lastSeenRaw = window.sessionStorage.getItem(sessionKey);
      const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : 0;
      if (lastSeen && Date.now() - lastSeen < PAGEVIEW_DEDUPE_MS) {
        return;
      }
      window.sessionStorage.setItem(sessionKey, String(Date.now()));
    } catch {
      // ignore session storage issues
    }

    void trackPageView(
      {
        path,
        visitorId: getOrCreateVisitorId(),
        referrer: document.referrer || undefined,
        title: document.title || undefined,
      },
      getToken() ?? undefined
    ).catch(() => {
      // pageview tracking should never interrupt navigation
    });
  }, [pathname, queryString]);

  return null;
}
