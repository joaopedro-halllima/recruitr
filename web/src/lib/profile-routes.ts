export type ProfileRouteUser = {
  userId?: unknown;
  user_id?: unknown;
  id?: unknown;
  role?: unknown;
};

export function normalizeProfileUserId(value: unknown): number | null {
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

export function normalizeProfileRole(value: unknown): "athlete" | "coach" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "athlete" || normalized === "coach") return normalized;
  return null;
}

export function getProfileHref(
  user: ProfileRouteUser,
  viewerUserId?: number | null
): string | null {
  const userId = normalizeProfileUserId(user.userId ?? user.user_id ?? user.id);
  if (!userId) return null;

  if (typeof viewerUserId === "number" && viewerUserId === userId) {
    return "/dashboard/profile";
  }

  const role = normalizeProfileRole(user.role);
  if (role === "athlete") return `/athletes/${userId}`;
  if (role === "coach") return `/coaches/${userId}`;
  return null;
}
