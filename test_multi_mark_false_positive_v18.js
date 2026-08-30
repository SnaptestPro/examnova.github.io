// v18 fix check — two reported problems from a real review session:
//
//  1. A completely BLANK bubble sitting next to a student's real,
//     solidly-filled mark was getting scooped into `multiOptions` too —
//     and painted with its own blue "double-check" ring in the review
//     overlay — purely because a small stray artifact (dust, a shadow,
//     JPEG noise, a light smudge) at that blank bubble's centre happened
//     to clear the same LENIENT core bar (`coreMinForConfident`, 20)
//     used to accept a normal single mark. Fix: membership in the MULTI
//     set now requires a STRICTER bar (`coreThreshold`, 55 — the same
//     "genuinely solid ink" bar already used for the faint-mark
//     fallback), while the single-best-pick bar is untouched.
//
//  2. In the review overlay, a multi-marked question (graded "wrong"
//     unconditionally) only ever painted a RED dot on pickBest's single
//     darkest pick — every OTHER option the student also filled in got
//     nothing but a blue ring, no colour, which looks like "this one's
//     fine" at a glance. Fix: every option in `multiOptions` now gets
//     its own red dot when the question is graded wrong.
//
// This file ports pickBest EXACTLY as fixed in exam-manager.js (same
// convention as test_faint_multi_marks.js / test_detection_algo.js —
// including the v14 local-exposure scaling, unlike the older, simpler
// test_faint_multi_marks.js port) plus a small pure helper mirroring the
// new "which options get painted red" logic from examgrPaintOverlay.

const W = 1203, H = 1536;

function drawDisk(buf, cx, cy, r, val) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      buf[y * W + x] = val;
    }
  }
}
function drawRing(buf, cx, cy, rIn, rOut, val) {
  for (let a = 0; a < 2880; a++) {
    const rad = (a * Math.PI) / 1440;
    for (let rr = rIn; rr <= rOut; rr += 0.25) {
      const x = Math.round(cx + rr * Math.cos(rad)), y = Math.round(cy + rr * Math.sin(rad));
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      buf[y * W + x] = val;
    }
  }
}

// ---- Ported verbatim from exam-manager.js ----
function egWhiteLevelField(gray, w, h, binsX, binsY, excludePoints, excludeRadius) {
  const exR2 = excludeRadius * excludeRadius;
  const field = [];
  const binW = Math.ceil(w / binsX), binH = Math.ceil(h / binsY);
  for (let by = 0; by < binsY; by++) {
    const row = [];
    for (let bx = 0; bx < binsX; bx++) {
      const x0 = bx * binW, x1 = Math.min(w, x0 + binW);
      const y0 = by * binH, y1 = Math.min(h, y0 + binH);
      const localEx = excludePoints.filter(p => p.x >= x0 - excludeRadius && p.x <= x1 + excludeRadius && p.y >= y0 - excludeRadius && p.y <= y1 + excludeRadius);
      const samples = [];
      for (let y = y0; y < y1; y += 3) {
        for (let x = x0; x < x1; x += 3) {
          let skip = false;
          for (let i = 0; i < localEx.length; i++) {
            const dx = x - localEx[i].x, dy = y - localEx[i].y;
            if (dx * dx + dy * dy <= exR2) { skip = true; break; }
          }
          if (!skip) samples.push(gray[y * w + x]);
        }
      }
      samples.sort((a, b) => a - b);
      row.push(samples.length ? samples[Math.floor(samples.length * 0.85)] : 200);
    }
    field.push(row);
  }
  const flatWhites = field.flat().slice().sort((a, b) => a - b);
  const median = flatWhites.length ? flatWhites[Math.floor(flatWhites.length / 2)] : 200;
  return {
    field, binW, binH, binsX, binsY, median,
    at(x, y) {
      const fx = Math.min(this.binsX - 1, Math.max(0, x / this.binW - 0.5));
      const fy = Math.min(this.binsY - 1, Math.max(0, y / this.binH - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(this.binsX - 1, x0 + 1), y1 = Math.min(this.binsY - 1, y0 + 1);
      const tx = fx - x0, ty = fy - y0;
      const top = this.field[y0][x0] * (1 - tx) + this.field[y0][x1] * tx;
      const bot = this.field[y1][x0] * (1 - tx) + this.field[y1][x1] * tx;
      return top * (1 - ty) + bot * ty;
    }
  };
}
function egSampleFillScore(gray, w, h, cx, cy, radius) {
  const r2 = radius * radius;
  const vals = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = Math.round(cy + dy);
    if (yy < 0 || yy >= h) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const xx = Math.round(cx + dx);
      if (xx < 0 || xx >= w) continue;
      vals.push(gray[yy * w + xx]);
    }
  }
  if (!vals.length) return 255;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length * 0.40)];
}

