import { resolveApiBase } from "@/lib/api-base";

export type DemoRole = "coach" | "athlete";
export type UserRole = "coach" | "athlete";

export type CoachProfile = {
  id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  organization_name: string | null;
  school_unitid: string | null;
  school_name: string | null;
  sport: string | null;
  level: string | null;
  bio: string | null;
  is_verified_coach: boolean;
  avatar_media_asset_id?: number | null;
  banner_media_asset_id?: number | null;
  avatar_url?: string | null;
  banner_url?: string | null;
};

export type AthleteProfile = {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  sport: string | null;
  grad_year: number | null;
  positions: string[];
  state: string | null;
  country: string | null;
  willing_to_travel: boolean | null;
  travel_radius_mi: number | null;
  club_team: string | null;
  school_unitid: string | null;
  school_name: string | null;
  high_school: string | null;
  bio: string | null;
  avatar_media_asset_id?: number | null;
  banner_media_asset_id?: number | null;
  avatar_url?: string | null;
  banner_url?: string | null;
};

export type MeUser = {
  id: number;
  email: string;
  is_email_verified: boolean;
  roles: string[];
  primary_role: string | null;
  coach_profile: CoachProfile | null;
  athlete_profile: AthleteProfile | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: MeUser;
};

export type ActionResponse = {
  ok: boolean;
  message: string;
  dev_link?: string | null;
};

export type NotificationItem = {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export type NotificationsResponse = {
  unreadCount: number;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  items: NotificationItem[];
};

export type DmThread = {
  threadId: string;
  coachUserId: number;
  athleteUserId: number;
  coachName: string | null;
  athleteName: string | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastMessageSenderUserId: number | null;
  unreadCount: number;
};

export type DmThreadsResponse = {
  items: DmThread[];
};

export type DmMessage = {
  id: number;
  senderUserId: number;
  body: string;
  createdAt: string;
  attachments: Array<{
    mediaAssetId: number;
    kind: "image" | "video" | "document";
    publicUrl: string | null;
    thumbPublicUrl: string | null;
    mimeType: string | null;
  }>;
};

export type DmMessagesResponse = {
  threadId: string;
  items: DmMessage[];
  hasMore: boolean;
  nextBeforeId: number | null;
};

export type DmAthleteSearchItem = {
  userId: number;
  name: string;
  email: string;
  meta: string;
  existingThreadId: string | null;
};

export type DmAthleteSearchResponse = {
  items: DmAthleteSearchItem[];
};

export type AthleteProfileForm = {
  userId?: number;
  firstName: string;
  lastName: string;
  sport: string;
  gradYear: number | null;
  positions: string[];
  state: string;
  country: string;
  willingToTravel: boolean;
  travelRadiusMi: number | null;
  clubTeam: string;
  schoolUnitId: string | null;
  schoolName: string;
  highSchool: string;
  bio: string;
  avatarMediaAssetId?: number | null;
  bannerMediaAssetId?: number | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
};

export type CoachProfileForm = {
  id?: number;
  userId?: number;
  firstName: string;
  lastName: string;
  title: string;
  organizationName: string;
  schoolUnitId: string | null;
  schoolName: string;
  sport: string;
  level: string;
  bio: string;
  isVerifiedCoach?: boolean;
  avatarMediaAssetId?: number | null;
  bannerMediaAssetId?: number | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
};

export type MyPostItem = {
  id: number;
  publicId: string;
  caption: string;
  sport: string;
  createdAt: string;
  media: { kind: "image" | "video"; src: string } | null;
  tags: string[];
};

export type ShortlistItem = {
  athleteUserId: number;
  name: string;
  meta: string;
  note: string | null;
  createdAt: string;
};

export type ShortlistList = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string | null;
  items: ShortlistItem[];
};

export type SavedShortlistPost = {
  postId: number;
  athleteUserId: number;
  athleteName: string;
  athleteMeta: string;
  caption: string;
  createdAt: string;
  savedAt: string;
  tags: string[];
  media: { kind: "image" | "video"; src: string } | null;
};

