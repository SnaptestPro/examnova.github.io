/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   EXAMNOVA — MCQ Submission & Approval System        ║
 * ║   Google Sheet → Firebase draftQuestions → Admin Approval       ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  ⚠️ SECURITY: Restrict Firestore Rules to authenticated users. ║
 * ║                                                                  ║
 * ║  SETUP KAISE KAREIN:                                             ║
 * ║  1. Ek naya Google Sheet banao                                   ║
 * ║  2. Tools > Apps Script > Is code ko paste karo                  ║
 * ║  3. Pehli baar "setupSheet" function run karo — headers          ║
 * ║     automatically ban jaayenge                                   ║
 * ║  4. Sheet mein MCQ bhari jaayenge                                ║
 * ║  5. "submitMCQsFromSheet" run karo → Firebase mein jaayegi       ║
 * ║  6. Admin Panel > App Script Drafts tab mein dikhegi             ║
 * ║  7. Admin Approve karein → Question Bank mein aajayega           ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FIREBASE CONFIG — Apna config yahan set karo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var PROJECT_ID = "the-vishnu-sharma-test";
var API_KEY    = "AIzaSyBTrKAoQ2T9KNB2vcacv4EPehaDboXmUxk";
var BASE_URL   = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";

// Submitter ka naam — kis teacher ne submit kiya
var SUBMITTED_BY = "Teacher"; // ← Apna naam likhein

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SHEET COLUMN MAP
//  Ye columns sheet mein hone chahiye (setupSheet se auto-ban jaayenge)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var COLUMNS = {
  SUBJECT:        1,   // A - Subject (History, Science, etc.)
  CHAPTER:        2,   // B - Chapter Name
  QUESTION_HI:    3,   // C - Question (Hindi)
  QUESTION_EN:    4,   // D - Question (English) — optional
  OPTION_A:       5,   // E - Option A
  OPTION_B:       6,   // F - Option B
  OPTION_C:       7,   // G - Option C
  OPTION_D:       8,   // H - Option D
  CORRECT_ANS:    9,   // I - Correct Answer (A / B / C / D)
  EXPLANATION_HI: 10,  // J - Explanation (Hindi) — optional
  EXPLANATION_EN: 11,  // K - Explanation (English) — optional
  STATUS:         12,  // L - Status (auto: pending/submitted/error)
  FIREBASE_ID:    13,  // M - Firebase Doc ID (auto-filled)
  NOTES:          14,  // N - Notes/Comments
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SPREADSHEET ID — Agar error aaye toh apna Sheet ID yahan paste karo
//  (URL mein docs.google.com/spreadsheets/d/YAHAN-WALA-ID/edit)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var SPREADSHEET_ID = ""; // ← Agar error aaye toh yahan Sheet ID paste karo

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 1 — PEHLE YE RUN KARO: Sheet setup + headers banayega
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function setupSheet() {
  var ss = getSpreadsheet();

  // MCQ Sheet
  var mcqSheet = ss.getSheetByName("MCQ Submissions");
  if (!mcqSheet) mcqSheet = ss.insertSheet("MCQ Submissions");

  // Header row
  var headers = [
    "Subject ★",
    "Chapter ★",
    "Question (Hindi) ★",
    "Question (English)",
    "Option A ★",
    "Option B ★",
    "Option C ★",
    "Option D ★",
    "Correct Answer (A/B/C/D) ★",
    "Explanation (Hindi)",
    "Explanation (English)",
    "Status",
    "Firebase ID",
    "Notes"
  ];

  mcqSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Header styling
  var headerRange = mcqSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#1e3a5f");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(11);
  headerRange.setWrap(true);

  // Column widths
  mcqSheet.setColumnWidth(1, 120);  // Subject
  mcqSheet.setColumnWidth(2, 200);  // Chapter
  mcqSheet.setColumnWidth(3, 350);  // Question Hindi
  mcqSheet.setColumnWidth(4, 350);  // Question English
  mcqSheet.setColumnWidth(5, 180);  // Option A
  mcqSheet.setColumnWidth(6, 180);  // Option B
  mcqSheet.setColumnWidth(7, 180);  // Option C
  mcqSheet.setColumnWidth(8, 180);  // Option D
  mcqSheet.setColumnWidth(9, 80);   // Correct Answer
  mcqSheet.setColumnWidth(10, 250); // Explanation HI
  mcqSheet.setColumnWidth(11, 250); // Explanation EN
  mcqSheet.setColumnWidth(12, 100); // Status
  mcqSheet.setColumnWidth(13, 200); // Firebase ID
  mcqSheet.setColumnWidth(14, 180); // Notes

  // Freeze header row
  mcqSheet.setFrozenRows(1);

  // Dropdown validation for Subject column
  var subjectRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["History", "Science", "Social Science", "Math", "Hindi", "Sanskrit", "Geography", "General Knowledge", "Other"], true)
    .setAllowInvalid(false)
    .build();
  mcqSheet.getRange(2, COLUMNS.SUBJECT, 500, 1).setDataValidation(subjectRule);

  // Dropdown validation for Correct Answer column
  var ansRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["A", "B", "C", "D"], true)
    .setAllowInvalid(false)
    .build();
  mcqSheet.getRange(2, COLUMNS.CORRECT_ANS, 500, 1).setDataValidation(ansRule);

  // Status column — light blue, read-only look
  mcqSheet.getRange(2, COLUMNS.STATUS, 500, 1).setBackground("#e8f4fd");
  mcqSheet.getRange(2, COLUMNS.FIREBASE_ID, 500, 1).setBackground("#f0f0f0");

  // Sample row
  var sampleRow = [
    "History",
    "यूरोप में राष्ट्रवाद",
    "मेटरनिख कौन था?",
    "Who was Metternich?",
    "ऑस्ट्रिया का चांसलर",
    "फ्रांस का सम्राट",
    "रूस का जार",
    "प्रशा का चांसलर",
    "A",
    "मेटरनिख ऑस्ट्रिया का चांसलर था।",
    "Metternich was the Austrian Chancellor.",
    "sample",
    "",
    "Ye sample row hai — delete kar sakte ho"
  ];
  mcqSheet.getRange(2, 1, 1, sampleRow.length).setValues([sampleRow]);
  mcqSheet.getRange(2, 1, 1, sampleRow.length).setBackground("#fff9e6");

  // Instructions Sheet
  var infoSheet = ss.getSheetByName("Instructions");
  if (!infoSheet) infoSheet = ss.insertSheet("Instructions");
  infoSheet.clearContents();
  var instructions = [
    ["📋 EXAMNOVA MCQ SUBMISSION SYSTEM — INSTRUCTIONS"],
    [""],
    ["★ = Required fields"],
    [""],
    ["COLUMN DETAILS:"],
    ["A - Subject", "History / Science / Social Science / Math / Hindi / Sanskrit / Geography"],
    ["B - Chapter", "Chapter ka exact naam (e.g. यूरोप में राष्ट्रवाद)"],
    ["C - Question (Hindi)", "MCQ ka question Hindi mein"],
    ["D - Question (English)", "Optional — English version"],
    ["E to H - Options A,B,C,D", "Charo options bhari jaani chahiye"],
    ["I - Correct Answer", "Sirf A, B, C, ya D likhein"],
    ["J - Explanation (Hindi)", "Optional — answer ki explanation"],
    ["K - Explanation (English)", "Optional"],
    ["L - Status", "Auto-fill hoga — kuch mat likho"],
    ["M - Firebase ID", "Auto-fill hoga — kuch mat likho"],
    ["N - Notes", "Optional notes/comments"],
    [""],
    ["HOW TO SUBMIT:"],
    ["1.", "MCQ Submissions sheet mein questions bharo"],
    ["2.", "Apps Script > Run > submitMCQsFromSheet"],
    ["3.", "Status column mein ✅ submitted dikhega"],
    ["4.", "Admin panel > App Script Drafts tab mein check karo"],
    ["5.", "Admin Approve karein → Question Bank mein aa jaayega"],
    [""],
    ["RE-SUBMIT:"],
    ["- Sirf naye/pending rows submit honge (status blank ya 'error')"],
    ["- 'submitted' ya 'approved' rows skip ho jaayenge"],
    [""],
    ["COMMON ERRORS:"],
    ["❌ Permission Denied", "Firebase Console > Firestore Rules mein allow write: if true; add karo"],
    ["❌ Row skipped", "Required fields blank hain — Subject, Chapter, Question, Options, Answer zaroori hain"],
  ];
  infoSheet.getRange(1, 1, instructions.length, 2).setValues(instructions);
  infoSheet.getRange(1, 1, 1, 2).merge().setBackground("#1e3a5f").setFontColor("#fff").setFontWeight("bold").setFontSize(14);
  infoSheet.setColumnWidth(1, 200);
  infoSheet.setColumnWidth(2, 500);

  // Custom menu
  addCustomMenu();

  SpreadsheetApp.getUi().alert(
    "✅ Sheet Setup Complete!\n\n" +
    "Ab:\n" +
    "1. 'MCQ Submissions' sheet mein questions bharo\n" +
    "2. Menu > 📝 MCQ System > Submit MCQs to Firebase\n\n" +
    "Sample row row 2 mein hai — dekh sakte ho format."
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STEP 2 — MAIN SUBMIT FUNCTION — Ye run karo MCQ submit karne ke liye
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function submitMCQsFromSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("MCQ Submissions");

  if (!sheet) {
    SpreadsheetApp.getUi().alert("❌ 'MCQ Submissions' sheet nahi mili!\n\nPehle setupSheet() run karo.");
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("Sheet mein koi data nahi hai.\nRow 2 se questions bharo.");
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var submitted = 0, skipped = 0, failed = 0, alreadyDone = 0;

  Logger.log("═══════════════════════════════════════════");
  Logger.log("📚 MCQ SUBMISSION STARTED — " + new Date().toLocaleString());
  Logger.log("Total rows: " + data.length);
  Logger.log("═══════════════════════════════════════════");

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowNum = i + 2;
    var status = String(row[COLUMNS.STATUS - 1] || "").trim().toLowerCase();

    // Skip already submitted/approved/sample rows
    if (status === "submitted" || status === "approved" || status === "sample") {
      alreadyDone++;
      Logger.log("⏭️  Row " + rowNum + ": Already " + status + " — skipped");
      continue;
    }

    // Validate required fields
    var subject    = String(row[COLUMNS.SUBJECT - 1] || "").trim();
    var chapter    = String(row[COLUMNS.CHAPTER - 1] || "").trim();
    var questionHI = String(row[COLUMNS.QUESTION_HI - 1] || "").trim();
    var optA       = String(row[COLUMNS.OPTION_A - 1] || "").trim();
    var optB       = String(row[COLUMNS.OPTION_B - 1] || "").trim();
    var optC       = String(row[COLUMNS.OPTION_C - 1] || "").trim();
    var optD       = String(row[COLUMNS.OPTION_D - 1] || "").trim();
    var correctAns = String(row[COLUMNS.CORRECT_ANS - 1] || "").trim().toUpperCase();

    // Validation check
    if (!subject || !chapter || !questionHI || !optA || !optB || !optC || !optD || !correctAns) {
      skipped++;
      sheet.getRange(rowNum, COLUMNS.STATUS).setValue("⚠️ incomplete");
      sheet.getRange(rowNum, COLUMNS.STATUS).setBackground("#fff3cd");
      Logger.log("⚠️  Row " + rowNum + ": Required fields missing — skipped");
      continue;
    }

    if (!["A","B","C","D"].includes(correctAns)) {
      skipped++;
      sheet.getRange(rowNum, COLUMNS.STATUS).setValue("⚠️ invalid answer");
      sheet.getRange(rowNum, COLUMNS.STATUS).setBackground("#fff3cd");
      Logger.log("⚠️  Row " + rowNum + ": Invalid answer '" + correctAns + "' — must be A/B/C/D");
      continue;
    }

    // Optional fields
    var questionEN    = String(row[COLUMNS.QUESTION_EN - 1] || "").trim();
    var explanationHI = String(row[COLUMNS.EXPLANATION_HI - 1] || "").trim();
    var explanationEN = String(row[COLUMNS.EXPLANATION_EN - 1] || "").trim();

    var answerIndex = ["A","B","C","D"].indexOf(correctAns); // 0,1,2,3
    var optionsHI = [optA, optB, optC, optD];

    // Generate doc ID
    var docId = makeDraftId(subject, chapter, i);

    // Build question object
    var q = {
      subject:        subject,
      chapter:        chapter,
      textHI:         questionHI,
      textEN:         questionEN,
      text:           questionHI,
      optionsHI:      optionsHI,
      optionsEN:      questionEN ? optionsHI : [],
      options:        optionsHI,
      answer:         answerIndex,
      explanationHI:  explanationHI || ("Correct Answer: " + correctAns + " — " + optionsHI[answerIndex]),
      explanationEN:  explanationEN,
      explanation:    explanationHI || "",
      status:         "pending",
      source:         "GoogleSheet",
      submittedBy:    SUBMITTED_BY,
      sourceDocId:    "sheet-row-" + rowNum,
      sheetRowNum:    rowNum,
      importedAt:     new Date().toISOString()
    };

    // Submit to Firebase
    try {
      var success = saveToFirestore(docId, q);
      if (success) {
        submitted++;
        sheet.getRange(rowNum, COLUMNS.STATUS).setValue("✅ submitted");
        sheet.getRange(rowNum, COLUMNS.STATUS).setBackground("#d4edda");
        sheet.getRange(rowNum, COLUMNS.FIREBASE_ID).setValue(docId);
        Logger.log("✅ Row " + rowNum + " submitted: " + docId + " — " + subject + " > " + chapter);
      }
    } catch (err) {
      failed++;
      sheet.getRange(rowNum, COLUMNS.STATUS).setValue("❌ error");
      sheet.getRange(rowNum, COLUMNS.STATUS).setBackground("#f8d7da");
      sheet.getRange(rowNum, COLUMNS.NOTES).setValue("Error: " + err.message.substring(0, 100));
      Logger.log("❌ Row " + rowNum + " FAILED: " + err.message);
    }

    // Rate limiting — har 20 rows ke baad thoda wait
    if ((i + 1) % 20 === 0) Utilities.sleep(300);
  }

  // Summary
  Logger.log("═══════════════════════════════════════════");
  Logger.log("🎉 SUBMISSION COMPLETE!");
  Logger.log("✅ Submitted:   " + submitted);
  Logger.log("⏭️  Already done: " + alreadyDone);
  Logger.log("⚠️  Skipped:    " + skipped);
  Logger.log("❌ Failed:      " + failed);
  Logger.log("═══════════════════════════════════════════");

  SpreadsheetApp.getUi().alert(
    "📊 SUBMISSION COMPLETE!\n\n" +
    "✅ Submitted:      " + submitted + "\n" +
    "⏭️  Already done:  " + alreadyDone + "\n" +
    "⚠️  Incomplete:   " + skipped + "\n" +
    "❌ Failed:         " + failed + "\n\n" +
    (submitted > 0
      ? "Admin panel > 'App Script Drafts' tab mein dekho.\nAdmin approve karega toh Question Bank mein aa jaayega. ✅"
      : "Koi new question submit nahi hua. Rows check karo.")
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHECK STATUS — Kis question ka kya hua
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function checkApprovalStatus() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("MCQ Submissions");
  if (!sheet) { SpreadsheetApp.getUi().alert("Sheet nahi mili."); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert("Koi data nahi."); return; }

  var data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var approved = 0, pending = 0, rejected = 0, error = 0, incomplete = 0;

  Logger.log("Checking Firebase status for " + data.length + " rows...");

  for (var i = 0; i < data.length; i++) {
    var docId = String(data[i][COLUMNS.FIREBASE_ID - 1] || "").trim();
    var rowNum = i + 2;
    if (!docId || docId === "") continue;

    try {
      var url = BASE_URL + "/draftQuestions/" + docId + "?key=" + API_KEY + "&mask.fieldPaths=status";
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        var fbData = JSON.parse(res.getContentText());
        var fbStatus = fbData.fields && fbData.fields.status ? fbData.fields.status.stringValue : "pending";
        sheet.getRange(rowNum, COLUMNS.STATUS).setValue(
          fbStatus === "approved" ? "✅ approved" :
          fbStatus === "rejected" ? "❌ rejected" :
          "⏳ pending"
        );
        if (fbStatus === "approved") approved++;
        else if (fbStatus === "rejected") rejected++;
        else pending++;
      } else if (res.getResponseCode() === 404) {
        sheet.getRange(rowNum, COLUMNS.STATUS).setValue("🗑️ deleted");
      }
    } catch (err) {
      Logger.log("Row " + rowNum + " check failed: " + err.message);
      error++;
    }
    if ((i + 1) % 15 === 0) Utilities.sleep(200);
  }

  SpreadsheetApp.getUi().alert(
    "📊 APPROVAL STATUS:\n\n" +
    "✅ Approved:  " + approved + "\n" +
    "⏳ Pending:   " + pending + "\n" +
    "❌ Rejected:  " + rejected + "\n" +
    "⚠️  Errors:   " + error
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RE-SUBMIT FAILED ROWS ONLY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function resubmitFailedRows() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("MCQ Submissions");
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var resetCount = 0;

  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][COLUMNS.STATUS - 1] || "").trim().toLowerCase();
    if (status.includes("error") || status.includes("incomplete")) {
      sheet.getRange(i + 2, COLUMNS.STATUS).setValue("");
      sheet.getRange(i + 2, COLUMNS.STATUS).setBackground("#ffffff");
      resetCount++;
    }
  }

  if (resetCount > 0) {
    SpreadsheetApp.getUi().alert(resetCount + " failed rows reset kiye.\nAb Submit MCQs run karo.");
  } else {
    SpreadsheetApp.getUi().alert("Koi failed row nahi mili.");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CONNECTION TEST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function testConnection() {
  var url = BASE_URL + "/draftQuestions?key=" + API_KEY + "&pageSize=1";
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code === 200) {
    SpreadsheetApp.getUi().alert("✅ Firebase connection successful!\n\nAb MCQ submit kar sakte ho.");
  } else {
    SpreadsheetApp.getUi().alert("❌ Connection failed!\n\nHTTP " + code + "\n\n" + res.getContentText().substring(0, 300));
  }
  Logger.log("Connection test: HTTP " + code);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CUSTOM MENU — Sheet open hone par automatically add hoga
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function onOpen() {
  addCustomMenu();
}

function addCustomMenu() {
  SpreadsheetApp.getUi()
    .createMenu("📝 MCQ System")
    .addItem("🚀 Submit MCQs to Firebase", "submitMCQsFromSheet")
    .addSeparator()
    .addItem("🔍 Check Approval Status", "checkApprovalStatus")
    .addItem("🔄 Retry Failed Rows", "resubmitFailedRows")
    .addSeparator()
    .addItem("🔌 Test Firebase Connection", "testConnection")
    .addItem("⚙️ Setup Sheet (First Time)", "setupSheet")
    .addToUi();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function saveToFirestore(docId, q) {
  var url = BASE_URL + "/draftQuestions/" + docId + "?key=" + API_KEY;

  var body = {
    fields: {
      subject:        { stringValue: q.subject },
      chapter:        { stringValue: q.chapter },
      textHI:         { stringValue: q.textHI },
      textEN:         { stringValue: q.textEN || "" },
      text:           { stringValue: q.textHI },
      optionsHI:      { arrayValue: { values: q.optionsHI.map(function(o) { return { stringValue: String(o) }; }) }},
      optionsEN:      { arrayValue: { values: (q.optionsEN || []).map(function(o) { return { stringValue: String(o) }; }) }},
      options:        { arrayValue: { values: q.optionsHI.map(function(o) { return { stringValue: String(o) }; }) }},
      answer:         { integerValue: String(q.answer) },
      explanationHI:  { stringValue: q.explanationHI || "" },
      explanationEN:  { stringValue: q.explanationEN || "" },
      explanation:    { stringValue: q.explanationHI || "" },
      status:         { stringValue: "pending" },
      source:         { stringValue: "GoogleSheet" },
      submittedBy:    { stringValue: q.submittedBy || "Teacher" },
      sourceDocId:    { stringValue: q.sourceDocId || "" },
      sheetRowNum:    { integerValue: String(q.sheetRowNum || 0) },
      importedAt:     { timestampValue: new Date().toISOString() }
    }
  };

  var options = {
    method: "PATCH",
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();

  if (code !== 200 && code !== 201) {
    throw new Error("HTTP " + code + ": " + res.getContentText().substring(0, 200));
  }
  return true;
}

function makeDraftId(subject, chapter, index) {
  var subj = subject.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 15);
  var chap = chapter.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, "-").substring(0, 20);
  var ts   = Date.now().toString(36);
  var idx  = String(index + 1).padStart(3, "0");
  return ("draft-gs-" + subj + "-" + idx + "-" + ts).substring(0, 100);
}
