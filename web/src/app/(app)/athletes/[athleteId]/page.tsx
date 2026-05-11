"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import AthleteProfileShell from "@/components/athlete/AthleteProfileShell";
import {
  addShortlistItem,
  createShortlist,
  getAthleteProfileByUserId,
  getMe,
  getMyAthleteProfile,
  getMyPosts,
  getPostsByUser,
  getSchoolByUnitid,
  getShortlists,
  type AthleteProfileForm,
  type MeUser,
  type MyPostItem,
} from "@/lib/api";
import { getToken, setAuth } from "@/lib/auth";
import { normalizeProfileUserId } from "@/lib/profile-routes";
import type {
  AthletePost as AthleteViewPost,
  AthleteProfile as AthleteViewProfile,
} from "@/lib/mockAthleteProfile";

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
  userId: number,
  fallbackName: string,
  profile: AthleteProfileForm | null,
  myPosts: MyPostItem[],
  schoolLogoUrl: string | null
): AthleteViewProfile {
  const firstName = profile?.firstName || "";
  const lastName = profile?.lastName || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || fallbackName;

  const sport = profile?.sport || "athlete";
  const positions = profile?.positions?.length
    ? profile.positions
    : ["ATH"];
  const position = positions[0] || "ATH";
  const gradYear = profile?.gradYear || new Date().getFullYear() + 1;

  const schoolName = profile?.schoolName || profile?.highSchool || "Recruitr";
  const teamName = schoolName;
  const logoInitial = schoolName.trim().charAt(0).toUpperCase() || "R";

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
      title: "Profile Created",
      subtitle: "Athlete profile initialized.",
    },
    {
      year: String(gradYear - 1),
      title: "Recruiting Active",
      subtitle: "Open to coach discovery and outreach.",
    },
    {
      year: String(gradYear),
      title: "Class Year",
      subtitle: `Graduation class of ${gradYear}.`,
    },
  ];

  return {
    id: String(userId),
    userId,
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
    schoolUnitId: profile?.schoolUnitId || null,
    state: profile?.state || null,
    teamName,
    teamLogoTextOrUrl: logoInitial,
    schoolLogoUrl,
    avatarUrl: profile?.avatarUrl || null,
    bannerUrl: profile?.bannerUrl || null,
    avatarMediaAssetId: profile?.avatarMediaAssetId ?? null,
    bannerMediaAssetId: profile?.bannerMediaAssetId ?? null,
    bio:
      profile?.bio ||
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
      `State: ${profile?.state || "Not set"}`,
    ],
    timeline,
    academics: {
      highSchool: profile?.highSchool || "Not set",
      committedUniversity: schoolName,
      gpa: "N/A",
      sat: "N/A",
      intendedMajor: "Undeclared",
    },
    posts: mappedPosts,
  };
}

