import type { Metadata } from "next";

import MetricsPageClient from "@/components/metrics/MetricsPageClient";

export const metadata: Metadata = {
  title: "Metrics",
  description: "Public Recruitr site metrics.",
};

export default function MetricsPage() {
  return <MetricsPageClient />;
}
