import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          code?: string;
          agentId?: string;
        }
      | null;

    const rawCode = body?.code?.trim();
    const agentId = body?.agentId?.trim();

    if (!rawCode || !agentId) {
      return NextResponse.json(
        { error: "code and agentId are required" },
        { status: 400 },
      );
    }

    const code = rawCode.toUpperCase();
    const supabase = getSupabaseServerClient();

    const { data: promo, error: promoError } = await supabase
      .from("promo_codes")
      .select(
        "id, code, credits, max_redemptions, per_agent_limit, expires_at, active",
      )
      .eq("code", code)
      .single();

    if (promoError || !promo) {
      return NextResponse.json(
        { error: "Promo code not found" },
        { status: 404 },
      );
    }

    if (!promo.active) {
      return NextResponse.json(
        { error: "This promo code is not active." },
        { status: 400 },
      );
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This promo code has expired." },
        { status: 400 },
      );
    }

    const { data: redemptions, error: redemptionsError } = await supabase
      .from("promo_redemptions")
      .select("id, agent_id")
      .eq("promo_code_id", promo.id);

    if (redemptionsError) {
      return NextResponse.json(
        { error: redemptionsError.message },
        { status: 500 },
      );
    }

    const allUses = redemptions ?? [];

    if (
      promo.max_redemptions != null &&
      allUses.length >= promo.max_redemptions
    ) {
      return NextResponse.json(
        { error: "This promo code has already been fully redeemed." },
        { status: 400 },
      );
    }

    const agentUses = allUses.filter((r: any) => r.agent_id === agentId).length;
    if (
      promo.per_agent_limit != null &&
      agentUses >= promo.per_agent_limit
    ) {
      return NextResponse.json(
        { error: "You have already used this promo code." },
        { status: 400 },
      );
    }

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from("agent_credit_ledger")
      .insert({
        agent_id: agentId,
        delta: promo.credits,
        reason: "promo",
        listing_id: null,
        metadata: { promo_code: promo.code },
      })
      .select("id, agent_id, delta, reason, listing_id, created_at")
      .single();

    if (ledgerError || !ledgerRow) {
      return NextResponse.json(
        { error: ledgerError?.message || "Could not apply promo credits" },
        { status: 500 },
      );
    }

    const { error: redemptionError } = await supabase
      .from("promo_redemptions")
      .insert({
        promo_code_id: promo.id,
        agent_id: agentId,
      });

    if (redemptionError) {
      return NextResponse.json(
        { error: redemptionError.message },
        { status: 500 },
      );
    }

    const { data: balanceRows, error: balanceError } = await supabase
      .from("agent_credit_ledger")
      .select("delta")
      .eq("agent_id", agentId);

    if (balanceError) {
      return NextResponse.json(
        { error: balanceError.message },
        { status: 500 },
      );
    }

    const newBalance = (balanceRows ?? []).reduce(
      (sum: number, row: any) => sum + (row.delta as number),
      0,
    );

    return NextResponse.json({
      creditsAdded: promo.credits,
      newBalance,
      ledgerEntry: {
        id: ledgerRow.id as string,
        agentId: ledgerRow.agent_id as string,
        delta: ledgerRow.delta as number,
        reason: ledgerRow.reason as string,
        listingId: (ledgerRow.listing_id as string | null) ?? null,
        createdAt: ledgerRow.created_at as string,
      },
    });
  } catch (err: any) {
    console.error("redeem-promo error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to redeem promo code" },
      { status: 500 },
    );
  }
}
