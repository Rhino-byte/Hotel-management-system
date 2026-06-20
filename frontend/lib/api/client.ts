// Use same-origin /api in the browser (proxied by next.config rewrites in dev).
// Falls back to explicit backend URL for direct calls or server-side use.
const API_BASE =
  typeof window !== "undefined"
    ? ""
    : (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hotel_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("hotel_token", token);
  else localStorage.removeItem("hotel_token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    const hadToken = Boolean(token);
    setToken(null);
    if (hadToken && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const target = `${API_BASE || window.location.origin}${path}`;
    throw new Error(body.detail || `HTTP ${res.status} for ${target}`);
  }
  return res.json() as Promise<T>;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