export type FeedCommentMention = {
  userId: number;
  handle: string;
  label: string;
  role?: "athlete" | "coach" | null;
};

export type FeedCommentItem = {
  id: number;
  postId: number;
  parentCommentId: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorUserId: number;
  authorName: string;
  likeCount: number;
  viewerLiked: boolean;
  canDelete: boolean;
  mentions: FeedCommentMention[];
};

export type FeedCommentsResponse = {
  items: FeedCommentItem[];
  total: number;
  totalRootComments: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type SafetyUserItem = {
  userId: number;
  email: string;
  name: string;
  createdAt: string;
};

export type HiddenPostItem = {
  postId: number;
  caption: string;
  hiddenAt: string;
};

export type SearchUserItem = {
  userId: number;
  email: string;
  role: "athlete" | "coach";
  name: string;
  sport: string | null;
  gradYear: number | null;
  positions: string[];
  state: string | null;
  organizationName: string | null;
  level: string | null;
  schoolName?: string | null;
  meta: string;
};

export type SchoolCardItem = {
  unitid: string;
  name: string;
  city: string | null;
  state: string | null;
  website: string | null;
  logo_url: string | null;
  level: string | null;
  sector: string | null;
  conference: string | null;
};

export type SchoolDirectoryResponse = {
  items: SchoolCardItem[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export type SchoolDetail = {
  unitid: string;
  name: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  level: string | null;
  sector: string | null;
  conference: string | null;
  logo_url: string | null;
  derived_logo_url: string | null;
  logo_source: "stored" | "clearbit" | "initials";
  logo_initials: string;
  team_count: number;
  selected_by_current_user: boolean;
};

export type SchoolTeamMembership = {
  id: number;
  role: "athlete" | "coach" | "staff";
  status: "pending" | "active" | "rejected";
};

export type PendingTeamMembership = {
  membershipId: number;
  userId: number;
  name: string;
  email: string;
  role: "athlete" | "coach" | "staff";
  status: "pending" | "active" | "rejected";
  createdAt: string;
};

export type SchoolTeamItem = {
  id: number;
  schoolUnitid: string;
  sport: string;
  teamName: string;
  createdByUserId: number;
  createdAt: string;
  activeMemberCount: number;
  pendingMemberCount: number;
  myMembership: SchoolTeamMembership | null;
  canManageMemberships: boolean;
  pendingMemberships: PendingTeamMembership[];
};

export type CoachVerificationRequestItem = {
  id: number;
  status: "submitted" | "approved" | "rejected";
  evidenceMediaAssetId: number | null;
  notes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type CoachVerificationStatusResponse = {
  isCoach: boolean;
  isVerifiedCoach: boolean;
  schoolUnitid: string | null;
  latestRequest: CoachVerificationRequestItem | null;
};

export type PublicMetrics = {
  signups: number;
  active_users: number;
  waitlisted: number;
  pageviews: number;
  active_users_window_days: number;
};

const API_BASE = resolveApiBase();

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
        const first = data.detail[0];
        if (typeof first === "string") {
          message = first;
        } else if (typeof first?.msg === "string") {
          message = first.msg;
        } else {
          message = `Request failed (${res.status})`;
        }
      }
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function devLogin(role: DemoRole): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });

  return handleJson<AuthResponse>(res);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleJson<AuthResponse>(res);
}

export async function requestPasswordReset(email: string): Promise<ActionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleJson<ActionResponse>(res);
}

export async function confirmPasswordReset(token: string, password: string): Promise<ActionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  return handleJson<ActionResponse>(res);
}

export async function requestEmailVerification(email: string): Promise<ActionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/email-verification/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleJson<ActionResponse>(res);
}

export async function confirmEmailVerification(token: string): Promise<ActionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/email-verification/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return handleJson<ActionResponse>(res);
}

