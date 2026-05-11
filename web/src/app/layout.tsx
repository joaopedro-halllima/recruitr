import type { Metadata } from "next";
import { Suspense } from "react";
import PageViewTracker from "@/components/common/PageViewTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recruitr",
  description: "Recruiting, simplified.",
};

const themeInitScript = `
(() => {
  try {
    const key = "recruitr-theme";
    const stored = window.localStorage.getItem(key);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
