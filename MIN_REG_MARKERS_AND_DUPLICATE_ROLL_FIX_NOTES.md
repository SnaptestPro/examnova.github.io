# Min Registration Markers + Duplicate Roll No (max-marks-wins) — Fix Notes

Admin request (verbatim, paraphrased):
> OMR mein kam se kam 45 mein se 30 registration square blue (detected)
> hone hi chahiye. Ek hi Roll No do students ka nahi ho sakta — isliye
> agar wahi Roll No dobara scan ho, jis attempt mein maximum marks hain
> wahi valid maana jaaye.

Two independent changes in `exam-manager.js`, both scoped to the
Exam Manager scanner.

---

## 1) Minimum registration-marker quality warning

**Where:** `examgrCaptureQualityIssues()` (feeds the existing
`examgr-scan-quality-warn` banner + Retake button — same soft-warning
UI already used for dark photos / unreadable roll digits / high blank
rate. Save is NOT blocked; the admin just gets a clear heads-up before
deciding.)

**What existed before:** the sheet carries a 5×9 = 45-point grid of
small internal registration squares (`OMR_MARKER_XS × OMR_MARKER_YS`).
`egBuildLocalRegistrationField()` already re-detects each one after the
global 4-corner warp to locally correct for a non-flat (folded/creased)
sheet — but it only had a `MIN_POINTS = 8` gate, which controls whether
that LOCAL correction is trusted at all, not whether the capture is good
enough to grade with confidence overall. A capture could clear 8/45 and
still silently grade with most bubble positions extrapolated across a
wide gap from the few markers that were found — exactly where a
mis-warped bubble (and a wrong grade) is most likely.

**Fix:** new constants `EG_TOTAL_REG_MARKERS = 45` and
`EG_MIN_REG_MARKERS_WARN = 30`. `examgrCaptureQualityIssues()` now reads
`detected.map.regFieldPoints.length` (already computed and attached by
`examgrDetectFromCanvas` for the overlay) and adds a warning — "Sirf
X/45 registration squares mil paaye..." — whenever fewer than 30 were
found. Threshold is strictly-less-than 30, so exactly 30/45 passes clean.

**Test:** `test_registration_min_markers_and_duplicate_roll.js`,
scenarios 1–3 (sparse grid warns, exactly-30 doesn't, fully-registered
capture has zero issues).

---

## 2) Duplicate Roll No — automatic max-marks-wins

**Where:** the `examgr-scan-save-btn` click handler, plus a new pure
helper `egResolveDuplicateRoll(dupExisting, newMarks)` placed next to
`examgrGradeSheet`.

**What existed before:** a duplicate Roll No popped a `confirm()` asking
the admin OK (save an extra, separate result anyway) / Cancel (stop and
go check) — a manual judgement call every single time, and choosing OK
left BOTH results sitting in `scanResults`, double-counting that student
in Reports/CSV/leaderboard.

**Fix:** one roll number = one student, full stop. On a duplicate,
`egResolveDuplicateRoll` compares the new scan's marks against the BEST
of the existing duplicate(s) for that roll (handles the edge case of
more than one prior duplicate, e.g. from before this fix shipped) and
returns `{ action: "discard" }` or `{ action: "replace" }`:

- **newMarks ≤ existing best** → `discard`. The new scan is NOT saved.
  Admin sees an `alert()` explaining why and the old (higher/equal
  -marks) result stays canonical. Equal marks discards the new one too
  (existing stays valid — avoids flip-flopping on identical re-scans).
- **newMarks > existing best** → `replace`. Every older duplicate for
  that roll gets deleted (`examgrDeleteResult`, both `scanResults` and
  `scanPhotos` docs, batched) so exactly one result survives, then the
  normal save path proceeds and writes the new (higher-marks) one.

No more confirm() dialog — the rule is now deterministic and automatic,
matching "jisme maximum marks aaya hai wahi manye hoga".

**Test:** `test_registration_min_markers_and_duplicate_roll.js`,
scenarios 4–7 (lower discarded, higher replaces, equal discarded,
compares against the best of several pre-existing duplicates).

---

## Full suite

All 11 `test_*.js` files pass after this change (`node test_*.js` for
each) — no regressions in grading, warp, exposure, or registration
logic.

---

## 3) Detection improvement — Otsu adaptive threshold (so 30/45 is actually reachable)

**Admin request (follow-up):** "scanning mein itna improvement do ki wo
kam se kam 30 ko to detect kar hi le" — the 30/45 warning added above is
only useful if real captures can actually clear it.

**Where:** `findBlackSquare()` — shared by BOTH the live 4-corner
scanner (video frames, `runScannerDetection`) and the post-warp internal
45-marker grid (`findLocalMarkerOffset` → `egBuildLocalRegistrationField`).

**Root cause:** every pixel in the search window was classified
ink-vs-paper with ONE fixed brightness cutoff (`< 68`), the same number
for every region, every capture, every lighting condition. A phone
flash lights the sheet unevenly (near side brighter, far side dimmer),
and a marker sitting in a soft shadow or the dimmer half of an
otherwise-fine photo can have its real ink pixels come out at, say,
75–95 in that capture's exposure — still visibly black, just not `<68`
— so the whole square silently vanished from the blob detector and was
never counted, no matter how solidly it was printed.

**Fix:** `egOtsuThreshold()` — Otsu's method, a standard single
-histogram-pass + 256-step search that picks the brightness threshold
maximising between-class variance for THIS window's own pixels.
Since `findBlackSquare` already only ever looks at one small local
window (a ~52×52 box around one expected marker, or one live corner's
search box), thresholding against that window's own histogram
self-calibrates to whatever lighting that specific patch of the photo
happens to have — same "compare only against itself" philosophy as
`egQuickSharpness` elsewhere in this file. Clamped to `[45, 100]` so a
degenerate window (no real marker in view, e.g. a heavy crop) can't
wander to a nonsensical extreme; 68 (the old fixed value) sits inside
that band as the implicit fallback. Note: Otsu's conventional sweep
treats the "dark" class as `<= t`; `findBlackSquare` classifies with
strict `< threshold`, so the function returns `best + 1` to align the
two — without this a solidly-inked square whose pixels cluster tightly
right at the optimal cut would have that entire boundary cluster
misclassified as paper (caught by the fleet simulation in the test
below going from 45/45 recovered down to a broken partial count during
development).

This only changes ink/paper CLASSIFICATION — the existing shape/fill
-ratio/corner-darkness checks (`squareEnough`, `looksLikeFilledSquare`,
`cornerDarkFraction`) are untouched, so this doesn't reopen the
earlier-fixed false-positive problem (a filled bubble getting mistaken
for a registration square) — it only recovers GENUINE squares that
exposure was hiding from the old fixed cutoff.

**Test:** `test_registration_marker_detection_otsu.js` — synthetic
well-lit / dim-shadowed / washed-out-flash windows (old cutoff misses
the two exposure-shifted ones, new threshold recovers all three,
well-lit case unchanged), a degenerate all-paper window (threshold
stays clamped, doesn't hallucinate a marker), and a 45-marker fleet
simulation mixing all three lighting conditions: **old fixed cutoff
found 15/45 (well below the 30 target), new adaptive threshold found
45/45.**

