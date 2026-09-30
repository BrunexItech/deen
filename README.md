# DEEN

**Opportunity infrastructure for the Muslim community in Kenya.**

`MUSLIMS ← DEEN → ORGANIZATIONS`

Organizations submit opportunities: scholarships, jobs, business funding, zakat and sadaqah support, learning and community programmes. DEEN verifies each one, matches it to the right members, distributes it, and measures who actually benefited.

| Part | Folder | Stack |
|---|---|---|
| Member app (Android, iOS-ready) | `mobile/` | Expo 57 · React Native 0.86 · Expo Router · TanStack Query · Reanimated 4 |
| DEEN Control Center + Organization Portal | `web/` | Next.js 16 · React 19 · Tailwind 4 · TanStack Query · Recharts |
| API + background worker | `backend/` | FastAPI · async SQLAlchemy 2 · PostgreSQL 16 · Redis (optional) |
| Brand | `assets/brand/` | Official DEEN logo (`deen-logo-original.png`) and every size derived from it by `build_assets.py` |

---

## Run it locally

```bash
# 1. Database (Postgres on :5437)
docker compose up -d

# 2. API (:8020), with the background worker embedded in development
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
SEED_ADMIN_PASSWORD='choose-one' .venv/bin/python -m app.seed --demo
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8020

# 3. Web portal (:3020)
cd web && npm install && npm run build && npx next start -p 3020

# 4. Mobile app (needs a development build because of native modules)
cd mobile && npm install
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8020 npx expo run:android
```

**Demo accounts** (created by `--demo`; every organization and person in it is fictional):

| Where | Login | Password |
|---|---|---|
| Control Center `/login` | `admin@deen.africa` | the `SEED_ADMIN_PASSWORD` you chose |
| Organization Portal `/login` | `admin1@org.demo` … `admin8@org.demo` | `DemoPass2026` |
| Mobile app | `0700000001` (Amina), `0700000002`, `0700000003` | `DemoPass2026` |

In development, SMS codes are shown on screen ("Development code") and M-Pesa payments settle themselves after about 5 seconds. Long-press the logo on the app's welcome screen to point it at a different API server.

Tests: `cd backend && .venv/bin/pytest` (27 tests: auth and security, the full review/matching/apply loop, payments, privacy and the engines).

---

## Architecture

```
mobile (Expo) ──bearer + rotating refresh──┐
                                           ├──► FastAPI (stateless, N replicas) ──► PostgreSQL
web (Next.js) ──httpOnly cookies, /api─────┘            │                              ▲
                                                        └── jobs table ◄── worker (N) ─┘
```

Each backend module lives in `backend/app/modules/<name>/` (`models`, `service`, `router`):
`users` (auth, sessions, profiles) · `orgs` · `opportunities` (matching, risk scanner, review workflow) · `applications` · `subscriptions` (plans, M-Pesa) · `notifications` (in-app, Expo push, email, SMS) · `moderation` · `directory` · `identity` · `content` (Qur'an/hadith/du'a reminders, zakat) · `files` · `admin` · `audit` · `jobs`.

### Core loops

- **Organization → Submit → DEEN verifies → Publish → Members discover.** Only DEEN creates organizations (`/admin/organizations`). It invites their representatives and grades them *Pending → Verified → Trusted*. Every submission is scanned automatically for missing information, shortened, insecure or IP links, domain mismatch, requests for payment, duplicates, deadline problems and unverified organizations. Reviewers work a risk-sorted queue with actions to start review, send to verification, request information, approve, publish or decline, and a conversation thread with the organization.
- **Member → Profile → Match → Opportunity → Application.** The matching engine (`opportunities/matching.py`) scores 0–100 from interests, preferred types, location, education, skills, profession keywords, learned affinity and urgency. It explains every match ("In Mombasa, near you · Matches your education"), and hard eligibility blockers (county, education, age, gender) hide an opportunity from *For You* while still explaining it in Explore.
- **Distribution.** Publishing enqueues a fan-out job. It keyset-walks member profiles in batches of 2,000 with a SQL pre-filter, scores each batch and notifies strong matches and followers. A million members becomes about 500 short jobs spread across workers.
- **Impact.** Accepted applications plus members' own "I got it!" stories are counted as *successful connections*, the headline metric of the Control Center.

