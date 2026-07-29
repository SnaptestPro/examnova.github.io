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
    const fromData = [...new Set(items.map(q => resolver(q)))].filter(Boolean);
    return [...new Set([...STANDARD_SUBJECTS, ...fromData])].sort((a, b) => {
      const ai = STANDARD_SUBJECTS.indexOf(a);
      const bi = STANDARD_SUBJECTS.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
  }

  window.SubjectResolver = {
    STANDARD_SUBJECTS,
    SUBJECT_CHAPTERS,
    resolveQuestionSubject,
    getSubjectFilterOptions,
    inferSubjectFromChapter,
    inferSubjectFromDocId
  };
})();
