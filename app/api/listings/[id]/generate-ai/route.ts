import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateListingCopy, buildListingAiContent } from "@/lib/ai";
import type { Listing } from "@/lib/types";

export async function POST(request: NextRequest, context: any) {
  // Prefer path parsing to be robust to params issues
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  // Expected: ["api", "listings", "<id>", "generate-ai"]
  const idFromPath = segments[2];
  const idCandidateFromContext =
    context?.params?.id ?? (await context?.params)?.id ?? null;
  const id = idFromPath ?? idCandidateFromContext;

  if (
    !id ||
    !/^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(
      id,
    )
  ) {
    return NextResponse.json(
      { error: "Invalid listing id in URL for generate-ai", debugId: id ?? null, path: url.pathname },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, sms_keyword, sms_phone_number, credit_consumed, estated_raw, property, branding, wizard_answers, ai_content",
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Listing not found" },
        { status: 404 },
      );
    }

    const row = data as any;

    const listing: Listing = {
      id: row.id,
      agentId: row.agent_id,
      slug: row.slug,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      street: row.street,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      status: row.status,
      smsKeyword: row.sms_keyword,
      smsPhoneNumber: row.sms_phone_number,
      creditConsumed: row.credit_consumed,
      estatedRaw: row.estated_raw,
      property: row.property,
      branding: row.branding,
      aiContent: row.ai_content,
      wizardAnswers: row.wizard_answers,
    };

    const answers = listing.wizardAnswers ?? {};

    const interiorFeatures = [
      answers.flooring,
      answers.appliances,
      answers.key_upgrades,
    ].filter(Boolean) as string[];

    const exteriorFeatures = [answers.pool_waterfront_garage].filter(
      Boolean,
    ) as string[];

    const communityFeatures = [answers.hoa_fees_amenities].filter(
      Boolean,
    ) as string[];

    const showingInstructions = (answers.showing_instructions ?? "") as string;
    const disclosures = (answers.material_disclosures ?? "") as string;

    const agent =
      listing.branding?.agent ??
      ({
        id: listing.agentId,
        userId: listing.agentId,
        name: "Listing agent",
        brokerage: "",
        phone: "",
        email: "",
        headshotUrl: null,
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
      } as any);

    const mortgagePartner = listing.branding?.mortgagePartner ?? null;

    const addressLine = `${listing.street}, ${listing.city}, ${listing.state} ${listing.postalCode}`;

    const payload = await generateListingCopy({
      listingId: listing.id,
      addressLine,
      property: listing.property,
      interiorFeatures,
      exteriorFeatures,
      communityFeatures,
      upgrades: interiorFeatures,
      showingInstructions: showingInstructions || null,
      disclosures: disclosures || null,
      agent,
      mortgagePartner,
    });

    const aiContent = buildListingAiContent(listing.id, payload);

    const creditAlreadyConsumed = !!row.credit_consumed;

    if (!creditAlreadyConsumed) {
      const { data: ledgerRows, error: ledgerError } = await supabase
        .from("agent_credit_ledger")
        .select("delta")
        .eq("agent_id", listing.agentId);

      if (ledgerError) {
        return NextResponse.json(
          { error: ledgerError.message },
          { status: 500 },
        );
      }

      const balance = (ledgerRows ?? []).reduce(
        (sum: number, row: any) => sum + (row.delta as number),
        0,
      );

      if (balance <= 0) {
        return NextResponse.json(
          {
            error: "You do not have any listing credits available.",
            code: "NO_CREDITS",
            balance,
          },
          { status: 402 },
        );
      }

      const { error: ledgerInsertError } = await supabase
        .from("agent_credit_ledger")
        .insert({
          agent_id: listing.agentId,
          delta: -1,
          reason: "listing_consume",
          listing_id: listing.id,
        });

      if (ledgerInsertError) {
        return NextResponse.json(
          { error: ledgerInsertError.message },
          { status: 500 },
        );
      }
    }

    const updatePayload: Record<string, any> = { ai_content: aiContent };
    if (!creditAlreadyConsumed) {
      updatePayload.credit_consumed = true;
    }

    const { error: updateError } = await supabase
      .from("listings")
      .update(updatePayload)
      .eq("id", listing.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ aiContent });
  } catch (err: any) {
    console.error("AI generation failed", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate AI content" },
      { status: 500 },
    );
  }
}
