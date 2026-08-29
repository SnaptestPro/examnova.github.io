// Test for the v14 fix (see SCAN_ACCURACY_LOCAL_EXPOSURE_FIX_v14_NOTES.md
// and the comment block above exposureScaleAt() in exam-manager.js).
//
// Reported bug (screenshots, 2026-08-29): scanning the SAME physical sheet
// repeatedly, in the SAME short session, still gave wildly different
// results after the v13 (whole-photo exposure scale) fix was already live
// — Marks 1.0, 18.0, 33.0, 55.0 across four back-to-back attempts, Roll No
// flipping between "??"/"00"/"99". Crucially, within the SAME capture the
// first several rows graded cleanly while a later block of rows turned
// into "multi mark" clusters — a within-one-photo regional problem, which
// a single whole-photo exposureScale (v13) cannot fix, since v13 only
// corrects capture-to-capture brightness shifts.
//
// This test simulates one capture with TWO regions of different local
// paper-white (a hand-held phone + its own flash lighting one part of the
// sheet brighter than another, in the same shot) and checks that:
//  - a real, moderately-inked mark sitting in the DIMMER region is missed
//    by a single whole-photo (global-median) scale but correctly read as
//    filled once the scale is taken from that bubble's own local bin
//  - a blank bubble/print-artifact sitting in the BRIGHTER region is
//    wrongly flagged as filled by the global scale but correctly stays
//    blank once the scale is local
//  - a straightforward, well-lit, clearly-filled mark keeps reading
//    exactly the same either way (the fix doesn't change easy cases)

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

function scaleFor(whiteLevel) {
  return Math.min(EG_MAX_EXPOSURE_SCALE, Math.max(EG_MIN_EXPOSURE_SCALE, whiteLevel / EG_REFERENCE_WHITE));
}

// v13-style: ONE scale for the whole capture, from the whole-image median.
function globalGenuine(broad, core, wholeImageMedianWhite) {
  const scale = scaleFor(wholeImageMedianWhite);
  return broad > EG_MARK_THRESHOLD * scale && core > EG_CORE_MIN_FOR_CONFIDENT * scale;
}

// v14: scale from THIS bubble's own local bin white level.
function localGenuine(broad, core, localBinWhite) {
  const scale = scaleFor(localBinWhite);
  return broad > EG_MARK_THRESHOLD * scale && core > EG_CORE_MIN_FOR_CONFIDENT * scale;
}

// ── Simulated capture: one photo, two regions ──
// Bright region (near the flash/lens) — local paper white 226.
// Dim region (far edge of the sheet, same single photo) — local white 150.
// Whole-photo median (what v13 uses) sits roughly between the two, and
// naturally skews toward whichever region has more of the sheet's area —
// here most of the sheet is the well-lit region, so the median lands near
// it, at 205 (close to EG_REFERENCE_WHITE — an ordinary, unremarkable-
// looking "overall" exposure reading that hides the gradient underneath).
const brightRegionWhite = 226;
const dimRegionWhite = 150;
const wholeImageMedian = 205;

// ── Case 1: real, moderately-inked mark sitting in the DIM region.
// Ink isn't jet-black (ordinary pencil, not fresh dark pen), so the delta
// is only moderate relative to that region's own (lower) white level. ──
const dimMarkInk = 110;
const dimMarkBroad = dimRegionWhite - dimMarkInk; // 40
const dimMarkCore = dimMarkBroad;
check("dim-region mark: global whole-photo scale MISSES this real mark (the bug)",
  !globalGenuine(dimMarkBroad, dimMarkCore, wholeImageMedian));
check("dim-region mark: local per-bubble scale correctly reads it as filled (the fix)",
  localGenuine(dimMarkBroad, dimMarkCore, dimRegionWhite));

// ── Case 2: a blank bubble / print-ring artifact sitting in the BRIGHT
// region. A brighter region needs a proportionally bigger delta to count
// as real ink — a fixed/global threshold calibrated near the sheet's
// dimmer overall median is too LOW for this brighter region, so an
// ordinary printed-ring artifact crosses it. ──
const brightArtifactDelta = 43; // clears the (too-low-for-this-region) global threshold (~41) but not the local one (~45)
check("bright-region blank/artifact: global scale WRONGLY reads this as filled (the bug)",
  globalGenuine(brightArtifactDelta, brightArtifactDelta, wholeImageMedian));
check("bright-region blank/artifact: local scale correctly rejects it as blank (the fix)",
  !localGenuine(brightArtifactDelta, brightArtifactDelta, brightRegionWhite));

// ── Case 3: sanity — an easy, unambiguous, fully-shaded mark in the
// bright region must still read as filled under BOTH methods. The fix
// must only correct the marginal/artifact cases above, not disturb the
// easy ones. ──
const easyBroad = brightRegionWhite - 20; // 206, miles clear of any threshold
check("easy fully-shaded mark: global scale reads it filled (unaffected)",
  globalGenuine(easyBroad, easyBroad, wholeImageMedian));
check("easy fully-shaded mark: local scale also reads it filled (unaffected)",
  localGenuine(easyBroad, easyBroad, brightRegionWhite));

// ── Case 4: net effect on a whole question — with the OLD (global) method
// this exact combination (dim real mark + bright artifact both misjudged
// at once) is precisely what produces the reported clusters: a genuinely
// marked option reads blank while an unmarked option nearby reads filled,
// or several options in a bright patch all cross the same too-low global
// line together ("multi" false-positive). The local method keeps them
// correctly separated. ──
check("net effect: with local scaling, the real dim-region mark and the bright-region artifact are told apart correctly",
  localGenuine(dimMarkBroad, dimMarkCore, dimRegionWhite) && !localGenuine(brightArtifactDelta, brightArtifactDelta, brightRegionWhite));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
