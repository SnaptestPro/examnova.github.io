/**
 * ═══════════════════════════════════════════════════════════════
 *  THE VISHNU SHARMA TEST – Firebase Question Bank Seeder
 *  Google Apps Script (Code.gs)
 *
 *  ⚠️ SECURITY: Restrict Firestore Rules to authenticated users only.
 *
 *  SUBJECTS INCLUDED:
 *  1. Mathematics  (~200 questions)
 *  2. History – यूरोप में राष्ट्रवाद (54 questions)
 *  3. History – भारत में राष्ट्रवाद (45 questions)
 *  4. History – हिन्द-चीन में राष्ट्रवादी आंदोलन (42 questions)
 *  5. History – समाजवाद एवं साम्यवाद (46 questions)
 *
 *  HOW TO USE:
 *  1. Google Apps Script editor mein ye code paste karo
 *  2. Upar "Run" button dabao → "addAllQuestions" select karo
 *  3. Permission maange to Allow karo
 *  4. Execution log mein LIVE progress dekhte raho
 * ═══════════════════════════════════════════════════════════════
 */

// ── Firebase Config ──
const PROJECT_ID = "the-vishnu-sharma-test";
const API_KEY    = "AIzaSyBTrKAoQ2T9KNB2vcacv4EPehaDboXmUxk";
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ══════════════════════════════════════════════════════════════
//  MAIN FUNCTION — isko Run karo
// ══════════════════════════════════════════════════════════════
function addAllQuestions() {
  const questions = getAllQuestions();
  const total = questions.length;
  Logger.log(`\n📚 TOTAL QUESTIONS TO UPLOAD: ${total}`);
  Logger.log(`════════════════════════════════════════`);

  // Subject-wise count
  const subjectMap = {};
  questions.forEach(q => {
    const s = q.subject || "Mathematics";
    subjectMap[s] = (subjectMap[s] || 0) + 1;
  });
  Object.keys(subjectMap).forEach(s => Logger.log(`   ${s}: ${subjectMap[s]} questions`));
  Logger.log(`════════════════════════════════════════\n`);

  let added = 0, skipped = 0, failed = 0;

  questions.forEach((q, i) => {
    // docId subject+chapter se scoped hona chahiye, sirf position (i) se nahi —
    // warna dusre subject/upload run ka "question-0001" isi ID se takra kar
    // purana data overwrite kar deta hai (Firestore PATCH poora doc replace
    // karta hai). Isi wajah se pehle upload kiye hue subject (e.g. Mathematics)
    // ke sab questions baad ke upload se gayab ho sakte hain.
    const docId = q.docId || makeQuestionDocId(q, i);
    try {
      const result = addQuestionToFirestore(docId, q);
      if (result) {
        added++;
        // Live progress every question (subject + chapter shown)
        const subject = q.subject || "Mathematics";
        Logger.log(`✅ [${i+1}/${total}] ${docId} — ${subject} > ${q.chapter}`);
      }
    } catch (e) {
      failed++;
      Logger.log(`❌ [${i+1}/${total}] FAILED: ${docId} — ${e.message}`);
    }

    // Progress milestone every 25 questions
    if ((i + 1) % 25 === 0) {
      const pct = Math.round(((i+1)/total)*100);
      Logger.log(`\n⏳ Progress: ${i+1}/${total} (${pct}%) — Added: ${added} | Failed: ${failed}\n`);
      Utilities.sleep(300);
    }
  });

  Logger.log(`\n════════════════════════════════════════`);
  Logger.log(`🎉 UPLOAD COMPLETE!`);
  Logger.log(`✅ Added:   ${added}`);
  Logger.log(`⏭️  Skipped: ${skipped}`);
  Logger.log(`❌ Failed:  ${failed}`);
  Logger.log(`📊 Total:   ${total}`);
  Logger.log(`════════════════════════════════════════`);
}

// ══════════════════════════════════════════════════════════════
//  Sirf ek chapter ke questions add karo (test ke liye)
// ══════════════════════════════════════════════════════════════
function addSingleChapter() {
  const chapter = "Percentage"; // ← yahan chapter name likho
  const all = getAllQuestions().filter(q => q.chapter === chapter);
  Logger.log(`Adding ${all.length} questions for: ${chapter}`);

  all.forEach((q, i) => {
    const docId = q.docId || `chapter-${chapter.replace(/\s+/g,"-").toLowerCase()}-${i+1}`;
    try {
      addQuestionToFirestore(docId, q);
      Logger.log(`✅ Added Q${i+1}: ${q.textHI.substring(0,50)}...`);
    } catch(e) {
      Logger.log(`❌ Q${i+1} failed: ${e.message}`);
    }
    Utilities.sleep(200);
  });
}

// ══════════════════════════════════════════════════════════════
//  Test connection (pehle ye run karo)
// ══════════════════════════════════════════════════════════════
function testConnection() {
  const url = `${BASE_URL}/questionBank?key=${API_KEY}&pageSize=1`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log(`Status: ${res.getResponseCode()}`);
  Logger.log(`Response: ${res.getContentText().substring(0, 200)}`);
  if (res.getResponseCode() === 200) {
    Logger.log("✅ Firebase connection SUCCESSFUL!");
  } else {
    Logger.log("❌ Connection FAILED. Check API key and Firestore rules.");
  }
}

// ══════════════════════════════════════════════════════════════
//  Unique doc ID scoped to subject+chapter (prevents cross-batch overwrite)
// ══════════════════════════════════════════════════════════════
function makeQuestionDocId(q, i) {
  var slug = function (s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 40) || "na";
  };
  var subj = slug(q.subject || "general");
  var chap = slug(q.chapter || "question");
  var idx  = String(i + 1).padStart(4, "0");
  return `q-${subj}-${chap}-${idx}`;
}

