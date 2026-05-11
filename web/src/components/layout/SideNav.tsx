"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getDmThreads, getNotifications } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";

type NavItem = {
  label: string;
  href: string;
  icon: "home" | "profile" | "post" | "explore" | "schools" | "messages" | "notifications" | "saved";
};

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.8-3.3 5.1-5 8-5s6.2 1.7 8 5" />
    </svg>
  );
}

function IconPost() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function IconExplore() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="m15.5 8.5-2.2 5.4-5.4 2.2 2.2-5.4z" />
    </svg>
  );
}

function IconSchool() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3 10 9-6 9 6-9 6-9-6Z" />
      <path d="M7 12v6h10v-6" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
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

function IconSaved() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconForNav({ kind }: { kind: NavItem["icon"] }) {
  switch (kind) {
    case "home":
      return <IconHome />;
    case "profile":
      return <IconUser />;
    case "post":
      return <IconPost />;
    case "explore":
      return <IconExplore />;
    case "schools":
      return <IconSchool />;
    case "messages":
      return <IconMessage />;
    case "notifications":
      return <IconBell />;
    case "saved":
      return <IconSaved />;
    default:
      return <IconHome />;
  }
}

function formatBadgeCount(value: number) {
  if (value <= 0) return null;
  if (value > 99) return "99+";
  return String(value);
}

export default function SideNav() {
  const pathname = usePathname();
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const isCoach = useMemo(() => {
    const roles = getStoredUser()?.roles ?? [];
    return roles.includes("coach");
  }, []);

  const nav: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: "home" },
    { label: "Profile", href: "/dashboard/profile", icon: "profile" },
    { label: "Create Post", href: "/dashboard/create-post", icon: "post" },
    { label: "Explore", href: "/dashboard/explore", icon: "explore" },
    { label: "Schools", href: "/schools", icon: "schools" },
    { label: "Messages", href: "/dashboard/messages", icon: "messages" },
    { label: "Notifications", href: "/dashboard/notifications", icon: "notifications" },
    ...(isCoach ? [{ label: "Shortlist", href: "/dashboard/shortlists", icon: "saved" as const }] : []),
  ];

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const authToken = token;

    let alive = true;

    async function loadCounts() {
      try {
        const [notifRes, dmRes] = await Promise.all([
          getNotifications(authToken, { limit: 1 }),
          getDmThreads(authToken, 80),
        ]);

        if (!alive) return;
        const unreadMessages = (dmRes.items || []).reduce((sum, t) => sum + (t.unreadCount || 0), 0);
        setNotificationCount(notifRes.unreadCount || 0);
        setMessageCount(unreadMessages);
      } catch {
        if (!alive) return;
        setNotificationCount(0);
        setMessageCount(0);
      }
    }

    void loadCounts();
    const intervalId = window.setInterval(() => {
      void loadCounts();
    }, 20000);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const activeIndex = nav.findIndex((item) => pathname === item.href);

  const badges = useMemo(
    () => ({
      "/dashboard/messages": formatBadgeCount(messageCount),
      "/dashboard/notifications": formatBadgeCount(notificationCount),
    }),
    [messageCount, notificationCount]
  );

  return (
    <div
      className="side-nav-shell relative hidden xl:block xl:h-[calc(100vh-3.5rem)] xl:min-h-[690px] xl:w-full"
      onMouseLeave={() => {
        setPanelOpen(false);
        setHoveredHref(null);
      }}
    >
      <div
        className="side-nav-rail relative z-10 h-full w-[72px] overflow-hidden rounded-[28px] border border-cyan-300/20 border-r-cyan-300/25 bg-[linear-gradient(180deg,rgba(9,26,48,0.98),rgba(7,20,38,0.95))] shadow-[0_22px_48px_rgba(2,8,20,0.5)]"
        onMouseEnter={() => setPanelOpen(true)}
      >

        <div className="relative flex h-full flex-col items-center">
          <div className="h-[34px]" />
          <div className="flex flex-col items-center gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              const badge = badges[item.href as keyof typeof badges];
              return (
                <Link
                  key={`rail-${item.label}`}
                  href={item.href}
                  title={item.label}
                  onMouseEnter={() => {
                    setPanelOpen(true);
                    setHoveredHref(item.href);
                  }}
                  onMouseLeave={() => setHoveredHref(null)}
                  onFocus={() => {
                    setPanelOpen(true);
                    setHoveredHref(item.href);
                  }}
                  className={`side-nav-icon-link relative grid h-10 w-10 place-items-center rounded-xl border text-cyan-100 transition ${
                    active
                      ? "side-nav-icon-link-active border-cyan-300/70 bg-[#123754] shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_0_14px_rgba(6,182,212,0.32)]"
                      : "border-cyan-300/18 bg-[#0b1f3a] hover:border-cyan-300/45 hover:bg-[#15345a]"
                  }`}
                >
                  <IconForNav kind={item.icon} />
                  {badge ? (
                    <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-cyan-400 px-1 text-[9px] font-semibold leading-4 text-[#022538]">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-3 inset-x-0 flex flex-col items-center gap-3">
          <div className="h-10 text-[8px] tracking-[0.22em] text-cyan-100/35 [writing-mode:vertical-rl] rotate-180">
            Recruitr
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-full border border-cyan-300/20 bg-black/35 text-xs font-semibold text-cyan-100">
            N
          </div>
        </div>
      </div>

      <div
        className={`side-nav-links absolute left-[72px] top-0 z-30 h-full w-[248px] transition duration-200 ease-out ${
          panelOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-2 opacity-0"
        }`}
        onMouseEnter={() => setPanelOpen(true)}
      >
        <div className="h-full rounded-r-[28px] border border-l-0 border-cyan-300/20 bg-[linear-gradient(180deg,rgba(10,35,66,0.72),rgba(8,26,49,0.66))] shadow-[0_20px_40px_rgba(2,8,20,0.4)] backdrop-blur-md">
          <div className="relative px-4 pt-[34px]">
            <div className="side-nav-heading pointer-events-none absolute left-4 top-2 text-[11px] uppercase tracking-[0.14em] text-cyan-100/45">Navigation</div>
            <div className="space-y-1">
              {nav.map((item, idx) => {
                const active = pathname === item.href;
                const previewFromIcon = hoveredHref === item.href;
                const nearActive = activeIndex >= 0 && Math.abs(activeIndex - idx) === 1;
                const badge = badges[item.href as keyof typeof badges];
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={[
                      "side-nav-link flex h-10 items-center justify-between rounded-xl px-3 text-[15px] transition",
                      active
                        ? "side-nav-link-active bg-cyan-300/16 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                        : previewFromIcon
                          ? "bg-cyan-300/14 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                        : nearActive
                          ? "side-nav-link-near text-cyan-100/92 hover:bg-cyan-300/10"
                          : "side-nav-link-idle text-cyan-100/82 hover:bg-cyan-300/10",
                    ].join(" ")}
                  >
                    <span>{item.label}</span>
                    {badge ? (
                      <span className="side-nav-count rounded-full border border-cyan-300/25 bg-cyan-400/16 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
