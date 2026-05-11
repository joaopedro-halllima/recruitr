"use client";

import { applyTheme, resolvePreferredTheme, type ThemeMode } from "@/lib/theme";

type ThemeToggleProps = {
  className?: string;
  iconOnly?: boolean;
};

function currentTheme(): ThemeMode {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
  }
  return resolvePreferredTheme();
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export default function ThemeToggle({ className, iconOnly = false }: ThemeToggleProps) {
  function toggleTheme() {
    const next: ThemeMode = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
  }

  const defaultClass = iconOnly
    ? "grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10"
    : "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-200 hover:bg-white/10";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={className ?? defaultClass}
      aria-label="Toggle dark/light mode"
      title="Toggle dark/light mode"
    >
      {iconOnly ? <ThemeIcon /> : "Theme"}
    </button>
  );
}
