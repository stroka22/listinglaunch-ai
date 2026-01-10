"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AgentProfile,
  MortgagePartnerProfile,
  PropertyField,
  PropertySnapshot,
} from "@/lib/types";
import { SMART_QUESTIONS } from "@/lib/questions";
import { deriveSmartWizardDefaultsFromRaw } from "@/lib/estated";

interface NewListingWizardProps {
  agentId: string;
  onCreated: () => void;
}

type SnapshotKey = keyof PropertySnapshot;

function makeEmptyField<T>(): PropertyField<T> {
  return {
    value: null,
    source: "public_record",
    confidence: null,
    confirmedByAgent: false,
  };
}

function emptySnapshot(): PropertySnapshot {
  return {
    beds: makeEmptyField<number>(),
    baths: makeEmptyField<number>(),
    squareFeet: makeEmptyField<number>(),
    lotSizeSqFt: makeEmptyField<number>(),
    yearBuilt: makeEmptyField<number>(),
    propertyType: makeEmptyField<string>(),
    parcelId: makeEmptyField<string>(),
    annualTaxes: makeEmptyField<number>(),
  };
}

function slugifyAddress(
  street: string,
  city: string,
  state: string,
  postalCode: string,
) {
  const base = `${street}-${city}-${state}-${postalCode}`.toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function generateSmsKeyword(street: string) {
  const token = street.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `LL${token}${rand}`;
}

const initialAgent: AgentProfile = {
  id: "temp-agent", // Stored inside listing JSON; Supabase can use its own ID schema.
  userId: "temp-user",
  name: "",
  brokerage: "",
  phone: "",
  email: "",
  headshotUrl: null,
  logoUrl: null,
  primaryColor: "#111827",
  secondaryColor: "#4b5563",
};

const initialLender: MortgagePartnerProfile = {
  id: "temp-lender",
  agentId: "temp-agent",
  name: "",
  company: "",
  nmlsId: "",
  phone: "",
  email: "",
  headshotUrl: null,
  logoUrl: null,
  bio: null,
  bioSource: "ai_generated",
};

export function NewListingWizard({ agentId, onCreated }: NewListingWizardProps) {
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("FL");
  const [postalCode, setPostalCode] = useState("");

  const [property, setProperty] = useState<PropertySnapshot | null>(null);
  const [estatedRaw, setEstatedRaw] = useState<unknown | null>(null);
  const [estatedWarnings, setEstatedWarnings] = useState<string[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [agentBranding, setAgentBranding] = useState<AgentProfile>(
    initialAgent,
  );
  const [includeLender, setIncludeLender] = useState(false);
  const [lenderBranding, setLenderBranding] =
    useState<MortgagePartnerProfile>(initialLender);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<
    "idle" | "pending" | "done" | "error"
  >("idle");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function loadAgentProfile() {
      try {
        const { data, error } = await supabase
          .from("agent_profiles")
          .select(
            "name, brokerage, phone, email, headshot_url, logo_url, primary_color, secondary_color",
          )
          .eq("id", agentId)
          .single();

        if (error && error.code !== "PGRST116") {
          return;
        }

        if (data) {
          setAgentBranding((prev) => ({
            ...prev,
            id: agentId,
            userId: agentId,
            name: (data.name as string | null) ?? prev.name,
            brokerage: (data.brokerage as string | null) ?? prev.brokerage,
            phone: (data.phone as string | null) ?? prev.phone,
            email:
              (data.email as string | null) ?? prev.email ?? "",
            headshotUrl:
              (data.headshot_url as string | null) ?? prev.headshotUrl,
            logoUrl: (data.logo_url as string | null) ?? prev.logoUrl,
            primaryColor:
              (data.primary_color as string | null) ?? prev.primaryColor,
            secondaryColor:
              (data.secondary_color as string | null) ?? prev.secondaryColor,
          }));
        }
      } catch {
        // Non-fatal for the wizard
      }
    }

    loadAgentProfile();
  }, [agentId]);

  function ensureProperty() {
    if (property) return property;
    const snap = emptySnapshot();
    setProperty(snap);
    return snap;
  }

  function updateField<K extends SnapshotKey>(
    key: K,
    updater: (field: PropertyField<PropertySnapshot[K]["value"]>) => PropertyField<PropertySnapshot[K]["value"]>,
  ) {
    setProperty((prev) => {
      const current = prev ?? emptySnapshot();
      return {
        ...current,
        [key]: updater(current[key] as any) as any,
      };
    });
  }

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setLookupLoading(true);

    try {
      const res = await fetch("/api/estated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ street, city, state, postalCode }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Lookup failed");
      }

      const json = (await res.json()) as {
        snapshot: PropertySnapshot;
        raw: unknown;
        warnings: string[];
      };

      setProperty(json.snapshot);
      setEstatedRaw(json.raw);
      setEstatedWarnings(json.warnings ?? []);

      const defaults = deriveSmartWizardDefaultsFromRaw(json.raw);
      if (Object.keys(defaults).length > 0) {
        setAnswers((prev) => ({
          ...defaults,
          ...prev,
        }));
      }
    } catch (err: any) {
      setLookupError(err?.message ?? "Property lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSaveAndGenerate() {
    setSaveError(null);
    setSaving(true);
    setAiStatus("idle");

    try {
      const supabase = getSupabaseBrowserClient();
      const prop = ensureProperty();

      const slug = slugifyAddress(street, city, state, postalCode);
      const smsKeyword = generateSmsKeyword(street || slug);

      const brandingAgent: AgentProfile = {
        ...agentBranding,
        id: agentId,
        userId: agentId,
        email: agentBranding.email || "",
      };

      const brandingLender: MortgagePartnerProfile | null = includeLender
        ? {
            ...lenderBranding,
            agentId,
          }
        : null;

      const { data, error } = await supabase
        .from("listings")
        .insert({
          agent_id: agentId,
          slug,
          street,
          city,
          state,
          postal_code: postalCode,
          status: "draft",
          sms_keyword: smsKeyword,
          sms_phone_number: process.env
            .NEXT_PUBLIC_TWILIO_FROM_NUMBER as string | null,
          estated_raw: estatedRaw,
          property: prop,
          branding: {
            agent: brandingAgent,
            mortgagePartner: brandingLender,
          },
          wizard_answers: answers,
        })
        .select("id")
        .single();

      if (error) {
        const isSlugConflict =
          (error as any).code === "23505" &&
          typeof (error as any).message === "string" &&
          (error as any).message.includes("listings_slug_key");

        if (isSlugConflict) {
          setAiStatus("idle");
          setSaveError(
            "A listing for this address already exists. Open it from the 'Your listings' table to view or regenerate assets.",
          );
          return;
        }

        throw error;
      }

      if (!data || !data.id) {
        throw new Error(
          "Listing was created but no ID was returned. Please refresh and try again.",
        );
      }

      const listingId = data.id as string;

      // Ensure an agent profile record exists for admin reporting and defaults.
      try {
        await supabase.from("agent_profiles").upsert({
          id: agentId,
          name: brandingAgent.name,
          brokerage: brandingAgent.brokerage,
          phone: brandingAgent.phone,
          email: brandingAgent.email,
          headshot_url: brandingAgent.headshotUrl,
          logo_url: brandingAgent.logoUrl,
          primary_color: brandingAgent.primaryColor,
          secondary_color: brandingAgent.secondaryColor,
        });
      } catch {
        // Non-fatal; listing creation should still succeed even if profile upsert fails.
      }

      setAiStatus("pending");

      const aiRes = await fetch(`/api/listings/${listingId}/generate-ai`, {
        method: "POST",
      });

      if (!aiRes.ok) {
        const json = await aiRes.json().catch(() => null);
        setAiStatus("error");
        throw new Error(json?.error || "AI generation failed");
      }

      setAiStatus("done");
      onCreated();
    } catch (err: any) {
      setSaveError(err?.message ?? "Could not create listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">New Listing Launch Kit</h3>
        <p className="text-[11px] text-zinc-500">
          1) Lookup public record, 2) confirm details, 3) answer smart
          questions, 4) add branding, 5) generate assets.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.4fr,1.2fr]">
        <div className="space-y-4">
          <form onSubmit={handleLookup} className="space-y-3">
            <div className="text-xs font-medium text-zinc-600">
              1. Property address (for public record lookup)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr,1fr]">
              <input
                required
                placeholder="Street address"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
              <input
                required
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            </div>
            <div className="grid grid-cols-[1fr,1.5fr] gap-2">
              <input
                required
                placeholder="State (e.g. FL)"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
              <input
                required
                placeholder="ZIP"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={lookupLoading}
                className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {lookupLoading ? "Looking up" : "Lookup property"}
              </button>
              {estatedWarnings.length > 0 && (
                <span className="text-[11px] text-amber-600">
                  {estatedWarnings.length} warning(s) from public record
                </span>
              )}
            </div>
            {lookupError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {lookupError}
              </div>
            )}
          </form>

          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-600">
              2. Review auto-filled core data
            </div>
            <p className="text-[11px] text-zinc-500">
              Values marked as public record come from our data provider. Update any
              fields that are incorrect and mark them as confirmed by you.
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                "beds",
                "baths",
                "squareFeet",
                "lotSizeSqFt",
                "yearBuilt",
                "propertyType",
                "parcelId",
                "annualTaxes",
              ] as SnapshotKey[]).map((key) => {
                const snap = property ?? emptySnapshot();
                const field = snap[key] as PropertyField<any>;

                const labelMap: Record<SnapshotKey, string> = {
                  beds: "Beds",
                  baths: "Baths",
                  squareFeet: "Square feet",
                  lotSizeSqFt: "Lot size (sq ft)",
                  yearBuilt: "Year built",
                  propertyType: "Property type",
                  parcelId: "Parcel ID",
                  annualTaxes: "Annual taxes",
                };

                return (
                  <div
                    key={key}
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-zinc-700">
                        {labelMap[key]}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {field.source === "public_record"
                          ? "Public record"
                          : field.source === "agent_confirmed"
                            ? "Agent confirmed"
                            : "AI-generated"}
                        {typeof field.confidence === "number"
                          ? ` • ${(field.confidence * 100).toFixed(0)}%`
                          : ""}
                      </span>
                    </div>
                    <input
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateField(key, (f) => ({
                          ...f,
                          value: value === "" ? null : (value as any),
                        }));
                      }}
                      className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-black/60"
                    />
                    <label className="flex items-center gap-1 text-[10px] text-zinc-600">
                      <input
                        type="checkbox"
                        checked={field.confirmedByAgent}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateField(key, (f) => ({
                            ...f,
                            confirmedByAgent: checked,
                            source: checked ? "agent_confirmed" : f.source,
                          }));
                        }}
                      />
                      <span>Confirmed by agent</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-600">
              3. Smart questions wizard
            </div>
            <div className="space-y-2 max-h-72 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              {SMART_QUESTIONS.map((q) => (
                <div key={q.id} className="space-y-1">
                  <label className="block text-[11px] font-medium text-zinc-700">
                    {q.label}
                  </label>
                  {q.helper && (
                    <p className="text-[10px] text-zinc-500">{q.helper}</p>
                  )}
                  <textarea
                    rows={2}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-black/60"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-600">
              4. Branding & optional co-branding
            </div>
            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="font-medium text-zinc-700">Agent</div>
                  <input
                    placeholder="Name"
                    value={agentBranding.name}
                    onChange={(e) =>
                      setAgentBranding((a) => ({ ...a, name: e.target.value }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1"
                  />
                  <input
                    placeholder="Brokerage"
                    value={agentBranding.brokerage}
                    onChange={(e) =>
                      setAgentBranding((a) => ({
                        ...a,
                        brokerage: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1"
                  />
                  <input
                    placeholder="Phone"
                    value={agentBranding.phone}
                    onChange={(e) =>
                      setAgentBranding((a) => ({ ...a, phone: e.target.value }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1"
                  />
                  <input
                    placeholder="Email"
                    value={agentBranding.email}
                    onChange={(e) =>
                      setAgentBranding((a) => ({ ...a, email: e.target.value }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1"
                  />
                </div>

                <div className="space-y-1">
                  <div className="font-medium text-zinc-700">Branding</div>
                  <input
                    placeholder="Headshot URL (Supabase storage or CDN)"
                    value={agentBranding.headshotUrl ?? ""}
                    onChange={(e) =>
                      setAgentBranding((a) => ({
                        ...a,
                        headshotUrl: e.target.value || null,
                      }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1"
                  />
                  <input
                    placeholder="Logo URL"
                    value={agentBranding.logoUrl ?? ""}
                    onChange={(e) =>
                      setAgentBranding((a) => ({
                        ...a,
                        logoUrl: e.target.value || null,
                      }))
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1"
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={agentBranding.primaryColor ?? "#111827"}
                      onChange={(e) =>
                        setAgentBranding((a) => ({
                          ...a,
                          primaryColor: e.target.value,
                        }))
                      }
                      className="h-7 w-12 rounded border border-zinc-300 bg-white"
                    />
                    <input
                      type="color"
                      value={agentBranding.secondaryColor ?? "#4b5563"}
                      onChange={(e) =>
                        setAgentBranding((a) => ({
                          ...a,
                          secondaryColor: e.target.value,
                        }))
                      }
                      className="h-7 w-12 rounded border border-zinc-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              <label className="mt-2 flex items-center gap-2 text-[11px] text-zinc-600">
                <input
                  type="checkbox"
                  checked={includeLender}
                  onChange={(e) => setIncludeLender(e.target.checked)}
                />
                <span>Include lender co-branding (for marketing only)</span>
              </label>

              {includeLender && (
                <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="font-medium text-zinc-700">Lender</div>
                    <input
                      placeholder="Name"
                      value={lenderBranding.name}
                      onChange={(e) =>
                        setLenderBranding((l) => ({
                          ...l,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-zinc-300 px-2 py-1"
                    />
                    <input
                      placeholder="Company"
                      value={lenderBranding.company}
                      onChange={(e) =>
                        setLenderBranding((l) => ({
                          ...l,
                          company: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-zinc-300 px-2 py-1"
                    />
                    <input
                      placeholder="NMLS ID"
                      value={lenderBranding.nmlsId}
                      onChange={(e) =>
                        setLenderBranding((l) => ({
                          ...l,
                          nmlsId: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-zinc-300 px-2 py-1"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-zinc-700">Contact</div>
                    <input
                      placeholder="Phone"
                      value={lenderBranding.phone}
                      onChange={(e) =>
                        setLenderBranding((l) => ({
                          ...l,
                          phone: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-zinc-300 px-2 py-1"
                    />
                    <input
                      placeholder="Email"
                      value={lenderBranding.email}
                      onChange={(e) =>
                        setLenderBranding((l) => ({
                          ...l,
                          email: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-zinc-300 px-2 py-1"
                    />
                    <input
                      placeholder="Headshot/logo URL"
                      value={lenderBranding.headshotUrl ?? ""}
                      onChange={(e) =>
                        setLenderBranding((l) => ({
                          ...l,
                          headshotUrl: e.target.value || null,
                        }))
                      }
                      className="w-full rounded-md border border-zinc-300 px-2 py-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {saveError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {saveError}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAndGenerate}
                disabled={saving}
                className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {saving
                  ? "Saving listing…"
                  : "Save listing & generate assets"}
              </button>
              {aiStatus === "pending" && (
                <span className="text-[11px] text-zinc-600">
                  Generating MLS remarks, feature bullets, and social captions…
                </span>
              )}
              {aiStatus === "done" && (
                <span className="text-[11px] text-emerald-600">
                  AI assets generated. View them from the dashboard table
                  below.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
