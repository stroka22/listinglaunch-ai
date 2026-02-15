import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          agentId?: string;
          delta?: number;
          reason?: string;
        }
      | null;

    const agentId = body?.agentId?.trim();
    const delta = body?.delta ?? 0;

    if (!agentId || !delta || !Number.isFinite(delta)) {
      return NextResponse.json(
        { error: "agentId and non-zero delta are required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: ledgerRow, error } = await supabase
      .from("agent_credit_ledger")
      .insert({
        agent_id: agentId,
        delta,
        reason: body?.reason?.trim() || "manual_adjustment",
        listing_id: null,
        metadata: null,
      })
      .select("id, agent_id, delta, reason, listing_id, created_at")
      .single();

    if (error || !ledgerRow) {
      return NextResponse.json(
        { error: error?.message || "Failed to insert ledger entry" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      entry: {
        id: ledgerRow.id as string,
        agentId: ledgerRow.agent_id as string,
        delta: ledgerRow.delta as number,
        reason: ledgerRow.reason as string,
        listingId: (ledgerRow.listing_id as string | null) ?? null,
        createdAt: ledgerRow.created_at as string,
      },
    });
  } catch (err: any) {
    console.error("admin manual-credits error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to adjust credits" },
      { status: 500 },
    );
  }
}
