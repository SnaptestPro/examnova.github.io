# Scan Sheet — still-inconsistent-results fix (v14) + camera-resolution hang fix (v15)

Reported on 2026-08-29, with screenshots, AFTER v13 (whole-photo exposure
scaling) was already live in this build:

| Attempt | Roll No | Set  | Marks |
|---------|---------|------|-------|
| 1       | 99      | B    | 55.0  |
| 2       | ??      | None | 1.0   |
| 3       | 00      | None | 33.0  |
| 4       | ??      | None | 18.0  |

Same physical sheet, same short session — this is the same failure v13
was written to fix, still happening. Also reported in the same message:
"3-4 scans ke baad app hang ho jaata hai, camera scanning slow ho jaati
hai, mobile kaam karna band kar deta hai" — a second, separate bug.

## Bug 1 — accuracy: v13's fix was whole-photo, the problem is within-one-photo

v13 correctly diagnosed that a phone's auto-exposure varies BETWEEN
separate captures of the same sheet, and fixed that by scaling every
absolute mark-detection threshold by `whiteField.median` — ONE number
summarizing the WHOLE photo's paper-white level.

Looking at attempt 1's screenshot directly: the first several rows (Roll
No, Exam Set, ~Q1-40) are graded cleanly (green/red dots line up one per
question), then starting partway down the SAME single photo, a
contiguous block of rows turns into dense clusters of 2-4 options all
lighting up per question (flagged "multi", forced wrong). That is not a
capture-to-capture problem — it is two different regions of ONE capture
disagreeing with each other. A hand-held phone scanning with its own
flash held close to the paper does not light the sheet evenly: the part
of the sheet nearer the flash/lens reads brighter (and lower-contrast —
a close flash partly washes out ink too) than the far part, in the same
shot. `whiteField.median` — a single whole-image number — cannot correct
a gradient that exists WITHIN the image it's summarizing; it can only
correct the image as a whole being uniformly brighter or dimmer.

The other two bad attempts (Roll ?? / Marks 1.0 and 18.0) show the other
side of the same coin: when a region's own true local white differs a
lot from the whole-photo median, a threshold calibrated to the median is
wrong for that region either way — too high (misses real marks, which is
what "almost nothing detected" looks like) if that region is dimmer than
the photo's overall median, or too low (false "multi" flags, which is
what the dense clusters in attempt 1 look like) if that region is
brighter than the median.

### Fix

`egWhiteLevelField` already computes a LOCAL paper-white value per bin
across the photo (`whiteField.at(x, y)`) — it was built for exactly this
reason (a shadow or angled light across the photo), and `darkAt()`
already uses it as the per-bubble reference for how dark that bubble's
ink reads. The one piece that was still a single whole-photo number was
the *threshold* — how big that darkness delta has to be to count as
"filled". `exposureScaleAt(x, y)` now derives the exposure scale from
`whiteField.at(x, y)` — THIS bubble's own local bin — instead of from
`whiteField.median` — the whole photo. Every bubble on the sheet now gets
its own threshold matched to its own local lighting, so a bright patch
near the flash and a dimmer patch farther away are each judged against
what "filled" actually looks like in that specific patch, in the same
single capture. `whiteField.median` is no longer used for thresholding at
all (still computed and available, just not part of this decision
anymore).

Nothing about the local white-level bins themselves, the homography/warp
math, or the multi-mark/faint-mark grading rules changed — only WHICH of
the two already-computed white-level numbers (whole-photo median vs. this
bubble's own local bin) the threshold scale is drawn from.

### Verified in `test_local_exposure_v14.js`

Simulates one capture with a brighter region and a dimmer region (same
photo) and confirms: a real, moderately-inked mark in the dimmer region
that the old whole-photo scale would miss is correctly read as filled by
the new local scale; a blank bubble/print artifact in the brighter region
that the old whole-photo scale would wrongly flag as filled is correctly
left blank by the new local scale; and an easy, unambiguous, fully-shaded
mark reads identically under both methods (the fix doesn't change easy
cases, only the marginal/regional ones). Run with plain `node
test_local_exposure_v14.js`. All pre-existing tests
(`test_exposure_adaptive_threshold.js`, `test_faint_multi_marks.js`,
`test_multi_mark_grading.js`, `test_warp_integration.js`,
`test_warp_fusion_equivalence.js`, `test_temporal_smoothing.js`,
`test_homography.js`, `test_detection_algo.js`) still pass unchanged.

### One thing this does NOT fix

A sufficiently blurry or badly washed-out capture (heavy hand-shake, or
flash glare covering most of the frame rather than one edge of it) can
still come out poorly — no threshold tuning recovers ink-vs-paper
contrast that motion blur or glare has already destroyed at the pixel
level. The "sharpest of the last few steady frames" logic (v10) already
picks the best available frame from the steady streak; if every frame in
that streak is still blurry/glared, holding the phone a little steadier
or a little farther back (so the flash doesn't hit the paper at as steep
an angle) will help more than any software change here can.

## Bug 2 — the hang/slowdown: camera resolution was too heavy to sustain

`startScannerCamera` was requesting `{ width: { ideal: 1920 }, height:
{ ideal: 2560 } }` (~4.9 MP) from `getUserMedia`. That is a CONTINUOUS
video stream, not a one-off photo — the phone's camera ISP has to keep
producing frames at whatever resolution it negotiates for the entire
time the Scan Sheet screen stays open, not just at the capture instant.
On a mid/low-end Android phone, sustaining a near-5 MP video stream is
real, ongoing CPU/ISP/heat load — which matches "camera scanning slow ho
jaati hai" getting WORSE the longer the session runs (a running cost,
not a one-time one) far better than a one-off memory leak would (a
per-scan leak would make scan #10 slightly worse than scan #9; a
sustained-streaming cost makes the WHOLE PHONE feel slower the longer the
stream has been running, which is what "poora hang ho jaata hai" — not
just this page — describes). Every full-resolution capture downstream
(`egWarpPerspective`'s `getImageData` + its ~1.85M-iteration warp loop)
also scales directly with whatever resolution actually got negotiated, so
the bigger request made every single scan's processing pause heavier too,
compounding the same symptom on top of the sustained streaming cost.

### Fix

Dialled back to `{ width: { ideal: 1440 }, height: { ideal: 1920 } }`
(~2.76 MP) — same 3:4 ratio as the 1920×2560 request, so the aspect-match
to `OMR_CANVAS_SIZE` (1203×1536) that motivated the original bump is
unchanged — but roughly 44% fewer pixels to sustain continuously and to
process per capture. 1440×1920 is still a comfortable ~20-25% MORE detail
than the 1203×1536 output actually uses, so bubble-edge sharpness after
the warp is unaffected; it just stops asking the camera hardware to
sustain roughly double the pixels it needs for no visible benefit.
Still `"ideal"`, not `"exact"` — a phone that can't hit even this lower
number still won't fail to open the camera, it just gets whatever max it
can.

### What this does NOT change

The v11 (per-frame hang), v12 (session-length Firestore write cost), and
v13/v14 (detection-threshold) fixes are all independent of this and
untouched. This only changes the resolution requested from the camera.
