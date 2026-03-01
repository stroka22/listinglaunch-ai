"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Listing,
  AgentCreditLedgerEntry,
  CreditOrder,
  CreditPackage,
} from "@/lib/types";
import { NewListingWizard } from "@/components/dashboard/NewListingWizard";

interface DashboardProps {
  session: Session;
}

export function Dashboard({ session }: DashboardProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [creditHistory, setCreditHistory] = useState<AgentCreditLedgerEntry[]>([]);
  const [creditOrders, setCreditOrders] = useState<CreditOrder[]>([]);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

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

        // Load billing data
        try {
          setCreditsError(null);
          setBillingError(null);

          const [
            { data: ledgerRows, error: ledgerError },
            { data: ordersRows, error: ordersError },
            { data: packagesRows, error: packagesError },
          ] = await Promise.all([
            supabase
              .from("agent_credit_ledger")
              .select("id, agent_id, delta, reason, listing_id, created_at")
              .eq("agent_id", session.user.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("credit_orders")
              .select("id, agent_id, package_id, credits, price_cents, status, created_at")
              .eq("agent_id", session.user.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("credit_packages")
              .select("id, slug, name, credits, price_cents, active, sort_order, stripe_price_id")
              .eq("active", true)
              .order("sort_order", { ascending: true }),
          ]);

          if (ledgerError) {
            setCreditsError(ledgerError.message);
            setCreditsBalance(null);
            setCreditHistory([]);
          } else {
            const balance = (ledgerRows ?? []).reduce(
              (sum: number, row: any) => sum + (row.delta as number),
              0,
            );
            setCreditsBalance(balance);
            setCreditHistory(
              (ledgerRows ?? [])
                .map((row: any) => ({
                  id: row.id as string,
                  agentId: row.agent_id as string,
                  delta: row.delta as number,
                  reason: row.reason as string,
                  listingId: (row.listing_id as string | null) ?? null,
                  createdAt: row.created_at as string,
                }))
                .slice(0, 50),
            );
          }

          if (!ordersError && ordersRows) {
            setCreditOrders(
              (ordersRows ?? [])
                .map((row: any) => ({
                  id: row.id as string,
                  agentId: row.agent_id as string,
                  packageId: row.package_id as string,
                  credits: row.credits as number,
                  priceCents: row.price_cents as number,
                  status: row.status as CreditOrder["status"],
                  createdAt: row.created_at as string,
                }))
                .slice(0, 50),
            );
          }

          if (!packagesError && packagesRows) {
            setCreditPackages(
              (packagesRows ?? []).map((row: any) => ({
                id: row.id as string,
                slug: row.slug as string,
                name: row.name as string,
                credits: row.credits as number,
                priceCents: row.price_cents as number,
                active: row.active as boolean,
                sortOrder: row.sort_order as number,
                stripePriceId: (row.stripe_price_id as string | null) ?? null,
              })),
            );
          }
        } catch (billingErr: any) {
          setCreditsError(billingErr?.message ?? "Failed to load credits");
          setCreditsBalance(null);
          setCreditHistory([]);
        }
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
      const res = await fetch(`/api/listings/${listingId}/manage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: session.user.id, archived: true }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) { setError(json?.error || "Failed to archive listing"); return; }
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } catch (err: any) {
      setError(err?.message ?? "Failed to archive listing");
    }
  }

  async function handleDeleteListing(listingId: string) {
    if (!window.confirm("Delete this listing permanently? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/listings/${listingId}/manage`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: session.user.id }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) { setError(json?.error || "Failed to delete listing"); return; }
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete listing");
    }
  }

  async function handleTestPurchase(pkg: CreditPackage) {
    setBillingError(null);
    setPurchaseLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      const { error: orderError } = await supabase
        .from("credit_orders")
        .insert({
          agent_id: session.user.id,
          package_id: pkg.id,
          credits: pkg.credits,
          price_cents: pkg.priceCents,
          status: "paid",
        });
      if (orderError) throw orderError;

      const { data: ledgerRow, error: ledgerError } = await supabase
        .from("agent_credit_ledger")
        .insert({
          agent_id: session.user.id,
          delta: pkg.credits,
          reason: "test_purchase",
          listing_id: null,
        })
        .select("id, agent_id, delta, reason, listing_id, created_at")
        .single();
      if (ledgerError) throw ledgerError;

      setCreditsBalance((prev) => (prev ?? 0) + pkg.credits);
      if (ledgerRow) {
        setCreditHistory((prev) =>
          [
            {
              id: ledgerRow.id as string,
              agentId: ledgerRow.agent_id as string,
              delta: ledgerRow.delta as number,
              reason: ledgerRow.reason as string,
              listingId: (ledgerRow.listing_id as string | null) ?? null,
              createdAt: ledgerRow.created_at as string,
            },
            ...prev,
          ].slice(0, 50),
        );
      }
    } catch (err: any) {
      setBillingError(err?.message ?? "Failed to add test credits.");
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function handleRedeemPromo() {
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

      if (typeof json?.newBalance === "number") setCreditsBalance(json.newBalance);
      if (json?.ledgerEntry) {
        setCreditHistory((prev) =>
          [
            {
              id: json.ledgerEntry.id as string,
              agentId: json.ledgerEntry.agentId as string,
              delta: json.ledgerEntry.delta as number,
              reason: json.ledgerEntry.reason as string,
              listingId: (json.ledgerEntry.listingId as string | null) ?? null,
              createdAt: json.ledgerEntry.createdAt as string,
            },
            ...prev,
          ].slice(0, 50),
        );
      }
      const added = json?.creditsAdded ?? 0;
      setPromoStatus(added > 0 ? `Promo applied: +${added} credit${added === 1 ? "" : "s"}` : "Promo applied.");
      setPromoCode("");
    } catch (err: any) {
      setPromoError(err?.message ?? "Promo code could not be applied.");
    } finally {
      setPromoLoading(false);
    }
  }

  function describeCreditEntry(entry: AgentCreditLedgerEntry): string {
    if (entry.reason === "purchase") return "Credits purchased (Stripe checkout)";
    if (entry.reason === "test_purchase") return "Test credits added (no charge)";
    if (entry.reason === "listing_consume") {
      const listing = listings.find((l) => l.id === entry.listingId);
      const label = listing ? `${listing.street}, ${listing.city}` : entry.listingId ?? "Listing";
      return `${Math.abs(entry.delta)} credit${Math.abs(entry.delta) === 1 ? "" : "s"} used for ${label}`;
    }
    return entry.reason;
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

      {/* Credits overview */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
        <div className="mb-1 text-[11px] font-semibold text-zinc-800">Available credits</div>
        {creditsError ? (
          <p className="text-[11px] text-red-700">Could not load credits.</p>
        ) : (
          <p className="text-2xl font-semibold text-zinc-900">
            {creditsBalance ?? 0}
            <span className="ml-1 align-baseline text-[11px] font-normal text-zinc-500">
              listing credit{(creditsBalance ?? 0) === 1 ? "" : "s"}
            </span>
          </p>
        )}
      </section>

      <NewListingWizard
        agentId={session.user.id}
        onCreated={() => window.location.reload()}
      />

      {/* Listings table */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your listings</h3>
          {loading && <span className="text-[11px] text-zinc-500">Loading…</span>}
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
                  <tr key={listing.id || listing.slug} className="border-t border-zinc-100">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-zinc-800">{listing.street}</div>
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

      {/* Billing & usage */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 space-y-0.5">
          <h3 className="text-sm font-semibold">Billing & usage</h3>
          <p className="text-[11px] text-zinc-500">
            Purchase credits, redeem promo codes, and view your credit history.
          </p>
        </div>

        {billingError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            {billingError}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[1.4fr,1fr]">
          {/* Credit history */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-zinc-800">Credit history</h4>
            {creditHistory.length === 0 ? (
              <p className="text-[11px] text-zinc-500">No credit activity yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-zinc-200">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead className="bg-zinc-50">
                    <tr className="text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-1.5">Date</th>
                      <th className="px-3 py-1.5">Change</th>
                      <th className="px-3 py-1.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditHistory.map((entry) => (
                      <tr key={entry.id} className="border-t border-zinc-100 align-top">
                        <td className="px-3 py-1.5 text-zinc-500">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={entry.delta > 0 ? "text-emerald-600" : "text-zinc-700"}>
                            {entry.delta > 0 ? "+" : ""}{entry.delta} credit{Math.abs(entry.delta) === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-zinc-600">{describeCreditEntry(entry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Promo + packages */}
          <div className="space-y-3">
            {/* Promo code */}
            <div className="space-y-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2">
              <h4 className="text-xs font-semibold text-zinc-800">Promo code</h4>
              <p className="text-[10px] text-zinc-500">
                Enter a promo code to add free listing credits.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="ENTERCODE"
                  className="min-w-[140px] flex-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] text-zinc-800"
                />
                <button
                  type="button"
                  onClick={handleRedeemPromo}
                  disabled={promoLoading || !promoCode.trim()}
                  className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white disabled:opacity-60"
                >
                  {promoLoading ? "Applying…" : "Apply"}
                </button>
              </div>
              {promoStatus && <div className="text-[10px] text-emerald-700">{promoStatus}</div>}
              {promoError && <div className="text-[10px] text-red-700">{promoError}</div>}
            </div>

            {/* Credit packages */}
            <h4 className="text-xs font-semibold text-zinc-800">Credit packages</h4>
            {creditPackages.length === 0 ? (
              <p className="text-[11px] text-zinc-500">No credit packages configured yet.</p>
            ) : (
              <div className="space-y-2">
                {creditPackages.map((pkg) => {
                  const price = (pkg.priceCents / 100).toFixed(2);
                  const perListing = (pkg.priceCents / 100 / pkg.credits).toFixed(2);
                  return (
                    <div key={pkg.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-zinc-800">{pkg.name}</div>
                          <div className="text-[10px] text-zinc-500">
                            {pkg.credits} listing{pkg.credits === 1 ? "" : "s"} · ${price} total · ${perListing} per listing
                          </div>
                        </div>
                        {pkg.stripePriceId ? (
                          <button
                            type="button"
                            disabled={purchaseLoading}
                            onClick={async () => {
                              setBillingError(null);
                              setPurchaseLoading(true);
                              try {
                                const res = await fetch("/api/billing/create-checkout-session", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ packageId: pkg.id, agentId: session.user.id }),
                                });
                                const json = (await res.json()) as { url?: string; error?: string };
                                if (!res.ok) throw new Error(json?.error || "Checkout failed");
                                if (json.url) window.location.href = json.url;
                                else throw new Error("Stripe did not return a checkout URL.");
                              } catch (err: any) {
                                setBillingError(err?.message || "Could not start checkout.");
                              } finally {
                                setPurchaseLoading(false);
                              }
                            }}
                            className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white disabled:opacity-60"
                          >
                            Buy credits
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={purchaseLoading}
                            onClick={() => handleTestPurchase(pkg)}
                            className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white disabled:opacity-60"
                          >
                            Add credits (test)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent orders */}
            {creditOrders.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-zinc-800">Recent orders</h4>
                <div className="overflow-x-auto rounded-md border border-zinc-200">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead className="bg-zinc-50">
                      <tr className="text-left uppercase tracking-wide text-zinc-500">
                        <th className="px-3 py-1.5">Date</th>
                        <th className="px-3 py-1.5">Credits</th>
                        <th className="px-3 py-1.5">Amount</th>
                        <th className="px-3 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditOrders.map((order) => (
                        <tr key={order.id} className="border-t border-zinc-100 align-top">
                          <td className="px-3 py-1.5 text-zinc-500">{new Date(order.createdAt).toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-zinc-700">{order.credits}</td>
                          <td className="px-3 py-1.5 text-zinc-700">${(order.priceCents / 100).toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-zinc-600 capitalize">{order.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