export async function register(payload: {
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  title?: string;
  organizationName?: string;
  sport?: string;
  level?: string;
  bio?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      role: payload.role,
      first_name: payload.firstName,
      last_name: payload.lastName,
      title: payload.title,
      organization_name: payload.organizationName,
      sport: payload.sport,
      level: payload.level,
      bio: payload.bio,
    }),
  });
  return handleJson<AuthResponse>(res);
}

export async function getMe(token: string): Promise<MeUser> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return handleJson<MeUser>(res);
}

export async function getPublicMetrics(): Promise<PublicMetrics> {
  const res = await fetch(`${API_BASE}/api/v1/metrics`, {
    cache: "no-store",
  });
  return handleJson<PublicMetrics>(res);
}

export async function trackPageView(
  payload: {
    path: string;
    visitorId?: string | null;
    referrer?: string;
    title?: string;
  },
  token?: string
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/v1/metrics/pageview`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      path: payload.path,
      visitor_id: payload.visitorId ?? null,
      referrer: payload.referrer,
      title: payload.title,
    }),
    keepalive: true,
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function getNotifications(
  token: string,
  params?: { limit?: number; offset?: number; unreadOnly?: boolean; type?: string }
): Promise<NotificationsResponse> {
  const url = new URL(`${API_BASE}/api/v1/notifications`);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (typeof params?.offset === "number") url.searchParams.set("offset", String(params.offset));
  if (params?.unreadOnly) url.searchParams.set("unread_only", "true");
  if (params?.type) url.searchParams.set("type", params.type);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return handleJson<NotificationsResponse>(res);
}

export async function markNotificationRead(token: string, notificationId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/notifications/${notificationId}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function markAllNotificationsRead(token: string): Promise<number> {
  const res = await fetch(`${API_BASE}/api/v1/notifications/read-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await handleJson<{ ok: boolean; updated: number }>(res);
  return data.updated;
}

export async function getDmThreads(token: string, limit = 50): Promise<DmThreadsResponse> {
  const url = new URL(`${API_BASE}/api/v1/dm/threads`);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<DmThreadsResponse>(res);
}

export async function searchDmAthletes(
  token: string,
  q: string,
  limit = 12
): Promise<DmAthleteSearchResponse> {
  const url = new URL(`${API_BASE}/api/v1/dm/search-athletes`);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<DmAthleteSearchResponse>(res);
}

export async function createDmThread(
  token: string,
  athleteUserId: number,
  initialMessage: string,
  mediaAssetIds: number[] = []
): Promise<{ threadId: string }> {
  const res = await fetch(`${API_BASE}/api/v1/dm/threads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      athlete_user_id: athleteUserId,
      initial_message: initialMessage,
      media_asset_ids: mediaAssetIds,
    }),
  });
  const data = await handleJson<{ threadId: string }>(res);
  return { threadId: data.threadId };
}

export async function getDmMessages(
  token: string,
  threadId: string,
  params?: { limit?: number; beforeId?: number }
): Promise<DmMessagesResponse> {
  const url = new URL(`${API_BASE}/api/v1/dm/threads/${threadId}/messages`);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (typeof params?.beforeId === "number") url.searchParams.set("before_id", String(params.beforeId));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<DmMessagesResponse>(res);
}

export async function sendDmMessage(
  token: string,
  threadId: string,
  body: string,
  mediaAssetIds: number[] = []
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/dm/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body, media_asset_ids: mediaAssetIds }),
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function createDmMediaAsset(
  token: string,
  payload: {
    kind: "image" | "video" | "document";
    publicUrl: string;
    thumbPublicUrl?: string;
    mimeType?: string;
    byteSize?: number;
  }
): Promise<{ mediaAssetId: number }> {
  const res = await fetch(`${API_BASE}/api/v1/dm/media-assets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: payload.kind,
      public_url: payload.publicUrl,
      thumb_public_url: payload.thumbPublicUrl,
      mime_type: payload.mimeType,
      byte_size: payload.byteSize,
    }),
  });
  const data = await handleJson<{ mediaAssetId: number }>(res);
  return { mediaAssetId: data.mediaAssetId };
}

