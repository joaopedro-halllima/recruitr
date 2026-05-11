"use client";

export default function RightRail({ role }: { role: "coach" | "athlete" }) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-20 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold">Suggestions</p>
          <p className="mt-1 text-xs text-neutral-400">
            {role === "coach"
              ? "Athletes you might want to follow (mock)"
              : "Coaches/programs to follow (mock)"}
          </p>

          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-200">
                    {role === "coach" ? `Athlete Prospect ${i + 1}` : `Coach Program ${i + 1}`}
                  </p>
                  <p className="text-xs text-neutral-500">Phase 1</p>
                </div>
                <button className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold">Upcoming</p>
          <p className="mt-2 text-xs text-neutral-400">
            Events / showcases section later.
          </p>
        </div>
      </div>
    </aside>
  );
}

