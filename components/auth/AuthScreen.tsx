"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match. Please re-enter them.");
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });
        if (signUpError) throw signUpError;
      }

      window.location.reload();
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-49px)] items-center justify-center px-4">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-8 rounded-xl bg-white p-8 shadow-sm md:grid-cols-[1.4fr,1fr]">
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">ListingLaunch AI</h1>
          <p className="text-sm text-zinc-600">
            Enter a property once and generate everything you need to launch a
            listing in Stellar MLS: MLS-ready fields, marketing copy, PDFs, and
            SMS text-to-lead.
          </p>
          <ul className="text-sm text-zinc-600 list-disc list-inside space-y-1">
            <li>Pull public record data from Estated for fast intake</li>
            <li>Collect property details via a smart questions wizard</li>
            <li>Generate Stellar MLS-ready remarks and feature bullets</li>
            <li>Create open house flyers and a mobile-friendly property hub</li>
            <li>Assign SMS keywords and capture leads with Twilio</li>
          </ul>
          <p className="text-[11px] text-zinc-500">
            This tool does not log in to Stellar MLS or Matrix and does not
            create or edit live MLS listings. It prepares MLS-ready data for
            manual entry only.
          </p>
        </div>

        <div className="border border-zinc-200 rounded-lg p-6 space-y-4 bg-zinc-50/60">
          <div className="flex gap-2 text-xs font-medium mb-2">
            <button
              type="button"
              onClick={() => setMode("sign_in")}
              className={`flex-1 rounded-full border px-3 py-1.5 transition-colors ${mode === "sign_in" ? "bg-black text-white border-black" : "bg-white text-zinc-700 border-zinc-300"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("sign_up")}
              className={`flex-1 rounded-full border px-3 py-1.5 transition-colors ${mode === "sign_up" ? "bg-black text-white border-black" : "bg-white text-zinc-700 border-zinc-300"}`}
            >
              Create account
            </button>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "sign_up" && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">
                    First name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700">
                    Last name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/60"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Work email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/60"
              />
            </div>

            {mode === "sign_up" && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Confirm password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/60"
                />
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            >
              {loading
                ? mode === "sign_in"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "sign_in"
                  ? "Sign in to ListingLaunchAI"
                  : "Create ListingLaunchAI account"}
            </button>

            <p className="text-[11px] text-zinc-500">
              Authentication is powered by Supabase. Configure your
              NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
              environment variables before using this app.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
