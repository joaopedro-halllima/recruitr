"use client";

import type { ChangeEvent } from "react";
import type { AthleteProfile } from "@/lib/mockAthleteProfile";

type PlayerCardProps = {
  athlete: AthleteProfile;
  avatarUrl: string | null;
  editMode: boolean;
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => void;
};

function starString(stars: number) {
  return "★".repeat(Math.max(0, stars));
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "A";
}

export default function PlayerCard({ athlete, avatarUrl, editMode, onAvatarUpload }: PlayerCardProps) {
  return (
    <section className="ath-profile-card rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)] lg:border-white/10 lg:bg-white/5 lg:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-800 lg:text-slate-100">PLAYER CARD</div>
          <div className="mt-1 text-sm font-semibold text-emerald-500">
            {starString(athlete.stars)} {athlete.position}
          </div>
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white text-base font-bold text-slate-800 lg:border-white/25 lg:bg-black/30 lg:text-white">
          {athlete.teamLogoTextOrUrl}
        </div>
      </div>

      <div className="mt-4 text-center">
        <div className="relative mx-auto h-44 w-44">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-300/80 shadow-[0_0_32px_rgba(34,211,238,0.38)]" />
          <div className="absolute inset-[9px] rounded-full border-4 border-emerald-300/80" />
          <div className="absolute inset-[18px] overflow-hidden rounded-full border border-slate-300 bg-slate-200 lg:border-white/20 lg:bg-black/40">
            {avatarUrl ? (
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${avatarUrl})` }} />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-700 via-slate-900 to-slate-800 text-3xl font-bold text-white">
                {initials(athlete.name)}
              </div>
            )}
          </div>

          {editMode ? (
            <label className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm lg:border-white/25 lg:bg-black/55 lg:text-slate-100">
              Upload photo
              <input type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
            </label>
          ) : null}
        </div>
      </div>

      <div className="mt-6 text-center">
        <div className="text-2xl font-extrabold tracking-tight text-slate-900 lg:text-slate-100">
          {athlete.name.split(" ")[0]} “{athlete.nickname}” {athlete.name.split(" ").slice(1).join(" ")}
        </div>
        <div className="mt-1 text-base text-slate-700 lg:text-slate-300">
          <span className="font-semibold text-amber-500">{starString(athlete.stars)}</span> {athlete.position} | Class of {athlete.classYear}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 lg:border-white/10 lg:bg-black/25">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:text-slate-400">Recruit Ranking</div>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-3xl font-extrabold text-emerald-500">
            {starString(athlete.stars)} <span className="text-cyan-400">#{athlete.rankingPosition} {athlete.position}</span>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-800 lg:border-white/25 lg:bg-black/30 lg:text-white">
            {athlete.teamLogoTextOrUrl}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center lg:border-white/10 lg:bg-black/25">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 lg:text-slate-400">HT</div>
          <div className="text-xl font-bold text-slate-900 lg:text-slate-100">{athlete.height}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center lg:border-white/10 lg:bg-black/25">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 lg:text-slate-400">WT</div>
          <div className="text-xl font-bold text-slate-900 lg:text-slate-100">{athlete.weight}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
          Follow
        </button>
        <button className="rounded-full border border-cyan-300 bg-white px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 lg:border-cyan-300/80 lg:bg-transparent lg:text-cyan-300 lg:hover:bg-cyan-400/10">
          Message
        </button>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-3 lg:border-white/10">
        <div className="text-sm font-semibold tracking-wide text-slate-800 lg:text-slate-100">ACADEMIC INFO</div>
        <div className="mt-1 text-base text-slate-700 lg:text-slate-300">{athlete.schoolName}</div>
        <div className="text-base text-slate-700 lg:text-slate-300">{athlete.academics.committedUniversity}</div>
      </div>
    </section>
  );
}