// ---- v18 constants + pickBest, ported verbatim from exam-manager.js ----
const EG_MARK_THRESHOLD = 42;
const EG_REFERENCE_WHITE = 210;
const EG_MIN_EXPOSURE_SCALE = 0.45;
const EG_MAX_EXPOSURE_SCALE = 1.15;
const EG_BUBBLE_RADIUS = 9;
const EG_CORE_RADIUS = 4;
const EG_CORE_MIN_FOR_CONFIDENT = 20;
const EG_CORE_THRESHOLD = 55;
const EG_CORE_MARGIN = 15;

function makePickBest(gray, whiteField) {
  function exposureScaleAt(x, y) {
    return Math.min(EG_MAX_EXPOSURE_SCALE, Math.max(EG_MIN_EXPOSURE_SCALE, whiteField.at(x, y) / EG_REFERENCE_WHITE));
  }
  function darkAt(x, y, radius) { return whiteField.at(x, y) - egSampleFillScore(gray, W, H, x, y, radius); }

  return function pickBest(rawCandidates) {
    const candidates = rawCandidates.map(c => {
      const scale = exposureScaleAt(c.x, c.y);
      return {
        ...c,
        broad: darkAt(c.x, c.y, EG_BUBBLE_RADIUS),
        core: darkAt(c.x, c.y, EG_CORE_RADIUS),
        markThreshold: EG_MARK_THRESHOLD * scale,
        coreMinForConfident: EG_CORE_MIN_FOR_CONFIDENT * scale,
        coreThreshold: EG_CORE_THRESHOLD * scale,
        coreMarginThreshold: EG_CORE_MARGIN * scale
      };
    });
    const genuine = c => c.broad > c.markThreshold && c.core > c.coreMinForConfident;
    // v18: the stricter multi-membership bar under test.
    const genuineForMulti = c => c.broad > c.markThreshold && c.core > c.coreThreshold;

    let best = null, second = -Infinity;
    const aboveThreshold = [];
    candidates.forEach(c => {
      if (genuineForMulti(c)) aboveThreshold.push(c);
      if (!best || c.broad > best.broad) { second = best ? best.broad : second; best = c; }
      else if (c.broad > second) { second = c.broad; }
    });

    if (aboveThreshold.length >= 2) {
      return { value: best, margin: best.broad - second, flag: "multi", multiOptions: aboveThreshold };
    }
    if (best && genuine(best)) {
      return { value: best, margin: best.broad - (second === -Infinity ? 0 : second), flag: null };
    }

    let coreBest = null, coreSecond = -Infinity;
    candidates.forEach(c => {
      if (!coreBest || c.core > coreBest.core) { coreSecond = coreBest ? coreBest.core : coreSecond; coreBest = c; }
      else if (c.core > coreSecond) { coreSecond = c.core; }
    });
    const coreMargin = coreBest ? coreBest.core - (coreSecond === -Infinity ? 0 : coreSecond) : 0;
    if (coreBest && coreBest.core > coreBest.coreThreshold && coreMargin > coreBest.coreMarginThreshold) {
      return { value: coreBest, margin: coreMargin, flag: "faint" };
    }
    return { value: null, margin: best ? best.broad - (second === -Infinity ? 0 : second) : 0, flag: null };
  };
}

