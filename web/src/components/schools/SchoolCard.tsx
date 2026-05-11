import Link from "next/link";

import SchoolLogo from "@/components/schools/SchoolLogo";
import type { SchoolCardItem } from "@/lib/api";

type SchoolCardProps = {
  school: SchoolCardItem;
};

export default function SchoolCard({ school }: SchoolCardProps) {
  return (
    <Link
      href={`/schools/${encodeURIComponent(school.unitid)}`}
      className="group block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10"
    >
      <div className="flex items-start gap-3">
        <SchoolLogo name={school.name} logoUrl={school.logo_url} webaddr={school.webaddr} size={52} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white group-hover:text-white/95">{school.name}</div>
          <div className="mt-1 text-xs text-neutral-400">
            {[school.city, school.state].filter(Boolean).join(", ") || "Location unavailable"}
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
          </div>
        </div>
      </div>
    </Link>
  );
}
