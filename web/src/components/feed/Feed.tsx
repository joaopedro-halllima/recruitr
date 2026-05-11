"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PostCard, { type Post } from "@/components/feed/PostCard";
import { getStoredUser, getToken } from "@/lib/auth";
import { resolveApiBase } from "@/lib/api-base";
import { getProfileHref } from "@/lib/profile-routes";
import {
  addShortlistItem,
  createShortlist,
  followAuthor,
  getFeedPost,
  getShortlists,
  hidePost,
  likePost,
  reportContent,
  savePost,
  unfollowAuthor,
  unlikePost,
  unsavePost,
  type MeUser,
  type ShortlistList,
} from "@/lib/api";

type Story = {
  id: string;
  name: string;
  meta: string;
  avatarText: string;
  ring?: "pink" | "blue" | "green";
};

const stories: Story[] = [
  { id: "s1", name: "Jordan Reyes", meta: "Soccer • 2028", avatarText: "JR", ring: "pink" },
  { id: "s2", name: "Maya Chen", meta: "Track • 400m", avatarText: "MC", ring: "blue" },
  { id: "s3", name: "Aiden Patel", meta: "Basketball • 2027", avatarText: "AP", ring: "green" },
  { id: "s4", name: "Sofia Alvarez", meta: "Volleyball • 2026", avatarText: "SA", ring: "pink" },
  { id: "s5", name: "Nico Kim", meta: "Soccer • 2029", avatarText: "NK", ring: "blue" },
  { id: "s6", name: "Priya Singh", meta: "Lacrosse • 2027", avatarText: "PS", ring: "green" },
  { id: "s7", name: "Riley Brooks", meta: "Football • 2027", avatarText: "RB", ring: "pink" },
  { id: "s8", name: "Taylor Moore", meta: "Baseball • 2028", avatarText: "TM", ring: "blue" },
];

const mockPosts: Post[] = [
  {
    id: "1",
    authorName: "Jordan Reyes",
    authorMeta: "Athlete • Soccer • Class of 2028",
    avatarText: "JR",
    timeAgo: "2h",
    caption: "Highlight reel from last weekend. Looking for D1/D2 programs — DM me for full match film.",
    tags: ["#soccer", "#forward", "#2028"],
    media: { kind: "video", src: "/demo/Soccer_1.mp4", poster: "/demo/soccer1.jpg" },
  },
  {
    id: "2",
    authorName: "Maya Chen",
    authorMeta: "Athlete • Track • 400m",
    avatarText: "MC",
    timeAgo: "6h",
    caption: "Columbia baseball season starts in two weeks!!! Cannot wait to support our team!",
    tags: ["#track", "#400m", "#recruiting"],
    media: { kind: "video", src: "/demo/Soccer_2.mp4", poster: "/demo/track1.jpg" },
  },
];

function ringClass(ring?: Story["ring"]) {
  if (ring === "blue") return "from-cyan-400 to-blue-600";
  if (ring === "green") return "from-emerald-400 to-lime-500";
  return "from-fuchsia-500 to-orange-500";
}

