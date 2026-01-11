import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Listing } from "@/lib/types";
import { LeadForm } from "@/components/listing/LeadForm";

interface PageProps {
  params: { slug: string };
}

export default async function ListingHubPage({ params }: PageProps) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // eslint-disable-next-line no-console
    console.error("Listing hub Supabase env missing", {
      hasUrl: !!url,
      hasAnon: !!anonKey,
    });
    notFound();
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, sms_keyword, sms_phone_number, estated_raw, property, branding, ai_content, wizard_answers",
    )
    .eq("slug", params.slug)
    .single();

  if (error || !data) {
    // Log for debugging 404s in production
    // eslint-disable-next-line no-console
    console.error("Listing hub not found", { slug: params.slug, error });
    notFound();
  }

  const row = data as any;

  const listing: Listing = {
    id: row.id,
    agentId: row.agent_id,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    street: row.street,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    status: row.status,
    smsKeyword: row.sms_keyword,
    smsPhoneNumber: row.sms_phone_number,
    estatedRaw: row.estated_raw,
    property: row.property,
    branding: row.branding,
    aiContent: row.ai_content,
    wizardAnswers: row.wizard_answers,
  };

  const agent = listing.branding?.agent;
  const lender = listing.branding?.mortgagePartner ?? null;
  const ai = listing.aiContent ?? null;

  const addressLine = `${listing.street}, ${listing.city}, ${listing.state} ${listing.postalCode}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-500">Listing hub</div>
        <a
          href="/app"
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-100"
        >
          Agent sign in
        </a>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            For sale
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{addressLine}</h1>
          {ai?.mlsPublicRemarks.standard && (
            <p className="text-sm text-zinc-700 mt-2">
              {ai.mlsPublicRemarks.standard}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-600">
          {listing.property.beds.value && (
            <span>{listing.property.beds.value} beds</span>
          )}
          {listing.property.baths.value && (
            <span>{listing.property.baths.value} baths</span>
          )}
          {listing.property.squareFeet.value && (
            <span>{listing.property.squareFeet.value} sq ft</span>
          )}
          {listing.property.yearBuilt.value && (
            <span>Built {listing.property.yearBuilt.value}</span>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          {ai && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2 text-xs">
              <div className="font-semibold text-zinc-800">
                Highlights
              </div>
              <div>
                <div className="font-medium text-zinc-700">Interior</div>
                <ul className="list-disc list-inside text-zinc-700">
                  {ai.featureBulletsInterior.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-zinc-700">Exterior</div>
                <ul className="list-disc list-inside text-zinc-700">
                  {ai.featureBulletsExterior.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-zinc-700">Community</div>
                <ul className="list-disc list-inside text-zinc-700">
                  {ai.featureBulletsCommunity.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-[11px] text-zinc-600">
            <p>
              Information presented here is based on public records, agent
              input, and AI-generated marketing copy. This page is not an MLS
              listing and is not affiliated with or approved by Stellar MLS.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {agent && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs">
              <div className="font-semibold text-zinc-800">Listing Agent</div>
              <div className="mt-1 text-zinc-700">{agent.name}</div>
              {agent.brokerage && (
                <div className="text-[11px] text-zinc-500">{agent.brokerage}</div>
              )}
              <div className="mt-1 text-[11px] text-zinc-600">
                {agent.phone && <div>Call/Text: {agent.phone}</div>}
                {agent.email && <div>Email: {agent.email}</div>}
              </div>
            </div>
          )}

          {lender && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs">
              <div className="font-semibold text-zinc-800">Mortgage Partner</div>
              <div className="mt-1 text-zinc-700">{lender.name}</div>
              {lender.company && (
                <div className="text-[11px] text-zinc-500">
                  {lender.company} (NMLS {lender.nmlsId})
                </div>
              )}
              <div className="mt-1 text-[11px] text-zinc-600">
                {lender.phone && <div>Phone: {lender.phone}</div>}
                {lender.email && <div>Email: {lender.email}</div>}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs space-y-2">
            <div className="font-semibold text-zinc-800">Request more info</div>
            <LeadForm listingId={listing.id} />
            {listing.smsKeyword && listing.smsPhoneNumber && (
              <p className="text-[11px] text-zinc-600">
                Prefer text? Reply "{listing.smsKeyword.toUpperCase()}" to
                {" "}
                {listing.smsPhoneNumber} to get a link to this page.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
