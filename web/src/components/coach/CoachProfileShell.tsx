"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { getStoredUser, getToken, setAuth } from "@/lib/auth";
import {
  createProfileUploadSession,
  upsertMyCoachProfile,
  uploadFileWithProgress,
  type CoachProfileForm,
} from "@/lib/api";
import { optimizeImageForStorage } from "@/lib/image-storage";
import type { CoachProfile } from "@/lib/mockCoachProfile";

type CoachProfileShellProps = {
  coach: CoachProfile;
  embedded?: boolean;
  canEdit?: boolean;
};

type MobileTab = "posts" | "career" | "teams" | "info";

type CoachLocalMeta = {
  name?: string;
  title?: string;
  schoolName?: string;
  teamName?: string;
  sport?: string;
  level?: string;
  organizationName?: string;
  bio?: string;
  followers?: number;
  connections?: number;
};

type CoachEditDraft = {
  firstName: string;
  lastName: string;
  title: string;
  schoolName: string;
  teamName: string;
  organizationName: string;
  sport: string;
  level: string;
  followers: string;
  connections: string;
  bio: string;
};

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-7" />
    </svg>
  );
}

function IconSchool() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m2 9 10-5 10 5-10 5Z" />
      <path d="M6 11v5a6 6 0 0 0 12 0v-5" />
    </svg>
  );
}

function toInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "C";
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function mobileTabButton(activeTab: MobileTab, tab: MobileTab, label: string, onClick: (tab: MobileTab) => void) {
  const active = activeTab === tab;
  return (
    <button
      key={tab}
      onClick={() => onClick(tab)}
      className={`border-b-2 px-1 py-2 text-xs font-semibold uppercase tracking-wide ${
        active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function toInt(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function mergeCoachWithMeta(base: CoachProfile): CoachProfile {
  if (typeof window === "undefined") return base;
  const key = `recruitr_coach_profile_meta_${base.id}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return base;

  try {
    const meta = JSON.parse(raw) as CoachLocalMeta;
    return {
      ...base,
      name: meta.name || base.name,
      title: meta.title || base.title,
      schoolName: meta.schoolName || base.schoolName,
      teamName: meta.teamName || base.teamName,
      sport: meta.sport || base.sport,
      level: meta.level || base.level,
      organizationName: meta.organizationName || base.organizationName,
      bio: meta.bio || base.bio,
      followers: meta.followers ?? base.followers,
      connections: meta.connections ?? base.connections,
    };
  } catch {
    return base;
  }
}

function buildCoachMeta(profile: CoachProfile): CoachLocalMeta {
  return {
    name: profile.name,
    title: profile.title,
    schoolName: profile.schoolName,
    teamName: profile.teamName,
    sport: profile.sport,
    level: profile.level,
    organizationName: profile.organizationName,
    bio: profile.bio,
    followers: profile.followers,
    connections: profile.connections,
  };
}

function draftFromCoach(profile: CoachProfile): CoachEditDraft {
  const names = splitName(profile.name);
  return {
    firstName: names.firstName,
    lastName: names.lastName,
    title: profile.title,
    schoolName: profile.schoolName,
    teamName: profile.teamName,
    organizationName: profile.organizationName,
    sport: profile.sport,
    level: profile.level,
    followers: String(profile.followers),
    connections: String(profile.connections),
    bio: profile.bio,
  };
}

function mediaNode(post: CoachProfile["posts"][number]) {
  if (!post.media?.src) {
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-xl bg-black/20 text-xs text-slate-400">
        No media
      </div>
    );
  }

  if (post.media.kind === "video") {
    return (
      <video
        className="aspect-[16/10] w-full rounded-xl border border-white/10 bg-black object-cover"
        controls
        playsInline
        preload="metadata"
      >
        <source src={post.media.src} type="video/mp4" />
      </video>
    );
  }

  return (
    <img
      src={post.media.src}
      alt="Coach post"
      className="aspect-[16/10] w-full rounded-xl border border-white/10 bg-black object-cover"
      loading="lazy"
    />
  );
}

function CoachCard({
  coach,
  avatarUrl,
  editMode,
  onAvatarUpload,
}: {
  coach: CoachProfile;
  avatarUrl: string | null;
  editMode: boolean;
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm lg:border-white/10 lg:bg-white/5 lg:shadow-none">
      <div className="text-sm font-semibold tracking-wide text-slate-800 lg:text-slate-100">COACH CARD</div>

      <div className="mt-4 flex flex-col items-center text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-cyan-300/35 blur-xl" />
          <div className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-full border border-cyan-300/70 bg-gradient-to-br from-[#0b2b53] to-[#081a33] text-[1.75rem] font-bold text-cyan-100">
            {avatarUrl ? (
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${avatarUrl})` }} />
            ) : (
              toInitials(coach.name)
            )}
          </div>
        </div>

        {editMode ? (
          <label className="mt-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm lg:border-white/25 lg:bg-black/55 lg:text-slate-100">
            Upload photo
            <input type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
          </label>
        ) : null}

        <div className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 lg:text-white">{coach.name}</div>
        <div className="mt-1 text-sm text-slate-600 lg:text-slate-300">{coach.title}</div>

        {coach.isVerifiedCoach ? (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
            <IconCheck />
            Verified Coach
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-slate-500 lg:text-slate-400">School</span>
          <span className="text-right font-medium text-slate-800 lg:text-slate-100">{coach.schoolName}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-slate-500 lg:text-slate-400">Team</span>
          <span className="text-right font-medium text-slate-800 lg:text-slate-100">{coach.teamName}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-slate-500 lg:text-slate-400">Sport</span>
          <span className="text-right font-medium text-slate-800 lg:text-slate-100">{coach.sport}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-slate-500 lg:text-slate-400">Level</span>
          <span className="text-right font-medium text-slate-800 lg:text-slate-100">{coach.level}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500">
          Follow
        </button>
        <button className="rounded-full border border-blue-300/45 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20">
          Message
        </button>
      </div>
    </section>
  );
}

function CoachFeed({ coach }: { coach: CoachProfile }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm lg:border-white/10 lg:bg-white/5 lg:shadow-none">
      <div className="text-sm font-semibold tracking-wide text-slate-800 lg:text-slate-100">COACHING FEED</div>

      <div className="mt-3 space-y-3">
        {coach.posts.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-500 lg:text-slate-400">
            No posts yet. Add program updates and highlights to build recruiting presence.
          </div>
        ) : (
          coach.posts.map((post) => (
            <article key={post.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800 lg:text-slate-100">{coach.name}</div>
                <div className="text-xs text-slate-500 lg:text-slate-400">{post.createdAt}</div>
              </div>

              <div className="mt-2">{mediaNode(post)}</div>

              <p className="mt-2 text-sm leading-6 text-slate-700 lg:text-slate-200">{post.caption}</p>

              {post.hashtags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {post.hashtags.map((tag) => (
                    <span key={`${post.id}-${tag}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-cyan-200">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function CoachCareerPanel({ coach }: { coach: CoachProfile }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm lg:border-white/10 lg:bg-white/5 lg:shadow-none">
      <div className="text-sm font-semibold tracking-wide text-slate-800 lg:text-slate-100">CAREER & PROGRAM</div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-slate-500 lg:text-slate-400">Active Teams</div>
          <div className="mt-1 text-xl font-bold text-slate-900 lg:text-cyan-200">{coach.programStats.activeTeams}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-slate-500 lg:text-slate-400">Athletes</div>
          <div className="mt-1 text-xl font-bold text-slate-900 lg:text-cyan-200">{coach.programStats.activeAthletes}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-slate-500 lg:text-slate-400">Pending</div>
          <div className="mt-1 text-xl font-bold text-slate-900 lg:text-cyan-200">{coach.programStats.pendingApprovals}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="text-slate-500 lg:text-slate-400">Posts</div>
          <div className="mt-1 text-xl font-bold text-slate-900 lg:text-cyan-200">{coach.programStats.postsPublished}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:text-slate-300">Career Highlights</div>
        <ul className="mt-2 space-y-1 text-sm text-slate-700 lg:text-slate-200">
          {coach.achievements.map((item, idx) => (
            <li key={`${item}-${idx}`} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:text-slate-300">Timeline</div>
        <div className="mt-2 space-y-2">
          {coach.timeline.map((item, idx) => (
            <div key={`${item.year}-${item.title}-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
              <div className="text-xs text-cyan-300">{item.year}</div>
              <div className="text-sm font-semibold text-slate-800 lg:text-slate-100">{item.title}</div>
              <div className="text-xs text-slate-500 lg:text-slate-400">{item.subtitle}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:text-slate-300">Teams</div>
        <div className="mt-2 space-y-2">
          {coach.teams.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-500 lg:text-slate-400">
              No teams found for this school yet.
            </div>
          ) : (
            coach.teams.slice(0, 5).map((team) => (
              <div key={team.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-sm font-medium text-slate-800 lg:text-slate-100">{team.teamName}</div>
                <div className="text-xs text-slate-500 lg:text-slate-400">
                  {team.sport} • {team.activeMemberCount} active • {team.pendingMemberCount} pending
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function CoachTeamsPanel({ coach }: { coach: CoachProfile }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm lg:border-white/10 lg:bg-white/5 lg:shadow-none">
      <div className="text-sm font-semibold tracking-wide text-slate-800 lg:text-slate-100">PROGRAM TEAMS</div>
      <div className="mt-2 text-xs text-slate-500 lg:text-slate-400">
        {coach.schoolName} • {coach.sport}
      </div>

      <div className="mt-3 space-y-2">
        {coach.teams.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-500 lg:text-slate-400">
            No teams found for this school yet.
          </div>
        ) : (
          coach.teams.map((team) => (
            <div key={team.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="text-sm font-medium text-slate-800 lg:text-slate-100">{team.teamName}</div>
              <div className="text-xs text-slate-500 lg:text-slate-400">
                {team.sport} • {team.activeMemberCount} active • {team.pendingMemberCount} pending
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function CoachProfileShell({ coach, embedded = false, canEdit = true }: CoachProfileShellProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("posts");
  const [profile, setProfile] = useState<CoachProfile>(() => mergeCoachWithMeta(coach));
  const [draft, setDraft] = useState<CoachEditDraft>(() => draftFromCoach(mergeCoachWithMeta(coach)));
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const profileMetaStorageKey = useMemo(() => `recruitr_coach_profile_meta_${coach.id}`, [coach.id]);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(coach.avatarUrl || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(coach.bannerUrl || null);
  const [avatarMediaAssetId, setAvatarMediaAssetId] = useState<number | null>(coach.avatarMediaAssetId ?? null);
  const [bannerMediaAssetId, setBannerMediaAssetId] = useState<number | null>(coach.bannerMediaAssetId ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    const hydrated = mergeCoachWithMeta(coach);
    setProfile(hydrated);
    setDraft(draftFromCoach(hydrated));
    setAvatarPreview(hydrated.avatarUrl || null);
    setBannerPreview(hydrated.bannerUrl || null);
    setAvatarMediaAssetId(hydrated.avatarMediaAssetId ?? null);
    setBannerMediaAssetId(hydrated.bannerMediaAssetId ?? null);
  }, [coach]);

  const initials = useMemo(() => toInitials(profile.name), [profile.name]);

  function onDraftChange<K extends keyof CoachEditDraft>(key: K, value: CoachEditDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function onAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    if (!token) {
      setSaveError("You need to be signed in to upload a profile photo.");
      return;
    }
    const previousPreview = avatarPreview;
    const previousAvatarId = avatarMediaAssetId;
    try {
      const next = await optimizeImageForStorage(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.82,
      });
      setAvatarPreview(next);
      setUploadingAvatar(true);
      const session = await createProfileUploadSession(token, file);
      const uploaded = await uploadFileWithProgress(token, session.uploadUrl, file);
      setAvatarPreview(uploaded.publicUrl);
      setAvatarMediaAssetId(uploaded.mediaAssetId);
      window.dispatchEvent(new Event("recruitr-profile-avatar-updated"));
      setSaveError(null);
    } catch (err) {
      setAvatarPreview(previousPreview);
      setAvatarMediaAssetId(previousAvatarId);
      setSaveError(err instanceof Error ? err.message : "Unable to process profile photo.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function onBannerUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    if (!token) {
      setSaveError("You need to be signed in to upload a banner image.");
      return;
    }
    const previousPreview = bannerPreview;
    const previousBannerId = bannerMediaAssetId;
    try {
      const next = await optimizeImageForStorage(file, {
        maxWidth: 1400,
        maxHeight: 720,
        quality: 0.8,
      });
      setBannerPreview(next);
      setUploadingBanner(true);
      const session = await createProfileUploadSession(token, file);
      const uploaded = await uploadFileWithProgress(token, session.uploadUrl, file);
      setBannerPreview(uploaded.publicUrl);
      setBannerMediaAssetId(uploaded.mediaAssetId);
      setSaveError(null);
    } catch (err) {
      setBannerPreview(previousPreview);
      setBannerMediaAssetId(previousBannerId);
      setSaveError(err instanceof Error ? err.message : "Unable to process banner image.");
    } finally {
      setUploadingBanner(false);
      e.target.value = "";
    }
  }

  function cancelEdit() {
    setDraft(draftFromCoach(profile));
    setAvatarPreview(profile.avatarUrl || null);
    setBannerPreview(profile.bannerUrl || null);
    setAvatarMediaAssetId(profile.avatarMediaAssetId ?? null);
    setBannerMediaAssetId(profile.bannerMediaAssetId ?? null);
    setSaveError(null);
    setSaveOk(null);
    setEditMode(false);
  }

  async function saveProfile() {
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    if (!firstName || !lastName) {
      setSaveError("First and last name are required.");
      return;
    }

    const nextProfile: CoachProfile = {
      ...profile,
      name: `${firstName} ${lastName}`.trim(),
      title: draft.title.trim() || profile.title,
      schoolName: draft.schoolName.trim() || profile.schoolName,
      teamName: draft.teamName.trim() || profile.teamName,
      organizationName: draft.organizationName.trim() || profile.organizationName,
      sport: draft.sport.trim() || profile.sport,
      level: draft.level.trim() || profile.level,
      followers: Math.max(0, toInt(draft.followers, profile.followers)),
      connections: Math.max(0, toInt(draft.connections, profile.connections)),
      bio: draft.bio.trim() || profile.bio,
      achievements: [
        `Organization: ${draft.organizationName.trim() || profile.organizationName}`,
        `Sport focus: ${draft.sport.trim() || profile.sport}`,
        `Competition level: ${draft.level.trim() || profile.level}`,
        profile.isVerifiedCoach ? "Verified coach on Recruitr" : "Verification pending",
      ],
    };

    setSaving(true);
    setSaveError(null);
    setSaveOk(null);

    try {
      const token = getToken();
      if (token) {
        const payload: CoachProfileForm = {
          firstName,
          lastName,
          title: nextProfile.title,
          organizationName: nextProfile.organizationName,
          schoolUnitId: nextProfile.schoolUnitId || null,
          schoolName: nextProfile.schoolName,
          sport: nextProfile.sport,
          level: nextProfile.level,
          bio: nextProfile.bio,
          isVerifiedCoach: nextProfile.isVerifiedCoach,
          avatarMediaAssetId,
          bannerMediaAssetId,
        };
        const saved = await upsertMyCoachProfile(token, payload);
        nextProfile.avatarUrl = saved.profile.avatarUrl ?? avatarPreview ?? null;
        nextProfile.bannerUrl = saved.profile.bannerUrl ?? bannerPreview ?? null;
        nextProfile.avatarMediaAssetId = saved.profile.avatarMediaAssetId ?? avatarMediaAssetId;
        nextProfile.bannerMediaAssetId = saved.profile.bannerMediaAssetId ?? bannerMediaAssetId;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(profileMetaStorageKey, JSON.stringify(buildCoachMeta(nextProfile)));
      }

      if (token) {
        const stored = getStoredUser();
        if (stored) {
          setAuth(token, {
            ...stored,
            coach_profile: stored.coach_profile
              ? {
                  ...stored.coach_profile,
                  first_name: firstName,
                  last_name: lastName,
                  title: nextProfile.title,
                  organization_name: nextProfile.organizationName,
                  sport: nextProfile.sport,
                  level: nextProfile.level,
                  bio: nextProfile.bio,
                  school_name: nextProfile.schoolName,
                  avatar_url: nextProfile.avatarUrl ?? null,
                  banner_url: nextProfile.bannerUrl ?? null,
                }
              : stored.coach_profile,
          });
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("recruitr-profile-avatar-updated"));
          }
        }
      }

      setProfile(nextProfile);
      setAvatarPreview(nextProfile.avatarUrl || null);
      setBannerPreview(nextProfile.bannerUrl || null);
      setSaveOk("Profile updated.");
      setEditMode(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={
        embedded
          ? "coach-profile-shell relative overflow-x-hidden text-slate-900 lg:text-slate-100"
          : "theme-content coach-profile-shell relative min-h-screen overflow-x-hidden bg-neutral-950 text-[var(--app-text)]"
      }
    >
      <div
        className={
          embedded
            ? "w-full pb-4 pt-1"
            : "mx-auto w-full max-w-[1320px] px-3 pb-24 pt-3 sm:px-4 lg:px-8 lg:pb-10 lg:pt-8"
        }
      >
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur lg:border-white/10 lg:bg-white/5 lg:shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="relative h-44 border-b border-slate-200 sm:h-56 lg:h-64 lg:border-white/10">
            {bannerPreview ? (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bannerPreview})` }} />
            ) : (
              <>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,#0e2952_0%,#0a1f3f_45%,#071631_100%)]" />
                <div className="absolute -left-16 top-4 h-28 w-56 rotate-[-14deg] rounded-full bg-cyan-300/30 blur-2xl" />
                <div className="absolute -right-16 top-6 h-28 w-56 rotate-[14deg] rounded-full bg-cyan-200/28 blur-2xl" />
              </>
            )}

            {!bannerPreview && profile.schoolLogoUrl ? (
              <img
                src={profile.schoolLogoUrl}
                alt={`${profile.schoolName} logo`}
                className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-xl object-contain opacity-65 sm:h-32 sm:w-32"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : null}

            <div className="absolute inset-0 bg-black/24" />

            <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-black/30 px-3 py-1 text-xs font-semibold tracking-wide">
                <IconSchool />
                {profile.schoolName}
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{profile.teamName}</div>
              <div className="mt-1 text-sm text-cyan-100/90">
                {profile.sport} • {profile.level} • {profile.organizationName}
              </div>
            </div>

            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
              {canEdit ? (
                <button
                  onClick={() => {
                    if (editMode) {
                      cancelEdit();
                    } else {
                      setDraft(draftFromCoach(profile));
                      setSaveError(null);
                      setSaveOk(null);
                      setEditMode(true);
                    }
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    editMode
                      ? "bg-emerald-500 text-white"
                      : "border border-white/30 bg-black/45 text-white"
                  }`}
                >
                  {editMode ? "Cancel" : "Edit profile"}
                </button>
              ) : null}

              {editMode && canEdit ? (
                <>
                  <label className="rounded-full border border-white/30 bg-black/45 px-3 py-1.5 text-xs font-semibold text-white">
                    Upload banner
                    <input type="file" accept="image/*" className="hidden" onChange={onBannerUpload} />
                  </label>
                  <button
                    onClick={() => {
                      setBannerPreview(null);
                      setBannerMediaAssetId(null);
                    }}
                    className="rounded-full border border-white/30 bg-black/45 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Use school logo
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {editMode && canEdit ? (
            <section className="border-b border-slate-200 px-4 py-4 lg:border-white/10 lg:px-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 lg:text-slate-300">Edit Coach Profile</div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  First name
                  <input value={draft.firstName} onChange={(e) => onDraftChange("firstName", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Last name
                  <input value={draft.lastName} onChange={(e) => onDraftChange("lastName", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Title
                  <input value={draft.title} onChange={(e) => onDraftChange("title", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Sport
                  <input value={draft.sport} onChange={(e) => onDraftChange("sport", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Level
                  <input value={draft.level} onChange={(e) => onDraftChange("level", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  School
                  <input value={draft.schoolName} onChange={(e) => onDraftChange("schoolName", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Team name
                  <input value={draft.teamName} onChange={(e) => onDraftChange("teamName", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Organization
                  <input value={draft.organizationName} onChange={(e) => onDraftChange("organizationName", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Followers
                  <input value={draft.followers} onChange={(e) => onDraftChange("followers", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Connections
                  <input value={draft.connections} onChange={(e) => onDraftChange("connections", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300 md:col-span-2">
                  Bio
                  <textarea value={draft.bio} onChange={(e) => onDraftChange("bio", e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
              </div>

              {saveError ? <div className="mt-3 rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</div> : null}
              {saveOk ? <div className="mt-3 rounded-lg border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{saveOk}</div> : null}

              <div className="mt-3 flex items-center justify-end gap-2">
                <button onClick={cancelEdit} disabled={saving || uploadingAvatar || uploadingBanner} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60 lg:border-white/20 lg:bg-black/30 lg:text-slate-100">Cancel</button>
                <button onClick={saveProfile} disabled={saving || uploadingAvatar || uploadingBanner} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60">{saving ? "Saving..." : uploadingAvatar || uploadingBanner ? "Uploading..." : "Save profile"}</button>
              </div>
            </section>
          ) : saveOk && canEdit ? (
            <div className="border-b border-slate-200 px-4 py-2 text-xs text-emerald-700 lg:border-white/10 lg:text-emerald-300">{saveOk}</div>
          ) : null}

          <section className="border-b border-slate-200 px-4 py-4 lg:border-white/10 lg:px-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 lg:text-slate-300">Coach Bio</div>
            <p className="mt-2 text-sm leading-7 text-slate-700 lg:text-slate-200">{profile.bio}</p>
          </section>

          <div className="lg:hidden">
            <section className="border-b border-slate-200 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-cyan-300/55 bg-gradient-to-br from-[#0b2b53] to-[#081a33] text-2xl font-bold text-cyan-100">
                  {avatarPreview ? (
                    <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${avatarPreview})` }} />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl font-bold text-slate-900">{profile.name}</div>
                  <div className="text-sm text-slate-600">{profile.title}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><IconPeople /> {profile.followers} followers</span>
                    <span className="inline-flex items-center gap-1"><IconChart /> {profile.connections} connections</span>
                  </div>
                </div>
              </div>

              {editMode ? (
                <div className="mt-3">
                  <label className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Upload photo
                    <input type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
                  </label>
                </div>
              ) : null}

              <div className="mt-3 flex gap-2">
                <button className="flex-1 rounded-full bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Follow</button>
                <button className="flex-1 rounded-full border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700">Message</button>
              </div>
            </section>

            <div className={`sticky z-20 border-y border-slate-200 bg-white px-4 ${embedded ? "top-16" : "top-0"}`}>
              <div className="flex items-center justify-between">
                {mobileTabButton(mobileTab, "posts", "Posts", setMobileTab)}
                {mobileTabButton(mobileTab, "career", "Career", setMobileTab)}
                {mobileTabButton(mobileTab, "teams", "Teams", setMobileTab)}
                {mobileTabButton(mobileTab, "info", "Info", setMobileTab)}
              </div>
            </div>

            <div className="p-4">
              {mobileTab === "posts" ? <CoachFeed coach={profile} /> : null}
              {mobileTab === "career" ? <CoachCareerPanel coach={profile} /> : null}
              {mobileTab === "teams" ? <CoachTeamsPanel coach={profile} /> : null}
              {mobileTab === "info" ? <CoachCard coach={profile} avatarUrl={avatarPreview} editMode={editMode} onAvatarUpload={onAvatarUpload} /> : null}
            </div>
          </div>

          <div className="hidden gap-4 p-4 lg:grid lg:grid-cols-12 lg:p-5">
            <div className="col-span-3">
              <CoachCard coach={profile} avatarUrl={avatarPreview} editMode={editMode} onAvatarUpload={onAvatarUpload} />
            </div>
            <div className="col-span-6">
              <CoachFeed coach={profile} />
            </div>
            <div className="col-span-3">
              <CoachCareerPanel coach={profile} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
