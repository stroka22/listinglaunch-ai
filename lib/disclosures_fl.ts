import type { DisclosureAnswer, ListingDisclosures, ListingDisclosuresMetadata } from "@/lib/types";

export type DisclosurePackageId =
  | "seller_property"
  | "lead_based_paint"
  | "hoa_condo"
  | "flood"
  | "radon";

export interface DisclosureQuestionDef {
  id: string;
  packageId: DisclosurePackageId;
  label: string;
  helper?: string;
}

export const FL_DISCLOSURE_QUESTIONS: DisclosureQuestionDef[] = [
  {
    id: "roof_leaks",
    packageId: "seller_property",
    label: "Are you aware of any past or current roof leaks?",
  },
  {
    id: "water_intrusion",
    packageId: "seller_property",
    label: "Are you aware of any past or current water intrusion or flooding inside the home?",
  },
  {
    id: "structural_issues",
    packageId: "seller_property",
    label: "Are you aware of any structural issues with the foundation, walls, or framing?",
  },
  {
    id: "hvac_issues",
    packageId: "seller_property",
    label: "Are you aware of any problems with the heating or cooling systems?",
  },
  {
    id: "electrical_plumbing_issues",
    packageId: "seller_property",
    label: "Are you aware of any problems with the electrical or plumbing systems?",
  },
  {
    id: "pest_termite_history",
    packageId: "seller_property",
    label: "Are you aware of any past or current termite or other wood-destroying organism activity?",
  },
  {
    id: "hoa_violations_disputes",
    packageId: "hoa_condo",
    label: "Are you aware of any HOA or condo association violations, disputes, or unpaid assessments?",
  },
  {
    id: "lead_based_paint_known",
    packageId: "lead_based_paint",
    label: "If the property was built before 1978, are you aware of any known lead-based paint or lead hazards?",
  },
  {
    id: "flooding_past",
    packageId: "flood",
    label: "Are you aware of any past flooding on the property, whether or not an insurance claim was filed?",
  },
  {
    id: "radon_testing",
    packageId: "radon",
    label: "Has the property ever been tested for radon gas?",
  },
];

export function createEmptyDisclosures(
  partial: Partial<ListingDisclosuresMetadata>,
): ListingDisclosures {
  const metadata: ListingDisclosuresMetadata = {
    state: "FL",
    propertyType: partial.propertyType ?? null,
    yearBuilt: partial.yearBuilt ?? null,
    occupancyStatus: partial.occupancyStatus ?? null,
    hoaOrCondo: partial.hoaOrCondo ?? null,
    sellerType: partial.sellerType ?? null,
  };

  return {
    metadata,
    answers: {},
  };
}

export function getActivePackages(meta: ListingDisclosuresMetadata): DisclosurePackageId[] {
  const packages: DisclosurePackageId[] = ["seller_property", "radon"]; // FL radon advisory is general.

  if (meta.yearBuilt != null && meta.yearBuilt < 1978) {
    packages.push("lead_based_paint");
  }

  if (meta.hoaOrCondo && meta.hoaOrCondo !== "none") {
    packages.push("hoa_condo");
  }

  packages.push("flood");
  return packages;
}

export function packagesForQuestion(
  meta: ListingDisclosuresMetadata,
): DisclosureQuestionDef[] {
  const active = new Set(getActivePackages(meta));
  return FL_DISCLOSURE_QUESTIONS.filter((q) => active.has(q.packageId));
}

export function updateDisclosureAnswer(
  disclosures: ListingDisclosures,
  questionId: string,
  answer: DisclosureAnswer,
): ListingDisclosures {
  return {
    ...disclosures,
    answers: {
      ...disclosures.answers,
      [questionId]: answer,
    },
  };
}
