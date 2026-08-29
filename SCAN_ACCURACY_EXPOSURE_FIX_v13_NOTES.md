# Scan Sheet — same-sheet inconsistent results fix — v13

Reported with screenshots: scanning the **exact same physical OMR sheet**
five times in a row (same student, no pen touched between attempts) gave
five different results from the Exam Manager's Scan Sheet screen:

| Attempt | Roll No | Set  | Marks |
|---------|---------|------|-------|
| 1       | ??      | None | 2.0   |
| 2       | ??      | None | 15.0  |
| 3       | ??      | B    | 35.0  |
| 4       | 99      | B    | 63.0  |
| 5       | 99      | B    | 56.0  |

Same sheet, wildly different reads. This is a detection-accuracy bug, not
a UI bug — the underlying bubble-mark detection was inconsistent between
captures.

## Root cause

`examgrDetectFromCanvas`'s bubble-fill test compares each bubble's ink
darkness against its **local** paper-white level (`egWhiteLevelField`,
already adaptive to a shadow or angled light within one photo) using a
handful of **fixed, absolute pixel-brightness constants**:
`EG_MARK_THRESHOLD = 42`, `EG_CORE_MIN_FOR_CONFIDENT = 20`,
`EG_CORE_THRESHOLD = 55`, `EG_CORE_MARGIN = 15`.

Those constants assume every capture comes out equally bright overall.
In practice a phone's auto-exposure/auto-ISO shifts noticeably between
two back-to-back photos of the same sheet — one attempt a little
brighter, the next a little dimmer or flatter (visible directly in the
five screenshots: attempts 4–5 are visibly lighter/washed out than
attempt 1). A phone camera's tone curve and sensor black-level offset
aren't perfectly proportional to scene brightness, so ink doesn't get
darker in lock-step with the paper around it as exposure shifts. The
result: a real, unmistakably-filled bubble's measured darkness delta
could comfortably clear the fixed threshold in one capture and fall just
under it in the next — flipping bubbles between "filled" and "blank"
(and roll-number digits between known and `?`) purely because of that
capture's exposure, not anything the student marked.

## Fix

`egWhiteLevelField` now also returns `.median` — a single scalar summary
of this capture's own overall paper-white level. `examgrDetectFromCanvas`
uses it to compute an `exposureScale` (this capture's median white ÷ a
calibrated reference white of 210, clamped to 0.45–1.15) and scales every
one of the absolute thresholds above by it before running the exact same
comparisons as before. A dimmer capture gets proportionally lower
thresholds — it takes a smaller absolute pixel gap to count as "ink" when
the whole photo is darker to begin with — so the same physical mark reads
the same way regardless of which capture's auto-exposure happened to land
closer to daylight or closer to a dim room. The clamp keeps an extreme,
near-unusable underexposed capture from scaling thresholds down far
enough that sensor noise starts reading as marks.

Nothing about the per-bin local white-level field, the homography/warp
math, or the multi-mark/faint-mark grading rules changed — only the
absolute numbers those comparisons are measured against, and only by a
per-capture scale factor.

## Verified in `test_exposure_adaptive_threshold.js`

Reimplements the old fixed-threshold `genuine()` check side-by-side with
the new exposure-scaled version and confirms: a marginal pen mark that
passes under bright-exposure readings but falls under the fixed threshold
once the same mark is read from a dimmer capture (the exact failure mode
behind the reported bug) is still correctly read as filled by the new
logic; a genuinely blank bubble stays correctly blank at any exposure
level (the fix doesn't make detection more permissive, only more
consistent); and an extreme underexposure is clamped rather than left to
scale thresholds down without bound. Run with plain `node
test_exposure_adaptive_threshold.js`.

## What this does NOT change

Roll-number and Set-letter detection go through the exact same
`pickBest`/`genuine` logic as answer bubbles, so this one fix stabilizes
all three (which matches what was reported — Roll No, Set, and Marks all
varied together). The v11 (per-capture hang) and v12 (session-length
slowdown) fixes are untouched and independent of this one.
