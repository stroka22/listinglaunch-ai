"use client";

import { useEffect, useState, FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface AgentProfileScreenProps {
  session: Session;
}

export function AgentProfileScreen({ session }: AgentProfileScreenProps) {
  const [name, setName] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(session.user.email ?? "");
  const [headshotUrl, setHeadshotUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#111827");
  const [secondaryColor, setSecondaryColor] = useState("#4b5563");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("agent_profiles")
          .select(
            "name, brokerage, phone, email, headshot_url, logo_url, primary_color, secondary_color",
          )
          .eq("id", session.user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 = row not found
          throw error;
        }

        if (data) {
          setName((data.name as string | null) ?? "");
          setBrokerage((data.brokerage as string | null) ?? "");
          setPhone((data.phone as string | null) ?? "");
          setEmail((data.email as string | null) ?? session.user.email ?? "");
          setHeadshotUrl((data.headshot_url as string | null) ?? "");
          setLogoUrl((data.logo_url as string | null) ?? "");
          setPrimaryColor(
            (data.primary_color as string | null) ?? "#111827",
          );
          setSecondaryColor(
            (data.secondary_color as string | null) ?? "#4b5563",
          );
        } else {
          const meta = session.user.user_metadata as any;
          const fallbackName =
            [meta?.first_name, meta?.last_name]
              .filter(Boolean)
              .join(" ") || "";
          setName(fallbackName);
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [session.user.id, session.user.email]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error: upsertError } = await supabase
        .from("agent_profiles")
        .upsert({
          id: session.user.id,
          name: name || null,
          brokerage: brokerage || null,
          phone: phone || null,
          email: email || null,
          headshot_url: headshotUrl || null,
          logo_url: logoUrl || null,
          primary_color: primaryColor || null,
          secondary_color: secondaryColor || null,
        });

      if (upsertError) {
        throw upsertError;
      }

      setSuccess("Profile updated.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleHeadshotUpload(e: any) {
    const file: File | undefined = e.target?.files?.[0];
    if (!file) return;
    setUploadingHeadshot(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `agents/${session.user.id}/headshot-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("branding-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("branding-assets").getPublicUrl(path);

      setHeadshotUrl(publicUrl);
      setSuccess("Headshot uploaded.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to upload headshot");
    } finally {
      setUploadingHeadshot(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  }

  async function handleLogoUpload(e: any) {
    const file: File | undefined = e.target?.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `agents/${session.user.id}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("branding-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("branding-assets").getPublicUrl(path);

      setLogoUrl(publicUrl);
      setSuccess("Logo uploaded.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 text-xs text-zinc-500">
        Loading your profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">
          Profile & branding
        </h1>
        <p className="text-xs text-zinc-500">
          Update your contact details and default branding. New listings will
          use these values as starting points for the wizard and PDFs.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-xs">
            <div className="font-semibold text-zinc-800">Agent details</div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Brokerage
              </label>
              <input
                type="text"
                value={brokerage}
                onChange={(e) => setBrokerage(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold text-zinc-800">Branding</div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Headshot URL
              </label>
              <input
                type="url"
                value={headshotUrl}
                onChange={(e) => setHeadshotUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            <div className="mt-1 flex items-center gap-2">
              <label
                htmlFor="headshot-upload"
                className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Choose headshot file
              </label>
              <span className="text-[10px] text-zinc-500">
                JPG or PNG, used on flyers and packets.
              </span>
              <input
                id="headshot-upload"
                type="file"
                accept="image/*"
                onChange={handleHeadshotUpload}
                disabled={uploadingHeadshot}
                className="hidden"
              />
            </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Logo URL
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            <div className="mt-1 flex items-center gap-2">
              <label
                htmlFor="logo-upload"
                className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Choose logo file
              </label>
              <span className="text-[10px] text-zinc-500">
                Transparent PNG recommended for best results.
              </span>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                className="hidden"
              />
            </div>
            </div>
            <div className="flex gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-zinc-700">
                  Primary color
                </label>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-8 w-12 rounded border border-zinc-300 bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-zinc-700">
                  Secondary color
                </label>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-8 w-12 rounded border border-zinc-300 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
            {success}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
