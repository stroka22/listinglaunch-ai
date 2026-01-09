"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/types";
import { NewListingWizard } from "@/components/dashboard/NewListingWizard";

interface DashboardProps {
  session: Session;
}

export function Dashboard({ session }: DashboardProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, sms_keyword, sms_phone_number, estated_raw, property, branding, ai_content, wizard_answers",
          )
          .eq("agent_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) {
          setError(error.message);
          setListings([]);
          setLeadCounts({});
          return;
        }

        const mapped =
          (data ?? []).map((row: any) => ({
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
          }));

        setListings(mapped);

        const listingIds = mapped.map((l) => l.id);
        if (listingIds.length > 0) {
          const { data: leadRows, error: leadsError } = await supabase
            .from("leads")
            .select("id, listing_id")
            .in("listing_id", listingIds);

          if (!leadsError && leadRows) {
            const counts: Record<string, number> = {};
            for (const row of leadRows as any[]) {
              const lid = row.listing_id as string;
              counts[lid] = (counts[lid] ?? 0) + 1;
            }
            setLeadCounts(counts);
          }
        } else {
          setLeadCounts({});
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load listings");
        setListings([]);
        setLeadCounts({});
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [session.user.id]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
          <p className="text-xs text-zinc-500">
            Welcome, {session.user.email}. Create a new Listing Launch Kit or
            open an existing listing to view assets and leads.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Sign out
        </button>
      </div>

      <NewListingWizard agentId={session.user.id} onCreated={() => window.location.reload()} />

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your listings</h3>
          {loading && (
            <span className="text-[11px] text-zinc-500">Loading…</span>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Could not load listings from Supabase. Verify your tables and RLS
            policies. Error: {error}
          </div>
        )}

        {listings.length === 0 && !loading && !error ? (
          <p className="text-xs text-zinc-500">
            No listings yet. Use the "New Listing" panel above to create your
            first Listing Launch Kit.
          </p>
        ) : null}

        {listings.length > 0 && (
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-zinc-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">SMS Keyword</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">Assets</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr
                    key={listing.id || listing.slug}
                    className="border-t border-zinc-100"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-zinc-800">
                        {listing.street}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {listing.city}, {listing.state} {listing.postalCode}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] capitalize text-zinc-600">
                      {listing.status}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-500">
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-500">
                      {listing.smsKeyword ? listing.smsKeyword : "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-500">
                      {listing.id ? leadCounts[listing.id] ?? 0 : 0}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px]">
                      <div className="flex flex-wrap gap-1">
                        {listing.id ? (
                          <a
                            href={`/workspace/listings/${listing.id}`}
                            className="rounded-full border border-zinc-300 px-2 py-0.5 hover:bg-zinc-100"
                          >
                            Workspace
                          </a>
                        ) : (
                          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-zinc-400">
                            Workspace
                          </span>
                        )}
                        <a
                          href={`/listing/${listing.slug}`}
                          className="rounded-full border border-zinc-300 px-2 py-0.5 hover:bg-zinc-100"
                        >
                          Hub page
                        </a>
                        <a
                          href={`/api/listings/${listing.id}/packet.pdf`}
                          className="rounded-full border border-zinc-300 px-2 py-0.5 hover:bg-zinc-100"
                        >
                          MLS packet PDF
                        </a>
                        <a
                          href={`/api/listings/${listing.id}/flyer.pdf`}
                          className="rounded-full border border-zinc-300 px-2 py-0.5 hover:bg-zinc-100"
                        >
                          Open house flyer
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
