import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function AdminAgentDetailPage({ params }: PageProps) {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return notFound();
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const agentId = params.id;

  const [
    { data: agentRow },
    { data: listings },
    { data: ledgerRows },
  ] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("id, name, email, brokerage, phone, created_at")
      .eq("id", agentId)
      .maybeSingle(),
    supabase
      .from("listings")
      .select(
        "id, slug, status, credit_consumed, archived, created_at, updated_at, street, city, state, postal_code",
      )
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_credit_ledger")
      .select("id, delta, reason, listing_id, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false }),
  ]);

  if (!agentRow) {
    return notFound();
  }

  const totalListings = (listings ?? []).length;
  const netCredits = (ledgerRows ?? []).reduce(
    (sum: number, row: any) => sum + (row.delta as number),
    0,
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="text-[11px] text-zinc-500">
            <Link href="/admin" className="underline-offset-2 hover:underline">
               Back to admin
            </Link>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            {agentRow.name || "(Unnamed agent)"}
          </h1>
          <div className="text-[11px] text-zinc-500">
            {agentRow.email || agentRow.id}
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Listings
          </div>
          <p className="text-2xl font-semibold text-zinc-900">
            {totalListings}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Total listings created by this agent.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Net credits
          </div>
          <p className="text-2xl font-semibold text-zinc-900">{netCredits}</p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Sum of all credit debits and credits for this agent.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
          <div className="mb-1 text-[11px] font-semibold text-zinc-800">
            Member since
          </div>
          <p className="text-2xl font-semibold text-zinc-900">
            {agentRow.created_at
              ? new Date(agentRow.created_at).toLocaleDateString()
              : ""}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            First time this profile was created.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Listings</h2>
        </div>
        {totalListings === 0 ? (
          <p className="text-xs text-zinc-500">
            This agent has not created any listings yet.
          </p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full border-collapse">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr className="text-left">
                  <th className="px-3 py-2">Listing</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Credit</th>
                  <th className="px-3 py-2">Archived</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {(listings ?? []).map((l: any) => (
                  <tr
                    key={l.id}
                    className="border-t border-zinc-100 align-top text-[11px]"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-800">
                        {l.street}, {l.city} {l.state} {l.postal_code}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {l.slug}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {l.status}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {l.credit_consumed ? "Used" : "Needs credit"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {l.archived ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {l.created_at
                        ? new Date(l.created_at).toLocaleDateString()
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Credit ledger</h2>
        </div>
        {(ledgerRows ?? []).length === 0 ? (
          <p className="text-xs text-zinc-500">
            No credit activity recorded for this agent yet.
          </p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full border-collapse">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr className="text-left">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Delta</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Listing</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerRows ?? []).map((row: any) => (
                  <tr
                    key={row.id}
                    className="border-t border-zinc-100 align-top text-[11px]"
                  >
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : ""}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {row.reason}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-700">
                      {row.listing_id || "—"}
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
