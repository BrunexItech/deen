# Google Play launch checklist

## Listing
- **App name:** DEEN · Muslim Opportunities
- **Package:** `africa.deen.app` (permanent: never change it after the first upload)
- **Icon:** `assets/brand/icon.png` (1024 → Play asks for 512×512; export with `inkscape assets/brand/icon.svg -w 512`)
- **Category:** Education (or Social). Content rating: Everyone.
- **Upload format:** `./gradlew bundleRelease` → `.aab` signed with the upload key in `~/.deen-keys/`.
  Enrol in **Play App Signing**; keep the upload key backed up offline.

## Policies that need a decision before submission
1. **Payments policy.** Google requires **Google Play Billing** for in-app purchases of *digital* features
   (the Member / Premium tiers unlock digital content). Selling them inside the Android app through
   M-Pesa STK Push can get the app rejected. Options:
   - a) Keep M-Pesa as it is and sell memberships only on the web (the app then shows the membership status and
     links to the web page, as many "reader"-style apps do), or
   - b) Add Google Play Billing for the Android store build (M-Pesa can be a payment method *inside*
     Play Billing in Kenya through carrier/M-Pesa options), or
   - c) Apply for Google's user choice / alternative billing programme where available.
   Sponsored memberships ("gift"), organization fees and **donations to verified charities** can use external
   payments. Donations have their own exemption.
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
