"use client";

import { useEffect, useState } from "react";
import type { DisclosureAnswer, Listing, MortgagePartnerProfile } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createEmptyDisclosures,
  packagesForQuestion,
  updateDisclosureAnswer,
} from "@/lib/disclosures_fl";
import { deriveExtendedFieldsFromRaw } from "@/lib/estated";
import { countyFromZip } from "@/lib/fl-zip-county";
import { SMART_QUESTIONS, type QuestionCategory } from "@/lib/questions";

interface Props {
  listingId: string;
}

type Step = "property" | "questions" | "copy" | "fields" | "disclosures";

const STEPS: { id: Step; label: string; short: string }[] = [
  { id: "property", label: "Review Property Data", short: "Property" },
  { id: "questions", label: "Answer Smart Questions", short: "Questions" },
  { id: "copy", label: "Generate MLS Copy", short: "MLS Copy" },
  { id: "fields", label: "Review & Copy Fields", short: "Fields" },
  { id: "disclosures", label: "FL Disclosures", short: "Disclosures" },
];

function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus("copied");
          setTimeout(() => setStatus("idle"), 1500);
        } catch { setStatus("idle"); }
      }}
      className="shrink-0 rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100"
    >
      {status === "copied" ? "Copied" : "Copy"}
    </button>
  );
}

