"use client";

import { Suspense, type ReactNode } from "react";
import TopNav from "@/components/layout/TopNav";

type AppShellProps = {
  userEmail: string;
  onLogout: () => void;
  unreadCount?: number;
  left: ReactNode;
  right?: ReactNode;
  children: ReactNode;
};

export default function AppShell({
  userEmail,
  onLogout,
  unreadCount = 0,
  left,
  right,
  children,
}: AppShellProps) {
  const hasRight = Boolean(right);

  return (
    <div className="theme-content min-h-screen bg-neutral-950 text-[var(--app-text)]">
      <Suspense fallback={null}>
        <TopNav userEmail={userEmail} onLogout={onLogout} unreadCount={unreadCount} />
      </Suspense>

      <main className="w-full pb-10 pt-14">
        <div
          className={`grid items-start gap-4 px-2 md:px-4 xl:gap-5 xl:pl-0 xl:pr-4 ${
            hasRight
              ? "xl:grid-cols-[320px_minmax(0,1fr)_290px] 2xl:grid-cols-[332px_minmax(0,1fr)_305px]"
              : "xl:grid-cols-[320px_minmax(0,1fr)_320px] 2xl:grid-cols-[332px_minmax(0,1fr)_332px]"
          }`}
        >
          <aside className="xl:sticky xl:top-14 xl:z-20">{left}</aside>
          <section className="min-w-0 pt-4 xl:pt-5">
            <Suspense fallback={null}>{children}</Suspense>
          </section>
          {hasRight ? (
            <aside className="pt-4 xl:sticky xl:top-14 xl:pt-5">{right}</aside>
          ) : (
            <aside aria-hidden className="hidden xl:block" />
          )}
        </div>
      </main>
    </div>
  );
}
