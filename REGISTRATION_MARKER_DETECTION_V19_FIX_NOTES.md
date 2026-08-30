# Registration Marker Detection — v19 Rotation-Invariance Fix

Admin report (verbatim, paraphrased):
> "ye max to max 14/15 black square ko hi detect kar pata hai jo aachi
> bat nahi hai, kam se kam 30 to hona hi chahiye chahe kuch bhi karo."

The earlier Otsu adaptive-threshold fix (see
`MIN_REG_MARKERS_AND_DUPLICATE_ROLL_FIX_NOTES.md`, section 3) already
solved the EXPOSURE half of this problem — but real scans were still
stuck around 14-15/45, exactly matching that fix's own "OLD" baseline
number. That pointed at a second, independent bottleneck in
`findBlackSquare()` that exposure fixes alone couldn't touch.

## Root cause

`findBlackSquare()`'s square-vs-circle test compared each candidate
blob's 4 **axis-aligned bounding-box corners** against a darkness
cutoff — a solid axis-aligned square fills its whole bbox (corners
dark), a filled circle (a marked answer bubble) only covers ~79% of its
bbox and leaves the corners bare. That test **assumes the square is not
rotated**.

But the entire reason the internal 45-marker grid exists is that a real
handled sheet is gently bent in 3-D — folded to fit a bag, creased down
the middle. A marker sitting near a fold can land 10-20° off-axis even
after the global 4-corner perspective warp. Measured directly:

| rotation | old corner-darkness score |
|---|---|
| 0°  | 1.00 |
| 5°  | 0.75 |
| 10° | 0.25 |
| 15° | 0.00 |

By 15° a genuinely-printed, perfectly solid square reads **identically
to a circle** on this test (both ~0) — the bounding-box corners of a
rotated square sit near its *edge midpoints*, not the ink. So every
marker with any real-world tilt was being silently thrown out, capping
detection at whatever fraction of the grid happened to still be
dead-flat — matching the reported 14-15/45.

## Fix

Replaced the bbox-corner test with a **rotation-invariant** shape
descriptor: fill ratio against the blob's own minimum enclosing circle
(radius = farthest ink pixel from the blob's centroid), instead of its
axis-aligned bounding box.

- A square (side *s*) inscribed in a circle of radius *s·√2/2* fills a
  **constant** 2/π ≈ 0.637 of that circle's area, regardless of how the
  square is rotated — spinning a square about its own centre doesn't
  change "distance from centre to farthest corner."
- A filled circle fills ~1.0 of its own enclosing circle, by
  definition — nowhere near the square's ~0.64, and likewise unaffected
  by rotation.

Verified against a discretised 20px square swept through 0–45°: ratio
stays in a tight **0.66–0.75** band throughout, vs. **0.98–1.01** for an
equivalent filled circle. Accepted range used in code: **0.48–0.85** —
a wide margin on both sides that still comfortably separates the two
shapes even with pixelation noise at smaller marker sizes.

Two smaller supporting changes, same file:

- **Search window widened** (`findLocalMarkerOffset`): 26px → 32px half
  -window, and the accepted-offset cap 18px → 24px, so a marker that has
  drifted further from its template position (larger local paper
  warp/tilt near a crease) is still inside the search box in the first
  place. Still far under half the marker spacing (150-240px), so this
  can't get confused with a neighbouring marker.
- The old axis-aligned size/aspect sanity gate (big enough, not
  swallowing half the window, not a sliver) is kept as a coarse
  pre-filter — it's rotation-safe on its own, since rotating a *square*
  keeps its own bounding box square too.

## What did NOT change

- The Otsu adaptive-threshold ink/paper classification from the earlier
  fix is untouched — this fix is purely about the shape test that runs
  *after* thresholding.
- `EG_MIN_REG_MARKERS_WARN = 30` / `EG_TOTAL_REG_MARKERS = 45` and the
  quality-warning banner are unchanged.

## Test

`test_registration_marker_v19_rotation_shadow.js` — squares rotated
0°–30° (all now detected, including combined with dim/washed-out
exposure), a directional-shadow square (one softened corner), a
regression guard confirming filled circles of several sizes are still
correctly rejected (including under the same directional lighting
gradient), and a 45-marker fleet simulation mixing rotation + shadow +
exposure conditions together: **all 45/45 recovered** (target was
≥30/45).

Full suite: all `test_*.js` files pass after this change, no
regressions in grading, warp, exposure, or the earlier registration
logic.

## Cache/version bump

Since the app is a PWA with a service-worker cache, bumped
`exam-manager.js?v=4` → `?v=5` in `index.html` and the service-worker
`CACHE_NAME` in `sw.js` so devices actually pick up this build instead
of continuing to serve a cached copy of the old script. **If a device
was already showing the old 14-15/45 behaviour, a hard-refresh /
reinstall may still be needed once** for the new service-worker version
to take over.
