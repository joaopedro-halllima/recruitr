"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import JoinTeamButton from "@/components/schools/JoinTeamButton";
import SchoolLogo from "@/components/schools/SchoolLogo";
import {
  approveSchoolTeamMembership,
  createSchoolTeam,
  getMe,
  getMyCoachVerificationStatus,
  getNotifications,
  getSchoolByUnitid,
  getSchoolTeams,
  joinSchoolTeam,
  requestCoachVerification,
  rejectSchoolTeamMembership,
  selectMySchool,
  type CoachVerificationRequestItem,
  type MeUser,
  type SchoolDetail,
  type SchoolTeamItem,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";

type JoinRole = "athlete" | "coach" | "staff";

export default function SchoolDetailPage() {
  const router = useRouter();
  const params = useParams<{ unitid: string }>();
  const unitid = String(params?.unitid ?? "");

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [teams, setTeams] = useState<SchoolTeamItem[]>([]);
  const [busyTeamIds, setBusyTeamIds] = useState<number[]>([]);
  const [selectionSaving, setSelectionSaving] = useState(false);

  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newSport, setNewSport] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<CoachVerificationRequestItem | null>(null);
  const [requestingVerification, setRequestingVerification] = useState(false);

  const isCoach = Boolean(user?.roles.includes("coach"));
  const coachVerified = Boolean(user?.coach_profile?.is_verified_coach);
  const coachSchoolMatch = (user?.coach_profile?.school_unitid ?? null) === unitid;
  const canCreateTeamsForSchool = Boolean(isCoach && coachVerified && coachSchoolMatch);
  const preferredJoinRole: JoinRole = useMemo(() => {
    if (user?.roles.includes("coach")) return "coach";
    if (user?.roles.includes("athlete")) return "athlete";
    return "staff";
  }, [user]);

  useEffect(() => {
    const tokenValue = getToken();
    const cached = getStoredUser<MeUser>();
    if (!tokenValue) {
      router.replace("/");
      return;
    }
    setToken(tokenValue);
    if (cached) setUser(cached);

    (async () => {
      try {
        const me = await getMe(tokenValue);
        setUser(me);
        setAuth(tokenValue, me);
        const notif = await getNotifications(tokenValue, { limit: 1 });
        setUnreadCount(notif.unreadCount);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load school page");
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [router]);

  const refreshSchoolData = useCallback(async (tokenValue: string) => {
    setLoading(true);
    setError(null);
    try {
      const [schoolRes, teamsRes] = await Promise.all([
        getSchoolByUnitid(tokenValue, unitid),
        getSchoolTeams(tokenValue, unitid),
      ]);
      setSchool(schoolRes.school);
      setTeams(teamsRes.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load school detail");
    } finally {
      setLoading(false);
    }
  }, [unitid]);

  useEffect(() => {
    if (!token || !unitid) return;
    void refreshSchoolData(token);
  }, [token, unitid, refreshSchoolData]);

  useEffect(() => {
    if (!token || !isCoach) return;
    let alive = true;
    void getMyCoachVerificationStatus(token)
      .then((res) => {
        if (!alive) return;
        setVerificationStatus(res.latestRequest);
      })
      .catch(() => {
        if (!alive) return;
        setVerificationStatus(null);
      });
    return () => {
      alive = false;
    };
  }, [token, isCoach]);

  async function handleJoinTeam(teamId: number, role: JoinRole) {
    if (!token) return;
    setBusyTeamIds((prev) => [...prev, teamId]);
    try {
      await joinSchoolTeam(token, teamId, role);
      await refreshSchoolData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join team");
    } finally {
      setBusyTeamIds((prev) => prev.filter((id) => id !== teamId));
    }
  }

  async function handleApprove(teamId: number, membershipId: number) {
    if (!token) return;
    try {
      await approveSchoolTeamMembership(token, teamId, membershipId);
      await refreshSchoolData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve membership");
    }
  }

  async function handleReject(teamId: number, membershipId: number) {
    if (!token) return;
    try {
      await rejectSchoolTeamMembership(token, teamId, membershipId);
      await refreshSchoolData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject membership");
    }
  }

  async function handleCreateTeam() {
    if (!token || !newSport.trim() || !newTeamName.trim()) return;
    if (!canCreateTeamsForSchool) return;
    setCreatingTeam(true);
    try {
      await createSchoolTeam(token, unitid, {
        sport: newSport.trim(),
        teamName: newTeamName.trim(),
      });
      setNewSport("");
      setNewTeamName("");
      await refreshSchoolData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleSelectSchool() {
    if (!token || !school) return;
    setSelectionSaving(true);
    try {
      await selectMySchool(token, school.unitid);
      await refreshSchoolData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set your school");
    } finally {
      setSelectionSaving(false);
    }
  }

  async function handleRequestVerification() {
    if (!token) return;
    setRequestingVerification(true);
    try {
      await requestCoachVerification(token, {
        notes: `Coach verification request for school ${unitid}`,
      });
      const status = await getMyCoachVerificationStatus(token);
      setVerificationStatus(status.latestRequest);
      const me = await getMe(token);
      setUser(me);
      setAuth(token, me);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit verification request");
    } finally {
      setRequestingVerification(false);
    }
  }

  if (authLoading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading school page…</div>
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
        router.push("/");
      }}
      left={<SideNav />}
      right={
        <div className="space-y-3">
          <Link
            href="/schools"
            className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10"
          >
            Back to directory
          </Link>
          {isCoach ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Create Team</div>
              {canCreateTeamsForSchool ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={newSport}
                    onChange={(e) => setNewSport(e.target.value)}
                    placeholder="Sport (e.g. soccer)"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                  />
                  <input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Team name"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                  />
                  <button
                    onClick={() => void handleCreateTeam()}
                    disabled={creatingTeam || !newSport.trim() || !newTeamName.trim()}
                    className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
                  >
                    {creatingTeam ? "Creating..." : "Create Team"}
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                    Coaches can create teams only when verified and linked to this school.
                  </div>
                  {coachSchoolMatch ? (
                    <button
                      onClick={() => void handleRequestVerification()}
                      disabled={
                        requestingVerification ||
                        verificationStatus?.status === "submitted" ||
                        verificationStatus?.status === "approved"
                      }
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20 disabled:opacity-60"
                    >
                      {verificationStatus?.status === "submitted"
                        ? "Verification Pending"
                        : requestingVerification
                          ? "Submitting..."
                          : verificationStatus?.status === "approved"
                            ? "Already Verified"
                            : "Request Verification"}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-neutral-300">
                      Select this school first, then request verification.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-400">
              Join an existing team. Coaches can create teams for this school.
            </div>
          )}
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading || !school ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-400">
          Loading school details…
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <SchoolLogo
                  name={school.name}
                  logoUrl={school.logo_url || school.derived_logo_url}
                  webaddr={school.webaddr}
                  size={64}
                />
                <div>
                  <h1 className="text-xl font-semibold">{school.name}</h1>
                  <div className="mt-1 text-sm text-neutral-400">
                    {[school.city, school.state, school.zip].filter(Boolean).join(", ")}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-neutral-300">
                      {school.is_community_college ? "2-year" : "4-year"}
                    </span>
                    {school.iclevel ? (
                      <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-neutral-300">
                        {school.iclevel}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-neutral-300">
                      Teams: {school.team_count}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {school.webaddr ? (
                  <a
                    href={school.webaddr.startsWith("http") ? school.webaddr : `https://${school.webaddr}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
                  >
                    Visit Website
                  </a>
                ) : null}
                <button
                  onClick={() => void handleSelectSchool()}
                  disabled={selectionSaving}
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/20 disabled:opacity-60"
                >
                  {school.selected_by_current_user
                    ? "Selected as My School"
                    : selectionSaving
                      ? "Saving..."
                      : "Select as My School"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Teams ({teams.length})</h2>
            </div>
            {teams.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">
                No teams yet for this school.
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => {
                  const status = team.myMembership?.status ?? "none";
                  return (
                    <div key={team.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-medium">{team.teamName}</div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {team.sport} • Active {team.activeMemberCount} • Pending {team.pendingMemberCount}
                          </div>
                        </div>
                        <JoinTeamButton
                          status={status as "none" | "pending" | "active" | "rejected"}
                          role={preferredJoinRole}
                          disabled={busyTeamIds.includes(team.id)}
                          onJoin={(role) => {
                            void handleJoinTeam(team.id, role);
                          }}
                        />
                      </div>

                      {team.canManageMemberships && team.pendingMemberships.length > 0 ? (
                        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="mb-2 text-xs font-semibold text-neutral-300">
                            Pending approvals
                          </div>
                          <div className="space-y-2">
                            {team.pendingMemberships.map((pending) => (
                              <div
                                key={pending.membershipId}
                                className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <div className="text-xs font-medium">{pending.name}</div>
                                  <div className="text-[11px] text-neutral-400">
                                    {pending.email} • {pending.role}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => void handleApprove(team.id, pending.membershipId)}
                                    className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100 hover:bg-emerald-500/20"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => void handleReject(team.id, pending.membershipId)}
                                    className="rounded-md border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-100 hover:bg-red-500/20"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
