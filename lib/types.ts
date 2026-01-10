export type FieldSource = "public_record" | "agent_confirmed" | "ai_generated";

export interface PropertyField<T> {
  value: T | null;
  source: FieldSource;
  confidence: number | null;
  confirmedByAgent: boolean;
}

export interface PropertySnapshot {
  beds: PropertyField<number>;
  baths: PropertyField<number>;
  squareFeet: PropertyField<number>;
  lotSizeSqFt: PropertyField<number>;
  yearBuilt: PropertyField<number>;
  propertyType: PropertyField<string>;
  parcelId: PropertyField<string>;
  annualTaxes: PropertyField<number>;
}

export interface AgentProfile {
  id: string;
  userId: string;
  name: string;
  brokerage: string;
  phone: string;
  email: string;
  headshotUrl: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface MortgagePartnerProfile {
  id: string;
  agentId: string;
  name: string;
  company: string;
  nmlsId: string;
  phone: string;
  email: string;
  headshotUrl: string | null;
  logoUrl: string | null;
  bio: string | null;
  bioSource: FieldSource;
}

export type PublicRemarksStyle = "standard" | "lifestyle" | "investor";

export interface ListingAiContent {
  id: string;
  listingId: string;
  mlsPublicRemarks: Record<PublicRemarksStyle, string | null>;
  mlsPrivateRemarks: string | null;
  featureBulletsInterior: string[];
  featureBulletsExterior: string[];
  featureBulletsCommunity: string[];
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialLinkedIn: string | null;
}

export type DisclosureAnswer = "yes" | "no" | "unknown";

export interface ListingDisclosuresMetadata {
  state: "FL";
  propertyType: string | null;
  yearBuilt: number | null;
  occupancyStatus: "owner" | "tenant" | "vacant" | null;
  hoaOrCondo: "hoa" | "condo" | "both" | "none" | null;
  sellerType: "individual" | "estate" | "trust" | "llc" | null;
}

export interface ListingDisclosures {
  metadata: ListingDisclosuresMetadata;
  answers: Record<string, DisclosureAnswer>;
}

export interface Listing {
  id: string;
  agentId: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  status: "draft" | "ready_for_mls" | "published";
  smsKeyword: string | null;
  smsPhoneNumber: string | null;
  creditConsumed?: boolean;
  estatedRaw: unknown | null;
  property: PropertySnapshot;
  branding?: {
    agent: AgentProfile;
    mortgagePartner: MortgagePartnerProfile | null;
  } | null;
  aiContent?: ListingAiContent | null;
  wizardAnswers?: Record<string, string> | null;
  disclosures?: ListingDisclosures | null;
}

export interface ListingLead {
  id: string;
  listingId: string;
  createdAt: string;
  phone: string;
  source: "sms" | "web";
  optedIn: boolean;
}

export interface AgentCreditLedgerEntry {
  id: string;
  agentId: string;
  delta: number;
  reason: string;
  listingId: string | null;
  createdAt: string;
}

export interface CreditPackage {
  id: string;
  slug: string;
  name: string;
  credits: number;
  priceCents: number;
  active: boolean;
  sortOrder: number;
}

export interface CreditOrder {
  id: string;
  agentId: string;
  packageId: string;
  credits: number;
  priceCents: number;
  status: "pending" | "paid" | "failed" | "refunded";
  createdAt: string;
}

