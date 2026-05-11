"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

function deriveDomain(webaddr?: string | null): string | null {
  if (!webaddr) return null;
  const value = webaddr.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    const host = parsed.hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function initials(name: string): string {
  const parts = name
    .split(/[^A-Za-z0-9]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length === 0) return "SC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

type SchoolLogoProps = {
  name: string;
  logoUrl?: string | null;
  webaddr?: string | null;
  size?: number;
  className?: string;
};

export default function SchoolLogo({
  name,
  logoUrl,
  webaddr,
  size = 56,
  className,
}: SchoolLogoProps) {
  const srcCandidates = useMemo(() => {
    const domain = deriveDomain(webaddr);
    const urls: string[] = [];
    if (logoUrl && logoUrl.trim()) urls.push(logoUrl.trim());
    if (domain) {
      urls.push(`https://logo.clearbit.com/${domain}`);
      urls.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
      urls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    }
    return Array.from(new Set(urls));
  }, [logoUrl, webaddr]);

  const [failedByUrl, setFailedByUrl] = useState<Record<string, true>>({});
  const src = srcCandidates.find((candidate) => !failedByUrl[candidate]) ?? null;

  if (!src) {
    return (
      <div
        className={[
          "grid place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-700 to-neutral-900 text-sm font-semibold text-white",
          className ?? "",
        ].join(" ")}
        style={{ width: size, height: size }}
        aria-label={`${name} logo`}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border border-white/10 bg-white",
        className ?? "",
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="h-full w-full object-contain p-1"
        unoptimized
        onError={() => {
          if (!src) return;
          setFailedByUrl((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
        }}
      />
    </div>
  );
}
