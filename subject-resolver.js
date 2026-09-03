// Subject detection — Firebase field, chapter name, ya document ID se
(function () {
  const STANDARD_SUBJECTS = [
    "Mathematics", "Reasoning", "English", "General Awareness",
    "History", "Geography", "Hindi", "Science", "Social Science",
    "Physics", "Chemistry", "Biology", "Economics", "Civics"
  ];

  // Subject ke hisaab se chapters
  const SUBJECT_CHAPTERS = {
    "Mathematics": [
      "Number System","LCM and HCF","Simplification","Indices & Surds",
      "Average","Percentage","Ratio & Proportion","Profit & Loss",
      "Discount","Simple Interest","Compound Interest","Partnership",
      "Alligation & Mixture","Time and Work","Pipes and Cisterns",
      "Speed, Distance & Time","Train Problems","Boat & Stream",
      "Age Problems","Algebra","Geometry","Mensuration",
      "Trigonometry","Statistics","Data Interpretation"
    ],
    "Reasoning": [
      "Analogy","Series","Coding-Decoding","Blood Relations",
      "Direction & Distance","Ranking & Order","Syllogism",
      "Statement & Conclusion","Puzzle","Seating Arrangement",
      "Input-Output","Data Sufficiency","Non-Verbal Reasoning"
    ],
    "English": [
      "Grammar","Vocabulary","Reading Comprehension","Fill in the Blanks",
      "Error Spotting","Sentence Rearrangement","Synonyms & Antonyms",
      "Idioms & Phrases","One Word Substitution","Cloze Test"
    ],
    "General Awareness": [
      "Current Affairs","Static GK","Science & Technology",
      "Indian Economy","Sports","Awards & Honours","Government Schemes",
      "National & International Events","Books & Authors","Inventions"
    ],
    "History": [
      "यूरोप में राष्ट्रवाद","भारत में राष्ट्रवाद",
      "हिन्द-चीन में राष्ट्रवादी आंदोलन","समाजवाद और साम्यवाद",
      "Ancient History","Medieval History","Modern History",
      "Freedom Movement","Mughal Empire","Maurya Empire",
      "World War I & II","French Revolution","Industrial Revolution"
    ],
    "Geography": [
      "भूगोल","भारत का भूगोल","विश्व का भूगोल",
      "Physical Geography","Indian Geography","World Geography",
      "Climate","Rivers & Lakes","Mountains & Plateaus",
      "Natural Resources","Agriculture","Transport & Communication"
    ],
    "Hindi": [
      "गद्य साहित्य","पद्य साहित्य","व्याकरण","रस और छंद",
      "अलंकार","समास","संधि","मुहावरे और लोकोक्तियाँ",
      "वर्तनी","निबंध लेखन","पत्र लेखन","अपठित गद्यांश",
      "हिंदी साहित्य का इतिहास","भक्तिकाल","रीतिकाल","आधुनिक काल"
    ],
    "Science": [
      "विज्ञान - सामान्य","भौतिकी","रसायन विज्ञान","जीव विज्ञान",
      "Food & Nutrition","Human Body","Plant Kingdom","Animal Kingdom",
      "Motion & Force","Light & Sound","Electricity","Chemical Reactions",
      "Acids, Bases & Salts","Metals & Non-Metals","Ecosystem"
    ],
    "Social Science": [
      "इतिहास","भूगोल","राजनीति विज्ञान","अर्थशास्त्र",
      "History","Geography","Political Science","Economics"
    ],
    "Physics": [
      "Motion","Force & Laws of Motion","Gravitation","Work & Energy",
      "Sound","Light - Reflection & Refraction","Electricity",
      "Magnetic Effects of Current","Nuclear Physics","Thermodynamics"
    ],
    "Chemistry": [
      "Matter","Atoms & Molecules","Structure of Atom",
      "Chemical Reactions","Acids, Bases & Salts","Metals & Non-Metals",
      "Carbon & its Compounds","Periodic Table","Organic Chemistry"
    ],
    "Biology": [
      "Cell - Basic Unit of Life","Tissues","Diversity in Living Organisms",
      "Life Processes","Control & Coordination","Reproduction",
      "Heredity & Evolution","Our Environment","Natural Resources",
      "Human Body Systems"
    ],
    "Economics": [
      "Development","Sectors of Indian Economy","Money & Credit",
      "Globalisation","Consumer Rights","Poverty","Food Security",
      "GDP & National Income","Five Year Plans"
    ],
    "Civics": [
      "Democracy","Constitutional Design","Electoral Politics",
      "Institutions","Political Parties","Federalism",
      "Gender, Religion & Caste","Popular Struggle & Movements",
      "Rights in the Indian Constitution"
    ]
  };

  const HISTORY_CHAPTERS = new Set([
    "यूरोप में राष्ट्रवाद",
    "भारत में राष्ट्रवाद",
    "हिन्द-चीन में राष्ट्रवादी आंदोलन",
    "समाजवाद और साम्यवाद",
    "Samajwad aur Samyavad"
  ]);

  const MATH_CHAPTER_HINTS = [
    "Number System", "LCM and HCF", "Simplification", "Indices", "Surds",
    "Average", "Percentage", "Ratio", "Proportion", "Profit", "Loss",
    "Discount", "Interest", "Partnership", "Alligation", "Time and Work",
    "Pipes", "Speed", "Distance", "Train", "Boat", "Stream", "Age",
    "Algebra", "Geometry", "Mensuration", "Trigonometry", "Statistics",
    "Data Interpretation", "Mixture"
  ];

  const SUBJECT_ALIASES = {
    "general knowledge": "General Awareness",
    "gk": "General Awareness",
    "general": "General Awareness",
    "math": "Mathematics",
    "maths": "Mathematics",
    "mathematics": "Mathematics",
    "hist": "History",
    "history": "History",
    "geo": "Geography",
    "geography": "Geography",
    "science": "Science",
    "vigyan": "Science",
    "विज्ञान": "Science",
    "hindi": "Hindi",
    "हिंदी": "Hindi",
    "हिन्दी": "Hindi",
    "social science": "Social Science",
    "sst": "Social Science",
    "physics": "Physics",
    "chemistry": "Chemistry",
    "biology": "Biology",
    "economics": "Economics",
    "civics": "Civics",
    "political science": "Civics"
  };

  function normalizeSubjectName(raw) {
    if (!raw) return "";
    const trimmed = String(raw).trim();
    if (!trimmed) return "";
    const key = trimmed.toLowerCase();
    if (SUBJECT_ALIASES[key]) return SUBJECT_ALIASES[key];
    if (["subject", "unknown", "custom", "general"].includes(key)) return "";
    return trimmed;
  }

  function inferSubjectFromChapter(chapter) {
    if (!chapter) return null;
    const ch = String(chapter);
    if (HISTORY_CHAPTERS.has(ch)) return "History";
    if (
      ch.includes("राष्ट्रवाद") ||
      ch.includes("समाजवाद") ||
      ch.includes("साम्यवाद") ||
      ch.includes("हिन्द-चीन") ||
      /nationalism|samajwad|samyavad|indochina|india.*history/i.test(ch)
    ) return "History";
    if (ch === "भूगोल" || /geograph/i.test(ch)) return "Geography";
    if (ch.includes("विज्ञान") || /science/i.test(ch)) return "General Awareness";
    if (MATH_CHAPTER_HINTS.some(h => ch.includes(h))) return "Mathematics";
    return null;
  }

  function inferSubjectFromDocId(id) {
    if (!id) return null;
    const idL = String(id).toLowerCase();
    if (/^(math|mathematics)-/.test(idL)) return "Mathematics";
    if (/^history-/.test(idL) || /^gk-ssc-/.test(idL)) return "History";
    if (/^geo-/.test(idL)) return "Geography";
    if (/^reason/.test(idL)) return "Reasoning";
    if (/^english-/.test(idL)) return "English";
    return null;
  }

  function resolveQuestionSubject(q, docId) {
    const id = docId || q?.id || q?.[4] || "";
    const chapter = q?.chapter || q?.[3] || "";
    const raw = q?.subject ?? q?.[5] ?? "";
    const normalized = normalizeSubjectName(raw);
    if (normalized) return normalized;
    return (
      inferSubjectFromDocId(id) ||
      inferSubjectFromChapter(chapter) ||
      "General"
    );
  }

  function getSubjectFilterOptions(items, resolver) {
    // Sirf wahi subjects jo actual question bank data mein maujood hain —
    // STANDARD_SUBJECTS list ab yahan add nahi hoti, sirf sorting order
    // decide karne ke liye reference ke roop mein use hoti hai.
    const fromData = [...new Set(items.map(q => resolver(q)))].filter(Boolean);
    return fromData.sort((a, b) => {
      const ai = STANDARD_SUBJECTS.indexOf(a);
      const bi = STANDARD_SUBJECTS.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
  }

  // ── Class-first cascading filters (Class → Subject → Chapter) ──
  // Poore app mein (Question Bank, Bulk Upload, Paper Generator, Question
  // Generator tool) admin ko sabse pehle Class choose karna hota hai —
  // uske baad Subject dropdown mein sirf wahi Subjects dikhne chahiye
  // jinme us Class ke questions maujood hain, aur Chapter dropdown mein
  // sirf wahi Chapters jo us Class + Subject combination ke hain.
  //
  // `classId` khaali/na diya gaya ho to koi bhi class-filtering nahi hoti
  // (poora data dikhta hai) — taaki jab tak admin Class chunta nahi, purana
  // behavior hi bana rahe.
  function itemsForClass(items, classId) {
    if (!classId) return items || [];
    return (items || []).filter(q => q && q.classId === classId);
  }

  function getSubjectsForClass(items, classId, resolver) {
    const scoped = itemsForClass(items, classId);
    return getSubjectFilterOptions(scoped, resolver);
  }

  function getChaptersForClass(items, classId, subject, resolver) {
    let scoped = itemsForClass(items, classId);
    if (subject) scoped = scoped.filter(q => resolver(q) === subject);
    return [...new Set(scoped.map(q => q && q.chapter).filter(Boolean))].sort();
  }

  // v34: Question Bank doc ID scheme — Class + Chapter + Serial number.
  // e.g. classId "class_10", chapter "Number System" → serial 1 gives
  // "class10-Number-System-1". Chapter naam ko dash-separated slug mein
  // convert kiya jaata hai (Hindi chapter names bhi as-is chalte hain,
  // Firestore doc IDs Unicode support karte hain).
  function classIdToLabel(classId) {
    const m = String(classId || "").match(/(\d+)/);
    return m ? "class" + m[1] : "class";
  }

  function slugifyChapter(chapter) {
    let s = String(chapter || "General").trim();
    s = s.replace(/\s+/g, "-");
    s = s.replace(/[\/.#\[\]]/g, ""); // Firestore-unsafe / risky characters
    s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
    if (!s) s = "General";
    if (s.length > 60) s = s.slice(0, 60).replace(/-+$/, "");
    return s;
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildQuestionDocId(classId, chapter, serial) {
    return `${classIdToLabel(classId)}-${slugifyChapter(chapter)}-${serial}`;
  }

  // True if docId already follows "<classLabel>-<chapterSlug>-<serial>"
  // for this exact classId + chapter.
  function docIdMatchesScheme(docId, classId, chapter) {
    const label = classIdToLabel(classId);
    const slug = slugifyChapter(chapter);
    const re = new RegExp(`^${escapeRegExp(label)}-${escapeRegExp(slug)}-\\d+$`);
    return re.test(String(docId || ""));
  }

  // Scans `items` (array of {id, classId, chapter, ...}) for the highest
  // existing serial already used for this classId+chapter, and returns
  // the next free serial number (1 if none exist yet).
  function nextSerialForGroup(items, classId, chapter) {
    const label = classIdToLabel(classId);
    const slug = slugifyChapter(chapter);
    const re = new RegExp(`^${escapeRegExp(label)}-${escapeRegExp(slug)}-(\\d+)$`);
    let max = 0;
    (items || []).forEach(q => {
      const m = String(q?.id || "").match(re);
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    });
    return max + 1;
  }

  // v107: Do chapter-name strings jo dikhne mein bilkul same hain lekin
  // beech mein extra space / double-space / Hindi typing se aaya hua
  // invisible zero-width character rakhte hain — dono "canonicalize"
  // karne ke baad EXACTLY match kar jaate hain. Ye naye typo/duplicate
  // chapters banne se ROKTA hai (sirf baad mein merge nahi karta).
  function canonicalizeChapterName(s) {
    return String(s || "")
      .normalize("NFC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width space/joiner/BOM
      .trim()
      .replace(/\s+/g, " ");
  }

  // Naya question save hone se PEHLE call karo — agar isi Class mein
  // (ya kisi bhi Class mein, agar isi Class mein na mile) pehle se koi
  // chapter aisi maujood hai jiska canonical form match karta hai, to
  // uski EXACT (pehle se establish) spelling wapas kar deta hai — taaki
  // naya, thoda-alag-dikhne-wala variant kabhi bane hi na. Agar genuinely
  // naya chapter hai, to sirf clean (trim/space-collapsed) version deta
  // hai.
  function resolveCanonicalChapterName(items, classId, rawChapter) {
    const canon = canonicalizeChapterName(rawChapter);
    if (!canon) return rawChapter;
    const all = (items || []).filter(q => q && q.chapter);
    const scoped = classId ? all.filter(q => q.classId === classId) : all;
    const pool = scoped.length ? scoped : all;
    for (const q of pool) {
      if (canonicalizeChapterName(q.chapter) === canon) return q.chapter;
    }
    return canon;
  }

  window.SubjectResolver = {
    STANDARD_SUBJECTS,
    SUBJECT_CHAPTERS,
    resolveQuestionSubject,
    getSubjectFilterOptions,
    itemsForClass,
    getSubjectsForClass,
    getChaptersForClass,
    inferSubjectFromChapter,
    inferSubjectFromDocId,
    classIdToLabel,
    slugifyChapter,
    buildQuestionDocId,
    docIdMatchesScheme,
    nextSerialForGroup,
    canonicalizeChapterName,
    resolveCanonicalChapterName
  };
})();
