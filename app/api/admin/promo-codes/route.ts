import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          code?: string;
          credits?: number;
          maxRedemptions?: number | null;
          perAgentLimit?: number | null;
          expiresAt?: string | null;
          notes?: string | null;
          active?: boolean;
        }
      | null;

    const rawCode = body?.code?.trim();
    const credits = body?.credits ?? 0;

    if (!rawCode || !credits || credits <= 0) {
      return NextResponse.json(
        { error: "code and positive credits are required" },
        { status: 400 },
      );
    }

    const code = rawCode.toUpperCase();
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from("promo_codes").insert({
      code,
      credits,
      max_redemptions: body?.maxRedemptions ?? null,
      per_agent_limit: body?.perAgentLimit ?? null,
      expires_at: body?.expiresAt ?? null,
      active: body?.active ?? true,
      notes: body?.notes ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("admin promo POST error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create promo code" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          id?: string;
          active?: boolean;
        }
      | null;

    const id = body?.id?.trim();
    if (!id || typeof body?.active !== "boolean") {
      return NextResponse.json(
        { error: "id and active are required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { error } = await supabase
      .from("promo_codes")
      .update({ active: body.active })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("admin promo PATCH error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to update promo code" },
      { status: 500 },
    );
  }
}
