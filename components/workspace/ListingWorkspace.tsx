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

interface ListingWorkspaceProps {
  listingId: string;
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
      <div className="flex items-center gap-1 text-[11px] text-zinc-600">
        <span className="shrink-0">{label}:</span>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(answerId, draft);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 rounded border border-zinc-300 px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/40"
        />
        <button
          type="button"
          onClick={() => { onSave(answerId, draft); setEditing(false); }}
          className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-100"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-100"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
      <span>
        {label}: {display ?? <span className="text-zinc-500">—</span>}
      </span>
      <span className="flex items-center gap-1">
        {display && <CopyButton text={display} />}
        <button
          type="button"
          onClick={() => { setDraft(display ?? ""); setEditing(true); }}
          className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-100"
        >
          Edit
        </button>
      </span>
    </p>
  );
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
      className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100"
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

  const [openHouseDetails, setOpenHouseDetails] = useState("");
  const [openHouseSaving, setOpenHouseSaving] = useState(false);
  const [openHouseError, setOpenHouseError] = useState<string | null>(null);
  const [openHouseSaved, setOpenHouseSaved] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [lender, setLender] = useState<MortgagePartnerProfile | null>(null);
  const [lenderSaving, setLenderSaving] = useState(false);
  const [lenderError, setLenderError] = useState<string | null>(null);
  const [lenderHeadshotUploading, setLenderHeadshotUploading] = useState(false);

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

        const openHouse = (loaded.wizardAnswers as any)?.open_house_details ?? "";
        setOpenHouseDetails(openHouse || "");

        const initial =
          loaded.disclosures ??
          createEmptyDisclosures({
            propertyType: loaded.property.propertyType.value,
            yearBuilt: loaded.property.yearBuilt.value,
          });

        setDisclosures(initial);

        const lenderBranding = loaded.branding?.mortgagePartner ?? null;
        setLender(lenderBranding as any);
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
  const totalDisclosureQuestions = questions.length;
  const answeredDisclosureQuestions =
    disclosures && totalDisclosureQuestions > 0
      ? questions.filter((q) => !!disclosures.answers[q.id]).length
      : 0;

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

  const [fieldSaveStatus, setFieldSaveStatus] = useState<string | null>(null);

  async function handleSaveField(answerId: string, value: string) {
    if (!listing) return;
    setFieldSaveStatus(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const currentAnswers = (listing.wizardAnswers ?? {}) as Record<string, string>;
      const updatedAnswers = { ...currentAnswers, [answerId]: value };

      const { error } = await supabase
        .from("listings")
        .update({ wizard_answers: updatedAnswers })
        .eq("id", listing.id);

      if (error) throw error;

      setListing((prev) =>
        prev ? ({ ...prev, wizardAnswers: updatedAnswers } as Listing) : prev,
      );
      setFieldSaveStatus("Saved");
      setTimeout(() => setFieldSaveStatus(null), 2000);
    } catch (err: any) {
      setFieldSaveStatus(`Error: ${err?.message ?? "Save failed"}`);
    }
  }

  const [relookupLoading, setRelookupLoading] = useState(false);
  const [relookupError, setRelookupError] = useState<string | null>(null);
  const [relookupDone, setRelookupDone] = useState(false);

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

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Property lookup failed");
      }

      const json = (await res.json()) as {
        snapshot: any;
        raw: unknown;
        schoolsRaw: unknown | null;
        warnings: string[];
      };

      // Import the deriver dynamically to avoid circular issues
      const { deriveSmartWizardDefaultsFromRaw, deriveSchoolsFromRawSchools } =
        await import("@/lib/estated");

      const defaults = deriveSmartWizardDefaultsFromRaw(json.raw);

      const schoolSummary = deriveSchoolsFromRawSchools(json.schoolsRaw ?? null);
      if (schoolSummary.elementary || schoolSummary.middle || schoolSummary.high) {
        const parts: string[] = [];
        if (schoolSummary.elementary) parts.push(`Elem: ${schoolSummary.elementary}`);
        if (schoolSummary.middle) parts.push(`Middle: ${schoolSummary.middle}`);
        if (schoolSummary.high) parts.push(`High: ${schoolSummary.high}`);
        defaults.schools_summary = `${parts.join(" | ")} (per ATTOM schools; buyer to verify with district).`;
      }

      // Merge: keep existing answers, backfill new ones from ATTOM
      const currentAnswers = (listing.wizardAnswers ?? {}) as Record<string, string>;
      const merged: Record<string, string> = { ...defaults };
      for (const [k, v] of Object.entries(currentAnswers)) {
        if (v) merged[k] = v; // agent's existing answers take priority
      }

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("listings")
        .update({
          estated_raw: json.raw,
          property: json.snapshot,
          wizard_answers: merged,
        })
        .eq("id", listing.id);

      if (error) throw error;

      setListing((prev) =>
        prev
          ? ({
              ...prev,
              estatedRaw: json.raw,
              property: json.snapshot,
              wizardAnswers: merged,
            } as Listing)
          : prev,
      );
      setRelookupDone(true);
    } catch (err: any) {
      setRelookupError(err?.message ?? "Re-lookup failed");
    } finally {
      setRelookupLoading(false);
    }
  }

  async function handleSaveOpenHouseDetails() {
    if (!listing) return;
    setOpenHouseError(null);
    setOpenHouseSaving(true);
    setOpenHouseSaved(false);
    try {
      const supabase = getSupabaseBrowserClient();
      const currentAnswers = (listing.wizardAnswers ?? {}) as Record<string, string>;
      const updatedAnswers: Record<string, string> = { ...currentAnswers };

      const trimmed = openHouseDetails.trim();
      if (trimmed) {
        (updatedAnswers as any).open_house_details = trimmed;
      } else {
        delete (updatedAnswers as any).open_house_details;
      }

      const { error } = await supabase
        .from("listings")
        .update({ wizard_answers: updatedAnswers })
        .eq("id", listing.id);

      if (error) throw error;

      setListing((prev) =>
        prev
          ? ({
              ...prev,
              wizardAnswers: updatedAnswers,
            } as Listing)
          : prev,
      );

      setOpenHouseSaved(true);
      setTimeout(() => setOpenHouseSaved(false), 2000);
    } catch (err: any) {
      setOpenHouseError(err?.message ?? "Could not save open house details");
    } finally {
      setOpenHouseSaving(false);
    }
  }

  async function handlePhotoUpload(e: any) {
    if (!listing) return;
    const files: FileList | undefined = e.target?.files;
    if (!files || files.length === 0) return;
    setPhotoUploading(true);
    setPhotoError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const currentPhotos = listing.photos ?? [];
      const newUrls: string[] = [];

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `listings/${listing.id}/photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("branding-assets")
          .upload(path, file, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("branding-assets").getPublicUrl(path);

        newUrls.push(publicUrl);
      }

      if (newUrls.length === 0) return;

      const nextPhotos = [...currentPhotos, ...newUrls];

      const { error: updateError } = await supabase
        .from("listings")
        .update({ photos: nextPhotos })
        .eq("id", listing.id);

      if (updateError) throw updateError;

      setListing((prev) =>
        prev ? ({ ...prev, photos: nextPhotos } as Listing) : prev,
      );
    } catch (err: any) {
      setPhotoError(err?.message ?? "Could not upload photo(s)");
    } finally {
      setPhotoUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  }

  async function handleRemovePhoto(url: string) {
    if (!listing) return;
    const nextPhotos = (listing.photos ?? []).filter((p) => p !== url);
    setPhotoError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("listings")
        .update({ photos: nextPhotos })
        .eq("id", listing.id);
      if (error) throw error;
      setListing((prev) =>
        prev ? ({ ...prev, photos: nextPhotos } as Listing) : prev,
      );
    } catch (err: any) {
      setPhotoError(err?.message ?? "Could not remove photo");
    }
  }

  async function handleSaveLender() {
    if (!listing) return;
    setLenderError(null);
    setLenderSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const existingBranding = listing.branding ?? null;

      const cleanedLender: MortgagePartnerProfile | null = lender
        ? {
            ...lender,
            id: lender.id || "temp-lender",
            agentId: listing.agentId,
          }
        : null;

      const updatedBranding = {
        agent: existingBranding?.agent ?? null,
        mortgagePartner: cleanedLender,
      };

      const { error } = await supabase
        .from("listings")
        .update({ branding: updatedBranding })
        .eq("id", listing.id);

      if (error) throw error;

      setListing((prev) =>
        prev
          ? ({
              ...prev,
              branding: updatedBranding,
            } as Listing)
          : prev,
      );
    } catch (err: any) {
      setLenderError(err?.message ?? "Could not save mortgage partner");
    } finally {
      setLenderSaving(false);
    }
  }

  async function handleLenderHeadshotUpload(e: any) {
    if (!listing) return;
    const file: File | undefined = e.target?.files?.[0];
    if (!file) return;
    setLenderHeadshotUploading(true);
    setLenderError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `lenders/${listing.agentId}/${listing.id}/headshot-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("branding-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("branding-assets").getPublicUrl(path);

      const base: MortgagePartnerProfile =
        lender ??
        ({
          id: "temp-lender",
          agentId: listing.agentId,
          name: "",
          company: "",
          nmlsId: "",
          phone: "",
          email: "",
          headshotUrl: null,
          logoUrl: null,
          bio: null,
          bioSource: "ai_generated",
        } as MortgagePartnerProfile);

      const nextLender: MortgagePartnerProfile = {
        ...base,
        agentId: listing.agentId,
        headshotUrl: publicUrl,
      };

      const existingBranding = listing.branding ?? null;
      const updatedBranding = {
        agent: existingBranding?.agent ?? null,
        mortgagePartner: nextLender,
      };

      const { error: updateError } = await supabase
        .from("listings")
        .update({ branding: updatedBranding })
        .eq("id", listing.id);

      if (updateError) throw updateError;

      setLender(nextLender);
      setListing((prev) =>
        prev
          ? ({
              ...prev,
              branding: updatedBranding,
            } as Listing)
          : prev,
      );
    } catch (err: any) {
      setLenderError(err?.message ?? "Could not upload lender headshot");
    } finally {
      setLenderHeadshotUploading(false);
      if (e.target) {
        e.target.value = "";
      }
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
  const standardPublicRemarks = ai?.mlsPublicRemarks?.standard ?? "";
  const privateRemarks = ai?.mlsPrivateRemarks ?? "";
  const allFeaturesText = ai
    ? [
        ...ai.featureBulletsInterior.map((b) => `Interior: ${b}`),
        ...ai.featureBulletsExterior.map((b) => `Exterior: ${b}`),
        ...ai.featureBulletsCommunity.map((b) => `Community: ${b}`),
      ].join("\n")
    : "";

  const addressLine = `${listing.street}, ${listing.city}, ${listing.state} ${listing.postalCode}`;
  const answers = listing.wizardAnswers ?? {};
  const agentBranding = listing.branding?.agent ?? null;

  const attomExt = deriveExtendedFieldsFromRaw(listing.estatedRaw ?? null);

  const mlsChecklist = [
    {
      id: "address",
      label: "Address & legal",
      ready:
        Boolean(listing.street && listing.city && listing.state && listing.postalCode) &&
        Boolean(attomExt.county),
    },
    {
      id: "bedsBaths",
      label: "Beds & baths",
      ready:
        listing.property.beds.value != null && listing.property.baths.value != null,
    },
    {
      id: "sqftLot",
      label: "Sq ft & lot size",
      ready:
        listing.property.squareFeet.value != null &&
        listing.property.lotSizeSqFt.value != null,
    },
    {
      id: "interior",
      label: "Interior features",
      ready: Boolean(answers.interior_features || answers.appliances || answers.flooring),
    },
    {
      id: "exterior",
      label: "Exterior & parking",
      ready: Boolean(answers.exterior_features || answers.parking_garage || attomExt.parkingType),
    },
    {
      id: "construction",
      label: "Construction & roof",
      ready: Boolean(answers.construction_materials || attomExt.constructionWallType || answers.roof_type_age || attomExt.roofType),
    },
    {
      id: "hoa",
      label: "HOA / condo info",
      ready: Boolean(answers.hoa_fees_amenities || answers.hoa_restrictions || attomExt.hoaName || attomExt.hoaFeeAmount != null),
    },
    {
      id: "taxes",
      label: "Taxes & homestead",
      ready:
        listing.property.annualTaxes.value != null &&
        (attomExt.taxYear != null || attomExt.homesteadExemption != null),
    },
    {
      id: "utilities",
      label: "Utilities & systems",
      ready: Boolean(answers.water_sewer || answers.hvac_type_age || answers.electric_provider),
    },
    {
      id: "schools",
      label: "Schools summary",
      ready: Boolean(answers.schools_summary),
    },
    {
      id: "showing",
      label: "Showing & lockbox",
      ready: Boolean(answers.showing_instructions || answers.lockbox_type),
    },
    {
      id: "remarks",
      label: "MLS remarks",
      ready: Boolean(ai?.mlsPublicRemarks?.standard),
    },
  ];

  // Best-effort mapping from ATTOM county to the correct Florida property appraiser site.
  const countyKey = (attomExt.county ?? "")
    .toLowerCase()
    .replace(" county", "")
    .trim();

  const flAppraisers: Record<string, string> = {
    hillsborough: "https://www.hcpafl.org",
    pasco: "https://search.pascopa.com/propertysearch",
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
    palm_beach: "https://www.pbcgov.org/papa",
    "palm beach": "https://www.pbcgov.org/papa",
    osceola: "https://www.property-appraiser.org",
    charlotte: "https://www.ccappraiser.com",
    alachua: "https://www.acpafl.org",
    bay: "https://www.prior.baypa.net",
    leon: "https://www.leonpa.org",
    escambia: "https://www.escpa.org",
    st_lucie: "https://www.paslc.gov",
    "st. lucie": "https://www.paslc.gov",
    indian_river: "https://www.ircpa.org",
    "indian river": "https://www.ircpa.org",
    martin: "https://www.pa.martin.fl.us",
    flagler: "https://www.flaglerpa.com",
    "st. johns": "https://www.sjcpa.us",
    st_johns: "https://www.sjcpa.us",
    clay: "https://www.ccpao.com",
    nassau: "https://www.nassauflpa.com",
    sumter: "https://www.sumterpa.com",
  };

  const parcelId = listing.property.parcelId.value
    ? String(listing.property.parcelId.value)
    : "";

  const propertyAppraiserUrl =
    listing.state.toUpperCase() === "FL" && countyKey && flAppraisers[countyKey]
      ? flAppraisers[countyKey]
      : `https://www.google.com/search?q=${encodeURIComponent(
          (parcelId ? `parcel ${parcelId} ` : "") + addressLine + " property appraiser tax roll",
        )}`;

  const schoolZoneUrl = `https://www.greatschools.org/school-district-boundaries-map/?address=${encodeURIComponent(addressLine)}`;

  const femaUrl = `https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(addressLine)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Listing workspace</h1>
          <p className="text-xs text-zinc-500">{addressLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/app"
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            ← Back to dashboard
          </a>
          <a
            href={`/listing/${listing.slug}`}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            View public hub
          </a>
        </div>
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
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">
                  Copy into Stellar MLS (public remarks)
                </span>
                {standardPublicRemarks && <CopyButton text={standardPublicRemarks} />}
              </div>
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
                      {text && (
                        <div className="text-[10px] text-zinc-500">
                          {text.length.toLocaleString()} characters
                        </div>
                      )}
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
              {privateRemarks && <CopyButton text={privateRemarks} />}
            </div>
            <p className="text-[11px] text-zinc-700 whitespace-pre-wrap">
              {privateRemarks || "Not generated"}
            </p>

            {privateRemarks && (
              <div className="mt-1 text-[10px] text-zinc-500">
                {privateRemarks.length.toLocaleString()} characters
              </div>
            )}

            <div className="mt-3 space-y-1 text-[11px] text-zinc-500">
              <p>
                Use this section for showing instructions and material facts.
                Avoid marketing language that belongs in public remarks.
              </p>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-800">Feature bullets</h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">
                  Interior / exterior / community
                </span>
                {allFeaturesText && <CopyButton text={allFeaturesText} />}
              </div>
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
              <span className="text-[11px] text-zinc-500">
                Instagram / Facebook / LinkedIn / Open house
              </span>
            </div>

            <div className="space-y-2">
              {[
                ["Instagram", ai.socialInstagram],
                ["Facebook", ai.socialFacebook],
                ["LinkedIn", ai.socialLinkedIn],
                ["Open house", ai.socialOpenHouse],
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

          <section className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-800">Open house details</h2>
              <span className="text-[11px] text-zinc-500">
                Optional line shown on the open house flyer
              </span>
            </div>

            <p className="text-[11px] text-zinc-600">
              Example: <span className="italic">Saturday, Feb 3, 1:00–4:00 PM</span>
            </p>

            <textarea
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-800 focus:border-black focus:outline-none"
              rows={2}
              value={openHouseDetails}
              onChange={(e) => setOpenHouseDetails(e.target.value)}
              placeholder="Add open house date/time (optional)"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveOpenHouseDetails}
                disabled={openHouseSaving}
                className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {openHouseSaving ? "Saving…" : "Save open house details"}
              </button>
              {openHouseSaved && !openHouseError && (
                <span className="text-[11px] text-emerald-600">
                  Saved.
                </span>
              )}
            </div>

            {openHouseError && (
              <p className="text-[11px] text-red-600">{openHouseError}</p>
            )}
          </section>

          <section className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-800">Property photos</h2>
              <span className="text-[11px] text-zinc-500">
                Used on the open house flyer (first 3 photos)
              </span>
            </div>

            <p className="text-[11px] text-zinc-600">
              Upload a few of your best listing photos. The first three will be
              shown on the flyer.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-zinc-300 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={photoUploading}
                />
                {photoUploading ? "Uploading…" : "Upload photos"}
              </label>

              {photoError && (
                <span className="text-[11px] text-red-600">{photoError}</span>
              )}
            </div>

            {listing.photos && listing.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {listing.photos.map((url) => (
                  <div
                    key={url}
                    className="flex flex-col items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1"
                  >
                    <img
                      src={url}
                      alt="Listing"
                      className="h-20 w-28 rounded object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(url)}
                      className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-800">
                Mortgage partner (optional co-branding)
              </h2>
              <span className="text-[11px] text-zinc-500">
                Shown on co-branded flyer version only
              </span>
            </div>

            <p className="text-[11px] text-zinc-600">
              Leave blank if you don&apos;t want a lender on this listing. To show
              a co-branded flyer, fill in at least name, company, and NMLS.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-zinc-700">
                  Lender details
                </div>
                <input
                  placeholder="Name"
                  value={lender?.name ?? ""}
                  onChange={(e) =>
                    setLender((prev) => ({
                      ...(prev ?? ({
                        id: "temp-lender",
                        agentId: listing.agentId,
                        name: "",
                        company: "",
                        nmlsId: "",
                        phone: "",
                        email: "",
                        headshotUrl: null,
                        logoUrl: null,
                        bio: null,
                        bioSource: "ai_generated",
                      } as MortgagePartnerProfile)),
                      name: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
                />
                <input
                  placeholder="Company"
                  value={lender?.company ?? ""}
                  onChange={(e) =>
                    setLender((prev) => ({
                      ...(prev as MortgagePartnerProfile),
                      company: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
                />
                <input
                  placeholder="NMLS ID"
                  value={lender?.nmlsId ?? ""}
                  onChange={(e) =>
                    setLender((prev) => ({
                      ...(prev as MortgagePartnerProfile),
                      nmlsId: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-medium text-zinc-700">
                  Contact & headshot
                </div>
                <input
                  placeholder="Phone"
                  value={lender?.phone ?? ""}
                  onChange={(e) =>
                    setLender((prev) => ({
                      ...(prev as MortgagePartnerProfile),
                      phone: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
                />
                <input
                  placeholder="Email"
                  value={lender?.email ?? ""}
                  onChange={(e) =>
                    setLender((prev) => ({
                      ...(prev as MortgagePartnerProfile),
                      email: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    placeholder="Headshot URL (optional)"
                    value={lender?.headshotUrl ?? ""}
                    onChange={(e) =>
                      setLender((prev) => ({
                        ...(prev as MortgagePartnerProfile),
                        headshotUrl: e.target.value || null,
                      }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px] md:flex-1"
                  />
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100">
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleLenderHeadshotUpload}
                      className="hidden"
                      disabled={lenderHeadshotUploading}
                    />
                    {lenderHeadshotUploading ? "Uploading…" : "Upload"}
                  </label>
                  {lender?.headshotUrl && (
                    <img
                      src={lender.headshotUrl}
                      alt="Lender headshot"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveLender}
                disabled={lenderSaving}
                className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {lenderSaving ? "Saving…" : "Save mortgage partner"}
              </button>
              {lenderError && (
                <span className="text-[11px] text-red-600">{lenderError}</span>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === "mls" && (
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-zinc-800">Stellar MLS fields</h2>
            <span className="text-[11px] text-zinc-500">
              Read-only view; fields with a Copy button are ready to paste into Stellar MLS
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
            <a
              href={propertyAppraiserUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              Property appraiser / tax roll
            </a>
            <a
              href={femaUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              FEMA flood map
            </a>
            <a
              href={schoolZoneUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              School zone map (GreatSchools)
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRelookup}
              disabled={relookupLoading}
              className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {relookupLoading ? "Re-running lookup…" : "Re-run property lookup"}
            </button>
            {relookupDone && (
              <span className="text-[11px] text-emerald-600">
                Property data refreshed and new fields backfilled.
              </span>
            )}
            {relookupError && (
              <span className="text-[11px] text-red-600">{relookupError}</span>
            )}
            {fieldSaveStatus && (
              <span className={`text-[11px] ${fieldSaveStatus.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                {fieldSaveStatus}
              </span>
            )}
          </div>

          <p className="text-[11px] text-zinc-500">
            Click Edit on any field to fill in missing data. Re-run property lookup to refresh ATTOM data.
          </p>

          <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-zinc-700">
              Stellar checklist (key areas)
            </div>
            <div className="grid gap-1 text-[11px] md:grid-cols-2 lg:grid-cols-3">
              {mlsChecklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-zinc-600">{item.label}</span>
                  <span
                    className={
                      item.ready
                        ? "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                        : "inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                    }
                  >
                    {item.ready ? "Ready" : "Needs input"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* A. Identification & Status */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                A. Identification & Status
              </h3>
              <p className="text-[11px] text-zinc-600">Listing ID (system): {listing.id}</p>
              <p className="text-[11px] text-zinc-600">Listing status: {listing.status}</p>
              <EditableField label="Listing agreement type" value={answers.listing_agreement_type} answerId="listing_agreement_type" onSave={handleSaveField} />
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
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>Full address: {addressLine}</span>
                <CopyButton text={addressLine} />
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>Street address: {listing.street}</span>
                {listing.street && <CopyButton text={listing.street} />}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  City / State / ZIP: {listing.city}, {listing.state} {listing.postalCode}
                </span>
                {listing.city && listing.state && listing.postalCode && (
                  <CopyButton
                    text={`${listing.city}, ${listing.state} ${listing.postalCode}`}
                  />
                )}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  County: {attomExt.county ? (
                    <>
                      {attomExt.county}{" "}
                      <span className="text-zinc-500">(public record – verify)</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">— (public record – verify)</span>
                  )}
                </span>
                {attomExt.county && <CopyButton text={attomExt.county} />}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  Subdivision name: {attomExt.subdivision ? (
                    <>
                      {attomExt.subdivision}{" "}
                      <span className="text-zinc-500">(public record – verify)</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">— (public record – verify)</span>
                  )}
                </span>
                {attomExt.subdivision && <CopyButton text={attomExt.subdivision} />}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  Legal description: {attomExt.legalDescription ?? "— (agent to paste from tax record)"}
                </span>
                {attomExt.legalDescription && (
                  <CopyButton text={attomExt.legalDescription} />
                )}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  Parcel / Folio ID: {listing.property.parcelId.value ?? "—"} (Public record)
                </span>
                {listing.property.parcelId.value && (
                  <CopyButton text={String(listing.property.parcelId.value)} />
                )}
              </p>
              <EditableField label="Directions" value={answers.directions} answerId="directions" onSave={handleSaveField} />
            </div>

            {/* C. Property Classification */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                C. Property Classification
              </h3>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>Property type: {listing.property.propertyType.value ?? "—"} (Public record)</span>
                {listing.property.propertyType.value && <CopyButton text={String(listing.property.propertyType.value)} />}
              </p>
              <EditableField label="Property subtype" value={answers.property_subtype} answerId="property_subtype" onSave={handleSaveField} />
              <EditableField label="Ownership" value={answers.ownership_type} answerId="ownership_type" onSave={handleSaveField} />
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>Zoning: {attomExt.zoning ?? "— (agent to enter)"}</span>
                {attomExt.zoning && <CopyButton text={attomExt.zoning} />}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>Total sq ft: {attomExt.totalSquareFeet ?? "— (agent to confirm)"}</span>
                {attomExt.totalSquareFeet && <CopyButton text={String(attomExt.totalSquareFeet)} />}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>Stories / levels: {attomExt.stories ?? "— (agent to enter)"}</span>
                {attomExt.stories && <CopyButton text={attomExt.stories} />}
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
                Year built: {listing.property.yearBuilt.value ?? "—"} (Public record)
              </p>
              <p className="text-[11px] text-zinc-600">
                Total sq ft: <span className="text-zinc-500">— (agent to confirm)</span>
              </p>
              <p className="text-[11px] text-zinc-600">
                Lot size: {listing.property.lotSizeSqFt.value ?? "—"} sq ft (Public record)
              </p>
              <p className="text-[11px] text-zinc-600">
                Stories / levels: {attomExt.stories ?? <span className="text-zinc-500">— (agent to enter)</span>}
              </p>
              <p className="text-[11px] text-zinc-600">
                Ceiling height: <span className="text-zinc-500">— (if applicable)</span>
              </p>
            </div>

            {/* E. Interior Features */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">E. Interior Features</h3>
              <EditableField label="Flooring" value={answers.flooring} answerId="flooring" onSave={handleSaveField} />
              <EditableField label="Interior features" value={answers.interior_features} answerId="interior_features" onSave={handleSaveField} />
              <EditableField label="Appliances" value={answers.appliances} answerId="appliances" onSave={handleSaveField} />
              <EditableField label="Laundry" value={answers.laundry_features} answerId="laundry_features" onSave={handleSaveField} />
              <EditableField label="Windows" value={answers.window_features} answerId="window_features" onSave={handleSaveField} />
              <EditableField label="Fireplace" value={answers.fireplace} answerId="fireplace" fallback={attomExt.fireplaceType && !/yes/i.test(attomExt.fireplaceType) ? attomExt.fireplaceType : null} onSave={handleSaveField} />
              <EditableField label="Accessibility" value={answers.accessibility_features} answerId="accessibility_features" onSave={handleSaveField} />
              <EditableField label="Key upgrades" value={answers.key_upgrades} answerId="key_upgrades" onSave={handleSaveField} />
            </div>

            {/* F. Exterior Features */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">F. Exterior Features</h3>
              <EditableField label="Roof" value={answers.roof_type_age} answerId="roof_type_age" fallback={attomExt.roofType ? `${attomExt.roofType} (public record)` : null} onSave={handleSaveField} />
              <EditableField label="Construction" value={answers.construction_materials} answerId="construction_materials" fallback={attomExt.constructionWallType ? `${attomExt.constructionWallType} (public record)` : null} onSave={handleSaveField} />
              <EditableField label="Foundation" value={answers.foundation_type} answerId="foundation_type" fallback={attomExt.foundationType} onSave={handleSaveField} />
              <EditableField label="Exterior features" value={answers.exterior_features} answerId="exterior_features" onSave={handleSaveField} />
              <EditableField label="Pool / waterfront" value={answers.pool_waterfront_garage} answerId="pool_waterfront_garage" fallback={attomExt.poolType ? `${attomExt.poolType} (public record)` : null} onSave={handleSaveField} />
              <EditableField label="Lot features" value={answers.lot_features} answerId="lot_features" fallback={attomExt.lotFeatures} onSave={handleSaveField} />
              <EditableField label="Parking / garage" value={answers.parking_garage} answerId="parking_garage" fallback={attomExt.parkingType ? `${attomExt.parkingType}${attomExt.parkingSpaces != null ? ` (${attomExt.parkingSpaces} spaces)` : ""}` : null} onSave={handleSaveField} />
            </div>

            {/* G. Utilities & Systems */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">G. Utilities & Systems</h3>
              <EditableField label="Heating / cooling" value={answers.hvac_type_age} answerId="hvac_type_age" onSave={handleSaveField} />
              <EditableField label="Water heater" value={answers.water_heater} answerId="water_heater" onSave={handleSaveField} />
              <EditableField label="Water / sewer" value={answers.water_sewer} answerId="water_sewer" onSave={handleSaveField} />
              <EditableField label="Electric / gas" value={answers.electric_provider} answerId="electric_provider" onSave={handleSaveField} />
            </div>

            {/* H. HOA / Community Information */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                H. HOA / Community Information
              </h3>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  HOA / condo summary: {answers.hoa_fees_amenities || "— (fees & amenities from smart question)"}
                </span>
                {answers.hoa_fees_amenities && (
                  <CopyButton text={answers.hoa_fees_amenities} />
                )}
              </p>
              <p className="text-[11px] text-zinc-600">
                <span>
                  HOA exists / name: {attomExt.hoaName ? (
                    <>
                      {attomExt.hoaName}{" "}
                      <span className="text-zinc-500">(public record – verify)</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">— (agent to enter)</span>
                  )}
                </span>
                {attomExt.hoaName && <CopyButton text={attomExt.hoaName} />}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  HOA fee amount / frequency: {attomExt.hoaFeeAmount != null ? (
                    <>
                      ${attomExt.hoaFeeAmount.toLocaleString()}
                      {attomExt.hoaFeeFrequency ? ` (${attomExt.hoaFeeFrequency})` : ""}
                      <span className="text-zinc-500"> (public record – verify)</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">— (agent to enter)</span>
                  )}
                </span>
                {attomExt.hoaFeeAmount != null && (
                  <CopyButton
                    text={
                      attomExt.hoaFeeFrequency
                        ? `$${attomExt.hoaFeeAmount.toLocaleString()} ${attomExt.hoaFeeFrequency}`
                        : `$${attomExt.hoaFeeAmount.toLocaleString()}`
                    }
                  />
                )}
              </p>
              <EditableField label="HOA restrictions" value={answers.hoa_restrictions} answerId="hoa_restrictions" onSave={handleSaveField} />
              <EditableField label="Community amenities" value={answers.community_amenities} answerId="community_amenities" onSave={handleSaveField} />
            </div>

            {/* I. Financial & Tax Info */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">
                I. Financial & Tax Info
              </h3>
              <EditableField label="List price" value={answers.list_price} answerId="list_price" onSave={handleSaveField} />
              <p className="text-[11px] text-zinc-600">
                Price per sq ft: {answers.list_price && listing.property.squareFeet.value
                  ? `$${(Number(answers.list_price) / Number(listing.property.squareFeet.value)).toFixed(2)}`
                  : <span className="text-zinc-500">— (needs list price & sq ft)</span>}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  Annual taxes: {listing.property.annualTaxes.value ?? "—"} (Public record)
                </span>
                {listing.property.annualTaxes.value != null && (
                  <CopyButton text={String(listing.property.annualTaxes.value)} />
                )}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  Tax year: {attomExt.taxYear ?? "— (agent to confirm)"}
                </span>
                {attomExt.taxYear && <CopyButton text={String(attomExt.taxYear)} />}
              </p>
              <p className="text-[11px] text-zinc-600">
                CDD fees / special assessments: <span className="text-zinc-500">— (agent to enter; check tax bill)</span>
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  Homestead exemption: {attomExt.homesteadExemption ?? "— (Yes/No)"}
                </span>
                {attomExt.homesteadExemption && (
                  <CopyButton text={attomExt.homesteadExemption} />
                )}
              </p>
            </div>

            {/* J. Location & Area */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-semibold text-zinc-700">J. Location & Area</h3>
              <EditableField label="Flood zone" value={answers.flood_zone} answerId="flood_zone" onSave={handleSaveField} />
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  Schools (elem/middle/high): {answers.schools_summary || (
                    <span className="text-zinc-500">— (agent to enter)</span>
                  )}
                </span>
                {answers.schools_summary && (
                  <CopyButton text={answers.schools_summary} />
                )}
              </p>
              <p className="flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>
                  Township / community name: {attomExt.subdivision ? (
                    <>
                      {attomExt.subdivision}{" "}
                      <span className="text-zinc-500">(public record – verify)</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">— (agent to enter)</span>
                  )}
                </span>
                {attomExt.subdivision && <CopyButton text={attomExt.subdivision} />}
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
              <EditableField label="Showing instructions" value={answers.showing_instructions} answerId="showing_instructions" onSave={handleSaveField} />
              <EditableField label="Lockbox" value={answers.lockbox_type} answerId="lockbox_type" onSave={handleSaveField} />
              <EditableField label="Occupancy" value={answers.occupancy_status} answerId="occupancy_status" fallback={attomExt.absenteeOwner} onSave={handleSaveField} />
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
            <span className="text-[11px] text-zinc-500">
              Seller/agent-provided; ListingLaunchAI does not provide legal advice
            </span>
          </div>

          {disclosures && totalDisclosureQuestions > 0 && (
            <div className="text-[11px] text-zinc-600">
              {answeredDisclosureQuestions}/{totalDisclosureQuestions} questions answered
              {answeredDisclosureQuestions < totalDisclosureQuestions && (
                <span className="ml-1 font-medium text-amber-700">
                  ({totalDisclosureQuestions - answeredDisclosureQuestions} remaining)
                </span>
              )}
            </div>
          )}

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
              const isUnanswered = !current;
              return (
                <div
                  key={q.id}
                  className={`space-y-1 rounded-md border px-2 py-1 ${
                    isUnanswered ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-medium text-zinc-700">
                      {q.label}
                    </div>
                    {isUnanswered && (
                      <span className="text-[11px] font-semibold text-amber-700">
                        Not answered
                      </span>
                    )}
                  </div>
                  {q.helper && (
                    <p className="text-[11px] text-zinc-500">{q.helper}</p>
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

          <p className="mt-2 text-[11px] text-zinc-500">
            This section stores seller-provided responses only. ListingLaunchAI
            does not provide legal advice. Agent and seller must review all
            disclosures prior to execution.
          </p>
        </section>
      )}
    </div>
  );
}
