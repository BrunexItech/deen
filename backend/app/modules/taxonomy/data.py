"""Reference data. Categories/types are seeded into the database (admin-editable);
counties and education levels are fixed national lists."""

COUNTIES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
    "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu",
    "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru",
    "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River",
    "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
]

# Ordered: index = rank. Used for "at least" comparisons in matching.
EDUCATION_LEVELS = [
    ("primary", "Primary"),
    ("secondary", "Secondary (KCSE)"),
    ("certificate", "Certificate"),
    ("diploma", "Diploma"),
    ("undergraduate", "Undergraduate"),
    ("graduate", "Bachelor's graduate"),
    ("postgraduate", "Master's"),
    ("doctorate", "PhD / Doctorate"),
]
EDUCATION_KEYS = [k for k, _ in EDUCATION_LEVELS]

EMPLOYMENT_STATUSES = [
    ("student", "Student"),
    ("employed", "Employed"),
    ("self_employed", "Self-employed / Business owner"),
    ("seeking", "Looking for work"),
    ("volunteer", "Volunteering"),
    ("other", "Other"),
]

LANGUAGES = ["English", "Kiswahili", "Arabic", "Somali", "Oromo", "Borana", "French", "Urdu", "Kikuyu", "Luo",
             "Kamba", "Luhya", "Kalenjin", "Mijikenda"]

SKILL_SUGGESTIONS = [
    "Software development", "Data analysis", "Accounting", "Teaching", "Nursing", "Medicine", "Engineering",
    "Graphic design", "Digital marketing", "Sales", "Customer service", "Project management", "Research",
    "Writing", "Public speaking", "Leadership", "Qur'an recitation", "Arabic", "Islamic studies", "Tailoring",
    "Carpentry", "Electrical", "Plumbing", "Driving", "Agriculture", "Cooking", "Photography", "Video editing",
    "Community mobilisation", "Fundraising", "Social media", "Law", "Pharmacy", "Logistics", "Hospitality",
    "Microsoft Office", "Islamic finance", "Counselling", "Early childhood education",
]

# Opportunity categories and types (DEEN APP spec, section 7). Seeded into the database
# and editable from the Control Center; keys are stable identifiers.
CATEGORIES = [
    {
        "key": "education", "name": "Education", "tab_label": "Education", "icon": "graduation-cap",
        "color": "#0F766E", "description": "Scholarships, fellowships, training and exchange programmes",
        "types": [("scholarship", "Scholarship"), ("fellowship", "Fellowship"), ("training", "Training"),
                  ("workshop", "Workshop"), ("seminar", "Seminar"), ("exchange_programme", "Exchange programme"),
                  ("academic_competition", "Academic competition")],
    },
    {
        "key": "career", "name": "Career & Experience", "tab_label": "Career", "icon": "briefcase",
        "color": "#1D4ED8", "description": "Jobs, attachments, internships, volunteering and mentorship",
        "types": [("job", "Job"), ("attachment", "Attachment"), ("internship", "Internship"),
                  ("graduate_trainee", "Graduate trainee programme"), ("volunteer", "Volunteer opportunity"),
                  ("certification", "Professional certification"), ("mentorship", "Mentorship")],
    },
    {
        "key": "entrepreneurship", "name": "Entrepreneurship", "tab_label": "Business", "icon": "rocket",
        "color": "#B45309", "description": "Grants, funding, incubators, accelerators and market access",
        "types": [("business_grant", "Business grant"), ("funding", "Funding opportunity"),
                  ("business_competition", "Business competition"), ("incubator", "Incubator"),
                  ("accelerator", "Accelerator"), ("entrepreneurship_programme", "Entrepreneurship programme"),
                  ("market_access", "Market access"), ("trade", "Trade opportunity"), ("export", "Export opportunity"),
                  ("business_networking", "Business networking")],
    },
    {
        "key": "community", "name": "Community & Development", "tab_label": "Community", "icon": "users",
        "color": "#047857", "description": "Youth, women, climate, humanitarian and development programmes",
        "types": [("youth", "Youth opportunity"), ("women", "Women-focused opportunity"),
                  ("climate", "Climate & environment"), ("community_development", "Community development"),
                  ("humanitarian", "Humanitarian opportunity"),
                  ("islamic_community", "Islamic community development"), ("government", "Government programme"),
                  ("international_development", "International development"), ("event", "Community event")],
    },
    {
        "key": "islamic_economy", "name": "Islamic Economy", "tab_label": "Islamic Economy", "icon": "landmark",
        "color": "#7C3AED", "description": "Islamic finance, halal economy and Muslim enterprise",
        "types": [("islamic_finance", "Islamic finance"), ("halal_economy", "Halal economy"),
                  ("islamic_entrepreneurship", "Islamic entrepreneurship"),
                  ("muslim_business", "Muslim business opportunity"), ("islamic_education", "Islamic education")],
    },
    {
        "key": "support", "name": "Support & Zakat", "tab_label": "Support", "icon": "hand-heart",
        "color": "#BE123C", "description": "Zakat, sadaqah and assistance programmes",
        "types": [("zakat", "Zakat"), ("sadaqah", "Sadaqah"), ("emergency", "Emergency assistance"),
                  ("education_assistance", "Education assistance"), ("medical", "Medical assistance"),
                  ("food", "Food assistance"), ("housing", "Housing assistance")],
    },
]

