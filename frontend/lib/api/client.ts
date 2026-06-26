// Prefer direct Render API in production when NEXT_PUBLIC_API_BASE is set.
// Fall back to same-origin /api (Next.js rewrites) for local dev without the env var.
const configured = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
const API_BASE =
  configured || (typeof window !== "undefined" ? "" : "http://localhost:8000");

function formatApiError(
  status: number,
  body: { detail?: string | { msg?: string }[] },
  target: string
): string {
  let detail: string | undefined;
  if (typeof body.detail === "string") {
    detail = body.detail;
  } else if (Array.isArray(body.detail)) {
    detail = body.detail.map((e) => e.msg).filter(Boolean).join(", ");
  }
  const base = detail || `HTTP ${status} for ${target}`;
  if (status >= 500) {
    return `${base} — Server error. Check API health or contact admin.`;
  }
  return base;
}

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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    const body = await res.json().catch(() => ({}));
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join(", ")
          : undefined;
    const hadToken = Boolean(token);
    const isLoginRequest = path === "/api/auth/login" || path.endsWith("/auth/login");
    if (hadToken && !isLoginRequest && window.location.pathname !== "/login") {
      setToken(null);
      window.location.href = "/login";
    }
    throw new Error(detail || "Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const target = `${API_BASE || (typeof window !== "undefined" ? window.location.origin : "")}${path}`;
    throw new Error(formatApiError(res.status, body, target));
  }
  return res.json() as Promise<T>;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
