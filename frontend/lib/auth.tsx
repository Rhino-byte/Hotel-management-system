"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { fetchMe, getToken, login as apiLogin, setToken } from "./api";
import type { User } from "./types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (firstName: string, pin: number) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const authGenRef = useRef(0);

  const refresh = useCallback(async () => {
    const gen = authGenRef.current;
    try {
      if (!getToken()) {
        if (gen === authGenRef.current) {
          setUser(null);
        }
        return;
      }
      const me = await fetchMe();
      if (gen === authGenRef.current) {
        setUser(me);
      }
    } catch {
      if (gen === authGenRef.current) {
        setUser(null);
        setToken(null);
      }
    } finally {
      // Always clear loading so a login/logout race cannot leave it stuck true.
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (firstName: string, pin: number) => {
      authGenRef.current += 1;
      setToken(null);
      try {
        const res = await apiLogin(firstName, pin);
        setToken(res.access_token);
        setUser(res.user);
        setLoading(false);
        router.push(res.user.default_route || "/");
      } catch (err) {
        setLoading(false);
        throw err;
      }
    },
    [router]
  );

  const logout = useCallback(() => {
    authGenRef.current += 1;
    setToken(null);
    setUser(null);
    setLoading(false);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRequireAuth(allowedModules?: string[], requireAdmin = false) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requireAdmin && user.role !== "admin") {
      router.replace(user.default_route || "/login");
      return;
    }
    if (allowedModules && !allowedModules.some((m) => user.modules.includes(m))) {
      router.replace(user.default_route || "/login");
    }
  }, [user, loading, allowedModules, requireAdmin, router]);

  return { user, loading };
}

/** Inventory audit: admin or any clerk with a stock/food module. */
export const AUDIT_MODULES = ["snacks_drinks", "food_kuku", "stock_items", "bar"] as const;

export function useRequireAuditAccess() {
  return useRequireAuth([...AUDIT_MODULES]);
}
