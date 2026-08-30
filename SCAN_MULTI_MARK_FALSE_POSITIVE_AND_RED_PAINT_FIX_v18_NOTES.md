# Multi-Mark False-Positive + All-Red Paint Fix — v18 Notes

Admin request (verbatim, paraphrased):
> 1. Koi option bhara bhi nahi hota, usko bhi blue circle kar deta hai.
> 2. Agar student ne kisi question ka multiple answer diya ho (jabki
>    answer key mein sirf 1 hi option sahi hai), to uske sab
>    multiple-marked options red circle hone chahiye.

Two independent fixes in `exam-manager.js`, both scoped to the Exam
Manager scanner's `pickBest()` (detection) and `examgrPaintOverlay()`
(review-photo painting).

---

## 1) False "multi" flag on a genuinely blank bubble

**Where:** `pickBest()`, the function that decides whether a question's
answer is a normal confident pick, a faint mark, or a "multi" (two-plus
options both look filled).

**Root cause:** `pickBest` builds its `multiOptions` list using the same
`genuine()` check used to accept a normal SINGLE mark — `broad >
markThreshold && core > coreMinForConfident` (core bar = 20, deliberately
lenient so a real full mark still clears it even in a dim capture). That
bar is fine for the single-best case, but too forgiving to also decide
"a SECOND competing option is genuinely filled too" — a small stray
artifact at a blank bubble's exact centre (dust, a hairline shadow, JPEG
block noise, a light smudge) can nudge just past 20 without any real ink
ever touching that bubble. The result: a completely blank option sitting
next to a real mark got pulled into `multiOptions` and painted with its
own blue "double-check" ring in the review photo — exactly the reported
symptom.

**Fix:** new `genuineForMulti(c)` — same broad check, but requires `core
> coreThreshold` (55, the same "genuinely solid ink" bar already used
elsewhere for the faint-mark fallback) instead of the lenient 20. Only
`aboveThreshold` (the array that decides the "multi" flag) uses this
stricter bar now; the original lenient `genuine()` still decides a
normal single confident pick, completely unchanged. A real second mark
reads with core darkness on the same order as any normal mark (well past
55); a stray-artifact false positive typically only barely nudges past
20 — so this reliably tells them apart without needing to touch anything
else in the detection pipeline (exposure scaling, local registration,
faint fallback all untouched).

**Test:** `test_multi_mark_false_positive_v18.js`, scenarios 1–3 — a
real two-option double-mark still gets flagged (no under-detection, both
a "very bold" and a "moderate but real" double-mark case), and the exact
reported shape (one real mark + one blank-but-smudged option) is
confirmed to have false-positived under the OLD bar and confirmed fixed
under the new one.

---

## 2) Multi-marked wrong question — paint ALL marked options red, not just one

**Where:** `examgrPaintOverlay()`, the `pq.status === "wrong"` branch.

**What existed before:** `examgrGradeSheet` already forces ANY
multi-marked question to "wrong" regardless of which letter matches the
key (fixed earlier — see `SCAN_MULTI_MARK_AND_PERF_FIX_v11_NOTES.md` /
`test_multi_mark_grading.js`). But the PAINTING code never got the same
memo: it only ever put a solid RED dot on `pq.detectedOpt` (pickBest's
single darkest pick among the marked options). Every OTHER option the
student also filled in for that question got nothing but the blue
"double-check" ring — no red, no colour of any kind — which reads as
"this one's fine" at a glance, even though the whole response is void
and every one of those marks is equally wrong.

**Fix:** the "wrong" branch now paints a red dot on every option in
`pq.multiOptions` when the question is a multi-marked one, instead of
only `pq.detectedOpt`. The pale gold "this was the right answer" dot is
correspondingly skipped whenever the correct letter is already one of
the reds (previously only checked against the single `detectedOpt`). A
normal (non-multi) wrong answer is completely unaffected — still exactly
one red dot on the one option that was marked. The blue "please
double-check" ring from the existing multi-flag loop is untouched and
still draws on top of every red dot, same as before.

**Test:** `test_multi_mark_false_positive_v18.js`, scenarios 4–5 (a
multi-marked wrong question paints red on every marked option; a normal
wrong answer still paints exactly one red dot, unaffected).

---

## Full suite

All 12 `test_*.js` files pass after this change (`node test_*.js` for
each) — no regressions in grading, warp, exposure, registration, or the
earlier multi-mark grading logic.

## Version

`sw.js` cache bumped to `examnova-v80-multi-mark-false-positive-fix-20260830`.
