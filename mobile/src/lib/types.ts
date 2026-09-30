export interface Membership {
  tier: "free" | "member" | "premium";
  plan_code: string;
  plan_name: string;
  ends_at: string | null;
  features: { monthly_applications: number | null; advanced_matching?: boolean; premium_opportunities?: boolean; mentorship?: boolean };
  sponsored: boolean;
  applications_this_month?: number;
}

export interface Me {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  portal: "member" | "admin" | "org";
  identity_status: "none" | "pending" | "verified" | "rejected";
  avatar_url: string | null;
  membership: Membership | null;
  created_at: string;
}

export interface Match {
  score: number;
  eligible: boolean;
  reasons: string[];
  blockers: string[];
}

export interface OrgMini {
  id: string;
  name: string;
  verification: "pending" | "verified" | "trusted";
  logo_url: string | null;
  county?: string | null;
  tagline?: string | null;
  website?: string | null;
}

export interface OppCard {
  id: string;
  title: string;
  summary: string;
  category: string;
  type: string;
  organization: OrgMini;
  deadline: string | null;
  days_left: number | null;
  closing_soon: boolean;
  location: string;
  is_remote: boolean;
  is_event: boolean;
  starts_at: string | null;
  amount_label: string | null;
  access_tier: "free" | "member" | "premium";
  locked: boolean;
  featured: boolean;
  saved: boolean;
  match: Match | null;
}

export interface Question {
  id: string;
  label: string;
  kind: "short_text" | "long_text" | "single_choice" | "multi_choice" | "yes_no" | "number" | "date";
  required: boolean;
  options: string[];
}

export interface OppDetail extends OppCard {
  description: string;
  eligibility: string;
  benefits: string;
  requirements: string;
  application_process: string | null;
  tags: string[];
  counties: string[];
  education_levels: string[];
  skills: string[];
  min_age: number | null;
  max_age: number | null;
  gender: string | null;
  ends_at: string | null;
  venue: string | null;
  slots: number | null;
  requires_verified_identity: boolean;
  apply_mode: "external" | "internal";
  external_url: string | null;
  form_questions: Question[];
  required_documents: string[];
  attachments: { file_id: string; label: string; url: string }[];
  application: { id: string; status: string; created_at: string } | null;
  share_url: string;
}

export interface Feed {
  summary: { category: string; count: number }[];
  total_matches: number;
  featured: OppCard[];
  closing_soon: OppCard[];
  for_you: OppCard[];
  events: OppCard[];
  tier: string;
  profile_ready: boolean;
}

export interface Application {
  id: string;
  status: string;
  cover_note: string | null;
  answers: Record<string, unknown>;
  external: boolean;
  created_at: string;
  updated_at: string;
  opportunity: OppCard;
  events?: { status: string; message: string | null; at: string }[];
  outcome_shared?: boolean;
}

export interface Profile {
  county: string | null;
  town: string | null;
  date_of_birth: string | null;
  gender: string | null;
  education_level: string | null;
  field_of_study: string | null;
  institution: string | null;
  profession: string | null;
  employment_status: string | null;
  bio: string | null;
  skills: string[];
  interests: string[];
  opportunity_types: string[];
  career_interests: string[];
  business_interests: string[];
  languages: string[];
  completeness: number;
  missing: string[];
  onboarding_completed: boolean;
}

export interface Taxonomy {
  categories: { key: string; name: string; tab_label: string; color: string; live_count: number; types: { key: string; name: string }[] }[];
  counties: string[];
  education_levels: { key: string; name: string }[];
  employment_statuses: { key: string; name: string }[];
  languages: string[];
  skills: string[];
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  tier: string;
  price_kes: number;
  interval_months: number;
  benefits: string[];
  highlight: boolean;
}

export interface Reminder {
  id: string;
  kind: "ayah" | "hadith" | "dua";
  arabic: string | null;
  text: string;
  reference: string;
}

export interface Zakat {
  gold_price_per_gram_kes: number;
  silver_price_per_gram_kes: number;
  nisab_basis: "gold" | "silver";
  gold_nisab_grams: number;
  silver_nisab_grams: number;
  rate: number;
  note: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
  created_at: string;
}

export interface Listing {
  id: string; kind: string; name: string; headline: string; category: string; category_label: string; description: string | null;
  county: string | null; town: string | null; phone: string | null; whatsapp: string | null; email: string | null; website: string | null;
  services: string[]; halal_certified: boolean; verified: boolean; status?: string; review_note?: string | null;
}
