import Link from "next/link";

export default function MarketingPage() {
  return (
    <div className="bg-white text-zinc-900">
      {/* Hero */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 md:flex-row md:items-center md:py-12">
          <div className="flex-1 space-y-4">
            <p className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-600">
              For Stellar MLS agents in Florida
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#081F33] md:text-4xl">
              Complete your listings faster. Launch with confidence.
            </h1>
            <p className="max-w-xl text-sm text-zinc-600">
              ListingLaunchAI helps you gather property data, verify key details, and
              prepare MLS-ready copy and structured MLS fields  so agents don&apos;t miss
              details or waste time.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/app"
                className="rounded-full bg-[#2E7F7A] px-5 py-2 text-sm font-medium text-white hover:bg-[#256963]"
              >
                Start a New Listing
              </Link>
              <Link
                href="/how-it-works"
                className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
              >
                See How It Works
              </Link>
            </div>

            <p className="pt-2 text-[11px] text-zinc-500">
              No subscriptions. Use ListingLaunchAI only when you need it, on a
              per-listing basis.
            </p>
            <p className="pt-1 text-[11px] text-zinc-500">
              ListingLaunchAI does not log in to or submit data into Stellar MLS. It
              prepares MLS-ready drafts for you to review and enter.
            </p>
          </div>

          <div className="flex-1">
            <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between text-sm text-zinc-500">
                <span className="font-medium text-[#081F33]">Listing workspace</span>
                <span>Stellar MLS prep</span>
              </div>
              <div className="grid gap-2 text-sm text-zinc-700">
                <div className="rounded-lg border border-zinc-200 bg-white p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">MLS Fields</span>
                    <span className="text-sm text-[#2E7F7A]">72% complete</span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Core property, tax, and location details drafted from public
                    records into your ListingLaunchAI workspace.
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">Disclosures (FL)</span>
                    <span className="text-sm text-zinc-500">Seller Q&amp;A only</span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Structured seller inputs, with drafts ready for your forms.
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">MLS Copy</span>
                    <span className="text-sm text-zinc-500">Public &amp; private</span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Stellar-ready remarks, feature bullets, and social captions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-10 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            How ListingLaunchAI fits into your workflow
          </h2>
          <p className="text-sm text-zinc-600 max-w-2xl">
            A simple, repeatable path from address to MLS-ready drafts — designed for
            Stellar MLS agents in Florida.
          </p>

          <div className="grid gap-3 md:grid-cols-5 text-sm">
            {[
              {
                title: "Enter the property address",
                body: "We locate the property in public and enterprise data sources.",
              },
              {
                title: "Review drafted details",
                body: "Stellar-style fields are pre-mapped in your workspace for you to confirm or adjust before entering them into the MLS.",
              },
              {
                title: "Complete disclosures",
                body: "Florida disclosures are prepared from seller responses — never auto-answered.",
              },
              {
                title: "Generate MLS copy & summaries",
                body:
                  "You get MLS-ready remarks plus highlight bullets and a structured summary you can use in your own presentations.",
              },
              {
                title: "Review & launch",
                body: "Confidence indicators help you catch gaps before publishing.",
              },
            ].map((step, idx) => (
              <div
                key={step.title}
                className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#081F33] text-xs font-semibold text-white">
                    {idx + 1}
                  </span>
                  <span>Step {idx + 1}</span>
                </div>
                <div className="text-sm font-semibold text-zinc-900">
                  {step.title}
                </div>
                <p className="text-sm text-zinc-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-b border-zinc-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 grid gap-8 md:grid-cols-[1.1fr,1.4fr]">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-[#081F33]">
              What ListingLaunchAI handles for you
            </h2>
            <p className="text-sm text-zinc-600">
              Everything is organized around Stellar MLS fields and Florida rules, so you
              can spend more time on pricing, positioning, and negotiations.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 text-sm">
            {[ 
              {
                title: "MLS-aligned data workspace",
                body: "Property and tax records mapped into Stellar-style sections for quick review before you enter them into the MLS.",
              },
              {
                title: "Florida disclosure automation",
                body: "Structured seller Q&A that drives FL-friendly disclosure drafts.",
              },
              {
                title: "HOA & community handling",
                body: "Prompts for HOA, condo, and CDD so nothing important is skipped.",
              },
              {
                title: "Flood & risk context",
                body: "Flood and tax context surfaced so you can frame risk clearly.",
              },
              {
                title: "Location intelligence",
                body: "Area details such as access and nearby schools organized for quick reference.",
              },
              {
                title: "Compliance-friendly structure",
                body: "Keeps key fields, disclosures, and notes in one place so you can review against Stellar MLS and brokerage rules before you publish.",
              },
            ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                >
                  <div className="mb-1 text-sm font-semibold text-zinc-900">
                  {item.title}
                </div>
                  <p className="text-sm text-zinc-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-10 space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-[#081F33]">
              Per-listing pricing. No subscriptions.
            </h2>
            <p className="text-sm text-zinc-600 max-w-2xl">
              Use ListingLaunchAI only when you need it. Pricing will be finalized at
              launch — choose the package that fits the listing.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 text-sm">
            {/* Standard */}
            <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">Standard Listing</h3>
              <p className="mt-1 text-sm text-zinc-600">One-time per listing.</p>
              <div className="mt-3 text-2xl font-semibold text-zinc-900">
                —
                <span className="ml-1 text-xs font-normal text-zinc-500">
                  pricing TBD
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-zinc-700">
                <li>MLS-style data draft from public records</li>
                <li>Florida disclosure drafts</li>
                <li>MLS-ready copy generation</li>
                <li>Compliance-friendly checklists (you still review)</li>
              </ul>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  className="w-full rounded-full bg-[#2E7F7A] px-3 py-2 text-xs font-medium text-white hover:bg-[#256963]"
                >
                  Buy for This Listing
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it&apos;s for */}
      <section className="border-b border-zinc-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-[#081F33]">
            Who ListingLaunchAI is for
          </h2>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold text-zinc-900">Solo agents</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Agents who run their own listings and want repeatable MLS prep without
                rebuilding every form.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold text-zinc-900">Teams &amp; brokerages</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Teams that want consistent, compliant workflows across multiple
                listing agents.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold text-zinc-900">Stellar MLS agents</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Florida agents who need Stellar-aligned fields and Florida-specific
                disclosure support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & data */}
      <section className="border-b border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-8 space-y-3 text-sm">
          <h2 className="text-sm font-semibold tracking-tight text-[#081F33]">
            Trust, data, and review responsibilities
          </h2>
          <div className="grid gap-2 md:grid-cols-3">
            <p className="text-zinc-600">
              <span className="font-medium">Enterprise-grade data.</span> Property and tax
              records are sourced from public and authoritative datasets.
            </p>
            <p className="text-zinc-600">
              <span className="font-medium">Agent-controlled decisions.</span> ListingLaunchAI
              prepares data and drafts; you decide what to enter into Stellar MLS.
            </p>
            <p className="text-zinc-600">
              <span className="font-medium">No legal advice.</span> Disclosures and language
              must always be reviewed by the agent (and, where appropriate, counsel).
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#081F33] text-zinc-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 text-xs">
            <div className="font-semibold text-white">ListingLaunchAI</div>
            <p className="text-sm text-zinc-400 max-w-xs">
              A focused tool for Stellar MLS agents in Florida to prepare accurate,
              MLS-ready listings with confidence.
            </p>
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} ListingLaunchAI. All rights reserved.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-1">
              <div className="font-medium text-white">Product</div>
              <Link href="/marketing" className="block text-zinc-400 hover:text-white">
                About
              </Link>
              <Link href="/how-it-works" className="block text-zinc-400 hover:text-white">
                How It Works
              </Link>
              <a href="#pricing" className="block text-zinc-400 hover:text-white">
                Pricing
              </a>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-white">Company</div>
              <Link
                href="mailto:support@listinglaunchai.com"
                className="block text-zinc-400 hover:text-white"
              >
                Contact
              </Link>
              <span className="block text-zinc-500">
                Legal &amp; disclaimers available in app.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
