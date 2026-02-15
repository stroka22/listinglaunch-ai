import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="bg-white text-zinc-900">
      {/* Header */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                How it works
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-[#081F33] md:text-4xl">
                From address to MLS-ready listing in minutes.
              </h1>
              <p className="max-w-2xl text-sm text-zinc-600">
                ListingLaunchAI gathers the data, asks the right questions, and assembles
                MLS-ready copy, packets, flyers, and social content — so you can focus on
                pricing, strategy, and your clients.
              </p>
            </div>
            <div className="text-xs text-zinc-600">
              <p className="mb-1 font-medium text-zinc-800">Ready to try it?</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/app"
                  className="rounded-full bg-[#2E7F7A] px-4 py-2 text-[11px] font-medium text-white hover:bg-[#256963]"
                >
                  Start a New Listing
                </Link>
                <Link
                  href="/marketing#pricing"
                  className="text-[11px] font-medium text-[#081F33] underline-offset-4 hover:underline"
                >
                  View pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* High-level steps */}
      <section className="border-b border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl space-y-4 px-6 py-10">
          <h2 className="text-lg font-semibold tracking-tight text-[#081F33]">
            How ListingLaunchAI fits into your day
          </h2>
          <p className="max-w-2xl text-sm text-zinc-600">
            You bring the property and your expertise. ListingLaunchAI handles the
            research, structure, and first drafts.
          </p>

          <div className="grid gap-3 text-[11px] md:grid-cols-5">
            {[ 
              {
                title: "Start with the address",
                body: "Enter the property address once. We locate the property in authoritative public record datasets.",
              },
              {
                title: "We pull the hard data",
                body: "Beds, baths, square footage, lot size, HOA, schools, taxes, and more are fetched automatically.",
              },
              {
                title: "Answer smart questions",
                body: "Short, guided prompts capture upgrades, views, community perks, and open house details.",
              },
              {
                title: "Generate MLS copy & PDFs",
                body: "Get MLS-ready remarks, highlight bullets, and a professional listing packet PDF.",
              },
              {
                title: "Create flyers & social",
                body: "Download agent-only and agent+lender flyers, then turn them into social posts in a few clicks.",
              },
            ].map((step, idx) => (
              <div
                key={step.title}
                className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-500">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#081F33] text-[10px] font-semibold text-white">
                    {idx + 1}
                  </span>
                  <span>Step {idx + 1}</span>
                </div>
                <div className="text-[11px] font-semibold text-zinc-900">
                  {step.title}
                </div>
                <p className="text-[11px] text-zinc-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data gathering for MLS */}
      <section className="border-b border-zinc-100 bg-white">
        <div className="mx-auto max-w-6xl space-y-4 px-6 py-10 text-[11px] md:grid md:grid-cols-[1.1fr,1.4fr] md:gap-10 md:space-y-0">
          <div className="space-y-2 text-sm">
            <h2 className="text-lg font-semibold tracking-tight text-[#081F33]">
              How we gather everything your MLS needs
            </h2>
            <p className="text-zinc-600">
              Instead of making you hunt through multiple websites, ListingLaunchAI
              pulls public record data, maps it to Stellar-style fields, and then
              guides you through the human-only details.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="mb-1 text-[11px] font-semibold text-zinc-900">
                1. Property lookup in public records
              </h3>
              <p className="text-zinc-600">
                You enter the address; we query a national property data provider
                and pull the official record for that parcel: beds, baths, square
                footage, lot size, year built, stories, parking, pool/waterfront
                flags, HOA details, taxes, and school info where available.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="mb-1 text-[11px] font-semibold text-zinc-900">
                2. Mapping into Stellar-style fields
              </h3>
              <p className="text-zinc-600">
                Raw public data is translated into structured fields that mirror how
                Stellar MLS expects information: core property specs, legal and zoning
                details, HOA name and dues, tax year and exemptions, utilities, and a
                clear school summary. Anything ambiguous is surfaced for you to
                confirm instead of guessed.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="mb-1 text-[11px] font-semibold text-zinc-900">
                3. Smart questions for human-only details
              </h3>
              <p className="text-zinc-600">
                We then prompt you for the things the tax roll can&apos;t see:
                upgrades, finishes, views, outdoor living areas, community
                amenities, special terms, and open house logistics. Your answers
                drive both the MLS remarks and the supporting marketing content.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="mb-1 text-[11px] font-semibold text-zinc-900">
                4. Research helpers for final verification
              </h3>
              <p className="text-zinc-600">
                For anything that must be double-checked, we give you shortcuts:
                county property appraiser links, FEMA flood map access, and school
                zone resources based on the property location. You stay in control
                while the system makes verification fast.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Flyers and social */}
      <section className="border-b border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl space-y-4 px-6 py-10 md:grid md:grid-cols-2 md:gap-8 md:space-y-0">
          <div className="space-y-2 text-sm">
            <h2 className="text-lg font-semibold tracking-tight text-[#081F33]">
              Open house flyers, then social posts
            </h2>
            <p className="text-zinc-600">
              Once your MLS data and copy are dialed in, ListingLaunchAI turns that
              work into polished open house materials and social media content.
            </p>
          </div>

          <div className="grid gap-3 text-[11px]">
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <h3 className="mb-1 text-[11px] font-semibold text-zinc-900">
                Agent-only open house flyer
              </h3>
              <p className="text-zinc-600">
                Download a clean, professional flyer that features only the listing
                agent: your photo, branding, QR code to the Property Hub, and the
                key property highlights buyers care about.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <h3 className="mb-1 text-[11px] font-semibold text-zinc-900">
                Co-branded agent + lender flyer
              </h3>
              <p className="text-zinc-600">
                Create a co-branded version that showcases both the real estate
                agent and the mortgage professional, including lender headshot,
                company, and NMLS details where required.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <h3 className="mb-1 text-[11px] font-semibold text-zinc-900">
                Social-ready versions of your flyers
              </h3>
              <p className="text-zinc-600">
                Turn your flyers into social media posts tailored for Instagram,
                Facebook, and LinkedIn, with pre-written captions and layouts that
                respect your brand and compliance guidelines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Wrap-up */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl space-y-4 px-6 py-10 text-sm">
          <h2 className="text-lg font-semibold tracking-tight text-[#081F33]">
            Everything lives in one listing workspace
          </h2>
          <p className="max-w-3xl text-zinc-600">
            From the moment you type an address, ListingLaunchAI keeps MLS fields,
            disclosures, marketing copy, flyers, and lead capture all connected to a
            single listing. You can always come back to tweak details, re-generate
            materials, or export leads — without rebuilding your work from scratch.
          </p>
          <div className="pt-2">
            <Link
              href="/app"
              className="inline-flex items-center rounded-full bg-[#2E7F7A] px-5 py-2 text-[11px] font-medium text-white hover:bg-[#256963]"
            >
              Launch your next listing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
