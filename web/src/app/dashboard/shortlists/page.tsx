"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import {
  createShortlist,
  getMe,
  getNotifications,
  getShortlistSavedPosts,
  getShortlists,
  removeShortlistItem,
  unsavePost,
  updateShortlistItemNote,
  type MeUser,
  type SavedShortlistPost,
  type ShortlistList,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";

export default function ShortlistsPage() {
  const router = useRouter();
  const [token, setTokenValue] = useState<string | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<ShortlistList[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedShortlistPost[]>([]);
  const [newListName, setNewListName] = useState("Shortlist");

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
        const [shortlistRes, savedPostsRes] = await Promise.all([
          getShortlists(tokenValue, { includeItems: true }),
          getShortlistSavedPosts(tokenValue, 40),
        ]);
        setLists(shortlistRes.items);
        setSavedPosts(savedPostsRes.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load shortlists");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const isCoach = Boolean(user?.roles?.includes("coach"));

  async function refresh() {
    if (!token) return;
    const [shortlistRes, savedPostsRes] = await Promise.all([
      getShortlists(token, { includeItems: true }),
      getShortlistSavedPosts(token, 40),
    ]);
    setLists(shortlistRes.items);
    setSavedPosts(savedPostsRes.items);
  }

  if (loading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading shortlists…</div>
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
          <div className="text-sm font-semibold">Tips</div>
          <div className="mt-2 text-xs text-neutral-400">
            Use shortlist lists for athlete profiles. Saved reels stay separate so you can remove a clip without losing the athlete.
          </div>
        </div>
      }
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Shortlists</h1>
            <p className="mt-1 text-sm text-neutral-400">Save athletes and track notes.</p>
          </div>
          <button
            onClick={() => {
              void refresh();
            }}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!isCoach ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Shortlists are coach-only.
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-end gap-2">
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
                placeholder="New list name"
              />
              <button
                onClick={() => {
                  void (async () => {
                    if (!newListName.trim()) return;
                    await createShortlist(token, newListName.trim());
                    await refresh();
                  })();
                }}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
              >
                Create
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-white/10 bg-neutral-950/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Saved reels</div>
                  <div className="text-[11px] text-neutral-500">{savedPosts.length} saved posts</div>
                </div>
                <div className="mt-3 space-y-3">
                  {savedPosts.length === 0 ? (
                    <div className="text-xs text-neutral-500">No saved reels yet.</div>
                  ) : (
                    savedPosts.map((post) => (
                      <div key={post.postId} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row">
                          <div className="w-full shrink-0 lg:w-[160px]">
                            {post.media?.src ? (
                              post.media.kind === "video" ? (
                                <video
                                  src={post.media.src}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  className="aspect-[9/16] w-full rounded-xl border border-white/10 bg-black object-cover"
                                />
                              ) : (
                                <img
                                  src={post.media.src}
                                  alt={post.athleteName}
                                  className="aspect-[9/16] w-full rounded-xl border border-white/10 bg-black object-cover"
                                />
                              )
                            ) : (
                              <div className="aspect-[9/16] w-full rounded-xl border border-white/10 bg-neutral-950/40" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-neutral-100">{post.athleteName}</div>
                                <div className="text-xs text-neutral-500">{post.athleteMeta || "Athlete reel"}</div>
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                Saved {new Date(post.savedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-neutral-300">{post.caption || "Saved reel"}</p>
                            {post.tags.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {post.tags.map((tag) => (
                                  <span key={`${post.postId}-${tag}`} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-200">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => router.push(`/athletes/${post.athleteUserId}`)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
                              >
                                Open athlete profile
                              </button>
                              <button
                                onClick={() => {
                                  void (async () => {
                                    await unsavePost(token, post.postId);
                                    await refresh();
                                  })();
                                }}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
                              >
                                Remove saved reel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {lists.length === 0 ? (
                <div className="text-sm text-neutral-500">No shortlists yet.</div>
              ) : (
                lists.map((list) => (
                  <div key={list.id} className="rounded-xl border border-white/10 bg-neutral-950/30 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{list.name}</div>
                      <div className="text-[11px] text-neutral-500">{list.items.length} saved athletes</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {list.items.length === 0 ? (
                        <div className="text-xs text-neutral-500">No athletes yet.</div>
                      ) : (
                        list.items.map((item) => (
                          <div
                            key={`${list.id}-${item.athleteUserId}`}
                            className="rounded-lg border border-white/10 bg-black/20 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-sm text-neutral-100">{item.name}</div>
                                <div className="text-xs text-neutral-500">{item.meta || "Athlete"}</div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => router.push(`/athletes/${item.athleteUserId}`)}
                                  className="rounded border border-white/10 px-2 py-1 text-[11px] hover:bg-white/10"
                                >
                                  Open profile
                                </button>
                                <button
                                  onClick={() => {
                                    void (async () => {
                                      await removeShortlistItem(token, list.id, item.athleteUserId);
                                      await refresh();
                                    })();
                                  }}
                                  className="rounded border border-white/10 px-2 py-1 text-[11px] hover:bg-white/10"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            <textarea
                              defaultValue={item.note ?? ""}
                              onBlur={(e) => {
                                void updateShortlistItemNote(
                                  token,
                                  list.id,
                                  item.athleteUserId,
                                  e.target.value
                                );
                              }}
                              className="mt-2 min-h-[70px] w-full rounded-lg border border-white/10 bg-neutral-950/40 px-2 py-2 text-xs"
                              placeholder="Add note..."
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
