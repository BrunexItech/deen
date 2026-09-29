"""Seed reminders. Every item carries its source; content managers can edit, add or
retire items from the control center (Content -> Reminders). Qur'an meanings follow
common English renderings (Sahih International style)."""

REMINDERS = [
    # Qur'an
    ("ayah", "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا",
     "For indeed, with hardship comes ease. Indeed, with hardship comes ease.", "Qur'an 94:5–6", "patience"),
    ("ayah", "وَقُل رَّبِّ زِدْنِي عِلْمًا",
     "And say, \"My Lord, increase me in knowledge.\"", "Qur'an 20:114", "knowledge"),
    ("ayah", "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ",
     "Whoever is mindful of Allah, He will make for him a way out, and will provide for him from where he does "
     "not expect.", "Qur'an 65:2–3", "provision"),
    ("ayah", "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
     "Allah does not burden a soul beyond what it can bear.", "Qur'an 2:286", "patience"),
    ("ayah", "وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ",
     "And that there is nothing for a person except what they strive for.", "Qur'an 53:39", "work"),
    ("ayah", "إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ",
     "Indeed, Allah will not change the condition of a people until they change what is in themselves.",
     "Qur'an 13:11", "work"),
    ("ayah", "فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ",
     "And when you have decided, then put your trust in Allah.", "Qur'an 3:159", "trust"),
    ("ayah", "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ",
     "And cooperate in righteousness and piety.", "Qur'an 5:2", "community"),
    ("ayah", "فَإِذَا قُضِيَتِ الصَّلَاةُ فَانتَشِرُوا فِي الْأَرْضِ وَابْتَغُوا مِن فَضْلِ اللَّهِ",
     "And when the prayer is concluded, disperse in the land and seek from the bounty of Allah.",
     "Qur'an 62:10", "work"),
    ("ayah", "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", "Indeed, Allah is with the patient.", "Qur'an 2:153", "patience"),
    ("ayah", "لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ", "Do not despair of the mercy of Allah.", "Qur'an 39:53", "trust"),
    ("ayah", "مَّثَلُ الَّذِينَ يُنفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ أَنبَتَتْ سَبْعَ سَنَابِلَ "
             "فِي كُلِّ سُنبُلَةٍ مِّائَةُ حَبَّةٍ",
     "The example of those who spend their wealth in the way of Allah is like a seed that grows seven ears; in "
     "every ear are a hundred grains.", "Qur'an 2:261", "charity"),
    # Hadith
    ("hadith", "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ",
     "Actions are only by intentions, and every person will have only what they intended.",
     "Sahih al-Bukhari 1, Sahih Muslim 1907", "intention"),
    ("hadith", "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",
     "Whoever takes a path seeking knowledge, Allah makes easy for them a path to Paradise.",
     "Sahih Muslim 2699", "knowledge"),
    ("hadith", "مَا أَكَلَ أَحَدٌ طَعَامًا قَطُّ خَيْرًا مِنْ أَنْ يَأْكُلَ مِنْ عَمَلِ يَدِهِ",
     "No one has ever eaten better food than what they eat from the work of their own hands.",
     "Sahih al-Bukhari 2072", "work"),
    ("hadith", "مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ", "Charity never decreases wealth.", "Sahih Muslim 2588", "charity"),
    ("hadith", "مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ",
     "Whoever guides someone to goodness will have a reward like the one who does it. Share an opportunity "
     "today.", "Sahih Muslim 1893", "community"),
    ("hadith", "الْمُؤْمِنُ لِلْمُؤْمِنِ كَالْبُنْيَانِ يَشُدُّ بَعْضُهُ بَعْضًا",
     "The believer to another believer is like a building, each part strengthening the other.",
     "Sahih al-Bukhari 481, Sahih Muslim 2585", "community"),
    ("hadith", "لَوْ أَنَّكُمْ كُنْتُمْ تَوَكَّلُونَ عَلَى اللَّهِ حَقَّ تَوَكُّلِهِ لَرُزِقْتُمْ كَمَا تُرْزَقُ الطَّيْرُ "
               "تَغْدُو خِمَاصًا وَتَرُوحُ بِطَانًا",
     "If you relied on Allah as He truly deserves, He would provide for you as He provides for the birds: they "
     "leave hungry in the morning and return full in the evening.", "Jami' at-Tirmidhi 2344", "provision"),
    ("hadith", "إِنَّ اللَّهَ يُحِبُّ إِذَا عَمِلَ أَحَدُكُمْ عَمَلًا أَنْ يُتْقِنَهُ",
     "Allah loves that when one of you does a job, they do it with excellence.",
     "Al-Bayhaqi, Shu'ab al-Iman (Sahih al-Jami' 1880)", "work"),
    # Du'a
    ("dua", "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",
     "O Allah, I ask You for beneficial knowledge, good and pure provision, and deeds that are accepted.",
     "Sunan Ibn Majah 925", "provision"),
    ("dua", "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
     "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of "
     "the Fire.", "Qur'an 2:201", "general"),
    ("dua", "رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي",
     "My Lord, expand my chest for me and make my task easy for me.", "Qur'an 20:25–26", "work"),
    ("dua", "اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ",
     "O Allah, suffice me with what You have made lawful instead of what You have forbidden, and by Your "
     "bounty make me independent of all besides You.", "Jami' at-Tirmidhi 3563", "provision"),
    ("dua", "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
     "Allah is sufficient for us, and He is the best Disposer of affairs.", "Qur'an 3:173", "trust"),
    ("dua", "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا",
     "O Allah, nothing is easy except what You make easy, and You make the difficult easy if You will.",
     "Sahih Ibn Hibban 974", "patience"),
]

# Zakat: nisab thresholds are fixed by the Sunnah (85 g gold / 595 g silver);
# market prices change and are updated by finance admins.
DEFAULT_ZAKAT = {
    "gold_price_per_gram_kes": 14000,
    "silver_price_per_gram_kes": 170,
    "nisab_basis": "silver",  # silver is the more cautious (lower) threshold, benefiting the poor
    "gold_nisab_grams": 85,
    "silver_nisab_grams": 595,
    "rate": 0.025,
    "note": "Prices are indicative. Confirm current gold and silver prices before paying.",
}
