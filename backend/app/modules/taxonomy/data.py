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

CATEGORIES = [
    {
        "key": "education", "name": "Education", "tab_label": "Scholarships", "icon": "graduation-cap",
        "color": "#0F766E", "description": "Scholarships, fellowships, grants and study programmes",
        "types": [("scholarship", "Scholarship"), ("fellowship", "Fellowship"), ("education_grant", "Education grant"),
                  ("university", "University opportunity"), ("islamic_studies", "Islamic studies"),
                  ("quran_program", "Qur'an programme"), ("arabic_program", "Arabic programme"),
                  ("training_program", "Training programme")],
    },
    {
        "key": "employment", "name": "Employment", "tab_label": "Jobs", "icon": "briefcase",
        "color": "#1D4ED8", "description": "Jobs, internships and graduate programmes",
        "types": [("job", "Job"), ("internship", "Internship"), ("graduate_program", "Graduate programme"),
                  ("remote_job", "Remote job"), ("apprenticeship", "Apprenticeship"), ("freelance", "Freelance")],
    },
    {
        "key": "business", "name": "Business", "tab_label": "Business", "icon": "rocket",
        "color": "#B45309", "description": "Funding, grants and entrepreneurship",
        "types": [("sme_funding", "SME funding"), ("startup_grant", "Startup grant"),
                  ("business_competition", "Business competition"), ("entrepreneurship", "Entrepreneurship programme"),
                  ("partnership", "Partnership"), ("business_training", "Business training"),
                  ("islamic_finance", "Islamic finance")],
    },
    {
        "key": "support", "name": "Financial Support", "tab_label": "Support", "icon": "hand-heart",
        "color": "#BE123C", "description": "Zakat, sadaqah and assistance programmes",
        "types": [("zakat", "Zakat"), ("sadaqah", "Sadaqah"), ("emergency", "Emergency assistance"),
                  ("education_assistance", "Education assistance"), ("medical", "Medical assistance"),
                  ("food", "Food assistance"), ("housing", "Housing assistance")],
    },
    {
        "key": "learning", "name": "Professional Development", "tab_label": "Learning", "icon": "sparkles",
        "color": "#7C3AED", "description": "Mentorship, coaching, training and certifications",
        "types": [("mentorship", "Mentorship"), ("career_coaching", "Career coaching"),
                  ("professional_training", "Professional training"), ("certification", "Certification"),
                  ("networking", "Networking"), ("skills", "Skill development")],
    },
    {
        "key": "community", "name": "Community", "tab_label": "Community", "icon": "users",
        "color": "#047857", "description": "Events, volunteering and community programmes",
        "types": [("volunteer", "Volunteer opportunity"), ("community_project", "Community project"),
                  ("mosque_program", "Mosque programme"), ("youth_program", "Youth programme"),
                  ("women_program", "Women's programme"), ("family_support", "Family support"),
                  ("event", "Community event"), ("conference", "Conference"), ("lecture", "Islamic lecture"),
                  ("workshop", "Workshop"), ("fundraiser", "Fundraising event")],
    },
]

CATEGORY_KEYS = [c["key"] for c in CATEGORIES]
