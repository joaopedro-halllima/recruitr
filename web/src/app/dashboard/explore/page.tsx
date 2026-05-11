"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import {
  searchSchools,
  searchTeams,
  triggerSearchReindex,
  searchUsers,
  getMe,
  getNotifications,
  type MeUser,
  type SearchUserItem,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";
import { getProfileHref } from "@/lib/profile-routes";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
          <div className="mx-auto max-w-3xl">Loading explore...</div>
        </div>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}

function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setTokenValue] = useState<string | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState<string>("sql");

  const [q, setQ] = useState("");
  const [role, setRole] = useState<"athlete" | "coach" | "">("");
  const [sport, setSport] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [users, setUsers] = useState<SearchUserItem[]>([]);
  const [schools, setSchools] = useState<
    Array<{ unitid?: string; name: string; city?: string | null; state?: string | null }>
  >([]);
  const [teams, setTeams] = useState<
    Array<{ id?: number; name: string; school_name?: string; school_unitid?: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexStatus, setReindexStatus] = useState<string | null>(null);
  const urlQ = useMemo(() => searchParams.get("q") ?? "", [searchParams]);

  const runSearch = useCallback(async (
    tokenValue: string,
    params: { q: string; role: "athlete" | "coach" | ""; sport: string; state: string }
  ) => {
    setSearching(true);
    setError(null);
    try {
      const [usersRes, schoolsRes, teamsRes] = await Promise.all([
        searchUsers(tokenValue, {
          q: params.q,
          role: params.role || undefined,
          sport: params.sport || undefined,
          state: params.state || undefined,
          limit: 25,
        }),
        searchSchools(tokenValue, { q: params.q, limit: 12 }),
        searchTeams(tokenValue, { q: params.q, limit: 12 }),
      ]);
      setUsers(usersRes.items);
      setSchools(schoolsRes.items);
      setTeams(teamsRes.items);
      setSearchSource(usersRes.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const tokenValue = getToken();
    const cached = getStoredUser() as MeUser | null;
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load explore");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!token) return;
    setQ((prev) => (prev === urlQ ? prev : urlQ));
    void runSearch(token, { q: urlQ, role, sport, state: stateFilter });
  }, [token, urlQ, role, sport, stateFilter, runSearch]);

  function triggerLocalSearch() {
    if (!token) return;
    const nextQ = q.trim();
    const nextUrl = nextQ ? `/dashboard/explore?q=${encodeURIComponent(nextQ)}` : "/dashboard/explore";
    router.replace(nextUrl);
    if (nextQ === urlQ) {
      void runSearch(token, { q: nextQ, role, sport, state: stateFilter });
    }
  }

  if (loading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading explore…</div>
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
          <div className="text-sm font-semibold">Search Engine</div>
          <div className="mt-2 text-xs text-neutral-400">
            Source: <span className="font-medium text-neutral-200">{searchSource}</span>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Uses Meilisearch when available, falls back to SQL automatically.
          </div>
          <button
            onClick={() => {
              void (async () => {
                setReindexing(true);
                setReindexStatus(null);
                try {
                  const out = await triggerSearchReindex(token);
                  setReindexStatus(
                    `Reindex queued: users=${out.counts.users}, schools=${out.counts.schools}, teams=${out.counts.teams}`
                  );
                } catch (e) {
                  setReindexStatus(e instanceof Error ? e.message : "Reindex failed");
                } finally {
                  setReindexing(false);
                }
              })();
            }}
            disabled={reindexing}
            className="mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-60"
          >
            {reindexing ? "Reindexing..." : "Reindex Search"}
          </button>
          {reindexStatus ? <div className="mt-2 text-[11px] text-neutral-400">{reindexStatus}</div> : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-lg font-semibold">Explore</h1>
          <p className="mt-1 text-sm text-neutral-400">Search users, schools, and teams with basic filters.</p>

          <div className="mt-4 grid gap-2 md:grid-cols-5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search text"
              className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm md:col-span-2"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "athlete" | "coach" | "")}
              className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
            >
              <option value="">All roles</option>
              <option value="athlete">Athlete</option>
              <option value="coach">Coach</option>
            </select>
            <input
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              placeholder="Sport"
              className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
            />
            <input
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              placeholder="State"
              className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                triggerLocalSearch();
              }}
              disabled={searching}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold">Users ({users.length})</div>
            <div className="mt-3 space-y-2">
              {users.length === 0 ? (
                <div className="text-xs text-neutral-500">No users found.</div>
              ) : (
                users.map((u, idx) => (
                  <button
                    key={`${u.userId ?? "nouid"}-${u.email ?? u.name}-${u.role}-${idx}`}
                    type="button"
                    onClick={() => {
                      const href = getProfileHref(u, user.id);
                      if (href) router.push(href);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950/40 p-3 text-left transition hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{u.name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{u.role}</div>
                    </div>
                    <div className="mt-1 text-xs text-neutral-400">{u.meta || u.email}</div>
                  </button>
                ))
              )}
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold">Schools ({schools.length})</div>
              <div className="mt-3 space-y-2">
                {schools.length === 0 ? (
                  <div className="text-xs text-neutral-500">No schools found.</div>
                ) : (
                  schools.map((s) =>
                    s.unitid ? (
                      <Link
                        key={`${s.unitid}-${s.name}`}
                        href={`/schools/${encodeURIComponent(s.unitid)}`}
                        className="block rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm hover:bg-white/10"
                      >
                        {s.name}
                      </Link>
                    ) : (
                      <div
                        key={s.name}
                        className="rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
                      >
                        {s.name}
                      </div>
                    )
                  )
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold">Teams ({teams.length})</div>
              <div className="mt-3 space-y-2">
                {teams.length === 0 ? (
                  <div className="text-xs text-neutral-500">No teams found.</div>
                ) : (
                  teams.map((t) => (
                    <div key={`${t.id ?? t.name}-${t.name}`} className="rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm">
                      <div>{t.name}</div>
                      {t.school_name ? (
                        <div className="text-[11px] text-neutral-500">
                          {t.school_unitid ? (
                            <Link href={`/schools/${encodeURIComponent(t.school_unitid)}`} className="hover:underline">
                              {t.school_name}
                            </Link>
                          ) : (
                            t.school_name
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
