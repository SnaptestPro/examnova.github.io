# Scan Sheet — multi-mark grading + capture performance fix — v11

Two separate bugs reported together (admin, Aug 2026): "Scan Sheet"
sometimes freezes the whole page/phone during capture, and a question
with more than one bubble filled in isn't being marked wrong.

## Bug 1 — multi-marked questions could still score a mark

**Symptom:** a question where the student filled in two (or all four)
options got the blue "double-check this" review ring correctly (that
part — `pickBest`'s "multi" flag — was already working, added in v9).
But if the darkest of the several filled bubbles happened to match the
Answer Key, the question was still counted **correct** and added to the
marks total.

**Root cause:** `pickBest` (unchanged, still correct) returns both a
`value` (its best/darkest guess among the filled options, for display)
and a `flag: "multi"`. `examgrGradeSheet` used `value` for the
correct/wrong comparison but never looked at `flag` at all — the flag
only ever reached the *painting* code (the blue ring), never the
*scoring* code. A multi-marked bubble is a void/invalid response on a
real OMR sheet; it should never earn credit, no matter which one of the
student's several marks happens to line up with the key.

**Fix:** `examgrGradeSheet` now checks `flag === "multi"` before the
letter comparison and forces `status = "wrong"` unconditionally,
regardless of what the darkest pick was. Also tidied the overlay: the
usual pale gold "here's the correct answer" dot is skipped when it would
land exactly on top of the already-red-dotted bubble (only possible now,
when a multi-marked question's darkest pick *was* the correct letter) —
avoids two dots stacked on the same spot.

Manual correction via **Edit** is unaffected either way — the edited
detection object never carries `answerFlags` forward, so a teacher
picking one definitive letter by hand always grades by plain letter
match, as it should.

Verified in `test_multi_mark_grading.js`: the exact reported scenario
(two options filled, darkest pick matches the key) now grades wrong and
doesn't contribute to marks; a multi-marked question whose darkest pick
was already wrong is unaffected (no regression); normal single confident
marks and "faint" single-dot marks are both completely unaffected (only
`"multi"` gets the forced-wrong treatment).

## Bug 2 — capture freezes the page / camera goes unresponsive

**Symptom:** during/after auto-capture, the live camera preview stalls,
the whole page stops responding to touches for a while, and on some
phones this was reported as bad enough that the phone itself felt slow.

**Root cause, part A — `willReadFrequently` requested too late.** Three
canvases in the capture pipeline (`scannerBestRawVideoCanvas`,
`scannerRawVideoCanvas`, `scannerCaptureCanvas`) are read via
`getImageData` several times per capture, and the code already *tried*
to hint that with `getContext("2d", { willReadFrequently: true })` —
but per the Canvas spec, that hint only has an effect on a canvas's
**first ever** `getContext` call; every later call silently ignores it.
Each of these three canvases had its actual first `getContext` call
made *without* the hint, in an earlier `drawImage`-only call, so the
hint requested later (inside `egWarpPerspective` / `examgrDetectFromCanvas`)
did nothing. Every `getImageData` on them — including the single
biggest one, the full native-resolution video frame (up to ~5MP) — was
going through a slow GPU→CPU framebuffer readback instead of a fast
CPU-backed read. That's a well-known, measurable stall on mobile GPUs,
and it blocks the single JS main thread with nothing else able to run
until it finishes — exactly what "freezes/hangs" looks like from the
outside.

**Root cause, part B — 3 redundant full-canvas passes per capture.**
`egWarpPerspective` produced a warped RGB canvas; the caller then ran
`egDesaturateCanvas` (a full `getImageData` → loop → `putImageData` over
the same ~1.85M-pixel canvas) to strip camera colour cast, and then
`examgrDetectFromCanvas` ran `egToGrayscale` (**another** full
`getImageData` over that same canvas) to get the luminance buffer
grading needs. All three passes computed values from the same pixels
using the same 0.299/0.587/0.114 luminance weights — just three separate
times.

**Fix:**
1. Moved the `willReadFrequently: true` hint onto each canvas's actual
   first `getContext` call.
2. `egWarpPerspective`'s existing per-pixel bilinear-sampling loop now
   *also* desaturates (`R=G=B=luminance`) and builds the Float32Array
   grayscale buffer directly, right there — both essentially free since
   every output pixel is already being touched. Returns
   `{ canvas, gray }` instead of a bare canvas; `examgrDetectFromCanvas`
   takes an optional `precomputedGray` and skips its own extraction pass
   when it's supplied. The rare degenerate-homography fallback path
   (near-collinear markers) still desaturates the old way and returns
   `gray: null`, so nothing breaks in that edge case — the caller just
   falls back to computing grayscale itself, same as before this fix.

Net effect: 1 full-resolution `getImageData` (now fast, correctly
CPU-backed) instead of ~4, and 2 fewer full `putImageData`/`getImageData`
round trips on the ~1.85M-pixel capture canvas per attempt — on every
single scan, not just the first.

Verified in `test_warp_fusion_equivalence.js`: the fused grayscale value
differs from the old three-pass value by well under 1 unit (out of
0–255) across a synthetic tilted-homography warp — that gap is just the
old path's two redundant 8-bit roundings, and it's over an order of
magnitude smaller than the detection thresholds (`EG_MARK_THRESHOLD=42`,
`EG_CORE_MIN_FOR_CONFIDENT=20`) that actually decide marked/blank, so it
changes nothing about what gets detected.

## What this does NOT change

`pickBest`, the homography math, the perspective warp's sampling
positions, the corner-detection loop, and every threshold/constant from
v7–v10 are all untouched — this only (a) makes the scoring layer respect
a flag the detection layer was already computing, and (b) removes
duplicate/mis-configured work from the capture pipeline without changing
what it computes. Scan accuracy itself (the v7–v10 work) isn't the
target of this fix and should be unaffected.

## Test files (not part of the shipped app, for review only)

- `test_multi_mark_grading.js` — the Bug 1 fix, including a sanity check
  that the OLD code really did wrongly credit the reported scenario.
- `test_warp_fusion_equivalence.js` — proves the Bug 2 perf refactor is
  numerically equivalent to the old three-pass approach.

Run either with plain `node <file>.js`.
