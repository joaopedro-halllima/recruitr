"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getToken } from "@/lib/auth";

export default function LoginRolePickerPage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  return (
    <main className="theme-content min-h-screen bg-neutral-950 px-6 py-12 text-[var(--app-text)]">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Recruitr</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Choose your login type</h1>
          <p className="mt-3 text-sm text-neutral-400">
            Separate flows for coaches and athletes.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            href="/login/coach"
            className="rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-6 transition hover:bg-cyan-300/20"
          >
            <div className="text-xs uppercase tracking-wider text-cyan-200">Coach</div>
            <div className="mt-2 text-2xl font-semibold">Coach Login</div>
            <div className="mt-2 text-sm text-neutral-200">
              Recruiting feed, shortlists, and verified outreach.
            </div>
          </Link>

          <Link
            href="/login/athlete"
            className="rounded-3xl border border-pink-300/30 bg-pink-300/10 p-6 transition hover:bg-pink-300/20"
          >
            <div className="text-xs uppercase tracking-wider text-pink-200">Athlete</div>
            <div className="mt-2 text-2xl font-semibold">Athlete Login</div>
            <div className="mt-2 text-sm text-neutral-200">
              Profile, posts, and coach messaging.
            </div>
          </Link>
        </div>

        <div className="mt-6 text-center text-sm text-neutral-400">
          Need an account?
          <Link href="/signup/coach" className="ml-2 text-cyan-300 underline underline-offset-4">
            Coach signup
          </Link>
          <span className="mx-2 text-neutral-600">|</span>
          <Link href="/signup/athlete" className="text-pink-300 underline underline-offset-4">
            Athlete signup
          </Link>
        </div>
      </div>
    </main>
  );
}
