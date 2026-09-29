"""Fictional demo data so every screen has something real to show.
All organizations and people here are invented."""
from datetime import date, timedelta

from sqlalchemy import select

from app.core.clock import utcnow
from app.core.roles import Role
from app.core.security import hash_password
from app.modules.applications.models import Application, ApplicationEvent, AppStatus
from app.modules.directory.models import DirectoryListing, ListingStatus
from app.modules.opportunities.models import AccessTier, ApplyMode, Opportunity, OppStatus
from app.modules.opportunities.service import run_risk_scan
from app.modules.orgs.models import Organization, OrgType, Verification
from app.modules.subscriptions.models import Plan
from app.modules.subscriptions.service import activate
from app.modules.users.models import MemberProfile, User

DEMO_PASSWORD = "DemoPass2026"

ORGS = [
    ("Al-Noor Education Foundation", OrgType.foundation, Verification.trusted, "Nairobi",
     "Opening doors to education for Muslim youth since 2009", "https://alnoor-foundation.example.org"),
    ("Barakah Enterprise Hub", OrgType.business, Verification.verified, "Mombasa",
     "Shariah-compliant finance and training for founders", "https://barakahhub.example.org"),
    ("Iqra Scholars Fund", OrgType.scholarship_provider, Verification.trusted, "Garissa",
     "Full scholarships for bright students from North Eastern Kenya", "https://iqrascholars.example.org"),
    ("Hidaya Tech Academy", OrgType.training_institution, Verification.verified, "Nairobi",
     "Software, data and design skills for the digital economy", "https://hidayatech.example.org"),
    ("Coast Muslim Youth Network", OrgType.community, Verification.verified, "Mombasa",
     "Youth leadership, volunteering and community service at the Coast", "https://cmyn.example.org"),
    ("Ummah Health Initiative", OrgType.ngo, Verification.verified, "Kisumu",
     "Medical support and health careers for underserved communities", "https://ummahhealth.example.org"),
    ("Sakina Zakat Trust", OrgType.charity, Verification.trusted, "Nairobi",
     "Transparent zakat distribution to families in need", "https://sakinatrust.example.org"),
    ("Tawakkul Logistics Ltd", OrgType.employer, Verification.pending, "Nakuru",
     "Regional logistics and supply-chain company", None),
]

LOREM_TAIL = ("Successful applicants will be contacted by email and phone. DEEN has verified this organization and "
              "reviewed this listing. Legitimate opportunities never ask applicants to pay any fee.")


def _opp(org_i, title, category, type_, summary, days, **kw):
    return dict(org_i=org_i, title=title, category=category, type=type_, summary=summary, deadline_days=days, **kw)


