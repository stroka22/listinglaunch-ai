import OpenAI from "openai";

import type {
  ListingAiContent,
  PublicRemarksStyle,
  PropertySnapshot,
  AgentProfile,
  MortgagePartnerProfile,
} from "@/lib/types";

export interface AiGenerationContext {
  listingId: string;
  addressLine: string;
  property: PropertySnapshot;
  interiorFeatures: string[];
  exteriorFeatures: string[];
  communityFeatures: string[];
  upgrades: string[];
  showingInstructions: string | null;
  disclosures: string | null;
  agent: AgentProfile;
  mortgagePartner: MortgagePartnerProfile | null;
}

export interface GeneratedCopyPayload {
  mlsPublicRemarks: Record<PublicRemarksStyle, string>;
  mlsPrivateRemarks: string;
  featureBulletsInterior: string[];
  featureBulletsExterior: string[];
  featureBulletsCommunity: string[];
  socialInstagram: string;
  socialFacebook: string;
  socialLinkedIn: string;
}

function createClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

export async function generateListingCopy(
  ctx: AiGenerationContext,
): Promise<GeneratedCopyPayload> {
  const client = createClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You are an assistant that writes MLS-ready listing copy for Stellar MLS in Florida. Follow Stellar MLS rules, avoid fair housing violations, and keep public remarks under 1000 characters. Always respond as strict JSON only, with no additional text.",
      },
      {
        role: "user",
        content: [
          "Generate listing copy and marketing text for this property.",
          "\n\nAddress:",
          ctx.addressLine,
          "\n\nCore property data (may include AI-augmented values; treat as agent-confirmed unless flagged otherwise):",
          JSON.stringify(ctx.property),
          "\n\nInterior features:",
          JSON.stringify(ctx.interiorFeatures),
          "\n\nExterior features:",
          JSON.stringify(ctx.exteriorFeatures),
          "\n\nCommunity features:",
          JSON.stringify(ctx.communityFeatures),
          "\n\nUpgrades:",
          JSON.stringify(ctx.upgrades),
          "\n\nShowing instructions:",
          ctx.showingInstructions ?? "",
          "\n\nDisclosures:",
          ctx.disclosures ?? "",
          "\n\nAgent profile (for branding tone only):",
          JSON.stringify(ctx.agent),
          "\n\nMortgage partner (optional, for co-branded marketing only; do not mention in MLS remarks):",
          JSON.stringify(ctx.mortgagePartner),
          "\n\nRespond with JSON only in this shape:",
          JSON.stringify({
            mlsPublicRemarks: {
              standard: "...",
              lifestyle: "...",
              investor: "...",
            },
            mlsPrivateRemarks: "...",
            featureBulletsInterior: ["..."],
            featureBulletsExterior: ["..."],
            featureBulletsCommunity: ["..."],
            socialInstagram: "...",
            socialFacebook: "...",
            socialLinkedIn: "...",
          }),
        ].join(" "),
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  const parsed = JSON.parse(raw) as GeneratedCopyPayload;

  return parsed;
}

export function buildListingAiContent(
  listingId: string,
  payload: GeneratedCopyPayload,
): ListingAiContent {
  return {
    id: listingId,
    listingId,
    mlsPublicRemarks: payload.mlsPublicRemarks,
    mlsPrivateRemarks: payload.mlsPrivateRemarks,
    featureBulletsInterior: payload.featureBulletsInterior,
    featureBulletsExterior: payload.featureBulletsExterior,
    featureBulletsCommunity: payload.featureBulletsCommunity,
    socialInstagram: payload.socialInstagram,
    socialFacebook: payload.socialFacebook,
    socialLinkedIn: payload.socialLinkedIn,
  };
}
