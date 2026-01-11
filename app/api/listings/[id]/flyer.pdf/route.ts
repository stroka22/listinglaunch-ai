import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateOpenHouseFlyerPdf } from "@/lib/pdf";
import type { Listing } from "@/lib/types";

export async function GET(request: NextRequest, context: any) {
  const url = new URL(request.url);
  const id = context?.params?.id ?? (await context?.params)?.id;

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, agent_id, slug, created_at, updated_at, street, city, state, postal_code, status, sms_keyword, sms_phone_number, archived, estated_raw, property, branding, ai_content, wizard_answers",
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
      archived: row.archived,
      estatedRaw: row.estated_raw,
      property: row.property,
      branding: row.branding,
      aiContent: row.ai_content,
      wizardAnswers: row.wizard_answers,
    };

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

    const hubUrl = `${url.origin}/listing/${listing.slug}`;

    const includeMortgageParam = url.searchParams.get("co");
    const includeMortgagePartner =
      includeMortgageParam === null ? true : includeMortgageParam === "1";

    const openHouseDateTime =
      (listing.wizardAnswers as any)?.open_house_details ?? null;

    const pdfBuffer = await generateOpenHouseFlyerPdf({
      listing,
      aiContent: listing.aiContent ?? null,
      agent,
      mortgagePartner: includeMortgagePartner ? mortgagePartner : null,
      openHouseDateTime,
      qrCodeUrl: hubUrl,
      smsKeyword: listing.smsKeyword,
      smsPhoneNumber: listing.smsPhoneNumber,
    });

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=open-house-flyer.pdf",
      },
    });
  } catch (err: any) {
    console.error("Flyer PDF generation failed", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate open house flyer PDF" },
      { status: 500 },
    );
  }
}
