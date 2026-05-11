import Link from "next/link";
import ScrollToTopOnMount from "@/components/common/ScrollToTopOnMount";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_45%,#eef2ff_100%)] text-neutral-900">
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
          <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-neutral-600">Effective date: February 27, 2026</p>

          <div className="mt-6 space-y-5 text-sm leading-7 text-neutral-700">
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Platform use</h2>
              <p>
                Recruitr is a recruiting communication platform for athletes and coaches. You agree to
                provide accurate account information and use the service lawfully.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Account roles</h2>
              <p>
                Certain features may depend on role and verification status. Coach-initiated messaging can
                be restricted to verified accounts.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Content and conduct</h2>
              <p>
                You are responsible for all content you upload. Do not post unlawful, deceptive, abusive, or
                infringing material. Public profile and post content may be visible across the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Enforcement</h2>
              <p>
                We may limit, suspend, or remove accounts or content that violates platform rules, safety
                policies, or applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Contact</h2>
              <p>
                Questions about these terms can be sent to{" "}
                <a className="text-blue-700 underline underline-offset-4" href="mailto:legal@recruitr.app">
                  legal@recruitr.app
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
