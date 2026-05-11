import Link from "next/link";
import ScrollToTopOnMount from "@/components/common/ScrollToTopOnMount";

export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_45%,#eff6ff_100%)] text-neutral-900">
      <ScrollToTopOnMount />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            Recruitr
          </Link>
          <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">
            Back to home
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-black/10 bg-white/85 p-7 shadow-[0_16px_40px_rgba(15,23,42,0.10)] backdrop-blur">
          <h1 className="text-3xl font-semibold tracking-tight">Community Guidelines</h1>
          <p className="mt-2 text-sm text-neutral-600">Effective date: February 27, 2026</p>

          <div className="mt-6 space-y-5 text-sm leading-7 text-neutral-700">
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Respectful conduct</h2>
              <p>
                Keep communication professional and recruiting-focused. Harassment, threats, hate speech,
                and discrimination are not allowed.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Authentic representation</h2>
              <p>
                Do not impersonate athletes, coaches, or institutions. Use accurate profile details and avoid
                deceptive claims about identity, performance, or affiliation.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Appropriate content</h2>
              <p>
                Post only media you have rights to share. Illegal content, explicit exploitation, and
                malicious links are prohibited.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Safety tools</h2>
              <p>
                Users can report, hide, and block. We review reports and may remove violating content or
                suspend accounts.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Enforcement</h2>
              <p>
                Repeated or severe violations may result in permanent account removal and additional legal
                action when required.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
