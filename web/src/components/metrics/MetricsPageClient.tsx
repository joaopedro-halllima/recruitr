"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { PublicMetrics } from "@/lib/api";
import { getPublicMetrics } from "@/lib/api";

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/12 bg-[#0d1c38]/72 p-6 shadow-[0_20px_80px_rgba(2,12,35,0.28)] backdrop-blur-xl">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/65">{label}</div>
      <div className="mt-4 text-4xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300/72">{hint}</div>
    </div>
  );
}

export default function MetricsPageClient() {
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const formatNumber = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }),
    []
  );

  const loadMetrics = useCallback(async () => {
    try {
      setError(null);
      const next = await getPublicMetrics();
      setMetrics(next);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
    const id = window.setInterval(() => {
      void loadMetrics();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [loadMetrics]);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#08111f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-10%,rgba(56,189,248,0.18),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_circle_at_15%_90%,rgba(59,130,246,0.16),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,17,31,0.88),rgba(11,23,43,0.86))]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Recruitr
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Metrics</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300/80 sm:text-base">
              Public snapshot of site activity across signups, waitlist captures, authenticated activity,
              and tracked pageviews.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadMetrics();
              }}
              className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/18"
            >
              Refresh
            </button>
            <Link
              href="/"
              className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              Back to site
            </Link>
          </div>
        </div>

        <div className="mt-10 rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_28px_100px_rgba(2,12,35,0.34)] backdrop-blur-xl sm:p-7">
          {loading && !metrics ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/[0.06]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-100">
              {error}
            </div>
          ) : metrics ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Signups"
                  value={formatNumber.format(metrics.signups)}
                  hint="Total user accounts currently in the database."
                />
                <MetricCard
                  label="Active Users"
                  value={formatNumber.format(metrics.active_users)}
                  hint={`Distinct signed-in users seen in the last ${metrics.active_users_window_days} days.`}
                />
                <MetricCard
                  label="Waitlisted"
                  value={formatNumber.format(metrics.waitlisted)}
                  hint="Email captures submitted from the landing page."
                />
                <MetricCard
                  label="Pageviews"
                  value={formatNumber.format(metrics.pageviews)}
                  hint="Tracked public and app page loads across the site."
                />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#09162b]/70 px-5 py-4 text-sm text-slate-300/80">
                <div>Metrics refresh automatically every 60 seconds.</div>
                <div>
                  Last updated:{" "}
                  <span className="font-medium text-white">
                    {lastUpdated ? lastUpdated.toLocaleString() : "Just now"}
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