OPPS = [
    _opp(0, "Al-Noor University Scholarship 2027", "education", "scholarship",
         "Full tuition and a monthly stipend for first-year students at any public university in Kenya.", 21,
         education_levels=["secondary", "undergraduate"], min_age=17, max_age=24, amount_label="Full tuition + KES 6,000/month",
         apply_mode="internal", skills=[], tags=["university", "tuition", "stipend"], featured=True,
         form_questions=[{"id": "kcse", "label": "KCSE mean grade", "kind": "short_text", "required": True, "options": []},
                         {"id": "course", "label": "Course you were admitted to", "kind": "short_text", "required": True, "options": []},
                         {"id": "why", "label": "Why do you deserve this scholarship?", "kind": "long_text", "required": True, "options": []}],
         required_documents=["KCSE result slip", "Admission letter"]),
    _opp(2, "Iqra North Eastern Scholars Programme", "education", "scholarship",
         "Four-year scholarship covering fees, accommodation and a laptop for students from Garissa, Wajir and Mandera.", 30,
         counties=["Garissa", "Wajir", "Mandera"], education_levels=["secondary", "undergraduate"],
         amount_label="Fees, housing & laptop", apply_mode="internal", tags=["north eastern", "full scholarship"],
         form_questions=[{"id": "school", "label": "Secondary school attended", "kind": "short_text", "required": True, "options": []},
                         {"id": "need", "label": "Tell us about your family's situation", "kind": "long_text", "required": True, "options": []}]),
    _opp(0, "Master's Fellowship in Islamic Finance", "education", "fellowship",
         "Fully funded one-year Master's fellowship for graduates passionate about Islamic banking.", 45,
         education_levels=["graduate", "postgraduate"], is_international=True, amount_label="Fully funded",
         skills=["Islamic finance", "Accounting"], external_url="https://alnoor-foundation.example.org/fellowship",
         access_tier="member", tags=["masters", "islamic finance"]),
    _opp(0, "Hifdh & Arabic Summer Intensive", "education", "quran_program",
         "Six-week residential Qur'an memorisation and Arabic programme for teens. Meals and housing included.", 14,
         min_age=12, max_age=19, counties=["Lamu", "Mombasa", "Kilifi"], apply_mode="internal", tags=["quran", "arabic", "hifdh"],
         form_questions=[{"id": "juz", "label": "How many juz have you memorised?", "kind": "number", "required": True, "options": []}]),
    _opp(3, "Junior Software Developer (Graduate Programme)", "employment", "graduate_program",
         "Join a 12-month paid programme building fintech products with senior mentors. Prayer room and Jumu'ah break.", 18,
         education_levels=["diploma", "undergraduate", "graduate"], skills=["Software development", "Data analysis"],
         amount_label="KES 70,000/month", external_url="https://hidayatech.example.org/careers/graduate",
         tags=["tech", "developer", "graduate"], featured=True),
    _opp(3, "Remote Data Analyst Internship", "employment", "internship",
         "Three-month paid remote internship analysing impact data for NGOs across East Africa.", 9,
         is_remote=True, skills=["Data analysis", "Microsoft Office", "Research"], amount_label="KES 25,000/month",
         external_url="https://hidayatech.example.org/careers/data-intern", tags=["remote", "data", "internship"]),
    _opp(5, "Clinical Officers — Community Health Programme", "employment", "job",
         "Full-time clinical officers for mobile clinics serving Kisumu, Siaya and Homa Bay.", 25,
         counties=["Kisumu", "Siaya", "Homa Bay"], education_levels=["diploma", "undergraduate", "graduate"],
         skills=["Medicine", "Nursing"], amount_label="KES 85,000–110,000/month",
         external_url="https://ummahhealth.example.org/jobs/clinical-officer", tags=["health", "clinical"]),
    _opp(7, "Warehouse Supervisors (Nakuru)", "employment", "job",
         "Supervise inbound and outbound operations at our Nakuru distribution centre.", 20,
         counties=["Nakuru"], skills=["Logistics", "Leadership"], amount_label="KES 45,000/month",
         external_url="https://bit.ly/tawakkul-jobs", tags=["logistics"]),
    _opp(1, "Barakah Halal Startup Grant", "business", "startup_grant",
         "Non-repayable grants for early-stage Muslim-owned businesses, plus six months of mentorship.", 35,
         skills=["Leadership", "Sales"], amount_label="Up to KES 500,000", apply_mode="internal",
         tags=["grant", "startup", "halal"], featured=True, access_tier="member",
         form_questions=[{"id": "biz", "label": "Describe your business in two sentences", "kind": "long_text", "required": True, "options": []},
                         {"id": "stage", "label": "Stage", "kind": "single_choice", "required": True, "options": ["Idea", "Early revenue", "Growing"]},
                         {"id": "use", "label": "How will you use the grant?", "kind": "long_text", "required": True, "options": []}]),
    _opp(1, "Qard Hasan SME Financing", "business", "islamic_finance",
         "Interest-free working-capital financing for traders and small manufacturers at the Coast.", 60,
         counties=["Mombasa", "Kwale", "Kilifi", "Lamu"], amount_label="KES 50,000–300,000, 0% interest",
         external_url="https://barakahhub.example.org/qard-hasan", tags=["financing", "interest-free", "riba-free"]),
    _opp(1, "Women in Business Accelerator", "business", "entrepreneurship",
         "A 10-week accelerator for Muslim women founders: finance, digital marketing and investor readiness.", 12,
         gender="female", skills=["Digital marketing", "Sales"], apply_mode="internal", tags=["women", "accelerator"],
         form_questions=[{"id": "biz", "label": "What does your business do?", "kind": "long_text", "required": True, "options": []}]),
    _opp(6, "Education Zakat Support — School Fees", "support", "education_assistance",
         "Zakat-funded school fee support for secondary and university students from low-income families.", 16,
         education_levels=["secondary", "certificate", "diploma", "undergraduate"], apply_mode="internal",
         amount_label="Up to KES 40,000", tags=["zakat", "fees"], requires_verified_identity=True,
         form_questions=[{"id": "income", "label": "Monthly household income (KES)", "kind": "number", "required": True, "options": []},
                         {"id": "dependants", "label": "Number of dependants", "kind": "number", "required": True, "options": []}]),
    _opp(6, "Emergency Family Assistance Fund", "support", "emergency",
         "Rapid support for families facing medical emergencies, eviction or loss of a breadwinner.", 90,
         apply_mode="internal", amount_label="Case-by-case", tags=["emergency", "sadaqah"], requires_verified_identity=True,
         form_questions=[{"id": "situation", "label": "Describe the emergency", "kind": "long_text", "required": True, "options": []}]),
    _opp(5, "Medical Assistance for Surgery", "support", "medical",
         "Covers part of the cost of essential surgery for patients referred by partner hospitals.", 40,
         counties=["Kisumu", "Kakamega", "Busia", "Siaya"], apply_mode="internal", tags=["medical", "surgery"]),
    _opp(6, "Ramadan Food Hamper Programme", "support", "food",
         "Monthly food hampers for families in need, delivered through local mosques.", 50,
         apply_mode="internal", tags=["food", "ramadan"]),
    _opp(3, "Full-Stack Web Development Bootcamp", "learning", "professional_training",
         "16-week evening bootcamp with job placement support. 80% scholarship for DEEN members.", 11,
         skills=["Software development"], amount_label="80% scholarship", external_url="https://hidayatech.example.org/bootcamp",
         tags=["bootcamp", "coding", "web"]),
    _opp(0, "Professionals Mentorship Circle", "learning", "mentorship",
         "Be paired with a senior Muslim professional in your field for six months of monthly mentoring.", 28,
         education_levels=["undergraduate", "graduate", "postgraduate"], apply_mode="internal", access_tier="premium",
         tags=["mentorship", "career"],
         form_questions=[{"id": "goal", "label": "What do you want to achieve in 6 months?", "kind": "long_text", "required": True, "options": []}]),
    _opp(1, "Certified Islamic Finance Professional (CIFP) Prep", "learning", "certification",
         "Exam preparation course for the CIFP certification with study materials and weekend classes.", 33,
         skills=["Islamic finance", "Accounting"], amount_label="50% sponsored", external_url="https://barakahhub.example.org/cifp",
         tags=["certification", "finance"]),
    _opp(4, "Coast Youth Leadership Summit 2026", "community", "conference",
         "Two days of talks, workshops and networking for young Muslims shaping the Coast's future.", 20,
         counties=["Mombasa"], is_event=True, start_days=24, venue="Mombasa, Swahili Cultural Centre (demo)",
         apply_mode="internal", tags=["summit", "leadership", "youth"], featured=True),
    _opp(4, "Beach Clean-up & Community Iftar Volunteers", "community", "volunteer",
         "Volunteer for our monthly clean-up at Jomo Kenyatta Public Beach, followed by a community meal.", 8,
         counties=["Mombasa"], is_event=True, start_days=10, venue="Jomo Kenyatta Public Beach", apply_mode="internal",
         tags=["volunteer", "environment"]),
    _opp(4, "Sisters' Wellness & Career Evening", "community", "women_program",
         "An evening for sisters: career talks, wellbeing sessions and networking in a safe space.", 15,
         gender="female", is_event=True, start_days=17, venue="Nairobi, Parklands (demo venue)", apply_mode="internal",
         tags=["sisters", "career"]),
    _opp(0, "Seerah Lecture Series: Leadership of the Prophet ﷺ", "community", "lecture",
         "Weekly Friday-evening lectures on prophetic leadership, open to all.", 30,
         is_event=True, start_days=5, venue="Nairobi, Jamia area (demo venue)", apply_mode="internal", tags=["seerah", "lecture"]),
    _opp(5, "Blood Donation Drive", "community", "community_project",
         "Help save lives: donate blood at our drive in partnership with county health services.", 6,
         counties=["Kisumu"], is_event=True, start_days=7, venue="Kisumu (demo venue)", apply_mode="internal",
         tags=["health", "volunteer"]),
]

