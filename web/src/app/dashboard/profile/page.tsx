"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AthleteProfileShell from "@/components/athlete/AthleteProfileShell";
import CoachProfileShell from "@/components/coach/CoachProfileShell";
import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import {
  getMe,
  getMyAthleteProfile,
  getMyPosts,
  getNotifications,
  getSchoolByUnitid,
  getSchoolTeams,
  type AthleteProfileForm,
  type MeUser,
  type MyPostItem,
  type SchoolTeamItem,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";
import type {
  AthletePost as AthleteViewPost,
  AthleteProfile as AthleteViewProfile,
} from "@/lib/mockAthleteProfile";
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

function buildProfile(
  user: MeUser,
  profile: AthleteProfileForm | null,
  myPosts: MyPostItem[],
  schoolLogoUrl: string | null
): AthleteViewProfile {
  const ap = user.athlete_profile;

  const firstName = (profile?.firstName || ap?.first_name || "").trim();
  const lastName = (profile?.lastName || ap?.last_name || "").trim();
  const fallbackName = user.email.split("@")[0];
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || fallbackName;

  const sport = (profile?.sport || ap?.sport || "athlete").trim();
  const positions = profile?.positions?.length
    ? profile.positions
    : ap?.positions?.length
      ? ap.positions
      : ["ATH"];
  const position = positions[0] || "ATH";
  const gradYear = profile?.gradYear || ap?.grad_year || new Date().getFullYear() + 1;

  const schoolName =
    (profile?.schoolName || ap?.school_name || ap?.high_school || "Recruitr").trim() || "Recruitr";
  const teamName = schoolName;
  const logoInitial = schoolName.charAt(0).toUpperCase() || "R";

  const mappedPosts: AthleteViewPost[] = myPosts
    .filter((post) => Boolean(post.media?.src))
    .map((post) => ({
      id: String(post.id),
      createdAt: shortDate(post.createdAt),
      caption: post.caption || "",
      hashtags: (post.tags || []).map(stripHash),
      likeCount: 0,
      commentCount: 0,
      images: post.media?.src ? [post.media.src] : [],
    }));

  const postCount = mappedPosts.length;
  const timeline = [
    {
      year: String(gradYear - 2),
      title: "Recruiting Profile Created",
      subtitle: "Athlete profile initialized for discovery.",
    },
    {
      year: String(gradYear - 1),
      title: "Active Prospect",
      subtitle: "Posting highlights and receiving coach visibility.",
    },
    {
      year: String(gradYear),
      title: "Class Year",
      subtitle: `Graduation class of ${gradYear}.`,
    },
  ];

  return {
    id: String(user.id),
    name: fullName,
    nickname: position,
    sport: toTitle(sport, "Sport"),
    position,
    stars: 4,
    classYear: gradYear,
    followers: 0,
    connections: 0,
    height: "--",
    weight: "--",
    schoolName,
    schoolUnitId: profile?.schoolUnitId || ap?.school_unitid || null,
    state: profile?.state || ap?.state || null,
    teamName,
    teamLogoTextOrUrl: logoInitial,
    schoolLogoUrl,
    bio:
      profile?.bio ||
      ap?.bio ||
      "Athlete profile in progress. Add bio, stats, and media to improve discovery.",
    rankingNational: 999,
    rankingPosition: 99,
    seasonStats: {
      rushingYards: 0,
      tds: 0,
      ydsPerCarry: 0,
      receivingYards: 0,
    },
    chartPoints: [0, 0.2, 0.3, 0.35, 0.45, 0.4, 0.5],
    accolades: [
      `Sport: ${toTitle(sport, "Athlete")}`,
      `Position: ${position}`,
      `Posts published: ${postCount}`,
      `State: ${profile?.state || ap?.state || "Not set"}`,
    ],
    timeline,
    academics: {
      highSchool: profile?.highSchool || ap?.high_school || "Not set",
      committedUniversity: schoolName,
      gpa: "N/A",
      sat: "N/A",
      intendedMajor: "Undeclared",
    },
    posts: mappedPosts,
  };
}

function buildCoachProfile(
  user: MeUser,
  myPosts: MyPostItem[],
  teams: SchoolTeamItem[],
  schoolLogoUrl: string | null
): CoachViewProfile {
  const cp = user.coach_profile;
  const firstName = (cp?.first_name || "").trim();
  const lastName = (cp?.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || user.email.split("@")[0];
  const sport = (cp?.sport || "Sport not set").trim();
  const level = (cp?.level || "Level not set").trim();
  const schoolName = (cp?.school_name || cp?.organization_name || "Recruitr Program").trim();
  const organizationName = (cp?.organization_name || schoolName || "Organization not set").trim();
  const teamName =
    teams.find((t) => t.sport.toLowerCase() === sport.toLowerCase())?.teamName ||
    teams[0]?.teamName ||
    `${toTitle(sport, "Program")} Program`;

  const mappedPosts = myPosts
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
  const timeline = [
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
      title: cp?.is_verified_coach ? "Verified Coach Status" : "Verification In Progress",
      subtitle: cp?.is_verified_coach
        ? "Verified coach access enabled for direct messaging and recruiting workflows."
        : "Complete verification to unlock coach-only recruiting actions.",
    },
  ];

  const followers = Math.max(0, activeAthletes * 4 + (cp?.is_verified_coach ? 220 : 80));
  const connections = Math.max(0, activeTeams * 18 + 90);

  return {
    id: String(user.id),
    name: fullName,
    title: cp?.title || "Head Coach",
    schoolName,
    schoolUnitId: cp?.school_unitid || null,
    teamName,
    schoolLogoUrl,
    sport: toTitle(sport, "Sport"),
    level: toTitle(level, "Level"),
    organizationName,
    isVerifiedCoach: Boolean(cp?.is_verified_coach),
    bio:
      cp?.bio ||
      `Coach profile for ${fullName}. Focused on player development, competitive growth, and recruitment outcomes for ${schoolName}.`,
    followers,
    connections,
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
      cp?.is_verified_coach ? "Verified coach on Recruitr" : "Verification pending",
    ],
    timeline,
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

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<MeUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<AthleteViewProfile | null>(null);
  const [coach, setCoach] = useState<CoachViewProfile | null>(null);

  useEffect(() => {
    const token = getToken();
    const cached = getStoredUser();

    if (!token) {
      router.replace("/login");
      return;
    }
    if (cached) setUser(cached);

    let alive = true;
    void (async () => {
      try {
        const me = await getMe(token);
        if (!alive) return;
        setUser(me);
        setAuth(token, me);

        try {
          const notif = await getNotifications(token, { limit: 1 });
          if (alive) setUnreadCount(notif.unreadCount);
        } catch {
          if (alive) setUnreadCount(0);
        }

        const role =
          me.primary_role ||
          (me.roles.includes("coach") ? "coach" : me.roles.includes("athlete") ? "athlete" : null);

        if (role === "athlete") {
          const [profileRes, myPostsRes] = await Promise.all([
            getMyAthleteProfile(token),
            getMyPosts(token, 30),
          ]);
          const schoolUnitid = profileRes.profile?.schoolUnitId || me.athlete_profile?.school_unitid || null;
          let schoolLogoUrl: string | null = null;
          if (schoolUnitid) {
            try {
              const schoolRes = await getSchoolByUnitid(token, schoolUnitid);
              schoolLogoUrl = schoolRes.school.derived_logo_url || schoolRes.school.logo_url || null;
            } catch {
              schoolLogoUrl = null;
            }
          }
          if (!alive) return;
          setAthlete(buildProfile(me, profileRes.profile, myPostsRes.items || [], schoolLogoUrl));
          setCoach(null);
          setError(null);
          return;
        }

        if (role === "coach") {
          if (!me.coach_profile) {
            throw new Error("Coach profile record is missing. Complete coach onboarding first.");
          }

          const myPostsRes = await getMyPosts(token, 30);
          let schoolTeams: SchoolTeamItem[] = [];
          const schoolUnitid = me.coach_profile.school_unitid;

          if (schoolUnitid) {
            try {
              const teamsRes = await getSchoolTeams(token, schoolUnitid);
              schoolTeams = teamsRes.items || [];
            } catch {
              schoolTeams = [];
            }
          }

          let schoolLogoUrl: string | null = null;
          if (schoolUnitid) {
            try {
              const schoolRes = await getSchoolByUnitid(token, schoolUnitid);
              schoolLogoUrl = schoolRes.school.derived_logo_url || schoolRes.school.logo_url || null;
            } catch {
              schoolLogoUrl = null;
            }
          }

          if (!alive) return;
          setCoach(buildCoachProfile(me, myPostsRes.items || [], schoolTeams, schoolLogoUrl));
          setAthlete(null);
          setError(null);
          return;
        }

        throw new Error("No athlete or coach role found for this account.");
      } catch (e) {
        if (!alive) return;
        setAthlete(null);
        setCoach(null);
        setError(e instanceof Error ? e.message : "Failed to load athlete profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading profile…</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppShell
      userEmail={user.email}
      unreadCount={unreadCount}
      onLogout={() => {
        clearAuth();
        router.push("/login");
      }}
      left={<SideNav />}
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      ) : null}

      {athlete ? (
        <AthleteProfileShell athlete={athlete} embedded />
      ) : coach ? (
        <CoachProfileShell coach={coach} embedded />
      ) : (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          Unable to render profile. Try refreshing or logging in with an athlete/coach account.
        </div>
      )}
    </AppShell>
  );
}
