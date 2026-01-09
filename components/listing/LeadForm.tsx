"use client";

import { FormEvent, useState } from "react";

interface LeadFormProps {
  listingId: string;
}

export function LeadForm({ listingId }: LeadFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");
    setError(null);

    try {
      const res = await fetch(`/api/listings/${listingId}/web-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Could not submit lead");
      }

      setStatus("ok");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (err: any) {
      setError(err?.message ?? "Could not submit lead");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-[11px]">
      <div className="grid grid-cols-1 gap-2">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-2 py-1"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-2 py-1"
        />
        <input
          placeholder="Mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-2 py-1"
        />
        <textarea
          rows={2}
          placeholder="Questions about this property (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-2 py-1"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700">
          {error}
        </div>
      )}

      {status === "ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">
          Thanks—we'll share this with the agent.
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-md bg-black px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-60"
      >
        {loading ? "Sending…" : "Request info"}
      </button>
    </form>
  );
}
