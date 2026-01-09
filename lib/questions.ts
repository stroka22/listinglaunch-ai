export type QuestionCategory =
  | "structure_systems"
  | "interior"
  | "exterior_community"
  | "showing_disclosures";

export interface SmartQuestion {
  id: string;
  category: QuestionCategory;
  label: string;
  helper?: string;
}

export const SMART_QUESTIONS: SmartQuestion[] = [
  {
    id: "roof_type_age",
    category: "structure_systems",
    label: "Roof type & approximate age",
    helper: "Example: Architectural shingle roof, replaced in 2018 (approx. 7 years old).",
  },
  {
    id: "hvac_type_age",
    category: "structure_systems",
    label: "HVAC type & approximate age",
    helper: "Example: 3-ton heat pump system, replaced in 2021 with new ductwork.",
  },
  {
    id: "water_sewer",
    category: "structure_systems",
    label: "Water & sewer",
    helper: "Example: Public water and sewer, reclaimed water for irrigation.",
  },
  {
    id: "flooring",
    category: "interior",
    label: "Main flooring types",
    helper: "Example: Luxury vinyl plank in living areas, tile in wet spaces, carpet in bedrooms.",
  },
  {
    id: "appliances",
    category: "interior",
    label: "Kitchen appliances & age/brand highlights",
  },
  {
    id: "key_upgrades",
    category: "interior",
    label: "Key interior upgrades or recent renovations",
    helper: "Example: Remodeled kitchen (2022), updated primary bath, new interior paint.",
  },
  {
    id: "pool_waterfront_garage",
    category: "exterior_community",
    label: "Pool, waterfront, and garage details",
    helper: "Include pool type (screened, heated, saltwater), waterfront type, and garage parking.",
  },
  {
    id: "hoa_fees_amenities",
    category: "exterior_community",
    label: "HOA fees & amenities (if applicable)",
    helper: "Monthly/annual fees, community pool, clubhouse, gated entry, etc.",
  },
  {
    id: "showing_instructions",
    category: "showing_disclosures",
    label: "Showing instructions (for private remarks only)",
    helper: "Example: 2-hour notice, appointment only, alarm code in showing instructions.",
  },
  {
    id: "material_disclosures",
    category: "showing_disclosures",
    label: "Material facts or disclosures (for private remarks)",
    helper: "Example: Roof near end of life, previous settlement repair, audio/video on premises.",
  },
];
