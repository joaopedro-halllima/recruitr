"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPostComment,
  deletePostComment,
  getPostComments,
  likeFeedComment,
  searchUsers,
  unlikeFeedComment,
  type FeedCommentItem,
  type FeedCommentMention,
  type MeUser,
  type SearchUserItem,
} from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { getProfileHref } from "@/lib/profile-routes";

export type PostMedia =
  | { kind: "video"; src: string; poster?: string }
  | { kind: "image"; src: string; alt?: string; items?: string[] }
  | null;

export type Post = {
  id: string;
  postId?: number;
  authorUserId?: number;
  authorRole?: "athlete" | "coach" | "unknown";
  postType?: "athlete" | "coach" | "unknown";
  authorName: string;
  authorMeta: string;
  avatarText: string;
  timeAgo: string;
  caption: string;
  tags: string[];
  media: PostMedia;
  likeCount?: number;
  saveCount?: number;
  commentCount?: number;
  viewerLiked?: boolean;
  viewerSaved?: boolean;
  viewerFollowingAuthor?: boolean;
  canSave?: boolean;
};

type Props = {
  post: Post;
  onLikeToggle?: (post: Post, liked: boolean) => void;
  onFollowToggle?: (post: Post, following: boolean) => void;
  onSaveToggle?: (post: Post, saved: boolean) => void;
  onShortlistAdd?: (post: Post) => void;
  canShortlist?: boolean;
  onProfileOpen?: (post: Post) => void;
  onHide?: (post: Post) => void;
  onReport?: (post: Post) => void;
  commentsDrawerOpen?: boolean;
  onCommentsDrawerOpen?: (post: Post) => void;
  onCommentsDrawerClose?: () => void;
  highlightCommentId?: number | null;
};

type Comment = {
  id: number;
  text: string;
  createdAt: number;
  parentId: number | null;
  likeCount: number;
  likedByViewer: boolean;
  authorName: string;
  authorUserId: number | null;
  mentions: FeedCommentMention[];
  canDelete: boolean;
};

type MentionSuggestion = {
  userId: number;
  handle: string;
  name: string;
  meta: string;
  email: string;
  role: "athlete" | "coach";
};

