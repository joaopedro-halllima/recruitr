"use client";

import type { ChangeEvent } from "react";
import type { AthleteProfile } from "@/lib/mockAthleteProfile";

type ProfileHeaderMobileProps = {
  athlete: AthleteProfile;
  avatarUrl: string | null;
  editMode: boolean;
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => void;
};

function stars(n: number) {
  return "★".repeat(Math.max(0, n));
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "A";
}

export default function ProfileHeaderMobile({ athlete, avatarUrl, editMode, onAvatarUpload }: ProfileHeaderMobileProps) {
  return (
    <div className="px-4 pb-4">
      <div className="-mt-12 flex items-end justify-between">
        <div className="relative h-24 w-24 rounded-full border-4 border-white bg-slate-300 shadow-lg">
          {avatarUrl ? (
            <div
              className="h-full w-full rounded-full bg-cover bg-center"
              style={{ backgroundImage: `url(${avatarUrl})` }}
            />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-2xl font-bold text-white">
              {initials(athlete.name)}
            </div>
          )}
        </div>

        {editMode ? (
          <label className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Upload photo
            <input type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
          </label>
        ) : null}
      </div>

      <div className="mt-3">
        <div className="text-3xl font-bold tracking-tight text-slate-900">{athlete.name}</div>
        <div className="mt-1 text-sm text-slate-700">
          Position • {stars(athlete.stars)} • {athlete.position} • Class of {athlete.classYear}
        </div>
        <div className="mt-1 text-sm text-slate-600">
          {Math.round(athlete.followers / 100) / 10}k followers • {athlete.connections} connections
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Follow</button>
        <button className="rounded-full border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700">Message</button>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bio</div>
        <p className="mt-1 text-sm leading-6 text-slate-700">{athlete.bio}</p>
      </div>
    </div>
  );
}
