// Test for the registration-marker detection improvement in
// findBlackSquare() (see MIN_REG_MARKERS_AND_DUPLICATE_ROLL_FIX_NOTES.md).
//
// Admin request (verbatim, paraphrased): "scanning improve karo taaki
// kam se kam 30/45 registration squares to detect ho hi jaayein."
//
// Root cause: findBlackSquare() classified a pixel as "ink" using ONE
// fixed brightness cutoff (<68) for every region it ever looked at. A
// phone flash lights the sheet unevenly (near side brighter, far side
// dimmer), and a marker sitting in a soft shadow or the dimmer half of
// an otherwise fine photo can have its actual ink pixels come out at,
// say, 75-90 — still visibly black to a person, but not <68 in THIS
// capture's exposure — so the whole square silently vanished from the
// blob detector and never got counted at all.
//
// Fix: Otsu's method picks the brightness threshold that best splits
// EACH small search window's own pixels into two groups (ink vs paper),
// self-calibrating to whatever that specific patch of the photo's
// lighting happens to be — the same "compare only against itself"
// approach already used elsewhere in this codebase (egQuickSharpness).
//
// This file ports egOtsuThreshold + the darkness-classification half of
// findBlackSquare EXACTLY as fixed in exam-manager.js (same convention
// as the project's other test_*.js files) and checks detection under
// synthetic lighting conditions built to reproduce the reported miss.

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ok  - ${label}`); }
  else { failed++; console.log(`  FAIL - ${label}`); }
}

// ---- Ported verbatim from exam-manager.js (post-fix) ----
function egOtsuThreshold(brightness, count) {
  const hist = new Float64Array(256);
  for (let i = 0; i < count; i++) hist[brightness[i] < 0 ? 0 : (brightness[i] > 255 ? 255 : brightness[i] | 0)]++;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let wB = 0, sumB = 0, best = 68, bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = count - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const diff = mB - mF;
    const varBetween = wB * wF * diff * diff;
    if (varBetween > bestVar) { bestVar = varBetween; best = t; }
  }
  return Math.min(100, Math.max(45, best + 1));
}

// ---- The OLD (fixed-cutoff) classifier, kept here only to prove the
// scenarios below really would have missed the square before the fix ----
function classifyOld(brightness, count) {
  const dark = new Uint8Array(count);
  let darkCount = 0;
  for (let i = 0; i < count; i++) if (brightness[i] < 68) { dark[i] = 1; darkCount++; }
  return { dark, darkCount };
}

function classifyNew(brightness, count) {
  const threshold = egOtsuThreshold(brightness, count);
  const dark = new Uint8Array(count);
  let darkCount = 0;
  for (let i = 0; i < count; i++) if (brightness[i] < threshold) { dark[i] = 1; darkCount++; }
  return { dark, darkCount, threshold };
}

// Builds a WxH window with a SxS "ink" square at (sx, sy) painted at
// inkBrightness, everything else at paperBrightness — a synthetic stand
// -in for one findBlackSquare() search window around one expected marker.
function buildWindow(W, H, sx, sy, S, inkBrightness, paperBrightness) {
  const brightness = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isInk = x >= sx && x < sx + S && y >= sy && y < sy + S;
      brightness[y * W + x] = isInk ? inkBrightness : paperBrightness;
    }
  }
  return brightness;
}

const W = 52, H = 52, S = 20, sx = 16, sy = 16; // 20x20 marker centred-ish in a 52x52 window

// ──────────────────────────────────────────────────────────────
// Scenario 1 — normal, well-lit capture (deep black ink ~30, bright
// paper ~220). Both OLD and NEW must find the full 20x20=400 ink block
// — the fix must NOT change the easy, already-working case.
// ──────────────────────────────────────────────────────────────
{
  const b = buildWindow(W, H, sx, sy, S, 30, 220);
  const count = W * H;
  const oldR = classifyOld(b, count);
  const newR = classifyNew(b, count);
  check("well-lit: OLD finds the full ink block", oldR.darkCount === S * S);
  check("well-lit: NEW finds the full ink block (no regression)", newR.darkCount === S * S);
}

// ──────────────────────────────────────────────────────────────
// Scenario 2 — the actual reported failure mode: a dim/shadowed patch
// where ink comes out at 78 (still clearly darker than the 150 paper
// around it, just not <68). OLD must MISS it entirely (proving this
// scenario reproduces the real bug); NEW must find it via Otsu.
// ──────────────────────────────────────────────────────────────
{
  const b = buildWindow(W, H, sx, sy, S, 78, 150);
  const count = W * H;
  const oldR = classifyOld(b, count);
  const newR = classifyNew(b, count);
  check("dim/shadowed marker: OLD misses it (darkCount stays 0) — reproduces the bug", oldR.darkCount === 0);
  check("dim/shadowed marker: NEW recovers the full ink block via Otsu", newR.darkCount === S * S);
}

// ──────────────────────────────────────────────────────────────
// Scenario 3 — bright/washed-out flash hotspot: paper reads ~235, ink
// still relatively darker at ~95 (flash partly washes out the black
// too). Same failure mode, different exposure direction.
// ──────────────────────────────────────────────────────────────
{
  const b = buildWindow(W, H, sx, sy, S, 95, 235);
  const count = W * H;
  const oldR = classifyOld(b, count);
  const newR = classifyNew(b, count);
  check("washed-out flash hotspot: OLD misses it", oldR.darkCount === 0);
  check("washed-out flash hotspot: NEW recovers it via Otsu", newR.darkCount === S * S);
}

// ──────────────────────────────────────────────────────────────
// Scenario 4 — degenerate window with NO real marker in view (e.g. a
// heavy crop that cut off this part of the sheet, or a badly missing
// corner) — near-uniform paper, no real bimodal split. Otsu must NOT
// invent a marker out of pure noise; the clamp keeps it from wandering
// to an extreme, and no component should pass the (separately-enforced,
// unchanged) square/fill-ratio shape checks in findBlackSquare.
// ──────────────────────────────────────────────────────────────
{
  const count = W * H;
  const b = new Float64Array(count);
  for (let i = 0; i < count; i++) b[i] = 210 + (i % 5); // near-uniform paper, tiny noise
  const newR = classifyNew(b, count);
  check("degenerate all-paper window: threshold stays clamped, not wandering to paper's own level", newR.threshold <= 100 && newR.threshold >= 45);
  check("degenerate all-paper window: doesn't classify most of a uniform patch as ink", newR.darkCount < count * 0.5);
}

// ──────────────────────────────────────────────────────────────
// Scenario 5 — full 45-marker grid simulation: mix of well-lit, dim
// -shadowed, and washed-out markers (reflecting a real uneven-flash
// capture) — checks the fleet-wide recovery rate the admin actually
// cares about (>=30/45 was the ask).
// ──────────────────────────────────────────────────────────────
{
  const scenarios = [];
  for (let i = 0; i < 45; i++) {
    // Round-robin through a few lighting conditions across the grid, as
    // a real flash gradient/shadow would vary marker-to-marker.
    const kind = i % 3;
    if (kind === 0) scenarios.push([30, 220]);  // well-lit
    else if (kind === 1) scenarios.push([78, 150]); // dim/shadowed
    else scenarios.push([95, 235]); // washed-out
  }
  let oldFound = 0, newFound = 0;
  for (const [ink, paper] of scenarios) {
    const b = buildWindow(W, H, sx, sy, S, ink, paper);
    const count = W * H;
    if (classifyOld(b, count).darkCount >= S * S * 0.9) oldFound++;
    if (classifyNew(b, count).darkCount >= S * S * 0.9) newFound++;
  }
  console.log(`  (fleet sim) OLD found ${oldFound}/45, NEW found ${newFound}/45`);
  check("fleet-wide: OLD falls short of the 30/45 requirement under mixed lighting", oldFound < 30);
  check("fleet-wide: NEW clears the 30/45 requirement under the same mixed lighting", newFound >= 30);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