export async function createDmUploadSession(
  token: string,
  file: File,
  kind: "image" | "video" | "document"
): Promise<{ uploadId: string; uploadUrl: string }> {
  const res = await fetch(`${API_BASE}/api/v1/uploads/dm/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      byte_size: file.size,
      kind,
    }),
  });
  const data = await handleJson<{ uploadId: string; uploadUrl: string }>(res);
  return { uploadId: data.uploadId, uploadUrl: data.uploadUrl };
}

export function uploadFileWithProgress(
  token: string,
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ mediaAssetId: number; publicUrl: string; kind: "image" | "video" | "document" }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable || !onProgress) return;
      const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      onProgress(pct);
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status})`));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as {
          mediaAssetId: number;
          publicUrl: string;
          kind: "image" | "video" | "document";
        };
        resolve(data);
      } catch {
        reject(new Error("Upload response parse failed"));
      }
    };

    xhr.send(file);
  });
}

export async function createPostUploadSession(
  token: string,
  file: File,
  kind: "image" | "video"
): Promise<{ uploadId: string; uploadUrl: string }> {
  const res = await fetch(`${API_BASE}/api/v1/uploads/posts/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      byte_size: file.size,
      kind,
    }),
  });
  const data = await handleJson<{ uploadId: string; uploadUrl: string }>(res);
  return { uploadId: data.uploadId, uploadUrl: data.uploadUrl };
}

export async function createProfileUploadSession(
  token: string,
  file: File
): Promise<{ uploadId: string; uploadUrl: string }> {
  const res = await fetch(`${API_BASE}/api/v1/uploads/profile/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      byte_size: file.size,
      kind: "image",
    }),
  });
  const data = await handleJson<{ uploadId: string; uploadUrl: string }>(res);
  return { uploadId: data.uploadId, uploadUrl: data.uploadUrl };
}

export async function createPost(
  token: string,
  payload: { caption: string; sport: string; mediaAssetIds: number[]; tags: string[] }
): Promise<{ ok: boolean; postId: number; postPublicId: string; createdAt: string; postType?: "athlete" | "coach" }> {
  const res = await fetch(`${API_BASE}/api/v1/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      caption: payload.caption,
      sport: payload.sport,
      media_asset_ids: payload.mediaAssetIds,
      tags: payload.tags,
    }),
  });
  return handleJson<{ ok: boolean; postId: number; postPublicId: string; createdAt: string; postType?: "athlete" | "coach" }>(res);
}

export async function getMyPosts(token: string, limit = 12): Promise<{ items: MyPostItem[] }> {
  const url = new URL(`${API_BASE}/api/v1/posts/mine`);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: MyPostItem[] }>(res);
}

export async function getPostsByUser(
  token: string,
  userId: number,
  limit = 12
): Promise<{ items: MyPostItem[] }> {
  const url = new URL(`${API_BASE}/api/v1/posts/user/${userId}`);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: MyPostItem[] }>(res);
}

export async function getFeedPost(
  token: string,
  postId: number
): Promise<{
  item: {
    id: string;
    postId?: number;
    authorUserId?: number;
    authorRole?: "athlete" | "coach" | "unknown";
    postType?: "athlete" | "coach" | "unknown";
    authorName: string;
    authorMeta: string;
    avatarText?: string;
    time?: string;
    timeAgo?: string;
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
}> {
  const res = await fetch(`${API_BASE}/api/v1/feed/posts/${postId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson(res);
}

export async function getPostComments(
  token: string,
  postId: number,
  params?: { limit?: number; offset?: number; focusCommentId?: number }
): Promise<FeedCommentsResponse> {
  const url = new URL(`${API_BASE}/api/v1/feed/posts/${postId}/comments`);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (typeof params?.offset === "number") url.searchParams.set("offset", String(params.offset));
  if (typeof params?.focusCommentId === "number") {
    url.searchParams.set("focus_comment_id", String(params.focusCommentId));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<FeedCommentsResponse>(res);
}

export async function createPostComment(
  token: string,
  postId: number,
  payload: {
    body: string;
    parentCommentId?: number | null;
    mentions?: FeedCommentMention[];
  }
): Promise<{ ok: boolean; comment: FeedCommentItem }> {
  const res = await fetch(`${API_BASE}/api/v1/feed/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: payload.body,
      parent_comment_id: payload.parentCommentId ?? null,
      mentions: (payload.mentions ?? []).map((mention) => ({
        user_id: mention.userId,
        handle: mention.handle,
        label: mention.label,
      })),
    }),
  });
  return handleJson<{ ok: boolean; comment: FeedCommentItem }>(res);
}

export async function deletePostComment(token: string, commentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/comments/${commentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function likeFeedComment(token: string, commentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/comments/${commentId}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean; liked: boolean }>(res);
}

export async function unlikeFeedComment(token: string, commentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/comments/${commentId}/like`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean; liked: boolean }>(res);
}

export async function likePost(token: string, postId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/posts/${postId}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean; liked: boolean }>(res);
}

export async function unlikePost(token: string, postId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/posts/${postId}/like`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean; liked: boolean }>(res);
}

export async function savePost(token: string, postId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/posts/${postId}/save`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean; saved: boolean }>(res);
}

export async function unsavePost(token: string, postId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/posts/${postId}/save`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean; saved: boolean }>(res);
}

export async function followAuthor(token: string, authorUserId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/authors/${authorUserId}/follow`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean; following: boolean }>(res);
}

