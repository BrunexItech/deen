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
from app.modules.taxonomy.data import CHECKLIST_KEYS
from app.modules.users.models import MemberProfile, User

DEMO_PASSWORD = "DemoPass2026"

ORGS = [
    ("Al-Noor Education Foundation", OrgType.foundation, Verification.trusted, "Nairobi",
     "Opening doors to education for Muslim youth since 2009", "https://alnoor-foundation.example.org"),
    ("Barakah Enterprise Hub", OrgType.business, Verification.verified, "Mombasa",
     "Incubation, training and interest-free finance for founders", "https://barakahhub.example.org"),
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
    ("Pwani Coastal University (demo)", OrgType.university, Verification.verified, "Kilifi",
     "Research and teaching for the Coast region", "https://pwanicoastal.example.ac.ke"),
    ("Amanah Islamic Bank (demo)", OrgType.financial_institution, Verification.trusted, "Nairobi",
     "Shariah-supervised banking for households and SMEs", "https://amanahbank.example.co.ke"),
    ("Green Horizon Climate Alliance", OrgType.ngo, Verification.verified, "Lamu",
     "Community-led climate adaptation along the Kenyan coast", "https://greenhorizon.example.org"),
]

LOREM_TAIL = ("Successful applicants will be contacted by email and phone. DEEN has verified this organization and "
              "reviewed this listing. Legitimate opportunities never ask applicants to pay any fee.")


def _opp(org_i, title, category, type_, summary, days, **kw):
    return dict(org_i=org_i, title=title, category=category, type=type_, summary=summary, deadline_days=days, **kw)


def Q(qid: str, label: str, kind: str = "short_text", options: list[str] | None = None) -> dict:  # noqa: N802
    return {"id": qid, "label": label, "kind": kind, "required": True, "options": options or []}

