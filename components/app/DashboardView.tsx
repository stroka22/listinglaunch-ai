"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/types";

interface Props {
  session: Session;
}

export function DashboardView({ session }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);

  // New listing form
  const [showNew, setShowNew] = useState(false);
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("FL");
  const [zip, setZip] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadListings();
    loadCredits();
  }, [session.user.id]);

  async function loadListings() {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: err } = await supabase
        .from("listings")
        .select(
          "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, archived, property, ai_content, wizard_answers, disclosures",
        )
        .eq("agent_id", session.user.id)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (err) throw err;

      setListings(
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
          archived: row.archived,
          property: row.property,
          aiContent: row.ai_content,
          wizardAnswers: row.wizard_answers,
          disclosures: row.disclosures ?? null,
          smsKeyword: row.sms_keyword ?? "",
          smsPhoneNumber: row.sms_phone_number ?? "",
          estatedRaw: null,
          branding: null,
          photos: null,
        })),
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  async function loadCredits() {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("agent_credit_ledger")
        .select("delta")
        .eq("agent_id", session.user.id);
      const balance = (data ?? []).reduce(
        (sum: number, row: any) => sum + (row.delta as number),
        0,
      );
      setCreditsBalance(balance);
    } catch {
      // non-fatal
    }
  }

  async function handleCreate() {
    if (!street.trim() || !city.trim() || !zip.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      const lookupRes = await fetch("/api/estated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: zip.trim(),
        }),
      });

      let snapshot: any = null;
      let estatedRaw: any = null;
      let wizardDefaults: Record<string, string> = {};

      if (lookupRes.ok) {
        const json = await lookupRes.json();
        snapshot = json.snapshot;
        estatedRaw = json.raw;

        const { deriveSmartWizardDefaultsFromRaw, deriveSchoolsFromRawSchools } =
          await import("@/lib/estated");
        wizardDefaults = deriveSmartWizardDefaultsFromRaw(json.raw);

        const schools = deriveSchoolsFromRawSchools(json.schoolsRaw ?? null);
        if (schools.elementary || schools.middle || schools.high) {
          const parts: string[] = [];
          if (schools.elementary) parts.push(`Elem: ${schools.elementary}`);
          if (schools.middle) parts.push(`Middle: ${schools.middle}`);
          if (schools.high) parts.push(`High: ${schools.high}`);
          wizardDefaults.schools_summary = `${parts.join(" | ")} (per ATTOM; buyer to verify).`;
        }
      }

      // Build slug
      const slug = `${street}-${city}-${state}-${zip}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

      // Load agent profile for branding
      const supabase = getSupabaseBrowserClient();
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("name, brokerage, phone, email, headshot_url, logo_url, primary_color, secondary_color")
        .eq("id", session.user.id)
        .single();

      const agentBranding = {
        id: session.user.id,
        userId: session.user.id,
        name: profile?.name ?? "",
        brokerage: profile?.brokerage ?? "",
        phone: profile?.phone ?? "",
        email: profile?.email ?? session.user.email ?? "",
        headshotUrl: profile?.headshot_url ?? null,
        logoUrl: profile?.logo_url ?? null,
        primaryColor: profile?.primary_color ?? "#111827",
        secondaryColor: profile?.secondary_color ?? "#4b5563",
      };

      const { data, error } = await supabase
        .from("listings")
        .insert({
          agent_id: session.user.id,
          slug,
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          postal_code: zip.trim(),
          status: "draft",
          sms_keyword: `LL${street.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()}${Math.floor(Math.random() * 9000 + 1000)}`,
          estated_raw: estatedRaw,
          property: snapshot ?? {
            beds: { value: null, source: "public_record", confidence: null, confirmedByAgent: false },
            baths: { value: null, source: "public_record", confidence: null, confirmedByAgent: false },
            squareFeet: { value: null, source: "public_record", confidence: null, confirmedByAgent: false },
            lotSizeSqFt: { value: null, source: "public_record", confidence: null, confirmedByAgent: false },
            yearBuilt: { value: null, source: "public_record", confidence: null, confirmedByAgent: false },
            propertyType: { value: null, source: "public_record", confidence: null, confirmedByAgent: false },
            parcelId: { value: null, source: "public_record", confidence: null, confirmedByAgent: false },
            annualTaxes: { value: null, source: "public_record", confidence: null, confirmedByAgent: false },
          },
          branding: { agent: agentBranding, mortgagePartner: null },
          wizard_answers: wizardDefaults,
        })
        .select("id")
        .single();

      if (error) {
        if (error.message?.includes("listings_slug_key")) {
          throw new Error("A listing for this address already exists.");
        }
        throw error;
      }

      // Redirect to workspace
      window.location.href = `/workspace/listings/${data.id}`;
    } catch (err: any) {
      setCreateError(err?.message ?? "Could not create listing");
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this listing permanently?")) return;
    try {
      const res = await fetch(`/api/listings/${id}/manage`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: session.user.id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "Could not delete listing");
    }
  }

  function getProgress(listing: Listing): {
    done: number;
    total: number;
    steps: { label: string; done: boolean }[];
    nextAction: string | null;
  } {
    const answers = (listing.wizardAnswers ?? {}) as Record<string, string>;
    const ai = listing.aiContent;
    const prop = listing.property;
    const disc = listing.disclosures;

    const answeredCount = Object.values(answers).filter(Boolean).length;

    const steps = [
      {
        label: "Property data",
        done: prop?.beds?.value != null || prop?.squareFeet?.value != null || answeredCount > 0,
      },
      {
        label: "Smart questions",
        done: answeredCount >= 5,
      },
      {
        label: "MLS copy",
        done: Boolean(ai?.mlsPublicRemarks?.standard),
      },
      {
        label: "MLS fields",
        done: answeredCount >= 8,
      },
      {
        label: "Seller interview",
        done: Boolean(disc && typeof disc === "object" && (disc as any).answers && Object.values((disc as any).answers).filter(Boolean).length >= 3),
      },
    ];

    const done = steps.filter((s) => s.done).length;
    const total = steps.length;

    let nextAction: string | null = null;
    if (!steps[0].done) nextAction = "Review property data";
    else if (!steps[1].done) nextAction = "Answer smart questions";
    else if (!steps[2].done) nextAction = "Generate MLS copy";
    else if (!steps[3].done) nextAction = "Fill in MLS fields";
    else if (!steps[4].done) nextAction = "Complete seller interview";

    return { done, total, steps, nextAction };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            My Listings
          </h1>
          <p className="text-sm text-zinc-500">
            {creditsBalance != null && (
              <span>{creditsBalance} credit{creditsBalance === 1 ? "" : "s"} available</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
        >
          + New Listing
        </button>
      </div>

      {/* New listing form */}
      {showNew && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-zinc-900">
            Create a new listing
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Enter the property address. We'll pull public records automatically and take you to your workspace.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Street address"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
            />
            <input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
            />
            <input
              placeholder="State"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
            />
            <input
              placeholder="ZIP code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
            />
          </div>

          {createError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !street.trim() || !city.trim() || !zip.trim()}
              className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
            >
              {creating ? "Creating listing…" : "Create & open workspace"}
            </button>
            <button
              type="button"
              onClick={() => { setShowNew(false); setCreateError(null); }}
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-sm text-zinc-400">
          Loading your listings…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && listings.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center">
          <div className="mx-auto max-w-sm space-y-2">
            <p className="text-base font-medium text-zinc-700">
              No listings yet
            </p>
            <p className="text-sm text-zinc-500">
              Click "New Listing" above to get started. Just enter an address and
              we'll handle the rest.
            </p>
          </div>
        </div>
      )}

      {/* Listing cards */}
      {listings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const progress = getProgress(listing);
            const pct = Math.round((progress.done / progress.total) * 100);
            const prop = listing.property;

            return (
              <div
                key={listing.id}
                className="group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Address */}
                <a
                  href={`/workspace/listings/${listing.id}`}
                  className="block space-y-1"
                >
                  <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-700">
                    {listing.street}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {listing.city}, {listing.state} {listing.postalCode}
                  </p>
                </a>

                {/* Quick stats */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                  {prop?.beds?.value != null && (
                    <span>{prop.beds.value} bd</span>
                  )}
                  {prop?.baths?.value != null && (
                    <span>{prop.baths.value} ba</span>
                  )}
                  {prop?.squareFeet?.value != null && (
                    <span>{Number(prop.squareFeet.value).toLocaleString()} sqft</span>
                  )}
                  {prop?.yearBuilt?.value != null && (
                    <span>Built {prop.yearBuilt.value}</span>
                  )}
                </div>

                {/* Status badge */}
                <div className="mt-3">
                  {pct === 100 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Ready for MLS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      In progress
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      {progress.done}/{progress.total} steps
                    </span>
                    <span className={`font-medium ${pct === 100 ? "text-emerald-600" : "text-zinc-600"}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-zinc-900"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Next action hint */}
                {progress.nextAction && (
                  <p className="mt-2 text-xs text-amber-600">
                    Next: {progress.nextAction}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-3 flex items-center justify-between">
                  <a
                    href={`/workspace/listings/${listing.id}`}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      pct === 100
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {pct === 100 ? "Review & copy to MLS →" : "Continue →"}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(listing.id)}
                    className="rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>

                {/* Date */}
                <div className="mt-2 text-[11px] text-zinc-400">
                  Created {new Date(listing.createdAt).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