export async function unfollowAuthor(token: string, authorUserId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/feed/authors/${authorUserId}/follow`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean; following: boolean }>(res);
}

export async function getShortlists(
  token: string,
  params?: { includeItems?: boolean }
): Promise<{ items: ShortlistList[] }> {
  const url = new URL(`${API_BASE}/api/v1/shortlists`);
  if (params?.includeItems === false) url.searchParams.set("include_items", "false");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: ShortlistList[] }>(res);
}

export async function getShortlistSavedPosts(
  token: string,
  limit = 40
): Promise<{ items: SavedShortlistPost[] }> {
  const url = new URL(`${API_BASE}/api/v1/shortlists/saved-posts`);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: SavedShortlistPost[] }>(res);
}

export async function createShortlist(token: string, name: string): Promise<ShortlistList> {
  const res = await fetch(`${API_BASE}/api/v1/shortlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  const data = await handleJson<{
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string | null;
  }>(res);
  return { ...data, items: [] };
}

export async function addShortlistItem(
  token: string,
  listId: number,
  athleteUserId: number,
  note?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/shortlists/${listId}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      athlete_user_id: athleteUserId,
      note: note ?? null,
    }),
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function updateShortlistItemNote(
  token: string,
  listId: number,
  athleteUserId: number,
  note: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/shortlists/${listId}/items/${athleteUserId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note }),
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function removeShortlistItem(
  token: string,
  listId: number,
  athleteUserId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/shortlists/${listId}/items/${athleteUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function reportContent(
  token: string,
  payload: { targetUserId?: number; targetPostId?: number; reason?: string; details?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/report`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_user_id: payload.targetUserId,
      target_post_id: payload.targetPostId,
      reason: payload.reason ?? "other",
      details: payload.details ?? null,
    }),
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function hidePost(token: string, postId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/hide-post/${postId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function hideUser(token: string, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/hide-user/${userId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function blockUser(token: string, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/block/${userId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function unblockUser(token: string, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/block/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function unhideUser(token: string, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/hide-user/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function getBlockedUsers(token: string): Promise<{ items: SafetyUserItem[] }> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/blocks`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: SafetyUserItem[] }>(res);
}

export async function getHiddenUsers(token: string): Promise<{ items: SafetyUserItem[] }> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/hidden-users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: SafetyUserItem[] }>(res);
}