MEMBERS = [
    ("Amina Hassan", "+254700000001", dict(county="Mombasa", date_of_birth=date(2004, 3, 12), gender="female",
     education_level="undergraduate", field_of_study="Business Administration", institution="Technical University of Mombasa",
     employment_status="student", skills=["Digital marketing", "Social media", "Sales"],
     interests=["education", "business", "community"], opportunity_types=["scholarship", "entrepreneurship", "startup_grant"],
     languages=["English", "Kiswahili", "Arabic"], bio="Marketing student and aspiring founder.")),
    ("Yusuf Abdi", "+254700000002", dict(county="Garissa", date_of_birth=date(2006, 7, 2), gender="male",
     education_level="secondary", field_of_study="Science", employment_status="student",
     skills=["Research", "Public speaking"], interests=["education"], opportunity_types=["scholarship"],
     languages=["Somali", "English", "Kiswahili"])),
    ("Ibrahim Otieno", "+254700000003", dict(county="Nairobi", date_of_birth=date(1998, 11, 20), gender="male",
     education_level="graduate", field_of_study="Computer Science", profession="Software developer",
     employment_status="seeking", skills=["Software development", "Data analysis", "Project management"],
     interests=["employment", "learning", "business"], opportunity_types=["job", "graduate_program", "remote_job"],
     languages=["English", "Kiswahili", "Luo"], bio="Backend developer looking for impact-driven work.")),
]


