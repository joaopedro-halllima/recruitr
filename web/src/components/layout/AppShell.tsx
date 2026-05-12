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
          className={`grid items-start gap-4 px-2 md:px-4 lg:gap-5 lg:pl-0 lg:pr-4 ${
            hasRight
              ? "lg:grid-cols-[280px_minmax(0,1fr)_250px] xl:grid-cols-[320px_minmax(0,1fr)_290px] 2xl:grid-cols-[332px_minmax(0,1fr)_305px]"
              : "lg:grid-cols-[280px_minmax(0,1fr)_280px] xl:grid-cols-[320px_minmax(0,1fr)_320px] 2xl:grid-cols-[332px_minmax(0,1fr)_332px]"
          }`}
        >
          <aside className="lg:sticky lg:top-14 lg:z-20">{left}</aside>
          <section className="min-w-0 pt-4 lg:pt-5">
            <Suspense fallback={null}>{children}</Suspense>
          </section>
          {hasRight ? (
            <aside className="pt-4 lg:sticky lg:top-14 lg:pt-5">{right}</aside>
          ) : (
            <aside aria-hidden className="hidden lg:block" />
          )}
        </div>
      </main>
    </div>
  );
}
