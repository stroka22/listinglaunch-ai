import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, _context: any) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  // Expected: ["api", "listings", "<id>", "workspace"]
  const id = segments[2];

  if (!id || !/^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid listing id in URL", debugId: id ?? null, path: url.pathname },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, sms_keyword, sms_phone_number, estated_raw, property, branding, ai_content, wizard_answers, disclosures",
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Listing not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ listing: data });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Workspace listing load failed", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to load listing for workspace" },
      { status: 500 },
    );
  }
}
