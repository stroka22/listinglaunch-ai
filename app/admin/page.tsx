import { createClient } from "@supabase/supabase-js";

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

  const [{ data: agentRows }, { data: listingRows }, { data: ledgerRows }] =
    await Promise.all([
      supabase
        .from("agent_profiles")
        .select("id, name, email, brokerage, phone")
        .order("created_at", { ascending: true }),
      supabase.from("listings").select("id, agent_id"),
      supabase.from("agent_credit_ledger").select("agent_id, delta"),
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

  const totalListings = (listingRows ?? []).length;
  const totalAgents = agents.length;

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
            {(ledgerRows ?? []).reduce(
              (sum: number, row: any) => sum + (row.delta as number),
              0,
            )}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Sum of all credit debits and credits.
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
                      <div>{agent.name || "(Unnamed agent)"}</div>
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
    </div>
  );
}
