"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "../../lib/auth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    if (typeof window !== "undefined") {
      window.location.href = user.default_route || "/";
    }
    return null;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(firstName.trim(), Number(pin));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page page-center">
      <div className="card card-narrow card-hero">
        <h1>Hotel Management</h1>
        <p className="muted">Sign in with your first name and PIN</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={onSubmit} className="form-stack">
          <label className="field">
            <span>First name</span>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
