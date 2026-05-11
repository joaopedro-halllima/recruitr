export type TimelineItem = {
  year: string;
  title: string;
  subtitle: string;
};

export type AthletePost = {
  id: string;
  createdAt: string;
  caption: string;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  images: string[];
};

export type AthleteProfile = {
  id: string;
  userId?: number;
  name: string;
  nickname: string;
  sport: string;
  position: string;
  stars: number;
  classYear: number;
  followers: number;
  connections: number;
  height: string;
  weight: string;
  schoolName: string;
  schoolUnitId?: string | null;
  state?: string | null;
  teamName: string;
  teamLogoTextOrUrl: string;
  schoolLogoUrl?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  avatarMediaAssetId?: number | null;
  bannerMediaAssetId?: number | null;
  bio: string;
  rankingNational: number;
  rankingPosition: number;
  seasonStats: {
    rushingYards: number;
    tds: number;
    ydsPerCarry: number;
    receivingYards: number;
  };
  chartPoints: number[];
  accolades: string[];
  timeline: TimelineItem[];
  academics: {
    highSchool: string;
    committedUniversity: string;
    gpa: string;
    sat: string;
    intendedMajor: string;
  };
  posts: AthletePost[];
};

const athleteAlex: AthleteProfile = {
  id: "alex-johnson",
  name: "Alex Johnson",
  nickname: "The Flash",
  sport: "Football",
  position: "RB",
  stars: 5,
  classYear: 2025,
  followers: 14200,
  connections: 890,
  height: "5'11\"",
  weight: "195 lbs",
  schoolName: "Georgia Football",
  teamName: "Georgia Bulldogs",
  teamLogoTextOrUrl: "G",
  schoolLogoUrl: null,
  bio: "Class of 2025 running back with verified game speed, route versatility, and pass-pro reps. Focused on development, academics, and championship-level competition.",
  rankingNational: 18,
  rankingPosition: 1,
  seasonStats: {
    rushingYards: 1845,
    tds: 22,
    ydsPerCarry: 6.4,
    receivingYards: 310,
  },
  chartPoints: [4.8, 5.0, 5.5, 6.1, 6.4, 5.9, 6.2, 6.8, 7.1, 6.9, 7.3, 7.8],
  accolades: [
    "All-State Offensive Player of the Year (2025)",
    "Georgia Regional Combine MVP (2024)",
    "Captain, State Championship Finalist (2024)",
    "University of Georgia Offer + Commitment",
  ],
  timeline: [
    {
      year: "2022",
      title: "Varsity Debut",
      subtitle: "Started building varsity film and verified measurables.",
    },
    {
      year: "2023",
      title: "National Camps",
      subtitle: "Camp circuit appearances and first Power-5 offers.",
    },
    {
      year: "2024",
      title: "Top RB Ranking",
      subtitle: "Moved to #1 RB in state and top national tier.",
    },
    {
      year: "2025",
      title: "Committed to Georgia",
      subtitle: "Signed commitment and enrolled in college prep program.",
    },
  ],
  academics: {
    highSchool: "Pine Crest High School",
    committedUniversity: "University of Georgia",
    gpa: "3.8",
    sat: "1320",
    intendedMajor: "Sports Management",
  },
  posts: [
    {
      id: "post-1",
      createdAt: "Jun 1, 2025",
      caption: "Spring game reps felt sharp. Footwork and first burst have been a major focus this cycle.",
      hashtags: ["GeorgiaFootball", "Commit", "RB"],
      likeCount: 2400,
      commentCount: 156,
      images: ["/demo/Soccer_1.mp4"],
    },
    {
      id: "post-2",
      createdAt: "May 18, 2025",
      caption: "Red zone package install complete. Film review from this week looked clean.",
      hashtags: ["UGA", "Recruiting", "RunningBack"],
      likeCount: 1908,
      commentCount: 120,
      images: ["/demo/Soccer_2.mp4"],
    },
    {
      id: "post-3",
      createdAt: "Apr 30, 2025",
      caption: "Recovery day plus acceleration block. Appreciate everyone following the journey.",
      hashtags: ["Training", "ClassOf2025", "GeorgiaFootball"],
      likeCount: 1613,
      commentCount: 91,
      images: ["/demo/Soccer_3.mp4"],
    },
  ],
};

const athleteMaya: AthleteProfile = {
  ...athleteAlex,
  id: "maya-chen",
  name: "Maya Chen",
  nickname: "Jet",
  position: "WR",
  teamName: "Columbia Lions",
  schoolName: "Columbia Football",
  teamLogoTextOrUrl: "C",
  classYear: 2026,
  rankingNational: 44,
  rankingPosition: 4,
  followers: 9800,
  connections: 620,
  seasonStats: {
    rushingYards: 860,
    tds: 14,
    ydsPerCarry: 5.7,
    receivingYards: 1025,
  },
  chartPoints: [3.2, 3.6, 4.0, 4.4, 4.1, 4.8, 5.3, 5.0, 5.4, 5.8, 6.0, 6.2],
  academics: {
    highSchool: "Northview Academy",
    committedUniversity: "Columbia University",
    gpa: "3.9",
    sat: "1390",
    intendedMajor: "Economics",
  },
};

const ATHLETES: Record<string, AthleteProfile> = {
  [athleteAlex.id]: athleteAlex,
  [athleteMaya.id]: athleteMaya,
};

export function getMockAthleteProfile(athleteId: string): AthleteProfile {
  return ATHLETES[athleteId] ?? athleteAlex;
}