export async function getHiddenPosts(token: string): Promise<{ items: HiddenPostItem[] }> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/hidden-posts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: HiddenPostItem[] }>(res);
}

export async function unhidePost(token: string, postId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/moderation/hide-post/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function searchUsers(
  token: string,
  params: {
    q?: string;
    role?: "athlete" | "coach";
    sport?: string;
    gradYear?: number;
    position?: string;
    state?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ source: string; items: SearchUserItem[] }> {
  const url = new URL(`${API_BASE}/api/v1/search/users`);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.role) url.searchParams.set("role", params.role);
  if (params.sport) url.searchParams.set("sport", params.sport);
  if (typeof params.gradYear === "number") url.searchParams.set("grad_year", String(params.gradYear));
  if (params.position) url.searchParams.set("position", params.position);
  if (params.state) url.searchParams.set("state", params.state);
  if (typeof params.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (typeof params.offset === "number") url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ source: string; items: SearchUserItem[] }>(res);
}

export async function searchSchools(
  token: string,
  params?: { q?: string; state?: string; level?: string; limit?: number }
): Promise<{ source: string; items: SchoolCardItem[] }> {
  const url = new URL(`${API_BASE}/api/v1/search/schools`);
  if (params?.q) url.searchParams.set("q", params.q);
  if (params?.state) url.searchParams.set("state", params.state);
  if (params?.level) url.searchParams.set("level", params.level);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ source: string; items: SchoolCardItem[] }>(res);
}

export async function searchTeams(
  token: string,
  params?: { q?: string; schoolUnitid?: string; schoolName?: string; sport?: string; limit?: number }
): Promise<{
  source: string;
  items: Array<{
    id: number;
    name: string;
    sport: string;
    school_unitid: string;
    school_name: string;
    school_state: string | null;
    active_member_count: number;
  }>;
}> {
  const url = new URL(`${API_BASE}/api/v1/search/teams`);
  if (params?.q) url.searchParams.set("q", params.q);
  if (params?.schoolUnitid) url.searchParams.set("school_unitid", params.schoolUnitid);
  if (params?.schoolName) url.searchParams.set("school_name", params.schoolName);
  if (params?.sport) url.searchParams.set("sport", params.sport);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{
    source: string;
    items: Array<{
      id: number;
      name: string;
      sport: string;
      school_unitid: string;
      school_name: string;
      school_state: string | null;
      active_member_count: number;
    }>;
  }>(res);
}

export async function searchTags(
  token: string,
  params?: { q?: string; limit?: number }
): Promise<{
  source: string;
  items: Array<{
    slug: string;
    display_name: string;
    tag: string;
    post_count: number;
  }>;
}> {
  const url = new URL(`${API_BASE}/api/v1/search/tags`);
  if (params?.q) url.searchParams.set("q", params.q);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{
    source: string;
    items: Array<{
      slug: string;
      display_name: string;
      tag: string;
      post_count: number;
    }>;
  }>(res);
}

export async function triggerSearchReindex(
  token: string
): Promise<{ ok: boolean; counts: { users: number; schools: number; teams: number } }> {
  const res = await fetch(`${API_BASE}/api/v1/search/reindex`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleJson<{ ok: boolean; counts: { users: number; schools: number; teams: number } }>(res);
}

export async function getMyAthleteProfile(token: string): Promise<{ profile: AthleteProfileForm | null }> {
  const res = await fetch(`${API_BASE}/api/v1/athlete-profile/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ profile: AthleteProfileForm | null }>(res);
}

export async function getAthleteProfileByUserId(
  token: string,
  userId: number
): Promise<{ profile: AthleteProfileForm | null }> {
  const res = await fetch(`${API_BASE}/api/v1/athlete-profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ profile: AthleteProfileForm | null }>(res);
}

export async function upsertMyAthleteProfile(
  token: string,
  payload: AthleteProfileForm
): Promise<{ ok: boolean; profile: AthleteProfileForm }> {
  const res = await fetch(`${API_BASE}/api/v1/athlete-profile/me`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: payload.firstName,
      last_name: payload.lastName,
      sport: payload.sport,
      grad_year: payload.gradYear,
      positions: payload.positions,
      state: payload.state || null,
      country: payload.country || "USA",
      willing_to_travel: payload.willingToTravel,
      travel_radius_mi: payload.travelRadiusMi,
      club_team: payload.clubTeam || null,
      school_unitid: payload.schoolUnitId || null,
      high_school: payload.highSchool || null,
      bio: payload.bio || null,
      avatar_media_asset_id: payload.avatarMediaAssetId ?? null,
      banner_media_asset_id: payload.bannerMediaAssetId ?? null,
    }),
  });
  return handleJson<{ ok: boolean; profile: AthleteProfileForm }>(res);
}

