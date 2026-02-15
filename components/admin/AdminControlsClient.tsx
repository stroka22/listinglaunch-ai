"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface AdminAgentSummary {
  id: string;
  name: string;
  email: string;
  credits: number;
}

interface AdminPromoSummary {
  id: string;
  code: string;
  credits: number;
  maxRedemptions: number | null;
  perAgentLimit: number | null;
  expiresAt: string | null;
  active: boolean;
  notes: string | null;
  totalRedemptions: number;
  uniqueAgents: number;
  createdAt: string;
}

interface AdminControlsClientProps {
  agents: AdminAgentSummary[];
  promos: AdminPromoSummary[];
}

export function AdminControlsClient({ agents, promos }: AdminControlsClientProps) {
  const router = useRouter();

  const [creatingPromo, setCreatingPromo] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: "",
    credits: 1,
    maxRedemptions: "",
    perAgentLimit: "",
    expiresAt: "",
    notes: "",
    active: true,
  });
  const [promoCreateError, setPromoCreateError] = useState<string | null>(null);
  const [promoCreateStatus, setPromoCreateStatus] = useState<string | null>(null);

  const [manualAgentId, setManualAgentId] = useState<string>(
    agents[0]?.id ?? "",
  );
  const [manualDelta, setManualDelta] = useState<string>("1");
  const [manualReason, setManualReason] = useState<string>("manual_adjustment");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualStatus, setManualStatus] = useState<string | null>(null);

  function handlePromoInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setPromoForm((prev) => ({ ...prev, [name]: value }));
  }

  function handlePromoCheckboxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, checked } = e.target;
    setPromoForm((prev) => ({ ...prev, [name]: checked }));
  }

  async function handleCreatePromo(e: FormEvent) {
    e.preventDefault();
    const code = promoForm.code.trim();
    if (!code) return;

    setPromoCreateError(null);
    setPromoCreateStatus(null);
    setCreatingPromo(true);
    try {
      const payload = {
        code,
        credits: Number(promoForm.credits) || 0,
        maxRedemptions:
          promoForm.maxRedemptions.trim() === ""
            ? null
            : Number(promoForm.maxRedemptions),
        perAgentLimit:
          promoForm.perAgentLimit.trim() === ""
            ? null
            : Number(promoForm.perAgentLimit),
        expiresAt:
          promoForm.expiresAt.trim() === "" ? null : promoForm.expiresAt,
        notes: promoForm.notes.trim() || null,
        active: promoForm.active,
      };

      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create promo code.");
      }

      setPromoCreateStatus("Promo code created.");
      setPromoForm({
        code: "",
        credits: 1,
        maxRedemptions: "",
        perAgentLimit: "",
        expiresAt: "",
        notes: "",
        active: true,
      });
      router.refresh();
    } catch (err: any) {
      setPromoCreateError(err?.message ?? "Failed to create promo code.");
    } finally {
      setCreatingPromo(false);
    }
  }

  async function togglePromoActive(id: string, nextActive: boolean) {
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, active: nextActive }),
      });

      if (!res.ok) {
        // Silent failure; admin can refresh and try again
        return;
      }

      router.refresh();
    } catch {
      // Ignore errors for now
    }
  }

  async function handleManualCredits(e: FormEvent) {
    e.preventDefault();
    const deltaNum = Number(manualDelta);
    if (!manualAgentId || !Number.isFinite(deltaNum) || deltaNum === 0) return;

    setManualError(null);
    setManualStatus(null);
    setManualLoading(true);
    try {
      const res = await fetch("/api/admin/manual-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: manualAgentId,
          delta: deltaNum,
          reason: manualReason.trim() || "manual_adjustment",
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error(json?.error || "Failed to adjust credits.");
      }

      setManualStatus("Manual credit entry recorded.");
      setManualDelta("1");
      router.refresh();
    } catch (err: any) {
      setManualError(err?.message ?? "Failed to adjust credits.");
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-zinc-900">Promo codes</h2>
            <p className="text-[11px] text-zinc-500">
              Create and manage promo codes that grant free listing credits.
            </p>
          </div>
        </div>

        <div className="mb-4 overflow-x-auto rounded-md border border-zinc-200">
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="bg-zinc-50">
              <tr className="text-left uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-1.5">Code</th>
                <th className="px-3 py-1.5">Credits</th>
                <th className="px-3 py-1.5">Limits</th>
                <th className="px-3 py-1.5">Usage</th>
                <th className="px-3 py-1.5">Expires</th>
                <th className="px-3 py-1.5">Status</th>
                <th className="px-3 py-1.5">Notes</th>
                <th className="px-3 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-2 text-[11px] text-zinc-500"
                  >
                    No promo codes configured yet.
                  </td>
                </tr>
              ) : (
                promos.map((promo) => (
                  <tr
                    key={promo.id}
                    className="border-t border-zinc-100 align-top"
                  >
                    <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-900">
                      {promo.code}
                    </td>
                    <td className="px-3 py-1.5 text-[11px] text-zinc-700">
                      {promo.credits}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-zinc-700">
                      <div>
                        Max total: {promo.maxRedemptions ?? "∞"}
                      </div>
                      <div>
                        Per agent: {promo.perAgentLimit ?? "∞"}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-zinc-700">
                      <div>
                        Uses: {promo.totalRedemptions}
                      </div>
                      <div>
                        Agents: {promo.uniqueAgents}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-zinc-700">
                      {promo.expiresAt
                        ? new Date(promo.expiresAt).toLocaleDateString()
                        : "None"}
                    </td>
                    <td className="px-3 py-1.5 text-[10px]">
                      {promo.active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-zinc-700">
                      {promo.notes || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-zinc-700">
                      <button
                        type="button"
                        onClick={() => togglePromoActive(promo.id, !promo.active)}
                        className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-700 hover:bg-zinc-100"
                      >
                        {promo.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleCreatePromo} className="space-y-2">
          <div className="text-[11px] font-semibold text-zinc-800">
            Create new promo
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-zinc-700">
                Code
              </label>
              <input
                name="code"
                value={promoForm.code}
                onChange={handlePromoInputChange}
                placeholder="WELCOME3"
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-zinc-700">
                Credits
              </label>
              <input
                name="credits"
                type="number"
                min={1}
                value={promoForm.credits}
                onChange={(e) =>
                  setPromoForm((prev) => ({
                    ...prev,
                    credits: Number(e.target.value) || 1,
                  }))
                }
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-zinc-700">
                Expires at (ISO date/time)
              </label>
              <input
                name="expiresAt"
                value={promoForm.expiresAt}
                onChange={handlePromoInputChange}
                placeholder="2026-12-31T23:59:59Z"
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-zinc-700">
                Max redemptions (all agents)
              </label>
              <input
                name="maxRedemptions"
                value={promoForm.maxRedemptions}
                onChange={handlePromoInputChange}
                placeholder="blank = unlimited"
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-zinc-700">
                Per-agent limit
              </label>
              <input
                name="perAgentLimit"
                value={promoForm.perAgentLimit}
                onChange={handlePromoInputChange}
                placeholder="blank = unlimited per agent"
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-zinc-700">
                Notes (internal)
              </label>
              <input
                name="notes"
                value={promoForm.notes}
                onChange={handlePromoInputChange}
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
              />
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[10px] text-zinc-700">
              <input
                type="checkbox"
                name="active"
                checked={promoForm.active}
                onChange={handlePromoCheckboxChange}
              />
              <span>Active</span>
            </label>
            <button
              type="submit"
              disabled={creatingPromo || !promoForm.code.trim()}
              className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white disabled:opacity-60"
            >
              {creatingPromo ? "Creating…" : "Create promo"}
            </button>
          </div>
          {promoCreateStatus && (
            <div className="text-[10px] text-emerald-700">
              {promoCreateStatus}
            </div>
          )}
          {promoCreateError && (
            <div className="text-[10px] text-red-700">{promoCreateError}</div>
          )}
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Manual credit adjustments
            </h2>
            <p className="text-[11px] text-zinc-500">
              Add or subtract credits from a specific agent. Use cautiously.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleManualCredits}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-zinc-700">
              Agent
            </label>
            <select
              value={manualAgentId}
              onChange={(e) => setManualAgentId(e.target.value)}
              className="min-w-[180px] rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-800"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || agent.email || agent.id} — {agent.credits} credits
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-zinc-700">
              Delta (e.g. 3 or -1)
            </label>
            <input
              type="number"
              value={manualDelta}
              onChange={(e) => setManualDelta(e.target.value)}
              className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="block text-[10px] font-medium text-zinc-700">
              Reason (internal)
            </label>
            <input
              type="text"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-2 py-1 text-[11px]"
            />
          </div>
          <button
            type="submit"
            disabled={manualLoading}
            className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white disabled:opacity-60"
          >
            {manualLoading ? "Saving…" : "Apply"}
          </button>
        </form>
        {manualStatus && (
          <div className="mt-2 text-[10px] text-emerald-700">
            {manualStatus}
          </div>
        )}
        {manualError && (
          <div className="mt-2 text-[10px] text-red-700">{manualError}</div>
        )}
      </section>
    </div>
  );
}

