"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import Feed from "@/components/feed/Feed";

import {
  getMe,
  getNotifications,
  type MeUser,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const tokenValue = getToken();
    const cached = getStoredUser<MeUser>();

    if (!tokenValue) {
      router.replace("/");
      return;
    }
    setToken(tokenValue);

    if (cached) setUser(cached);

    (async () => {
      try {
        const me = await getMe(tokenValue);
        setUser(me);
        setAuth(tokenValue, me);
      } catch (e) {
        clearAuth();
        setError(e instanceof Error ? e.message : "Failed to load /me");
        setTimeout(() => router.replace("/"), 800);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function refreshNotifications(tokenValue: string) {
    const data = await getNotifications(tokenValue, { limit: 1, offset: 0 });
    setUnreadCount(data.unreadCount);
  }

  useEffect(() => {
    if (!token) return;
    void refreshNotifications(token);
    const intervalId = window.setInterval(() => {
      void refreshNotifications(token);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [token]);

  function logout() {
    clearAuth();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppShell
      userEmail={user.email}
      onLogout={logout}
      unreadCount={unreadCount}
      left={<SideNav />}
    >
      <Feed />
    </AppShell>
  );
}
