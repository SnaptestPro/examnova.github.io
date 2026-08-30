/**
 * EXAMNOVA - Draft Question Seeder
 *
 * Ye script questions ko Firestore ke draftQuestions collection me save karta hai.
 * Admin panel me "App Script Drafts" tab se approve/edit karke questionBank me bhej sakte hain.
 *
 * Agar HTTP 403 PERMISSION_DENIED aaye, Firebase Console > Firestore Database > Rules
 * me draftQuestions par create/update/read permission allow karni hogi.
 *
 * ⚠️ SECURITY: Restrict Firestore Rules to authenticated users only.
 */

var DRAFT_PROJECT_ID = "the-vishnu-sharma-test";
var DRAFT_API_KEY = "AIzaSyBTrKAoQ2T9KNB2vcacv4EPehaDboXmUxk";
function testDraftConnection() {
  var baseUrl = getDraftBaseUrl();
  var url = baseUrl + "/draftQuestions?key=" + DRAFT_API_KEY + "&pageSize=1";
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log("Status: " + res.getResponseCode());
  Logger.log(res.getContentText().substring(0, 300));
}

function seedDraftQuestions() {
  var questions = getDraftQuestions();
  var added = 0;
  var failed = 0;

  if (!questions || questions.length === 0) {
    Logger.log("No draft questions found. Add questions in getDraftQuestions().");
    return;
  }

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var docId = makeDraftDocId(q, i);

    try {
      saveDraftQuestionToFirestore(docId, q);
      added++;
      Logger.log("Added draft " + (i + 1) + "/" + questions.length + ": " + docId);
    } catch (err) {
      failed++;
      Logger.log("Failed " + docId + ": " + err.message);
    }

    if ((i + 1) % 25 === 0) Utilities.sleep(250);
  }

  Logger.log("Draft upload complete. Added: " + added + ", Failed: " + failed + ", Total: " + questions.length);
}

function saveDraftQuestionToFirestore(docId, q) {
  if (!q) {
    q = getDraftQuestions()[0];
    docId = docId || makeDraftDocId(q, 0);
    Logger.log("saveDraftQuestionToFirestore direct run hua. First sample question use kiya: " + docId);
  }

  var baseUrl = getDraftBaseUrl();
  var url = baseUrl + "/draftQuestions/" + docId + "?key=" + DRAFT_API_KEY;
  var normalized = normalizeDraftQuestion(q);

  var body = {
    fields: {
      subject: fieldValue(normalized.subject),
      chapter: fieldValue(normalized.chapter),
      textHI: fieldValue(normalized.textHI),
      textEN: fieldValue(normalized.textEN),
      text: fieldValue(normalized.text),
      optionsHI: fieldValue(normalized.optionsHI),
      optionsEN: fieldValue(normalized.optionsEN),
      options: fieldValue(normalized.options),
      answer: fieldValue(normalized.answer),
      explanationHI: fieldValue(normalized.explanationHI),
      explanationEN: fieldValue(normalized.explanationEN),
      explanation: fieldValue(normalized.explanation),
      status: fieldValue("pending"),
      source: fieldValue("AppsScript"),
      seededBy: fieldValue("AppsScript_DraftSeeder"),
      sourceDocId: fieldValue(q.docId || ""),
      importedAt: { timestampValue: new Date().toISOString() }
    }
  };

  var res = UrlFetchApp.fetch(url, {
    method: "PATCH",
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error("HTTP " + code + ": " + res.getContentText().substring(0, 300));
  }
}

function getDraftBaseUrl() {
  return "https://firestore.googleapis.com/v1/projects/" +
    DRAFT_PROJECT_ID + "/databases/(default)/documents";
}

function normalizeDraftQuestion(q) {
  var optionsHI = toFourOptions(q.optionsHI || q.options || []);
  var optionsEN = toFourOptions(q.optionsEN || q.options || optionsHI);
  var textHI = String(q.textHI || q.text || "").trim();
  var textEN = String(q.textEN || q.text || textHI).trim();

  return {
    subject: String(q.subject || "General").trim(),
    chapter: String(q.chapter || "").trim(),
    textHI: textHI,
    textEN: textEN,
    text: textHI || textEN,
    optionsHI: optionsHI,
    optionsEN: optionsEN,
    options: hasAnyOption(optionsHI) ? optionsHI : optionsEN,
    answer: Number(q.answer || 0),
    explanationHI: String(q.explanationHI || q.explanation || "").trim(),
    explanationEN: String(q.explanationEN || q.explanation || "").trim(),
    explanation: String(q.explanationHI || q.explanationEN || q.explanation || "").trim()
  };
}

function toFourOptions(options) {
  var out = [];
  options = options || [];
  for (var i = 0; i < options.length && i < 4; i++) {
    out.push(String(options[i] || "").trim());
  }
  while (out.length < 4) out.push("");
  return out;
}

function hasAnyOption(options) {
  for (var i = 0; i < options.length; i++) {
    if (options[i]) return true;
  }
  return false;
}

function makeDraftDocId(q, index) {
  var raw = q.docId || ((q.subject || "draft") + "-" + (q.chapter || "question") + "-" + (index + 1));
  var safe = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 120);
  return "draft-" + (safe || (new Date().getTime() + "-" + index));
}