### Security

- **App lock.** Biometric (fingerprint/face) unlock with PIN fallback on every launch and after 30 seconds in the background. Changing the lock itself requires biometrics.
- **Tokens.** Access tokens are short-lived and held in memory only. Refresh tokens rotate on every use and live in the Android Keystore (SecureStore). Replaying an old refresh token revokes the whole session. Every request checks its session row, so signing out everywhere or suspending a user takes effect immediately.
- **Web portal.** httpOnly SameSite cookies, a CSRF header required on writes, TOTP two-step verification (can be enforced for all staff in production), and granular RBAC across 9 roles and 21 permissions.
- **Brute force.** Account lockout after 6 failed sign-ins, rate limits on auth, OTP and report endpoints (Redis-backed across replicas), and constant-time checks so unknown accounts can't be detected.
- **Data protection.** Identity documents and application files are encrypted at rest (Fernet), EXIF (including GPS) is stripped from images, ID numbers are encrypted, and screenshots are blocked on the identity screen. Every sensitive view and admin action goes to the audit log.
- **Kenya Data Protection Act 2019.** Religion counts as sensitive personal data, so sign-up requires explicit consent. Members can export their data and delete their account from the app.
- **Android hardening.** `allowBackup=false`, no unnecessary permissions (microphone, storage, overlay and background location are blocked), and a production refusal to boot with default secrets.

### Scaling to a million members

The API is stateless, so replicas scale out behind the gateway. Pagination is keyset-based on hot paths, and indexes cover every feed and queue query: GIN for full-text search, counties and interests. Counters are denormalised, so there are no `COUNT(*)` on hot reads. Work that fans out (notifications, announcements, matching) runs on a Postgres `SKIP LOCKED` job queue that any number of workers drain. Redis shares rate limits across replicas. File storage sits behind a two-method interface, so moving to S3/R2 is a single class. When needed, `engagement_events` can be partitioned by month and read replicas can serve analytics.

---

## Build the Android app

```bash
cd mobile
npx expo prebuild --platform android --clean
cd android
DEEN_UPLOAD_STORE_FILE=~/.deen-keys/deen-upload.jks DEEN_UPLOAD_KEY_ALIAS=deen-upload \
DEEN_UPLOAD_STORE_PASSWORD=… DEEN_UPLOAD_KEY_PASSWORD=… \
./gradlew assembleRelease   # APK  → app/build/outputs/apk/release/
./gradlew bundleRelease     # AAB  → for Google Play
```

The upload keystore lives in `~/.deen-keys/`, outside git. **Back it up somewhere safe.** Google Play needs the same key for every future update.

For the store build set `EXPO_PUBLIC_API_URL=https://your-domain`. The build then turns cleartext HTTP off automatically.

Push notifications need a (free) EAS project id: `npx eas-cli init`, then set `EAS_PROJECT_ID` when building.

## Deploy

`deploy/docker-compose.prod.yml` runs Postgres, Redis, the API, the worker, the web portal and an nginx gateway. Copy `deploy/.env.example` to `deploy/.env`, fill in fresh secrets, then:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.prod.yml exec api python -m app.seed
```

Before launch:
- Register with the ODPC as a data controller.
- Get an Africa's Talking sender ID and M-Pesa Daraja production credentials (callback URL: `/api/v1/payments/mpesa/callback/<MPESA_CALLBACK_TOKEN>`).
- Check the Google Play payments policy for how the membership is sold (see the notes in `docs/PLAY_STORE.md`).