// ---- Also ported for comparison: the OLD (pre-v18) multi check, using
// the lenient `coreMinForConfident` bar for BOTH single-pick AND multi
// -membership — kept only to prove scenario 2 below really would have
// false-positived before this fix, so this test exercises the real bug. ----
function makePickBestOLD(gray, whiteField) {
  function exposureScaleAt(x, y) {
    return Math.min(EG_MAX_EXPOSURE_SCALE, Math.max(EG_MIN_EXPOSURE_SCALE, whiteField.at(x, y) / EG_REFERENCE_WHITE));
  }
  function darkAt(x, y, radius) { return whiteField.at(x, y) - egSampleFillScore(gray, W, H, x, y, radius); }
  return function pickBest(rawCandidates) {
    const candidates = rawCandidates.map(c => {
      const scale = exposureScaleAt(c.x, c.y);
      return { ...c, broad: darkAt(c.x, c.y, EG_BUBBLE_RADIUS), core: darkAt(c.x, c.y, EG_CORE_RADIUS),
        markThreshold: EG_MARK_THRESHOLD * scale, coreMinForConfident: EG_CORE_MIN_FOR_CONFIDENT * scale };
    });
    const genuine = c => c.broad > c.markThreshold && c.core > c.coreMinForConfident;
    let best = null, second = -Infinity;
    const aboveThreshold = [];
    candidates.forEach(c => {
      if (genuine(c)) aboveThreshold.push(c);
      if (!best || c.broad > best.broad) { second = best ? best.broad : second; best = c; }
      else if (c.broad > second) { second = c.broad; }
    });
    if (aboveThreshold.length >= 2) return { value: best, margin: best.broad - second, flag: "multi", multiOptions: aboveThreshold };
    return { value: best, margin: 0, flag: genuine(best) ? null : "other" };
  };
}

// ---- v18: small pure helper mirroring the new examgrPaintOverlay "wrong"
// branch's red-index derivation (see exam-manager.js) ----
function deriveRedOptionIndices(pq) {
  return (pq.flag === "multi" && Array.isArray(pq.multiOptions) && pq.multiOptions.length)
    ? pq.multiOptions.map(o => o.opt)
    : [pq.detectedOpt];
}

let pass = true;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
  if (!cond) pass = false;
}
function detect(pickBestFn, gray, opts) {
  const excludePoints = opts.map(o => ({ x: o.x, y: o.y }));
  const whiteField = egWhiteLevelField(gray, W, H, 8, 11, excludePoints, 13);
  return pickBestFn(gray, whiteField)(opts);
}

// ──────────────────────────────────────────────────────────────
// Scenario 1 — regression check: two options BOTH solidly, fully
// filled (a genuine multiple-mark mistake) must still be flagged
// "multi" with both captured — the stricter bar must not under-detect
// a real double mark.
// ──────────────────────────────────────────────────────────────
{
  const gray = new Float64Array(W * H).fill(232);
  const opts = [{ opt: 0, x: 190, y: 400 }, { opt: 1, x: 220, y: 400 }, { opt: 2, x: 250, y: 400 }, { opt: 3, x: 280, y: 400 }];
  opts.forEach(o => drawRing(gray, o.x, o.y, 10.15, 11.85, 90));
  drawDisk(gray, 220, 400, 9, 30); // B solidly filled
  drawDisk(gray, 250, 400, 9, 34); // C solidly filled too
  const r = detect(makePickBest, gray, opts);
  check("two solidly-filled options -> still flagged multi (no under-detection)",
    r.flag === "multi" && r.multiOptions && r.multiOptions.length === 2 &&
    r.multiOptions.some(o => o.opt === 1) && r.multiOptions.some(o => o.opt === 2));
}

