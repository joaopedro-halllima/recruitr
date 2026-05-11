"use client";

import type { AthleteProfile } from "@/lib/mockAthleteProfile";

type StatsAnalyticsProps = {
  athlete: AthleteProfile;
  title?: string;
  compact?: boolean;
};

function Sparkline({ points }: { points: number[] }) {
  const width = 220;
  const height = 76;
  const pad = 8;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad + (i * (width - pad * 2)) / (points.length - 1 || 1);
    const y = height - pad - ((p - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${path} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(45,212,191,0.42)" />
          <stop offset="100%" stopColor="rgba(45,212,191,0.02)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke="rgba(45,212,191,0.95)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function StatsAnalytics({ athlete, title = "STATS & ANALYTICS", compact = false }: StatsAnalyticsProps) {
  return (
    <section className="ath-profile-card rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)] lg:border-white/10 lg:bg-white/5 lg:shadow-none">
      {title ? <div className="text-sm font-semibold tracking-wide text-slate-800 lg:text-slate-100">{title}</div> : null}

      <div className={compact ? "mt-3 space-y-3" : "mt-4 space-y-4"}>
        <div className="ath-profile-panel rounded-xl border border-slate-200 bg-slate-50/80 p-3 lg:border-white/10 lg:bg-black/25">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:text-slate-400">Season Statistics</div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <div className="text-[11px] text-slate-500 lg:text-slate-400">Rushing Yards</div>
              <div className="text-2xl font-bold text-emerald-500">{athlete.seasonStats.rushingYards}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 lg:text-slate-400">TDs</div>
              <div className="text-2xl font-bold text-emerald-500">{athlete.seasonStats.tds}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 lg:text-slate-400">Yds / Carry</div>
              <div className="text-2xl font-bold text-emerald-500">{athlete.seasonStats.ydsPerCarry}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 lg:text-slate-400">Receiving Yards</div>
              <div className="text-2xl font-bold text-emerald-500">{athlete.seasonStats.receivingYards}</div>
            </div>
          </div>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 lg:border-white/10 lg:bg-white/5">
            <Sparkline points={athlete.chartPoints} />
          </div>
        </div>

        <div className="ath-profile-panel rounded-xl border border-slate-200 bg-slate-50/80 p-3 lg:border-white/10 lg:bg-black/25">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:text-slate-400">Career Accolades</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-800 lg:text-slate-200">
            {athlete.accolades.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ath-profile-panel rounded-xl border border-slate-200 bg-slate-50/80 p-3 lg:border-white/10 lg:bg-black/25">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:text-slate-400">Recruitment Timeline</div>
          <div className="mt-3 space-y-3">
            {athlete.timeline.map((item, idx) => (
              <div key={`${item.year}-${item.title}`} className="relative pl-5">
                {idx !== athlete.timeline.length - 1 ? (
                  <div className="absolute left-[6px] top-3 h-full w-px bg-slate-300 lg:bg-white/20" />
                ) : null}
                <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-cyan-300 bg-cyan-400/70" />
                <div className="text-xs font-semibold text-slate-500 lg:text-cyan-300">{item.year}</div>
                <div className="text-sm font-semibold text-slate-900 lg:text-slate-100">{item.title}</div>
                <div className="text-xs text-slate-600 lg:text-slate-400">{item.subtitle}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
