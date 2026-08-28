# Scan Accuracy Fix — v7

## Bug (from screen recording, XRecorder_20260828_02.mp4)

Live "Scan Sheet" repeatedly misread the same physical OMR sheet
differently on almost every auto-capture attempt — Roll No came back as
`46?0?`, then `?????`, then `35???`, then `0`, then `?5?0?` — and each
attempt was also missing a *different* filled bubble (confirmed by
diffing the app's own gold "detected" ring overlay frame-by-frame:
Section 1 Q3-C missing at ~21.5s, Q4-D + Roll digit 1 missing at ~39.5s).
The missed bubbles were consistently among the largest/boldest ink blobs
in that frame (measured 89–109px dark-pixel area vs 32–91px for bubbles
that were read correctly).

## Root cause (confirmed with a standalone test, see below)

`captureAlignedOmr()` turned the 4 detected corner-marker positions into
a single averaged **rectangle**, then did one **axis-aligned**
`ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, ...)`
scale/crop onto the `OMR_CANVAS_SIZE` canvas. That is only correct when
the phone is held perfectly parallel to the sheet. A hand-held phone
almost never is — a real tilt makes the 4 markers form a skewed
quadrilateral (keystoning), not a rectangle, and the further a bubble
sits from a corner, the more its true position diverges from where the
old rectangle-scale assumed it would be.

**`test_warp_integration.js`** builds a synthetic tilted photo with a
mark at a known template coordinate and shows the old rectangle mapping
would have sampled **~34.8px away** from the mark's true position in the
source photo — while the printed bubble radius is only **~9–11px**. That
is enough to land the sample circle entirely off the ink, on blank paper,
for whichever bubbles were unlucky enough to fall in the more-distorted
part of that attempt's tilt. Because hand tremor changes the tilt on
every attempt, a different bubble gets orphaned each time — matching the
video exactly.

## Fixes

1. **True 4-point perspective correction** (`egComputeHomography` +
   `egWarpPerspective`, in place of the old rectangle
   scale/crop in `captureAlignedOmr`). Solves the exact homography from
   the 4 marker correspondences and warps the *whole* raw frame through
   it, pixel-by-pixel with bilinear sampling. This is the primary fix —
   verified in `test_warp_integration.js` to place a mark within <1px of
   its correct template position under a realistic tilt that broke the
   old mapping by 34.8px.

2. **Bubble-sample radius 8 → 10px** (`EG_BUBBLE_RADIUS`), closer to the
   true printed radius (11px) for more tolerance to any residual sub-pixel
   drift, while staying under the 15px half-spacing so it can't bleed
   into a neighbouring bubble.

3. **40th-percentile fill score instead of a plain mean**
   (`egSampleFillScore`) — more forgiving of a mark that's bigger than the
   printed circle and only partially overlaps the sample disk, without
   creating false positives on blank bubbles.

4. **White-level baseline no longer samples inside known bubble
   positions** (`egWhiteLevelField` now takes `excludePoints` /
   `excludeRadius`) — a defensive hardening so a bold/oversized mark can
   never pull down its own "paper white" reference. This is a secondary,
   theory-grounded improvement; a synthetic adversarial test
   (`test_detection_algo.js`) with added shadow gradient + dense
   surrounding text did **not** reproduce a clear old-fails/new-succeeds
   case on its own — the perspective fix above is doing the heavy
   lifting for the specific failure seen in the video. Keeping this
   change anyway since it's a correct, low-risk improvement for real
   photos with genuine lighting gradients or heavier ink.

5. **Replaced the stale capture guard.** The old "sheet too small /
   out of frame" check was computed from the same axis-aligned rectangle
   the perspective fix removes, so it no longer matched what was actually
   being captured. New `egQuadIsSane()` checks the *real* 4-point quad
   directly — all corners inside frame, each side spans a sane fraction
   of the frame, and a shoelace-formula area check to reject
   near-collinear/degenerate marker reads (also catches two corners
   accidentally detected in swapped slots). Verified against 6 cases
   (realistic tilt, flat rectangle, collapsed points, off-frame corner,
   swapped slots, sheet-too-small) — all behaved as expected.

## v8 update (from re-analysis of the SAME video, XRecorder_20260828_02.mp4)

Re-watching the recording frame-by-frame after v7 shipped: the gold
"detected mark" ring the app paints on Roll No / Set / question bubbles
(painted at the *fixed template pixel* every bubble is supposed to warp
to) is visibly **off-centre from the real printed bubble in the photo**,
by a different amount on different attempts — even though v7's homography
math is correct. That means the *input* to the homography (the 4 corner
positions) still had a few pixels of noise: `captureAlignedOmr` was being
fed whichever single video frame happened to be on-screen the instant
`scannerStableFrames` first reached 6. A hand held "steady" still trembles
a few pixels frame-to-frame, and one noisy frame → one noisy (but
otherwise mathematically perfect) warp.

