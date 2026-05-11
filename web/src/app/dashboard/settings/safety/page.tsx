"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import {
  getBlockedUsers,
  getHiddenPosts,
  getHiddenUsers,
  getMe,
  getNotifications,
  unblockUser,
  unhidePost,
  unhideUser,
  type HiddenPostItem,
  type MeUser,
  type SafetyUserItem,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";

export default function SafetySettingsPage() {
  const router = useRouter();
  const [token, setTokenValue] = useState<string | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [blockedUsers, setBlockedUsers] = useState<SafetyUserItem[]>([]);
  const [hiddenUsers, setHiddenUsers] = useState<SafetyUserItem[]>([]);
  const [hiddenPosts, setHiddenPosts] = useState<HiddenPostItem[]>([]);

  async function loadAll(tokenValue: string) {
    const [blockedRes, hiddenUsersRes, hiddenPostsRes] = await Promise.all([
      getBlockedUsers(tokenValue),
      getHiddenUsers(tokenValue),
      getHiddenPosts(tokenValue),
    ]);
    setBlockedUsers(blockedRes.items);
    setHiddenUsers(hiddenUsersRes.items);
    setHiddenPosts(hiddenPostsRes.items);
  }

  useEffect(() => {
    const tokenValue = getToken();
    const cached = getStoredUser<MeUser>();
    if (!tokenValue) {
      router.replace("/");
      return;
    }
    setTokenValue(tokenValue);
    if (cached) setUser(cached);

    (async () => {
      try {
        const me = await getMe(tokenValue);
        setUser(me);
        setAuth(tokenValue, me);
        const notif = await getNotifications(tokenValue, { limit: 1 });
        setUnreadCount(notif.unreadCount);
        await loadAll(tokenValue);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load safety settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading safety settings…</div>
      </div>
    );
  }

  if (!user || !token) return null;

  return (
    <AppShell
      userEmail={user.email}
      unreadCount={unreadCount}
      onLogout={() => {
        clearAuth();
        router.push("/");
      }}
      left={<SideNav />}
      right={
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Safety</div>
          <div className="mt-2 text-xs text-neutral-400">
            Manage who you blocked, which users you hid, and hidden posts.
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-lg font-semibold">Safety Settings</h1>
          <p className="mt-1 text-sm text-neutral-400">Your moderation preferences are enforced in feed ranking.</p>
          {error ? (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Blocked Users</div>
          <div className="mt-3 space-y-2">
            {blockedUsers.length === 0 ? (
              <div className="text-xs text-neutral-500">No blocked users.</div>
            ) : (
              blockedUsers.map((u) => (
                <div key={u.userId} className="flex items-center justify-between rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2">
                  <div>
                    <div className="text-sm">{u.name}</div>
                    <div className="text-[11px] text-neutral-500">{u.email}</div>
                  </div>
                  <button
                    onClick={() => {
                      void (async () => {
                        await unblockUser(token, u.userId);
                        setBlockedUsers((prev) => prev.filter((x) => x.userId !== u.userId));
                      })();
                    }}
                    className="rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Hidden Users</div>
          <div className="mt-3 space-y-2">
            {hiddenUsers.length === 0 ? (
              <div className="text-xs text-neutral-500">No hidden users.</div>
            ) : (
              hiddenUsers.map((u) => (
                <div key={u.userId} className="flex items-center justify-between rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2">
                  <div>
                    <div className="text-sm">{u.name}</div>
                    <div className="text-[11px] text-neutral-500">{u.email}</div>
                  </div>
                  <button
                    onClick={() => {
                      void (async () => {
                        await unhideUser(token, u.userId);
                        setHiddenUsers((prev) => prev.filter((x) => x.userId !== u.userId));
                      })();
                    }}
                    className="rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
                  >
                    Unhide
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Hidden Posts</div>
          <div className="mt-3 space-y-2">
            {hiddenPosts.length === 0 ? (
              <div className="text-xs text-neutral-500">No hidden posts.</div>
            ) : (
              hiddenPosts.map((p) => (
                <div key={p.postId} className="flex items-center justify-between rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{p.caption || "(no caption)"}</div>
                    <div className="text-[11px] text-neutral-500">Post #{p.postId}</div>
                  </div>
                  <button
                    onClick={() => {
                      void (async () => {
                        await unhidePost(token, p.postId);
                        setHiddenPosts((prev) => prev.filter((x) => x.postId !== p.postId));
                      })();
                    }}
                    className="rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
                  >
                    Unhide
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
