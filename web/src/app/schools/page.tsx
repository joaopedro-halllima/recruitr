"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import SchoolCard from "@/components/schools/SchoolCard";
import {
  getMe,
  getNotifications,
  getSchoolsDirectory,
  type MeUser,
  type SchoolCardItem,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";

const PAGE_SIZE = 24;
const STATE_OPTIONS = ["", "CT", "MA", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"];

export default function SchoolsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<"" | "2-year" | "4-year">("");
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState<SchoolCardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const page = useMemo(() => Math.floor(offset / PAGE_SIZE) + 1, [offset]);

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
        const notif = await getNotifications(tokenValue, { limit: 1 });
        setUnreadCount(notif.unreadCount);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load schools");
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setQuery(queryInput.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await getSchoolsDirectory(token, {
          query,
          state: stateFilter || undefined,
          level: levelFilter || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
        setHasMore(res.hasMore);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to fetch schools");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, query, stateFilter, levelFilter, offset]);

  if (authLoading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading schools…</div>
      </div>
    );
  }
  if (!user) return null;

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
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Directory Stats</div>
            <div className="mt-2 text-xs text-neutral-400">Total schools indexed: {total}</div>
            <div className="text-xs text-neutral-500">Page {page}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-400">
            Search uses fuzzy matching on school name and supports state + level filters.
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h1 className="text-lg font-semibold">Schools Directory</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Browse colleges, open school pages, and join teams.
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search schools..."
              className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm md:col-span-2"
            />
            <select
              value={stateFilter}
              onChange={(e) => {
                setOffset(0);
                setStateFilter(e.target.value);
              }}
              className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
            >
              {STATE_OPTIONS.map((state) => (
                <option key={state || "all"} value={state}>
                  {state ? state : "All states"}
                </option>
              ))}
            </select>
            <select
              value={levelFilter}
              onChange={(e) => {
                setOffset(0);
                setLevelFilter(e.target.value as "" | "2-year" | "4-year");
              }}
              className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
            >
              <option value="">All levels</option>
              <option value="4-year">4-year</option>
              <option value="2-year">2-year</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-400">
            Loading schools…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-400">
            No schools matched your filters.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((school) => (
              <SchoolCard key={school.unitid} school={school} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          <div className="text-neutral-400">
            Showing {items.length === 0 ? 0 : offset + 1}-{offset + items.length} of {total}
          </div>
          <div className="flex gap-2">
            <button
              disabled={offset === 0 || loading}
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={!hasMore || loading}
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
