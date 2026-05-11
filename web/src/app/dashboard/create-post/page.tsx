"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import {
  createPost,
  createPostUploadSession,
  getMe,
  getMyPosts,
  getNotifications,
  listSports,
  uploadFileWithProgress,
  type MeUser,
  type MyPostItem,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";

type UploadDraft = {
  localId: string;
  filename: string;
  kind: "image" | "video";
  progress: number;
  mediaAssetId?: number;
  publicUrl?: string;
};

export default function CreatePostPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
          <div className="mx-auto max-w-3xl">Loading create post...</div>
        </div>
      }
    >
      <CreatePostPageContent />
    </Suspense>
  );
}

function CreatePostPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caption, setCaption] = useState("");
  const [sport, setSport] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [uploads, setUploads] = useState<UploadDraft[]>([]);
  const [recentPosts, setRecentPosts] = useState<MyPostItem[]>([]);
  const [sportsOptions, setSportsOptions] = useState<string[]>([]);

  const canCreatePost = Boolean(user?.roles?.includes("athlete") || user?.roles?.includes("coach"));
  const isCoachOnly = Boolean(user?.roles?.includes("coach") && !user?.roles?.includes("athlete"));
  const pendingUploads = uploads.some((u) => !u.mediaAssetId);
  const isWelcomeFlow = searchParams.get("welcome") === "1";
  const mediaAssetIds = useMemo(
    () => uploads.map((u) => u.mediaAssetId).filter((id): id is number => typeof id === "number"),
    [uploads]
  );

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
        const [sports, mine] = await Promise.all([
          listSports(tokenValue, { limit: 30 }),
          getMyPosts(tokenValue, 8),
        ]);
        setSportsOptions(sports.items);
        setRecentPosts(mine.items);
        if (me.athlete_profile?.sport) {
          setSport(me.athlete_profile.sport);
        } else if (me.coach_profile?.sport) {
          setSport(me.coach_profile.sport);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load create post");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleFilePick(file: File) {
    if (!token) return;
    const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    const localId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setUploads((prev) => [
      ...prev,
      {
        localId,
        filename: file.name,
        kind,
        progress: 0,
      },
    ]);

    try {
      const session = await createPostUploadSession(token, file, kind);
      const uploaded = await uploadFileWithProgress(token, session.uploadUrl, file, (pct) => {
        setUploads((prev) => prev.map((u) => (u.localId === localId ? { ...u, progress: pct } : u)));
      });
      setUploads((prev) =>
        prev.map((u) =>
          u.localId === localId
            ? {
                ...u,
                progress: 100,
                mediaAssetId: uploaded.mediaAssetId,
                publicUrl: uploaded.publicUrl,
              }
            : u
        )
      );
    } catch {
      setUploads((prev) => prev.filter((u) => u.localId !== localId));
    }
  }

  async function handlePublish() {
    if (!token) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await createPost(token, {
        caption: caption.trim(),
        sport: sport.trim().toLowerCase(),
        mediaAssetIds,
        tags,
      });
      setCaption("");
      setTagsText("");
      setUploads([]);
      const mine = await getMyPosts(token, 8);
      setRecentPosts(mine.items);
      setSuccess("Post published.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish post");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading create post…</div>
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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Publishing Rules</div>
          <ul className="mt-2 space-y-1 text-xs text-neutral-400">
            <li>Posts are public in MVP.</li>
            <li>At least one uploaded image or video is required.</li>
            <li>Use clear tags so coaches can discover you.</li>
            <li>Coach posts are discoverable but cannot be saved like athlete posts.</li>
          </ul>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-lg font-semibold">Create Post</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Upload media, add tags, and publish directly into the ranked feed.
          </p>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          {!canCreatePost ? (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Only athlete or coach accounts can create posts.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {isWelcomeFlow ? (
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
                  <div className="font-medium">Your account is live.</div>
                  <div className="mt-1 text-cyan-100/85">
                    Post something now so your profile immediately shows real activity in the feed.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Link
                      href="/dashboard/profile"
                      className="rounded-lg border border-cyan-200/25 bg-white/5 px-3 py-1.5 hover:bg-white/10"
                    >
                      Finish profile first
                    </Link>
                    <Link
                      href="/dashboard"
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
                    >
                      Go to feed
                    </Link>
                  </div>
                </div>
              ) : null}
              {isCoachOnly ? (
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                  You are publishing a coach post. Coach posts are ranked in feed but cannot be saved the same way athlete posts are.
                </div>
              ) : null}
              <label className="space-y-1 block">
                <span className="text-xs text-neutral-400">Sport</span>
                <input
                  list="sports-options-create-post"
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
                />
                <datalist id="sports-options-create-post">
                  {sportsOptions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>

              <label className="space-y-1 block">
                <span className="text-xs text-neutral-400">Caption</span>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="min-h-[120px] w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
                  placeholder="What should coaches notice in this clip?"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs text-neutral-400">Tags (comma separated)</span>
                <input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm"
                  placeholder="soccer, classof2028, midfielder"
                />
              </label>

              <div>
                <div className="text-xs text-neutral-400">Media</div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void handleFilePick(file);
                    e.currentTarget.value = "";
                  }}
                  className="mt-2 block w-full text-xs text-neutral-400 file:mr-2 file:rounded-md file:border file:border-white/10 file:bg-white/5 file:px-2 file:py-1 file:text-xs file:text-neutral-200"
                />
                {uploads.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {uploads.map((u) => (
                      <div
                        key={u.localId}
                        className="rounded-lg border border-white/10 bg-neutral-950/30 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-xs text-neutral-200">
                            [{u.kind}] {u.filename}
                          </div>
                          <button
                            onClick={() => setUploads((prev) => prev.filter((x) => x.localId !== u.localId))}
                            className="rounded border border-white/10 px-2 py-0.5 text-[10px] hover:bg-white/10"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {u.mediaAssetId ? "Ready" : `Uploading ${u.progress}%`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => {
                  void handlePublish();
                }}
                disabled={
                  saving ||
                  !canCreatePost ||
                  sport.trim().length === 0 ||
                  mediaAssetIds.length === 0 ||
                  pendingUploads
                }
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Publishing..." : "Publish Post"}
              </button>
              {pendingUploads ? (
                <div className="text-[11px] text-amber-300">Wait for uploads to finish before publishing.</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Your Recent Posts</div>
          <div className="mt-3 space-y-3">
            {recentPosts.length === 0 ? (
              <div className="space-y-2 text-xs text-neutral-500">
                <div>No posts yet.</div>
                <Link
                  href="/dashboard"
                  className="inline-flex rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-neutral-200 hover:bg-white/10"
                >
                  Open feed
                </Link>
              </div>
            ) : (
              recentPosts.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/10 bg-neutral-950/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">{p.sport}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-neutral-200">{p.caption || "(no caption)"}</div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {new Date(p.createdAt).toLocaleString()}
                  </div>
                  {p.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.tags.slice(0, 4).map((tag) => (
                        <span key={`${p.id}-${tag}`} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-neutral-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
            {success ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                <div className="font-medium">Post published successfully.</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href="/dashboard"
                    className="rounded-lg border border-emerald-300/25 bg-white/5 px-3 py-1.5 hover:bg-white/10"
                  >
                    View feed
                  </Link>
                  <Link
                    href="/dashboard/profile"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-emerald-50 hover:bg-white/10"
                  >
                    View profile
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
