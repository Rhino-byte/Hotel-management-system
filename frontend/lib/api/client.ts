// Prefer direct Render API in production when NEXT_PUBLIC_API_BASE is set.
// Fall back to same-origin /api (Next.js rewrites) for local dev without the env var.
const configured = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
const API_BASE =
  configured || (typeof window !== "undefined" ? "" : "http://localhost:8000");

const RETRY_DELAY_MS = 800;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed")
  );
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

async function apiFetchOnce<T>(path: string, options: RequestInit = {}): Promise<T> {
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
  if (res.status === 503) {
    const err = new Error("Service Unavailable") as Error & { status?: number };
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const target = `${API_BASE || (typeof window !== "undefined" ? window.location.origin : "")}${path}`;
    throw new Error(formatApiError(res.status, body, target));
  }
  return res.json() as Promise<T>;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await apiFetchOnce<T>(path, options);
  } catch (err) {
    const retryable =
      isNetworkError(err) ||
      (err instanceof Error && (err as Error & { status?: number }).status === 503);
    if (!retryable) throw err;
    await sleep(RETRY_DELAY_MS);
    try {
      return await apiFetchOnce<T>(path, options);
    } catch (retryErr) {
      if (
        retryErr instanceof Error &&
        (retryErr as Error & { status?: number }).status === 503
      ) {
        const target = `${API_BASE || (typeof window !== "undefined" ? window.location.origin : "")}${path}`;
        throw new Error(formatApiError(503, {}, target));
      }
      throw retryErr;
    }
  }
}

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
