// Regression test — "multi" flag was never actually enforced in grading.
//
// Bug report (admin, Aug 2026): scanning a real sheet where a student
// filled in MORE THAN ONE bubble for a question — sometimes all four —
// the review photo correctly drew the blue "multi" review ring (pickBest
// already flagged it, see test_faint_multi_marks.js), but the Roll/Set/
// Marks header and the green/red dot painted on top still showed it as
// CORRECT whenever the darkest of the several filled bubbles happened to
// match the Answer Key. A multiple-mark response is void on a real OMR
// sheet — it should never earn a mark, no matter which of the student's
// several marks happens to line up with the key.
//
// Root cause: examgrGradeSheet compared detectedLetter (pickBest's
// "best"/darkest guess among the filled options) straight against the
// Answer Key and never looked at the "multi" flag at all — the flag only
// ever reached the PAINTING code (the blue ring), never the SCORING code.
//
// Fix: examgrGradeSheet now checks `flag === "multi"` before the
// correct/wrong comparison and forces status "wrong" unconditionally.
//
// This file ports examgrGradeSheet EXACTLY as fixed in exam-manager.js
// (same convention as the project's other test_*.js files) and checks it
// against synthetic detections built to reproduce the reported bug.

const OPTION_LETTERS = ["A", "B", "C", "D"];

// ---- Ported verbatim from exam-manager.js (post-fix) ----
function examgrGradeSheet(keyArr, detected) {
  let correct = 0, wrong = 0, blank = 0, ungraded = 0, flagged = 0;
  const perQuestion = [];
  for (let q = 1; q <= detected.totalQuestions; q++) {
    const detectedOpt = detected.answers[q];
    const detectedLetter = detectedOpt === null || detectedOpt === undefined ? null : OPTION_LETTERS[detectedOpt];
    const correctLetter = keyArr[q - 1] || null;
    const flag = detected.answerFlags ? (detected.answerFlags[q] || null) : null;
    const multiOptions = detected.answerMultiOptions ? (detected.answerMultiOptions[q] || null) : null;
    let status;
    if (!correctLetter) { status = "ungraded"; ungraded++; }
    else if (flag === "multi") { status = "wrong"; wrong++; }
    else if (detectedLetter === null) { status = "blank"; blank++; }
    else if (detectedLetter === correctLetter) { status = "correct"; correct++; }
    else { status = "wrong"; wrong++; }
    if (flag) flagged++;
    perQuestion.push({ q, detectedOpt, detectedLetter, correctLetter, status, flag, multiOptions });
  }
  const marks = correct;
  return { marks, correct, wrong, blank, ungraded, flagged, perQuestion };
}

// ---- The OLD (buggy) version, kept here ONLY to prove scenario 1 below
// really would have passed before the fix — confirms this test is
// actually exercising the reported bug, not a strawman. ----
function examgrGradeSheetOLD(keyArr, detected) {
  let correct = 0, wrong = 0, blank = 0, ungraded = 0;
  for (let q = 1; q <= detected.totalQuestions; q++) {
    const detectedOpt = detected.answers[q];
    const detectedLetter = detectedOpt === null || detectedOpt === undefined ? null : OPTION_LETTERS[detectedOpt];
    const correctLetter = keyArr[q - 1] || null;
    let status;
    if (!correctLetter) { status = "ungraded"; ungraded++; }
    else if (detectedLetter === null) { status = "blank"; blank++; }
    else if (detectedLetter === correctLetter) { status = "correct"; correct++; }
    else { status = "wrong"; wrong++; }
  }
  return { marks: correct, correct, wrong, blank, ungraded };
}

let pass = true;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
  if (!cond) pass = false;
}