**Fix:** `runScannerDetection` now keeps a rolling window of the last
`EG_MARKER_HISTORY_SIZE` (4) consecutive "all-4-found" frames' corner
positions and averages them (`egAverageMarkerFrames`) instead of using
only the last frame. Random tremor partly cancels out in the average; a
genuinely mis-held sheet still reads as mis-held (a ~0.5s averaging
window doesn't meaningfully lag a real, deliberate movement).

Verified in `test_temporal_smoothing.js`: 2000 randomized "steady hold
with realistic tremor" trials, sampling 4 bubble positions scattered
across the sheet (including the far-from-every-corner ones that v7's own
notes above already flagged as the highest-risk spots) — averaging cut
the mean corner-to-bubble sampling error roughly in half and the
worst-case error by a similar margin.

This is a reduction in error, not a mathematical elimination of it —
tremor is still there, just averaged down. It stacks with, not replaces,
the v7 perspective fix.

## v9 update (from a captured scan screenshot, 14272.jpg)

Three more things noticed on a real captured sheet after v8:

1. **A completely blank bubble (Q94) got a gold "detected" dot.** The
   broad 40th-percentile coverage check (radius 9) was apparently
   triggered by something OTHER than a real fill covering a chunk of the
   sample disk — possibly the printed ring's own edge under a bit of
   residual misalignment, bleed from a nearby label, a shadow. The exact
   source is hard to pin down from a screenshot, but the true bubble
   centre was untouched paper.
2. **A light dot/tick mark instead of full shading (Q20/21/23) wasn't
   detected at all.** The 40th-percentile check needs ~40%+ of the
   bubble's area to be dark; a small centred dot never gets there, so it
   scores almost identically to a genuinely empty bubble.
3. **Two options both solidly filled for the same question** (a real
   multiple-answer mistake) — the app silently picked whichever was
   darker, with nothing on the photo to show a teacher this needs a
   second look.

**Fix — `pickBest` now does three things instead of one:**
- A confident mark now requires BOTH the existing broad-coverage check
  AND a small inner "core" sample (radius 4) to be genuinely dark. A
  real pencil/pen fill darkens the centre every time; something covering
  the disk's edge/outer area without touching the centre (ring edge,
  nearby text, shadow, dust) no longer passes as "marked".
- If nothing passes the broad check, a fallback pass checks that same
  small core in isolation with a higher, stricter threshold — this is
  what catches a genuine light dot/tick that never covered enough of the
  full bubble. Anything picked up this way is flagged `"faint"`.
- If two or more options both pass the confident check, the question is
  flagged `"multi"` instead of silently resolving to the darker one.
- Sample radius also nudged 10 → 9, for a little extra headroom against
  the printed ring's own ink (22px bubble, 1.7px stroke → ring ink starts
  at radius ~10.15).

Both flags are painted straight onto the reviewed photo as a **blue
outline ring** around the relevant bubble(s) — drawn on top of, never
instead of, the normal green/red/gold grading dot — so a teacher spots
"double-check this one" at a glance during Save, instead of the app
silently guessing (or silently missing it) either way.

Verified in `test_faint_multi_marks.js`: a normal full mark still reads
normally; a small dot mark is now caught and flagged faint; two filled
options are flagged multi with both captured; and a synthetic
"broad-triggers-but-centre-is-blank" bubble (standing in for whatever
caused the Q94 misread) is correctly kept blank once the core check is
added, whereas the old broad-only logic would have called it marked.

**Honesty note (same spirit as v7/v8):** the "faint" and "multi" flags
are a review aid, not a mind-reader — they turn a silent
guess-or-miss into a visible "look at this one," which is the safest
thing the app can do when a mark is genuinely ambiguous even to a human
glancing at it quickly.

## Honesty note

No camera-based OMR pipeline can be mathematically guaranteed 100% under
every real-world condition (extreme blur, torn/folded paper, very faint
pencil, etc.). This fix directly targets and should resolve the specific,
reproducible failure pattern demonstrated in the video (tilt-driven
misalignment causing inconsistent bubble/roll-number misses). Please
re-test with a few real hand-held scans, including some deliberately
tilted ones, before treating this as final.

## Test files (not part of the shipped app, for review only)

- `test_homography.js` — unit tests for the homography math itself.
- `test_warp_integration.js` — end-to-end tilt-correction proof (the
  34.8px vs <1px comparison above).
- `test_detection_algo.js` — old vs new detection scoring comparison.
- `test_temporal_smoothing.js` — v8: single-last-frame vs averaged-last-4
  -frames corner error comparison under simulated hand tremor.
- `test_faint_multi_marks.js` — v9: faint-mark fallback, multi-mark
  flagging, and the core-confirmation gate against a false-positive.

Run any of them with plain `node <file>.js`.
