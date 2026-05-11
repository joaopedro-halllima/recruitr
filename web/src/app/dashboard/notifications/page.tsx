"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import {
  getMe,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type MeUser,
  type NotificationItem,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";
import { getNotificationHref } from "@/lib/notification-links";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | "dm_message" | "post_comment" | "comment_reply" | "comment_mention">("");
  const [loading, setLoading] = useState(false);

  const pageLabel = useMemo(() => `${Math.floor(offset / PAGE_SIZE) + 1}`, [offset]);

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
        setLoadingAuth(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    setOffset(0);
  }, [unreadOnly, typeFilter]);

  const loadNotifications = useCallback(async function loadNotifications(tokenValue: string) {
    setLoading(true);
    try {
      const data = await getNotifications(tokenValue, {
        limit: PAGE_SIZE,
        offset,
        unreadOnly,
        type: typeFilter || undefined,
      });
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [offset, unreadOnly, typeFilter]);

  useEffect(() => {
    if (!token) return;
    void loadNotifications(token);
  }, [token, loadNotifications]);

  if (loadingAuth) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading notifications…</div>
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

  if (!user || !token) return null;

  const authToken = token;

  async function handleNotificationOpen(notification: NotificationItem) {
    if (!notification.isRead) {
      setItems((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationRead(authToken, notification.id);
      } catch {
        // navigation should still work even if mark-read fails
      }
    }
    router.push(getNotificationHref(notification));
  }

  return (
    <AppShell
      userEmail={user.email}
      unreadCount={unreadCount}
      onLogout={() => {
        clearAuth();
        router.push("/");
      }}
      left={<SideNav />}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Notifications</div>
              <div className="text-xs text-neutral-400">
                {total} total • {unreadCount} unread
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-neutral-500">{loading ? "Loading…" : `Page ${pageLabel}`}</div>
              <button
                onClick={() => {
                  void markAllNotificationsRead(authToken).then(() => loadNotifications(authToken));
                }}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/10"
              >
                Mark all read
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/10"
              >
                Back to feed
              </Link>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`rounded-lg border px-3 py-1 text-xs ${
                unreadOnly
                  ? "border-white/30 bg-white/15 text-white"
                  : "border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10"
              }`}
            >
              {unreadOnly ? "Unread only: on" : "Unread only: off"}
            </button>

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  (e.target.value as "" | "dm_message" | "post_comment" | "comment_reply" | "comment_mention") || ""
                )
              }
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200"
            >
              <option value="">All types</option>
              <option value="dm_message">DM messages</option>
              <option value="post_comment">Post comments</option>
              <option value="comment_reply">Replies</option>
              <option value="comment_mention">Mentions</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-400">
              No notifications for this filter.
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleNotificationOpen(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void handleNotificationOpen(n);
                  }
                }}
                className={`rounded-2xl border p-4 ${
                  n.isRead ? "border-white/10 bg-white/5" : "border-cyan-400/30 bg-cyan-400/10"
                } cursor-pointer`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{n.title ?? "Notification"}</div>
                    <div className="mt-1 text-sm text-neutral-300 break-words">{n.body ?? n.type}</div>
                    <div className="mt-2 text-[11px] text-neutral-500">
                      {new Date(n.createdAt).toLocaleString()} • {n.type}
                    </div>
                  </div>
                  {!n.isRead ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void markNotificationRead(authToken, n.id).then(() => loadNotifications(authToken));
                      }}
                      className="shrink-0 rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/10"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <div className="text-xs text-neutral-400">
            Showing {offset + 1}-{Math.min(offset + items.length, total)} of {total}
          </div>
          <button
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </AppShell>
  );
}
