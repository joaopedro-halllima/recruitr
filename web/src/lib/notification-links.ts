import type { NotificationItem } from "@/lib/api";

function positiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

export function getNotificationHref(notification: NotificationItem): string {
  const data = notification.data ?? {};
  const postId = positiveInt(data.postId);
  const commentId = positiveInt(data.commentId);

  if (
    notification.type === "post_comment" ||
    notification.type === "comment_reply" ||
    notification.type === "comment_mention"
  ) {
    if (postId) {
      const params = new URLSearchParams();
      params.set("post", String(postId));
      if (commentId) params.set("comment", String(commentId));
      return `/dashboard?${params.toString()}`;
    }
    return "/dashboard/notifications";
  }

  if (notification.type === "dm_message") {
    return "/dashboard/messages";
  }

  return "/dashboard/notifications";
}