// ──────────────────────────────────────────────────────────────
// Scenario 2 — THE REPORTED BUG: option A is a real, solidly-filled
// mark. Option D is COMPLETELY untouched by the student, but a light,
// even smudge/shadow (well short of real ink, diff=48 — comfortably
// past the old lenient core bar of 20, but under the new 55 "genuinely
// solid ink" bar) sits across it. Old code wrongly called this "multi"
// (D would get a false blue ring even though nothing was filled in);
// fixed code must resolve it to a single confident pick on A only.
// ──────────────────────────────────────────────────────────────
{
  const gray = new Float64Array(W * H).fill(232);
  const opts = [{ opt: 0, x: 190, y: 900 }, { opt: 1, x: 220, y: 900 }, { opt: 2, x: 250, y: 900 }, { opt: 3, x: 280, y: 900 }];
  opts.forEach(o => drawRing(gray, o.x, o.y, 10.15, 11.85, 90));
  drawDisk(gray, 190, 900, 9, 30);  // A: real, solid mark
  drawDisk(gray, 280, 900, 9, 184); // D: light smudge/shadow the whole disk, diff=48 (not real ink)

  const oldResult = detect(makePickBestOLD, gray, opts);
  check("(sanity) confirms the OLD lenient bar really did false-positive this exact case",
    oldResult.flag === "multi" && oldResult.multiOptions.some(o => o.opt === 3));

  const fixed = detect(makePickBest, gray, opts);
  check("fixed: blank-but-smudged option D is NOT pulled into multiOptions",
    !(fixed.flag === "multi" && fixed.multiOptions.some(o => o.opt === 3)));
  check("fixed: resolves to a normal single confident pick on A, no flag at all",
    fixed.flag === null && fixed.value && fixed.value.opt === 0);
}

// ──────────────────────────────────────────────────────────────
// Scenario 3 — two options both filled but more moderately (not as
// bold as scenario 1, still real, deliberate shading, core diff=70,
// comfortably over the new 55 bar) -> must still be flagged multi.
// Confirms the new bar isn't so strict it only catches maximum-ink marks.
// ──────────────────────────────────────────────────────────────
{
  const gray = new Float64Array(W * H).fill(232);
  const opts = [{ opt: 0, x: 190, y: 1300 }, { opt: 1, x: 220, y: 1300 }, { opt: 2, x: 250, y: 1300 }, { opt: 3, x: 280, y: 1300 }];
  opts.forEach(o => drawRing(gray, o.x, o.y, 10.15, 11.85, 90));
  drawDisk(gray, 220, 1300, 9, 162); // B: moderate but real fill, diff=70
  drawDisk(gray, 250, 1300, 9, 158); // C: moderate but real fill, diff=74
  const r = detect(makePickBest, gray, opts);
  check("two moderately (but genuinely) filled options -> still flagged multi",
    r.flag === "multi" && r.multiOptions && r.multiOptions.length === 2);
}

// ──────────────────────────────────────────────────────────────
// Scenario 4 — paint-overlay red-index derivation: a multi-marked
// question graded "wrong" must paint EVERY marked option red, not just
// pickBest's single darkest pick.
// ──────────────────────────────────────────────────────────────
{
  const pq = { status: "wrong", flag: "multi", detectedOpt: 2, multiOptions: [{ opt: 1 }, { opt: 2 }] };
  const reds = deriveRedOptionIndices(pq);
  check("multi-marked wrong question -> ALL marked options painted red (both B and C)",
    reds.length === 2 && reds.includes(1) && reds.includes(2));
}

// ──────────────────────────────────────────────────────────────
// Scenario 5 — a normal (non-multi) wrong answer is unaffected: still
// exactly one red dot, on the single option that was actually marked.
// ──────────────────────────────────────────────────────────────
{
  const pq = { status: "wrong", flag: null, detectedOpt: 1, multiOptions: null };
  const reds = deriveRedOptionIndices(pq);
  check("normal (non-multi) wrong answer -> exactly one red dot, unaffected by the fix",
    reds.length === 1 && reds[0] === 1);
}

console.log(pass ? "\nALL PASS" : "\nSOME FAILED");
if (!pass) process.exit(1);