function HeartIcon({ liked, sizeClass = "h-5 w-5" }: { liked: boolean; sizeClass?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${sizeClass} ${liked ? "fill-rose-500 text-rose-500" : "fill-none text-neutral-200"}`}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShareIcon({ sizeClass = "h-5 w-5" }: { sizeClass?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={sizeClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9z" />
    </svg>
  );
}

function CommentIcon({ sizeClass = "h-5 w-5" }: { sizeClass?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={sizeClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function HideIcon({ sizeClass = "h-5 w-5" }: { sizeClass?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={sizeClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c5 0 9.3 3 11 8-1 2.8-2.8 4.9-5.1 6.3" />
      <path d="M6.3 6.3C3.8 7.8 1.9 10.2 1 12c1.7 5 6 8 11 8 1 0 2-.1 2.9-.4" />
    </svg>
  );
}

function FlagIcon({ sizeClass = "h-5 w-5" }: { sizeClass?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={sizeClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 22V4" />
      <path d="M4 4h12l-1.5 3L16 10H4" />
    </svg>
  );
}

function TrophyIcon({ sizeClass = "h-5 w-5" }: { sizeClass?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={sizeClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 4h8v3a4 4 0 0 1-8 0z" />
      <path d="M6 7H4a2 2 0 0 0 2 2h1" />
      <path d="M18 7h2a2 2 0 0 1-2 2h-1" />
      <path d="M12 11v4" />
      <path d="M9 21h6" />
      <path d="M10 15h4v3h-4z" />
    </svg>
  );
}

function VolumeOnIcon({ sizeClass = "h-5 w-5" }: { sizeClass?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={sizeClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

function VolumeOffIcon({ sizeClass = "h-5 w-5" }: { sizeClass?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={sizeClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="m23 9-6 6" />
      <path d="m17 9 6 6" />
    </svg>
  );
}

function formatCompactCount(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.floor(value));
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function inferViewerName(viewer: MeUser | null): string {
  if (!viewer) return "demo.user";
  const athleteFirst = viewer.athlete_profile?.first_name?.trim();
  const athleteLast = viewer.athlete_profile?.last_name?.trim();
  const coachFirst = viewer.coach_profile?.first_name?.trim();
  const coachLast = viewer.coach_profile?.last_name?.trim();
  const named = [athleteFirst || coachFirst, athleteLast || coachLast].filter(Boolean).join(" ").trim();
  if (named) return named;
  const emailLeft = viewer.email.split("@")[0]?.trim();
  return emailLeft || "demo.user";
}

function toHandle(raw: string, fallbackId: number) {
  const normalized = raw.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "").slice(0, 24);
  return normalized || `user${fallbackId}`;
}

function suggestionFromUser(item: SearchUserItem): MentionSuggestion {
  const base = item.email.split("@")[0] || item.name;
  return {
    userId: item.userId,
    handle: toHandle(base, item.userId),
    name: item.name || item.email,
    meta: item.meta || item.role,
    email: item.email,
    role: item.role,
  };
}

function extractActiveMention(value: string): { query: string; start: number } | null {
  const m = /(^|\s)@([a-zA-Z0-9._-]{1,30})$/.exec(value);
  if (!m) return null;
  const query = m[2];
  const start = value.length - query.length - 1;
  return { query, start };
}

function collectMentionHandles(value: string): string[] {
  const regex = /(^|\s)@([a-zA-Z0-9._-]{2,30})/g;
  const handles = new Set<string>();
  let match: RegExpExecArray | null;
  while (true) {
    match = regex.exec(value);
    if (!match) break;
    handles.add(match[2].toLowerCase());
  }
  return [...handles];
}

function renderCommentText(
  text: string,
  mentions: FeedCommentMention[],
  onMentionClick: (mention: FeedCommentMention) => void
) {
  const mentionLookup = new Map<string, FeedCommentMention>();
  for (const mention of mentions) {
    mentionLookup.set(mention.handle.toLowerCase(), mention);
  }
  const chunks = text.split(/(@[a-zA-Z0-9._-]+)/g);
  return (
    <>
      {chunks.map((chunk, idx) => {
        if (!/^@[a-zA-Z0-9._-]+$/.test(chunk)) {
          return <span key={`${chunk}-${idx}`}>{chunk}</span>;
        }
        const handle = chunk.slice(1).toLowerCase();
        const mention = mentionLookup.get(handle);
        if (!mention) {
          return (
            <span key={`${chunk}-${idx}`} className="font-semibold text-cyan-300">
              {chunk}
            </span>
          );
        }
        return (
          <button
            key={`${chunk}-${idx}`}
            type="button"
            onClick={() => onMentionClick(mention)}
            className="font-semibold text-cyan-300 hover:text-cyan-200"
          >
            {chunk}
          </button>
        );
      })}
    </>
  );
}

export default function PostCard({
  post,
  onLikeToggle,
  onFollowToggle,
  onSaveToggle,
  onShortlistAdd,
  canShortlist = false,
  onProfileOpen,
  onHide,
  onReport,
  commentsDrawerOpen = false,
  onCommentsDrawerOpen,
  onCommentsDrawerClose,
  highlightCommentId = null,
}: Props) {
  const router = useRouter();
  const liked = Boolean(post.viewerLiked);
  const following = Boolean(post.viewerFollowingAuthor);
  const imageItems = useMemo(() => {
    if (post.media?.kind !== "image") return [] as string[];
    const extras = Array.isArray(post.media.items)
      ? post.media.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    if (extras.length > 0) return extras;
    return [post.media.src];
  }, [post.media]);
  const [reported, setReported] = useState(false);
  const [saved, setSaved] = useState(Boolean(post.viewerSaved));
  const [imageIndex, setImageIndex] = useState(0);
  const [shareFeedback, setShareFeedback] = useState<"copied" | "shared" | null>(null);
  const [saveBlockedMessage, setSaveBlockedMessage] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [hoverPreviewTime, setHoverPreviewTime] = useState<number | null>(null);
  const [hoverPreviewRatio, setHoverPreviewRatio] = useState(0);
  const [saveCountLocal, setSaveCountLocal] = useState<number>(typeof post.saveCount === "number" ? post.saveCount : 0);
  const [isMuted, setIsMuted] = useState(true);

  const authToken = useMemo(() => getToken(), []);
  const viewer = useMemo(() => getStoredUser() as MeUser | null, []);
  const viewerName = useMemo(() => inferViewerName(viewer), [viewer]);

  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [mentionOptions, setMentionOptions] = useState<MentionSuggestion[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionLookup, setMentionLookup] = useState<Record<string, MentionSuggestion>>({});
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [commentCountLocal, setCommentCountLocal] = useState(typeof post.commentCount === "number" ? post.commentCount : 0);
  const [flashedCommentId, setFlashedCommentId] = useState<number | null>(null);

  const activeMention = useMemo(() => extractActiveMention(commentText), [commentText]);

  useEffect(() => {
    if (!shareFeedback) return;
    const timeoutId = window.setTimeout(() => setShareFeedback(null), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [shareFeedback]);

  useEffect(() => {
    setSaved(Boolean(post.viewerSaved));
  }, [post.id, post.viewerSaved]);

  useEffect(() => {
    setSaveCountLocal(typeof post.saveCount === "number" ? post.saveCount : 0);
  }, [post.id, post.saveCount]);

  useEffect(() => {
    setImageIndex(0);
  }, [post.id, post.media?.kind]);

  useEffect(() => {
    setHoverPreviewTime(null);
    setHoverPreviewRatio(0);
  }, [post.id, post.media?.kind, post.media?.src]);

  useEffect(() => {
    if (post.media?.kind !== "video") {
      setVideoCurrentTime(0);
      setVideoDuration(0);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      setVideoCurrentTime(video.currentTime || 0);
      setVideoDuration(Number.isFinite(video.duration) ? Math.max(video.duration, 0) : 0);
    };

    sync();
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("timeupdate", sync);
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("ended", sync);

    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
      video.removeEventListener("ended", sync);
    };
  }, [post.id, post.media?.kind, post.media?.src]);

  useEffect(() => {
    if (post.media?.kind !== "video") return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.defaultMuted = isMuted;
    video.dataset.userMuted = isMuted ? "true" : "false";
  }, [isMuted, post.media?.kind]);

  function mergeComments(existing: Comment[], incoming: Comment[]) {
    const byId = new Map<number, Comment>();
    for (const item of existing) byId.set(item.id, item);
    for (const item of incoming) byId.set(item.id, item);
    return Array.from(byId.values());
  }

  useEffect(() => {
    setComments([]);
    setCommentsLoaded(false);
    setCommentsLoading(false);
    setCommentsError(null);
    setReplyToId(null);
    setCommentText("");
    setCommentsHasMore(false);
    setCommentsOffset(0);
    setCommentsLoadingMore(false);
    setCommentCountLocal(typeof post.commentCount === "number" ? post.commentCount : 0);
    setFlashedCommentId(null);
  }, [post.commentCount, post.id]);

  const fetchCommentsPage = useCallback(async (offsetValue: number, append: boolean) => {
    if (!authToken || !post.postId) return;
    if (append) setCommentsLoadingMore(true);
    else setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await getPostComments(authToken, post.postId as number, {
        limit: 20,
        offset: offsetValue,
        focusCommentId: offsetValue === 0 ? highlightCommentId ?? undefined : undefined,
      });
      const normalized = res.items.map((item: FeedCommentItem) => ({
        id: item.id,
        text: item.body,
        createdAt: new Date(item.createdAt).getTime(),
        parentId: item.parentCommentId,
        likeCount: item.likeCount,
        likedByViewer: item.viewerLiked,
        authorName: item.authorName,
        authorUserId: item.authorUserId,
        mentions: item.mentions ?? [],
        canDelete: item.canDelete,
      }));
      setComments((prev) => (append ? mergeComments(prev, normalized) : normalized));
      setCommentsLoaded(true);
      setCommentsHasMore(Boolean(res.hasMore));
      setCommentsOffset(offsetValue + res.limit);
    } catch (err) {
      setCommentsError(err instanceof Error ? err.message : "Failed to load comments.");
    } finally {
      if (append) setCommentsLoadingMore(false);
      else setCommentsLoading(false);
    }
  }, [authToken, highlightCommentId, post.postId]);

  useEffect(() => {
    if (!commentsDrawerOpen || !authToken || !post.postId || commentsLoaded) return;
    void fetchCommentsPage(0, false);
  }, [authToken, commentsDrawerOpen, commentsLoaded, fetchCommentsPage, post.postId]);

  useEffect(() => {
    if (!activeMention || !authToken) {
      setMentionOptions([]);
      setMentionLoading(false);
      return;
    }

    const q = activeMention.query.trim();
    if (q.length < 1) {
      setMentionOptions([]);
      setMentionLoading(false);
      return;
    }

    let cancelled = false;
    setMentionLoading(true);
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await searchUsers(authToken, { q, limit: 6 });
          if (cancelled) return;
          const options = res.items.map(suggestionFromUser);
          setMentionOptions(options);
          setMentionLookup((prev) => {
            const next = { ...prev };
            for (const option of options) {
              next[option.handle.toLowerCase()] = option;
            }
            return next;
          });
        } catch {
          if (!cancelled) setMentionOptions([]);
        } finally {
          if (!cancelled) setMentionLoading(false);
        }
      })();
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeMention, authToken]);

  useEffect(() => {
    if (!commentsDrawerOpen || !commentsLoaded || !highlightCommentId || typeof document === "undefined") return;
    const element = document.getElementById(`comment-node-${post.id}-${highlightCommentId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashedCommentId(highlightCommentId);
    const timeoutId = window.setTimeout(() => {
      setFlashedCommentId((current) => (current === highlightCommentId ? null : current));
    }, 2200);
    return () => window.clearTimeout(timeoutId);
  }, [commentsDrawerOpen, commentsLoaded, highlightCommentId, post.id]);

  const commentCount = commentCountLocal;
  const likeCount = typeof post.likeCount === "number" ? post.likeCount : 0;
  const saveCount = Math.max(0, saveCountLocal);
  const canSave = post.canSave !== false;
  const imageAlt = post.media?.kind === "image" ? post.media.alt : undefined;

  const prettyTime = useMemo(() => {
    return (ts: number) => {
      const diff = Date.now() - ts;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h`;
      const days = Math.floor(hrs / 24);
      return `${days}d`;
    };
  }, []);

  const commentsByParent = useMemo(() => {
    const map = new Map<number | null, Comment[]>();
    for (const comment of comments) {
      const list = map.get(comment.parentId) || [];
      list.push(comment);
      map.set(comment.parentId, list);
    }
    for (const [parentId, list] of map.entries()) {
      list.sort((a, b) => (parentId === null ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
    }
    return map;
  }, [comments]);

  const commentById = useMemo(() => {
    const map = new Map<number, Comment>();
    comments.forEach((c) => map.set(c.id, c));
    return map;
  }, [comments]);

  const replyTarget = replyToId ? commentById.get(replyToId) || null : null;
  const rootComments = commentsByParent.get(null) || [];

  function handleMentionClick(mention: FeedCommentMention) {
    const href = getProfileHref(
      { userId: mention.userId, role: mention.role ?? null },
      viewer?.id ?? null
    );
    if (href) router.push(href);
  }

  function applyMention(option: MentionSuggestion) {
    if (!activeMention) return;
    const nextText = `${commentText.slice(0, activeMention.start)}@${option.handle} `;
    setCommentText(nextText);
    setMentionOptions([]);
    setMentionLoading(false);
    setMentionLookup((prev) => ({
      ...prev,
      [option.handle.toLowerCase()]: option,
    }));
  }

  async function addComment() {
    const text = commentText.trim();
    if (!text || !authToken || !post.postId || commentSubmitting) return;

    const mentionHandles = collectMentionHandles(text);
    const mentions = mentionHandles
      .map((handle) => mentionLookup[handle.toLowerCase()])
      .filter((m): m is MentionSuggestion => Boolean(m))
      .map((m) => ({
        userId: m.userId,
        handle: m.handle,
        label: m.name,
      }));

    setCommentSubmitting(true);
    try {
      const res = await createPostComment(authToken, post.postId as number, {
        body: text,
        parentCommentId: replyToId,
        mentions,
      });
      const created = res.comment;
      const normalized: Comment = {
        id: created.id,
        text: created.body,
        createdAt: new Date(created.createdAt).getTime(),
        parentId: created.parentCommentId,
        likeCount: created.likeCount,
        likedByViewer: created.viewerLiked,
        authorName: created.authorName || viewerName,
        authorUserId: created.authorUserId ?? viewer?.id ?? null,
        mentions: created.mentions ?? [],
        canDelete: created.canDelete,
      };
      setComments((prev) => [...prev, normalized]);
      setCommentsLoaded(true);
      setCommentCountLocal((prev) => prev + 1);
      setCommentText("");
      setReplyToId(null);
      setMentionOptions([]);
      setMentionLoading(false);
      setCommentsError(null);
    } catch (err) {
      setCommentsError(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  function toggleCommentLike(commentId: number) {
    const target = comments.find((comment) => comment.id === commentId);
    if (!target || !authToken) return;
    const nextLiked = !target.likedByViewer;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              likedByViewer: nextLiked,
              likeCount: nextLiked ? c.likeCount + 1 : Math.max(0, c.likeCount - 1),
            }
          : c
      )
    );
    void (async () => {
      try {
        if (nextLiked) await likeFeedComment(authToken, commentId);
        else await unlikeFeedComment(authToken, commentId);
      } catch {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likedByViewer: target.likedByViewer,
                  likeCount: target.likeCount,
                }
              : c
          )
        );
      }
    })();
  }

  function deleteComment(commentId: number) {
    const previous = comments;
    let removedCount = 0;
    setComments((prev) => {
      const removeIds = new Set<number>([commentId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const item of prev) {
          if (item.parentId && removeIds.has(item.parentId) && !removeIds.has(item.id)) {
            removeIds.add(item.id);
            changed = true;
          }
        }
      }
      removedCount = removeIds.size;
      return prev.filter((c) => !removeIds.has(c.id));
    });
    if (removedCount > 0) {
      setCommentCountLocal((prev) => Math.max(0, prev - removedCount));
    }
    if (replyToId === commentId) setReplyToId(null);
    if (!authToken) return;
    void (async () => {
      try {
        await deletePostComment(authToken, commentId);
      } catch (err) {
        setComments(previous);
        setCommentsError(err instanceof Error ? err.message : "Failed to delete comment.");
      }
    })();
  }

  function handleLikeToggle() {
    onLikeToggle?.(post, !liked);
  }

  function handleReport() {
    if (reported) return;
    setReported(true);
    onReport?.(post);
  }

  async function handleShare() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard?post=${encodeURIComponent(post.id)}`
        : "";
    const text = `${post.authorName}: ${post.caption}`.trim();
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: "Recruitr post", text, url });
        setShareFeedback("shared");
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url || text);
        setShareFeedback("copied");
      }
    } catch {
      // ignore share cancellation/failures
    }
  }

  function handleFollowToggle() {
    onFollowToggle?.(post, !following);
  }

  function handleSaveToggle() {
    if (!canSave) {
      setSaveBlockedMessage("Coach posts cannot be saved.");
      return;
    }
    setSaved((prev) => {
      const next = !prev;
      setSaveCountLocal((count) => (next ? count + 1 : Math.max(0, count - 1)));
      onSaveToggle?.(post, next);
      if (next && canShortlist) {
        onShortlistAdd?.(post);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!saveBlockedMessage) return;
    const timeoutId = window.setTimeout(() => setSaveBlockedMessage(null), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [saveBlockedMessage]);

  function toggleVideoPlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
      return;
    }
    video.pause();
  }

  function toggleVideoMute() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    video.muted = nextMuted;
    video.defaultMuted = nextMuted;
    video.dataset.userMuted = nextMuted ? "true" : "false";
    if (!nextMuted && video.paused) {
      void video.play().catch(() => {});
    }
  }

  function seekVideo(nextValue: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(nextValue)) return;
    const clamped = Math.max(0, Math.min(nextValue, Number.isFinite(video.duration) ? video.duration : nextValue));
    video.currentTime = clamped;
    setVideoCurrentTime(clamped);
  }

  function ratioFromClientX(clientX: number) {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, ratio));
  }

  function handleTimelineHover(clientX: number) {
    if (videoDuration <= 0) {
      setHoverPreviewTime(null);
      setHoverPreviewRatio(0);
      return;
    }
    const ratio = ratioFromClientX(clientX);
    setHoverPreviewRatio(ratio);
    setHoverPreviewTime(ratio * videoDuration);
  }

  function handleTimelineSeek(clientX: number) {
    if (videoDuration <= 0) return;
    const ratio = ratioFromClientX(clientX);
    seekVideo(ratio * videoDuration);
  }

  function renderCommentNode(comment: Comment, depth = 0) {
    if (depth > 6) return null;
    const replies = commentsByParent.get(comment.id) || [];
    return (
      <div
        key={comment.id}
        id={`comment-node-${post.id}-${comment.id}`}
        className={depth === 0 ? "" : "ml-4 mt-2 border-l border-white/10 pl-3"}
      >
        <div
          className={`rounded-xl border px-3 py-2 transition ${
            flashedCommentId === comment.id
              ? "border-cyan-300/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_24px_rgba(34,211,238,0.12)]"
              : "border-white/10 bg-neutral-950/30"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-neutral-500">
                {comment.authorName} • {prettyTime(comment.createdAt)}
              </div>
              <div className="mt-1 break-words text-sm text-neutral-200">
                {renderCommentText(comment.text, comment.mentions, handleMentionClick)}
              </div>
            </div>
            {comment.canDelete ? (
              <button
                onClick={() => deleteComment(comment.id)}
                className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] text-neutral-300 hover:bg-white/10"
                title="Delete comment"
              >
                X
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
            <button
              onClick={() => toggleCommentLike(comment.id)}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 hover:bg-white/10"
              title={comment.likedByViewer ? "Unlike comment" : "Like comment"}
            >
              <HeartIcon liked={comment.likedByViewer} sizeClass="h-3.5 w-3.5" />
              {comment.likeCount}
            </button>
            <button
              onClick={() => setReplyToId(comment.id)}
              className="rounded-md border border-white/10 px-2 py-1 hover:bg-white/10"
            >
              Reply
            </button>
          </div>
        </div>

        {replies.length > 0 ? (
          <div className="mt-2 space-y-2">{replies.map((reply) => renderCommentNode(reply, depth + 1))}</div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <article className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[2.6rem] border border-white/10 bg-white/5">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => onProfileOpen?.(post)}
            className="flex items-center gap-3 text-left"
            title="Open profile"
          >
            <div className="grid h-9 w-9 place-items-center rounded-full bg-fuchsia-500/70 text-sm font-semibold">
              {post.avatarText}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{post.authorName}</div>
              <div className="text-xs text-neutral-400">{post.authorMeta}</div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFollowToggle}
              className="rounded-lg border border-white/10 px-2 py-1 text-[10px] hover:bg-white/10"
            >
              {following ? "Following" : "Follow"}
            </button>
            <div className="text-xs text-neutral-500">{post.timeAgo}</div>
          </div>
        </div>

        {/* Media + floating actions */}
        <div className="relative bg-black/20">
          {post.media?.kind === "video" ? (
            <div className="relative">
              <video
                ref={videoRef}
                className="aspect-[9/16] w-full cursor-pointer bg-black object-contain"
                playsInline
                preload="metadata"
                poster={post.media.poster}
                muted={isMuted}
                loop
                data-reel-video="true"
                data-postid={post.id}
                onClick={toggleVideoPlayback}
              >
                <source src={post.media.src} type="video/mp4" />
              </video>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVideoMute();
                }}
                className="absolute left-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeOffIcon sizeClass="h-5 w-5" /> : <VolumeOnIcon sizeClass="h-5 w-5" />}
              </button>
              <div className="absolute inset-x-3 bottom-3 z-20">
                <div
                  ref={progressBarRef}
                  onMouseMove={(e) => handleTimelineHover(e.clientX)}
                  onMouseLeave={() => setHoverPreviewTime(null)}
                  onClick={(e) => handleTimelineSeek(e.clientX)}
                  className="group relative h-1.5 cursor-pointer rounded-full bg-cyan-100/25"
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-cyan-300"
                    style={{
                      width: `${videoDuration > 0 ? Math.max(0, Math.min(100, (videoCurrentTime / videoDuration) * 100)) : 0}%`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-50/80 bg-cyan-300 opacity-0 shadow-[0_0_14px_rgba(56,189,248,0.8)] transition-opacity group-hover:opacity-100"
                    style={{
                      left: `${videoDuration > 0 ? Math.max(0, Math.min(100, (videoCurrentTime / videoDuration) * 100)) : 0}%`,
                    }}
                  />
                  {hoverPreviewTime !== null && videoDuration > 0 ? (
                    <div
                      className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-cyan-100"
                      style={{ left: `${Math.max(0, Math.min(100, hoverPreviewRatio * 100))}%` }}
                    >
                      {formatClock(hoverPreviewTime)} / {formatClock(videoDuration)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : post.media?.kind === "image" ? (
            <div className="relative aspect-[9/16] overflow-hidden bg-black">
              <div
                className="flex h-full w-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${Math.max(0, Math.min(imageIndex, Math.max(imageItems.length - 1, 0))) * 100}%)` }}
              >
                {imageItems.map((src, idx) => (
                  <img
                    key={`${post.id}-img-${idx}`}
                    src={src}
                    alt={imageAlt ?? `post image ${idx + 1}`}
                    className="h-full w-full flex-none object-contain"
                  />
                ))}
              </div>
              {imageItems.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setImageIndex((prev) => Math.max(0, prev - 1))}
                    disabled={imageIndex <= 0}
                    className="absolute left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur transition hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Previous photo"
                    title="Previous photo"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageIndex((prev) => Math.min(imageItems.length - 1, prev + 1))}
                    disabled={imageIndex >= imageItems.length - 1}
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur transition hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Next photo"
                    title="Next photo"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                    {imageItems.map((_, idx) => (
                      <button
                        key={`${post.id}-dot-${idx}`}
                        type="button"
                        onClick={() => setImageIndex(idx)}
                        className={`h-2.5 rounded-full transition ${idx === imageIndex ? "w-5 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70"}`}
                        aria-label={`Go to image ${idx + 1}`}
                        title={`Image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="grid aspect-[9/16] place-items-center text-sm text-neutral-500">
              Media placeholder (image/video)
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />

          <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
            <button
              onClick={handleLikeToggle}
              title={liked ? "Unlike" : "Like"}
              aria-label={liked ? "Unlike" : "Like"}
              className="group flex flex-col items-center gap-1"
            >
              <span className={`grid h-12 w-12 place-items-center text-neutral-100 drop-shadow-[0_3px_12px_rgba(0,0,0,0.72)] transition group-hover:scale-105 ${liked ? "text-rose-400" : ""}`}>
                <HeartIcon liked={liked} sizeClass="h-9 w-9" />
              </span>
              <span className="text-[13px] font-semibold text-white/95">{formatCompactCount(likeCount)}</span>
            </button>

            <button
              onClick={() => onCommentsDrawerOpen?.(post)}
              title="Comments"
              aria-label="Open comments"
              className="group flex flex-col items-center gap-1"
            >
              <span className="grid h-12 w-12 place-items-center text-neutral-100 drop-shadow-[0_3px_12px_rgba(0,0,0,0.72)] transition group-hover:scale-105">
                <CommentIcon sizeClass="h-9 w-9" />
              </span>
              <span className="text-[13px] font-semibold text-white/95">{formatCompactCount(commentCount)}</span>
            </button>

            <button
              onClick={handleSaveToggle}
              title={canSave ? (saved ? "Saved" : "Save") : "Coach posts cannot be saved"}
              aria-label={canSave ? (saved ? "Saved" : "Save") : "Coach posts cannot be saved"}
              className="group flex flex-col items-center gap-1"
            >
              <span className={`grid h-12 w-12 place-items-center text-neutral-100 drop-shadow-[0_3px_12px_rgba(0,0,0,0.72)] transition group-hover:scale-105 ${saved ? "text-cyan-300" : ""} ${!canSave ? "opacity-45" : ""}`}>
                <TrophyIcon sizeClass="h-9 w-9" />
              </span>
              <span className="text-[13px] font-semibold text-white/95">{formatCompactCount(saveCount)}</span>
            </button>

            <button
              onClick={handleShare}
              title="Share"
              aria-label="Share"
              className="group flex flex-col items-center gap-1"
            >
              <span className="grid h-12 w-12 place-items-center text-neutral-100 drop-shadow-[0_3px_12px_rgba(0,0,0,0.72)] transition group-hover:scale-105">
                <ShareIcon sizeClass="h-9 w-9" />
              </span>
              <span className="text-[13px] font-semibold text-white/95">Share</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {shareFeedback ? (
            <div className="mt-1 text-xs text-cyan-300">{shareFeedback === "copied" ? "Link copied." : "Shared."}</div>
          ) : null}
          {saveBlockedMessage ? <div className="mt-1 text-xs text-amber-300">{saveBlockedMessage}</div> : null}

          {/* Caption */}
          <p className="mt-2 text-sm text-neutral-200">{post.caption}</p>

          {/* Tags */}
          <div className="mt-2 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-neutral-300">
                {t}
              </span>
            ))}
          </div>

          <div className="mt-4 text-xs text-neutral-500">
            {liked ? "You liked this • " : ""}
            {commentCount} comments
          </div>
        </div>
      </article>

      <div className={`fixed inset-0 z-[90] ${commentsDrawerOpen ? "" : "pointer-events-none"}`}>
        <button
          type="button"
          aria-label="Close comments panel"
          onClick={() => onCommentsDrawerClose?.()}
          className={`absolute inset-0 bg-black/55 transition-opacity ${commentsDrawerOpen ? "opacity-100" : "opacity-0"}`}
        />

        <aside
          className={`absolute right-0 top-14 h-[calc(100vh-3.5rem)] w-full max-w-[420px] overflow-hidden border-l border-white/15 bg-[#0b1220]/95 backdrop-blur transition-transform duration-300 ${commentsDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-neutral-100">Comments</div>
                <div className="text-xs text-neutral-400">{commentCount} total</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onHide?.(post)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/10"
                  title="Hide post"
                >
                  <HideIcon />
                </button>
                <button
                  onClick={handleReport}
                  disabled={reported}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/10 disabled:opacity-50"
                  title={reported ? "Reported" : "Report post"}
                >
                  <FlagIcon />
                </button>
                <button
                  onClick={() => onCommentsDrawerClose?.()}
                  className="rounded-lg border border-white/10 px-2 py-1 text-xs text-neutral-200 hover:bg-white/10"
                  title="Close"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {commentsLoading ? (
                  <div className="text-sm text-neutral-500">Loading comments...</div>
                ) : commentsError ? (
                  <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {commentsError}
                  </div>
                ) : rootComments.length === 0 ? (
                  <div className="text-sm text-neutral-500">No comments yet.</div>
                ) : (
                  rootComments.map((comment) => renderCommentNode(comment, 0))
                )}
                {!commentsLoading && !commentsError && commentsHasMore ? (
                  <button
                    type="button"
                    onClick={() => void fetchCommentsPage(commentsOffset, true)}
                    disabled={commentsLoadingMore}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {commentsLoadingMore ? "Loading more..." : "Load more comments"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="border-t border-white/10 px-4 py-3">
              {replyTarget ? (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                  <span>
                    Replying to <strong>{replyTarget.authorName}</strong>
                  </span>
                  <button onClick={() => setReplyToId(null)} className="rounded-md border border-cyan-300/30 px-2 py-1 hover:bg-cyan-500/10">
                    Cancel
                  </button>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    disabled={commentSubmitting}
                    className="min-h-[52px] w-full resize-none rounded-xl border border-white/10 bg-neutral-950/30 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/10"
                    placeholder="Write a comment... Use @ to tag users."
                  />
                  {(mentionLoading || mentionOptions.length > 0) && activeMention ? (
                    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl border border-white/10 bg-neutral-950/95 p-2 shadow-xl">
                      {mentionLoading ? (
                        <div className="px-2 py-2 text-xs text-neutral-400">Finding users...</div>
                      ) : mentionOptions.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-neutral-500">No users found</div>
                      ) : (
                        <div className="space-y-1">
                          {mentionOptions.map((option) => (
                            <button
                              key={`${option.userId}-${option.handle}`}
                              onClick={() => applyMention(option)}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm text-neutral-100">{option.name}</div>
                                <div className="truncate text-xs text-neutral-500">{option.meta}</div>
                              </div>
                              <div className="ml-2 text-xs text-cyan-300">@{option.handle}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={addComment}
                  disabled={commentSubmitting || !commentText.trim()}
                  className="h-[52px] shrink-0 rounded-xl bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {commentSubmitting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