async def seed_demo(session) -> None:
    if await session.scalar(select(Organization.id).where(Organization.name == ORGS[0][0])):
        print("✓ Demo data already present")
        return
    now = utcnow()
    admin = await session.scalar(select(User).where(User.role == Role.super_admin))
    orgs: list[Organization] = []
    for i, (name, typ, ver, county, tagline, website) in enumerate(ORGS):
        slug = name.lower().replace(" ", "-").replace("'", "")
        org = Organization(name=name, slug=slug, org_type=typ, verification=ver, county=county, tagline=tagline,
                           website=website, email=f"hello@{slug}.example.org",
                           description=f"{name} is a fictional demo organization on DEEN. {tagline}.",
                           verified_at=now if ver != Verification.pending else None,
                           created_by_id=admin.id if admin else None)
        session.add(org)
        await session.flush()
        orgs.append(org)
        session.add(User(full_name=f"{name.split()[0]} Admin", email=f"admin{i + 1}@org.demo", role=Role.org_admin,
                         organization_id=org.id, password_hash=hash_password(DEMO_PASSWORD),
                         email_verified_at=now, consent_at=now))

    opps: list[Opportunity] = []
    for spec in OPPS:
        spec = dict(spec)
        org = orgs[spec.pop("org_i")]
        deadline_days = spec.pop("deadline_days")
        start_days = spec.pop("start_days", None)
        mode = ApplyMode(spec.pop("apply_mode", "external"))
        tier = AccessTier(spec.pop("access_tier", "free"))
        opp = Opportunity(
            organization_id=org.id, status=OppStatus.submitted, apply_mode=mode, access_tier=tier,
            deadline=now + timedelta(days=deadline_days),
            starts_at=now + timedelta(days=start_days, hours=9) if start_days else None,
            description=f"{spec['summary']}\n\n{LOREM_TAIL}",
            eligibility="Open to Kenyan Muslims who meet the criteria below.",
            benefits=spec.get("amount_label") or "See description",
            application_process=("Apply on DEEN with the form below." if mode == ApplyMode.internal
                                 else "Apply on the organization's website using the button below."),
            submitted_at=now - timedelta(days=2), **spec,
        )
        session.add(opp)
        await session.flush()
        await run_risk_scan(session, opp)
        if org.verification != Verification.pending:
            opp.status, opp.published_at = OppStatus.published, now - timedelta(days=len(opps) % 9, hours=len(opps))
        opps.append(opp)

    member_plan = await session.scalar(select(Plan).where(Plan.code == "member_monthly"))
    members: list[User] = []
    for name, phone, prof in MEMBERS:
        u = User(full_name=name, phone=phone, role=Role.member, password_hash=hash_password(DEMO_PASSWORD),
                 phone_verified_at=now, consent_at=now)
        session.add(u)
        await session.flush()
        session.add(MemberProfile(user_id=u.id, onboarding_completed=True, **prof))
        members.append(u)
    await activate(session, members[0].id, member_plan)

    amina = members[0]
    for opp, status in ((opps[0], AppStatus.shortlisted), (opps[8], AppStatus.submitted)):
        a = Application(opportunity_id=opp.id, organization_id=opp.organization_id, user_id=amina.id, status=status,
                        answers={}, profile_snapshot={"full_name": amina.full_name, "county": "Mombasa",
                                                      "education_level": "undergraduate"}, match_score=78)
        session.add(a)
        await session.flush()
        session.add(ApplicationEvent(application_id=a.id, status="submitted"))
        if status == AppStatus.shortlisted:
            session.add(ApplicationEvent(application_id=a.id, status="shortlisted",
                                         message="Please prepare for a short interview next week."))
        opp.applications_count += 1

    for i, opp in enumerate(opps):
        opp.views_count = 40 + (i * 37) % 400
        opp.clicks_count = opp.views_count // 4
        opp.saves_count = opp.views_count // 9

    session.add(DirectoryListing(owner_id=members[2].id, kind="professional", name="Ibrahim Otieno",
                                 headline="Backend developer · Python, APIs, data", category="technology",
                                 county="Nairobi", phone="+254700000003", services=["APIs", "Data pipelines"],
                                 status=ListingStatus.approved, verified=True))
    session.add(DirectoryListing(owner_id=members[0].id, kind="business", name="Amina's Halal Kitchen",
                                 headline="Home-made Swahili dishes for events", category="halal_food",
                                 county="Mombasa", whatsapp="+254700000001", services=["Catering", "Biryani"],
                                 halal_certified=True, status=ListingStatus.approved))
    await session.commit()
    print(f"✓ Demo data: {len(orgs)} organizations, {len(opps)} opportunities, {len(members)} members")
    print(f"  Organization portal: admin1@org.demo … admin{len(orgs)}@org.demo / {DEMO_PASSWORD}")
    print(f"  Member app: 0700000001 (Amina), 0700000002 (Yusuf), 0700000003 (Ibrahim) / {DEMO_PASSWORD}")
