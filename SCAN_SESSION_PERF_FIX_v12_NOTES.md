# Scan Sheet — long-session slowdown/hang fix — v12

Follow-up to v11 (`SCAN_MULTI_MARK_AND_PERF_FIX_v11_NOTES.md`), which fixed
the per-capture hang (the `willReadFrequently` GPU-readback stall). This
fix targets a **separate** bug reported the same way ("phone/camera hangs
and gets slower the longer I keep scanning"): a slowdown that gets worse
across a long scanning session, not on any single capture.

## Root cause

Every "Save" on a scanned sheet called:

```js
database.collection(COLLECTION).doc(examId).update({
  results: firebase.firestore.FieldValue.arrayUnion(resultObj),
  scanned: firebase.firestore.FieldValue.increment(1),
  ...
});
```

`results` is a field on the **single exam document**, and it only grows
during a session. Firestore's offline persistence layer has to locally
re-serialize/merge that array on every mutation queued for it — so this
write got measurably heavier the longer a session ran. Scan #80 of a
session did far more client-side work than scan #5, even though each is
nominally "add one small item." Editing or deleting any one result was
worse still: `examgrPersistResults` overwrote the **entire** `results`
array on every single edit/delete, regardless of session length.

This is separate from, and in addition to, the v11 per-frame capture
hang — v11 made every individual capture fast; this fix keeps every
capture equally fast **no matter how many scans came before it in the
same session**.

## Fix

Each scanned result is now its own small document in a `scanResults`
subcollection (`examManagerExams/{examId}/scanResults/{resultId}`) —
the same pattern already used for `scanPhotos`. Changes:

- **Save** (`examgr-scan-save-btn` handler): writes the new result via a
  batched `set()` on its own `scanResults/{resultId}` doc + an
  `increment(1)` on the parent's `scanned` counter, instead of
  `arrayUnion` on a growing array field. O(1) per scan regardless of
  session length.
- **Edit** (`examgrPersistResult`): writes only the one changed result's
  doc, not the whole array.
- **Delete** (`examgrDeleteResult`): batches deleting the result's
  `scanResults` doc + its `scanPhotos` doc + updating `scanned`, in one
  round trip.
- **Link/unlink a student**: also now writes only the one result's doc.
- **Reading results** (Reports, Analysis, CSV export): `ensureExamResultsLoaded`
  lazily fetches the `scanResults` subcollection **once per exam per
  session** and caches it on the exam object (`ex._resultsLoaded`) —
  opening Reports/Analysis/CSV repeatedly, or scanning many more sheets
  afterward, does not re-fetch or redo this work.
- **Migration**: exams scanned before this fix still have their old data
  in the legacy `results` array field. The first time `ensureExamResultsLoaded`
  runs for such an exam, it writes any not-yet-migrated legacy results out
  as individual `scanResults` docs and clears the array field off the
  parent doc — a one-time cost, after which that exam behaves exactly like
  a brand-new one. No historical data is lost; it's merged in either way
  even if the migration write itself fails (non-fatal, retried next time).

`firestore.rules` gained a matching `scanResults` subcollection rule
(admin-only, same as `scanPhotos` — a parent match does not cover a
subcollection).

## What this does NOT change

The camera capture pipeline, homography/warp math, detection thresholds,
and the v11 per-frame fix are all untouched. Grading logic (`pickBest`,
`examgrGradeSheet`) is untouched. Only how/where results are persisted to
Firestore changed — the shape of a single `resultObj` is identical to
before, so existing report rendering, CSV columns, and analysis all work
unchanged once loaded.
