// Regression/feature test — two rules added on admin request:
//
// 1) MIN REGISTRATION MARKERS: the printed sheet carries a 5x9 = 45-point
//    grid of small internal registration squares (OMR_MARKER_XS x
//    OMR_MARKER_YS — see egBuildLocalRegistrationField's v16 comment).
//    Until now, examgrCaptureQualityIssues never looked at how many of
//    those 45 were actually found in a given capture — a sparse read
//    (heavy crop, shadow, bad angle) could still silently grade with
//    stretched/extrapolated bubble positions. Now: if fewer than 30/45
//    are found, warn (same soft "banner + Retake button" pattern as the
//    existing dark-photo / high-blank-rate checks — Save still works,
//    admin just gets a clear heads-up).
//
// 2) DUPLICATE ROLL NO = MAX MARKS WINS: one roll number can never belong
//    to two students. The old flow asked the admin an OK/Cancel confirm()
//    every single time a roll number repeated. Now it's automatic:
//    egResolveDuplicateRoll compares the new scan's marks against the
//    best of the existing duplicate(s) for that roll and always keeps
//    whichever attempt scores highest.
//
// This file ports both functions EXACTLY as fixed in exam-manager.js
// (same convention as the project's other test_*.js files) and checks
// them against synthetic scenarios.

// ---- Ported verbatim from exam-manager.js (post-fix) ----

const EG_TOTAL_REG_MARKERS = 5 * 9; // OMR_MARKER_XS.length * OMR_MARKER_YS.length
const EG_MIN_REG_MARKERS_WARN = 30;
const EG_DARK_WHITE_WARN = 120;
const EG_HIGH_BLANK_RATE_WARN = 0.35;

function examgrCaptureQualityIssues(detected, graded) {
  const issues = [];
  if (typeof detected.whiteMedian === "number" && detected.whiteMedian <= EG_DARK_WHITE_WARN) {
    issues.push("Photo bahut dark lag rahi hai — 🔦 Flash ON karke dobara scan karein.");
  }
  const regFound = detected.map && Array.isArray(detected.map.regFieldPoints) ? detected.map.regFieldPoints.length : null;
  if (regFound !== null && regFound < EG_MIN_REG_MARKERS_WARN) {
    issues.push(`Sirf ${regFound}/${EG_TOTAL_REG_MARKERS} registration squares mil paaye (kam se kam ${EG_MIN_REG_MARKERS_WARN} chahiye) — sheet poori tarah frame mein, seedhi aur achhi light mein rakh kar dobara scan karein.`);
  }
  if (Array.isArray(detected.rollDigitsDetected) && detected.rollDigitsDetected.some(d => d === null)) {
    issues.push("Roll No ke kuch digits saaf nahi padhe gaye — Edit se check kar lein ya Retake karein.");
  }
  const total = graded.perQuestion.length;
  if (total && (graded.blank / total) >= EG_HIGH_BLANK_RATE_WARN) {
    issues.push(`${graded.blank}/${total} answers blank/unclear aayi hain — sheet ka angle ya lighting check karke dobara try karein.`);
  }
  return issues;
}

function egResolveDuplicateRoll(dupExisting, newMarks) {
  const prevBestMarks = Math.max(...dupExisting.map(d => Number(d.marks || 0)));
  if (newMarks <= prevBestMarks) return { action: "discard", prevBestMarks, newMarks };
  return { action: "replace", prevBestMarks, newMarks };
}

let pass = true;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
  if (!cond) pass = false;
}

function fakeGraded(perQuestionCount, blank) {
  return { perQuestion: new Array(perQuestionCount).fill(0), blank };
}

// ──────────────────────────────────────────────────────────────
// Scenario 1 — sparse registration read (below 30/45) must warn, even
// when the photo is bright and blank-rate is fine (isolating this check
// from the other, pre-existing checks).
// ──────────────────────────────────────────────────────────────
{
  const detected = {
    whiteMedian: 200,
    rollDigitsDetected: [1, 2],
    map: { regFieldPoints: new Array(22).fill({}) } // 22/45 found
  };
  const graded = fakeGraded(45, 2); // low blank rate
  const issues = examgrCaptureQualityIssues(detected, graded);
  check("sparse registration grid (22/45) triggers a warning", issues.some(m => m.includes("22/45")));
}

// ──────────────────────────────────────────────────────────────
// Scenario 2 — exactly at the threshold (30/45) must NOT warn (30 is
// declared "enough", the check is strictly-less-than).
// ──────────────────────────────────────────────────────────────
{
  const detected = {
    whiteMedian: 200,
    rollDigitsDetected: [1, 2],
    map: { regFieldPoints: new Array(30).fill({}) }
  };
  const graded = fakeGraded(45, 2);
  const issues = examgrCaptureQualityIssues(detected, graded);
  check("exactly 30/45 does NOT trigger the registration warning", !issues.some(m => m.includes("registration")));
}

// ──────────────────────────────────────────────────────────────
// Scenario 3 — a clean, well-registered capture must produce zero
// issues (no regression on the good path).
// ──────────────────────────────────────────────────────────────
{
  const detected = {
    whiteMedian: 200,
    rollDigitsDetected: [1, 2],
    map: { regFieldPoints: new Array(45).fill({}) } // all 45 found
  };
  const graded = fakeGraded(45, 1);
  const issues = examgrCaptureQualityIssues(detected, graded);
  check("fully-registered, bright, low-blank capture has zero issues", issues.length === 0);
}

// ──────────────────────────────────────────────────────────────
// Scenario 4 — duplicate roll, new scan scores LOWER -> discard new,
// old (higher-marks) attempt stays valid.
// ──────────────────────────────────────────────────────────────
{
  const dupExisting = [{ marks: 38 }];
  const decision = egResolveDuplicateRoll(dupExisting, 32);
  check("lower-marks duplicate is discarded", decision.action === "discard" && decision.prevBestMarks === 38);
}

// ──────────────────────────────────────────────────────────────
// Scenario 5 — duplicate roll, new scan scores HIGHER -> replace old.
// ──────────────────────────────────────────────────────────────
{
  const dupExisting = [{ marks: 28 }];
  const decision = egResolveDuplicateRoll(dupExisting, 35);
  check("higher-marks duplicate replaces the old one", decision.action === "replace");
}

// ──────────────────────────────────────────────────────────────
// Scenario 6 — exactly equal marks -> discard the new one (existing
// stays canonical; avoids flip-flopping on re-scans of the same sheet
// that happen to grade identically).
// ──────────────────────────────────────────────────────────────
{
  const dupExisting = [{ marks: 30 }];
  const decision = egResolveDuplicateRoll(dupExisting, 30);
  check("equal marks -> discard (existing stays valid)", decision.action === "discard");
}

// ──────────────────────────────────────────────────────────────
// Scenario 7 — more than one prior duplicate already exists (edge case:
// duplicates saved before this fix shipped) -> compares against the
// BEST of all of them, not just the most recent.
// ──────────────────────────────────────────────────────────────
{
  const dupExisting = [{ marks: 20 }, { marks: 40 }, { marks: 15 }];
  const decisionLoses = egResolveDuplicateRoll(dupExisting, 33);
  check("compares against best of multiple existing duplicates (33 < best 40 -> discard)", decisionLoses.action === "discard" && decisionLoses.prevBestMarks === 40);
  const decisionWins = egResolveDuplicateRoll(dupExisting, 41);
  check("beats the best of multiple existing duplicates (41 > best 40 -> replace)", decisionWins.action === "replace");
}

console.log(pass ? "\nALL PASS" : "\nSOME FAILED");
if (!pass) process.exit(1);