export async function getMyCoachProfile(token: string): Promise<{ profile: CoachProfileForm | null }> {
  const res = await fetch(`${API_BASE}/api/v1/coach-profile/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ profile: CoachProfileForm | null }>(res);
}

export async function getCoachProfileByUserId(
  token: string,
  userId: number
): Promise<{ profile: CoachProfileForm | null }> {
  const res = await fetch(`${API_BASE}/api/v1/coach-profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ profile: CoachProfileForm | null }>(res);
}

export async function upsertMyCoachProfile(
  token: string,
  payload: CoachProfileForm
): Promise<{ ok: boolean; profile: CoachProfileForm }> {
  const res = await fetch(`${API_BASE}/api/v1/coach-profile/me`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: payload.firstName,
      last_name: payload.lastName,
      title: payload.title || null,
      organization_name: payload.organizationName || null,
      school_unitid: payload.schoolUnitId || null,
      sport: payload.sport || null,
      level: payload.level || null,
      bio: payload.bio || null,
      avatar_media_asset_id: payload.avatarMediaAssetId ?? null,
      banner_media_asset_id: payload.bannerMediaAssetId ?? null,
    }),
  });
  return handleJson<{ ok: boolean; profile: CoachProfileForm }>(res);
}

export async function listSports(
  token: string,
  params?: { q?: string; limit?: number }
): Promise<{ items: string[] }> {
  const url = new URL(`${API_BASE}/api/v1/directory/sports`);
  if (params?.q) url.searchParams.set("q", params.q);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: string[] }>(res);
}

export async function listSchools(
  token: string,
  params?: { q?: string; limit?: number }
): Promise<{ items: Array<{ name: string; unitid?: string }> }> {
  const url = new URL(`${API_BASE}/api/v1/directory/schools`);
  if (params?.q) url.searchParams.set("q", params.q);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: Array<{ name: string; unitid?: string }> }>(res);
}

export async function listTeams(
  token: string,
  params?: { q?: string; schoolName?: string; limit?: number }
): Promise<{ items: Array<{ name: string; teamId?: number; schoolUnitid?: string }> }> {
  const url = new URL(`${API_BASE}/api/v1/directory/teams`);
  if (params?.q) url.searchParams.set("q", params.q);
  if (params?.schoolName) url.searchParams.set("school_name", params.schoolName);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: Array<{ name: string; teamId?: number; schoolUnitid?: string }> }>(res);
}

export async function getSchoolsDirectory(
  token: string,
  params?: { query?: string; state?: string; level?: string; limit?: number; offset?: number }
): Promise<SchoolDirectoryResponse> {
  const url = new URL(`${API_BASE}/api/v1/schools`);
  if (params?.query) url.searchParams.set("query", params.query);
  if (params?.state) url.searchParams.set("state", params.state);
  if (params?.level) url.searchParams.set("level", params.level);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (typeof params?.offset === "number") url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<SchoolDirectoryResponse>(res);
}

