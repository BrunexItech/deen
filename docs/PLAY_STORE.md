# Google Play launch checklist

## Listing
- **App name:** DEEN · Muslim Opportunities
- **Package:** `africa.deen.app` (permanent: never change it after the first upload)
- **Icon:** `assets/brand/icon.png` (1024 → Play asks for 512×512; export with `inkscape assets/brand/icon.svg -w 512`)
- **Category:** Education (or Social). Content rating: Everyone.
- **Upload format:** `./gradlew bundleRelease` → `.aab` signed with the upload key in `~/.deen-keys/`.
  Enrol in **Play App Signing**; keep the upload key backed up offline.

## Payments (decided)
DEEN charges one **community maintenance fee**. The super admin sets its amount and period in the Control Center
(Billing → Fee). Members pay it **on the website** (`/pay`) by M-Pesa, never inside the app, so no Google Play Billing
is needed and Google takes no share.

To stay within Google Play's payments policy, the Android app must:
- show **membership status only** (Me → Membership: paid up / not paid, until when, receipts),
- show **no prices, pay buttons, or links or instructions to pay elsewhere**. Keep it that way in future changes.

## Policies to complete before submission
1. **Payments:** decided, see above.
2. **Data safety form.** Declare: name, phone, email, approximate and precise location (prayer times/Qibla,
   optional), photos (ID verification, optional), religious beliefs (implied by the service: sensitive data),
   app activity. Data is encrypted in transit and at rest, and users can request deletion (in the app: Me → Privacy & data).
3. **Sensitive permissions:** camera (ID verification), location while in use (prayer times/Qibla). No background location.
4. **Account deletion URL:** Google requires a web link too. Add a `/delete-account` page on the web portal
   that explains the in-app flow, or accept requests by email.
5. **Privacy policy URL:** publish one on your domain before submission.

## Kenya compliance
- Register with the **Office of the Data Protection Commissioner** (ODPC) as a data controller and processor.
- Religion counts as *sensitive personal data* under the DPA 2019: keep the explicit consent step at sign-up (already built).
- M-Pesa: use a Paybill/Till registered to the operating entity; Daraja production go-live needs the business documents.
