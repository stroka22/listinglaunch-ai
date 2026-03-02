export interface SellerQuestion {
  id: string;
  category: "condition" | "systems" | "legal" | "features" | "history";
  label: string;
  helper?: string;
  feedsField?: string; // wizard_answers key this can auto-populate
}

export const SELLER_INTERVIEW_QUESTIONS: SellerQuestion[] = [
  // ── Condition ──
  {
    id: "roof_leaks",
    category: "condition",
    label: "Are you aware of any past or current roof leaks?",
    helper: "If yes, note when it was repaired and by whom.",
  },
  {
    id: "roof_replacement",
    category: "condition",
    label: "When was the roof last replaced or repaired?",
    helper: "Include year and company if known. This helps populate the Roof field.",
    feedsField: "roof_type_age",
  },
  {
    id: "water_intrusion",
    category: "condition",
    label: "Are you aware of any water intrusion, moisture damage, or mold?",
  },
  {
    id: "structural_issues",
    category: "condition",
    label: "Are you aware of any foundation, structural, or framing issues?",
  },
  {
    id: "pest_termite_history",
    category: "condition",
    label: "Any past or current termite or wood-destroying organism activity?",
    helper: "Note treatment dates and company.",
  },
  {
    id: "sinkholes",
    category: "condition",
    label: "Any known sinkhole activity on or near the property?",
  },

  // ── Systems ──
  {
    id: "hvac_issues",
    category: "systems",
    label: "Any problems with the A/C or heating system? When was it last serviced or replaced?",
    feedsField: "hvac_type_age",
  },
  {
    id: "electrical_plumbing_issues",
    category: "systems",
    label: "Any known electrical or plumbing issues?",
  },
  {
    id: "water_heater_age",
    category: "systems",
    label: "How old is the water heater? Type (tank/tankless)?",
    feedsField: "water_heater",
  },
  {
    id: "appliances_convey",
    category: "systems",
    label: "Which appliances will convey with the sale?",
    helper: "List all: refrigerator, washer/dryer, dishwasher, microwave, etc.",
    feedsField: "appliances",
  },
  {
    id: "home_warranty",
    category: "systems",
    label: "Is there an existing home warranty? Will one be offered to the buyer?",
  },

  // ── Legal & Financial ──
  {
    id: "hoa_violations_disputes",
    category: "legal",
    label: "Any HOA or condo association violations, unpaid assessments, or pending special assessments?",
  },
  {
    id: "lead_based_paint_known",
    category: "legal",
    label: "Any known lead-based paint? (Required for pre-1978 homes)",
  },
  {
    id: "insurance_claims",
    category: "legal",
    label: "Any insurance claims filed on the property in the past 5 years?",
    helper: "Include type (wind, water, etc.) and outcome.",
  },
  {
    id: "liens_encumbrances",
    category: "legal",
    label: "Any liens, code violations, or pending legal actions on the property?",
  },
  {
    id: "survey_available",
    category: "legal",
    label: "Is there an existing survey available?",
  },

  // ── Features & Improvements ──
  {
    id: "recent_renovations",
    category: "features",
    label: "Any renovations or upgrades in the last 5 years?",
    helper: "Kitchen, bathrooms, flooring, windows, etc. Note year completed.",
    feedsField: "key_upgrades",
  },
  {
    id: "pool_condition",
    category: "features",
    label: "If there's a pool/spa, what is the condition? Heated? Screened?",
    feedsField: "pool_waterfront_garage",
  },
  {
    id: "flooring_details",
    category: "features",
    label: "What type of flooring is in the home? Any recent changes?",
    feedsField: "flooring",
  },
  {
    id: "parking_details",
    category: "features",
    label: "Garage details: attached/detached, number of cars, any carport?",
    feedsField: "parking_garage",
  },

  // ── History & Occupancy ──
  {
    id: "flooding_past",
    category: "history",
    label: "Has the property ever flooded, whether or not a claim was filed?",
    feedsField: "flood_zone",
  },
  {
    id: "occupancy_current",
    category: "history",
    label: "Is the property currently occupied? If rented, when does the lease expire?",
    feedsField: "occupancy_status",
  },
  {
    id: "reason_selling",
    category: "history",
    label: "What is the reason for selling?",
    helper: "Helps the agent understand motivation and timeline.",
  },
  {
    id: "desired_timeline",
    category: "history",
    label: "What is the seller's desired closing timeline?",
  },
];

export const SELLER_INTERVIEW_CATEGORIES: { key: string; label: string }[] = [
  { key: "condition", label: "Property Condition" },
  { key: "systems", label: "Systems & Appliances" },
  { key: "legal", label: "Legal & Financial" },
  { key: "features", label: "Features & Improvements" },
  { key: "history", label: "History & Occupancy" },
];