OPPS = [
    # ---------------- Education ----------------
    _opp(0, "Al-Noor University Scholarship 2027", "education", "scholarship",
         "Full tuition and a monthly stipend for first-year students at any public university in Kenya.", 21,
         education_levels=["secondary", "undergraduate"], min_age=17, max_age=24,
         amount_label="Full tuition + KES 6,000/month", compensation="stipend", target_user_types=["student"],
         apply_mode="internal", tags=["university", "tuition"], featured=True, duration_label="4 years",
         form_questions=[Q("kcse", "KCSE mean grade"), Q("course", "Course you were admitted to"),
                         Q("why", "Why do you deserve this scholarship?", "long_text")],
         required_documents=["KCSE result slip", "Admission letter"], islamic_tags=["muslim_organization"]),
    _opp(2, "Iqra North Eastern Scholars Programme", "education", "scholarship",
         "Four-year scholarship covering fees, accommodation and a laptop for students from Garissa, Wajir and Mandera.", 30,
         counties=["Garissa", "Wajir", "Mandera"], education_levels=["secondary", "undergraduate"], student_friendly=True,
         amount_label="Fees, housing & laptop", target_user_types=["student"], apply_mode="internal",
         form_questions=[Q("school", "Secondary school attended"), Q("need", "Tell us about your family's situation", "long_text")]),
    _opp(8, "Coastal Studies Exchange Semester, Malaysia", "education", "exchange_programme",
         "A funded exchange semester at a partner university in Kuala Lumpur for second- and third-year students.", 40,
         country="Malaysia", is_international=True, eligible_countries=["Kenya"], education_levels=["undergraduate"],
         fields_of_study=["Business", "Economics", "Marine Science"], duration_label="1 semester", duration_weeks=18,
         amount_label="Flights, tuition & living allowance", compensation="stipend", target_user_types=["student"],
         external_url="https://pwanicoastal.example.ac.ke/exchange"),
    _opp(3, "Full-Stack Web Development Training", "education", "training",
         "16-week evening bootcamp with job placement support. 80% scholarship for DEEN members.", 11,
         skills=["Software development"], industry="ICT & Technology", duration_label="16 weeks", duration_weeks=16,
         time_commitment="Weekday evenings", certificate_provided=True, amount_label="80% scholarship",
         external_url="https://hidayatech.example.org/bootcamp", target_user_types=["graduate", "job_seeker"]),
    _opp(0, "Grant Writing Workshop for Community Leaders", "education", "workshop",
         "A one-day hands-on workshop on writing winning grant proposals, with real funder feedback.", 9,
         is_event=True, start_days=12, venue="Nairobi, Eastleigh (demo venue)", certificate_provided=True, weekend=True,
         duration_label="1 day", duration_weeks=0, target_user_types=["community_worker", "entrepreneur"],
         apply_mode="internal", form_questions=[Q("org", "Which organization or group do you work with?")]),
    # ---------------- Career & Experience ----------------
    _opp(5, "Health Records Attachment (3 months)", "career", "attachment",
         "Industrial attachment in health records and information at our Kisumu clinics.", 16,
         industry="Healthcare", department="Health Records & Information", counties=["Kisumu"], work_mode="physical",
         duration_label="3 months", duration_weeks=12, education_levels=["certificate", "diploma", "undergraduate"],
         fields_of_study=["Health Records", "Health Information Management"], compensation="stipend",
         allowances="Transport allowance KES 5,000/month", student_friendly=True, target_user_types=["student"],
         required_documents=["Institution attachment letter", "CV", "Student ID"],
         external_url="https://ummahhealth.example.org/attachments"),
    _opp(3, "ICT Attachment: Network & Systems Support", "career", "attachment",
         "Hands-on attachment supporting networks, devices and help-desk for our training labs.", 20,
         industry="ICT & Technology", department="IT Operations", counties=["Nairobi"], work_mode="hybrid",
         duration_label="10 weeks", duration_weeks=10, education_levels=["diploma", "undergraduate"],
         fields_of_study=["Information Technology", "Computer Science"], skills=["Microsoft Office"],
         compensation="unpaid", student_friendly=True, target_user_types=["student"], certificate_provided=True,
         required_documents=["Attachment letter", "CV"], external_url="https://hidayatech.example.org/attachment"),
    _opp(3, "Remote Data Analyst Internship", "career", "internship",
         "Three-month paid remote internship analysing impact data for NGOs across East Africa.", 9,
         industry="Research", department="Impact & Data", work_mode="remote", duration_label="3 months",
         duration_weeks=12, skills=["Data analysis", "Microsoft Office", "Research"], compensation="paid",
         amount_label="KES 25,000/month", target_user_types=["graduate", "student"],
         external_url="https://hidayatech.example.org/careers/data-intern"),
    _opp(9, "Islamic Banking Graduate Trainee Programme", "career", "graduate_trainee",
         "An 18-month rotation across Shariah compliance, retail and SME banking for recent graduates.", 25,
         industry="Islamic Finance", education_levels=["graduate"], fields_of_study=["Finance", "Economics", "Accounting"],
         max_age=27, compensation="paid", amount_label="KES 65,000/month", duration_label="18 months",
         duration_weeks=78, target_user_types=["graduate"], skills=["Accounting", "Islamic finance"],
         islamic_tags=["islamic_finance", "shariah_conscious"],
         shariah_basis="Programme run by the bank's Shariah-supervised operations; products certified by its "
                       "independent Shariah Supervisory Board (demo).",
         external_url="https://amanahbank.example.co.ke/careers/graduates", featured=True),
    _opp(3, "Junior Software Developer", "career", "job",
         "Join our product team building fintech tools. Prayer room and Jumu'ah break.", 18,
         industry="ICT & Technology", education_levels=["diploma", "undergraduate", "graduate"],
         skills=["Software development", "Data analysis"], min_experience_years=1, compensation="paid",
         amount_label="KES 70,000/month", counties=["Nairobi"], work_mode="hybrid", target_user_types=["job_seeker",
         "professional"], external_url="https://hidayatech.example.org/careers/junior-dev"),
    _opp(4, "Beach Clean-up & Community Iftar Volunteers", "career", "volunteer",
         "Volunteer for our monthly clean-up at Jomo Kenyatta Public Beach, followed by a community meal.", 8,
         counties=["Mombasa"], causes=["environment", "community"], weekend=True, student_friendly=True,
         time_commitment="Saturday morning, 4 hours", duration_label="1 day", duration_weeks=0,
         allowances="Meal provided", certificate_provided=True, is_event=True, start_days=10,
         venue="Jomo Kenyatta Public Beach", responsibilities="Collect and sort waste, guide younger volunteers, help "
         "set up the iftar.", apply_mode="internal", target_user_types=["young_person", "student"]),
    _opp(10, "Mangrove Restoration Volunteers (Lamu)", "career", "volunteer",
         "Plant and monitor mangroves with fishing communities; ideal for environmental science students.", 22,
         counties=["Lamu"], causes=["environment", "research"], duration_label="6 weeks", duration_weeks=6,
         time_commitment="Weekends, 6 hours", weekend=True, student_friendly=True, certificate_provided=True,
         allowances="Transport and lunch", fields_of_study=["Environmental Science", "Marine Science"],
         responsibilities="Nursery work, planting, survival counts, community data collection.",
         external_url="https://greenhorizon.example.org/volunteer"),
    _opp(0, "Professionals Mentorship Circle", "career", "mentorship",
         "Be paired with a senior Muslim professional in your field for six months of monthly mentoring.", 28,
         education_levels=["undergraduate", "graduate", "postgraduate"], duration_label="6 months", duration_weeks=26,
         apply_mode="internal", access_tier="member", target_user_types=["graduate", "professional"],
         form_questions=[Q("goal", "What do you want to achieve in 6 months?", "long_text")]),
    # ---------------- Entrepreneurship ----------------
    _opp(1, "Barakah Women Founders Business Grant", "entrepreneurship", "business_grant",
         "Non-repayable grants for women-led businesses in fashion, food and retail, plus six months of mentorship.", 35,
         gender="female", target_user_types=["woman_entrepreneur", "entrepreneur"], industry="Fashion & Textiles",
         amount_label="Up to KES 500,000", apply_mode="internal", featured=True, access_tier="member",
         skills=["Sales", "Digital marketing"],
         form_questions=[Q("biz", "Describe your business in two sentences", "long_text"),
                         Q("stage", "Stage", "single_choice", ["Idea", "Early revenue", "Growing"]),
                         Q("use", "How will you use the grant?", "long_text")],
         required_documents=["Business profile", "Business plan"], islamic_tags=["muslim_entrepreneurship"]),
    _opp(1, "Barakah Incubator: Cohort 7", "entrepreneurship", "incubator",
         "Six months of workspace, mentors and investor readiness for early-stage halal businesses.", 30,
         counties=["Mombasa", "Kilifi", "Kwale"], duration_label="6 months", duration_weeks=26,
         target_user_types=["entrepreneur", "woman_entrepreneur"], external_url="https://barakahhub.example.org/incubator",
         islamic_tags=["halal_economy", "muslim_entrepreneurship"]),
    _opp(9, "Qard Hasan SME Financing", "islamic_economy", "islamic_finance",
         "Interest-free working-capital financing for traders and small manufacturers.", 60,
         amount_label="KES 50,000–300,000, 0% interest", target_user_types=["entrepreneur", "woman_entrepreneur"],
         islamic_tags=["islamic_finance", "shariah_conscious"],
         shariah_basis="Qard hasan product approved by the bank's Shariah Supervisory Board (demo reference SSB/2026/14).",
         external_url="https://amanahbank.example.co.ke/qard-hasan"),
    _opp(1, "Halal Export Market Access Programme (UAE)", "entrepreneurship", "market_access",
         "Get your halal food products export-ready and meet buyers at a Dubai trade fair.", 45,
         industry="Food & Hospitality", country="United Arab Emirates", is_international=True,
         eligible_countries=["Kenya"], target_user_types=["entrepreneur"], islamic_tags=["halal_economy"],
         external_url="https://barakahhub.example.org/export-uae"),
    _opp(8, "Coast Youth Business Plan Competition", "entrepreneurship", "business_competition",
         "Pitch your business idea; top 10 win seed funding and incubation.", 14,
         max_age=35, target_user_types=["young_person", "entrepreneur", "student"], amount_label="KES 200,000 top prize",
         apply_mode="internal", form_questions=[Q("pitch", "Your idea in 150 words", "long_text")]),
    # ---------------- Community & Development ----------------
    _opp(10, "Youth Climate Action Fellowship", "community", "climate",
         "A 9-month fellowship training young leaders to run community climate projects.", 26,
         counties=["Lamu", "Kilifi", "Mombasa", "Kwale", "Tana River"], min_age=18, max_age=30,
         target_user_types=["young_person", "community_worker"], duration_label="9 months", duration_weeks=39,
         compensation="stipend", amount_label="Monthly stipend + project grant",
         external_url="https://greenhorizon.example.org/fellowship"),
    _opp(4, "Sisters' Wellness & Career Evening", "community", "women",
         "An evening for women: career talks, wellbeing sessions and networking in a safe space.", 15,
         gender="female", is_event=True, start_days=17, venue="Nairobi, Parklands (demo venue)", apply_mode="internal",
         target_user_types=["professional", "woman_entrepreneur"]),
    _opp(8, "County Youth Enterprise Fund Information Day", "community", "government",
         "Learn how to access county youth and women enterprise funds, with officials on hand.", 10,
         counties=["Kilifi"], is_event=True, start_days=13, venue="Kilifi town hall (demo)",
         target_user_types=["young_person", "entrepreneur", "woman_entrepreneur"], apply_mode="internal"),
    _opp(5, "Community Health Promoters Programme", "community", "humanitarian",
         "Train as a community health promoter and support maternal health outreach in your ward.", 24,
         counties=["Kisumu", "Siaya", "Homa Bay"], compensation="stipend", amount_label="KES 5,000/month",
         target_user_types=["community_worker", "young_person"], external_url="https://ummahhealth.example.org/chp"),
    # ---------------- Islamic Economy ----------------
    _opp(0, "Hifdh & Arabic Summer Intensive", "islamic_economy", "islamic_education",
         "Six-week residential Qur'an memorisation and Arabic programme for teens. Meals and housing included.", 14,
         min_age=12, max_age=19, counties=["Lamu", "Mombasa", "Kilifi"], duration_label="6 weeks", duration_weeks=6,
         apply_mode="internal", islamic_tags=["islamic_education"],
         form_questions=[Q("juz", "How many juz have you memorised?", "number")]),
    # ---------------- Support ----------------
    _opp(6, "Education Zakat Support: School Fees", "support", "education_assistance",
         "Zakat-funded school fee support for secondary and university students from low-income families.", 16,
         education_levels=["secondary", "certificate", "diploma", "undergraduate"], apply_mode="internal",
         amount_label="Up to KES 40,000", requires_verified_identity=True, target_user_types=["student"],
         form_questions=[Q("income", "Monthly household income (KES)", "number"), Q("dependants", "Number of dependants", "number")]),
    _opp(6, "Emergency Family Assistance Fund", "support", "emergency",
         "Rapid support for families facing medical emergencies, eviction or loss of a breadwinner.", 90,
         apply_mode="internal", amount_label="Case-by-case", requires_verified_identity=True,
         form_questions=[Q("situation", "Describe the emergency", "long_text")]),
    _opp(7, "Warehouse Supervisors (Nakuru)", "career", "job",
         "Supervise inbound and outbound operations at our Nakuru distribution centre.", 20,
         counties=["Nakuru"], industry="Logistics & Transport", skills=["Logistics", "Leadership"],
         compensation="paid", amount_label="KES 45,000/month", external_url="https://bit.ly/tawakkul-jobs"),
]

