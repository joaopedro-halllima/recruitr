export type CoachTimelineItem = {
  year: string;
  title: string;
  subtitle: string;
};

export type CoachTeamSummary = {
  id: number;
  teamName: string;
  sport: string;
  activeMemberCount: number;
  pendingMemberCount: number;
};

export type CoachPost = {
  id: string;
  createdAt: string;
  caption: string;
  hashtags: string[];
  media: { kind: "image" | "video"; src: string } | null;
};

export type CoachProfile = {
  id: string;
  userId?: number;
  name: string;
  title: string;
  schoolName: string;
  schoolUnitId?: string | null;
  teamName: string;
  schoolLogoUrl?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  avatarMediaAssetId?: number | null;
  bannerMediaAssetId?: number | null;
  sport: string;
  level: string;
  organizationName: string;
  isVerifiedCoach: boolean;
  bio: string;
  followers: number;
  connections: number;
  programStats: {
    activeTeams: number;
    activeAthletes: number;
    pendingApprovals: number;
    postsPublished: number;
  };
  achievements: string[];
  timeline: CoachTimelineItem[];
  teams: CoachTeamSummary[];
  posts: CoachPost[];
};
