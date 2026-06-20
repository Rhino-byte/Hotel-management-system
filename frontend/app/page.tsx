"use client";

import { useEffect } from "react";
import { useAuth } from "../lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    window.location.href = user.default_route || "/snacks-drinks";
  }, [user, loading]);

  return (
    <main className="page page-center">
      <p>Redirecting...</p>
    </main>
  );
}
