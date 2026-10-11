import type { Metadata } from "next";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="30 September 2026">
      <p>DEEN connects Muslims in Kenya with verified opportunities. This policy explains what we collect, why, and your rights under the Kenya Data Protection Act, 2019.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> name, phone number, optional email, password (stored only as a secure hash).</li>
        <li><b>Profile:</b> county, date of birth, gender, education, skills, interests and preferences, used to match you with opportunities.</li>
        <li><b>Sensitive data:</b> using DEEN implies your religion, which the Act treats as sensitive. We process it only with your explicit consent, given at sign-up.</li>
        <li><b>Identity verification (optional):</b> a photo of your ID and a selfie, encrypted at rest and seen only by DEEN verification officers.</li>
        <li><b>Applications:</b> answers and documents you choose to send to an organization. Only that organization and DEEN can see them.</li>
        <li><b>Location (optional):</b> used on your phone for prayer times and the Qibla. It is not stored on our servers.</li>
        <li><b>Payments:</b> M-Pesa number, amount and receipt for the community fee, which is paid on the DEEN website.</li>
      </ul>
      <h2>How we protect it</h2>
      <p>Encryption in transit and at rest for sensitive files, biometric app lock, rotating session tokens, role-based staff access with two-step verification, and an audit log of every sensitive access.</p>
      <h2>Who we share with</h2>
      <p>Organizations receive your details only when you apply to them. Service providers (SMS, email, M-Pesa, hosting) process data on our instructions. We never sell personal data.</p>
      <h2>Your rights</h2>
      <p>You can access, correct, export and delete your data at any time: in the app go to <b>Me → Privacy &amp; data</b>. You may also complain to the Office of the Data Protection Commissioner.</p>
      <h2>Contact</h2>
      <p>privacy@deen.africa</p>
    </LegalPage>
  );
}
