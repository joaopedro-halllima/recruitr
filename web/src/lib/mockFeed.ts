export type Story = {
  id: string;
  name: string;
  subtitle?: string;
};

export type FeedPost = {
  id: string;
  authorName: string;
  authorSubtitle?: string; // school / org / role
  authorRole: "coach" | "athlete";
  caption: string;
  tags?: string[];
  createdAtLabel: string; // keep stable for SSR/hydration
  stats: { likes: number; comments: number };
};

export const mockStories: Story[] = [
  { id: "s1", name: "D1 Prospects", subtitle: "Trending" },
  { id: "s2", name: "Soccer", subtitle: "Sport" },
  { id: "s3", name: "NY / NJ", subtitle: "Region" },
  { id: "s4", name: "Class of 2028", subtitle: "Recruiting" },
  { id: "s5", name: "Highlights", subtitle: "Video" },
];

export function makeMockFeed(viewerRole: "coach" | "athlete"): FeedPost[] {
  const coachFeed: FeedPost[] = [
    {
      id: "p1",
      authorName: "Jordan Reyes",
      authorSubtitle: "Athlete • Soccer • Class of 2028",
      authorRole: "athlete",
      caption:
        "Highlight reel from last weekend. Looking for D1/D2 programs — DM me for full match film.",
      tags: ["#soccer", "#forward", "#2028"],
      createdAtLabel: "2h",
      stats: { likes: 128, comments: 14 },
    },
    {
      id: "p2",
      authorName: "Maya Chen",
      authorSubtitle: "Athlete • Track • 400m",
      authorRole: "athlete",
      caption:
        "New PR in the 400m. Training update + splits in the comments (mock).",
      tags: ["#track", "#400m", "#recruiting"],
      createdAtLabel: "6h",
      stats: { likes: 92, comments: 9 },
    },
    {
      id: "p3",
      authorName: "Sam Patel",
      authorSubtitle: "Athlete • Baseball • SS",
      authorRole: "athlete",
      caption:
        "Defensive highlights + quick swing clip. Coaches: would love feedback.",
      tags: ["#baseball", "#shortstop"],
      createdAtLabel: "1d",
      stats: { likes: 77, comments: 5 },
    },
  ];

  const athleteFeed: FeedPost[] = [
    {
      id: "a1",
      authorName: "You",
      authorSubtitle: "Athlete • Portfolio",
      authorRole: "athlete",
      caption:
        "Welcome to my Recruitr profile. Posting updates + highlights here (Phase 1 mock).",
      tags: ["#myprofile"],
      createdAtLabel: "just now",
      stats: { likes: 3, comments: 0 },
    },
    {
      id: "a2",
      authorName: "Recruitr",
      authorSubtitle: "Tips • Getting recruited",
      authorRole: "coach",
      caption:
        "Tip: keep your profile updated with measurable stats + a clean highlight reel.",
      tags: ["#tips", "#recruiting"],
      createdAtLabel: "3h",
      stats: { likes: 41, comments: 2 },
    },
  ];

  return viewerRole === "coach" ? coachFeed : athleteFeed;
}

