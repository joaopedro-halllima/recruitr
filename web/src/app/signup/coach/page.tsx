"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { register } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function CoachSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [sport, setSport] = useState("");
  const [level, setLevel] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const auth = await register({
        email: email.trim().toLowerCase(),
        password,
        role: "coach",
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        title: title.trim() || undefined,
        organizationName: organizationName.trim() || undefined,
        sport: sport.trim() || undefined,
        level: level.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      setAuth(auth.access_token, auth.user);
      router.push("/dashboard/create-post?welcome=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="theme-content min-h-screen bg-neutral-950 px-6 py-12 text-[var(--app-text)]">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-xs uppercase tracking-wider text-cyan-300">Coach Signup</div>
        <h1 className="mt-2 text-3xl font-semibold">Create your coach account</h1>
        <p className="mt-2 text-sm text-neutral-400">
          You can complete verification later. Start building your recruiting workflow now.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="md:col-span-2 rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Password (min 6)"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Title (Head Coach, Assistant Coach)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Organization / School"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Sport"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Level (D1, D2, etc)"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Short bio (optional)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="md:col-span-2 min-h-[90px] rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm"
          />

          {error ? (
            <div className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            disabled={!email.trim() || !password || !confirmPassword || loading}
            className="md:col-span-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Coach Account"}
          </button>
        </form>

        <div className="mt-5 text-xs text-neutral-400">
          Already have an account?
          <Link href="/login/coach" className="ml-2 text-cyan-300 underline underline-offset-4">
            Coach login
          </Link>
        </div>
      </div>
    </main>
  );
}