function EditableField({
  label,
  value,
  answerId,
  fallback,
  onSave,
}: {
  label: string;
  value: string | null | undefined;
  answerId: string;
  fallback?: string | null;
  onSave: (id: string, val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? fallback ?? "");
  const display = value || fallback || null;

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-zinc-600">
        <span className="shrink-0 text-xs text-zinc-500">{label}:</span>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSave(answerId, draft); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
        />
        <button
          type="button"
          onClick={() => { onSave(answerId, draft); setEditing(false); }}
          className="rounded-lg bg-zinc-900 px-2 py-0.5 text-xs text-white hover:bg-zinc-800"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-sm">
      <span className="text-zinc-700">
        <span className="text-xs text-zinc-500">{label}:</span>{" "}
        {display ?? <span className="text-zinc-400">—</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {display && <CopyButton text={display} />}
        <button
          type="button"
          onClick={() => { setDraft(display ?? ""); setEditing(true); }}
          className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100"
        >
          Edit
        </button>
      </span>
    </div>
  );
}

export function GuidedWorkspace({ listingId }: Props) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<Step>("property");

  // Disclosures
  const [disclosures, setDisclosures] = useState<ReturnType<typeof createEmptyDisclosures> | null>(null);
  const [disclosuresSaving, setDisclosuresSaving] = useState(false);
  const [disclosuresError, setDisclosuresError] = useState<string | null>(null);
  const [disclosuresSaved, setDisclosuresSaved] = useState(false);

  // AI generation
  const [regenStatus, setRegenStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [regenError, setRegenError] = useState<string | null>(null);

  // Field save
  const [fieldSaveStatus, setFieldSaveStatus] = useState<string | null>(null);

  // Re-lookup
  const [relookupLoading, setRelookupLoading] = useState(false);
  const [relookupError, setRelookupError] = useState<string | null>(null);
  const [relookupDone, setRelookupDone] = useState(false);

  // Smart question answers (local edits before save)
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [answersSaving, setAnswersSaving] = useState(false);
  const [answersSaved, setAnswersSaved] = useState(false);

  useEffect(() => {
    loadWorkspace();
  }, [listingId]);

  async function loadWorkspace() {
    setLoading(true);
    setLoadError(null);
    try {
      let idForFetch = listingId;
      if (typeof window !== "undefined") {
        const segments = window.location.pathname.split("/").filter(Boolean);
        const last = segments[segments.length - 1];
        if (last) idForFetch = last;
      }

      const res = await fetch(`/api/listings/${idForFetch}/workspace`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Could not load listing");
      }

      const json = (await res.json()) as { listing: any };
      const row = json.listing;

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
        archived: row.archived,
        photos: row.photos ?? null,
        estatedRaw: row.estated_raw,
        property: row.property,
        branding: row.branding,
        aiContent: row.ai_content,
        wizardAnswers: row.wizard_answers,
        disclosures: row.disclosures,
      };

      setListing(loaded);
      setLocalAnswers((loaded.wizardAnswers ?? {}) as Record<string, string>);

      const initial =
        loaded.disclosures ??
        createEmptyDisclosures({
          propertyType: loaded.property.propertyType.value,
          yearBuilt: loaded.property.yearBuilt.value,
        });
      setDisclosures(initial);
    } catch (err: any) {
      setLoadError(err?.message ?? "Failed to load listing");
    } finally {
      setLoading(false);
    }
  }

  // Save a single field inline
  async function handleSaveField(answerId: string, value: string) {
    if (!listing) return;
    setFieldSaveStatus(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const current = (listing.wizardAnswers ?? {}) as Record<string, string>;
      const updated = { ...current, [answerId]: value };
      const { error } = await supabase
        .from("listings")
        .update({ wizard_answers: updated })
        .eq("id", listing.id);
      if (error) throw error;
      setListing((prev) => prev ? ({ ...prev, wizardAnswers: updated } as Listing) : prev);
      setLocalAnswers(updated);
      setFieldSaveStatus("Saved");
      setTimeout(() => setFieldSaveStatus(null), 2000);
    } catch (err: any) {
      setFieldSaveStatus(`Error: ${err?.message}`);
    }
  }

  // Batch save smart question answers
  async function handleSaveAnswers() {
    if (!listing) return;
    setAnswersSaving(true);
    setAnswersSaved(false);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("listings")
        .update({ wizard_answers: localAnswers })
        .eq("id", listing.id);
      if (error) throw error;
      setListing((prev) => prev ? ({ ...prev, wizardAnswers: localAnswers } as Listing) : prev);
      setAnswersSaved(true);
      setTimeout(() => setAnswersSaved(false), 3000);
    } catch (err: any) {
      setFieldSaveStatus(`Error: ${err?.message}`);
    } finally {
      setAnswersSaving(false);
    }
  }

  // Re-run ATTOM lookup
  async function handleRelookup() {
    if (!listing) return;
    setRelookupLoading(true);
    setRelookupError(null);
    setRelookupDone(false);
    try {
      const res = await fetch("/api/estated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street: listing.street,
          city: listing.city,
          state: listing.state,
          postalCode: listing.postalCode,
        }),
      });
      if (!res.ok) throw new Error("Property lookup failed");
      const json = await res.json();

      const { deriveSmartWizardDefaultsFromRaw, deriveSchoolsFromRawSchools } =
        await import("@/lib/estated");
      const defaults = deriveSmartWizardDefaultsFromRaw(json.raw);
      const schools = deriveSchoolsFromRawSchools(json.schoolsRaw ?? null);
      if (schools.elementary || schools.middle || schools.high) {
        const parts: string[] = [];
        if (schools.elementary) parts.push(`Elem: ${schools.elementary}`);
        if (schools.middle) parts.push(`Middle: ${schools.middle}`);
        if (schools.high) parts.push(`High: ${schools.high}`);
        defaults.schools_summary = `${parts.join(" | ")} (per ATTOM; buyer to verify).`;
      }

      const current = (listing.wizardAnswers ?? {}) as Record<string, string>;
      const merged: Record<string, string> = { ...defaults };
      for (const [k, v] of Object.entries(current)) {
        if (v) merged[k] = v;
      }

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("listings")
        .update({ estated_raw: json.raw, property: json.snapshot, wizard_answers: merged })
        .eq("id", listing.id);
      if (error) throw error;

      setListing((prev) =>
        prev ? ({ ...prev, estatedRaw: json.raw, property: json.snapshot, wizardAnswers: merged } as Listing) : prev,
      );
      setLocalAnswers(merged);
      setRelookupDone(true);
    } catch (err: any) {
      setRelookupError(err?.message ?? "Re-lookup failed");
    } finally {
      setRelookupLoading(false);
    }
  }

  // Generate AI copy
  async function handleGenerateAi() {
    if (!listing) return;
    setRegenError(null);
    setRegenStatus("pending");
    try {
      const res = await fetch(`/api/listings/${listing.id}/generate-ai`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "AI generation failed");
      }
      const json = (await res.json()) as { aiContent?: any };
      setListing((prev) =>
        prev && json?.aiContent ? ({ ...prev, aiContent: json.aiContent } as Listing) : prev,
      );
      setRegenStatus("done");
    } catch (err: any) {
      setRegenError(err?.message ?? "AI generation failed");
      setRegenStatus("error");
    }
  }

  // Save disclosures
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
      setDisclosuresSaved(true);
      setTimeout(() => setDisclosuresSaved(false), 3000);
    } catch (err: any) {
      setDisclosuresError(err?.message ?? "Could not save disclosures");
    } finally {
      setDisclosuresSaving(false);
    }
  }

  // ─── Loading / error states ───
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-zinc-400">
        Loading workspace…
      </div>
    );
  }

  if (loadError || !listing) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-sm text-red-600">{loadError ?? "Listing not found"}</p>
        <a href="/app" className="mt-4 inline-block text-sm text-zinc-500 underline">
          ← Back to dashboard
        </a>
      </div>
    );
  }

  // ─── Derived data ───
  const addressLine = `${listing.street}, ${listing.city}, ${listing.state} ${listing.postalCode}`;
  const answers = (listing.wizardAnswers ?? {}) as Record<string, string>;
  const ai = listing.aiContent;
  const attomExt = deriveExtendedFieldsFromRaw(listing.estatedRaw ?? null);
  const prop = listing.property;

  const resolvedCounty =
    attomExt.county ||
    (listing.state.toUpperCase() === "FL" ? countyFromZip(listing.postalCode) : null);

  // Step completion
  const stepComplete: Record<Step, boolean> = {
    property: (prop?.beds?.value != null || prop?.squareFeet?.value != null),
    questions: Object.values(answers).filter(Boolean).length >= 5,
    copy: Boolean(ai?.mlsPublicRemarks?.standard),
    fields: Boolean(answers.list_price || answers.directions),
    disclosures: Boolean((listing as any).disclosures),
  };

  const disclosureQuestions = disclosures ? packagesForQuestion(disclosures.metadata) : [];

  // Research links
  const flAppraisers: Record<string, string> = {
    hillsborough: "https://www.hcpafl.org",
    pasco: "https://pascopa.com",
    pinellas: "https://www.pcpao.gov",
    polk: "https://www.polkpa.org",
    hernando: "https://www.hernandocounty.us/departments/departments-a-e/property-appraiser",
    citrus: "https://www.citruspa.org",
    manatee: "https://www.manateepao.com",
    sarasota: "https://www.sc-pa.com",
    orange: "https://www.ocpafl.org",
    seminole: "https://www.scpafl.org",
    lake: "https://www.lakecopropappr.com",
    marion: "https://www.pa.marion.fl.us",
    lee: "https://www.leepa.org",
    collier: "https://www.collierappraiser.com",
    brevard: "https://www.bcpao.us",
    volusia: "https://www.vcgov.org/pa",
    duval: "https://www.coj.net/departments/property-appraiser",
    broward: "https://www.bcpa.net",
    "miami-dade": "https://www.miamidadepa.gov",
    "palm beach": "https://www.pbcgov.org/papa",
    osceola: "https://www.property-appraiser.org",
    charlotte: "https://www.ccappraiser.com",
    alachua: "https://www.acpafl.org",
    leon: "https://www.leonpa.org",
    escambia: "https://www.escpa.org",
    "st. lucie": "https://www.paslc.gov",
    "indian river": "https://www.ircpa.org",
    martin: "https://www.pa.martin.fl.us",
    flagler: "https://www.flaglerpa.com",
    "st. johns": "https://www.sjcpa.us",
    clay: "https://www.ccpao.com",
    nassau: "https://www.nassauflpa.com",
    sumter: "https://www.sumterpa.com",
  };
  const countyKey = (resolvedCounty ?? "").toLowerCase().replace(" county", "").trim();
  const appraiserUrl = flAppraisers[countyKey] ??
    `https://www.google.com/search?q=${encodeURIComponent(addressLine + " property appraiser tax roll")}`;
  const schoolUrl = `https://www.greatschools.org/school-district-boundaries-map/?address=${encodeURIComponent(addressLine)}`;
  const femaUrl = `https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(addressLine)}`;

  // Smart question categories
  const categories: { key: QuestionCategory; label: string }[] = [
    { key: "listing_details", label: "Listing Details" },
    { key: "structure_systems", label: "Structure & Systems" },
    { key: "interior", label: "Interior" },
    { key: "exterior_community", label: "Exterior & Community" },
    { key: "showing_disclosures", label: "Showing & Lockbox" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <div className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <a href="/app" className="text-xs text-zinc-500 hover:text-zinc-700">
              ← Back to My Listings
            </a>
            <h1 className="text-base font-semibold text-zinc-900">{listing.street}</h1>
            <p className="text-xs text-zinc-500">{listing.city}, {listing.state} {listing.postalCode}</p>
          </div>
          <div className="flex items-center gap-2">
            {fieldSaveStatus && (
              <span className={`text-xs ${fieldSaveStatus.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                {fieldSaveStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Sidebar */}
        <nav className="hidden w-56 shrink-0 space-y-1 md:block">
          {STEPS.map((step, i) => {
            const isActive = activeStep === step.id;
            const isDone = stepComplete[step.id];
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    isDone
                      ? isActive ? "bg-emerald-400 text-white" : "bg-emerald-100 text-emerald-700"
                      : isActive ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span>{step.short}</span>
              </button>
            );
          })}

          {/* Research links */}
          <div className="mt-6 space-y-1.5 border-t border-zinc-200 pt-4">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Research Links
            </p>
            <a href={appraiserUrl} target="_blank" rel="noreferrer" className="block px-3 py-1 text-xs text-zinc-500 underline hover:text-zinc-700">
              Property appraiser
            </a>
            <a href={schoolUrl} target="_blank" rel="noreferrer" className="block px-3 py-1 text-xs text-zinc-500 underline hover:text-zinc-700">
              School zone map
            </a>
            <a href={femaUrl} target="_blank" rel="noreferrer" className="block px-3 py-1 text-xs text-zinc-500 underline hover:text-zinc-700">
              FEMA flood map
            </a>
          </div>
        </nav>

        {/* Mobile step selector */}
        <div className="md:hidden mb-4 w-full">
          <select
            value={activeStep}
            onChange={(e) => setActiveStep(e.target.value as Step)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {STEPS.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.label} {stepComplete[s.id] ? "✓" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* ═══ Step 1: Property Data ═══ */}
          {activeStep === "property" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Review Property Data</h2>
                  <p className="text-sm text-zinc-500">
                    Data pulled from public records. Edit anything that's wrong or missing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRelookup}
                  disabled={relookupLoading}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {relookupLoading ? "Refreshing…" : "Refresh data"}
                </button>
              </div>

              {relookupDone && (
                <p className="text-sm text-emerald-600">Property data refreshed.</p>
              )}
              {relookupError && (
                <p className="text-sm text-red-600">{relookupError}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Core facts */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Core Facts</h3>
                  <EditableField label="Bedrooms" value={answers.bedrooms} answerId="bedrooms" fallback={prop?.beds?.value != null ? String(prop.beds.value) : null} onSave={handleSaveField} />
                  <EditableField label="Bathrooms" value={answers.bathrooms_total} answerId="bathrooms_total" fallback={prop?.baths?.value != null ? String(prop.baths.value) : null} onSave={handleSaveField} />
                  <EditableField label="Baths (full/half)" value={answers.bathrooms_full_half} answerId="bathrooms_full_half" onSave={handleSaveField} />
                  <EditableField label="Living area (sqft)" value={answers.living_area_sqft} answerId="living_area_sqft" fallback={prop?.squareFeet?.value != null ? String(prop.squareFeet.value) : null} onSave={handleSaveField} />
                  <EditableField label="Lot size (sqft)" value={answers.lot_size_sqft} answerId="lot_size_sqft" fallback={prop?.lotSizeSqFt?.value != null ? String(prop.lotSizeSqFt.value) : null} onSave={handleSaveField} />
                  <EditableField label="Year built" value={answers.year_built} answerId="year_built" fallback={prop?.yearBuilt?.value != null ? String(prop.yearBuilt.value) : null} onSave={handleSaveField} />
                  <EditableField label="Property type" value={answers.property_subtype} answerId="property_subtype" fallback={prop?.propertyType?.value != null ? String(prop.propertyType.value) : null} onSave={handleSaveField} />
                  <EditableField label="Stories" value={answers.stories} answerId="stories" fallback={attomExt.stories} onSave={handleSaveField} />
                </div>

                {/* Location & legal */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Location & Legal</h3>
                  <div className="flex items-center justify-between text-sm text-zinc-700">
                    <span className="text-xs text-zinc-500">Address:</span>
                    <span className="flex items-center gap-1">{addressLine} <CopyButton text={addressLine} /></span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-zinc-700">
                    <span className="text-xs text-zinc-500">County:</span>
                    <span className="flex items-center gap-1">
                      {resolvedCounty ?? "—"}
                      {resolvedCounty && <CopyButton text={resolvedCounty} />}
                    </span>
                  </div>
                  <EditableField label="Parcel ID" value={answers.parcel_id} answerId="parcel_id" fallback={prop?.parcelId?.value ? String(prop.parcelId.value) : null} onSave={handleSaveField} />
                  <EditableField label="Subdivision" value={answers.subdivision_name} answerId="subdivision_name" fallback={attomExt.subdivision} onSave={handleSaveField} />
                  <EditableField label="Legal description" value={answers.legal_description} answerId="legal_description" fallback={attomExt.legalDescription} onSave={handleSaveField} />
                  <EditableField label="Zoning" value={answers.zoning} answerId="zoning" fallback={attomExt.zoning} onSave={handleSaveField} />
                  <EditableField label="List price" value={answers.list_price} answerId="list_price" onSave={handleSaveField} />
                  <EditableField label="Directions" value={answers.directions} answerId="directions" onSave={handleSaveField} />
                </div>

                {/* Taxes */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Taxes & HOA</h3>
                  <EditableField label="Annual taxes" value={answers.annual_taxes} answerId="annual_taxes" fallback={prop?.annualTaxes?.value != null ? String(prop.annualTaxes.value) : null} onSave={handleSaveField} />
                  <EditableField label="Tax year" value={answers.tax_year} answerId="tax_year" fallback={attomExt.taxYear ? String(attomExt.taxYear) : null} onSave={handleSaveField} />
                  <EditableField label="Homestead" value={answers.homestead_exemption} answerId="homestead_exemption" fallback={attomExt.homesteadExemption} onSave={handleSaveField} />
                  <EditableField label="HOA name" value={answers.hoa_name} answerId="hoa_name" fallback={attomExt.hoaName} onSave={handleSaveField} />
                  <EditableField label="HOA fee" value={answers.hoa_fee_amount} answerId="hoa_fee_amount" fallback={attomExt.hoaFeeAmount != null ? `$${attomExt.hoaFeeAmount}${attomExt.hoaFeeFrequency ? ` (${attomExt.hoaFeeFrequency})` : ""}` : null} onSave={handleSaveField} />
                </div>

                {/* Structure */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Structure</h3>
                  <EditableField label="Roof" value={answers.roof_type_age} answerId="roof_type_age" fallback={attomExt.roofType} onSave={handleSaveField} />
                  <EditableField label="Construction" value={answers.construction_materials} answerId="construction_materials" fallback={attomExt.constructionWallType} onSave={handleSaveField} />
                  <EditableField label="Foundation" value={answers.foundation_type} answerId="foundation_type" fallback={attomExt.foundationType} onSave={handleSaveField} />
                  <EditableField label="Heating/cooling" value={answers.hvac_type_age} answerId="hvac_type_age" onSave={handleSaveField} />
                  <EditableField label="Water/sewer" value={answers.water_sewer} answerId="water_sewer" onSave={handleSaveField} />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveStep("questions")}
                  className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Next: Smart Questions →
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 2: Smart Questions ═══ */}
          {activeStep === "questions" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Smart Questions</h2>
                <p className="text-sm text-zinc-500">
                  Answer what you know. Skip what you don't — you can come back anytime.
                  {Object.values(localAnswers).filter(Boolean).length > 0 && (
                    <span className="ml-2 font-medium text-zinc-700">
                      ({Object.values(localAnswers).filter(Boolean).length} answered)
                    </span>
                  )}
                </p>
              </div>

              {categories.map(({ key, label }) => {
                const qs = SMART_QUESTIONS.filter((q) => q.category === key);
                if (qs.length === 0) return null;
                return (
                  <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-zinc-800">{label}</h3>
                    <div className="space-y-3">
                      {qs.map((q) => {
                        const val = localAnswers[q.id] ?? "";
                        const selectedSet = new Set(val ? val.split(", ").filter(Boolean) : []);

                        if (q.type === "single_select" && q.options) {
                          return (
                            <div key={q.id} className="space-y-1">
                              <label className="block text-sm font-medium text-zinc-700">{q.label}</label>
                              {q.helper && <p className="text-xs text-zinc-500">{q.helper}</p>}
                              <select
                                value={val}
                                onChange={(e) => setLocalAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                              >
                                <option value="">— Select —</option>
                                {q.options.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        if (q.type === "multi_select" && q.options) {
                          return (
                            <div key={q.id} className="space-y-1">
                              <label className="block text-sm font-medium text-zinc-700">{q.label}</label>
                              {q.helper && <p className="text-xs text-zinc-500">{q.helper}</p>}
                              <div className="flex flex-wrap gap-1.5">
                                {q.options.map((opt) => {
                                  const sel = selectedSet.has(opt);
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => {
                                        const next = new Set(selectedSet);
                                        if (sel) next.delete(opt); else next.add(opt);
                                        setLocalAnswers((prev) => ({ ...prev, [q.id]: Array.from(next).join(", ") }));
                                      }}
                                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                        sel
                                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={q.id} className="space-y-1">
                            <label className="block text-sm font-medium text-zinc-700">{q.label}</label>
                            {q.helper && <p className="text-xs text-zinc-500">{q.helper}</p>}
                            <textarea
                              rows={2}
                              value={val}
                              onChange={(e) => setLocalAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep("property")}
                  className="text-sm text-zinc-500 hover:text-zinc-700"
                >
                  ← Property Data
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveAnswers}
                    disabled={answersSaving}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {answersSaving ? "Saving…" : "Save answers"}
                  </button>
                  {answersSaved && <span className="text-sm text-emerald-600">Saved!</span>}
                  <button
                    type="button"
                    onClick={() => { handleSaveAnswers(); setActiveStep("copy"); }}
                    className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Next: Generate Copy →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Step 3: MLS Copy ═══ */}
          {activeStep === "copy" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">MLS Copy</h2>
                  <p className="text-sm text-zinc-500">
                    AI-generated remarks and feature bullets. Copy them into Stellar MLS.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={regenStatus === "pending"}
                  className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {regenStatus === "pending" ? "Generating…" : ai ? "Regenerate" : "Generate copy"}
                </button>
              </div>

              {regenStatus === "done" && (
                <p className="text-sm text-emerald-600">AI copy generated successfully.</p>
              )}
              {regenError && <p className="text-sm text-red-600">{regenError}</p>}

              {!ai && regenStatus !== "pending" && (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-12 text-center">
                  <p className="text-sm text-zinc-500">
                    Click "Generate copy" above to create MLS remarks and feature bullets.
                  </p>
                </div>
              )}

              {ai && (
                <div className="space-y-4">
                  {/* Public remarks */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-zinc-800">Public Remarks</h3>
                      {ai.mlsPublicRemarks?.standard && (
                        <CopyButton text={ai.mlsPublicRemarks.standard} />
                      )}
                    </div>
                    {(["standard", "lifestyle", "investor"] as const).map((style) => {
                      const text = ai.mlsPublicRemarks?.[style] ?? "";
                      if (!text) return null;
                      return (
                        <div key={style} className="mb-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-medium capitalize text-zinc-600">{style}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-zinc-400">{text.length} chars</span>
                              <CopyButton text={text} />
                            </div>
                          </div>
                          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{text}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Private remarks */}
                  {ai.mlsPrivateRemarks && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-800">Private Remarks</h3>
                        <CopyButton text={ai.mlsPrivateRemarks} />
                      </div>
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap">{ai.mlsPrivateRemarks}</p>
                    </div>
                  )}

                  {/* Feature bullets */}
                  {(ai.featureBulletsInterior?.length > 0 || ai.featureBulletsExterior?.length > 0 || ai.featureBulletsCommunity?.length > 0) && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                      <h3 className="mb-2 text-sm font-semibold text-zinc-800">Feature Bullets</h3>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {([
                          { key: "featureBulletsInterior" as const, label: "Interior" },
                          { key: "featureBulletsExterior" as const, label: "Exterior" },
                          { key: "featureBulletsCommunity" as const, label: "Community" },
                        ]).map(({ key, label }) => {
                          const bullets = ai[key];
                          if (!bullets || bullets.length === 0) return null;
                          const text = bullets.join("\n");
                          return (
                            <div key={key} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-medium text-zinc-600">{label}</span>
                                <CopyButton text={text} />
                              </div>
                              <ul className="space-y-0.5 text-sm text-zinc-700">
                                {bullets.map((b: string, i: number) => (
                                  <li key={i}>• {b}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Social captions */}
                  {(ai.socialInstagram || ai.socialFacebook || ai.socialLinkedIn || ai.socialOpenHouse) && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                      <h3 className="mb-2 text-sm font-semibold text-zinc-800">Social Captions</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          { key: "socialInstagram" as const, label: "Instagram" },
                          { key: "socialFacebook" as const, label: "Facebook" },
                          { key: "socialLinkedIn" as const, label: "LinkedIn" },
                          { key: "socialOpenHouse" as const, label: "Open House" },
                        ]).map(({ key, label }) => {
                          const text = ai[key];
                          if (!text) return null;
                          return (
                            <div key={key} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-medium text-zinc-600">{label}</span>
                                <CopyButton text={text} />
                              </div>
                              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{text}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep("questions")}
                  className="text-sm text-zinc-500 hover:text-zinc-700"
                >
                  ← Smart Questions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep("fields")}
                  className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Next: MLS Fields →
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 4: MLS Fields ═══ */}
          {activeStep === "fields" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">MLS Fields</h2>
                <p className="text-sm text-zinc-500">
                  All the fields you need for Stellar MLS. Click Copy to grab any value, or Edit to change it.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Listing Info */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Listing Info</h3>
                  <EditableField label="Agreement type" value={answers.listing_agreement_type} answerId="listing_agreement_type" onSave={handleSaveField} />
                  <EditableField label="Ownership" value={answers.ownership_type} answerId="ownership_type" onSave={handleSaveField} />
                  <EditableField label="Expiration date" value={answers.expiration_date} answerId="expiration_date" onSave={handleSaveField} />
                  <EditableField label="Service type" value={answers.service_type} answerId="service_type" onSave={handleSaveField} />
                </div>

                {/* Interior */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Interior</h3>
                  <EditableField label="Flooring" value={answers.flooring} answerId="flooring" onSave={handleSaveField} />
                  <EditableField label="Appliances" value={answers.appliances} answerId="appliances" onSave={handleSaveField} />
                  <EditableField label="Interior features" value={answers.interior_features} answerId="interior_features" onSave={handleSaveField} />
                  <EditableField label="Laundry" value={answers.laundry_features} answerId="laundry_features" onSave={handleSaveField} />
                  <EditableField label="Windows" value={answers.window_features} answerId="window_features" onSave={handleSaveField} />
                  <EditableField label="Fireplace" value={answers.fireplace} answerId="fireplace" fallback={attomExt.fireplaceType} onSave={handleSaveField} />
                  <EditableField label="Key upgrades" value={answers.key_upgrades} answerId="key_upgrades" onSave={handleSaveField} />
                </div>

                {/* Exterior */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Exterior</h3>
                  <EditableField label="Exterior features" value={answers.exterior_features} answerId="exterior_features" onSave={handleSaveField} />
                  <EditableField label="Pool/waterfront" value={answers.pool_waterfront_garage} answerId="pool_waterfront_garage" fallback={attomExt.poolType} onSave={handleSaveField} />
                  <EditableField label="Lot features" value={answers.lot_features} answerId="lot_features" fallback={attomExt.lotFeatures} onSave={handleSaveField} />
                  <EditableField label="Parking/garage" value={answers.parking_garage} answerId="parking_garage" fallback={attomExt.parkingType} onSave={handleSaveField} />
                </div>

                {/* Utilities */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Utilities</h3>
                  <EditableField label="Water heater" value={answers.water_heater} answerId="water_heater" onSave={handleSaveField} />
                  <EditableField label="Electric/gas" value={answers.electric_provider} answerId="electric_provider" onSave={handleSaveField} />
                </div>

                {/* Community */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Community</h3>
                  <EditableField label="HOA restrictions" value={answers.hoa_restrictions} answerId="hoa_restrictions" onSave={handleSaveField} />
                  <EditableField label="Community amenities" value={answers.community_amenities} answerId="community_amenities" onSave={handleSaveField} />
                  <EditableField label="Schools" value={answers.schools_summary} answerId="schools_summary" onSave={handleSaveField} />
                  <EditableField label="Flood zone" value={answers.flood_zone} answerId="flood_zone" onSave={handleSaveField} />
                </div>

                {/* Showing */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-800">Showing & Access</h3>
                  <EditableField label="Showing instructions" value={answers.showing_instructions} answerId="showing_instructions" onSave={handleSaveField} />
                  <EditableField label="Lockbox" value={answers.lockbox_type} answerId="lockbox_type" onSave={handleSaveField} />
                  <EditableField label="Occupancy" value={answers.occupancy_status} answerId="occupancy_status" fallback={attomExt.absenteeOwner} onSave={handleSaveField} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep("copy")}
                  className="text-sm text-zinc-500 hover:text-zinc-700"
                >
                  ← MLS Copy
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep("disclosures")}
                  className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Next: Disclosures →
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 5: Disclosures ═══ */}
          {activeStep === "disclosures" && disclosures && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Florida Disclosures</h2>
                <p className="text-sm text-zinc-500">
                  Answer seller disclosure questions. These are stored for your records only — not legal advice.
                  {disclosureQuestions.length > 0 && (
                    <span className="ml-2 font-medium text-zinc-700">
                      ({disclosureQuestions.filter((q) => !!disclosures.answers[q.id]).length}/{disclosureQuestions.length} answered)
                    </span>
                  )}
                </p>
              </div>

              {/* Metadata */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-zinc-800">Property Details</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-zinc-500">Occupancy</label>
                    <select
                      value={disclosures.metadata.occupancyStatus ?? ""}
                      onChange={(e) => setDisclosures((prev) => prev ? { ...prev, metadata: { ...prev.metadata, occupancyStatus: (e.target.value || null) as any } } : prev)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select…</option>
                      <option value="owner">Owner occupied</option>
                      <option value="tenant">Tenant occupied</option>
                      <option value="vacant">Vacant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500">HOA / Condo</label>
                    <select
                      value={disclosures.metadata.hoaOrCondo ?? ""}
                      onChange={(e) => setDisclosures((prev) => prev ? { ...prev, metadata: { ...prev.metadata, hoaOrCondo: (e.target.value || null) as any } } : prev)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select…</option>
                      <option value="none">None</option>
                      <option value="hoa">HOA only</option>
                      <option value="condo">Condo</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500">Seller type</label>
                    <select
                      value={disclosures.metadata.sellerType ?? ""}
                      onChange={(e) => setDisclosures((prev) => prev ? { ...prev, metadata: { ...prev.metadata, sellerType: (e.target.value || null) as any } } : prev)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select…</option>
                      <option value="individual">Individual</option>
                      <option value="estate">Estate</option>
                      <option value="trust">Trust</option>
                      <option value="llc">LLC / Company</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-2">
                {disclosureQuestions.map((q) => {
                  const current = disclosures.answers[q.id] ?? "";
                  const unanswered = !current;
                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl border p-4 ${
                        unanswered ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-zinc-800">{q.label}</p>
                        {unanswered && (
                          <span className="text-xs font-medium text-amber-600">Not answered</span>
                        )}
                      </div>
                      {q.helper && <p className="mt-0.5 text-xs text-zinc-500">{q.helper}</p>}
                      <div className="mt-2 flex gap-4">
                        {(["yes", "no", "unknown"] as const).map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 text-sm text-zinc-700">
                            <input
                              type="radio"
                              name={q.id}
                              checked={current === opt}
                              onChange={() => setDisclosures((prev) => prev ? updateDisclosureAnswer(prev, q.id, opt as DisclosureAnswer) : prev)}
                              className="accent-zinc-900"
                            />
                            <span className="capitalize">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {disclosuresError && <p className="text-sm text-red-600">{disclosuresError}</p>}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep("fields")}
                  className="text-sm text-zinc-500 hover:text-zinc-700"
                >
                  ← MLS Fields
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDisclosures}
                    disabled={disclosuresSaving}
                    className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {disclosuresSaving ? "Saving…" : "Save disclosures"}
                  </button>
                  {disclosuresSaved && <span className="text-sm text-emerald-600">Saved!</span>}
                </div>
              </div>

              <p className="text-xs text-zinc-400">
                ListingLaunchAI does not provide legal advice. Agent and seller must review all disclosures prior to execution.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
