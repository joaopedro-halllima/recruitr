"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  searchSchools,
  searchTags,
  searchTeams,
  searchUsers,
  type NotificationItem,
} from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { getNotificationHref } from "@/lib/notification-links";
import { getProfileHref } from "@/lib/profile-routes";
import ThemeToggle from "@/components/theme/ThemeToggle";

type TopNavProps = {
  userEmail: string;
  onLogout: () => void;
  unreadCount?: number;
};

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.08V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1-.24 1.7 1.7 0 0 0-.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.08-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8a1.7 1.7 0 0 0-.24-1 1.7 1.7 0 0 0-.34-.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8 4.6a1.7 1.7 0 0 0 1-.6A1.7 1.7 0 0 0 9.4 2.9V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1 .24 1.7 1.7 0 0 0 .87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.08.4H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-cyan-100/55" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

const iconButtonClass =
  "relative grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/20 bg-[#111c31]/85 text-cyan-100 transition hover:border-cyan-300/35 hover:bg-[#1a2744]";

const profileButtonClass =
  "relative grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-cyan-300/30 bg-[#111c31]/92 text-cyan-100 transition hover:border-cyan-300/45 hover:bg-[#1a2744] shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_8px_24px_rgba(8,145,178,0.18)]";

function notificationTime(iso: string) {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

function openUserResult(
  router: ReturnType<typeof useRouter>,
  user: { userId?: number; role: string; name: string },
  fallback: (q: string) => void
) {
  const stored = getStoredUser();
  const href = getProfileHref(user, stored?.id ?? null);
  if (href) {
    router.push(href);
    return;
  }

  fallback(user.name);
}

function deriveUserNameFromStored(userEmail: string) {
  const stored = getStoredUser();
  const athleteFirst = (stored?.athlete_profile?.first_name || "").trim();
  const athleteLast = (stored?.athlete_profile?.last_name || "").trim();
  const coachFirst = (stored?.coach_profile?.first_name || "").trim();
  const coachLast = (stored?.coach_profile?.last_name || "").trim();

  const athleteName = [athleteFirst, athleteLast].filter(Boolean).join(" ").trim();
  if (athleteName) return athleteName;

  const coachName = [coachFirst, coachLast].filter(Boolean).join(" ").trim();
  if (coachName) return coachName;

  return userEmail.split("@")[0] || userEmail;
}

function schoolLogoSrc(logoUrl?: string | null, webaddr?: string | null) {
  const explicit = (logoUrl || "").trim();
  if (explicit) return explicit;
  const raw = (webaddr || "").trim();
  if (!raw) return null;
  const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  try {
    const url = new URL(normalized);
    const domain = url.hostname.replace(/^www\./, "").trim();
    if (!domain) return null;
    return `https://logo.clearbit.com/${domain}`;
  } catch {
    return null;
  }
}

function schoolLogoCandidates(logoUrl?: string | null, webaddr?: string | null): string[] {
  const candidates: string[] = [];
  const explicit = (logoUrl || "").trim();
  if (explicit) candidates.push(explicit);

  const raw = (webaddr || "").trim();
  if (!raw) return candidates;
  const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  try {
    const url = new URL(normalized);
    const domain = url.hostname.replace(/^www\./, "").trim();
    if (!domain) return candidates;

    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`);
    candidates.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);
    candidates.push(`https://${domain}/favicon.ico`);

    const clearbit = schoolLogoSrc(null, webaddr);
    if (clearbit) candidates.push(clearbit);
  } catch {
    // ignore invalid URLs
  }

  return [...new Set(candidates)];
}

function SchoolSuggestionBadge({
  name,
  logoUrl,
  webaddr,
}: {
  name: string;
  logoUrl?: string | null;
  webaddr?: string | null;
}) {
  const sources = schoolLogoCandidates(logoUrl, webaddr);
  const [sourceIdx, setSourceIdx] = useState(0);
  const src = sources[sourceIdx] ?? null;

  if (!src) {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-[#10284a] text-[10px] font-semibold text-cyan-100">
        {initials(name || "School")}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      onError={() => setSourceIdx((idx) => idx + 1)}
      className="h-7 w-7 shrink-0 rounded-md border border-cyan-300/25 bg-[#10284a] object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export default function TopNav({ userEmail, onLogout, unreadCount = 0 }: TopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";

  const [qInput, setQInput] = useState(qFromUrl);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationsMarkingAll, setNotificationsMarkingAll] = useState(false);
  const [localUnreadCount, setLocalUnreadCount] = useState(unreadCount);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileInitials, setProfileInitials] = useState(() =>
    initials(userEmail.split("@")[0] || "User")
  );
  const [profileAvatarSrc, setProfileAvatarSrc] = useState<string | null>(null);

  const [userSuggestions, setUserSuggestions] = useState<Array<{ userId?: number; name: string; role: string; meta: string; email?: string }>>([]);
  const [schoolSuggestions, setSchoolSuggestions] = useState<Array<{ unitid?: string; name: string; state?: string | null; logoUrl?: string | null; webaddr?: string | null }>>([]);
  const [teamSuggestions, setTeamSuggestions] = useState<Array<{ name: string; school_name?: string; school_unitid?: string }>>([]);
  const [tagSuggestions, setTagSuggestions] = useState<Array<{ slug: string; tag: string; post_count: number }>>([]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const lastFetchIdRef = useRef(0);

  useEffect(() => {
    setLocalUnreadCount(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    setQInput(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    function refreshProfileBadge() {
      const stored = getStoredUser();
      const derivedName = deriveUserNameFromStored(userEmail);
      setProfileInitials(initials(derivedName));

      if (typeof window === "undefined" || !stored?.id) {
        setProfileAvatarSrc(null);
        return;
      }
      const avatarUrl =
        stored?.coach_profile?.avatar_url?.trim() ||
        stored?.athlete_profile?.avatar_url?.trim() ||
        null;
      setProfileAvatarSrc(avatarUrl || null);
    }

    refreshProfileBadge();
    window.addEventListener("storage", refreshProfileBadge);
    window.addEventListener("recruitr-profile-avatar-updated", refreshProfileBadge);
    return () => {
      window.removeEventListener("storage", refreshProfileBadge);
      window.removeEventListener("recruitr-profile-avatar-updated", refreshProfileBadge);
    };
  }, [userEmail]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (wrapRef.current && !wrapRef.current.contains(target)) {
        setShowSuggestions(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotificationsMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (pathname !== "/dashboard/explore") return;
    const timeoutId = window.setTimeout(() => {
      const nextQ = qInput.trim();
      const currentQ = qFromUrl.trim();
      if (nextQ === currentQ) return;
      const next = nextQ ? `/dashboard/explore?q=${encodeURIComponent(nextQ)}` : "/dashboard/explore";
      router.replace(next);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [pathname, qInput, qFromUrl, router]);

  useEffect(() => {
    const q = qInput.trim();
    if (q.length < 2) {
      setUserSuggestions([]);
      setSchoolSuggestions([]);
      setTeamSuggestions([]);
      setTagSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const token = getToken();
    if (!token) return;

    const fetchId = ++lastFetchIdRef.current;
    const timeoutId = window.setTimeout(() => {
      setLoadingSuggestions(true);
      void Promise.all([
        searchUsers(token, { q, limit: 5 }),
        searchSchools(token, { q, limit: 5 }),
        searchTeams(token, { q, limit: 5 }),
        searchTags(token, { q, limit: 5 }),
      ])
        .then(([usersRes, schoolsRes, teamsRes, tagsRes]) => {
          if (lastFetchIdRef.current !== fetchId) return;
          setUserSuggestions(
            usersRes.items.map((u) => ({
              userId: u.userId,
              name: u.name,
              role: u.role,
              meta: u.meta || u.email,
              email: u.email,
            }))
          );
          setSchoolSuggestions(
            schoolsRes.items.map((s) => ({
              unitid: s.unitid,
              name: s.name,
              state: s.state ?? null,
              logoUrl: s.logo_url ?? null,
              webaddr: s.website ?? null,
            }))
          );
          setTeamSuggestions(
            teamsRes.items.map((t) => ({
              name: t.name,
              school_name: t.school_name,
              school_unitid: t.school_unitid,
            }))
          );
          setTagSuggestions(
            tagsRes.items.map((t) => ({
              slug: t.slug,
              tag: t.tag,
              post_count: t.post_count,
            }))
          );
        })
        .catch(() => {
          if (lastFetchIdRef.current !== fetchId) return;
          setUserSuggestions([]);
          setSchoolSuggestions([]);
          setTeamSuggestions([]);
          setTagSuggestions([]);
        })
        .finally(() => {
          if (lastFetchIdRef.current === fetchId) {
            setLoadingSuggestions(false);
          }
        });
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [qInput]);

  useEffect(() => {
    if (!showNotificationsMenu) return;
    const token = getToken();
    if (!token) return;

    let active = true;
    setNotificationsLoading(true);
    setNotificationsError(null);

    void getNotifications(token, { limit: 10, offset: 0 })
      .then((res) => {
        if (!active) return;
        const sorted = [...res.items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setRecentNotifications(sorted);
        setLocalUnreadCount(res.unreadCount);
      })
      .catch((e) => {
        if (!active) return;
        setRecentNotifications([]);
        setNotificationsError(e instanceof Error ? e.message : "Failed to load notifications");
      })
      .finally(() => {
        if (active) setNotificationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showNotificationsMenu, unreadCount]);

  async function markAllReadFromDropdown() {
    const token = getToken();
    if (!token || notificationsMarkingAll) return;
    setNotificationsMarkingAll(true);
    setNotificationsError(null);
    try {
      await markAllNotificationsRead(token);
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setLocalUnreadCount(0);
    } catch (e) {
      setNotificationsError(e instanceof Error ? e.message : "Failed to mark all as read");
    } finally {
      setNotificationsMarkingAll(false);
    }
  }

  async function handleNotificationSelect(notification: NotificationItem) {
    const token = getToken();
    if (!notification.isRead && token) {
      setRecentNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
      );
      setLocalUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationRead(token, notification.id);
      } catch {
        // navigation should still proceed
      }
    }
    setShowNotificationsMenu(false);
    router.push(getNotificationHref(notification));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = qInput.trim();
    const next = q ? `/dashboard/explore?q=${encodeURIComponent(q)}` : "/dashboard/explore";
    if (pathname === "/dashboard/explore") {
      router.replace(next);
      return;
    }
    router.push(next);
    setShowSuggestions(false);
  }

  function openExploreWithQuery(nextQ: string) {
    const q = nextQ.trim();
    const next = q ? `/dashboard/explore?q=${encodeURIComponent(q)}` : "/dashboard/explore";
    if (pathname === "/dashboard/explore") router.replace(next);
    else router.push(next);
    setShowSuggestions(false);
  }

  return (
    <header className="app-nav fixed inset-x-0 top-0 z-50 border-b border-cyan-300/15 bg-[#060c18]/90 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,13,24,0.35)_0%,rgba(37,99,235,0.22)_40%,rgba(6,182,212,0.22)_72%,rgba(8,13,24,0.35)_100%)]" />

      <div className="relative w-full px-3 md:px-6">
        <div className="relative flex h-14 items-center gap-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/20 bg-white text-black font-semibold shadow-[0_4px_16px_rgba(255,255,255,0.15)]">
              R
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-semibold text-cyan-50">Recruitr</div>
              <div className="text-xs text-cyan-100/70">Coach Mode</div>
            </div>
          </Link>

          <form
            onSubmit={submitSearch}
            autoComplete="off"
            className="hidden md:absolute md:left-1/2 md:top-1/2 md:block md:w-[min(760px,calc(100vw-560px))] md:-translate-x-1/2 md:-translate-y-1/2"
          >
            <div ref={wrapRef} className="relative w-full max-w-[720px]">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <IconSearch />
              </div>
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                name="global_search_input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="h-10 w-full rounded-xl border border-cyan-300/35 bg-[#10213c]/80 py-2 pl-10 pr-4 text-sm text-cyan-50 placeholder:text-cyan-200/55 shadow-[0_0_0_1px_rgba(6,182,212,0.06),0_8px_30px_rgba(8,145,178,0.14)] focus:outline-none focus:ring-2 focus:ring-cyan-300/35"
                placeholder="Search athletes, schools, teams, tags..."
              />

              {showSuggestions ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[420px] overflow-auto rounded-xl border border-cyan-300/20 bg-[#0e1b33]/95 p-2 shadow-2xl backdrop-blur">
                  {loadingSuggestions ? (
                    <div className="px-2 py-2 text-xs text-cyan-100/70">Searching...</div>
                  ) : (
                    <>
                      {userSuggestions.length === 0 &&
                      schoolSuggestions.length === 0 &&
                      teamSuggestions.length === 0 &&
                      tagSuggestions.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-cyan-100/55">
                          {qInput.trim().length < 2 ? "Type at least 2 characters." : "No matches."}
                        </div>
                      ) : null}

                      {userSuggestions.length > 0 ? (
                        <div className="mb-1">
                          <div className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-cyan-100/50">Users</div>
                          <div className="space-y-1">
                            {userSuggestions.map((u, idx) => (
                              <button
                                key={`${u.userId ?? "nouid"}-${u.email ?? u.name}-${u.role}-${idx}`}
                                type="button"
                                onClick={() => {
                                  openUserResult(router, u, openExploreWithQuery);
                                  setShowSuggestions(false);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-cyan-300/10"
                              >
                                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-[#10284a] text-[10px] font-semibold text-cyan-100">
                                  {initials(u.name || u.email || "User")}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-xs text-cyan-50">{u.name}</div>
                                  <div className="truncate text-[11px] text-cyan-100/60">
                                    {u.role} • {u.meta}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {schoolSuggestions.length > 0 ? (
                        <div className="mb-1">
                          <div className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-cyan-100/50">Schools</div>
                          <div className="space-y-1">
                            {schoolSuggestions.map((s, idx) => (
                              <button
                                key={`${s.unitid ?? s.name}-${idx}`}
                                type="button"
                                onClick={() => {
                                  if (s.unitid) {
                                    router.push(`/schools/${encodeURIComponent(s.unitid)}`);
                                    setShowSuggestions(false);
                                    return;
                                  }
                                  openExploreWithQuery(s.name);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-cyan-300/10"
                              >
                                <SchoolSuggestionBadge
                                  key={`${s.unitid ?? s.name}-${s.logoUrl ?? ""}-${s.webaddr ?? ""}`}
                                  name={s.name || "School"}
                                  logoUrl={s.logoUrl}
                                  webaddr={s.webaddr}
                                />
                                <div className="min-w-0">
                                  <div className="truncate text-xs text-cyan-50">{s.name}</div>
                                  <div className="truncate text-[11px] text-cyan-100/60">{s.state || "School"}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {teamSuggestions.length > 0 ? (
                        <div>
                          <div className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-cyan-100/50">Teams</div>
                          <div className="space-y-1">
                            {teamSuggestions.map((t, idx) => (
                              <button
                                key={`${t.name}-${idx}`}
                                type="button"
                                onClick={() => {
                                  if (t.school_unitid) {
                                    router.push(`/schools/${encodeURIComponent(t.school_unitid)}`);
                                    setShowSuggestions(false);
                                    return;
                                  }
                                  openExploreWithQuery(t.name);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-cyan-300/10"
                              >
                                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-[#10284a] text-[10px] font-semibold text-cyan-100">
                                  {initials(t.name || "Team")}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-xs text-cyan-50">{t.name}</div>
                                  <div className="truncate text-[11px] text-cyan-100/60">{t.school_name || "Team"}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {tagSuggestions.length > 0 ? (
                        <div className="mb-1">
                          <div className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-cyan-100/50">Tags</div>
                          <div className="space-y-1">
                            {tagSuggestions.map((t, idx) => (
                              <button
                                key={`${t.slug}-${idx}`}
                                type="button"
                                onClick={() => openExploreWithQuery(t.tag)}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-cyan-300/10"
                              >
                                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-[#10284a] text-[11px] font-semibold text-cyan-100">
                                  #
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-xs text-cyan-50">{t.tag}</div>
                                  <div className="truncate text-[11px] text-cyan-100/60">
                                    {t.post_count} {t.post_count === 1 ? "post" : "posts"}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/dashboard/settings/safety" className={iconButtonClass} aria-label="Settings" title="Settings">
              <IconSettings />
            </Link>

            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationsMenu((v) => !v)}
                className={iconButtonClass}
                aria-label="Notifications"
                title="Notifications"
              >
                <IconBell />
                {localUnreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-[#f8fdff]">
                    {localUnreadCount > 9 ? "9+" : localUnreadCount}
                  </span>
                ) : null}
              </button>

              {showNotificationsMenu ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-cyan-300/20 bg-[#0f1e36]/95 p-2 shadow-2xl backdrop-blur">
                  <div className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-cyan-100/50">
                    Recent Notifications
                  </div>

                  <div className="max-h-80 space-y-1 overflow-auto">
                    {notificationsLoading ? (
                      <div className="px-2 py-2 text-xs text-cyan-100/70">Loading...</div>
                    ) : null}
                    {notificationsError ? (
                      <div className="px-2 py-2 text-xs text-red-300">{notificationsError}</div>
                    ) : null}
                    {!notificationsLoading && !notificationsError && recentNotifications.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-cyan-100/55">No notifications yet.</div>
                    ) : null}

                    {!notificationsLoading && !notificationsError
                      ? recentNotifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => void handleNotificationSelect(n)}
                            className="block w-full rounded-lg px-2 py-2 text-left hover:bg-cyan-300/10"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-cyan-50">
                                  {n.title || "Notification"}
                                </div>
                                <div className="truncate text-[11px] text-cyan-100/60">
                                  {n.body || n.type}
                                </div>
                              </div>
                              <div className="shrink-0 text-[10px] text-cyan-100/45">
                                {notificationTime(n.createdAt)}
                              </div>
                            </div>
                          </button>
                        ))
                      : null}
                  </div>

                  <div className="mt-2 border-t border-cyan-300/15 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        void markAllReadFromDropdown();
                      }}
                      disabled={notificationsMarkingAll || localUnreadCount === 0}
                      className="block w-full rounded-lg px-2 py-2 text-left text-xs font-medium text-cyan-50 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {notificationsMarkingAll ? "Marking all…" : "Mark all as read"}
                    </button>
                    <Link
                      href="/dashboard/notifications"
                      onClick={() => setShowNotificationsMenu(false)}
                      className="block rounded-lg px-2 py-2 text-xs font-medium text-cyan-50 hover:bg-cyan-300/10"
                    >
                      All Notifications
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <ThemeToggle iconOnly />

            <Link
              href="/dashboard/create-post"
              className="hidden items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-400/85 px-3 py-2 text-sm font-semibold text-[#032437] shadow-[0_8px_24px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300 sm:inline-flex"
            >
              <IconPlus />
              Quick Create
            </Link>

            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu((v) => !v)}
                className={profileButtonClass}
                aria-label="Profile menu"
                title="Profile menu"
              >
                {profileAvatarSrc ? (
                  <img
                    src={profileAvatarSrc}
                    alt="Profile avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-[#10284a] text-sm font-semibold text-cyan-100">
                    {profileInitials}
                  </span>
                )}
              </button>

              {showProfileMenu ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-cyan-300/20 bg-[#0f1e36]/95 p-2 shadow-2xl backdrop-blur">
                  <div className="rounded-lg px-2 py-2 text-[11px] text-cyan-100/60">{userEmail}</div>
                  <Link
                    href="/dashboard/profile"
                    className="block rounded-lg px-2 py-2 text-xs text-cyan-50 hover:bg-cyan-300/10"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    My Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    className="mt-1 block w-full rounded-lg px-2 py-2 text-left text-xs text-cyan-50 hover:bg-cyan-300/10"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <form onSubmit={submitSearch} autoComplete="off" className="mt-2 flex items-center gap-2 md:hidden">
          <div className="relative w-full">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <IconSearch />
            </div>
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              name="global_search_input_mobile"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-10 w-full rounded-xl border border-cyan-300/30 bg-[#10213c]/85 py-2 pl-10 pr-4 text-sm text-cyan-50 placeholder:text-cyan-100/55 focus:outline-none focus:ring-2 focus:ring-cyan-300/35"
              placeholder="Search athletes, schools, teams, tags..."
            />
          </div>
          <Link
            href="/dashboard/create-post"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/85 px-3 text-sm font-semibold text-[#032437]"
          >
            <IconPlus />
          </Link>
        </form>
      </div>
    </header>
  );
}
