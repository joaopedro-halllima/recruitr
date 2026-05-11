"use client";

import type { Story } from "@/lib/mockFeed";

export default function StoryRow({ stories }: { stories: Story[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Explore</p>
        <p className="text-xs text-neutral-400">Phase 1 mock</p>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {stories.map((s) => (
          <button
            key={s.id}
            className="flex min-w-[110px] flex-col rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-left hover:bg-white/10"
          >
            <span className="text-sm font-medium text-white">{s.name}</span>
            <span className="text-xs text-neutral-400">{s.subtitle ?? ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