export async function getSchoolByUnitid(token: string, unitid: string): Promise<{ school: SchoolDetail }> {
  const res = await fetch(`${API_BASE}/api/v1/schools/${encodeURIComponent(unitid)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ school: SchoolDetail }>(res);
}

export async function selectMySchool(token: string, unitid: string): Promise<{ ok: boolean; unitid: string }> {
  const res = await fetch(`${API_BASE}/api/v1/schools/${encodeURIComponent(unitid)}/select`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleJson<{ ok: boolean; unitid: string }>(res);
}

export async function getSchoolTeams(token: string, unitid: string): Promise<{ items: SchoolTeamItem[] }> {
  const res = await fetch(`${API_BASE}/api/v1/schools/${encodeURIComponent(unitid)}/teams`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<{ items: SchoolTeamItem[] }>(res);
}

export async function createSchoolTeam(
  token: string,
  unitid: string,
  payload: { sport: string; teamName: string }
): Promise<{
  team: {
    id: number;
    schoolUnitid: string;
    sport: string;
    teamName: string;
    createdByUserId: number;
    createdAt: string;
  };
}> {
  const res = await fetch(`${API_BASE}/api/v1/schools/${encodeURIComponent(unitid)}/teams`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sport: payload.sport,
      team_name: payload.teamName,
    }),
  });
  return handleJson<{
    team: {
      id: number;
      schoolUnitid: string;
      sport: string;
      teamName: string;
      createdByUserId: number;
      createdAt: string;
    };
  }>(res);
}

export async function joinSchoolTeam(
  token: string,
  teamId: number,
  role: "athlete" | "coach" | "staff"
): Promise<{
  membership: {
    id: number;
    teamId: number;
    userId: number;
    role: "athlete" | "coach" | "staff";
    status: "pending" | "active" | "rejected";
    createdAt: string;
    updatedAt: string;
  };
}> {
  const res = await fetch(`${API_BASE}/api/v1/teams/${teamId}/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role }),
  });
  return handleJson<{
    membership: {
      id: number;
      teamId: number;
      userId: number;
      role: "athlete" | "coach" | "staff";
      status: "pending" | "active" | "rejected";
      createdAt: string;
      updatedAt: string;
    };
  }>(res);
}

async function setMembershipDecision(
  token: string,
  teamId: number,
  membershipId: number,
  decision: "approve" | "reject"
): Promise<{
  membership: {
    id: number;
    teamId: number;
    userId: number;
    role: "athlete" | "coach" | "staff";
    status: "pending" | "active" | "rejected";
    createdAt: string;
    updatedAt: string;
  };
}> {
  const res = await fetch(
    `${API_BASE}/api/v1/teams/${teamId}/memberships/${membershipId}/${decision}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return handleJson<{
    membership: {
      id: number;
      teamId: number;
      userId: number;
      role: "athlete" | "coach" | "staff";
      status: "pending" | "active" | "rejected";
      createdAt: string;
      updatedAt: string;
    };
  }>(res);
}

export async function approveSchoolTeamMembership(
  token: string,
  teamId: number,
  membershipId: number
) {
  return setMembershipDecision(token, teamId, membershipId, "approve");
}

export async function rejectSchoolTeamMembership(
  token: string,
  teamId: number,
  membershipId: number
) {
  return setMembershipDecision(token, teamId, membershipId, "reject");
}

export async function getMyCoachVerificationStatus(
  token: string
): Promise<CoachVerificationStatusResponse> {
  const res = await fetch(`${API_BASE}/api/v1/coach-verification/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleJson<CoachVerificationStatusResponse>(res);
}

export async function requestCoachVerification(
  token: string,
  payload?: { notes?: string; evidenceMediaAssetId?: number }
): Promise<{
  ok: boolean;
  alreadyVerified?: boolean;
  request?: CoachVerificationRequestItem;
}> {
  const res = await fetch(`${API_BASE}/api/v1/coach-verification/request`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notes: payload?.notes ?? null,
      evidence_media_asset_id: payload?.evidenceMediaAssetId ?? null,
    }),
  });
  return handleJson<{
    ok: boolean;
    alreadyVerified?: boolean;
    request?: CoachVerificationRequestItem;
  }>(res);
}
