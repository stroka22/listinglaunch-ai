"use client";

import { useEffect, useState } from "react";
import type { Listing } from "@/lib/types";
import { LeadForm } from "@/components/listing/LeadForm";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ListingHubPage() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const path = window.location.pathname; // /listing/<slug>
        const parts = path.split("/").filter(Boolean);
        const rawSlug = parts[1] ?? null; // [0] = "listing", [1] = slug

        if (!rawSlug) {
          setError("No slug in URL path.");
          setLoading(false);
          return;
        }

        const decodedSlug = decodeURIComponent(rawSlug);
        setSlug(decodedSlug);

        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, sms_keyword, sms_phone_number, estated_raw, property, branding, ai_content, wizard_answers, photos",
          )
          .eq("slug", decodedSlug)
          .limit(1)
          .maybeSingle();

        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        if (!data) {
          setError("Listing not found.");
          setLoading(false);
          return;
        }

        const row = data as any;

        const loaded: Listing = {
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
          photos: row.photos ?? null,
          estatedRaw: row.estated_raw,
          property: row.property,
          branding: row.branding,
          aiContent: row.ai_content,
          wizardAnswers: row.wizard_answers,
        };

        setListing(loaded);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load listing hub.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-zinc-500">
        Loading listing hub...
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-red-700 space-y-2">
        <p className="font-semibold">Listing hub could not be loaded.</p>
        {slug && (
          <p className="text-xs text-red-600">
            Debug slug: <code className="rounded bg-red-50 px-1">{slug}</code>
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 break-all">
            Error: <code className="rounded bg-red-50 px-1">{error}</code>
          </p>
        )}
      </div>
    );
  }

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
          ← Back to agent dashboard
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
              <div className="font-semibold text-zinc-800">Highlights</div>
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
                Prefer text? Reply "{listing.smsKeyword.toUpperCase()}" to {" "}
                {listing.smsPhoneNumber} to get a link to this page.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
