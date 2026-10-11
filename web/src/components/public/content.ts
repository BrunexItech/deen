/** Shared website content. Plain words, short lines: written for everyone in the community. */
import {
  Ban, Briefcase, Building2, CalendarClock, CircleUserRound, FileSearch, Globe, GraduationCap, HandHeart, Landmark, Link2,
  ListChecks, Send, Target, TrendingUp, Users, type LucideIcon,
} from "lucide-react";

export type PublicOpp = {
  id: string; title: string; summary: string; type: string; category: string; organization: { name: string } | null;
  days_left: number | null; location: string | null; amount_label: string | null; closing_soon: boolean;
};
export type Fee = { amount_kes: number; period_months: number; covers: string[]; free_monthly_applications: number | null; active: boolean; note: string | null };
export type Stats = { live_opportunities: number; verified_organizations: number; members: number };

export const periodLabel = (months: number) => (months === 1 ? "per month" : months === 12 ? "per year" : `every ${months} months`);

export const LETTERS: [string, string, string][] = [
  ["D", "Development", "Grow your skills, career and business."],
  ["E", "Education", "Scholarships, training and learning."],
  ["E", "Empowerment", "Real access to real opportunities."],
  ["N", "Network", "Trusted organizations and a strong community."],
];

export const CATEGORIES: { key: string; icon: LucideIcon; title: string; line: string; items: string[] }[] = [
  { key: "education", icon: GraduationCap, title: "Education", line: "Pay for school and keep learning.", items: ["Scholarships", "Fellowships", "Exchange programmes", "Training", "Workshops"] },
  { key: "career", icon: Briefcase, title: "Career", line: "Get experience and get hired.", items: ["Jobs", "Attachments", "Internships", "Graduate trainee", "Volunteering", "Mentorship"] },
  { key: "entrepreneurship", icon: TrendingUp, title: "Business", line: "Start and grow your business.", items: ["Grants", "Funding", "Incubators", "Accelerators", "Market access"] },
  { key: "community", icon: Users, title: "Community", line: "Programmes that lift people up.", items: ["Youth programmes", "Women programmes", "Climate", "Humanitarian", "Government programmes"] },
  { key: "islamic_economy", icon: Landmark, title: "Islamic economy", line: "Halal finance and enterprise.", items: ["Islamic finance", "Halal business", "Muslim enterprise", "Islamic studies"] },
  { key: "support", icon: HandHeart, title: "Support", line: "Help when you need it most.", items: ["Zakat", "Sadaqah", "Medical help", "Education help", "Emergency help"] },
];

export const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CircleUserRound, title: "Create your profile", body: "Tell us what you study, what you do and where you live." },
  { icon: Target, title: "See what fits you", body: "DEEN shows the opportunities that match you, and says why." },
  { icon: Send, title: "Apply with confidence", body: "Every opportunity is checked by DEEN before you see it." },
  { icon: ListChecks, title: "Track and grow", body: "Follow every application and get reminders before deadlines." },
];

export const CHECKS: { icon: LucideIcon; text: string }[] = [
  { icon: Building2, text: "The organization is real and registered" },
  { icon: Globe, text: "Its website and contacts work" },
  { icon: Link2, text: "The application link is safe" },
  { icon: CalendarClock, text: "The deadline and requirements are clear" },
  { icon: FileSearch, text: "The details and documents are genuine" },
  { icon: Ban, text: "Nobody asks you to pay to apply" },
];

export const PEOPLE = ["Students", "Graduates", "Job seekers", "Professionals", "Business owners", "Women entrepreneurs", "Volunteers", "Community workers"];

export const SAFETY_RULES = [
  "Never pay money to apply for any opportunity.",
  "DEEN will never ask for your password or M-Pesa PIN.",
  "Only apply through the link shown in the DEEN app.",
  "See something wrong? Tap Report on the opportunity.",
];

export const FAQ: { group: string; items: [string, string][] }[] = [
  {
    group: "About DEEN",
    items: [
      ["What is DEEN?", "DEEN is an app for the Muslim community in Kenya. It brings scholarships, jobs, attachments, business funding and support into one safe place."],
      ["What does D.E.E.N stand for?", "Development and Education Empowerment Network."],
      ["Is DEEN only for Kenya?", "Yes, for now. You can still find international opportunities that are open to people in Kenya."],
      ["Is DEEN a religious social network?", "No. DEEN is about opportunities. It serves the Muslim community, but it is not a place for debates or posts."],
    ],
  },
  {
    group: "Joining and using the app",
    items: [
      ["Is it free to join?", "Yes. Joining, browsing and saving opportunities is free."],
      ["Which phones does it work on?", "Android phones. Download the app from this website. An iPhone version will follow."],
      ["How does DEEN know what suits me?", "From your profile: what you study, your skills, where you live and what you are looking for. The app tells you why each opportunity fits."],
      ["Can I track applications I made outside DEEN?", "Yes. Add them to your Tracker so everything is in one place."],
    ],
  },
  {
    group: "Membership fee",
    items: [
      ["Why is there a fee?", "The fee pays for checking organizations, SMS alerts, servers and support. It keeps DEEN independent and free of scams."],
      ["How much is it?", "DEEN sets one fee for everyone. See the Membership page for the current amount."],
      ["How do I pay?", "On this website with M-Pesa. Go to Pay fee, enter your phone number and the code we send you, then confirm on your phone."],
      ["Can I pay for someone else?", "Yes. On the Pay fee page, choose \"For someone else\" and enter their phone number."],
      ["Why can't I pay inside the app?", "Paying on the website means every shilling goes to DEEN and the community."],
    ],
  },
  {
    group: "Safety and privacy",
    items: [
      ["Why does DEEN check every opportunity?", "To stop scams and fake offers. Nothing appears in the app until DEEN has checked it."],
      ["Is my information safe?", "Yes. Your data is encrypted, the app locks with your fingerprint, and we follow Kenya's Data Protection Act. We never sell your data."],
      ["Can I delete my account?", "Yes, at any time. In the app go to Me, then Privacy and data. Or use the Delete my account page."],
      ["I saw a scam. What do I do?", "Tap Report on the opportunity in the app, or contact us. We act quickly."],
    ],
  },
  {
    group: "Organizations",
    items: [
      ["Who can post opportunities?", "Only organizations that DEEN has checked and added. Organizations cannot sign themselves up."],
      ["How does my organization join?", "Contact DEEN. We check your organization, then create your account."],
    ],
  },
];
