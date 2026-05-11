import Link from "next/link";
import ScrollToTopOnMount from "@/components/common/ScrollToTopOnMount";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f0f9ff_45%,#eef2ff_100%)] text-neutral-900">
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
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-neutral-600">Effective date: February 27, 2026</p>

          <div className="mt-6 space-y-5 text-sm leading-7 text-neutral-700">
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Data we collect</h2>
              <p>
                We collect account information, profile details, uploaded media, and activity events needed
                to operate recruiting discovery, messaging, and platform safety.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">How we use data</h2>
              <p>
                Data is used to authenticate users, power feed and search ranking, enforce safety controls,
                and improve platform quality and reliability.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Visibility</h2>
              <p>
                Recruitr MVP content is public by default within the platform experience. Coaches and
                athletes should avoid sharing sensitive personal data in profile or post text.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Security and retention</h2>
              <p>
                We apply reasonable safeguards to protect data and retain information as required for
                legitimate business, safety, and legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-neutral-900">Contact</h2>
              <p>
                Privacy questions can be sent to{" "}
                <a className="text-blue-700 underline underline-offset-4" href="mailto:privacy@recruitr.app">
                  privacy@recruitr.app
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
