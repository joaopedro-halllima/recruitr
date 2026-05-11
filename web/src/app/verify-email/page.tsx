"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { confirmEmailVerification } from "@/lib/api";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await confirmEmailVerification(token);
        setMessage(res.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not verify email");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <main className="theme-content min-h-screen bg-neutral-950 px-6 py-12 text-[var(--app-text)]">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-xs uppercase tracking-wider text-cyan-300">Email Verification</div>
        <h1 className="mt-2 text-3xl font-semibold">Verify your email</h1>

        {loading ? <p className="mt-4 text-sm text-neutral-300">Verifying...</p> : null}
        {!token ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            This verification link is missing a token.
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <Link href="/login" className="mt-5 block text-xs text-neutral-400 underline underline-offset-4">
          Continue to login
        </Link>
      </section>
    </main>
  );
}
