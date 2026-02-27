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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, sms_keyword, sms_phone_number, credit_consumed, archived, estated_raw, property, branding, ai_content, wizard_answers, photos",
          )
          .eq("agent_id", session.user.id)
          .eq("archived", false)
          .order("created_at", { ascending: false });

        if (error) {
          setError(error.message);
          setListings([]);
          return;
        }

        const mapped: Listing[] = (data ?? []).map((row: any) => ({
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
          creditConsumed: row.credit_consumed,
          archived: row.archived,
          photos: row.photos ?? null,
          estatedRaw: row.estated_raw,
          property: row.property,
          branding: row.branding,
          aiContent: row.ai_content,
          wizardAnswers: row.wizard_answers,
        }));

        setListings(mapped);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load listings");
        setListings([]);
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

  async function handleArchiveListing(listingId: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("listings")
        .update({ archived: true })
        .eq("id", listingId)
        .eq("agent_id", session.user.id);

      if (error) {
        setError(error.message);
        return;
      }

      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } catch (err: any) {
      setError(err?.message ?? "Failed to archive listing");
    }
  }

  async function handleDeleteListing(listingId: string) {
    if (
      !window.confirm(
        "Delete this listing permanently? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listingId)
        .eq("agent_id", session.user.id);

      if (error) {
        setError(error.message);
        return;
      }

      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete listing");
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
          <p className="text-xs text-zinc-500">
            Enter a property address, answer the smart questions, and generate
            MLS-ready data you can copy straight into Stellar.
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

      <NewListingWizard
        agentId={session.user.id}
        onCreated={() => window.location.reload()}
      />

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your listings</h3>
          {loading && (
            <span className="text-[11px] text-zinc-500">Loading…</span>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {error}
          </div>
        )}

        {listings.length === 0 && !loading && !error ? (
          <p className="text-xs text-zinc-500">
            No listings yet. Use the wizard above to create your first listing.
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
                  <th className="px-3 py-2">Actions</th>
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
                    <td className="px-3 py-2 align-top text-[11px]">
                      <div className="flex flex-wrap gap-1">
                        <a
                          href={`/workspace/listings/${listing.id}`}
                          className="rounded-full border border-zinc-300 px-2 py-0.5 font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Open workspace
                        </a>
                        <button
                          type="button"
                          onClick={() => handleArchiveListing(listing.id)}
                          className="rounded-full border border-zinc-300 px-2 py-0.5 text-zinc-500 hover:bg-zinc-100"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteListing(listing.id)}
                          className="rounded-full border border-red-200 px-2 py-0.5 text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
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
