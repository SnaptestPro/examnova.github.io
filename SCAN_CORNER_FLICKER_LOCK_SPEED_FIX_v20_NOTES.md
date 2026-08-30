# Scan Sheet — corner-flicker / slow-lock fix (v20)

Reported (Hinglish): "scanning hi jaldi nahi le raha, kabhi ek corner red
ho jaata hai" — auto-scan feels slow to lock on, and one of the 4 corner
boxes sometimes flashes red even while holding the sheet steady.

## Root cause

Two separate things were both making a genuinely well-aligned sheet take
longer than it should to auto-capture:

1. **One bad tick = full reset.** Corner detection runs on a timer tick
   (~130ms). Each tick, all 4 corners must be freshly re-detected from
   scratch — if even ONE corner has a single bad tick (autofocus hunting
   for a frame, a tiny hand-tremor blur, a stray reflection), that
   corner's box turns red and `scannerStableFrames` — the "how many
   consecutive good ticks in a row" counter — resets all the way to 0.
   The sheet never moved; the counter still had to restart from zero.

2. **6-tick trigger, but only a 4-tick averaging window.** Capture only
   fired after 6 consecutive good ticks, but the corner-position
   averaging (`EG_MARKER_HISTORY_SIZE`) only ever keeps the last 4 ticks
   anyway. Ticks 5 and 6 were pure extra waiting with no extra averaging
   benefit — by tick 4 the average window is already full.

## Fix

- **Grace window per corner:** each corner now remembers its own last
  known position for up to 2 ticks (~260ms) after a real detection
  miss. Within that short window it still counts as "found" (using the
  recent position) instead of instantly failing the frame and resetting
  the streak. A corner that's genuinely gone (sheet pulled away, corner
  rotated out of the search box) still ages out and turns red once the
  grace ticks run out — this only smooths single-tick flicker, it does
  not weaken what counts as a valid marker. The underlying square
  detector (`findBlackSquare`'s Otsu threshold + rotation-invariant
  fill-ratio test, from v19) is completely unchanged.
- **Capture trigger dropped from 6 → 4 consecutive good ticks**, matching
  the averaging window size, removing ~260ms of dead waiting per scan
  with no change to how many frames get averaged into the final corner
  position.

Combined effect: on a steady hold, sheets that used to take ~780ms+ (and
often longer, restarting on every flicker) now typically lock in ~520ms
of genuinely steady holding, and a single-tick corner flicker no longer
restarts the count at all.

## What this does NOT change

Detection accuracy is untouched — same Otsu per-region threshold, same
rotation-invariant square-vs-circle test, same 4-point homography and
sharpest-frame capture logic (v7/v8/v10/v19). Camera resolution
(v15, 1440×1920) and detection-tick interval (130ms) are also untouched,
so the earlier hang/perf fixes aren't affected by this change.
