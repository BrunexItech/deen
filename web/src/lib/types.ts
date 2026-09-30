export type Portal = "admin" | "org" | "member";

export interface Me {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  portal: Portal;
  permissions: string[];
  totp_enabled: boolean;
  avatar_url: string | null;
  organization: { id: string; name: string; verification: Verification; logo_url: string | null } | null;
}

export type Verification = "pending" | "verified" | "trusted";

export type OppStatus =
  | "draft" | "submitted" | "under_review" | "info_requested" | "verification"
  | "approved" | "published" | "rejected" | "expired" | "archived";

export interface Flag {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
}

export interface Question {
  id?: string;
  label: string;
  kind: string;
  required: boolean;
  options: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  type: string;
  tags: string[];
  eligibility: string;
  benefits: string;
  requirements: string;
  application_process: string | null;
  counties: string[];
  location: string;
  location_label: string | null;
  is_remote: boolean;
  is_international: boolean;
  education_levels: string[];
  min_age: number | null;
  max_age: number | null;
  gender: string | null;
  skills: string[];
  requires_verified_identity: boolean;
  deadline: string | null;
  days_left: number | null;
  starts_at: string | null;
  ends_at: string | null;
  venue: string | null;
  is_event: boolean;
  amount_label: string | null;
  slots: number | null;
  apply_mode: "external" | "internal";
  external_url: string | null;
  form_questions: Question[];
  required_documents: string[];
  attachments: { file_id: string; label: string; url: string }[];
  access_tier: "free" | "member" | "premium";
  status: OppStatus;
  featured: boolean;
  feature_requested: boolean;
  flags: Flag[];
  risk_score?: number;
  organization: { id: string; name: string; verification: Verification; logo_url: string | null; website?: string | null };
  views_count: number;
  clicks_count: number;
  saves_count: number;
  applications_count: number;
  published_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Taxonomy {
  categories: { key: string; name: string; tab_label: string; color: string; icon: string; live_count?: number; active?: boolean; description?: string; types: { key: string; name: string; active?: boolean }[] }[];
  counties: string[];
  education_levels: { key: string; name: string }[];
  employment_statuses: { key: string; name: string }[];
  languages: string[];
  skills: string[];
}

export interface AdminOrg {
  id: string; name: string; type: string; tagline: string | null; county: string | null; email: string | null;
  website: string | null; verification: Verification; status: string; logo_url: string | null; created_at: string;
  opportunities?: number; team?: number; premium: boolean;
}

export const ORG_TYPES = ["ngo", "foundation", "university", "business", "islamic_org", "mosque", "charity", "government",
  "scholarship_provider", "employer", "training_institution", "financial_institution", "community"];
