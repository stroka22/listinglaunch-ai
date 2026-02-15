import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { AdminControlsClient } from "@/components/admin/AdminControlsClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-xs text-zinc-600">
        <h1 className="mb-2 text-lg font-semibold tracking-tight text-zinc-900">
          Admin console not configured
        </h1>
        <p className="mb-1">
          The admin area requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to
          be set in the environment. Regular agent features are unaffected.
        </p>
        <p>
          Add these environment variables in your deployment (and optionally in
          .env.local) to enable the admin console.
        </p>
      </div>
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const [
    { data: agentRows },
    { data: listingRows },
    { data: ledgerRows },
    { data: promoRows },
    { data: promoRedemptionRows },
    { data: orderRows },
    { data: packageRows },
  ] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("id, name, email, brokerage, phone")
      .order("created_at", { ascending: true }),
    supabase.from("listings").select("id, agent_id"),
    supabase.from("agent_credit_ledger").select("agent_id, delta"),
    supabase
      .from("promo_codes")
      .select(
        "id, code, credits, max_redemptions, per_agent_limit, expires_at, active, notes, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("promo_redemptions")
      .select("promo_code_id, agent_id"),
    supabase
      .from("credit_orders")
      .select(
        "id, agent_id, package_id, credits, price_cents, status, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("credit_packages")
      .select("id, name, slug, credits, price_cents"),
  ]);

  const listingsByAgent = new Map<string, number>();
  (listingRows ?? []).forEach((row: any) => {
    const agentId = row.agent_id as string;
    listingsByAgent.set(
      agentId,
      (listingsByAgent.get(agentId) ?? 0) + 1,
    );
  });

  const creditsByAgent = new Map<string, number>();
  (ledgerRows ?? []).forEach((row: any) => {
    const agentId = row.agent_id as string;
    const delta = row.delta as number;
    creditsByAgent.set(agentId, (creditsByAgent.get(agentId) ?? 0) + delta);
  });

  const agents = (agentRows ?? []).map((row: any) => {
    const id = row.id as string;
    return {
      id,
      name: (row.name as string | null) ?? "",
      email: (row.email as string | null) ?? "",
      brokerage: (row.brokerage as string | null) ?? "",
      phone: (row.phone as string | null) ?? "",
      listings: listingsByAgent.get(id) ?? 0,
      credits: creditsByAgent.get(id) ?? 0,
    };
  });

  const agentLabelById = new Map<string, string>();
  agents.forEach((a) => {
    const label = a.name || a.email || a.id;
    agentLabelById.set(a.id, label);
  });

  const promoUsageById = new Map<
    string,
    { total: number; uniqueAgents: Set<string> }
  >();
  (promoRedemptionRows ?? []).forEach((row: any) => {
    const pid = row.promo_code_id as string;
    const aid = row.agent_id as string;
    if (!promoUsageById.has(pid)) {
      promoUsageById.set(pid, { total: 0, uniqueAgents: new Set<string>() });
    }
    const entry = promoUsageById.get(pid)!;
    entry.total += 1;
    entry.uniqueAgents.add(aid);
  });

  const promos = (promoRows ?? []).map((row: any) => {
    const id = row.id as string;
    const usage = promoUsageById.get(id);
    return {
      id,
      code: (row.code as string).toUpperCase(),
      credits: row.credits as number,
      maxRedemptions: (row.max_redemptions as number | null) ?? null,
      perAgentLimit: (row.per_agent_limit as number | null) ?? null,
      expiresAt: (row.expires_at as string | null) ?? null,
      active: (row.active as boolean) ?? false,
      notes: (row.notes as string | null) ?? null,
      createdAt: row.created_at as string,
      totalRedemptions: usage?.total ?? 0,
      uniqueAgents: usage ? usage.uniqueAgents.size : 0,
    };
  });

  const totalListings = (listingRows ?? []).length;
  const totalAgents = agents.length;
  const netCreditsIssued = (ledgerRows ?? []).reduce(
    (sum: number, row: any) => sum + (row.delta as number),
    0,
  );

  const totalPromoCredits = promos.reduce(
    (sum, promo) => sum + promo.credits * (promo.totalRedemptions || 0),
    0,
  );
  const totalPromoRedemptions = promos.reduce(
    (sum, promo) => sum + (promo.totalRedemptions || 0),
    0,
  );

  const packagesById = new Map<string, any>();
  (packageRows ?? []).forEach((row: any) => {
    packagesById.set(row.id as string, row);
  });

  const orders = (orderRows ?? []).map((row: any) => {
    const pkg = packagesById.get(row.package_id as string);
    const agentId = row.agent_id as string;
    return {
      id: row.id as string,
      agentId,
      agentLabel: agentLabelById.get(agentId) ?? agentId,
      packageName: (pkg?.name as string | undefined) ?? "(Unknown)",
      credits: row.credits as number,
      priceCents: row.price_cents as number,
      status: row.status as string,
      createdAt: row.created_at as string,
    };
  });

  const totalOrders = orders.length;
  const totalPaidOrders = orders.filter((o) => o.status === "paid").length;
  const totalRevenueCents = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + (o.priceCents || 0), 0);


  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Admin console
          </h1>
          <p className="text-xs text-zinc-500">
            Internal view of agents, listings, and credit balances. Restrict
            access to this route to product admins only.
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Agents
          </div>
          <p className="text-2xl font-semibold text-zinc-900">{totalAgents}</p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Unique agent profiles that have been created in the system.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Listings
          </div>
          <p className="text-2xl font-semibold text-zinc-900">
            {totalListings}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Total listings across all agents.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Credits issued (net)
          </div>
          <p className="text-2xl font-semibold text-zinc-900">
            {netCreditsIssued}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Sum of all credit debits and credits.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Promo codes
          </div>
          <p className="text-2xl font-semibold text-zinc-900">
            {promos.length}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Total promo codes configured (active and inactive).
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Promo redemptions
          </div>
          <p className="text-2xl font-semibold text-zinc-900">
            {totalPromoRedemptions}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Total times promo codes have been redeemed.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Credits granted via promos
          </div>
          <p className="text-2xl font-semibold text-zinc-900">
            {totalPromoCredits}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Estimated credits given away from all promo redemptions.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Agents</h2>
        </div>
        {agents.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No agent profiles found yet. Profiles are created when agents save
            their branding details.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-zinc-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Brokerage</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Listings</th>
                  <th className="px-3 py-2">Credits</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-t border-zinc-100 align-top"
                  >
                    <td className="px-3 py-2 text-[11px] text-zinc-800">
                      <div>
                        <Link
                          href={`/admin/agents/${agent.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {agent.name || "(Unnamed agent)"}
                        </Link>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {agent.email || agent.id}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {agent.brokerage || "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {agent.phone || "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {agent.listings}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {agent.credits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold">Billing & orders</h2>
            <p className="text-[11px] text-zinc-500">
              Overview of credit purchases across all agents.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-zinc-700">
            <span>
              Orders: <span className="font-medium">{totalOrders}</span>
            </span>
            <span>
              Paid: <span className="font-medium">{totalPaidOrders}</span>
            </span>
            <span>
              Revenue: 
              <span className="font-medium">
                ${ (totalRevenueCents / 100).toFixed(2) }
              </span>
            </span>
          </div>
        </div>
        {orders.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No credit orders have been created yet.
          </p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full border-collapse">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr className="text-left">
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Package</th>
                  <th className="px-3 py-2">Credits</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-zinc-100 align-top text-[11px]"
                  >
                    <td className="px-3 py-2 text-zinc-800">
                      {order.agentLabel}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {order.packageName}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {order.credits}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      ${ (order.priceCents / 100).toFixed(2) }
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {order.status}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdminControlsClient
        agents={agents.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          credits: a.credits,
        }))}
        promos={promos}
      />
    </div>
  );
}
