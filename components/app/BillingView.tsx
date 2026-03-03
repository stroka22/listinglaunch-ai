"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AgentCreditLedgerEntry, CreditPackage } from "@/lib/types";

interface Props {
  session: Session;
}

export function BillingView({ session }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<AgentCreditLedgerEntry[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoStatus, setPromoStatus] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [checkoutPromo, setCheckoutPromo] = useState("");

  useEffect(() => {
    loadBilling();
  }, [session.user.id]);

  async function loadBilling() {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      const [ledgerRes, pkgRes] = await Promise.all([
        supabase
          .from("agent_credit_ledger")
          .select("id, agent_id, delta, reason, listing_id, created_at")
          .eq("agent_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("credit_packages")
          .select("id, slug, name, credits, price_cents, active, sort_order, stripe_price_id")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (ledgerRes.data) {
        const rows = ledgerRes.data as any[];
        const bal = rows.reduce((s: number, r: any) => s + (r.delta as number), 0);
        setBalance(bal);
        setHistory(
          rows.map((r: any) => ({
            id: r.id,
            agentId: r.agent_id,
            delta: r.delta,
            reason: r.reason,
            listingId: r.listing_id ?? null,
            createdAt: r.created_at,
          })),
        );
      }

      if (pkgRes.data) {
        setPackages(
          (pkgRes.data as any[]).map((r: any) => ({
            id: r.id,
            slug: r.slug,
            name: r.name,
            credits: r.credits,
            priceCents: r.price_cents,
            active: r.active,
            sortOrder: r.sort_order,
            stripePriceId: r.stripe_price_id ?? null,
          })),
        );
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy(pkg: CreditPackage) {
    setPurchaseLoading(true);
    setError(null);
    try {
      if (pkg.stripePriceId) {
        const res = await fetch("/api/billing/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId: pkg.id, agentId: session.user.id, promoCode: checkoutPromo.trim() || undefined }),
        });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok) throw new Error(json?.error || "Checkout failed");
        if (json.url) window.location.href = json.url;
      } else {
        // Test purchase
        const supabase = getSupabaseBrowserClient();
        await supabase.from("agent_credit_ledger").insert({
          agent_id: session.user.id,
          delta: pkg.credits,
          reason: "test_purchase",
        });
        await loadBilling();
      }
    } catch (err: any) {
      setError(err?.message ?? "Purchase failed");
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function handlePromo() {
    const code = promoCode.trim();
    if (!code) return;
    setPromoError(null);
    setPromoStatus(null);
    setPromoLoading(true);
    try {
      const res = await fetch("/api/billing/redeem-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, agentId: session.user.id }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || "Promo code could not be applied.");

      const added = json?.creditsAdded ?? 0;
      setPromoStatus(`+${added} credit${added === 1 ? "" : "s"} added!`);
      setPromoCode("");
      await loadBilling();
    } catch (err: any) {
      setPromoError(err?.message ?? "Could not apply promo code.");
    } finally {
      setPromoLoading(false);
    }
  }

  function describeEntry(e: AgentCreditLedgerEntry): string {
    if (e.reason === "purchase") return "Credits purchased (Stripe)";
    if (e.reason === "test_purchase") return "Test credits added";
    if (e.reason === "listing_consume") return `Credit used for listing`;
    if (e.reason === "promo") return "Promo code redeemed";
    return e.reason;
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-zinc-400">Loading billing…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Billing & Credits</h1>
        <p className="text-sm text-zinc-500">Manage your listing credits and purchase history.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Balance card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Available credits</p>
        <p className="text-3xl font-bold text-zinc-900">
          {balance ?? 0}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            listing credit{(balance ?? 0) === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      {/* Promo code */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-zinc-900">Promo Code</h2>
        <p className="mb-3 text-sm text-zinc-500">Have a promo code? Enter it below to add free credits.</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter code"
            className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
          />
          <button
            type="button"
            onClick={handlePromo}
            disabled={promoLoading || !promoCode.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {promoLoading ? "Applying…" : "Apply"}
          </button>
        </div>
        {promoStatus && <p className="mt-2 text-sm text-emerald-600">{promoStatus}</p>}
        {promoError && <p className="mt-2 text-sm text-red-600">{promoError}</p>}
      </div>

      {/* Credit packages */}
      {packages.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-zinc-900">Purchase Credits</h2>

          {/* Discount code for checkout */}
          <div className="mb-4 flex items-center gap-2">
            <input
              type="text"
              value={checkoutPromo}
              onChange={(e) => setCheckoutPromo(e.target.value)}
              placeholder="Discount code (optional)"
              className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/30"
            />
            {checkoutPromo.trim() && (
              <span className="text-xs text-emerald-600">Code will be applied at checkout</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{pkg.name}</p>
                  <p className="text-xs text-zinc-500">
                    {pkg.credits} credit{pkg.credits === 1 ? "" : "s"} · $
                    {(pkg.priceCents / 100).toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleBuy(pkg)}
                  disabled={purchaseLoading}
                  className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {pkg.stripePriceId ? "Buy" : "Add (test)"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credit history */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-zinc-900">Credit History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">No credit activity yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Change</th>
                  <th className="px-4 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-t border-zinc-100">
                    <td className="px-4 py-2 text-zinc-500">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className={entry.delta > 0 ? "text-emerald-600 font-medium" : "text-zinc-700"}>
                        {entry.delta > 0 ? "+" : ""}{entry.delta}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{describeEntry(entry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
