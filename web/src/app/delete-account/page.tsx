import type { Metadata } from "next";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = { title: "Delete your account" };

export default function DeleteAccount() {
  return (
    <LegalPage title="Delete your DEEN account" updated="30 September 2026">
      <p>You can permanently delete your account from the DEEN app:</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Open DEEN and unlock it.</li>
        <li>Go to <b>Me → Privacy &amp; data</b>.</li>
        <li>Tap <b>Delete account</b> and confirm with your password.</li>
      </ol>
      <h2>What is deleted</h2>
      <p>Your profile, saved opportunities, notifications, identity documents and directory listings are erased immediately. Your name and contact details are removed from applications you sent. Payment records are kept in de-identified form as required by Kenyan tax law.</p>
      <h2>Can&apos;t access the app?</h2>
      <p>Email <b>privacy@deen.africa</b> from the email on your account, or with your phone number, and we will delete it within 14 days.</p>
    </LegalPage>
  );
}
