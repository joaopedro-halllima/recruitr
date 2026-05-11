"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { resolveApiBase } from "@/lib/api-base";

const BG_IMAGE_SRC = "/wallpaper.png";
const PHONE_VIDEO_SRC = "/demo/landing-feed.mp4";
const PHONE_VIDEO_POSTER = "/demo/phone-poster.jpg";

const API_BASE = resolveApiBase();

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

export default function LandingPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoMuted, setVideoMuted] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) router.replace("/dashboard");
  }, [router]);

  function toggleVideoMute() {
    const v = videoRef.current;
    if (!v) return;
    const next = !videoMuted;
    v.muted = next;
    setVideoMuted(next);
    if (!next) v.play().catch(() => {});
  }

  async function captureLead(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setError(null);
    setStatus(null);

    const cleaned = email.trim().toLowerCase();
    if (!isValidEmail(cleaned)) {
      setEmailError("Please enter a valid email.");
      return;
    }

    setCapturing(true);

    try {
      localStorage.setItem("recruitr_lead_email", cleaned);
      localStorage.setItem("recruitr_lead_captured_at", String(Date.now()));
    } catch {}

    try {
      const resp = await fetch(`${API_BASE}/api/v1/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleaned, source: "landing" }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Lead capture failed (${resp.status})`);
      }
      setStatus("Thanks. You’re on the early access list.");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email capture failed");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <main className="relative isolate min-h-screen max-w-full overflow-x-hidden text-neutral-950">
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <Image
          src={BG_IMAGE_SRC}
          alt=""
          fill
          priority
          sizes="100vw"
          className="landing-wallpaper object-cover object-center"
        />
      </div>
      <div className="pointer-events-none fixed inset-0 bg-white/70" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(1200px_circle_at_50%_-250px,rgba(59,130,246,0.12),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_90%,rgba(99,102,241,0.10),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_85%_80%,rgba(236,72,153,0.07),transparent_55%)]" />

      <header className="landing-nav fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black font-semibold">
              R
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">Recruitr</div>
              <div className="text-xs text-neutral-400">Coach + Athlete</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/metrics"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
            >
              Metrics
            </Link>
            <Link
              href="/login/coach"
              className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20"
            >
              Coach Login
            </Link>
            <Link
              href="/login/athlete"
              className="rounded-lg border border-pink-300/40 bg-pink-300/10 px-3 py-2 text-xs font-semibold text-pink-100 hover:bg-pink-300/20"
            >
              Athlete Login
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 pt-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="pt-10 sm:pt-14">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
                Recruiting, simplified
              </h1>

              <p className="mt-5 text-base leading-7 text-neutral-700 sm:text-lg">
                A sports recruiting platform that feels like social media, because that is where the
                talent already is.
              </p>

              <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                  <div className="text-xs font-medium text-neutral-500">Core idea</div>
                  <div className="mt-1 text-sm text-neutral-800">
                    The LinkedIn of sports meets TikTok, built for coaches and student-athletes.
                  </div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                  <div className="text-xs font-medium text-neutral-500">Coach value</div>
                  <div className="mt-1 text-sm text-neutral-800">
                    Video-first profiles coaches can evaluate in seconds.
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup/coach"
                  className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-900 hover:bg-cyan-300/20"
                >
                  Create Coach Account
                </Link>
                <Link
                  href="/signup/athlete"
                  className="rounded-xl border border-pink-300/40 bg-pink-300/10 px-4 py-2 text-sm font-semibold text-pink-900 hover:bg-pink-300/20"
                >
                  Create Athlete Account
                </Link>
              </div>

              <form onSubmit={captureLead} className="mt-10">
                <div className="mx-auto max-w-xl text-center">
                  <div className="mb-3 text-sm font-semibold text-neutral-800">
                    Enter your email for updates
                  </div>

                  <div className="group relative mx-auto overflow-hidden rounded-full bg-[linear-gradient(110deg,rgba(103,232,249,0.68),rgba(59,130,246,0.84),rgba(129,140,248,0.66))] p-[1px] shadow-[0_12px_36px_rgba(37,99,235,0.20)] transition-all duration-300 focus-within:shadow-[0_18px_54px_rgba(37,99,235,0.30)]">
                    <div className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.34)_0%,rgba(59,130,246,0.16)_40%,rgba(59,130,246,0.06)_60%,transparent_78%)] opacity-80 blur-[18px] transition-opacity duration-300 group-focus-within:opacity-100" />
                    <div className="pointer-events-none absolute inset-0 -z-10 scale-105 rounded-full bg-cyan-300/18 blur-xl opacity-50 transition-opacity duration-300 group-focus-within:opacity-70" />
                    <div className="pointer-events-none absolute left-[8%] right-[8%] top-0 h-[36%] rounded-full bg-gradient-to-b from-white/55 to-transparent opacity-80" />
                    <div className="mx-auto flex items-center rounded-full border border-black/10 bg-white/92 px-5 py-3 backdrop-blur-xl">
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        autoComplete="email"
                        placeholder="you@school.edu"
                        className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 outline-none"
                        disabled={capturing}
                      />
                      <span className="ml-3 text-xs text-blue-700/75">
                        {capturing ? "Saving..." : "Enter"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-neutral-600">
                    No spam. Just early access updates.
                  </div>

                  {emailError ? (
                    <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                      {emailError}
                    </div>
                  ) : null}

                  {error ? (
                    <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}

                  {status ? (
                    <div className="mx-auto mt-4 max-w-xl rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                      {status}
                    </div>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="relative mx-auto mt-14 max-w-4xl pb-24 sm:pb-28">
              <div className="relative mx-auto w-[300px] sm:w-[360px]">
                <div className="relative rounded-[44px] border border-black/15 bg-neutral-950 p-3 shadow-[0_30px_90px_rgba(0,0,0,0.20)]">
                  <div className="relative overflow-hidden rounded-[36px] bg-black">
                    <div className="absolute left-1/2 top-2 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black/85 backdrop-blur" />

                    <video
                      ref={videoRef}
                      className="block h-[560px] w-full object-cover sm:h-[640px]"
                      src={PHONE_VIDEO_SRC}
                      poster={PHONE_VIDEO_POSTER}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />

                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_circle_at_20%_0%,rgba(255,255,255,0.12),transparent_45%)]" />

                    <button
                      onClick={toggleVideoMute}
                      className="absolute right-3 bottom-3 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white hover:bg-black/55"
                      type="button"
                    >
                      {videoMuted ? "Tap for sound" : "Mute"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 text-center text-xs text-neutral-600">
                  Video autoplays muted (browser policy).
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 overflow-hidden border-t border-black/10 py-20">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(241,245,249,0.82),rgba(219,234,254,0.88)_45%,rgba(224,231,255,0.85))]" />

        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700/80">
              How Recruitr Works
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Built for fast recruiting decisions
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-neutral-700 sm:text-base">
              Athletes post highlights and profile context. Verified coaches discover them in feed and
              search, save prospects to shortlists, and start outreach in one workflow.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">1. Discover</div>
              <p className="mt-2 text-sm text-neutral-800">
                Video-first feed and search help coaches evaluate athletes by sport, role, school, and
                class year.
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">2. Organize</div>
              <p className="mt-2 text-sm text-neutral-800">
                Save athletes, build shortlists, and keep recruiting notes in one place instead of
                scattered spreadsheets.
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">3. Connect</div>
              <p className="mt-2 text-sm text-neutral-800">
                Messaging is coach-first with verification gates to reduce spam and keep athlete outreach
                accountable.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="text-sm font-semibold text-neutral-900">What athletes and coaches can do</div>
              <p className="mt-2 text-sm text-neutral-700">
                Create role-based accounts, build profiles, upload highlights, discover prospects, and
                track relationships from first view to message thread.
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="text-sm font-semibold text-neutral-900">Safety and legal basics</div>
              <p className="mt-2 text-sm text-neutral-700">
                Public content, reporting tools, coach verification gates, and account controls are part of
                the MVP foundation to support responsible recruiting communication.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-black/10 bg-white/85 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-neutral-700">
              <Link
                href="/terms"
                scroll
                className="underline decoration-neutral-400 underline-offset-4 hover:text-neutral-900"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                scroll
                className="underline decoration-neutral-400 underline-offset-4 hover:text-neutral-900"
              >
                Privacy Policy
              </Link>
              <Link
                href="/community-guidelines"
                scroll
                className="underline decoration-neutral-400 underline-offset-4 hover:text-neutral-900"
              >
                Community Guidelines
              </Link>
              <Link
                href="/metrics"
                scroll
                className="underline decoration-neutral-400 underline-offset-4 hover:text-neutral-900"
              >
                Metrics
              </Link>
            </div>
            <p className="mt-4 text-center text-xs leading-6 text-neutral-600">
              By creating an account, you agree to Recruitr&apos;s terms and community standards. Recruitr is
              intended for lawful recruiting communication and profile discovery.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
