"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import PlayerCard from "@/components/athlete/PlayerCard";
import PerformanceFeed from "@/components/athlete/PerformanceFeed";
import StatsAnalytics from "@/components/athlete/StatsAnalytics";
import ProfileHeaderMobile from "@/components/athlete/ProfileHeaderMobile";
import { getStoredUser, getToken, setAuth } from "@/lib/auth";
import { optimizeImageForStorage } from "@/lib/image-storage";
import {
  createProfileUploadSession,
  upsertMyAthleteProfile,
  uploadFileWithProgress,
  type AthleteProfileForm,
} from "@/lib/api";
import type { AthleteProfile } from "@/lib/mockAthleteProfile";

type AthleteProfileShellProps = {
  athlete: AthleteProfile;
  embedded?: boolean;
  canEdit?: boolean;
};

type MobileTab = "posts" | "stats" | "academics" | "info";

type AthleteLocalMeta = {
  name?: string;
  nickname?: string;
  sport?: string;
  position?: string;
  classYear?: number;
  stars?: number;
  height?: string;
  weight?: string;
  schoolName?: string;
  teamName?: string;
  state?: string | null;
  bio?: string;
  rankingNational?: number;
  rankingPosition?: number;
  seasonStats?: AthleteProfile["seasonStats"];
  academics?: Partial<AthleteProfile["academics"]>;
  followers?: number;
  connections?: number;
};

type AthleteEditDraft = {
  firstName: string;
  lastName: string;
  nickname: string;
  sport: string;
  position: string;
  classYear: string;
  stars: string;
  height: string;
  weight: string;
  schoolName: string;
  teamName: string;
  state: string;
  highSchool: string;
  bio: string;
  rankingNational: string;
  rankingPosition: string;
  rushingYards: string;
  tds: string;
  ydsPerCarry: string;
  receivingYards: string;
};

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.8-3.3 5.1-5 8-5s6.2 1.7 8 5" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconPost() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function IconExplore() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="m15.5 8.5-2.2 5.4-5.4 2.2 2.2-5.4z" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.8-3.3 5.1-5 8-5s6.2 1.7 8 5" />
    </svg>
  );
}