// ══════════════════════════════════════════════════════════════
//  FIRESTORE REST API — Document Add/Update
// ══════════════════════════════════════════════════════════════
function addQuestionToFirestore(docId, q) {
  const url = `${BASE_URL}/questionBank/${docId}?key=${API_KEY}`;

  const body = {
    fields: {
      subject:       { stringValue: q.subject || "Mathematics" },
      chapter:       { stringValue: q.chapter || "" },
      textHI:        { stringValue: q.textHI  || "" },
      textEN:        { stringValue: q.textEN  || "" },
      text:          { stringValue: q.textHI  || q.textEN || "" },
      optionsHI:     { arrayValue:  { values: q.optionsHI.map(o => ({ stringValue: String(o) })) }},
      optionsEN:     { arrayValue:  { values: q.optionsEN.map(o => ({ stringValue: String(o) })) }},
      options:       { arrayValue:  { values: q.optionsHI.map(o => ({ stringValue: String(o) })) }},
      answer:        { integerValue: String(q.answer) },
      explanationHI: { stringValue: q.explanationHI || "" },
      explanationEN: { stringValue: q.explanationEN || "" },
      explanation:   { stringValue: q.explanationHI || q.explanationEN || "" },
      seeded:        { booleanValue: true },
      seededBy:      { stringValue: "AppsScript" }
    }
  };

  const options = {
    method: "PATCH",
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();

  if (code !== 200 && code !== 201) {
    throw new Error(`HTTP ${code}: ${res.getContentText().substring(0, 200)}`);
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  MASTER FUNCTION — Sab subjects combine karta hai
// ══════════════════════════════════════════════════════════════
function getAllQuestions() {
  return [
    ...getMathQuestions(),
    ...getHistoryEuropeQuestions(),
    ...getHistoryIndiaQuestions(),
    ...getHistoryIndochinaQuestions(),
    ...getSocialismQuestions()
  ];
}

// ══════════════════════════════════════════════════════════════
//  SUBJECT 1: MATHEMATICS
// ══════════════════════════════════════════════════════════════
function getMathQuestions() {
  return [
    // ─── NUMBER SYSTEM ───────────────────────────────────────
    { subject:"Mathematics", chapter:"Number System", textHI:"1 से 100 तक सभी प्राकृतिक संख्याओं का योग?", textEN:"Sum of all natural numbers from 1 to 100?", optionsHI:["4950","5050","5000","5100"], optionsEN:["4950","5050","5000","5100"], answer:1, explanationHI:"n(n+1)/2 = 5050", explanationEN:"n(n+1)/2 = 5050", docId:"math-ssc-0001" },
    { subject:"Mathematics", chapter:"Number System", textHI:"सबसे छोटी अभाज्य संख्या कौन सी है?", textEN:"Smallest prime number?", optionsHI:["1","2","3","5"], optionsEN:["1","2","3","5"], answer:1, explanationHI:"2 सबसे छोटी अभाज्य संख्या है।", explanationEN:"2 is the smallest prime.", docId:"math-ssc-0002" },
    { subject:"Mathematics", chapter:"Number System", textHI:"72 के अभाज्य गुणनखंड क्या हैं?", textEN:"Prime factors of 72?", optionsHI:["2³×3²","2²×3³","2⁴×3","2³×3"], optionsEN:["2³×3²","2²×3³","2⁴×3","2³×3"], answer:0, explanationHI:"72=2³×3²", explanationEN:"72=2³×3²", docId:"math-ssc-0003" },
    { subject:"Mathematics", chapter:"Number System", textHI:"कौन सी संख्या 3 और 7 दोनों से विभाज्य है?", textEN:"Which is divisible by both 3 and 7?", optionsHI:["28","42","56","63"], optionsEN:["28","42","56","63"], answer:1, explanationHI:"42=3×14=7×6", explanationEN:"42=3×14=7×6", docId:"math-ssc-0004" },
    { subject:"Mathematics", chapter:"Number System", textHI:"किसी संख्या का वर्ग 169 है। वह संख्या?", textEN:"Square of a number is 169. Number?", optionsHI:["11","12","13","14"], optionsEN:["11","12","13","14"], answer:2, explanationHI:"13²=169", explanationEN:"13²=169", docId:"math-ssc-0005" },
    { subject:"Mathematics", chapter:"Number System", textHI:"√169 + √144 का मान?", textEN:"Value of √169 + √144?", optionsHI:["25","27","24","26"], optionsEN:["25","27","24","26"], answer:0, explanationHI:"13+12=25", explanationEN:"13+12=25", docId:"math-ssc-0006" },
    { subject:"Mathematics", chapter:"Number System", textHI:"1 से 50 तक कितनी सम संख्याएँ हैं?", textEN:"Even numbers from 1 to 50?", optionsHI:["24","25","26","20"], optionsEN:["24","25","26","20"], answer:1, explanationHI:"50/2=25", explanationEN:"50/2=25", docId:"math-ssc-0007" },
    { subject:"Mathematics", chapter:"Number System", textHI:"तीन क्रमागत सम संख्याओं का योग 78 है। सबसे बड़ी?", textEN:"Sum of 3 consecutive even numbers is 78. Largest?", optionsHI:["24","26","28","30"], optionsEN:["24","26","28","30"], answer:2, explanationHI:"n+(n+2)+(n+4)=78→n=24→बड़ी=28", explanationEN:"n=24, largest=28", docId:"math-ssc-0008" },
    { subject:"Mathematics", chapter:"Number System", textHI:"(–3)² + (–4)² = ?", textEN:"(–3)² + (–4)² = ?", optionsHI:["7","25","–25","49"], optionsEN:["7","25","–25","49"], answer:1, explanationHI:"9+16=25", explanationEN:"9+16=25", docId:"math-ssc-0009" },
    { subject:"Mathematics", chapter:"Number System", textHI:"0.625 को भिन्न रूप में?", textEN:"0.625 as a fraction?", optionsHI:["5/8","3/5","5/6","7/8"], optionsEN:["5/8","3/5","5/6","7/8"], answer:0, explanationHI:"625/1000=5/8", explanationEN:"625/1000=5/8", docId:"math-ssc-0010" },
    { subject:"Mathematics", chapter:"Number System", textHI:"किसी संख्या को 5 से गुणा करें तो 85 मिलता है। संख्या?", textEN:"5 times a number = 85. Number?", optionsHI:["15","17","19","21"], optionsEN:["15","17","19","21"], answer:1, explanationHI:"85/5=17", explanationEN:"85/5=17", docId:"math-ssc-0011" },
    { subject:"Mathematics", chapter:"Number System", textHI:"340 में से 4 घटाकर 7 से भाग दें। भागफल?", textEN:"(340-4)÷7 = ?", optionsHI:["46","48","47","49"], optionsEN:["46","48","47","49"], answer:1, explanationHI:"336/7=48", explanationEN:"336/7=48", docId:"math-ssc-0012" },

    // ─── LCM AND HCF ─────────────────────────────────────────
    { subject:"Mathematics", chapter:"LCM and HCF", textHI:"12 और 18 का LCM?", textEN:"LCM of 12 and 18?", optionsHI:["36","24","72","18"], optionsEN:["36","24","72","18"], answer:0, explanationHI:"LCM(12,18)=36", explanationEN:"36", docId:"math-ssc-0013" },
    { subject:"Mathematics", chapter:"LCM and HCF", textHI:"48 और 36 का HCF?", textEN:"HCF of 48 and 36?", optionsHI:["6","12","18","24"], optionsEN:["6","12","18","24"], answer:1, explanationHI:"HCF(48,36)=12", explanationEN:"12", docId:"math-ssc-0014" },
    { subject:"Mathematics", chapter:"LCM and HCF", textHI:"LCM=84, HCF=12, एक संख्या=28. दूसरी?", textEN:"LCM=84, HCF=12, one=28. Other?", optionsHI:["36","48","24","42"], optionsEN:["36","48","24","42"], answer:0, explanationHI:"84×12/28=36", explanationEN:"84×12/28=36", docId:"math-ssc-0015" },
    { subject:"Mathematics", chapter:"LCM and HCF", textHI:"4, 6, 8 का LCM?", textEN:"LCM of 4, 6, 8?", optionsHI:["12","24","16","48"], optionsEN:["12","24","16","48"], answer:1, explanationHI:"LCM=24", explanationEN:"24", docId:"math-ssc-0016" },
    { subject:"Mathematics", chapter:"LCM and HCF", textHI:"दो संख्याओं का गुणनफल 2160 और HCF 12 है। LCM?", textEN:"Product=2160, HCF=12. LCM?", optionsHI:["160","180","120","240"], optionsEN:["160","180","120","240"], answer:1, explanationHI:"2160/12=180", explanationEN:"180", docId:"math-ssc-0017" },
    { subject:"Mathematics", chapter:"LCM and HCF", textHI:"15, 25, 35 का HCF?", textEN:"HCF of 15, 25, 35?", optionsHI:["3","5","7","15"], optionsEN:["3","5","7","15"], answer:1, explanationHI:"HCF=5", explanationEN:"5", docId:"math-ssc-0018" },
    { subject:"Mathematics", chapter:"LCM and HCF", textHI:"40, 56, 64 को पूर्णतः विभाजित करने वाली सबसे बड़ी संख्या?", textEN:"Largest number dividing 40, 56, 64 exactly?", optionsHI:["4","8","16","6"], optionsEN:["4","8","16","6"], answer:1, explanationHI:"HCF=8", explanationEN:"8", docId:"math-ssc-0019" },
    { subject:"Mathematics", chapter:"LCM and HCF", textHI:"4, 6, 8, 10 से विभाज्य न्यूनतम संख्या?", textEN:"Smallest number divisible by 4,6,8,10?", optionsHI:["60","80","120","100"], optionsEN:["60","80","120","100"], answer:2, explanationHI:"LCM=120", explanationEN:"120", docId:"math-ssc-0020" },

    // ─── SIMPLIFICATION ──────────────────────────────────────
    { subject:"Mathematics", chapter:"Simplification", textHI:"45 - 5 × 4 + 10 = ?", textEN:"45 - 5 × 4 + 10 = ?", optionsHI:["35","155","30","50"], optionsEN:["35","155","30","50"], answer:0, explanationHI:"45-20+10=35", explanationEN:"35", docId:"math-ssc-0021" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"(8+4)² ÷ 4 – 3×2 = ?", textEN:"(8+4)² ÷ 4 – 3×2 = ?", optionsHI:["30","36","42","18"], optionsEN:["30","36","42","18"], answer:0, explanationHI:"144/4-6=30", explanationEN:"30", docId:"math-ssc-0022" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"500 ÷ 25 × 4 + 100 = ?", textEN:"500 ÷ 25 × 4 + 100 = ?", optionsHI:["80","180","200","220"], optionsEN:["80","180","200","220"], answer:1, explanationHI:"20×4+100=180", explanationEN:"180", docId:"math-ssc-0023" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"√256 × √16 = ?", textEN:"√256 × √16 = ?", optionsHI:["48","64","32","16"], optionsEN:["48","64","32","16"], answer:1, explanationHI:"16×4=64", explanationEN:"64", docId:"math-ssc-0024" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"1²+2²+3²+4²+5² = ?", textEN:"1²+2²+3²+4²+5² = ?", optionsHI:["55","45","65","35"], optionsEN:["55","45","65","35"], answer:0, explanationHI:"1+4+9+16+25=55", explanationEN:"55", docId:"math-ssc-0025" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"2+2×2-2÷2 = ?", textEN:"2+2×2-2÷2 = ?", optionsHI:["2","4","5","6"], optionsEN:["2","4","5","6"], answer:2, explanationHI:"2+4-1=5", explanationEN:"5", docId:"math-ssc-0026" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"40% of 500 + 25% of 200 = ?", textEN:"40% of 500 + 25% of 200 = ?", optionsHI:["200","250","300","150"], optionsEN:["200","250","300","150"], answer:1, explanationHI:"200+50=250", explanationEN:"250", docId:"math-ssc-0027" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"3³ – 2³ = ?", textEN:"3³ – 2³ = ?", optionsHI:["7","19","27","17"], optionsEN:["7","19","27","17"], answer:1, explanationHI:"27-8=19", explanationEN:"19", docId:"math-ssc-0028" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"a=3, b=4 तो a²+b² = ?", textEN:"a=3,b=4. a²+b²=?", optionsHI:["25","49","12","7"], optionsEN:["25","49","12","7"], answer:0, explanationHI:"9+16=25", explanationEN:"25", docId:"math-ssc-0029" },
    { subject:"Mathematics", chapter:"Simplification", textHI:"1000-(100-10)×5 = ?", textEN:"1000-(100-10)×5 = ?", optionsHI:["555","550","540","600"], optionsEN:["555","550","540","600"], answer:1, explanationHI:"1000-450=550", explanationEN:"550", docId:"math-ssc-0030" },

    // ─── PERCENTAGE ──────────────────────────────────────────
    { subject:"Mathematics", chapter:"Percentage", textHI:"250 का 20% = ?", textEN:"20% of 250?", optionsHI:["40","50","45","60"], optionsEN:["40","50","45","60"], answer:1, explanationHI:"250×20/100=50", explanationEN:"50", docId:"math-ssc-0031" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"30 किसी संख्या का 15% है। वह संख्या?", textEN:"30 is 15% of a number. Number?", optionsHI:["150","200","250","300"], optionsEN:["150","200","250","300"], answer:1, explanationHI:"30×100/15=200", explanationEN:"200", docId:"math-ssc-0032" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"600 में से 480 अंक। प्रतिशत?", textEN:"480 out of 600. Percentage?", optionsHI:["75%","80%","85%","90%"], optionsEN:["75%","80%","85%","90%"], answer:1, explanationHI:"480/600×100=80%", explanationEN:"80%", docId:"math-ssc-0033" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"500 में 20% वृद्धि के बाद?", textEN:"500 after 20% increase?", optionsHI:["550","600","620","650"], optionsEN:["550","600","620","650"], answer:1, explanationHI:"500×1.2=600", explanationEN:"600", docId:"math-ssc-0034" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"800 में 25% कमी के बाद?", textEN:"800 after 25% decrease?", optionsHI:["500","600","700","550"], optionsEN:["500","600","700","550"], answer:1, explanationHI:"800×0.75=600", explanationEN:"600", docId:"math-ssc-0035" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"160 का कितना% = 40?", textEN:"40 is what % of 160?", optionsHI:["20%","25%","30%","40%"], optionsEN:["20%","25%","30%","40%"], answer:1, explanationHI:"40/160×100=25%", explanationEN:"25%", docId:"math-ssc-0036" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"15% वृद्धि के बाद 230 मिलता है। मूल संख्या?", textEN:"15% increase gives 230. Original?", optionsHI:["200","210","220","190"], optionsEN:["200","210","220","190"], answer:0, explanationHI:"230/1.15=200", explanationEN:"200", docId:"math-ssc-0037" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"45 का 60% = ?", textEN:"60% of 45?", optionsHI:["25","27","30","24"], optionsEN:["25","27","30","24"], answer:1, explanationHI:"45×0.6=27", explanationEN:"27", docId:"math-ssc-0038" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"10% वृद्धि फिर 10% कमी। शुद्ध परिवर्तन?", textEN:"10% increase then 10% decrease. Net?", optionsHI:["0%","-1%","+1%","-2%"], optionsEN:["0%","-1%","+1%","-2%"], answer:1, explanationHI:"-1% (r²/100)", explanationEN:"-1%", docId:"math-ssc-0039" },
    { subject:"Mathematics", chapter:"Percentage", textHI:"10000 की जनसंख्या 10% घटे। 2 वर्ष बाद?", textEN:"Population 10000, decreases 10%/yr. After 2 yrs?", optionsHI:["8100","8200","9000","7500"], optionsEN:["8100","8200","9000","7500"], answer:0, explanationHI:"10000×0.81=8100", explanationEN:"8100", docId:"math-ssc-0040" },

    // ─── PROFIT AND LOSS ─────────────────────────────────────
    { subject:"Mathematics", chapter:"Profit and Loss", textHI:"Rs.400 में खरीदा, Rs.500 में बेचा। लाभ%?", textEN:"CP=400, SP=500. Profit%?", optionsHI:["20%","25%","15%","10%"], optionsEN:["20%","25%","15%","10%"], answer:1, explanationHI:"100/400×100=25%", explanationEN:"25%", docId:"math-ssc-0041" },
    { subject:"Mathematics", chapter:"Profit and Loss", textHI:"CP=600, SP=480. हानि%?", textEN:"CP=600, SP=480. Loss%?", optionsHI:["15%","20%","25%","10%"], optionsEN:["15%","20%","25%","10%"], answer:1, explanationHI:"120/600×100=20%", explanationEN:"20%", docId:"math-ssc-0042" },
    { subject:"Mathematics", chapter:"Profit and Loss", textHI:"20% लाभ पर SP=Rs.900. CP?", textEN:"SP=900 at 20% profit. CP?", optionsHI:["700","750","800","720"], optionsEN:["700","750","800","720"], answer:1, explanationHI:"900/1.2=750", explanationEN:"750", docId:"math-ssc-0043" },
    { subject:"Mathematics", chapter:"Profit and Loss", textHI:"15% हानि पर SP=Rs.340. CP?", textEN:"15% loss, SP=340. CP?", optionsHI:["380","400","420","360"], optionsEN:["380","400","420","360"], answer:1, explanationHI:"340/0.85=400", explanationEN:"400", docId:"math-ssc-0044" },
    { subject:"Mathematics", chapter:"Profit and Loss", textHI:"CP=800, 25% लाभ पर SP?", textEN:"CP=800, 25% profit. SP?", optionsHI:["950","1000","900","1100"], optionsEN:["950","1000","900","1100"], answer:1, explanationHI:"800×1.25=1000", explanationEN:"1000", docId:"math-ssc-0045" },
    { subject:"Mathematics", chapter:"Profit and Loss", textHI:"10% हानि पर Rs.360 में बेचा। 20% लाभ पर SP?", textEN:"Sold at 10% loss for 360. SP for 20% profit?", optionsHI:["450","480","420","500"], optionsEN:["450","480","420","500"], answer:1, explanationHI:"CP=400; SP=480", explanationEN:"480", docId:"math-ssc-0046" },
    { subject:"Mathematics", chapter:"Profit and Loss", textHI:"10% लाभ की बजाय 10% हानि से Rs.40 कम। CP?", textEN:"10% profit→loss gives Rs.40 less. CP?", optionsHI:["150","200","250","300"], optionsEN:["150","200","250","300"], answer:1, explanationHI:"20%×CP=40→CP=200", explanationEN:"200", docId:"math-ssc-0047" },
    { subject:"Mathematics", chapter:"Profit and Loss", textHI:"120 संतरे Rs.1200 में खरीदे, Rs.1350 में बेचे। प्रति संतरा लाभ?", textEN:"120 oranges for 1200, sold for 1350. Profit per?", optionsHI:["1.00","1.25","1.50","2.00"], optionsEN:["1.00","1.25","1.50","2.00"], answer:1, explanationHI:"150/120=1.25", explanationEN:"1.25", docId:"math-ssc-0048" },

    // ─── SIMPLE INTEREST ─────────────────────────────────────
    { subject:"Mathematics", chapter:"Simple Interest", textHI:"P=1000, R=5%, T=3 वर्ष। SI?", textEN:"P=1000, R=5%, T=3. SI?", optionsHI:["100","150","200","50"], optionsEN:["100","150","200","50"], answer:1, explanationHI:"PRT/100=150", explanationEN:"150", docId:"math-ssc-0049" },
    { subject:"Mathematics", chapter:"Simple Interest", textHI:"P=2000, T=3, SI=360. R?", textEN:"P=2000, T=3, SI=360. Rate?", optionsHI:["5%","6%","7%","8%"], optionsEN:["5%","6%","7%","8%"], answer:1, explanationHI:"360×100/(2000×3)=6%", explanationEN:"6%", docId:"math-ssc-0050" },
    { subject:"Mathematics", chapter:"Simple Interest", textHI:"Rs.500, 5% SI पर Rs.750 कब होगा?", textEN:"Rs.500 becomes 750 at 5% SI. Time?", optionsHI:["5","10","8","15"], optionsEN:["5 yrs","10 yrs","8 yrs","15 yrs"], answer:1, explanationHI:"250×100/(500×5)=10", explanationEN:"10 years", docId:"math-ssc-0051" },
    { subject:"Mathematics", chapter:"Simple Interest", textHI:"P=4000, T=2, A=4800. R?", textEN:"P=4000, T=2, A=4800. Rate?", optionsHI:["8%","10%","12%","6%"], optionsEN:["8%","10%","12%","6%"], answer:1, explanationHI:"800×100/(4000×2)=10%", explanationEN:"10%", docId:"math-ssc-0052" },
    { subject:"Mathematics", chapter:"Simple Interest", textHI:"P=6000, R=6%, T=2. मिश्रधन?", textEN:"P=6000, R=6%, T=2. Amount?", optionsHI:["6600","6720","6800","7200"], optionsEN:["6600","6720","6800","7200"], answer:1, explanationHI:"6000+720=6720", explanationEN:"6720", docId:"math-ssc-0053" },
    { subject:"Mathematics", chapter:"Simple Interest", textHI:"SI=300, R=10%, T=2. P?", textEN:"SI=300, R=10%, T=2. P?", optionsHI:["1200","1500","1800","2000"], optionsEN:["1200","1500","1800","2000"], answer:1, explanationHI:"P=300×100/20=1500", explanationEN:"1500", docId:"math-ssc-0054" },
    { subject:"Mathematics", chapter:"Simple Interest", textHI:"दर 4% से 6% हो तो 3 वर्षों में Rs.120 अधिक। P?", textEN:"Rate 4%→6%, extra Rs.120 in 3 yrs. P?", optionsHI:["1500","2000","2500","1800"], optionsEN:["1500","2000","2500","1800"], answer:1, explanationHI:"P×0.02×3=120→P=2000", explanationEN:"2000", docId:"math-ssc-0055" },
    { subject:"Mathematics", chapter:"Simple Interest", textHI:"4 वर्ष में SI = P का 2/5 है। दर?", textEN:"SI in 4 yrs = 2/5 of P. Rate?", optionsHI:["8%","10%","12%","5%"], optionsEN:["8%","10%","12%","5%"], answer:1, explanationHI:"(2/5)×100/4=10%", explanationEN:"10%", docId:"math-ssc-0056" },

    // ─── COMPOUND INTEREST ───────────────────────────────────
    { subject:"Mathematics", chapter:"Compound Interest", textHI:"P=1000, R=10%, T=2. CI?", textEN:"P=1000, R=10%, T=2. CI?", optionsHI:["200","210","220","190"], optionsEN:["200","210","220","190"], answer:1, explanationHI:"1000×1.21-1000=210", explanationEN:"210", docId:"math-ssc-0057" },
    { subject:"Mathematics", chapter:"Compound Interest", textHI:"P=8000, R=20%, T=2. मिश्रधन?", textEN:"P=8000, R=20%, T=2. Amount?", optionsHI:["11520","11200","10800","12000"], optionsEN:["11520","11200","10800","12000"], answer:0, explanationHI:"8000×1.44=11520", explanationEN:"11520", docId:"math-ssc-0058" },
    { subject:"Mathematics", chapter:"Compound Interest", textHI:"P=2500, R=10%, T=2. CI-SI अंतर?", textEN:"P=2500, R=10%, T=2. CI-SI?", optionsHI:["20","25","30","15"], optionsEN:["20","25","30","15"], answer:1, explanationHI:"P×(r/100)²=2500×0.01=25", explanationEN:"25", docId:"math-ssc-0059" },
    { subject:"Mathematics", chapter:"Compound Interest", textHI:"Rs.1000 CI पर Rs.1331 = 10% दर से कितने वर्ष?", textEN:"1000 becomes 1331 at 10% CI. Years?", optionsHI:["2","3","4","5"], optionsEN:["2","3","4","5"], answer:1, explanationHI:"1.1³=1.331→3 वर्ष", explanationEN:"3 years", docId:"math-ssc-0060" },
    { subject:"Mathematics", chapter:"Compound Interest", textHI:"P=12000, R=5%, T=3. मिश्रधन?", textEN:"P=12000, R=5%, T=3. Amount?", optionsHI:["13800","13891.5","14000","13500"], optionsEN:["13800","13891.5","14000","13500"], answer:1, explanationHI:"12000×1.05³≈13891.5", explanationEN:"13891.5", docId:"math-ssc-0061" },
    { subject:"Mathematics", chapter:"Compound Interest", textHI:"CI=441, P=2000, T=2. Rate?", textEN:"CI=441, P=2000, T=2. Rate?", optionsHI:["10%","8%","5%","12%"], optionsEN:["10%","8%","5%","12%"], answer:0, explanationHI:"≈10%", explanationEN:"10%", docId:"math-ssc-0062" },

    // ─── RATIO AND PROPORTION ────────────────────────────────
    { subject:"Mathematics", chapter:"Ratio and Proportion", textHI:"Rs.600 को A:B=3:2 में बाँटें। A का हिस्सा?", textEN:"Rs.600 in 3:2. A's share?", optionsHI:["300","360","240","400"], optionsEN:["300","360","240","400"], answer:1, explanationHI:"3/5×600=360", explanationEN:"360", docId:"math-ssc-0063" },
    { subject:"Mathematics", chapter:"Ratio and Proportion", textHI:"A:B=2:3, B:C=4:5. A:B:C?", textEN:"A:B=2:3, B:C=4:5. A:B:C?", optionsHI:["8:12:15","6:9:12","4:6:10","2:3:5"], optionsEN:["8:12:15","6:9:12","4:6:10","2:3:5"], answer:0, explanationHI:"A:B:C=8:12:15", explanationEN:"8:12:15", docId:"math-ssc-0064" },
    { subject:"Mathematics", chapter:"Ratio and Proportion", textHI:"6:x = 18:27. x?", textEN:"6:x = 18:27. x?", optionsHI:["7","8","9","10"], optionsEN:["7","8","9","10"], answer:2, explanationHI:"x=6×27/18=9", explanationEN:"9", docId:"math-ssc-0065" },
    { subject:"Mathematics", chapter:"Ratio and Proportion", textHI:"A:B:C=2:3:4, कुल Rs.1800. C का हिस्सा?", textEN:"A:B:C=2:3:4, total Rs.1800. C?", optionsHI:["600","800","400","900"], optionsEN:["600","800","400","900"], answer:1, explanationHI:"4/9×1800=800", explanationEN:"800", docId:"math-ssc-0066" },
    { subject:"Mathematics", chapter:"Ratio and Proportion", textHI:"Boys:Girls=3:2, कुल 50. Girls?", textEN:"Boys:Girls=3:2, total 50. Girls?", optionsHI:["20","25","30","15"], optionsEN:["20","25","30","15"], answer:0, explanationHI:"2/5×50=20", explanationEN:"20", docId:"math-ssc-0067" },
    { subject:"Mathematics", chapter:"Ratio and Proportion", textHI:"3 संख्याएँ 1:2:3, योग 120. सबसे बड़ी?", textEN:"3 numbers 1:2:3, sum 120. Largest?", optionsHI:["20","40","60","30"], optionsEN:["20","40","60","30"], answer:2, explanationHI:"3/6×120=60", explanationEN:"60", docId:"math-ssc-0068" },
    { subject:"Mathematics", chapter:"Ratio and Proportion", textHI:"2 संख्याएँ 3:5, अंतर 16. योग?", textEN:"Ratio 3:5, difference 16. Sum?", optionsHI:["56","64","48","80"], optionsEN:["56","64","48","80"], answer:1, explanationHI:"x=8; योग=64", explanationEN:"64", docId:"math-ssc-0069" },

    // ─── TIME AND WORK ───────────────────────────────────────
    { subject:"Mathematics", chapter:"Time and Work", textHI:"A 10 दिन, B 15 दिन। साथ में?", textEN:"A: 10 days, B: 15 days. Together?", optionsHI:["5","6","7","8"], optionsEN:["5 days","6 days","7 days","8 days"], answer:1, explanationHI:"10×15/25=6", explanationEN:"6 days", docId:"math-ssc-0070" },
    { subject:"Mathematics", chapter:"Time and Work", textHI:"A+B साथ 12 दिन, A अकेले 20 दिन। B अकेले?", textEN:"A+B=12d, A=20d. B alone?", optionsHI:["25","30","28","24"], optionsEN:["25 d","30 d","28 d","24 d"], answer:1, explanationHI:"1/12-1/20=1/30→B=30", explanationEN:"30 days", docId:"math-ssc-0071" },
    { subject:"Mathematics", chapter:"Time and Work", textHI:"15 आदमी 20 दिन। 20 आदमी?", textEN:"15 men, 20 days. 20 men?", optionsHI:["10","12","15","14"], optionsEN:["10 d","12 d","15 d","14 d"], answer:2, explanationHI:"15×20/20=15", explanationEN:"15 days", docId:"math-ssc-0072" },
    { subject:"Mathematics", chapter:"Time and Work", textHI:"A+B+C=4d, A+B=6d. C अकेले?", textEN:"A+B+C=4d, A+B=6d. C alone?", optionsHI:["10","12","14","8"], optionsEN:["10 d","12 d","14 d","8 d"], answer:1, explanationHI:"1/4-1/6=1/12→C=12", explanationEN:"12 days", docId:"math-ssc-0073" },
    { subject:"Mathematics", chapter:"Time and Work", textHI:"5 आदमी 8 दिन। 4 दिन में खत्म करने को?", textEN:"5 men, 8 days. Finish in 4 days: men needed?", optionsHI:["8","10","12","6"], optionsEN:["8","10","12","6"], answer:1, explanationHI:"5×8/4=10", explanationEN:"10", docId:"math-ssc-0074" },
    { subject:"Mathematics", chapter:"Time and Work", textHI:"A की दक्षता B से 2 गुना। साथ में 18 दिन। A अकेले?", textEN:"A twice efficient as B. Together 18d. A alone?", optionsHI:["24","27","30","36"], optionsEN:["24 d","27 d","30 d","36 d"], answer:1, explanationHI:"B=2A; 3/2A=1/18→A=27", explanationEN:"27 days", docId:"math-ssc-0075" },

    // ─── SPEED TIME DISTANCE ─────────────────────────────────
    { subject:"Mathematics", chapter:"Speed, Time and Distance", textHI:"72 km/h = ? m/s", textEN:"72 km/h = ? m/s", optionsHI:["15","20","25","30"], optionsEN:["15","20","25","30"], answer:1, explanationHI:"72×5/18=20", explanationEN:"20", docId:"math-ssc-0076" },
    { subject:"Mathematics", chapter:"Speed, Time and Distance", textHI:"240 km, 4 घंटे। औसत गति?", textEN:"240 km in 4 hours. Speed?", optionsHI:["50","60","70","80"], optionsEN:["50 km/h","60 km/h","70 km/h","80 km/h"], answer:1, explanationHI:"240/4=60", explanationEN:"60 km/h", docId:"math-ssc-0077" },
    { subject:"Mathematics", chapter:"Speed, Time and Distance", textHI:"जाना 40 km/h, आना 60 km/h. औसत गति?", textEN:"Go 40, return 60 km/h. Average?", optionsHI:["48","50","52","45"], optionsEN:["48","50","52","45"], answer:0, explanationHI:"2×40×60/100=48", explanationEN:"48 km/h", docId:"math-ssc-0078" },
    { subject:"Mathematics", chapter:"Speed, Time and Distance", textHI:"18 km/h = ? m/s", textEN:"18 km/h = ? m/s", optionsHI:["3","5","6","4"], optionsEN:["3","5","6","4"], answer:1, explanationHI:"18×5/18=5", explanationEN:"5", docId:"math-ssc-0079" },
    { subject:"Mathematics", chapter:"Speed, Time and Distance", textHI:"D/2-D/3=1 → D?", textEN:"At 2 km/h: 1h late vs 3 km/h. Distance?", optionsHI:["4","6","8","10"], optionsEN:["4","6","8","10"], answer:1, explanationHI:"D/6=1→D=6", explanationEN:"6 km", docId:"math-ssc-0080" },
    { subject:"Mathematics", chapter:"Speed, Time and Distance", textHI:"60+40 km/h, विपरीत दिशा, 300km। मिलने में?", textEN:"60+40 km/h opposite, 300km apart. Meet in?", optionsHI:["2h","3h","4h","5h"], optionsEN:["2h","3h","4h","5h"], answer:1, explanationHI:"300/100=3h", explanationEN:"3 hours", docId:"math-ssc-0081" },

    // ─── PROBLEMS ON TRAINS ──────────────────────────────────
    { subject:"Mathematics", chapter:"Problems Related to Train", textHI:"200m ट्रेन, 72 km/h, खंभे को पार करने में?", textEN:"200m train, 72km/h, cross a pole in?", optionsHI:["8s","10s","12s","15s"], optionsEN:["8s","10s","12s","15s"], answer:1, explanationHI:"200/20=10s", explanationEN:"10 seconds", docId:"math-ssc-0082" },
    { subject:"Mathematics", chapter:"Problems Related to Train", textHI:"300m ट्रेन, 60 km/h, 200m पुल पार करने में?", textEN:"300m train, 60km/h, cross 200m bridge?", optionsHI:["25s","30s","35s","20s"], optionsEN:["25s","30s","35s","20s"], answer:1, explanationHI:"500/(50/3)=30s", explanationEN:"30 seconds", docId:"math-ssc-0083" },
    { subject:"Mathematics", chapter:"Problems Related to Train", textHI:"150m ट्रेन खड़े आदमी को 15s में पार करे। गति?", textEN:"150m train crosses standing man in 15s. Speed?", optionsHI:["8","10","12","15"], optionsEN:["8 m/s","10 m/s","12 m/s","15 m/s"], answer:1, explanationHI:"150/15=10 m/s", explanationEN:"10 m/s", docId:"math-ssc-0084" },
    { subject:"Mathematics", chapter:"Problems Related to Train", textHI:"90 km/h ट्रेन 600m पुल 40s में। ट्रेन की लंबाई?", textEN:"90km/h train crosses 600m bridge in 40s. Length?", optionsHI:["350m","400m","300m","450m"], optionsEN:["350m","400m","300m","450m"], answer:1, explanationHI:"25×40-600=400m", explanationEN:"400m", docId:"math-ssc-0085" },

    // ─── BOAT AND STREAM ─────────────────────────────────────
    { subject:"Mathematics", chapter:"Boat and Stream", textHI:"नाव=10 km/h, धारा=2 km/h। अनुप्रवाह गति?", textEN:"Boat=10, stream=2 km/h. Downstream?", optionsHI:["8","10","12","14"], optionsEN:["8","10","12","14"], answer:2, explanationHI:"10+2=12", explanationEN:"12 km/h", docId:"math-ssc-0086" },
    { subject:"Mathematics", chapter:"Boat and Stream", textHI:"अनु=14, प्रति=6 km/h। शांत जल में गति?", textEN:"Down=14, up=6 km/h. Still water speed?", optionsHI:["8","10","12","14"], optionsEN:["8","10","12","14"], answer:1, explanationHI:"(14+6)/2=10", explanationEN:"10 km/h", docId:"math-ssc-0087" },
    { subject:"Mathematics", chapter:"Boat and Stream", textHI:"नाव=8, धारा=4 km/h। 36km अनुप्रवाह में समय?", textEN:"Boat=8, stream=4. 36km downstream?", optionsHI:["2h","3h","4h","5h"], optionsEN:["2h","3h","4h","5h"], answer:1, explanationHI:"36/12=3h", explanationEN:"3 hours", docId:"math-ssc-0088" },
    { subject:"Mathematics", chapter:"Boat and Stream", textHI:"नाव=15, धारा=3 km/h। 54km प्रतिप्रवाह में?", textEN:"Boat=15, stream=3. 54km upstream?", optionsHI:["3h","4h","4.5h","5h"], optionsEN:["3h","4h","4.5h","5h"], answer:2, explanationHI:"54/12=4.5h", explanationEN:"4.5 hours", docId:"math-ssc-0089" },

    // ─── AGE PROBLEMS ────────────────────────────────────────
    { subject:"Mathematics", chapter:"Age Problems", textHI:"A+B की औसत आयु 25, C जोड़ने पर 26। C की आयु?", textEN:"Avg A+B=25, adding C=26. C's age?", optionsHI:["26","28","30","27"], optionsEN:["26","28","30","27"], answer:1, explanationHI:"3×26-2×25=28", explanationEN:"28", docId:"math-ssc-0090" },
    { subject:"Mathematics", chapter:"Age Problems", textHI:"पिता=4×पुत्र। 20 वर्ष बाद पिता=2×पुत्र। पिता की आयु?", textEN:"Father=4× son. After 20y, 2× son. Father's age?", optionsHI:["36","40","44","48"], optionsEN:["36","40","44","48"], answer:1, explanationHI:"S=10, F=40", explanationEN:"40", docId:"math-ssc-0091" },
    { subject:"Mathematics", chapter:"Age Problems", textHI:"5 वर्ष बाद पिता+पुत्र=60। वर्तमान योग?", textEN:"After 5y, F+S=60. Present sum?", optionsHI:["40","50","60","70"], optionsEN:["40","50","60","70"], answer:1, explanationHI:"60-10=50", explanationEN:"50", docId:"math-ssc-0092" },
    { subject:"Mathematics", chapter:"Age Problems", textHI:"दो भाई 3:4, 4 वर्ष बाद 4:5। उनकी आयु?", textEN:"Brothers 3:4, after 4y 4:5. Ages?", optionsHI:["9,12","12,16","15,20","6,8"], optionsEN:["9,12","12,16","15,20","6,8"], answer:1, explanationHI:"x=4→12,16", explanationEN:"12 and 16", docId:"math-ssc-0093" },

    // ─── ALGEBRA ─────────────────────────────────────────────
    { subject:"Mathematics", chapter:"Algebra", textHI:"x+1/x=5. x²+1/x²=?", textEN:"x+1/x=5. x²+1/x²=?", optionsHI:["23","25","27","21"], optionsEN:["23","25","27","21"], answer:0, explanationHI:"25-2=23", explanationEN:"23", docId:"math-ssc-0094" },
    { subject:"Mathematics", chapter:"Algebra", textHI:"2x-y=6, x+y=9. x=?", textEN:"2x-y=6, x+y=9. x=?", optionsHI:["4","5","6","7"], optionsEN:["4","5","6","7"], answer:1, explanationHI:"3x=15→x=5", explanationEN:"5", docId:"math-ssc-0095" },
    { subject:"Mathematics", chapter:"Algebra", textHI:"a=3,b=4. (a+b)²=?", textEN:"a=3,b=4. (a+b)²=?", optionsHI:["49","25","36","16"], optionsEN:["49","25","36","16"], answer:0, explanationHI:"7²=49", explanationEN:"49", docId:"math-ssc-0096" },
    { subject:"Mathematics", chapter:"Algebra", textHI:"x²-5x+6=0 के मूल?", textEN:"Roots of x²-5x+6=0?", optionsHI:["2,3","1,6","2,4","3,4"], optionsEN:["2,3","1,6","2,4","3,4"], answer:0, explanationHI:"(x-2)(x-3)=0", explanationEN:"2 and 3", docId:"math-ssc-0097" },
    { subject:"Mathematics", chapter:"Algebra", textHI:"a-b=3, a²-b²=21. a+b=?", textEN:"a-b=3, a²-b²=21. a+b=?", optionsHI:["5","7","9","6"], optionsEN:["5","7","9","6"], answer:1, explanationHI:"21/3=7", explanationEN:"7", docId:"math-ssc-0098" },
    { subject:"Mathematics", chapter:"Algebra", textHI:"3x+7=22. x=?", textEN:"3x+7=22. x=?", optionsHI:["3","4","5","6"], optionsEN:["3","4","5","6"], answer:2, explanationHI:"3x=15→x=5", explanationEN:"5", docId:"math-ssc-0099" },

    // ─── GEOMETRY ────────────────────────────────────────────
    { subject:"Mathematics", chapter:"Geometry", textHI:"त्रिभुज के कोण 2:3:4 अनुपात में। सबसे बड़ा?", textEN:"Triangle angles 2:3:4. Largest?", optionsHI:["60°","80°","90°","100°"], optionsEN:["60°","80°","90°","100°"], answer:1, explanationHI:"4×20=80°", explanationEN:"80°", docId:"math-ssc-0100" },
    { subject:"Mathematics", chapter:"Geometry", textHI:"समकोण त्रिभुज की भुजाएँ 3,4. कर्ण?", textEN:"Right triangle sides 3,4. Hypotenuse?", optionsHI:["4","5","6","7"], optionsEN:["4","5","6","7"], answer:1, explanationHI:"√(9+16)=5", explanationEN:"5", docId:"math-ssc-0101" },
    { subject:"Mathematics", chapter:"Geometry", textHI:"वृत्त परिधि=44cm. त्रिज्या? (π=22/7)", textEN:"Circle circumference=44cm. Radius?", optionsHI:["5","7","9","11"], optionsEN:["5 cm","7 cm","9 cm","11 cm"], answer:1, explanationHI:"2πr=44→r=7", explanationEN:"7 cm", docId:"math-ssc-0102" },
    { subject:"Mathematics", chapter:"Geometry", textHI:"चतुर्भुज के कोणों का योग?", textEN:"Sum of angles in a quadrilateral?", optionsHI:["180°","270°","360°","720°"], optionsEN:["180°","270°","360°","720°"], answer:2, explanationHI:"360°", explanationEN:"360°", docId:"math-ssc-0103" },
    { subject:"Mathematics", chapter:"Geometry", textHI:"षट्भुज के अंतः कोणों का योग?", textEN:"Sum of interior angles of hexagon?", optionsHI:["360°","540°","720°","900°"], optionsEN:["360°","540°","720°","900°"], answer:2, explanationHI:"(6-2)×180=720°", explanationEN:"720°", docId:"math-ssc-0104" },

    // ─── MENSURATION 2D ──────────────────────────────────────
    { subject:"Mathematics", chapter:"Mensuration 2D", textHI:"r=7cm का वृत्त क्षेत्रफल? (π=22/7)", textEN:"Circle r=7cm. Area?", optionsHI:["44","154","176","132"], optionsEN:["44 cm²","154 cm²","176 cm²","132 cm²"], answer:1, explanationHI:"πr²=154", explanationEN:"154 cm²", docId:"math-ssc-0105" },
    { subject:"Mathematics", chapter:"Mensuration 2D", textHI:"10×8 आयत का क्षेत्रफल?", textEN:"Rectangle 10×8. Area?", optionsHI:["36","80","160","18"], optionsEN:["36 cm²","80 cm²","160 cm²","18 cm²"], answer:1, explanationHI:"10×8=80", explanationEN:"80 cm²", docId:"math-ssc-0106" },
    { subject:"Mathematics", chapter:"Mensuration 2D", textHI:"भुजा=6cm वर्ग की परिमाप?", textEN:"Square side=6cm. Perimeter?", optionsHI:["12","18","24","36"], optionsEN:["12 cm","18 cm","24 cm","36 cm"], answer:2, explanationHI:"4×6=24", explanationEN:"24 cm", docId:"math-ssc-0107" },
    { subject:"Mathematics", chapter:"Mensuration 2D", textHI:"त्रिभुज आधार=12, ऊँचाई=8. क्षेत्रफल?", textEN:"Triangle base=12, height=8. Area?", optionsHI:["48","96","72","24"], optionsEN:["48 cm²","96 cm²","72 cm²","24 cm²"], answer:0, explanationHI:"½×12×8=48", explanationEN:"48 cm²", docId:"math-ssc-0108" },
    { subject:"Mathematics", chapter:"Mensuration 2D", textHI:"समांतर चतुर्भुज आधार=8, ऊँचाई=5. क्षेत्रफल?", textEN:"Parallelogram base=8, height=5. Area?", optionsHI:["20","40","60","80"], optionsEN:["20 cm²","40 cm²","60 cm²","80 cm²"], answer:1, explanationHI:"8×5=40", explanationEN:"40 cm²", docId:"math-ssc-0109" },

    // ─── MENSURATION 3D ──────────────────────────────────────
    { subject:"Mathematics", chapter:"Mensuration 3D", textHI:"घन भुजा=5cm. आयतन?", textEN:"Cube side=5cm. Volume?", optionsHI:["25","75","100","125"], optionsEN:["25 cm³","75 cm³","100 cm³","125 cm³"], answer:3, explanationHI:"5³=125", explanationEN:"125 cm³", docId:"math-ssc-0110" },
    { subject:"Mathematics", chapter:"Mensuration 3D", textHI:"बेलन r=7, h=10cm. आयतन? (π=22/7)", textEN:"Cylinder r=7, h=10. Volume?", optionsHI:["1540","2200","1080","770"], optionsEN:["1540 cm³","2200 cm³","1080 cm³","770 cm³"], answer:0, explanationHI:"πr²h=1540", explanationEN:"1540 cm³", docId:"math-ssc-0111" },
    { subject:"Mathematics", chapter:"Mensuration 3D", textHI:"घनाभ 10×8×6. आयतन?", textEN:"Cuboid 10×8×6. Volume?", optionsHI:["240","360","480","420"], optionsEN:["240 cm³","360 cm³","480 cm³","420 cm³"], answer:2, explanationHI:"480", explanationEN:"480 cm³", docId:"math-ssc-0112" },
    { subject:"Mathematics", chapter:"Mensuration 3D", textHI:"घन s=6cm. पृष्ठ क्षेत्रफल?", textEN:"Cube s=6cm. Total surface area?", optionsHI:["216","144","180","108"], optionsEN:["216 cm²","144 cm²","180 cm²","108 cm²"], answer:0, explanationHI:"6×36=216", explanationEN:"216 cm²", docId:"math-ssc-0113" },

    // ─── TRIGONOMETRY ────────────────────────────────────────
    { subject:"Mathematics", chapter:"Trigonometry", textHI:"sin 30° = ?", textEN:"sin 30° = ?", optionsHI:["1/2","√3/2","1","0"], optionsEN:["1/2","√3/2","1","0"], answer:0, explanationHI:"sin30°=1/2", explanationEN:"1/2", docId:"math-ssc-0114" },
    { subject:"Mathematics", chapter:"Trigonometry", textHI:"cos 60° = ?", textEN:"cos 60° = ?", optionsHI:["√3/2","1/2","0","1"], optionsEN:["√3/2","1/2","0","1"], answer:1, explanationHI:"cos60°=1/2", explanationEN:"1/2", docId:"math-ssc-0115" },
    { subject:"Mathematics", chapter:"Trigonometry", textHI:"tan 45° = ?", textEN:"tan 45° = ?", optionsHI:["0","1","√3","1/√3"], optionsEN:["0","1","√3","1/√3"], answer:1, explanationHI:"tan45°=1", explanationEN:"1", docId:"math-ssc-0116" },
    { subject:"Mathematics", chapter:"Trigonometry", textHI:"sin²θ + cos²θ = ?", textEN:"sin²θ + cos²θ = ?", optionsHI:["0","2","1","–1"], optionsEN:["0","2","1","–1"], answer:2, explanationHI:"=1 (identity)", explanationEN:"1", docId:"math-ssc-0117" },
    { subject:"Mathematics", chapter:"Trigonometry", textHI:"sinθ=3/5. cosθ=?", textEN:"sinθ=3/5. cosθ=?", optionsHI:["4/5","5/3","3/4","5/4"], optionsEN:["4/5","5/3","3/4","5/4"], answer:0, explanationHI:"√(1-9/25)=4/5", explanationEN:"4/5", docId:"math-ssc-0118" },
    { subject:"Mathematics", chapter:"Trigonometry", textHI:"tan 60° = ?", textEN:"tan 60° = ?", optionsHI:["1","1/√3","√3","2"], optionsEN:["1","1/√3","√3","2"], answer:2, explanationHI:"tan60°=√3", explanationEN:"√3", docId:"math-ssc-0119" },
    { subject:"Mathematics", chapter:"Trigonometry", textHI:"sin 90° = ?", textEN:"sin 90° = ?", optionsHI:["0","1","√3/2","1/2"], optionsEN:["0","1","√3/2","1/2"], answer:1, explanationHI:"sin90°=1", explanationEN:"1", docId:"math-ssc-0120" },

    // ─── HEIGHT AND DISTANCE ─────────────────────────────────
    { subject:"Mathematics", chapter:"Height and Distance", textHI:"छाया = ऊँचाई। सूर्य का कोण?", textEN:"Shadow = height. Sun angle?", optionsHI:["30°","45°","60°","90°"], optionsEN:["30°","45°","60°","90°"], answer:1, explanationHI:"tanθ=1→45°", explanationEN:"45°", docId:"math-ssc-0121" },
    { subject:"Mathematics", chapter:"Height and Distance", textHI:"45° पर 50m दूर से देखी मीनार। ऊँचाई?", textEN:"Tower at 45°, 50m away. Height?", optionsHI:["25m","50m","100m","75m"], optionsEN:["25m","50m","100m","75m"], answer:1, explanationHI:"tan45°=1=H/50→H=50", explanationEN:"50m", docId:"math-ssc-0122" },
    { subject:"Mathematics", chapter:"Height and Distance", textHI:"10m खंभा, छाया=10√3. सूर्य का कोण?", textEN:"Pole=10m, shadow=10√3. Angle?", optionsHI:["30°","45°","60°","90°"], optionsEN:["30°","45°","60°","90°"], answer:0, explanationHI:"tanθ=1/√3→30°", explanationEN:"30°", docId:"math-ssc-0123" },

    // ─── STATISTICS ──────────────────────────────────────────
    { subject:"Mathematics", chapter:"Statistics", textHI:"3,5,7,9,11 का माध्य?", textEN:"Mean of 3,5,7,9,11?", optionsHI:["6","7","8","9"], optionsEN:["6","7","8","9"], answer:1, explanationHI:"35/5=7", explanationEN:"7", docId:"math-ssc-0124" },
    { subject:"Mathematics", chapter:"Statistics", textHI:"2,4,4,4,5,5,7,9 का बहुलक?", textEN:"Mode of 2,4,4,4,5,5,7,9?", optionsHI:["5","4","7","2"], optionsEN:["5","4","7","2"], answer:1, explanationHI:"4 सबसे अधिक बार", explanationEN:"4", docId:"math-ssc-0125" },
    { subject:"Mathematics", chapter:"Statistics", textHI:"3,6,8,12,15 की माध्यिका?", textEN:"Median of 3,6,8,12,15?", optionsHI:["6","8","10","12"], optionsEN:["6","8","10","12"], answer:1, explanationHI:"मध्य=8", explanationEN:"8", docId:"math-ssc-0126" },
    { subject:"Mathematics", chapter:"Statistics", textHI:"Mean=10, Median=8. Mode?", textEN:"Mean=10, Median=8. Mode?", optionsHI:["4","6","8","12"], optionsEN:["4","6","8","12"], answer:0, explanationHI:"3M-2Mean=24-20=4", explanationEN:"4", docId:"math-ssc-0127" },
    { subject:"Mathematics", chapter:"Statistics", textHI:"5,10,15,20,25 का Range?", textEN:"Range of 5,10,15,20,25?", optionsHI:["15","20","10","25"], optionsEN:["15","20","10","25"], answer:1, explanationHI:"25-5=20", explanationEN:"20", docId:"math-ssc-0128" },

    // ─── DISCOUNT ────────────────────────────────────────────
    { subject:"Mathematics", chapter:"Discount", textHI:"Rs.500 पर 20% छूट। SP?", textEN:"Rs.500, 20% discount. SP?", optionsHI:["350","400","380","420"], optionsEN:["350","400","380","420"], answer:1, explanationHI:"500×0.8=400", explanationEN:"400", docId:"math-ssc-0129" },
    { subject:"Mathematics", chapter:"Discount", textHI:"MP=1200, SP=900. छूट%?", textEN:"MP=1200, SP=900. Discount%?", optionsHI:["20%","25%","30%","15%"], optionsEN:["20%","25%","30%","15%"], answer:1, explanationHI:"300/1200×100=25%", explanationEN:"25%", docId:"math-ssc-0130" },
    { subject:"Mathematics", chapter:"Discount", textHI:"20% फिर 10% छूट। कुल छूट%?", textEN:"20% then 10% discount. Net?", optionsHI:["28%","30%","32%","25%"], optionsEN:["28%","30%","32%","25%"], answer:0, explanationHI:"20+10-2=28%", explanationEN:"28%", docId:"math-ssc-0131" },

    // ─── PARTNERSHIP ─────────────────────────────────────────
    { subject:"Mathematics", chapter:"Partnership", textHI:"A=20000, B=30000. लाभ 25000 में A का हिस्सा?", textEN:"A=20000, B=30000, profit=25000. A's share?", optionsHI:["8000","10000","12000","15000"], optionsEN:["8000","10000","12000","15000"], answer:1, explanationHI:"2/5×25000=10000", explanationEN:"10000", docId:"math-ssc-0132" },
    { subject:"Mathematics", chapter:"Partnership", textHI:"A=5000×6m, B=6000×4m. अनुपात?", textEN:"A invested 5000 for 6m, B 6000 for 4m. Ratio?", optionsHI:["4:5","5:4","3:4","2:3"], optionsEN:["4:5","5:4","3:4","2:3"], answer:1, explanationHI:"30000:24000=5:4", explanationEN:"5:4", docId:"math-ssc-0133" },
    { subject:"Mathematics", chapter:"Partnership", textHI:"A:B:C=2:3:4. लाभ 900 में C?", textEN:"A:B:C=2:3:4. Profit 900. C?", optionsHI:["300","350","400","450"], optionsEN:["300","350","400","450"], answer:2, explanationHI:"4/9×900=400", explanationEN:"400", docId:"math-ssc-0134" },

    // ─── ALLIGATION ──────────────────────────────────────────
    { subject:"Mathematics", chapter:"Alligation", textHI:"30% और 60% को मिलाकर 50% बनाना। अनुपात?", textEN:"Mix 30% and 60% to get 50%. Ratio?", optionsHI:["1:2","2:1","1:3","3:1"], optionsEN:["1:2","2:1","1:3","3:1"], answer:0, explanationHI:"10:20=1:2", explanationEN:"1:2", docId:"math-ssc-0135" },
    { subject:"Mathematics", chapter:"Alligation", textHI:"Rs.5 और Rs.8 के चावल से Rs.6/kg। अनुपात?", textEN:"Rs.5 and Rs.8 rice to get Rs.6/kg. Ratio?", optionsHI:["1:2","2:1","1:3","3:1"], optionsEN:["1:2","2:1","1:3","3:1"], answer:1, explanationHI:"8-6=2, 6-5=1; 2:1", explanationEN:"2:1", docId:"math-ssc-0136" },
    { subject:"Mathematics", chapter:"Alligation", textHI:"40% और 70% अल्कोहल बराबर मात्रा मिलाएँ। परिणाम?", textEN:"Equal parts 40% and 70% alcohol. Result?", optionsHI:["50%","55%","60%","45%"], optionsEN:["50%","55%","60%","45%"], answer:1, explanationHI:"(40+70)/2=55%", explanationEN:"55%", docId:"math-ssc-0137" },

    // ─── PIPES AND CISTERNS ──────────────────────────────────
    { subject:"Mathematics", chapter:"Pipes and Cisterns", textHI:"A 6h में भरता, B 12h में खाली। दोनों खुले → भरने में?", textEN:"A fills 6h, B empties 12h. Both open?", optionsHI:["8h","10h","12h","6h"], optionsEN:["8h","10h","12h","6h"], answer:2, explanationHI:"1/6-1/12=1/12→12h", explanationEN:"12 hours", docId:"math-ssc-0138" },
    { subject:"Mathematics", chapter:"Pipes and Cisterns", textHI:"A 4h, B 6h में भरता। साथ में?", textEN:"A fills 4h, B 6h. Together?", optionsHI:["2h","2.4h","3h","2.5h"], optionsEN:["2h","2.4h","3h","2.5h"], answer:1, explanationHI:"4×6/10=2.4h", explanationEN:"2.4 hours", docId:"math-ssc-0139" },
    { subject:"Mathematics", chapter:"Pipes and Cisterns", textHI:"Normal 8h भरती, Leak से 12h। Leak खाली करे?", textEN:"Fills 8h normally, with leak 12h. Leak alone empties?", optionsHI:["16h","24h","20h","36h"], optionsEN:["16h","24h","20h","36h"], answer:1, explanationHI:"1/8-1/12=1/24→24h", explanationEN:"24 hours", docId:"math-ssc-0140" },

    // ─── COORDINATE GEOMETRY ─────────────────────────────────
    { subject:"Mathematics", chapter:"Co-ordinate Geometry", textHI:"(3,4) की origin से दूरी?", textEN:"Distance of (3,4) from origin?", optionsHI:["3","4","5","7"], optionsEN:["3","4","5","7"], answer:2, explanationHI:"√(9+16)=5", explanationEN:"5", docId:"math-ssc-0141" },
    { subject:"Mathematics", chapter:"Co-ordinate Geometry", textHI:"A(1,2) B(5,6) का मध्यबिंदु?", textEN:"Midpoint of A(1,2) B(5,6)?", optionsHI:["(2,3)","(3,4)","(4,5)","(6,8)"], optionsEN:["(2,3)","(3,4)","(4,5)","(6,8)"], answer:1, explanationHI:"(3,4)", explanationEN:"(3,4)", docId:"math-ssc-0142" },
    { subject:"Mathematics", chapter:"Co-ordinate Geometry", textHI:"y=2x+3 का y-intercept?", textEN:"y-intercept of y=2x+3?", optionsHI:["2","3","–3","–2"], optionsEN:["2","3","–3","–2"], answer:1, explanationHI:"x=0→y=3", explanationEN:"3", docId:"math-ssc-0143" },

    // ─── DECIMAL AND FRACTION ────────────────────────────────
    { subject:"Mathematics", chapter:"Decimal and Fraction", textHI:"3/4 को दशमलव में?", textEN:"3/4 as decimal?", optionsHI:["0.5","0.75","0.25","0.3"], optionsEN:["0.5","0.75","0.25","0.3"], answer:1, explanationHI:"3/4=0.75", explanationEN:"0.75", docId:"math-ssc-0144" },
    { subject:"Mathematics", chapter:"Decimal and Fraction", textHI:"0.125 = ?", textEN:"0.125 as fraction?", optionsHI:["1/4","1/8","1/6","1/5"], optionsEN:["1/4","1/8","1/6","1/5"], answer:1, explanationHI:"1/8", explanationEN:"1/8", docId:"math-ssc-0145" },
    { subject:"Mathematics", chapter:"Decimal and Fraction", textHI:"2/5 + 3/10 = ?", textEN:"2/5 + 3/10 = ?", optionsHI:["5/15","7/10","1/2","4/5"], optionsEN:["5/15","7/10","1/2","4/5"], answer:1, explanationHI:"4/10+3/10=7/10", explanationEN:"7/10", docId:"math-ssc-0146" },
    { subject:"Mathematics", chapter:"Decimal and Fraction", textHI:"0.666... = ?", textEN:"0.666... as fraction?", optionsHI:["2/3","6/9","1/6","3/4"], optionsEN:["2/3","6/9","1/6","3/4"], answer:0, explanationHI:"2/3", explanationEN:"2/3", docId:"math-ssc-0147" },

    // ─── INDICES AND SURDS ───────────────────────────────────
    { subject:"Mathematics", chapter:"Indices & Surds", textHI:"(64)^(1/3) = ?", textEN:"(64)^(1/3) = ?", optionsHI:["2","4","8","16"], optionsEN:["2","4","8","16"], answer:1, explanationHI:"∛64=4", explanationEN:"4", docId:"math-ssc-0148" },
    { subject:"Mathematics", chapter:"Indices & Surds", textHI:"2⁵ × 2³ = ?", textEN:"2⁵ × 2³ = ?", optionsHI:["256","512","128","1024"], optionsEN:["256","512","128","1024"], answer:0, explanationHI:"2^8=256", explanationEN:"256", docId:"math-ssc-0149" },
    { subject:"Mathematics", chapter:"Indices & Surds", textHI:"√2 × √8 = ?", textEN:"√2 × √8 = ?", optionsHI:["2","4","8","16"], optionsEN:["2","4","8","16"], answer:1, explanationHI:"√16=4", explanationEN:"4", docId:"math-ssc-0150" },
    { subject:"Mathematics", chapter:"Indices & Surds", textHI:"5⁰ = ?", textEN:"5⁰ = ?", optionsHI:["0","5","1","25"], optionsEN:["0","5","1","25"], answer:2, explanationHI:"Any^0=1", explanationEN:"1", docId:"math-ssc-0151" },
    { subject:"Mathematics", chapter:"Indices & Surds", textHI:"5^x = 125. x=?", textEN:"5^x = 125. x=?", optionsHI:["2","3","4","5"], optionsEN:["2","3","4","5"], answer:1, explanationHI:"5³=125", explanationEN:"3", docId:"math-ssc-0152" },

    // ─── DATA INTERPRETATION ─────────────────────────────────
    { subject:"Mathematics", chapter:"Data Interpretation", textHI:"A=30,B=50,C=20. B का %?", textEN:"A=30,B=50,C=20. B's %?", optionsHI:["40%","50%","60%","45%"], optionsEN:["40%","50%","60%","45%"], answer:1, explanationHI:"50/100×100=50%", explanationEN:"50%", docId:"math-ssc-0153" },
    { subject:"Mathematics", chapter:"Data Interpretation", textHI:"72° का पाई खंड = कुल का कितना%?", textEN:"72° pie section = what % of total?", optionsHI:["15%","20%","25%","30%"], optionsEN:["15%","20%","25%","30%"], answer:1, explanationHI:"72/360×100=20%", explanationEN:"20%", docId:"math-ssc-0154" },
    { subject:"Mathematics", chapter:"Data Interpretation", textHI:"D=10%. पाई चार्ट में कोण?", textEN:"D=10%. Angle in pie chart?", optionsHI:["18°","36°","54°","72°"], optionsEN:["18°","36°","54°","72°"], answer:1, explanationHI:"10/100×360=36°", explanationEN:"36°", docId:"math-ssc-0155" },
    { subject:"Mathematics", chapter:"Data Interpretation", textHI:"2021=200, 2022=250, 2023=300. औसत?", textEN:"2021=200, 2022=250, 2023=300. Average?", optionsHI:["200","250","280","300"], optionsEN:["200","250","280","300"], answer:1, explanationHI:"750/3=250", explanationEN:"250", docId:"math-ssc-0156" },
  ];
}

// ══════════════════════════════════════════════════════════════
//  SUBJECT 2: HISTORY – यूरोप में राष्ट्रवाद (54 questions)
// ══════════════════════════════════════════════════════════════
function getHistoryEuropeQuestions() {
  const ch = "यूरोप में राष्ट्रवाद";
  const sub = "History";
  const raw = [
    ["इटली तथा जर्मनी वर्तमान में किस महादेश के अंतर्गत आते हैं?", ["उत्तरी अमेरिका","दक्षिणी अमेरिका","यूरोप","पश्चिमी एशिया"], 2],
    ["फ्रांस में किस शासन वंश की पुनः स्थापना वियना कांग्रेस द्वारा की गई थी?", ["हैप्सबर्ग","आर्लिया वंश","बुर्बों वंश","जारशाही"], 2],
    ["मेजिनी का संबंध किस संगठन से था?", ["लाल सेना","कार्बोनरी","फिलिक हेटारिया","डायट"], 1],
    ["इटली एवं जर्मनी के एकीकरण के विरुद्ध कौन था?", ["इंग्लैंड","रूस","ऑस्ट्रिया","प्रशा"], 2],
    ["काउंट काबूर को विक्टर इमैनुएल ने किस पद पर नियुक्त किया?", ["सेनापति","फ्रांस में राजदूत","प्रधानमंत्री","गृह मंत्री"], 2],
    ["गैरीबाल्डी पेशे से क्या था?", ["सिपाही","किसान","जमींदार","नाविक"], 3],
    ["जर्मन राइन राज्य का निर्माण किसने किया था?", ["लुई 18वाँ","नेपोलियन बोनापार्ट","नेपोलियन-II","बिस्मार्क"], 1],
    ["जालवेरीन कैसी संस्था थी?", ["क्रांतिकारियों की","व्यापारियों की","विद्वानों की","पादरी एवं सामंतों की"], 1],
    ["रक्त एवं लौह की नीति का अवलंबन किसने किया?", ["मेजिनी","हिटलर","बिस्मार्क","विलियम-I"], 2],
    ["फ्रैंकफर्ट की संधि कब हुई?", ["1864","1866","1870","1871"], 3],
    ["नेपल्स की क्रांति कब हुई थी?", ["1820","1821","1822","1823"], 1],
    ["चार्टिस्ट आंदोलन कहाँ हुआ?", ["फ्रांस","ऑस्ट्रिया","हंगरी","इंग्लैंड"], 3],
    ["यूनान को एक स्वतंत्र राष्ट्र घोषित कब किया गया था?", ["1835","1832","1842","1830"], 1],
    ["कार्बोनरी संगठन किस वर्ष हुआ?", ["1832","1815","1810","1831"], 2],
    ["एड्रियानोपुल की संधि कब हुई?", ["1828","1829","1830","1931"], 1],
    ["एड्रियानोपुल की संधि किन दो देशों के बीच हुई?", ["तुर्की-रूस","यूनान-पोलैंड","तुर्की-हंगरी","हंगरी-पोलैंड"], 0],
    ["सेडॉन का युद्ध किनके बीच हुआ?", ["प्रशा और ब्रिटेन","ब्रिटेन और फ्रांस","फ्रांस और प्रशा","प्रशा और रूस"], 2],
    ["किस country का हंगरी पर पूर्ण आधिपत्य था?", ["फ्रांस","ऑस्ट्रिया","ब्रिटेन","तुर्की"], 1],
    ["पोलैंड के विद्रोह को किसने कुचल दिया?", ["रूस","ब्रिटेन","ऑस्ट्रिया","फ्रांस"], 0],
    ["सन 1870 में फ्रांस और प्रशा के बीच युद्ध कहाँ हुआ था?", ["सेडॉन","सडेवा","साइडान","फ्रैंकफर्ट"], 0],
    ["यूरोपवासियों के लिए किस देश का साहित्य एवं विज्ञान प्रेरणास्रोत रहा?", ["जर्मनी","यूनान","तुर्की","इंग्लैंड"], 1],
    ["युवा इटली संस्था का विकास किसने किया?", ["मेजिनी","काउंट काबूर","गैरीबाल्डी","बिस्मार्क"], 0],
    ["बिस्मार्क निम्न में से क्या था?", ["कवि","नाटककार","संगीतज्ञ","कूटनीतिज्ञ"], 3],
    ["सार्डिनिया-पीडमाउंट का शासक कौन था?", ["नेपोलियन-III","काउंट काबूर","विक्टर इमैनुएल","विलियम प्रथम"], 2],
    ["यूनानी स्वतंत्रता आंदोलन के दौरान कौन ब्रिटिश कवि शहीद हुए?", ["लॉर्ड बायरन","कासथू","फ्रांसीस डिक","विलियम प्रथम"], 0],
    ["जालवेराइन की स्थापना किस राज्य ने की?", ["प्रशा","ऑस्ट्रिया","सार्डिनिया","फ्रांस"], 0],
    ["हंगरी की भाषा क्या थी?", ["इतालवी","मैग्यार","पोलिश","फ्रेंच"], 1],
    ["यूनान के स्वतंत्रता संग्राम में किसकी पराजय हुई?", ["रूस","तुर्की","यूनान","फ्रांस"], 1],
    ["मारीआन किस देश के राष्ट्रवाद की प्रतीक थी?", ["फ्रांस","रूस","इटली","जर्मनी"], 0],
    ["यूरोपीय सभ्यता का पालना किसे कहा जाता था?", ["इटली","फ्रांस","हंगरी","यूनान"], 3],
    ["ऐक्ट ऑफ यूनियन किस वर्ष पारित हुआ?", ["1688","1707","1788","1807"], 0],
    ["1789 की फ्रांसीसी क्रांति के समय वहाँ किस राजवंश का शासन था?", ["ट्यूडर","स्टुअर्ट","बुर्बों","रोमोनोव"], 2],
    ["नेपोलियन संहिता किस वर्ष लागू की गई?", ["1789","1791","1801","1804"], 3],
    ["जर्मनी के एकीकरण के लिए बिस्मार्क ने कितने युद्ध किए?", ["एक","दो","तीन","चार"], 2],
    ["वियना कांग्रेस में कौन राष्ट्र सम्मिलित नहीं था?", ["ब्रिटेन","रूस","फ्रांस","जर्मनी"], 3],
    ["वियना कांग्रेस में पवित्र संघ की योजना किसने प्रस्तुत की?", ["रूस","ब्रिटेन","फ्रांस","ऑस्ट्रिया"], 0],
    ["यंग इटली के संस्थापक कौन था?", ["जियोबर्टी","काबूर","मेजिनी","गैरीबाल्डी"], 2],
    ["फ्रांस के किस राजा ने कहा 'लकड़ी काटना पसंद करूँगा'?", ["लुई सोलहवाँ","नेपोलियन पापा","लुई नेपोलियन","चार्ल्स दशम"], 3],
    ["प्रशा का शासक कौन था?", ["नेपोलियन बोनापार्ट","नेपोलियन-III","विक्टर इमैनुएल","विलियम प्रथम"], 3],
    ["यूरोप का मरीज किसे कहा जाता था?", ["रूस","जर्मनी","तुर्की","यूनान"], 2],
    ["नेपोलियन ने जर्मनी में किस संघ की स्थापना की?", ["ट्रांसपेडेन संघ","सिसेलपाइन संघ","राइन संघ","इनमें से कोई नहीं"], 2],
    ["किस संधि द्वारा स्वतंत्र यूनान राष्ट्र की स्थापना हुई?", ["वियना की संधि","कुस्तुनतुनिया की संधि","प्राग की संधि","एंड्रियानोपुल की संधि"], 3],
    ["यंग यूरोप की स्थापना किसने की थी?", ["काबूर","मेजिनी","बिस्मार्क","गैरीबाल्डी"], 1],
    ["नव गुएल्फ आंदोलन कहाँ हुआ था?", ["इटली","जर्मनी","फ्रांस","ब्रिटेन"], 0],
    ["मेटरनिख कौन था?", ["ऑस्ट्रिया का चांसलर","प्रशा का चांसलर","फ्रांस का सम्राट","रूस का जार"], 0],
    ["कार्बोनारी की स्थापना किस वर्ष हुई थी?", ["1810","1815","1830","1848"], 0],
    ["1830 की क्रांति के बाद फ्रांस में किस प्रकार का शासन स्थापित हुआ?", ["निरंकुश राजतंत्र","संघीय शासन व्यवस्था","गणराज्य","संवैधानिक राजतंत्र"], 0],
    ["लाल कुर्ती नामक संस्था का गठन किसने किया था?", ["बिस्मार्क","काबूर","मेजिनी","गैरीबाल्डी"], 3],
    ["राष्ट्रवाद की अवधारणा का जन्म किस घटना से माना जाता है?", ["पुनर्जागरण","धर्म सुधार आंदोलन","गौरवपूर्ण क्रांति","फ्रांस की क्रांति"], 0],
    ["रक्त और लौह की नीति किसने अपनाई?", ["बिस्मार्क","फ्रेडरिक विलियम चतुर्थ","विलियम प्रथम","गैरीबाल्डी"], 0],
    ["किस युद्ध के बाद जर्मनी का एकीकरण पूरा हुआ?", ["क्रीमिया का युद्ध","सडेओ का युद्ध","प्रशा-डेनमार्क युद्ध","सेडान का युद्ध"], 3],
    ["किस संधि द्वारा जर्मनी का एकीकरण पूरा हुआ?", ["डेनमार्क की संधि","गैस्टीन की संधि","प्राग की संधि","फ्रैंकफर्ट की संधि"], 3],
    ["जर्मनी एवं इटली के एकीकरण के समय फ्रांस का शासक कौन था?", ["नेपोलियन बोनापार्ट","नेपोलियन-III","विक्टर इमैनुएल","विलियम प्रथम"], 1],
  ];
  return raw.map(([text, opts, ans], i) => ({
    subject: sub, chapter: ch,
    textHI: text, textEN: "", text: text,
    optionsHI: opts, optionsEN: opts,
    answer: ans, explanationHI: "", explanationEN: "",
    docId: `history-nationalism-europe-${String(i+1).padStart(3,"0")}`
  }));
}

// ══════════════════════════════════════════════════════════════
//  SUBJECT 3: HISTORY – भारत में राष्ट्रवाद (45 questions)
// ══════════════════════════════════════════════════════════════
function getHistoryIndiaQuestions() {
  const ch = "भारत में राष्ट्रवाद";
  const sub = "History";
  const raw = [
    ["गाँधीजी ने दांडी यात्रा किस तिथि को आरंभ की?", ["12 जनवरी 1930","12 फरवरी 1930","12 मार्च 1930","12 अप्रैल 1930"], 2],
    ["गाँधीजी ने असहयोग आंदोलन की शुरुआत कब की?", ["1 मार्च 1920","1 मई 1920","1 अगस्त 1920","1 दिसम्बर 1920"], 2],
    ["गाँधीजी ने सविनय अवज्ञा आंदोलन का आरंभ किस कार्य से किया?", ["आमरण अनशन से","कैसर-ए-हिंद पदक वापस कर","दांडी यात्रा द्वारा","पूर्ण स्वाधीनता दिवस मनाकर"], 2],
    ["किस समझौते को दिल्ली समझौता कहा जाता है?", ["गाँधी-इरविन समझौता","गाँधी-अम्बेडकर समझौता","काँग्रेस-लीग समझौता","काँग्रेस-समाजवादी समझौता"], 0],
    ["इंडियन नेशनल काँग्रेस का संस्थापक किसे माना जाता है?", ["आनंदमोहन बसु","दादाभाई नौरोजी","व्योमेशचंद्र बनर्जी","ए. ओ. ह्यूम"], 3],
    ["आर्म्स एक्ट किसने लागू किया था?", ["डलहौजी","कैनिंग","लिटन","रिपन"], 2],
    ["लखनऊ समझौता किस वर्ष हुआ?", ["1916","1918","1920","1922"], 0],
    ["रॉलेट एक्ट क्यों पारित किया गया?", ["क्रांतिकारी गतिविधियों पर अंकुश लगाने के लिए","सरकारी नौकरियों में प्रवेश के लिए","शिक्षण संस्थाओं में प्रवेश के लिए","कालाबाजारी रोकने के लिए"], 0],
    ["'बादशाह खान' या 'सीमांत गाँधी' किसे कहा जाता है?", ["खान अब्दुल गफ्फार खाँ","सर सैयद अहमद खाँ","महात्मा गाँधी","आगा खाँ"], 0],
    ["पूना समझौता किनके मध्य हुआ?", ["गाँधी और जिन्ना","गाँधी और अम्बेडकर","परिवर्तनवादी और अपरिवर्तनवादी","तिलक और लाला लाजपत राय"], 1],
    ["जालियाँवाला बाग हत्याकांड के बाद किस समिति का गठन हुआ?", ["डायर समिति","मांटेग्यू समिति","चेम्सफोर्ड समिति","हंटर समिति"], 3],
    ["भारतीय राष्ट्रवाद के उदय का सबसे प्रमुख कारण क्या था?", ["अंग्रेजी साम्राज्यवाद के विरुद्ध असंतोष","साहित्य एवं समाचार पत्र","राजनीतिक एकीकरण","प्रशासनिक एकीकरण"], 0],
    ["गाँधीजी ने साबरमती आश्रम की स्थापना क्यों की?", ["नमक कानून भंग करने हेतु","ब्रिटिश अधिकारियों के विद्रोह हेतु","व्यापारियों के विद्रोह हेतु","उद्योगपतियों के विद्रोह हेतु"], 0],
    ["रम्पा विद्रोह कब हुआ?", ["1916","1917","1918","1919"], 0],
    ["जालियाँवाला बाग हत्याकांड कब हुआ?", ["13 अप्रैल 1919","14 अप्रैल 1919","15 अप्रैल 1919","16 अप्रैल 1919"], 0],
    ["1911 में बंगाल विभाजन किसने वापस लिया?", ["लॉर्ड कर्जन","लॉर्ड रिपन","लॉर्ड लिटन","लॉर्ड हार्डिंग"], 3],
    ["पूर्ण स्वराज्य प्रस्ताव काँग्रेस के किस अधिवेशन में पारित हुआ?", ["1929, लाहौर","1931, कराची","1933, कलकत्ता","1937, बेलगाँव"], 0],
    ["कांग्रेस समाजवादी दल की स्थापना कब हुई?", ["1933","1934","1935","1926"], 1],
    ["गदर पार्टी की स्थापना किसने और कब की?", ["गुरदयाल सिंह, 1916","चन्द्रशेखर आजाद, 1920","लाला हरदयाल, 1913","सोहन सिंह भाखना, 1918"], 2],
    ["राष्ट्रीय स्वयंसेवक संघ (RSS) की स्थापना कब और किसने की?", ["1923, गुरु गोलवलकर","1925, के. बी. हेडगेवार","1926, चित्तरंजन दास","1928, लालचंद"], 1],
    ["गाँधीजी ने नमक कानून किस तिथि को भंग किया?", ["2 मार्च 1930","12 मार्च 1930","6 अप्रैल 1930","25 मई 1930"], 2],
    ["'हिन्द स्वराज' पुस्तक किसने लिखी?", ["बाल गंगाधर तिलक","गोपाल कृष्ण गोखले","लाला लाजपत राय","महात्मा गाँधी"], 3],
    ["1920 में ताशकंद में भारतीय कम्युनिस्ट पार्टी की स्थापना किसने की?", ["लाला लाजपत राय","एम. एन. जोशी","सत्यभक्त","एम. एन. राय"], 3],
    ["अलीगढ़ आंदोलन का नेतृत्व किसने किया?", ["अब्दुल लतीफ","आगा खाँ","सैयद अहमद खाँ","नवाब बकर-उल-मुल्क"], 2],
    ["'वेदों की ओर लौटो' का नारा किसने दिया?", ["दयानंद सरस्वती","राजा राममोहन राय","स्वामी विवेकानन्द","रामकृष्ण परमहंस"], 0],
    ["'स्वराज दल' के अध्यक्ष कौन थे?", ["जवाहरलाल नेहरू","मोतीलाल नेहरू","मदन मोहन मालवीय","चितरंजन दास"], 1],
    ["पूर्ण स्वतंत्रता दिवस कब घोषित किया गया?", ["31 दिसंबर 1929","26 जनवरी 1930","12 मार्च 1930","1 मार्च 1932"], 1],
    ["आर्य समाज की स्थापना किसने की?", ["राधाकांत","रामकृष्ण परमहंस","विवेकानंद","दयानंद सरस्वती"], 3],
    ["फॉरवर्ड ब्लॉक के संस्थापक कौन थे?", ["एम. एन. राय","सत्यभक्त","सुभाषचंद्र बोस","एन. एम. जोशी"], 2],
    ["सरदार की उपाधि बल्लभ भाई पटेल को किस आंदोलन के दौरान मिली?", ["बारदोली","अहमदाबाद","खेड़ा","चंपारण"], 0],
    ["असहयोग आंदोलन का प्रस्ताव काँग्रेस के किस अधिवेशन में पारित हुआ?", ["सितंबर 1920, कलकत्ता","अक्टूबर 1920, अहमदाबाद","नवम्बर 1920, फैजपुर","दिसम्बर 1920, नागपुर"], 0],
    ["खिलाफत आंदोलन कब और किस देश के शासक के समर्थन में शुरू हुआ?", ["1920, तुर्की","1920, अरब","1920, फ्रांस","1920, जर्मनी"], 0],
    ["श्रमिक विवाद अधिनियम कब बनाया गया?", ["1920","1926","1928","1929"], 3],
    ["अली मुसालियार ने किस विद्रोह का नेतृत्व किया?", ["रम्पा विद्रोह","खोंड विद्रोह","संथाल विद्रोह","मोपला विद्रोह"], 3],
    ["खलीफा पद की समाप्ति तुर्की में कब हुई?", ["1924","1930","1919","1920"], 0],
    ["भारतीय कम्युनिस्ट पार्टी की स्थापना किसने की?", ["एम. एन. राय","पी. एन. राय","पी. सी. राय","ए. के. सेन"], 0],
    ["गाँधीजी दक्षिण अफ्रीका से भारत कब लौटे?", ["1891","1893","1915","1916"], 2],
    ["गाँधीजी ने किस गोलमेज सम्मेलन में भाग लिया?", ["प्रथम","द्वितीय","तृतीय","चतुर्थ"], 1],
    ["साइमन आयोग भारत कब आया?", ["1922","1924","1927","1928"], 3],
    ["काँग्रेस समाजवादी दल की स्थापना किस वर्ष हुई?", ["1929","1930","1931","1934"], 3],
    ["गाँधीजी को 'महात्मा' की उपाधि किसने दी?", ["गोपालकृष्ण गोखले","एनी बेसेंट","रवींद्रनाथ ठाकुर","अबुल कलाम आजाद"], 2],
    ["सांप्रदायिक निर्णय की घोषणा किसने की?", ["लॉयड जॉर्ज","विंस्टन चर्चिल","मैक्डोनॉल्ड","एटली"], 2],
    ["तीनकठिया प्रणाली किस पर लागू थी?", ["उद्योगपतियों पर","व्यापारियों पर","श्रमिकों पर","किसानों पर"], 3],
    ["टाना भगत आंदोलन किन आदिवासियों में हुआ?", ["संथाल","कोल","भील","ओरांव"], 3],
    ["भारतीय स्वाधीनता समिति की स्थापना कहाँ हुई?", ["काबुल","पेशावर","जर्मनी","कनाडा"], 2],
  ];
  return raw.map(([text, opts, ans], i) => ({
    subject: sub, chapter: ch,
    textHI: text, textEN: "", text: text,
    optionsHI: opts, optionsEN: opts,
    answer: ans, explanationHI: "", explanationEN: "",
    docId: `history-nationalism-india-${String(i+1).padStart(3,"0")}`
  }));
}

// ══════════════════════════════════════════════════════════════
//  SUBJECT 4: HISTORY – हिन्द-चीन में राष्ट्रवादी आंदोलन (42 questions)
// ══════════════════════════════════════════════════════════════
function getHistoryIndochinaQuestions() {
  const ch = "हिन्द-चीन में राष्ट्रवादी आंदोलन";
  const sub = "History";
  const raw = [
    ["अंकोरवाट का मंदिर कहाँ स्थित है?", ["वियतनाम","थाईलैंड","लाओस","कम्बोडिया"], 3],
    ["हिंद-चीन पहुँचने वाले प्रथम व्यापारी कौन थे?", ["इंग्लैण्डवासी","फ्रांसीसी","पुर्तगाली","डच"], 2],
    ["हिंद-चीन में बसने वाले फ्रांसीसी कहे जाते थे?", ["फ्रांसीसी","शासक वर्ग","कोलोन","जेनरल"], 2],
    ["नरोत्तम सिंहानुक कहाँ के शासक थे?", ["वियतनाम","लाओस","थाईलैण्ड","कम्बोडिया"], 3],
    ["'द हिस्ट्री ऑफ द लॉस ऑफ वियतनाम' किसने लिखा?", ["हो-ची-मिन्ह","फान बोई-चाऊ","कुआंग","त्रिभु"], 1],
    ["मार्च 1946 ई. में फ्रांस व वियतनाम के बीच होने वाला समझौता?", ["जेनेवा समझौता","हनोई समझौता","पेरिस समझौता","धर्मनिरपेक्ष समझौता"], 1],
    ["किस प्रसिद्ध दार्शनिक ने अमेरिका को वियतनाम युद्ध के लिए दोषी ठहराया?", ["रसेल","हो-ची-मिन्ह","नरोत्तम सिंहनुक","रूसो"], 0],
    ["हिंद-चीन क्षेत्र में अंतिम युद्ध समाप्ति के समय अमेरिकी राष्ट्रपति थे?", ["वाशिंगटन","निकसन","जार्ज बुश","रुजवेल्ट"], 1],
    ["होआ-होआ आंदोलन किस प्रकृति का था?", ["क्रांतिकारी","धार्मिक","साम्राज्यवादी समर्थक","क्रांतिकारी धार्मिक"], 3],
    ["जेनेवा समझौता कब हुआ था?", ["1954","1960","1950","1946"], 0],
    ["वियतनाम का एकीकरण कब पूर्ण हुआ?", ["1970","1980","1879","1975"], 3],
    ["अनामी दल के संस्थापक कौन थे?", ["जोन्गुएन आई","हो-ची-मिन्ह","बाओदायी","फान-चू-त्रिन्ह"], 0],
    ["दिएन-विएन-फू के युद्ध में कौन बुरी तरह हार गया था?", ["पुर्तगाल","फ्रांस","कम्बोडिया","अमेरिका"], 1],
    ["क्रांतिकारी संगठन 'दुई-तान-होई' के नेता कौन थे?", ["फान-बोई-चाऊ","हो-ची-मिन्ह","कुआंग दें","सुवन्न फूमा"], 0],
    ["जापान ने हिन्द-चीन पर कब अधिकार जमा लिया?", ["1939 ई०","1940 ई०","1941 ई०","1942 ई०"], 1],
    ["स्कॉलर्स विद्रोह कब हुआ?", ["1868 ई०","1872 ई०","1866 ई०","1864 ई०"], 0],
    ["पुर्तगालियों ने अपना केंद्र कहाँ बनाया?", ["मलक्का","अन्नाम","तोकिन","अंकोरवाट"], 0],
    ["वियतनाम युद्ध की समाप्ति किस अमेरिकी राष्ट्रपति के समय हुई?", ["जॉर्ज वाशिंगटन","निक्सन","जॉन एफ केनेडी","एफ० रूजवेल्ट"], 1],
    ["हो ची मिन्ह का शाब्दिक अर्थ क्या है?", ["क्रांतिकारी","सुधारक","पथप्रदर्शक","दार्शनिक"], 2],
    ["वियतनाम लोकतांत्रिक गणराज्य की स्थापना किस वर्ष हुई?", ["1943","1944","1945","1946"], 2],
    ["अंकोरवाट मंदिर का निर्माण किसने करवाया था?", ["श्रीमार","कम्बु स्वयंभुव","सूर्यवर्मा द्वितीय","नोरोतम सिहानुक"], 2],
    ["अमेरिका ने रबर के बागानों पर किस रसायन का छिड़काव किया?", ["जरीला","नापाम","एजेंट ऑरेंज","माइ-ली"], 2],
    ["कम्बोडिया फ्रांस का संरक्षित राज्य कब बना?", ["1862","1863","1873","1874"], 1],
    ["लाल खमेर सेना किसकी थी?", ["कैप्टन कांगली","सिहानुक","पोलपोट","हेंग सामरिन"], 2],
    ["वियतनाम में तोकिन फ्री स्कूल किस उद्देश्य से स्थापित किया गया?", ["सैनिक शिक्षा","परंपरागत शिक्षा","धार्मिक शिक्षा","पश्चिमी शिक्षा"], 3],
    ["एन०एल०एच०एस० किसकी राजनीतिक पार्टी थी?", ["वियेतमिन्ह","वियतकांग","पाथेट लाओ","जनरल लोन नोल"], 2],
    ["वियतनाम में अन्नामी दल की स्थापना किसने की?", ["जोन्गुएन आई","फान बोई चाऊ","फान चू त्रिन्ह","हो ची मिन्ह"], 0],
    ["संयुक्त वियतनाम का गठन किस वर्ष हुआ?", ["1954","1968","1974","1975"], 3],
    ["होआ होआ आंदोलन का प्रणेता कौन था?", ["हुइन्ह फू सो","गूयेन थाट थान्ह","लियांग किचाओ","फान बोई चाऊ"], 0],
    ["हिन्द-चीन क्षेत्र में कौन-से देश आते हैं?", ["चीन, वियतनाम, लाओस","हिन्द-चीन, वियतनाम, लाओस","कम्बोडिया, वियतनाम, लाओस","कम्बोडिया, वियतनाम, चीन, थाईलैण्ड"], 2],
    ["वियतनाम में स्कॉलर्स रिवोल्ट किसके विरुद्ध हुआ था?", ["सरकारी नौकरियों से वंचित किए जाने के विरुद्ध","उच्च शिक्षा पर प्रतिबंध के विरुद्ध","प्रेस प्रतिबंध के विरुद्ध","ईसाइयत के विरुद्ध"], 3],
    ["किस राष्ट्रपति के शासनकाल में अमेरिका ने पहली बार वियतनाम युद्ध में भाग लिया?", ["वुडरो विल्सन","रूजवेल्ट","कैनेडी","निक्सन"], 2],
    ["वियतनाम में 'तोकिन फ्री स्कूल' की स्थापना कब हुई?", ["1907 ई०","1908 ई०","1910 ई०","1911 ई०"], 0],
    ["मार्च 1946 में फ्रांस एवं वियतनाम के बीच समझौता?", ["जेनेवा समझौता","हनोई समझौता","पेरिस समझौता","धर्मनिरपेक्ष समझौता"], 1],
    ["हिन्द-चीन में कौन-सा देश नहीं आता है?", ["कम्बोडिया","लाओस","वियतनाम","चीन"], 3],
    ["वियतनाम स्वतंत्रता लीग की स्थापना किसने की?", ["बाओदाई","हो ची मिन्ह","फान बोई चाऊ","गुआंग दे"], 1],
    ["इंडो-चाइना को किस देश ने अपने उपनिवेश के रूप में विकसित किया?", ["डच","अंग्रेज","पुर्तगाली","फ्रांसीसी"], 3],
    ["हिन्द-चीन में आने वाले पहले यूरोपीय व्यापारी कौन थे?", ["डच","अंग्रेज","पुर्तगाली","फ्रांसीसी"], 2],
    ["लियाँग किचाओ कौन थे?", ["चीनी सुधारक","जापानी दार्शनिक","वियतनामी क्रांतिकारी","इनमें कोई नहीं"], 0],
    ["प्राचीन काल में वियतनाम पर किस सभ्यता-संस्कृति का प्रभाव था?", ["चीनी","भारतीय","जापानी","मंगोल"], 0],
    ["फ्रेंच इंडो-चाइना की स्थापना किस वर्ष हुई?", ["1822","1858","1883","1887"], 3],
  ];
  return raw.map(([text, opts, ans], i) => ({
    subject: sub, chapter: ch,
    textHI: text, textEN: "", text: text,
    optionsHI: opts, optionsEN: opts,
    answer: ans, explanationHI: "", explanationEN: "",
    docId: `history-indochina-nationalist-movement-${String(i+1).padStart(3,"0")}`
  }));
}

// ══════════════════════════════════════════════════════════════
//  SUBJECT 5: HISTORY – समाजवाद एवं साम्यवाद (46 questions)
// ══════════════════════════════════════════════════════════════
function getSocialismQuestions() {
  const ch = "समाजवाद एवं साम्यवाद";
  const sub = "History";
  const raw = [
    ["वैज्ञानिक समाजवाद का जनक किसे माना जाता है?", ["सेंट साइमन को","चार्ल्स फूरिए को","लुई ब्लाँ को","कार्ल मार्क्स को"], 3],
    ["लाल सेना का गठन किसने किया था?", ["कार्ल मार्क्स","स्टालिन","ट्राटस्की","करेंसकी"], 2],
    ["रूस में कृषक दास प्रथा का अंत कब हुआ?", ["1861 ई०","1862 ई०","1863 ई०","1864 ई०"], 0],
    ["कम्युनिस्ट मैनिफेस्टो का प्रकाशन किस वर्ष हुआ था?", ["1844 में","1848 में","1864 में","1867 में"], 1],
    ['"वार एण्ड पीस" किसकी रचना है?', ["कार्ल मार्क्स","टॉलस्टाय","दोस्तोवस्की","एंजेल्स"], 1],
    ["रूस में जार का अर्थ क्या होता था?", ["पीने का बर्तन","पानी रखने का मिट्टी","रूस का सामन्त","रूस का सम्राट"], 3],
    ["कार्ल मार्क्स का जन्म कहाँ हुआ था?", ["इंग्लैण्ड","जर्मनी","इटली","रूस"], 1],
    ["प्रथम इंटरनेशनल की बैठक कहाँ हुई?", ["रूस में","फ्रांस में","जर्मनी में","लंदन में"], 3],
    ["प्रथम इंटरनेशनल की स्थापना किस वर्ष हुई थी?", ["1864 में","1867 में","1883 में","1889 में"], 0],
    ["साम्यवादी शासन का पहला प्रयोग कहाँ हुआ था?", ["रूस","जापान","चीन","क्यूबा"], 0],
    ["चेका क्या था?", ["सेना की टुकड़ी","पुलिस दस्ता","पादरी वर्ग","श्रमिक वर्ग"], 1],
    ["निम्नांकित में कौन यूरोपियन समाजवादी नहीं था?", ["लुई ब्लॉ","सेंट साइमन","कार्ल मार्क्स","रॉबर्ट ओवन"], 2],
    ["बोल्शेविक क्रांति कब हुई?", ["फरवरी, 1917 ई०","नवम्बर, 1917 ई०","अप्रैल, 1917 ई०","1905 ई०"], 1],
    ["लेनिन की मृत्यु कब हुई?", ["1921 ई०","1922 ई०","1923 ई०","1924 ई०"], 3],
    ["अंतर्राष्ट्रीय महिला दिवस कब मनाया जाता है?", ["4 जून","1 दिसम्बर","15 अप्रैल","8 मार्च"], 3],
    ["ब्रेस्टलिटोवस्क की संधि किन देशों के बीच हुई थी?", ["रूस और इटली","रूस और फ्रांस","रूस और इंग्लैण्ड","रूस और जर्मनी"], 3],
    ["रूस का पहला समाजवादी कौन था?", ["स्टालिन","प्लेखानोव","लेनिन","टॉलस्टाय"], 1],
    ["कार्ल मार्क्स का जन्म किस वर्ष हुआ था?", ["1815 में","1818 में","1825 में","1838 में"], 1],
    ["रासपुटिन कौन था?", ["भ्रष्ट पादरी","वैज्ञानिक","समाज सुधारक","दार्शनिक"], 0],
    ["लेनिन ने ब्रेस्टलिटोवस्क की संधि किस राष्ट्र के साथ की थी?", ["इंग्लैंड","फ्रांस","जर्मनी","इटली"], 2],
    ["नई आर्थिक नीति कब लागू हुई?", ["1921 ई०","1923 ई०","1920 ई०","1924 ई०"], 0],
    ["'दास कैपिटल' की रचना किसने की?", ["एंजेल्स","दोस्तोवस्की","टॉलस्टाय","कार्ल मार्क्स"], 3],
    ["समाजवादी दर्शन किस पर बल देता है?", ["राजनीतिक समानता पर","नागरिक समानता पर","कानूनी समानता पर","आर्थिक समानता पर"], 3],
    ["रूस के सम्राट को क्या कहा जाता है?", ["फराओं","जार","राजा","रिजेंट"], 1],
    ["कैमिन्टर्न की स्थापना का उद्देश्य क्या था?", ["सैन्यवाद का प्रचार करना","क्रांति का प्रचार करना","पूँजीवाद का प्रचार करना","समाजवाद का प्रचार करना"], 1],
    ["मजदूर दिवस कब मनाया जाता है?", ["1 अप्रैल","1 मई","15 अप्रैल","8 मार्च"], 1],
    ["'समाजवादियों की बाइबिल' किसे कहा जाता है?", ["दास कैपिटल","वार एण्ड पीस","स्पार्क","कम्युनिष्ट घोषणापत्र"], 0],
    ["कार्ल मार्क्स ने किसके साथ मिलकर कम्युनिष्ट घोषणापत्र प्रकाशित किया?", ["जेन","दोस्तोवस्की","एंजिल्स","टॉलस्टाय"], 2],
    ["जार निकोलस द्वितीय की पत्नी जरीना किस देश की राजकुमारी थी?", ["इटली","फ्रांस","ऑस्ट्रिया","जर्मनी"], 2],
    ["फ्रांसीसी समाजवाद के विकास का जन्मदाता कौन हैं?", ["फौरियर","रॉबर्ट ओवेन","कार्ल मार्क्स","सेंट साइमन"], 3],
    ["काम के अधिकार को संवैधानिक अधिकार का रूप सबसे पहले कहाँ मिला?", ["सोवियत संघ","जर्मनी","इंग्लैंड","फ्रांस"], 0],
    ["अप्रैल थीसिस किसने तैयार किया?", ["लेनिन","ट्राटस्की","स्टालिन","मार्क्स"], 0],
    ["7 नवम्बर, 1917 की बोल्शेविक क्रांति का नेतृत्व किसने किया था?", ["स्टालिन","लेनिन","ट्रॉटस्की","खुशचेव"], 1],
    ["'माँ' उपन्यास के लेखक थे?", ["प्लेखानोव","टॉल्सटाय","गोर्की","तुर्गनेव"], 2],
    ["1917 की पहली रूसी क्रांति किस नाम से जानी जाती है?", ["फरवरी की क्रांति","मार्च की क्रांति","अक्टूबर की क्रांति","नवंबर की क्रांति"], 2],
    ["नवम्बर 1917 की रूसी क्रांति के बाद स्थापित सरकार का प्रधान कौन था?", ["स्टालिन","लेनिन","प्लेखानोव","कोई नहीं"], 1],
    ["समाजवाद शब्द का प्रयोग पहली बार किस वर्ष किया गया?", ["1789 में","1827 में","1830 में","1833 में"], 1],
    ["चार्टिस्ट आंदोलन कहाँ हुआ था?", ["ब्रिटेन में","फ्रांस में","रूस में","जर्मनी में"], 0],
    ["विश्व में साम्यवादी शासन की स्थापना सर्वप्रथम किस देश में हुई?", ["रूस में","जर्मनी में","चेकोस्लोवाकिया में","पोलैंड में"], 0],
    ["'वर्जीन स्वायाल' उपन्यास के लेखक कौन थे?", ["लियो टॉल्सटाय","ईवान तुर्गनेव","फ्योदोर दोस्तोवस्की","मैक्सिम गोर्की"], 1],
    ["बोल्शेविक क्रांति का नेतृत्व किसने किया?", ["केरेन्सकी ने","ट्रॉटस्की ने","लेनिन ने","स्टालिन ने"], 2],
    ["1917 की रूसी क्रांति के समय किस जार का शासन था?", ["पीटर","एलेक्जेंडर प्रथम","निकोलस प्रथम","निकोलस द्वितीय"], 3],
    ["कोलखोज की योजना किसने आरंभ की थी?", ["लेनिन ने","स्टालिन ने","निकिता खुशचेव ने","लिओनिड ब्रेझनेव ने"], 1],
    ["'साम्यवादी घोषणा-पत्र' के लेखक थे—", ["लियो टॉल्सटाय","मैक्सिम गोर्की","लेनिन","कार्ल मार्क्स"], 3],
    ["1917 की रूसी क्रांति का तात्कालिक कारण क्या था?", ["जार का निरंकुश शासन","प्रथम विश्वयुद्ध में रूस की पराजय","रासपुटिन की भूमिका","किसानों का असंतोष"], 1],
  ];
  return raw.map(([text, opts, ans], i) => ({
    subject: sub, chapter: ch,
    textHI: text, textEN: "", text: text,
    optionsHI: opts, optionsEN: opts,
    answer: ans, explanationHI: "", explanationEN: "",
    docId: `history-samajwad-samyavad-${String(i+1).padStart(3,"0")}`
  }));
}