export default function AthleteProfilePage() {
  const router = useRouter();
  const params = useParams<{ athleteId?: string | string[] }>();
  const athleteId = useMemo(() => {
    const raw = params?.athleteId;
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<AthleteViewProfile | null>(null);
  const [viewer, setViewer] = useState<MeUser | null>(null);
  const [defaultShortlistId, setDefaultShortlistId] = useState<number | null>(null);
  const [shortlistSaved, setShortlistSaved] = useState(false);
  const [shortlistBusy, setShortlistBusy] = useState(false);
  const [shortlistNotice, setShortlistNotice] = useState<string | null>(null);
  const canEditProfile = Boolean(viewer?.roles.includes("athlete") && athlete && viewer.id === Number(athlete.id));

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        if (!athleteId) {
          throw new Error("Invalid athlete profile path.");
        }

        const token = getToken();

        if (!token) {
          router.replace("/");
          return;
        }

        const me = await getMe(token);
        if (!alive) return;
        setViewer(me);
        setAuth(token, me);

        const routeIsMe = athleteId === "me" || athleteId === String(me.id);
        const viewerIsAthlete = me.roles.includes("athlete");
        const viewerIsCoach = me.roles.includes("coach");

        let targetUserId: number;
        let profileRes: { profile: AthleteProfileForm | null };
        let myPostsRes: { items: MyPostItem[] };

        if (routeIsMe && viewerIsAthlete) {
          targetUserId = me.id;
          [profileRes, myPostsRes] = await Promise.all([
            getMyAthleteProfile(token),
            getMyPosts(token, 30),
          ]);
        } else {
          const parsedId = normalizeProfileUserId(athleteId);
          if (!parsedId) throw new Error("Invalid athlete profile path.");
          targetUserId = parsedId;
          [profileRes, myPostsRes] = await Promise.all([
            getAthleteProfileByUserId(token, parsedId),
            getPostsByUser(token, parsedId, 30),
          ]);
        }

        if (!profileRes.profile) {
          throw new Error("Athlete profile not found.");
        }

        const schoolUnitid = profileRes.profile.schoolUnitId || null;
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

        setAthlete(
          buildProfile(
            targetUserId,
            routeIsMe && viewerIsAthlete ? me.email.split("@")[0] : `Athlete ${targetUserId}`,
            profileRes.profile,
            myPostsRes.items || [],
            schoolLogoUrl
          )
        );
        if (viewerIsCoach && targetUserId !== me.id) {
          try {
            const shortlistRes = await getShortlists(token, { includeItems: true });
            if (!alive) return;
            setDefaultShortlistId(shortlistRes.items[0]?.id ?? null);
            setShortlistSaved(
              shortlistRes.items.some((list) =>
                list.items.some((item) => item.athleteUserId === targetUserId)
              )
            );
          } catch {
            if (!alive) return;
            setDefaultShortlistId(null);
            setShortlistSaved(false);
          }
        } else {
          setDefaultShortlistId(null);
          setShortlistSaved(false);
        }
        setShortlistNotice(null);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setAthlete(null);
        setViewer(null);
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("Failed to load athlete profile.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [athleteId, router]);

  if (loading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 px-4 py-6 text-[var(--app-text)] lg:px-8 lg:py-8">
        <div className="mx-auto h-[640px] w-full max-w-[1280px] animate-pulse rounded-3xl border border-slate-200 bg-white lg:border-white/10 lg:bg-white/5" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 px-4 py-6 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-300/60 bg-red-50/90 p-4 text-sm text-red-700 lg:border-red-400/40 lg:bg-red-500/10 lg:text-red-200">
          {error || "Unable to load athlete profile."}
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

  async function handleSaveToShortlist() {
    const token = getToken();
    const targetAthleteId = athlete ? Number(athlete.id) : 0;
    if (!token || !viewer?.roles.includes("coach") || !targetAthleteId) return;

    setShortlistBusy(true);
    setShortlistNotice(null);
    try {
      let shortlistId = defaultShortlistId;
      if (!shortlistId) {
        const shortlistRes = await getShortlists(token, { includeItems: false });
        shortlistId = shortlistRes.items[0]?.id ?? null;
        if (!shortlistId) {
          const created = await createShortlist(token, "Shortlist");
          shortlistId = created.id;
        }
        setDefaultShortlistId(shortlistId);
      }

      if (!shortlistId) {
        throw new Error("Shortlist unavailable.");
      }

      await addShortlistItem(token, shortlistId, targetAthleteId);
      setShortlistSaved(true);
      setShortlistNotice("Saved to shortlist.");
    } catch (e) {
      setShortlistNotice(e instanceof Error ? e.message : "Failed to save athlete to shortlist.");
    } finally {
      setShortlistBusy(false);
    }
  }

  return (
    <div>
      {error ? (
        <div className="mx-auto mt-3 w-full max-w-[1320px] px-3 sm:px-4 lg:px-8">
          <div className="rounded-xl border border-amber-300/60 bg-amber-50/90 px-3 py-2 text-xs text-amber-800">
            {error}
          </div>
        </div>
      ) : null}
      {viewer?.roles.includes("coach") && viewer.id !== Number(athlete.id) ? (
        <div className="mx-auto mt-3 w-full max-w-[1320px] px-3 sm:px-4 lg:px-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[var(--app-text)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Coach Actions</div>
              <div className="mt-1 text-sm text-slate-300">Save this athlete to your shortlist so you can return to the profile later.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleSaveToShortlist();
                }}
                disabled={shortlistBusy || shortlistSaved}
                className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {shortlistSaved ? "Saved to shortlist" : shortlistBusy ? "Saving..." : "Add to shortlist"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard/shortlists")}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Open shortlist
              </button>
            </div>
          </div>
          {shortlistNotice ? (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200">
              {shortlistNotice}
            </div>
          ) : null}
        </div>
      ) : null}
      <AthleteProfileShell athlete={athlete} canEdit={canEditProfile} />
    </div>
  );
}
