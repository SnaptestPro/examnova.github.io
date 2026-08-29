// Standalone test for the v13 fix (see SCAN_ACCURACY_EXPOSURE_FIX_v13_NOTES.md
// and the comment block above EG_MARK_THRESHOLD in exam-manager.js).
//
// Reported bug: scanning the exact SAME physical sheet twice in a row gave
// wildly different roll numbers / marks each time (verified from user
// screenshots: same sheet -> Marks 2.0, 15.0, 35.0, 63.0, 56.0 across five
// consecutive scans, Roll No flipping between "??" and "99"). Root cause:
// EG_MARK_THRESHOLD (and the EG_CORE_* constants) were fixed ABSOLUTE
// pixel-brightness deltas. A phone's auto-exposure varies the overall
// brightness of one capture vs. the next even when nothing on the sheet
// changed, so the same ink mark's measured delta could land on either side
// of a fixed threshold depending on which capture's exposure happened to
// be used.
//
// This test reimplements just the `genuine()` decision (old fixed-constant
// version vs. new exposure-scaled version) and checks that a real mark,
// captured under two different simulated exposures, is read CONSISTENTLY
// by the new logic but INCONSISTENTLY by the old one.

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ok  - ${label}`); }
  else { failed++; console.log(`  FAIL - ${label}`); }
}

const EG_MARK_THRESHOLD = 42;
const EG_CORE_MIN_FOR_CONFIDENT = 20;
const EG_REFERENCE_WHITE = 210;
const EG_MIN_EXPOSURE_SCALE = 0.45;
const EG_MAX_EXPOSURE_SCALE = 1.15;

function oldGenuine(broad, core) {
  return broad > EG_MARK_THRESHOLD && core > EG_CORE_MIN_FOR_CONFIDENT;
}

function newGenuine(broad, core, localWhiteMedian) {
  const scale = Math.min(EG_MAX_EXPOSURE_SCALE, Math.max(EG_MIN_EXPOSURE_SCALE, localWhiteMedian / EG_REFERENCE_WHITE));
  return broad > EG_MARK_THRESHOLD * scale && core > EG_CORE_MIN_FOR_CONFIDENT * scale;
}

// ── Scenario: a genuine pen-filled bubble, captured under bright,
// reference-level lighting (paper white ~ 210, ink reads near-black). ──
const brightWhite = 210, brightInk = 20;
const brightBroad = brightWhite - brightInk;   // 190
const brightCore = brightWhite - brightInk;    // 190
check("bright capture: old logic reads the mark as filled", oldGenuine(brightBroad, brightCore));
check("bright capture: new logic also reads the mark as filled", newGenuine(brightBroad, brightCore, brightWhite));

// ── Same physical mark, same ink, but this capture came out dimmer
// (phone's auto-exposure/auto-ISO landed differently — a very ordinary,
// unavoidable amount of capture-to-capture variance). Paper white reads
// ~130 instead of 210; ink, being already near-black, moves proportionally
// less (sensor black-level floor) and reads ~45 instead of 20. ──
const dimWhite = 130, dimInk = 45;
const dimBroad = dimWhite - dimInk;    // 85
const dimCore = dimWhite - dimInk;     // 85

check("dim capture: broad delta is still non-trivial (85px)", dimBroad === 85);
// This is the actual bug: a real, unmistakably-filled bubble can read
// BELOW the fixed threshold once diluted by a dimmer exposure that shrank
// the delta but didn't erase it.
check("dim capture: old fixed-threshold logic still reads it as filled here (deltas are large enough this is a clean case)", oldGenuine(dimBroad, dimCore));

// ── A more marginal case: a slightly lighter pen mark that clears the
// bright-exposure threshold comfortably, but a dim exposure compresses the
// delta down near/under the fixed 42px cutoff — this is the flip that was
// actually reported (same mark, different capture => different result). ──
const brightWhite2 = 210, brightInk2 = 140; // moderate/ordinary pen mark
const brightBroad2 = brightWhite2 - brightInk2; // 70 -> clears old fixed 42 threshold
const dimWhite2 = 120, dimInk2 = 95;            // same mark, dimmer capture
const dimBroad2 = dimWhite2 - dimInk2;          // 25 -> falls BELOW old fixed 42 threshold

check("marginal mark, bright capture: passes both old and new logic", oldGenuine(brightBroad2, brightBroad2) && newGenuine(brightBroad2, brightBroad2, brightWhite2));
check("marginal mark, dim capture: OLD logic flips it to blank (the bug)", !oldGenuine(dimBroad2, dimBroad2));
check("marginal mark, dim capture: NEW exposure-scaled logic still reads it as filled (the fix)", newGenuine(dimBroad2, dimBroad2, dimWhite2));

// ── Sanity: a genuinely BLANK bubble (just paper + faint ring artifact)
// must still read as blank under the new logic at any exposure — the fix
// must not make detection more permissive across the board, only more
// consistent for genuine marks. ──
const blankBrightDelta = 15; // small artifact-level delta, bright capture
const blankDimDelta = 9;     // same artifact, dimmer capture (also shrinks)
check("blank bubble, bright capture: correctly NOT genuine (old)", !oldGenuine(blankBrightDelta, blankBrightDelta));
check("blank bubble, bright capture: correctly NOT genuine (new)", !newGenuine(blankBrightDelta, blankBrightDelta, brightWhite2));
check("blank bubble, dim capture: correctly NOT genuine (new)", !newGenuine(blankDimDelta, blankDimDelta, dimWhite2));

// ── Guardrail: an extremely dark/underexposed capture must not scale
// thresholds down so far that noise starts reading as marks. ──
const veryDimWhite = 40; // near-unusable photo
const scale = Math.min(EG_MAX_EXPOSURE_SCALE, Math.max(EG_MIN_EXPOSURE_SCALE, veryDimWhite / EG_REFERENCE_WHITE));
check("extreme underexposure is clamped at the floor scale, not left unbounded", scale === EG_MIN_EXPOSURE_SCALE);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