function formatFollowers(n: number) {
  if (n >= 1000) return `${Math.round((n / 1000) * 10) / 10}k`;
  return String(n);
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

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function toInt(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(value: string, fallback: number) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mergeAthleteWithMeta(base: AthleteProfile): AthleteProfile {
  if (typeof window === "undefined") return base;
  const key = `recruitr_athlete_profile_meta_${base.id}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return base;

  try {
    const meta = JSON.parse(raw) as AthleteLocalMeta;
    return {
      ...base,
      name: meta.name || base.name,
      nickname: meta.nickname || base.nickname,
      sport: meta.sport || base.sport,
      position: meta.position || base.position,
      classYear: meta.classYear || base.classYear,
      stars: meta.stars || base.stars,
      height: meta.height || base.height,
      weight: meta.weight || base.weight,
      schoolName: meta.schoolName || base.schoolName,
      teamName: meta.teamName || base.teamName,
      state: meta.state ?? base.state,
      bio: meta.bio || base.bio,
      rankingNational: meta.rankingNational || base.rankingNational,
      rankingPosition: meta.rankingPosition || base.rankingPosition,
      seasonStats: meta.seasonStats || base.seasonStats,
      academics: {
        ...base.academics,
        ...(meta.academics || {}),
      },
      followers: meta.followers ?? base.followers,
      connections: meta.connections ?? base.connections,
    };
  } catch {
    return base;
  }
}

function buildAthleteMeta(profile: AthleteProfile): AthleteLocalMeta {
  return {
    name: profile.name,
    nickname: profile.nickname,
    sport: profile.sport,
    position: profile.position,
    classYear: profile.classYear,
    stars: profile.stars,
    height: profile.height,
    weight: profile.weight,
    schoolName: profile.schoolName,
    teamName: profile.teamName,
    state: profile.state ?? null,
    bio: profile.bio,
    rankingNational: profile.rankingNational,
    rankingPosition: profile.rankingPosition,
    seasonStats: profile.seasonStats,
    academics: profile.academics,
    followers: profile.followers,
    connections: profile.connections,
  };
}

function draftFromProfile(profile: AthleteProfile): AthleteEditDraft {
  const parts = splitName(profile.name);
  return {
    firstName: parts.firstName,
    lastName: parts.lastName,
    nickname: profile.nickname,
    sport: profile.sport,
    position: profile.position,
    classYear: String(profile.classYear),
    stars: String(profile.stars),
    height: profile.height,
    weight: profile.weight,
    schoolName: profile.schoolName,
    teamName: profile.teamName,
    state: profile.state || "",
    highSchool: profile.academics.highSchool,
    bio: profile.bio,
    rankingNational: String(profile.rankingNational),
    rankingPosition: String(profile.rankingPosition),
    rushingYards: String(profile.seasonStats.rushingYards),
    tds: String(profile.seasonStats.tds),
    ydsPerCarry: String(profile.seasonStats.ydsPerCarry),
    receivingYards: String(profile.seasonStats.receivingYards),
  };
}

export default function AthleteProfileShell({ athlete, embedded = false, canEdit = true }: AthleteProfileShellProps) {
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("posts");
  const [profile, setProfile] = useState<AthleteProfile>(() => mergeAthleteWithMeta(athlete));
  const [draft, setDraft] = useState<AthleteEditDraft>(() => draftFromProfile(mergeAthleteWithMeta(athlete)));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const profileMetaStorageKey = useMemo(() => `recruitr_athlete_profile_meta_${athlete.id}`, [athlete.id]);

  const [heroPreview, setHeroPreview] = useState<string | null>(athlete.bannerUrl || null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(athlete.avatarUrl || null);
  const [avatarMediaAssetId, setAvatarMediaAssetId] = useState<number | null>(athlete.avatarMediaAssetId ?? null);
  const [bannerMediaAssetId, setBannerMediaAssetId] = useState<number | null>(athlete.bannerMediaAssetId ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    const hydrated = mergeAthleteWithMeta(athlete);
    setProfile(hydrated);
    setDraft(draftFromProfile(hydrated));
    setHeroPreview(hydrated.bannerUrl || null);
    setAvatarPreview(hydrated.avatarUrl || null);
    setAvatarMediaAssetId(hydrated.avatarMediaAssetId ?? null);
    setBannerMediaAssetId(hydrated.bannerMediaAssetId ?? null);
  }, [athlete]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 220);
    return () => window.clearTimeout(timer);
  }, []);

  async function onHeroUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    if (!token) {
      setSaveError("You need to be signed in to upload a banner image.");
      return;
    }
    const previousPreview = heroPreview;
    const previousBannerId = bannerMediaAssetId;
    try {
      const next = await optimizeImageForStorage(file, {
        maxWidth: 1400,
        maxHeight: 720,
        quality: 0.8,
      });
      setHeroPreview(next);
      setUploadingBanner(true);
      const session = await createProfileUploadSession(token, file);
      const uploaded = await uploadFileWithProgress(token, session.uploadUrl, file);
      setHeroPreview(uploaded.publicUrl);
      setBannerMediaAssetId(uploaded.mediaAssetId);
      setSaveError(null);
    } catch (err) {
      setHeroPreview(previousPreview);
      setBannerMediaAssetId(previousBannerId);
      setSaveError(err instanceof Error ? err.message : "Unable to process banner image.");
    } finally {
      setUploadingBanner(false);
      e.target.value = "";
    }
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

  function onDraftChange<K extends keyof AthleteEditDraft>(key: K, value: AthleteEditDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function cancelEdit() {
    setDraft(draftFromProfile(profile));
    setHeroPreview(profile.bannerUrl || null);
    setAvatarPreview(profile.avatarUrl || null);
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

    const nextClassYear = toInt(draft.classYear, profile.classYear);
    const nextStars = clampInt(toInt(draft.stars, profile.stars), 1, 5);
    const fullName = `${firstName} ${lastName}`.trim();

    const nextProfile: AthleteProfile = {
      ...profile,
      name: fullName,
      nickname: draft.nickname.trim() || profile.nickname,
      sport: draft.sport.trim() || profile.sport,
      position: draft.position.trim() || profile.position,
      classYear: nextClassYear,
      stars: nextStars,
      height: draft.height.trim() || "--",
      weight: draft.weight.trim() || "--",
      schoolName: draft.schoolName.trim() || profile.schoolName,
      teamName: draft.teamName.trim() || draft.schoolName.trim() || profile.teamName,
      state: draft.state.trim() || null,
      bio: draft.bio.trim() || profile.bio,
      rankingNational: clampInt(toInt(draft.rankingNational, profile.rankingNational), 1, 9999),
      rankingPosition: clampInt(toInt(draft.rankingPosition, profile.rankingPosition), 1, 999),
      seasonStats: {
        rushingYards: Math.max(0, toInt(draft.rushingYards, profile.seasonStats.rushingYards)),
        tds: Math.max(0, toInt(draft.tds, profile.seasonStats.tds)),
        ydsPerCarry: Math.max(0, toFloat(draft.ydsPerCarry, profile.seasonStats.ydsPerCarry)),
        receivingYards: Math.max(0, toInt(draft.receivingYards, profile.seasonStats.receivingYards)),
      },
      academics: {
        ...profile.academics,
        highSchool: draft.highSchool.trim() || profile.academics.highSchool,
        committedUniversity: draft.schoolName.trim() || profile.academics.committedUniversity,
      },
      accolades: [
        `Sport: ${draft.sport.trim() || profile.sport}`,
        `Position: ${draft.position.trim() || profile.position}`,
        `Posts published: ${profile.posts.length}`,
        `State: ${draft.state.trim() || "Not set"}`,
      ],
    };

    setSaving(true);
    setSaveError(null);
    setSaveOk(null);

    try {
      const token = getToken();
      if (token) {
        const payload: AthleteProfileForm = {
          firstName,
          lastName,
          sport: nextProfile.sport,
          gradYear: nextClassYear,
          positions: [nextProfile.position],
          state: nextProfile.state || "",
          country: "USA",
          willingToTravel: false,
          travelRadiusMi: null,
          clubTeam: nextProfile.teamName,
          schoolUnitId: profile.schoolUnitId || null,
          schoolName: nextProfile.schoolName,
          highSchool: nextProfile.academics.highSchool,
          bio: nextProfile.bio,
          avatarMediaAssetId,
          bannerMediaAssetId,
        };
        const saved = await upsertMyAthleteProfile(token, payload);
        nextProfile.avatarUrl = saved.profile.avatarUrl ?? avatarPreview ?? null;
        nextProfile.bannerUrl = saved.profile.bannerUrl ?? heroPreview ?? null;
        nextProfile.avatarMediaAssetId = saved.profile.avatarMediaAssetId ?? avatarMediaAssetId;
        nextProfile.bannerMediaAssetId = saved.profile.bannerMediaAssetId ?? bannerMediaAssetId;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(profileMetaStorageKey, JSON.stringify(buildAthleteMeta(nextProfile)));
      }

      setProfile(nextProfile);
      setAvatarPreview(nextProfile.avatarUrl || null);
      setHeroPreview(nextProfile.bannerUrl || null);
      if (token) {
        const stored = getStoredUser();
        if (stored) {
          setAuth(token, {
            ...stored,
            athlete_profile: stored.athlete_profile
              ? {
                  ...stored.athlete_profile,
                  first_name: firstName,
                  last_name: lastName,
                  sport: nextProfile.sport,
                  grad_year: nextProfile.classYear,
                  positions: [nextProfile.position],
                  state: nextProfile.state || null,
                  high_school: nextProfile.academics.highSchool,
                  bio: nextProfile.bio,
                  school_name: nextProfile.schoolName,
                  avatar_url: nextProfile.avatarUrl ?? null,
                  banner_url: nextProfile.bannerUrl ?? null,
                }
              : stored.athlete_profile,
          });
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("recruitr-profile-avatar-updated"));
          }
        }
      }

      setSaveOk("Profile updated.");
      setEditMode(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className={
          embedded
            ? "px-0 py-0"
            : "theme-content min-h-screen bg-neutral-950 px-4 py-6 text-[var(--app-text)] lg:px-8 lg:py-8"
        }
      >
        <div
          className={
            embedded
              ? "h-[640px] w-full animate-pulse rounded-3xl border border-slate-200 bg-white lg:border-white/10 lg:bg-white/5"
              : "mx-auto h-[640px] w-full max-w-[1280px] animate-pulse rounded-3xl border border-slate-200 bg-white lg:border-white/10 lg:bg-white/5"
          }
        />
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? "athlete-profile-shell relative overflow-x-hidden text-slate-900 lg:text-slate-100"
          : "theme-content athlete-profile-shell relative min-h-screen overflow-x-hidden bg-neutral-950 text-[var(--app-text)]"
      }
    >
      {!embedded ? (
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="absolute -left-10 top-16 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute -right-14 top-10 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        </div>
      ) : null}

      <div
        className={
          embedded
            ? "w-full pb-4 pt-1"
            : "mx-auto w-full max-w-[1320px] px-3 pb-24 pt-3 sm:px-4 lg:px-8 lg:pb-10 lg:pt-8"
        }
      >
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur lg:border-white/10 lg:bg-white/5 lg:shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          {!embedded ? (
            <div className="border-b border-slate-200/90 bg-white/90 px-4 py-3 lg:border-white/10 lg:bg-slate-950/45 lg:px-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-cyan-400 to-blue-600 text-sm font-bold text-white">R</span>
                  <span className="text-slate-800 lg:text-slate-100">Recruitr</span>
                </div>

                <div className="mx-auto hidden max-w-md flex-1 sm:block">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 lg:border-white/15 lg:bg-white/10 lg:text-slate-300">
                    <IconSearch />
                    <input
                      className="w-full bg-transparent outline-none placeholder:text-slate-400"
                      placeholder="Search athletes, posts, schools"
                    />
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-1 text-slate-600 lg:text-slate-200">
                  {[<IconSearch key="s" />, <IconGrid key="g" />, <IconUser key="u" />].map((icon, idx) => (
                    <button key={idx} className="rounded-lg p-2 hover:bg-slate-100 lg:hover:bg-white/10">
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="relative h-44 border-b border-slate-200 sm:h-56 lg:h-64 lg:border-white/10">
            {heroPreview ? (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroPreview})` }} />
            ) : (
              <>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,#0f284f_0%,#0b1a34_45%,#070f21_100%)]" />
                <div className="absolute -left-16 top-4 h-28 w-56 rotate-[-14deg] rounded-full bg-cyan-300/35 blur-2xl" />
                <div className="absolute -right-16 top-6 h-28 w-56 rotate-[14deg] rounded-full bg-cyan-200/30 blur-2xl" />
                <div className="absolute inset-x-0 bottom-0 h-14 bg-[radial-gradient(900px_circle_at_50%_120%,rgba(59,130,246,0.42),transparent_58%)]" />
              </>
            )}

            {!heroPreview && profile.schoolLogoUrl ? (
              <img
                src={profile.schoolLogoUrl}
                alt={`${profile.schoolName} logo`}
                className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-xl object-contain opacity-65 sm:h-32 sm:w-32"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : null}

            <div className="absolute inset-0 bg-black/22" />

            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-white">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-white/40 bg-black/45 text-2xl font-bold">
                {profile.teamLogoTextOrUrl}
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{profile.teamName}</div>
            </div>

            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
              {canEdit ? (
              <button
                onClick={() => {
                  if (editMode) {
                    cancelEdit();
                  } else {
                    setDraft(draftFromProfile(profile));
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
                    <input type="file" accept="image/*" className="hidden" onChange={onHeroUpload} />
                  </label>
                  <button
                    onClick={() => {
                      setHeroPreview(null);
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
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 lg:text-slate-300">Edit Athlete Profile</div>

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
                  Nickname
                  <input value={draft.nickname} onChange={(e) => onDraftChange("nickname", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Sport
                  <input value={draft.sport} onChange={(e) => onDraftChange("sport", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Position
                  <input value={draft.position} onChange={(e) => onDraftChange("position", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Class year
                  <input value={draft.classYear} onChange={(e) => onDraftChange("classYear", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Star rating (1-5)
                  <input value={draft.stars} onChange={(e) => onDraftChange("stars", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  State
                  <input value={draft.state} onChange={(e) => onDraftChange("state", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Height
                  <input value={draft.height} onChange={(e) => onDraftChange("height", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Weight
                  <input value={draft.weight} onChange={(e) => onDraftChange("weight", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  School name
                  <input value={draft.schoolName} onChange={(e) => onDraftChange("schoolName", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Team name
                  <input value={draft.teamName} onChange={(e) => onDraftChange("teamName", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300 md:col-span-2">
                  High school / program
                  <input value={draft.highSchool} onChange={(e) => onDraftChange("highSchool", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  National rank
                  <input value={draft.rankingNational} onChange={(e) => onDraftChange("rankingNational", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Position rank
                  <input value={draft.rankingPosition} onChange={(e) => onDraftChange("rankingPosition", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Rushing yards
                  <input value={draft.rushingYards} onChange={(e) => onDraftChange("rushingYards", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  TDs
                  <input value={draft.tds} onChange={(e) => onDraftChange("tds", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Yards / carry
                  <input value={draft.ydsPerCarry} onChange={(e) => onDraftChange("ydsPerCarry", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
                </label>
                <label className="text-xs text-slate-600 lg:text-slate-300">
                  Receiving yards
                  <input value={draft.receivingYards} onChange={(e) => onDraftChange("receivingYards", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 lg:border-white/20 lg:bg-black/25 lg:text-slate-100" />
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

          <div className="lg:hidden">
            <ProfileHeaderMobile
              athlete={profile}
              avatarUrl={avatarPreview}
              editMode={editMode}
              onAvatarUpload={onAvatarUpload}
            />

            <div className={`sticky z-20 border-y border-slate-200 bg-white px-4 ${embedded ? "top-16" : "top-0"}`}>
              <div className="flex items-center justify-between">
                {mobileTabButton(mobileTab, "posts", "Posts", setMobileTab)}
                {mobileTabButton(mobileTab, "stats", "Stats", setMobileTab)}
                {mobileTabButton(mobileTab, "academics", "Academics", setMobileTab)}
                {mobileTabButton(mobileTab, "info", "Info", setMobileTab)}
              </div>
            </div>

            <div className="p-4">
              {mobileTab === "posts" ? (
                <PerformanceFeed athleteName={profile.name} posts={profile.posts} title="FEED" compact />
              ) : null}

              {mobileTab === "stats" ? <StatsAnalytics athlete={profile} title="" compact /> : null}

              {mobileTab === "academics" ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold tracking-wide text-slate-800">ACADEMICS</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div><span className="font-semibold">High School:</span> {profile.academics.highSchool}</div>
                    <div><span className="font-semibold">Committed:</span> {profile.academics.committedUniversity}</div>
                    <div><span className="font-semibold">GPA:</span> {profile.academics.gpa}</div>
                    <div><span className="font-semibold">SAT:</span> {profile.academics.sat}</div>
                    <div><span className="font-semibold">Intended Major:</span> {profile.academics.intendedMajor}</div>
                  </div>
                </section>
              ) : null}

              {mobileTab === "info" ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold tracking-wide text-slate-800">INFO</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{profile.bio}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-100 p-2"><span className="text-slate-500">Followers</span><div className="font-semibold">{formatFollowers(profile.followers)}</div></div>
                    <div className="rounded-xl bg-slate-100 p-2"><span className="text-slate-500">Connections</span><div className="font-semibold">{profile.connections}</div></div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <div className="hidden gap-4 p-4 lg:grid lg:grid-cols-12 lg:p-5">
            <div className="col-span-3">
              <PlayerCard
                athlete={profile}
                avatarUrl={avatarPreview}
                editMode={editMode}
                onAvatarUpload={onAvatarUpload}
              />
            </div>
            <div className="col-span-6">
              <PerformanceFeed athleteName={profile.name} posts={profile.posts} />
            </div>
            <div className="col-span-3">
              <StatsAnalytics athlete={profile} />
            </div>
          </div>
        </div>
      </div>

      {!embedded ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-2 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between text-slate-500">
            <button className="flex flex-col items-center gap-1 text-[11px] font-medium text-slate-700">
              <IconHome /> Home
            </button>
            <button className="flex flex-col items-center gap-1 text-[11px] font-medium">
              <IconExplore /> Explore
            </button>
            <button className="flex flex-col items-center gap-1 text-[11px] font-medium">
              <IconPost /> Posts
            </button>
            <button className="flex flex-col items-center gap-1 text-[11px] font-medium">
              <IconMessage /> Messages
            </button>
            <button className="flex flex-col items-center gap-1 text-[11px] font-medium text-blue-700">
              <IconProfile /> Profile
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
