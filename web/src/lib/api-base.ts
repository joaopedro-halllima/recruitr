export function resolveApiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (envBase) return envBase;

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "localhost";
    return `${protocol}//${hostname}:8001`;
  }

  return "http://localhost:8001";
}
