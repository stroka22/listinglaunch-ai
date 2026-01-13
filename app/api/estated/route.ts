import { NextResponse } from "next/server";
import { lookupPropertyFromEstated } from "@/lib/estated";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };

    const street = body.street?.trim();
    const city = body.city?.trim();
    const state = body.state?.trim();
    const postalCode = body.postalCode?.trim();

    if (!street || !city || !state || !postalCode) {
      return NextResponse.json(
        { error: "street, city, state, and postalCode are required" },
        { status: 400 },
      );
    }

    const result = await lookupPropertyFromEstated({
      street,
      city,
      state,
      postalCode,
    });

    return NextResponse.json({
      snapshot: result.snapshot,
      raw: result.raw,
      schoolsRaw: result.schoolsRaw ?? null,
      warnings: result.warnings,
    });
  } catch (err: any) {
    console.error("Estated lookup failed", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to look up property" },
      { status: 500 },
    );
  }
}
