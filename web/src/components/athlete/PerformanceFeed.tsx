"use client";

import type { AthletePost } from "@/lib/mockAthleteProfile";

type PerformanceFeedProps = {
  athleteName: string;
  posts: AthletePost[];
  title?: string;
  compact?: boolean;
};

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconComment() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconBookmark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function isVideo(src: string) {
  return /\.(mp4|mov|m4v|webm)$/i.test(src);
}

function postMedia(src: string, idx: number) {
  if (isVideo(src)) {
    return (
      <video
        key={`${src}-${idx}`}
        src={src}
        controls
        playsInline
        preload="metadata"
        className="h-52 w-full rounded-xl border border-slate-200 bg-black object-cover lg:border-white/10"
      />
    );
  }

  return (
    <div
      key={`${src}-${idx}`}
      className="relative h-52 w-full rounded-xl border border-slate-200 bg-gradient-to-br from-blue-200 via-cyan-100 to-emerald-100 lg:border-white/10 lg:from-sky-400/30 lg:via-cyan-300/20 lg:to-blue-500/30"
    >
      <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_15%_-20%,rgba(255,255,255,0.55),transparent_45%)]" />
      <div className="absolute bottom-3 left-3 rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold text-white">Action Shot</div>
    </div>
  );
}

export default function PerformanceFeed({ athleteName, posts, title = "PERFORMANCE FEED", compact = false }: PerformanceFeedProps) {
  return (
    <section className="ath-profile-card rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)] lg:border-white/10 lg:bg-white/5 lg:shadow-none">
      {title ? <div className="text-sm font-semibold tracking-wide text-slate-800 lg:text-slate-100">{title}</div> : null}

      <div className={compact ? "mt-3 space-y-3" : "mt-4 max-h-[920px] space-y-4 overflow-auto pr-1"}>
        {posts.map((post) => (
          <article
            key={post.id}
            className="ath-profile-post rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:border-white/10 lg:bg-black/25"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-950 text-xs font-semibold text-white">
                  {athleteName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 lg:text-slate-100">{athleteName}</div>
                  <div className="text-[11px] text-slate-500 lg:text-slate-400">{post.createdAt}</div>
                </div>
              </div>
              <button className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 lg:text-slate-400 lg:hover:bg-white/10">
                ...
              </button>
            </div>

            <div className="mt-3 grid gap-2">{post.images.map((src, idx) => postMedia(src, idx))}</div>

            <div className="mt-3 flex items-center gap-4 text-slate-700 lg:text-slate-200">
              <button className="inline-flex items-center gap-1.5 text-sm hover:text-rose-500">
                <IconHeart /> {post.likeCount.toLocaleString()}
              </button>
              <button className="inline-flex items-center gap-1.5 text-sm hover:text-blue-500">
                <IconComment /> {post.commentCount.toLocaleString()}
              </button>
              <button className="ml-auto inline-flex items-center gap-1.5 text-sm hover:text-emerald-500">
                <IconBookmark /> Save
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-800 lg:text-slate-200">{post.caption}</p>
            <div className="mt-1 text-xs text-blue-700 lg:text-cyan-300">
              {post.hashtags.map((tag) => `#${tag}`).join("  ")}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
