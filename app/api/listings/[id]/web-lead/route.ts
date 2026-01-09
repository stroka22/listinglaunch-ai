import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface RouteContext {
  params: { id: string };
}

export async function POST(request: Request, context: RouteContext) {
  const id = context.params.id;

  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
    };

    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from("leads").insert({
      listing_id: id,
      name: body.name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      message: body.message ?? null,
      source: "web",
      opted_in: true,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Web lead creation failed", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create lead" },
      { status: 500 },
    );
  }
}