function timeAgoFromISO(iso?: string) {
  if (!iso) return "now";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "now";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type ApiItem = {
  id: string;
  postId?: number;
  authorUserId?: number;
  authorRole?: "athlete" | "coach" | "unknown";
  postType?: "athlete" | "coach" | "unknown";
  authorName: string;
  authorMeta: string;
  avatarText?: string;
  time?: string;
  timeAgo?: string; // may be ISO
  caption?: string;
  tags?: string[];
  media?: { kind: "video" | "image"; src: string; poster?: string; alt?: string } | null;
  likeCount?: number;
  saveCount?: number;
  commentCount?: number;
  viewerLiked?: boolean;
  viewerSaved?: boolean;
  viewerFollowingAuthor?: boolean;
  canSave?: boolean;
};

function isPostMedia(x: unknown): x is NonNullable<Post["media"]> {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  if (obj.kind === "video") return typeof obj.src === "string";
  if (obj.kind === "image") return typeof obj.src === "string";
  return false;
}

function postVisibilityKey(post: Post): string {
  if (typeof post.postId === "number") return `post:${post.postId}`;
  return `id:${post.id}`;
}

export default function Feed() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [activePostId, setActivePostId] = useState<string | null>(mockPosts[0]?.id ?? null);
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<"api" | "mock">("mock");
  const [error, setError] = useState<string | null>(null);
  const viewed3sPostIds = useRef<Set<number>>(new Set());
  const [hiddenPostKeys, setHiddenPostKeys] = useState<Set<string>>(new Set());
  const [defaultShortlistId, setDefaultShortlistId] = useState<number | null>(null);
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const seedPostsRef = useRef<Post[]>(mockPosts);
  const loopRoundRef = useRef(0);
  const appendInFlightRef = useRef(false);
  const deepLinkFetchRef = useRef<number | null>(null);
  const appliedDeepLinkRef = useRef<string | null>(null);

  const API_BASE = useMemo(() => resolveApiBase(), []);
  const authToken = useMemo(() => getToken(), []);
  const cachedUser = useMemo(() => getStoredUser() as MeUser | null, []);
  const canShortlist = Boolean(cachedUser?.roles?.includes("coach"));
  const deepLinkPostRaw = searchParams.get("post");
  const deepLinkCommentId = parsePositiveInt(searchParams.get("comment"));
  const deepLinkPostId = parsePositiveInt(deepLinkPostRaw);

  const sendFeedEvent = useCallback(async function sendFeedEvent(
    post: Post,
    eventType: "view_3s" | "like" | "save" | "profile_open" | "hide" | "report",
    metadata?: Record<string, unknown>
  ) {
    if (!authToken || !post.postId) return;
    try {
      await fetch(`${API_BASE}/api/v1/feed/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          post_id: post.postId,
          event_type: eventType,
          algorithm_version: "post_feed_v2",
          metadata: metadata ?? {},
        }),
      });
    } catch {
      // Non-blocking analytics
    }
  }, [API_BASE, authToken]);

  const appendSyntheticBatch = useCallback(() => {
    if (appendInFlightRef.current) return;
    const seed = seedPostsRef.current;
    if (!seed.length) return;

    appendInFlightRef.current = true;
    setLoadingMore(true);
    window.setTimeout(() => {
      loopRoundRef.current += 1;
      const round = loopRoundRef.current;
      const clonedBatch = seed.map((post, idx) => ({
        ...post,
        id: `${post.id}__loop${round}_${idx}`,
      }));
      setPosts((prev) => [...prev, ...clonedBatch]);
      setLoadingMore(false);
      appendInFlightRef.current = false;
    }, 110);
  }, []);

  const visiblePosts = useMemo(
    () => posts.filter((p) => !hiddenPostKeys.has(postVisibilityKey(p))),
    [posts, hiddenPostKeys]
  );

  const mapApiItemToPost = useCallback((x: ApiItem): Post => {
    const iso = x.time || x.timeAgo;
    return {
      id: String(x.id),
      postId: typeof x.postId === "number" ? x.postId : undefined,
      authorUserId: typeof x.authorUserId === "number" ? x.authorUserId : undefined,
      authorRole: x.authorRole ?? "unknown",
      postType: x.postType ?? "unknown",
      authorName: String(x.authorName ?? "Unknown"),
      authorMeta: String(x.authorMeta ?? ""),
      avatarText: String(x.avatarText ?? "U"),
      timeAgo: timeAgoFromISO(typeof iso === "string" ? iso : undefined),
      caption: String(x.caption ?? ""),
      tags: Array.isArray(x.tags) ? x.tags : [],
      media: isPostMedia(x.media) ? x.media : null,
      likeCount: typeof x.likeCount === "number" ? x.likeCount : 0,
      saveCount: typeof x.saveCount === "number" ? x.saveCount : 0,
      commentCount: typeof x.commentCount === "number" ? x.commentCount : 0,
      viewerLiked: Boolean(x.viewerLiked),
      viewerSaved: Boolean(x.viewerSaved),
      viewerFollowingAuthor: Boolean(x.viewerFollowingAuthor),
      canSave: typeof x.canSave === "boolean" ? x.canSave : (x.authorRole ?? "unknown") === "athlete",
    };
  }, []);

  // Fetch posts
  useEffect(() => {
    let mounted = true;

    async function loadFeed() {
      setLoading(true);
      setError(null);

      try {
        if (!authToken) throw new Error("Missing auth token");
        const feedUrl = new URL(`${API_BASE}/api/v1/feed`);
        feedUrl.searchParams.set("limit", "25");
        const res = await fetch(feedUrl.toString(), {
          cache: "no-store",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) throw new Error(`Feed failed (${res.status})`);
        const data = await res.json();
        const items: ApiItem[] = Array.isArray(data?.items) ? data.items : [];

        const mapped: Post[] = items.map(mapApiItemToPost);

        if (mounted && mapped.length > 0) {
          setPosts(mapped);
          seedPostsRef.current = mapped;
          loopRoundRef.current = 0;
          setActivePostId(mapped[0]?.id ?? null);
          setSourceLabel("api");
        } else if (mounted) {
          setPosts(mockPosts);
          seedPostsRef.current = mockPosts;
          loopRoundRef.current = 0;
          setSourceLabel("mock");
        }
      } catch (e: unknown) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Failed to load feed");
          setPosts(mockPosts);
          seedPostsRef.current = mockPosts;
          loopRoundRef.current = 0;
          setSourceLabel("mock");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFeed();
    return () => {
      mounted = false;
    };
  }, [API_BASE, authToken, mapApiItemToPost]);

  useEffect(() => {
    if (!authToken || !canShortlist) return;
    let alive = true;
    void (async () => {
      try {
        const data = await getShortlists(authToken, { includeItems: false });
        if (!alive) return;
        const first = data.items[0];
        if (first) {
          setDefaultShortlistId(first.id);
          return;
        }
        const created: ShortlistList = await createShortlist(authToken, "Shortlist");
        if (alive) setDefaultShortlistId(created.id);
      } catch {
        if (alive) setDefaultShortlistId(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authToken, canShortlist]);

  // Autoplay most-visible video (rerun when feed changes)
  useEffect(() => {
    const videos = Array.from(
      document.querySelectorAll<HTMLVideoElement>('video[data-reel-video="true"]')
    );
    if (videos.length === 0) return;

    let active: HTMLVideoElement | null = null;
    const ratios = new Map<HTMLVideoElement, number>();

    const pauseAllExcept = (keep: HTMLVideoElement | null) => {
      videos.forEach((v) => {
        if (v === keep) return;
        v.pause();
      });
    };

    const activateVideo = (next: HTMLVideoElement) => {
      active = next;
      active.playsInline = true;
      const userMuted = active.dataset.userMuted !== "false";
      active.muted = userMuted;
      active.defaultMuted = userMuted;
      pauseAllExcept(active);
      active.play().catch(() => {
        if (!active) return;
        active.muted = true;
        active.defaultMuted = true;
        active.dataset.userMuted = "true";
        active.play().catch(() => {});
      });

      const pid = next.getAttribute("data-postid");
      if (pid) setActivePostId(pid);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          ratios.set(v, e.intersectionRatio);
        });

        const activeRatio = active ? (ratios.get(active) ?? 0) : 0;
        if (active && activeRatio >= 0.5) {
          if (active.paused) {
            active.play().catch(() => {});
          }
          return;
        }

        let best: HTMLVideoElement | null = null;
        let bestRatio = 0;

        for (const [v, r] of ratios.entries()) {
          if (r > bestRatio) {
            bestRatio = r;
            best = v;
          }
        }

        if (best && bestRatio >= 0.6) {
          if (best !== active) {
            activateVideo(best);
          } else if (best.paused) {
            best.play().catch(() => {});
          }
          return;
        }

        if (active && activeRatio <= 0.2) {
          active.pause();
          active = null;
        }
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
    );

    videos.forEach((v) => observer.observe(v));

    const onVis = () => {
      if (document.hidden) pauseAllExcept(null);
      else active?.play().catch(() => {});
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      observer.disconnect();
    };
  }, [posts.length]);

  useEffect(() => {
    const sentinel = infiniteSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            appendSyntheticBatch();
            break;
          }
        }
      },
      { root: null, rootMargin: "900px 0px", threshold: 0.01 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [appendSyntheticBatch]);

  useEffect(() => {
    if (visiblePosts.length === 0) {
      setActivePostId(null);
      setCommentsDrawerOpen(false);
      return;
    }
    if (!activePostId || !visiblePosts.some((p) => p.id === activePostId)) {
      setActivePostId(visiblePosts[0]?.id ?? null);
    }
  }, [activePostId, visiblePosts]);

  useEffect(() => {
    if (!activePostId) return;
    const activePost = visiblePosts.find((p) => p.id === activePostId);
    if (!activePost?.postId) return;
    if (viewed3sPostIds.current.has(activePost.postId)) return;

    const timeoutId = window.setTimeout(() => {
      viewed3sPostIds.current.add(activePost.postId as number);
      void sendFeedEvent(activePost, "view_3s", { source: sourceLabel });
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [activePostId, visiblePosts, sendFeedEvent, sourceLabel]);

  useEffect(() => {
    if (!commentsDrawerOpen || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [commentsDrawerOpen]);

  useEffect(() => {
    const deepLinkKey = `${deepLinkPostRaw ?? ""}:${deepLinkCommentId ?? ""}`;
    if (!deepLinkPostRaw || appliedDeepLinkRef.current === deepLinkKey) return;

    const match = visiblePosts.find((post) => {
      if (deepLinkPostId && post.postId === deepLinkPostId) return true;
      return post.id === deepLinkPostRaw;
    });

    if (match) {
      appliedDeepLinkRef.current = deepLinkKey;
      setActivePostId(match.id);
      setCommentsDrawerOpen(true);
      window.setTimeout(() => {
        const index = visiblePosts.findIndex((post) => post.id === match.id);
        if (index >= 0) {
          postWrapRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 40);
      return;
    }

    if (!deepLinkPostId || !authToken || deepLinkFetchRef.current === deepLinkPostId) return;
    deepLinkFetchRef.current = deepLinkPostId;
    void (async () => {
      try {
        const data = await getFeedPost(authToken, deepLinkPostId);
        const mapped = mapApiItemToPost(data.item as ApiItem);
        setPosts((prev) => {
          if (prev.some((post) => post.postId === mapped.postId || post.id === mapped.id)) {
            return prev;
          }
          return [mapped, ...prev];
        });
      } catch {
        // ignore broken deep links
      } finally {
        deepLinkFetchRef.current = null;
      }
    })();
  }, [
    authToken,
    deepLinkCommentId,
    deepLinkPostId,
    deepLinkPostRaw,
    mapApiItemToPost,
    visiblePosts,
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-4 px-1 sm:px-2 xl:px-0">
      <div className="mx-auto w-full max-w-[980px] space-y-4">
        {/* Stories row */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Stories</div>
            <div className="text-xs text-neutral-500">
              {loading ? "Loading…" : sourceLabel === "api" ? "Live feed" : "Mock feed"}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7 xl:grid-cols-8">
            {stories.map((s) => (
              <button
                key={s.id}
                className="group flex min-w-0 flex-col items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/5"
                onClick={() => alert(`Story (mock): ${s.name}`)}
                title="Open story (mock)"
              >
                <div className={`rounded-full bg-gradient-to-tr p-[2px] ${ringClass(s.ring)}`}>
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
                    {s.avatarText}
                  </div>
                </div>
                <div className="w-full text-center">
                  <div className="truncate text-xs text-neutral-200">{s.name}</div>
                  <div className="truncate text-[10px] text-neutral-500">{s.meta}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Explore bar */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Explore</div>
            <div className="text-xs text-neutral-500">Phase mock</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["D1 Prospects", "Soccer", "NY/NJ", "Class of 2028", "Highlights"].map((x) => (
              <div
                key={x}
                className="rounded-xl border border-white/10 bg-neutral-950/30 px-3 py-2 text-xs text-neutral-200"
              >
                {x}
                <div className="text-[10px] text-neutral-500">mock</div>
              </div>
            ))}
          </div>
        </div>

        {/* Coach note composer */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Add a coach note</div>
            <div className="text-xs text-neutral-500">Phase mock</div>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <textarea
              className="min-h-[74px] w-full resize-none rounded-xl border border-white/10 bg-neutral-950/30 p-3 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/10"
              placeholder="Write a recruiting note (private mock)..."
            />
            <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200">
              Post
            </button>
          </div>

          {error ? (
            <div className="mt-3 text-xs text-rose-300">
              Feed error: {error} (showing mock posts)
            </div>
          ) : null}
        </div>
      </div>

      {/* Posts */}
      {visiblePosts.map((p, idx) => (
        <div
          key={p.id}
          data-postid={p.id}
          ref={(el) => {
            postWrapRefs.current[idx] = el;
          }}
        >
          <PostCard
            post={p}
            commentsDrawerOpen={commentsDrawerOpen && p.id === activePostId}
            highlightCommentId={commentsDrawerOpen && p.id === activePostId ? deepLinkCommentId : null}
            onCommentsDrawerOpen={(post) => {
              setActivePostId(post.id);
              setCommentsDrawerOpen(true);
            }}
            onCommentsDrawerClose={() => setCommentsDrawerOpen(false)}
            onLikeToggle={(post, liked) => {
              setPosts((prev) =>
                prev.map((item) =>
                  (
                    (typeof post.postId === "number" && item.postId === post.postId) ||
                    item.id === post.id
                  )
                    ? {
                        ...item,
                        viewerLiked: liked,
                        likeCount: liked
                          ? (typeof item.likeCount === "number" ? item.likeCount : 0) + 1
                          : Math.max(0, (typeof item.likeCount === "number" ? item.likeCount : 0) - 1),
                      }
                    : item
                )
              );
              if (!authToken || !post.postId) return;
              void (async () => {
                try {
                  if (liked) await likePost(authToken, post.postId as number);
                  else await unlikePost(authToken, post.postId as number);
                  await sendFeedEvent(post, "like", {
                    source: sourceLabel,
                    action: liked ? "like" : "unlike",
                  });
                } catch {
                  setPosts((prev) =>
                    prev.map((item) =>
                      (
                        (typeof post.postId === "number" && item.postId === post.postId) ||
                        item.id === post.id
                      )
                        ? {
                            ...item,
                            viewerLiked: !liked,
                            likeCount: !liked
                              ? (typeof item.likeCount === "number" ? item.likeCount : 0) + 1
                              : Math.max(0, (typeof item.likeCount === "number" ? item.likeCount : 0) - 1),
                          }
                        : item
                    )
                  );
                }
              })();
            }}
            onFollowToggle={(post, following) => {
              setPosts((prev) =>
                prev.map((item) =>
                  item.authorUserId === post.authorUserId
                    ? { ...item, viewerFollowingAuthor: following }
                    : item
                )
              );
              if (!authToken || !post.authorUserId) return;
              void (async () => {
                try {
                  if (following) await followAuthor(authToken, post.authorUserId as number);
                  else await unfollowAuthor(authToken, post.authorUserId as number);
                } catch {
                  setPosts((prev) =>
                    prev.map((item) =>
                      item.authorUserId === post.authorUserId
                        ? { ...item, viewerFollowingAuthor: !following }
                        : item
                    )
                  );
                }
              })();
            }}
            onSaveToggle={(post, saved) => {
              const targetPostId = post.postId;
              setPosts((prev) =>
                prev.map((item) =>
                  (
                    (typeof post.postId === "number" && item.postId === post.postId) ||
                    item.id === post.id
                  )
                    ? {
                        ...item,
                        viewerSaved: saved,
                        saveCount: saved
                          ? (typeof item.saveCount === "number" ? item.saveCount : 0) + 1
                          : Math.max(0, (typeof item.saveCount === "number" ? item.saveCount : 0) - 1),
                      }
                    : item
                )
              );

              if (!authToken || typeof targetPostId !== "number") return;
              void (async () => {
                try {
                  if (saved) {
                    await savePost(authToken, targetPostId);
                    await sendFeedEvent(post, "save", { source: sourceLabel, action: "save" });
                  } else {
                    await unsavePost(authToken, targetPostId);
                  }
                } catch {
                  setPosts((prev) =>
                    prev.map((item) =>
                      (
                        (typeof post.postId === "number" && item.postId === post.postId) ||
                        item.id === post.id
                      )
                        ? {
                            ...item,
                            viewerSaved: !saved,
                            saveCount: !saved
                              ? (typeof item.saveCount === "number" ? item.saveCount : 0) + 1
                              : Math.max(0, (typeof item.saveCount === "number" ? item.saveCount : 0) - 1),
                          }
                        : item
                    )
                  );
                }
              })();
            }}
            onProfileOpen={(post) => {
              void sendFeedEvent(post, "profile_open", { source: sourceLabel });
              const href = getProfileHref(
                { userId: post.authorUserId, role: post.authorRole },
                cachedUser?.id ?? null
              );
              if (href) {
                router.push(href);
              }
            }}
            canShortlist={canShortlist && p.authorRole === "athlete"}
            onShortlistAdd={(post) => {
              const targetAuthorUserId = post.authorUserId;
              if (!authToken || !defaultShortlistId || typeof targetAuthorUserId !== "number") return;
              void (async () => {
                try {
                  await addShortlistItem(authToken, defaultShortlistId, targetAuthorUserId);
                } catch {
                  // non-blocking
                }
              })();
            }}
            onHide={(post) => {
              setHiddenPostKeys((prev) => {
                const next = new Set(prev);
                next.add(postVisibilityKey(post));
                return next;
              });
              if (!authToken || !post.postId) return;
              void (async () => {
                try {
                  await hidePost(authToken, post.postId as number);
                } catch {
                  // keep hidden locally even if API write fails
                }
              })();
            }}
            onReport={(post) => {
              if (!authToken || !post.postId) return;
              void (async () => {
                try {
                  await reportContent(authToken, {
                    targetPostId: post.postId,
                    targetUserId: post.authorUserId,
                    reason: "feed_report",
                  });
                } catch {
                  // non-blocking
                }
              })();
            }}
          />
        </div>
      ))}
      <div
        ref={infiniteSentinelRef}
        className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-5 text-center text-xs text-neutral-500"
      >
        {loadingMore ? "Loading more reels..." : "Keep scrolling"}
      </div>
    </div>
  );
}