function fieldValue(value) {
  if (Object.prototype.toString.call(value) === "[object Array]") {
    var values = [];
    for (var i = 0; i < value.length; i++) {
      values.push(fieldValue(value[i]));
    }
    return { arrayValue: { values: values } };
  }

  if (typeof value === "number" && isFinite(value)) {
    if (Math.floor(value) === value) return { integerValue: String(value) };
    return { doubleValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  return { stringValue: String(value == null ? "" : value) };
}

function getDraftQuestions() {
  return [
    {
      docId: "science-chemical-reactions-draft-001",
      subject: "Science",
      chapter: "रासायनिक अभिक्रियाएँ एवं समीकरण",
      textHI: "लोहा को जिंक से लेपित करने की क्रिया को कहते हैं?",
      textEN: "The process of coating iron with zinc is called?",
      optionsHI: ["संक्षारण", "गैल्वनीकरण", "पानी चढ़ाना", "विद्युत अपघटन"],
      optionsEN: ["Corrosion", "Galvanization", "Coating with water", "Electrolysis"],
      answer: 1,
      explanationHI: "लोहे को जिंक से लेपित करने की क्रिया गैल्वनीकरण कहलाती है।",
      explanationEN: "Coating iron with zinc is called galvanization."
    },
    {
      docId: "science-chemical-reactions-draft-002",
      subject: "Science",
      chapter: "रासायनिक अभिक्रियाएँ एवं समीकरण",
      textHI: "सिल्वर क्लोराइड का रंग क्या है?",
      textEN: "What is the colour of silver chloride?",
      optionsHI: ["श्वेत", "पीला", "हरा", "काला"],
      optionsEN: ["White", "Yellow", "Green", "Black"],
      answer: 0,
      explanationHI: "सिल्वर क्लोराइड (AgCl) श्वेत रंग का होता है।",
      explanationEN: "Silver chloride (AgCl) is white."
    },
    {
      docId: "science-chemical-reactions-draft-003",
      subject: "Science",
      chapter: "रासायनिक अभिक्रियाएँ एवं समीकरण",
      textHI: "निम्नलिखित में से कौन एक दहन अभिक्रिया है?",
      textEN: "Which of the following is a combustion reaction?",
      optionsHI: ["जल का उबलना", "जल का उबलना", "पेट्रोल का जलना", "इनमें से कोई नहीं"],
      optionsEN: ["Boiling of water", "Boiling of water", "Burning of petrol", "None of these"],
      answer: 2,
      explanationHI: "पेट्रोल का जलना दहन अभिक्रिया है।",
      explanationEN: "Burning of petrol is a combustion reaction."
    }
  ];
}