CATEGORY_KEYS = [c["key"] for c in CATEGORIES]
TYPE_KEYS = {t for c in CATEGORIES for t, _ in c["types"]}

# Student & Graduate Hub (spec section 26): type groups shown together.
STUDENT_HUB = [
    ("study", "Study", ["scholarship", "fellowship", "exchange_programme"]),
    ("experience", "Experience", ["attachment", "internship", "volunteer"]),
    ("career", "Career", ["job", "graduate_trainee", "certification"]),
    ("growth", "Growth", ["training", "workshop", "mentorship", "academic_competition", "business_competition"]),
]

# How members describe themselves (spec section 6). Opportunities can target these.
USER_TYPES = [
    ("student", "Student"), ("graduate", "Graduate"), ("entrepreneur", "Entrepreneur"),
    ("professional", "Professional"), ("job_seeker", "Job seeker"), ("young_person", "Young person"),
    ("woman_entrepreneur", "Woman entrepreneur"), ("researcher", "Researcher"),
    ("community_worker", "Community worker"), ("other", "Other"),
]
USER_TYPE_KEYS = [k for k, _ in USER_TYPES]

INDUSTRIES = [
    "Agriculture & Agribusiness", "Banking & Finance", "Islamic Finance", "Construction & Real Estate",
    "Creative Arts & Media", "Education", "Energy & Utilities", "Engineering", "Environment & Climate",
    "Fashion & Textiles", "Food & Hospitality", "Government & Public Sector", "Healthcare", "Humanitarian & NGO",
    "ICT & Technology", "Law", "Logistics & Transport", "Manufacturing", "Marketing & Communications",
    "Mining", "Research", "Retail & Trade", "Sports", "Tourism", "Other",
]

COUNTRIES = [
    "Kenya", "Uganda", "Tanzania", "Rwanda", "Burundi", "Ethiopia", "Somalia", "South Sudan", "Djibouti",
    "Nigeria", "Ghana", "South Africa", "Egypt", "Morocco", "Sudan", "Saudi Arabia", "United Arab Emirates", "Qatar",
    "Kuwait", "Oman", "Bahrain", "Turkey", "Malaysia", "Indonesia", "Pakistan", "India", "United Kingdom",
    "United States", "Canada", "Germany", "France", "Netherlands", "Sweden", "China", "Japan", "Australia",
    "Online / Global",
]

WORK_MODES = [("physical", "Physical"), ("remote", "Remote"), ("hybrid", "Hybrid")]
COMPENSATION = [("paid", "Paid"), ("stipend", "Stipend / allowance"), ("unpaid", "Unpaid"),
                ("undisclosed", "Not disclosed")]

VOLUNTEER_CAUSES = [
    ("education", "Education"), ("environment", "Environment"), ("community", "Community development"),
    ("women", "Women empowerment"), ("youth", "Youth development"), ("digital_literacy", "Digital literacy"),
    ("technology", "Technology"), ("humanitarian", "Humanitarian work"), ("events", "Events"),
    ("research", "Research"), ("communications", "Communications"), ("sports", "Sports"),
    ("entrepreneurship", "Entrepreneurship"), ("islamic_community", "Islamic / community development"),
]

# Islamic-friendly filter (spec section 25). "shariah_conscious" needs a recorded basis.
ISLAMIC_TAGS = [
    ("islamic_finance", "Islamic finance"), ("halal_economy", "Halal economy"),
    ("muslim_organization", "Muslim organization"), ("islamic_education", "Islamic education"),
    ("muslim_entrepreneurship", "Muslim entrepreneurship"), ("community_development", "Community development"),
    ("shariah_conscious", "Shariah-conscious financing"),
]
ISLAMIC_TAG_KEYS = [k for k, _ in ISLAMIC_TAGS]

# Admin verification checklist (spec section 14). All must be confirmed (or N/A) before publishing.
VERIFICATION_CHECKLIST = [
    ("organization_identity", "Organization identity confirmed"),
    ("official_website", "Official website checked"),
    ("contact_information", "Contact information checked"),
    ("application_link", "Application link goes to the official page"),
    ("eligibility", "Eligibility requirements are clear"),
    ("deadline", "Deadline confirmed"),
    ("funding_amount", "Funding / compensation amount confirmed"),
    ("description", "Description is accurate"),
    ("supporting_documents", "Supporting documents reviewed"),
    ("legitimacy", "Opportunity appears legitimate"),
    ("no_payment_requests", "No suspicious payment requests"),
]
CHECKLIST_KEYS = [k for k, _ in VERIFICATION_CHECKLIST]
