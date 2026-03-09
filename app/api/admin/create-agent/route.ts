import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Admin not configured" },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      email?: string;
      password?: string;
      name?: string;
      brokerage?: string;
      phone?: string;
      credits?: number;
    } | null;

    const email = body?.email?.trim().toLowerCase();
    const password = body?.password?.trim();
    const name = body?.name?.trim() || null;
    const brokerage = body?.brokerage?.trim() || null;
    const phone = body?.phone?.trim() || null;
    const credits = body?.credits ?? 0;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create auth user" },
        { status: 400 },
      );
    }

    const agentId = authData.user.id;

    // Create agent profile
    const { error: profileError } = await supabase
      .from("agent_profiles")
      .upsert(
        {
          id: agentId,
          email,
          name,
          brokerage,
          phone,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      console.error("[admin/create-agent] profile insert error", profileError.message);
    }

    // Grant initial credits if specified
    if (credits > 0) {
      const { error: ledgerError } = await supabase
        .from("agent_credit_ledger")
        .insert({
          agent_id: agentId,
          delta: credits,
          reason: "admin_grant",
          listing_id: null,
          metadata: { note: "Initial credits granted by admin" },
        });

      if (ledgerError) {
        console.error("[admin/create-agent] ledger insert error", ledgerError.message);
      }
    }

    return NextResponse.json({
      ok: true,
      agentId,
      email,
    });
  } catch (err: any) {
    console.error("[admin/create-agent] error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create agent" },
      { status: 500 },
    );
  }
}
