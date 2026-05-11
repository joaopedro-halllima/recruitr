"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { devLogin, login } from "@/lib/api";
import { getToken, setAuth } from "@/lib/auth";

const demoLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

export default function CoachLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Email is required");
      return;
    }
    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    setLoading(true);
    try {
      const auth = await login(normalizedEmail, password);
      setAuth(auth.access_token, auth.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setError(null);
    setDemoLoading(true);
    try {
      const auth = await devLogin("coach");
      setAuth(auth.access_token, auth.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <main className="theme-content min-h-screen bg-neutral-950 px-6 py-12 text-[var(--app-text)]">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-xs uppercase tracking-wider text-cyan-300">Coach Login</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Welcome back, coach</h1>
          <p className="mt-3 max-w-lg text-sm text-neutral-300">
            Sign in to continue evaluating athletes, managing shortlists, and messaging prospects.
          </p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-900/60 p-4 text-xs text-neutral-400">
            New coach?
            <Link href="/signup/coach" className="ml-2 text-cyan-300 underline underline-offset-4">
              Create a coach account
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="text-xs text-neutral-400">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-400">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
              />
            </label>
            <button
              disabled={loading || demoLoading || !email.trim() || !password}
              className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in as Coach"}
            </button>
          </form>

          <Link href="/forgot-password" className="mt-3 block text-xs text-neutral-400 underline underline-offset-4">
            Forgot password?
          </Link>

          {demoLoginEnabled ? (
            <>
              <div className="my-4 h-px bg-white/10" />

              <button
                onClick={() => {
                  void handleDemo();
                }}
                disabled={loading || demoLoading}
                className="w-full rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm hover:bg-cyan-300/20 disabled:opacity-60"
              >
                {demoLoading ? "Opening demo..." : "Use Coach Demo"}
              </button>
            </>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-5 text-xs text-neutral-400">
            Looking for athlete login?
            <Link href="/login/athlete" className="ml-2 text-pink-300 underline underline-offset-4">
              Athlete login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