// ──────────────────────────────────────────────────────────────
// Scenario 1 — the exact reported case: Q1 has options B and C BOTH
// filled (a real multiple-mark mistake), pickBest's darkest pick is C,
// and C happens to be the Answer Key's correct letter for Q1. This is
// the case that was silently scoring a mark it should never get.
// ──────────────────────────────────────────────────────────────
{
  const keyArr = ["C", "A", "D"]; // Q1=C, Q2=A, Q3=D
  const detected = {
    totalQuestions: 3,
    answers: { 1: 2, 2: 0, 3: null }, // Q1 detected as C(idx2, the darker of the two marks), Q2=A, Q3=blank
    answerFlags: { 1: "multi", 2: null, 3: null },
    answerMultiOptions: { 1: [{ opt: 1, broad: 60 }, { opt: 2, broad: 65 }] } // B and C both filled
  };

  const buggyOld = examgrGradeSheetOLD(keyArr, detected);
  check("(sanity) confirms the OLD code really did wrongly credit this", buggyOld.correct === 2 && buggyOld.marks === 2);

  const fixed = examgrGradeSheet(keyArr, detected);
  check("Q1 (multi B+C, darkest=C=correct key) is graded WRONG, not correct", fixed.perQuestion[0].status === "wrong");
  check("Q1 does NOT contribute to the marks total", fixed.marks === 1); // only Q2 (A, genuinely correct) should count
  check("wrong count includes the multi question", fixed.wrong === 1 && fixed.correct === 1 && fixed.blank === 1);
}

// ──────────────────────────────────────────────────────────────
// Scenario 2 — multi-marked question where the darkest pick does NOT
// match the key. This already worked before (still "wrong" either way),
// but must keep working identically after the fix — no regression on
// the case that was already correct.
// ──────────────────────────────────────────────────────────────
{
  const keyArr = ["A"];
  const detected = {
    totalQuestions: 1,
    answers: { 1: 2 }, // darkest pick = C, key wants A
    answerFlags: { 1: "multi" },
    answerMultiOptions: { 1: [{ opt: 1 }, { opt: 2 }] }
  };
  const fixed = examgrGradeSheet(keyArr, detected);
  check("multi-marked + darkest pick already wrong -> still wrong (no regression)", fixed.perQuestion[0].status === "wrong" && fixed.marks === 0);
}

// ──────────────────────────────────────────────────────────────
// Scenario 3 — a NORMAL single, confident mark (flag: null) must be
// completely unaffected by the fix — still grades correct/wrong purely
// by letter match, exactly as before.
// ──────────────────────────────────────────────────────────────
{
  const keyArr = ["B", "D"];
  const detected = {
    totalQuestions: 2,
    answers: { 1: 1, 2: 2 }, // Q1=B (matches key), Q2=C (does not match key D)
    answerFlags: { 1: null, 2: null },
    answerMultiOptions: {}
  };
  const fixed = examgrGradeSheet(keyArr, detected);
  check("normal confident marks unaffected: correct still correct", fixed.perQuestion[0].status === "correct");
  check("normal confident marks unaffected: wrong still wrong", fixed.perQuestion[1].status === "wrong");
  check("normal confident marks unaffected: marks total", fixed.marks === 1);
}

// ──────────────────────────────────────────────────────────────
// Scenario 4 — a "faint" flagged (single light dot/tick) answer must
// NOT be forced wrong — only "multi" gets that treatment. Faint marks
// still grade normally by letter match (they're just flagged for a
// teacher's quick visual double-check, same as before the fix).
// ──────────────────────────────────────────────────────────────
{
  const keyArr = ["A"];
  const detected = {
    totalQuestions: 1,
    answers: { 1: 0 },
    answerFlags: { 1: "faint" },
    answerMultiOptions: {}
  };
  const fixed = examgrGradeSheet(keyArr, detected);
  check("faint (not multi) flag still grades by letter match, not forced wrong", fixed.perQuestion[0].status === "correct" && fixed.marks === 1);
}

console.log(pass ? "\nALL PASS" : "\nSOME FAILED");
if (!pass) process.exit(1);
