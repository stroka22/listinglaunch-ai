"use client";

import { useEffect, useState } from "react";
import type { DisclosureAnswer, Listing } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createEmptyDisclosures,
  packagesForQuestion,
  updateDisclosureAnswer,
} from "@/lib/disclosures_fl";
import { deriveExtendedFieldsFromRaw } from "@/lib/estated";

interface ListingWorkspaceProps {
  listingId: string;
}

function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-700 hover:bg-zinc-100"
    >
      {status === "copied" ? "Copied" : "Copy"}
    </button>
  );
}

export function ListingWorkspace({ listingId }: ListingWorkspaceProps) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"copy" | "mls" | "disclosures">(
    "copy",
  );

  const [disclosures, setDisclosures] = useState<
    ReturnType<typeof createEmptyDisclosures> | null
  >(null);
  const [disclosuresSaving, setDisclosuresSaving] = useState(false);
  const [disclosuresError, setDisclosuresError] = useState<string | null>(null);
  const [disclosuresSavedOnce, setDisclosuresSavedOnce] = useState(false);

  const [regenStatus, setRegenStatus] = useState<
    "idle" | "pending" | "done" | "error"
  >("idle");
  const [regenError, setRegenError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        let idForFetch = listingId;
        if (typeof window !== "undefined") {
          const segments = window.location.pathname.split("/").filter(Boolean);
          const last = segments[segments.length - 1];
          if (last) {
            idForFetch = last;
          }
        }

        const res = await fetch(`/api/listings/${idForFetch}/workspace`);

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          const detail = json?.error ?? "Unknown error";
          const message = `Could not load this listing: ${detail}`;
          setLoadError(message);
          setListing(null);
          setLoading(false);
          return;
        }

        const json = (await res.json()) as { listing: any };
        const row = json.listing as any;

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
          estatedRaw: row.estated_raw,
          property: row.property,
          branding: row.branding,
          aiContent: row.ai_content,
          wizardAnswers: row.wizard_answers,
          disclosures: row.disclosures,
        };

        setListing(loaded);

        const initial =
          loaded.disclosures ??
          createEmptyDisclosures({
            propertyType: loaded.property.propertyType.value,
            yearBuilt: loaded.property.yearBuilt.value,
          });

        setDisclosures(initial);
      } catch (err: any) {
        setLoadError(err?.message ?? "Failed to load listing");
        setListing(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [listingId]);

  const questions = disclosures ? packagesForQuestion(disclosures.metadata) : [];

  async function handleSaveDisclosures() {
    if (!listing || !disclosures) return;
    setDisclosuresError(null);
    setDisclosuresSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("listings")
        .update({ disclosures })
        .eq("id", listing.id);
      if (error) throw error;
      setDisclosuresSavedOnce(true);
    } catch (err: any) {
      setDisclosuresError(err?.message ?? "Could not save disclosures");
    } finally {
      setDisclosuresSaving(false);
    }
  }

  async function handleRegenerateAi() {
    if (!listing) return;
    setRegenError(null);
    setRegenStatus("pending");
    try {
      const res = await fetch(`/api/listings/${listing.id}/generate-ai`, {
        method: "POST",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        if (res.status === 402 && json?.code === "NO_CREDITS") {
          throw new Error(
            json.error ||
              "You do not have any listing credits available. Purchase credits to generate AI assets.",
          );
        }
        throw new Error(json?.error || "AI generation failed");
      }

      const json = (await res.json()) as { aiContent?: any };

      setListing((prev) =>
        prev && json?.aiContent
          ? ({ ...prev, aiContent: json.aiContent } as Listing)
          : prev,
      );

      setRegenStatus("done");
    } catch (err: any) {
      setRegenError(err?.message ?? "Could not regenerate AI assets");
      setRegenStatus("error");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-zinc-500">
        Loading listing workspace...
      </div>
    );
  }

  if (loadError || !listing || !disclosures) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-red-700">
        {loadError || "Listing not found."}
      </div>
    );
  }

  const ai = listing.aiContent ?? null;
  const addressLine = `${listing.street}, ${listing.city}, ${listing.state} ${listing.postalCode}`;
  const answers = listing.wizardAnswers ?? {};
  const agentBranding = listing.branding?.agent ?? null;

  const attomExt = deriveExtendedFieldsFromRaw(listing.estatedRaw ?? null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Listing workspace</h1>
          <p className="text-xs text-zinc-500">{addressLine}</p>
        </div>
        <a
          href={`/listing/${listing.slug}`}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
        >
          View public hub
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("copy")}
          className={`rounded-full px-3 py-1 ${activeTab === "copy" ? "bg-black text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          MLS Copy
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("mls")}
          className={`rounded-full px-3 py-1 ${activeTab === "mls" ? "bg-black text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          MLS Fields
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("disclosures")}
          className={`rounded-full px-3 py-1 ${activeTab === "disclosures" ? "bg-black text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          Disclosures (FL)
        </button>
      </div>

      {activeTab === "copy" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {!ai && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                AI assets have not been generated yet for this listing.
              </div>
            )}
            <button
              type="button"
              onClick={handleRegenerateAi}
              disabled={regenStatus === "pending"}
              className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {regenStatus === "pending"
                ? "Generating AI assets…"
                : ai
                  ? "Regenerate AI assets"
                  : "Generate AI assets"}
            </button>
            {regenStatus === "done" && !regenError && (
              <span className="text-[11px] text-emerald-600">
                AI assets updated for this listing.
              </span>
            )}
          </div>

          {regenError && (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {regenError}
            </div>
          )}

          {ai && (
            <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-800">
                MLS public remarks
              </h2>
              <span className="text-[10px] text-zinc-500">
                Copy into Stellar MLS (public remarks)
              </span>
            </div>

            <div className="space-y-2">
              {(["standard", "lifestyle", "investor"] as const).map(
                (style) => {
                  const text = ai.mlsPublicRemarks[style] ?? "";
                  return (
                    <div
                      key={style}
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-medium text-zinc-700 capitalize">
                          {style} style
                        </div>
                        {text && <CopyButton text={text} />}
                      </div>
                      <p className="text-[11px] text-zinc-700 whitespace-pre-wrap">
                        {text || "Not generated"}
                      </p>
                    </div>
                  );
                },
              )}
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-800">
                MLS private remarks
              </h2>
              {ai.mlsPrivateRemarks && (
                <CopyButton text={ai.mlsPrivateRemarks} />
              )}
            </div>
            <p className="text-[11px] text-zinc-700 whitespace-pre-wrap">
              {ai.mlsPrivateRemarks || "Not generated"}
            </p>

            <div className="mt-3 space-y-1 text-[10px] text-zinc-500">
              <p>
                Use this section for showing instructions and material facts.
                Avoid marketing language that belongs in public remarks.
              </p>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-800">Feature bullets</h2>
              <span className="text-[10px] text-zinc-500">
                Interior / exterior / community
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {[
                ["Interior", ai.featureBulletsInterior],
                ["Exterior", ai.featureBulletsExterior],
                ["Community", ai.featureBulletsCommunity],
              ].map(([label, bullets]) => {
                const joined = (bullets as string[]).join("\n");
                return (
                  <div
                    key={label as string}
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-2 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-medium text-zinc-700">
                        {label}
                      </div>
                      {joined && <CopyButton text={joined} />}
                    </div>
                    <ul className="list-disc list-inside text-[11px] text-zinc-700">
                      {(bullets as string[]).map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-800">
                Social media captions
              </h2>
              <span className="text-[10px] text-zinc-500">
                Instagram / Facebook / LinkedIn
              </span>
            </div>

            <div className="space-y-2">
              {[
                ["Instagram", ai.socialInstagram],
                ["Facebook", ai.socialFacebook],
                ["LinkedIn", ai.socialLinkedIn],
              ].map(([label, text]) => (
                <div
                  key={label as string}
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-medium text-zinc-700">
                      {label}
                    </div>
                    {text && <CopyButton text={text as string} />}
                  </div>
                  <p className="text-[11px] text-zinc-700 whitespace-pre-wrap">
                    {(text as string) || "Not generated"}
                  </p>
                </div>
              ))}
            </div>
          </section>
            </div>
          )}
        </>
      )}

      {activeTab === "mls" && (
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-zinc-800">Stellar MLS fields</h2>
            <span className="text-[10px] text-zinc-500">
              Read-only view; copy values into Stellar MLS
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(
                addressLine + " property appraiser",
              )}`}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              Property appraiser / tax roll search
            </a>
            <a
              href={`https://msc.fema.gov/portal/search?Address=${encodeURIComponent(
                addressLine,
              )}`}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              FEMA flood map
            </a>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(
                addressLine + " school zone",
              )}`}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              School zone search
            </a>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* A. Identification & Status */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                A. Identification & Status
              </h3>
              <p className="text-[11px] text-zinc-600">Listing ID (system): {listing.id}</p>
              <p className="text-[11px] text-zinc-600">Listing status: {listing.status}</p>
              <p className="text-[11px] text-zinc-600">
                Listing agreement type: <span className="text-zinc-500">— (agent to select)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Listing date: {new Date(listing.createdAt).toLocaleDateString()}
              </p>
              <p className="text-[11px] text-zinc-600">
                Expiration date: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Service type: <span className="text-zinc-500">— (agent to select)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Auction: <span className="text-zinc-500">— (agent to select)</span>
              </p>
            </div>

            {/* B. Address & Legal */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                B. Address & Legal
              </h3>
              <p className="text-[11px] text-zinc-600">Full address: {addressLine}</p>
              <p className="text-[11px] text-zinc-600">
                Street address: {listing.street}
              </p>
              <p className="text-[11px] text-zinc-600">
                City / State / ZIP: {listing.city}, {listing.state} {listing.postalCode}
              </p>
              <p className="text-[11px] text-zinc-600">
                County: {attomExt.county ?? <span className="text-zinc-500">— (public record – verify)</span>}
              </p>
              <p className="text-[11px] text-zinc-600">
                Subdivision name: {attomExt.subdivision ?? <span className="text-zinc-500">— (public record – verify)</span>}
              </p>
              <p className="text-[11px] text-zinc-600">
                Legal description: {attomExt.legalDescription ?? "— (agent to paste from tax record)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Parcel / Folio ID: {listing.property.parcelId.value ?? "—"} (Public record)
              </p>
              <p className="text-[11px] text-zinc-600">
                Directions / driving instructions: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
            </div>

            {/* C. Property Classification */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                C. Property Classification
              </h3>
              <p className="text-[11px] text-zinc-600">
                Property type: {listing.property.propertyType.value ?? "—"} (Public record)
              </p>
              <p className="text-[11px] text-zinc-600">
                Property subtype: <span className="text-zinc-500">— (agent to select)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Ownership: <span className="text-zinc-500">— (Fee Simple / Leasehold)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Zoning: {attomExt.zoning ?? "— (agent to enter)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Total sq ft: {attomExt.totalSquareFeet ?? "— (agent to confirm)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Stories / levels: {attomExt.stories ?? "— (agent to enter)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Builder name: <span className="text-zinc-500">— (if applicable)</span>
              </p>
            </div>

            {/* D. Physical Characteristics */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                D. Physical Characteristics
              </h3>
              <p className="text-[11px] text-zinc-600">
                Bedrooms: {listing.property.beds.value ?? "—"} (Agent confirmed)
              </p>
              <p className="text-[11px] text-zinc-600">
                Bathrooms (total): {listing.property.baths.value ?? "—"} (Public record)
              </p>
              <p className="text-[11px] text-zinc-600">
                Bathrooms (full / half): <span className="text-zinc-500">— (agent to break out)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Living area (heated): {listing.property.squareFeet.value ?? "—"} sq ft (Public record)
              </p>
              <p className="text-[11px] text-zinc-600">
                Total sq ft: <span className="text-zinc-500">— (agent to confirm)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Lot size: {listing.property.lotSizeSqFt.value ?? "—"} sq ft (Public record)
              </p>
              <p className="text-[11px] text-zinc-600">
                Stories / levels: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Ceiling height: <span className="text-zinc-500">— (if applicable)</span>
              </p>
            </div>

            {/* E. Interior Features */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">E. Interior Features</h3>
              <p className="text-[11px] text-zinc-600">
                Flooring types: {answers.flooring || "— (from smart question)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Interior features: {answers.key_upgrades || "— (walk-in closets, upgrades, etc.)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Appliances included: {answers.appliances || "— (from smart question)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Laundry features: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Window features: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Fireplace: <span className="text-zinc-500">— (Yes/No + type)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Accessibility features: <span className="text-zinc-500">— (if any)</span>
              </p>
            </div>

            {/* F. Exterior Features */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">F. Exterior Features</h3>
              <p className="text-[11px] text-zinc-600">
                Roof type: {answers.roof_type_age || "— (from smart question)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Construction materials: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Foundation type: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Exterior features: {answers.pool_waterfront_garage || "— (lanai, pool, fence, etc.)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Pool / waterfront / view: {answers.pool_waterfront_garage || "— (from smart question)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Lot features: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Parking / garage / carport: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
            </div>

            {/* G. Utilities & Systems */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">G. Utilities & Systems</h3>
              <p className="text-[11px] text-zinc-600">
                Heating / cooling: {answers.hvac_type_age || "— (from smart question)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Water / sewer: {answers.water_sewer || "— (from smart question)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Utilities included: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Electric provider / gas: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
            </div>

            {/* H. HOA / Community Information */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                H. HOA / Community Information
              </h3>
              <p className="text-[11px] text-zinc-600">
                HOA / condo summary: {answers.hoa_fees_amenities || "— (fees & amenities from smart question)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                HOA exists / name: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                HOA fee amount / frequency: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                CDD / condo association: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                HOA restrictions / approval: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
            </div>

            {/* I. Financial & Tax Info */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                I. Financial & Tax Info
              </h3>
              <p className="text-[11px] text-zinc-600">
                List price: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Price per sq ft: <span className="text-zinc-500">— (agent to calculate)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Annual taxes: {listing.property.annualTaxes.value ?? "—"} (Public record)
              </p>
              <p className="text-[11px] text-zinc-600">
                Tax year: {attomExt.taxYear ?? "— (agent to confirm)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                CDD fees / special assessments: <span className="text-zinc-500">— (agent to enter; check tax bill)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Homestead exemption: {attomExt.homesteadExemption ?? "— (Yes/No)"}
              </p>
            </div>

            {/* J. Location & Area */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">J. Location & Area</h3>
              <p className="text-[11px] text-zinc-600">
                Flood zone / FEMA panel: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Schools (elem/middle/high): <span className="text-zinc-500">— (agent to enter)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Township / community name: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
            </div>

            {/* K. Listing Description & Marketing */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                K. Listing Description & Marketing
              </h3>
              <p className="text-[11px] text-zinc-600">
                Public remarks: {ai?.mlsPublicRemarks.standard || "— (see MLS Copy tab)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Private remarks: {ai?.mlsPrivateRemarks || "— (see MLS Copy tab)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Additional features / bullets: <span className="text-zinc-500">— (see MLS Copy tab)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Showing instructions: {answers.showing_instructions || "— (from smart question)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Showing restrictions / lockbox: <span className="text-zinc-500">— (agent to enter)</span>
              </p>
            </div>

            {/* L. Agent & Brokerage Info */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                L. Agent & Brokerage Info
              </h3>
              <p className="text-[11px] text-zinc-600">
                List agent name: {agentBranding?.name || "— (agent profile)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Broker name: {agentBranding?.brokerage || "— (agent profile)"}
              </p>
              <p className="text-[11px] text-zinc-600">
                Contact info: {(agentBranding?.phone || "").trim() || (agentBranding?.email || "— (agent profile)")}
              </p>
              <p className="text-[11px] text-zinc-600">
                Co-listing agent: <span className="text-zinc-500">— (optional)</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {activeTab === "disclosures" && (
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-zinc-800">Florida disclosures</h2>
            <span className="text-[10px] text-zinc-500">
              Seller/agent-provided; ListingLaunchAI does not provide legal advice
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Occupancy status
              </label>
              <select
                value={disclosures.metadata.occupancyStatus ?? ""}
                onChange={(e) =>
                  setDisclosures((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      metadata: {
                        ...prev.metadata,
                        occupancyStatus: (e.target.value || null) as any,
                      },
                    };
                  })
                }
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              >
                <option value="">Select…</option>
                <option value="owner">Owner-occupied</option>
                <option value="tenant">Tenant-occupied</option>
                <option value="vacant">Vacant</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                HOA / Condo presence
              </label>
              <select
                value={disclosures.metadata.hoaOrCondo ?? ""}
                onChange={(e) =>
                  setDisclosures((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      metadata: {
                        ...prev.metadata,
                        hoaOrCondo: (e.target.value || null) as any,
                      },
                    };
                  })
                }
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              >
                <option value="">Select…</option>
                <option value="none">No HOA / Condo</option>
                <option value="hoa">HOA only</option>
                <option value="condo">Condo association</option>
                <option value="both">Both HOA and Condo</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Seller type
              </label>
              <select
                value={disclosures.metadata.sellerType ?? ""}
                onChange={(e) =>
                  setDisclosures((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      metadata: {
                        ...prev.metadata,
                        sellerType: (e.target.value || null) as any,
                      },
                    };
                  })
                }
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              >
                <option value="">Select…</option>
                <option value="individual">Individual</option>
                <option value="estate">Estate</option>
                <option value="trust">Trust</option>
                <option value="llc">LLC / Company</option>
              </select>
            </div>
          </div>

          <div className="mt-2 space-y-2 max-h-80 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            {questions.map((q) => {
              const current = disclosures.answers[q.id] ?? "";
              const set = (value: DisclosureAnswer) => {
                setDisclosures((prev) => {
                  if (!prev) return prev;
                  return updateDisclosureAnswer(prev, q.id, value as DisclosureAnswer);
                });
              };
              return (
                <div key={q.id} className="space-y-1">
                  <div className="text-[11px] font-medium text-zinc-700">
                    {q.label}
                  </div>
                  {q.helper && (
                    <p className="text-[10px] text-zinc-500">{q.helper}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-[11px] text-zinc-700">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name={q.id}
                        checked={current === "yes"}
                        onChange={() => set("yes")}
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name={q.id}
                        checked={current === "no"}
                        onChange={() => set("no")}
                      />
                      <span>No</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name={q.id}
                        checked={current === "unknown"}
                        onChange={() => set("unknown")}
                      />
                      <span>Unknown</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {disclosuresError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {disclosuresError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDisclosures}
              disabled={disclosuresSaving}
              className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {disclosuresSaving ? "Saving…" : "Save disclosure answers"}
            </button>
            {disclosuresSavedOnce && !disclosuresSaving && !disclosuresError && (
              <span className="text-[11px] text-emerald-600">
                Disclosures saved. Use these answers to prepare formal forms.
              </span>
            )}
          </div>

          <p className="mt-2 text-[10px] text-zinc-500">
            This section stores seller-provided responses only. ListingLaunchAI
            does not provide legal advice. Agent and seller must review all
            disclosures prior to execution.
          </p>
        </section>
      )}
    </div>
  );
}
