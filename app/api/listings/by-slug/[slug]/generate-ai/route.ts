import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateListingCopy, buildListingAiContent } from "@/lib/ai";
import type { Listing } from "@/lib/types";

export async function POST(_request: NextRequest, context: any) {
  const slug = context?.params?.slug ?? (await context?.params)?.slug;

  if (!slug) {
    return NextResponse.json(
      { error: "Missing listing slug in URL", debugSlug: slug ?? null },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, sms_keyword, sms_phone_number, estated_raw, property, branding, wizard_answers, ai_content",
      )
      .eq("slug", slug)
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

    const { error: updateError } = await supabase
      .from("listings")
      .update({ ai_content: aiContent })
      .eq("id", listing.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ aiContent });
  } catch (err: any) {
    console.error("AI generation by slug failed", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate AI content" },
      { status: 500 },
    );
  }
}