MEMBERS = [
    ("Amina Hassan", "+254700000001", dict(county="Mombasa", date_of_birth=date(2004, 3, 12), gender="female",
     education_level="undergraduate", field_of_study="Business Administration", institution="Technical University of Mombasa",
     employment_status="student", user_types=["student", "woman_entrepreneur"], industry="Fashion & Textiles",
     business_sector="Fashion", years_in_business=1, skills=["Digital marketing", "Social media", "Sales"],
     interests=["education", "entrepreneurship", "community"],
     opportunity_types=["scholarship", "business_grant", "internship", "attachment"],
     languages=["English", "Kiswahili", "Arabic"], bio="Marketing student and aspiring founder.")),
    ("Yusuf Abdi", "+254700000002", dict(county="Garissa", date_of_birth=date(2006, 7, 2), gender="male",
     education_level="secondary", field_of_study="Science", employment_status="student",
     user_types=["student", "young_person"], skills=["Research", "Public speaking"],
     interests=["education", "islamic_economy"], opportunity_types=["scholarship", "islamic_education"],
     languages=["Somali", "English", "Kiswahili"])),
    ("Ibrahim Otieno", "+254700000003", dict(county="Nairobi", date_of_birth=date(1998, 11, 20), gender="male",
     education_level="graduate", field_of_study="Computer Science", profession="Software developer",
     employment_status="seeking", user_types=["graduate", "job_seeker"], industry="ICT & Technology",
     experience_years=2, skills=["Software development", "Data analysis", "Project management"],
     interests=["career", "education", "entrepreneurship"], opportunity_types=["job", "graduate_trainee", "internship"],
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
            eligibility="Open to applicants who meet the criteria below.",
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
            opp.verification_checklist = {k: "yes" for k in CHECKLIST_KEYS}
            opp.verified_at = opp.published_at
        opps.append(opp)

    member_plan = await session.scalar(select(Plan).where(Plan.code == "community"))
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
    for opp, status in ((opps[0], AppStatus.shortlisted), (opps[13], AppStatus.submitted)):
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
    session.add(Application(user_id=amina.id, source="manual", status=AppStatus.in_review,
                            manual_title="County Bursary 2026/27", manual_organization="Mombasa County (outside DEEN)",
                            answers={}))
    await session.commit()
    print(f"  Organization portal: admin1@org.demo … admin{len(orgs)}@org.demo / {DEMO_PASSWORD}")
    print(f"  Member app: 0700000001 (Amina), 0700000002 (Yusuf), 0700000003 (Ibrahim) / {DEMO_PASSWORD}")
