"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CoachProfileShell from "@/components/coach/CoachProfileShell";
import {
  getCoachProfileByUserId,
  getMe,
  getPostsByUser,
  getSchoolByUnitid,
  getSchoolTeams,
  type CoachProfileForm,
  type MyPostItem,
  type SchoolTeamItem,
} from "@/lib/api";
import { getToken, setAuth } from "@/lib/auth";
import { normalizeProfileUserId } from "@/lib/profile-routes";
import type { CoachProfile as CoachViewProfile } from "@/lib/mockCoachProfile";

function toTitle(value: string | null | undefined, fallback: string) {
  const clean = (value ?? "").trim();
  if (!clean) return fallback;
  return clean
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recent";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function stripHash(tag: string) {
  return tag.startsWith("#") ? tag.slice(1) : tag;
}

function buildCoachProfile(
  userId: number,
  profile: CoachProfileForm,
  posts: MyPostItem[],
  teams: SchoolTeamItem[],
  schoolLogoUrl: string | null
): CoachViewProfile {
  const firstName = (profile.firstName || "").trim();
  const lastName = (profile.lastName || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || `Coach ${userId}`;
  const sport = (profile.sport || "Sport not set").trim();
  const level = (profile.level || "Level not set").trim();
  const schoolName = (profile.schoolName || profile.organizationName || "Recruitr Program").trim();
  const organizationName = (profile.organizationName || schoolName || "Organization not set").trim();
  const teamName =
    teams.find((t) => t.sport.toLowerCase() === sport.toLowerCase())?.teamName ||
    teams[0]?.teamName ||
    `${toTitle(sport, "Program")} Program`;

  const mappedPosts = posts
    .filter((post) => Boolean(post.media?.src))
    .map((post) => ({
      id: String(post.id),
      createdAt: shortDate(post.createdAt),
      caption: post.caption || "",
      hashtags: (post.tags || []).map(stripHash),
      media: post.media?.src
        ? {
            kind: post.media.kind,
            src: post.media.src,
          }
        : null,
    }));

  const activeAthletes = teams.reduce((sum, t) => sum + (t.activeMemberCount || 0), 0);
  const pendingApprovals = teams.reduce((sum, t) => sum + (t.pendingMemberCount || 0), 0);
  const activeTeams = teams.length;
  const postsPublished = mappedPosts.length;
  const currentYear = new Date().getFullYear();

  return {
    id: String(userId),
    userId,
    name: fullName,
    title: profile.title || "Head Coach",
    schoolName,
    schoolUnitId: profile.schoolUnitId || null,
    teamName,
    schoolLogoUrl,
    avatarUrl: profile.avatarUrl || null,
    bannerUrl: profile.bannerUrl || null,
    avatarMediaAssetId: profile.avatarMediaAssetId ?? null,
    bannerMediaAssetId: profile.bannerMediaAssetId ?? null,
    sport: toTitle(sport, "Sport"),
    level: toTitle(level, "Level"),
    organizationName,
    isVerifiedCoach: Boolean(profile.isVerifiedCoach),
    bio:
      profile.bio ||
      `Coach profile for ${fullName}. Focused on player development, competitive growth, and recruiting outcomes for ${schoolName}.`,
    followers: Math.max(0, activeAthletes * 4 + (profile.isVerifiedCoach ? 220 : 80)),
    connections: Math.max(0, activeTeams * 18 + 90),
    programStats: {
      activeTeams,
      activeAthletes,
      pendingApprovals,
      postsPublished,
    },
    achievements: [
      `Organization: ${organizationName}`,
      `Sport focus: ${toTitle(sport, "Sport")}`,
      `Competition level: ${toTitle(level, "Level")}`,
      profile.isVerifiedCoach ? "Verified coach on Recruitr" : "Verification pending",
    ],
    timeline: [
      {
        year: String(currentYear - 4),
        title: `Joined ${organizationName}`,
        subtitle: `Built ${toTitle(sport, "athlete")} recruiting operations and program standards.`,
      },
      {
        year: String(currentYear - 2),
        title: "Program Growth",
        subtitle: `${activeAthletes} active athletes currently connected across ${activeTeams} teams.`,
      },
      {
        year: String(currentYear),
        title: profile.isVerifiedCoach ? "Verified Coach Status" : "Verification In Progress",
        subtitle: profile.isVerifiedCoach
          ? "Verified coach access enabled for direct messaging and recruiting workflows."
          : "Complete verification to unlock coach-only recruiting actions.",
      },
    ],
    teams: teams.map((team) => ({
      id: team.id,
      teamName: team.teamName,
      sport: team.sport,
      activeMemberCount: team.activeMemberCount,
      pendingMemberCount: team.pendingMemberCount,
    })),
    posts: mappedPosts,
  };
}

export default function CoachProfilePage() {
  const router = useRouter();
  const params = useParams<{ coachId?: string | string[] }>();
  const coachId = useMemo(() => {
    const raw = params?.coachId;
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<CoachViewProfile | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        if (!coachId) {
          throw new Error("Invalid coach profile path.");
        }

        const parsedCoachId = normalizeProfileUserId(coachId);
        if (!parsedCoachId) {
          throw new Error("Invalid coach profile path.");
        }

        const token = getToken();
        if (!token) {
          router.replace("/");
          return;
        }

        const me = await getMe(token);
        if (!alive) return;
        setAuth(token, me);

        if (me.id === parsedCoachId) {
          router.replace("/dashboard/profile");
          return;
        }

        const [profileRes, postsRes] = await Promise.all([
          getCoachProfileByUserId(token, parsedCoachId),
          getPostsByUser(token, parsedCoachId, 30),
        ]);

        if (!profileRes.profile) {
          throw new Error("Coach profile not found.");
        }

        const schoolUnitid = profileRes.profile.schoolUnitId || null;
        let schoolLogoUrl: string | null = null;
        let schoolTeams: SchoolTeamItem[] = [];

        if (schoolUnitid) {
          const [schoolRes, teamsRes] = await Promise.all([
            getSchoolByUnitid(token, schoolUnitid).catch(() => null),
            getSchoolTeams(token, schoolUnitid).catch(() => ({ items: [] })),
          ]);
          schoolLogoUrl = schoolRes?.school?.derived_logo_url || schoolRes?.school?.logo_url || null;
          schoolTeams = teamsRes.items || [];
        }

        if (!alive) return;
        setCoach(
          buildCoachProfile(
            parsedCoachId,
            profileRes.profile,
            postsRes.items || [],
            schoolTeams,
            schoolLogoUrl
          )
        );
        setError(null);
      } catch (e) {
        if (!alive) return;
        setCoach(null);
        setError(e instanceof Error ? e.message : "Failed to load coach profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [coachId, router]);

  if (loading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 px-4 py-6 text-[var(--app-text)] lg:px-8 lg:py-8">
        <div className="mx-auto h-[640px] w-full max-w-[1280px] animate-pulse rounded-3xl border border-slate-200 bg-white lg:border-white/10 lg:bg-white/5" />
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 px-4 py-6 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-300/60 bg-red-50/90 p-4 text-sm text-red-700 lg:border-red-400/40 lg:bg-red-500/10 lg:text-red-200">
          {error || "Unable to load coach profile."}
          <div className="mt-3">
            <button
              onClick={() => {
                router.push("/dashboard");
              }}
              className="rounded-lg border border-red-300/70 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 lg:border-red-300/40 lg:bg-transparent lg:text-red-200 lg:hover:bg-red-500/10"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <CoachProfileShell coach={coach} canEdit={false} />;
}
