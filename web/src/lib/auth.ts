import type { MeUser } from "@/lib/api";

const TOKEN_KEY = "recruitr_access_token";
const USER_KEY = "recruitr_user";
const TOKEN_COOKIE_KEY = "recruitr_access_token";
const USER_COOKIE_KEY = "recruitr_user";

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=2592000`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1] ?? null;
  }
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
}

export function setAuth(token: string, user: MeUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  setCookie(TOKEN_COOKIE_KEY, token);
  try {
    setCookie(USER_COOKIE_KEY, JSON.stringify(user));
  } catch {
    // Ignore oversized user payloads; token persistence matters most.
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const local = localStorage.getItem(TOKEN_KEY);
  if (local) return local;

  const session = sessionStorage.getItem(TOKEN_KEY);
  if (session) {
    localStorage.setItem(TOKEN_KEY, session);
    return session;
  }

  const cookie = getCookie(TOKEN_COOKIE_KEY);
  if (cookie) {
    localStorage.setItem(TOKEN_KEY, cookie);
    sessionStorage.setItem(TOKEN_KEY, cookie);
    return cookie;
  }

  return null;
}

export function getStoredUser<TUser = MeUser>(): TUser | null {
  if (typeof window === "undefined") return null;
  const raw =
    localStorage.getItem(USER_KEY) ??
    sessionStorage.getItem(USER_KEY) ??
    getCookie(USER_COOKIE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as TUser;
    localStorage.setItem(USER_KEY, raw);
    sessionStorage.setItem(USER_KEY, raw);
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  clearCookie(TOKEN_COOKIE_KEY);
  clearCookie(USER_COOKIE_KEY);
}
