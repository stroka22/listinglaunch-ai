import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const { id } = await Promise.resolve(context.params);
    const body = (await request.json().catch(() => null)) as { agentId?: string } | null;
    const agentId = body?.agentId;

    if (!id || !agentId) {
      return NextResponse.json({ error: "id and agentId are required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("agent_id", agentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Delete failed" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const { id } = await Promise.resolve(context.params);
    const body = (await request.json().catch(() => null)) as { agentId?: string; archived?: boolean } | null;
    const agentId = body?.agentId;

    if (!id || !agentId) {
      return NextResponse.json({ error: "id and agentId are required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { error } = await supabase
      .from("listings")
      .update({ archived: body?.archived ?? true })
      .eq("id", id)
      .eq("agent_id", agentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Update failed" }, { status: 500 });
  }
}
