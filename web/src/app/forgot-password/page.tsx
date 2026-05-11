"use client";

import Link from "next/link";
import { useState } from "react";

import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevLink(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      setMessage(res.message);
      setDevLink(res.dev_link ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="theme-content min-h-screen bg-neutral-950 px-6 py-12 text-[var(--app-text)]">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-xs uppercase tracking-wider text-cyan-300">Password Reset</div>
        <h1 className="mt-2 text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Enter your account email and we will send a secure reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <button
            disabled={!email.trim() || loading}
            className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}
        {devLink ? (
          <Link href={devLink.replace(/^https?:\/\/[^/]+/, "")} className="mt-3 block text-sm text-cyan-300 underline underline-offset-4">
            Open dev reset link
          </Link>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <Link href="/login" className="mt-5 block text-xs text-neutral-400 underline underline-offset-4">
          Back to login
        </Link>
      </section>
    </main>
  );
}
