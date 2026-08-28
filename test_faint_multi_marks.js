// v9 fix check — three real problems reported after looking closely at a
// captured scan (14272.jpg):
//
//  1. A COMPLETELY BLANK bubble (Q94) got a gold "detected" dot anyway.
//     The broad 40th-percentile coverage check apparently triggered from
//     something OTHER than a real fill covering a big chunk of the
//     sample disk — the printed ring's own edge under residual scan
//     misalignment, bleed from a nearby label letter, a shadow, dust.
//     Whatever the exact source, the true bubble centre was untouched
//     paper the whole time.
//  2. A light dot/tick mark (student didn't fully shade the bubble) was
//     silently read as blank — the 40th-percentile coverage check needs
//     ~40%+ of the disk to be dark, so a small centred dot (well under
//     that) scores almost identically to a truly empty bubble.
//  3. Two options both solidly filled for the same question (a genuine
//     multiple-answer mistake) — the old code just silently picked
//     whichever was darkest, with no way for a teacher to notice.
//
// This test ports the exact scoring math from exam-manager.js (same
// convention as test_detection_algo.js) and the NEW pickBest (broad
// coverage check + a mandatory "is the centre itself actually inked"
// confirmation, a small-radius "core" fallback for faint marks, and a
// multi-mark check) against synthetic bubbles built to reproduce each
// scenario above, plus a normal confident mark as a control.

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
// Dark ANNULUS between rIn and rOut, leaving the very centre (radius <
// rIn) untouched — models "something dark covers a big chunk of the
// bubble's broad sample area, but the true centre stays blank paper".
// Could be the printed ring's own edge under misalignment, bleed from an
// adjacent label/letter, a shadow, dust, a crease — the exact cause
// doesn't matter; the SHAPE of the failure (broad triggers, centre
// doesn't) is exactly what the new core-confirmation gate targets.
function drawAnnulus(buf, cx, cy, rIn, rOut, val) {
  for (let dy = -rOut; dy <= rOut; dy++) {
    for (let dx = -rOut; dx <= rOut; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 < rIn * rIn || d2 > rOut * rOut) continue;
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      buf[y * W + x] = val;
    }
  }
}

// ---- Ported verbatim (same values/shape as exam-manager.js / test_detection_algo.js) ----
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
  return {
    field, binW, binH, binsX, binsY,
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

// ---- v9 constants + pickBest, ported verbatim from exam-manager.js ----
const EG_MARK_THRESHOLD = 42;
const EG_BUBBLE_RADIUS = 9;
const EG_CORE_RADIUS = 4;
const EG_CORE_MIN_FOR_CONFIDENT = 20;
const EG_CORE_THRESHOLD = 55;
const EG_CORE_MARGIN = 15;

function makePickBest(gray, whiteField) {
  function darkAt(x, y, radius) { return whiteField.at(x, y) - egSampleFillScore(gray, W, H, x, y, radius); }
  return function pickBest(rawCandidates) {
    const candidates = rawCandidates.map(c => ({
      ...c,
      broad: darkAt(c.x, c.y, EG_BUBBLE_RADIUS),
      core: darkAt(c.x, c.y, EG_CORE_RADIUS)
    }));
    const genuine = c => c.broad > EG_MARK_THRESHOLD && c.core > EG_CORE_MIN_FOR_CONFIDENT;

    let best = null, second = -Infinity;
    const aboveThreshold = [];
    candidates.forEach(c => {
      if (genuine(c)) aboveThreshold.push(c);
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
    if (coreBest && coreBest.core > EG_CORE_THRESHOLD && coreMargin > EG_CORE_MARGIN) {
      return { value: coreBest, margin: coreMargin, flag: "faint" };
    }
    return { value: null, margin: best ? best.broad - (second === -Infinity ? 0 : second) : 0, flag: null };
  };
}

let pass = true;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
  if (!cond) pass = false;
}
function detect(gray, opts) {
  const excludePoints = opts.map(o => ({ x: o.x, y: o.y }));
  const whiteField = egWhiteLevelField(gray, W, H, 5, 7, excludePoints, 13);
  return makePickBest(gray, whiteField)(opts);
}

// ──────────────────────────────────────────────────────────────
// Scenario 1 — control: a normal, fully-shaded, confident mark.
// ──────────────────────────────────────────────────────────────
{
  const gray = new Float64Array(W * H).fill(232);
  const opts = [{ opt: 0, x: 190, y: 400 }, { opt: 1, x: 220, y: 400 }, { opt: 2, x: 250, y: 400 }, { opt: 3, x: 280, y: 400 }];
  opts.forEach(o => drawRing(gray, o.x, o.y, 10.15, 11.85, 90));
  drawDisk(gray, 190, 400, 9, 30); // option A fully shaded
  const r = detect(gray, opts);
  check("full shade -> confident mark, correct option, no flag", r.value && r.value.opt === 0 && r.flag === null);
}

// ──────────────────────────────────────────────────────────────
// Scenario 2 — Q20/21/23-style: student made a small dot/tick instead
// of fully shading option B; options A/C/D left untouched.
// ──────────────────────────────────────────────────────────────
{
  const gray = new Float64Array(W * H).fill(232);
  const opts = [{ opt: 0, x: 190, y: 900 }, { opt: 1, x: 220, y: 900 }, { opt: 2, x: 250, y: 900 }, { opt: 3, x: 280, y: 900 }];
  opts.forEach(o => drawRing(gray, o.x, o.y, 10.15, 11.85, 90));
  drawDisk(gray, 220, 900, 3, 20); // small ~3px dot dead-centre of option B — well under
                                    // the ~40% coverage a radius-9 disk (area ~254px²) needs
  const r = detect(gray, opts);
  check("small dot mark -> picked up as B via faint fallback", r.value && r.value.opt === 1 && r.flag === "faint");
}

// ──────────────────────────────────────────────────────────────
// Scenario 3 — two options both solidly filled (genuine multiple-mark
// mistake) -> must be flagged "multi", not silently resolved to one.
// ──────────────────────────────────────────────────────────────
{
  const gray = new Float64Array(W * H).fill(232);
  const opts = [{ opt: 0, x: 190, y: 1300 }, { opt: 1, x: 220, y: 1300 }, { opt: 2, x: 250, y: 1300 }, { opt: 3, x: 280, y: 1300 }];
  opts.forEach(o => drawRing(gray, o.x, o.y, 10.15, 11.85, 90));
  drawDisk(gray, 220, 1300, 9, 28); // B filled
  drawDisk(gray, 250, 1300, 9, 32); // C also filled (slightly darker, but both clearly marked)
  const r = detect(gray, opts);
  check("two options both filled -> flagged multi, both captured",
    r.flag === "multi" && r.multiOptions && r.multiOptions.length === 2 &&
    r.multiOptions.some(o => o.opt === 1) && r.multiOptions.some(o => o.opt === 2));
}

// ──────────────────────────────────────────────────────────────
// Scenario 4 — the Q94-style false positive: bubble D is COMPLETELY
// BLANK at its true centre, but a dark annulus (standing in for a
// misaligned ring edge / nearby text bleed / a shadow — see drawAnnulus
// comment above) covers most of the broad sample disk's outer area.
// Old logic (broad-threshold only) would have called this "marked".
// ──────────────────────────────────────────────────────────────
{
  const gray = new Float64Array(W * H).fill(232);
  const opts = [{ opt: 0, x: 190, y: 1450 }, { opt: 1, x: 220, y: 1450 }, { opt: 2, x: 250, y: 1450 }, { opt: 3, x: 280, y: 1450 }];
  opts.forEach(o => drawRing(gray, o.x, o.y, 10.15, 11.85, 90));
  drawAnnulus(gray, 280, 1450, 5, 9, 30); // D: broad-disk-covering annulus, centre (r<5) left blank
  const excludePoints = opts.map(o => ({ x: o.x, y: o.y }));
  const whiteField = egWhiteLevelField(gray, W, H, 5, 7, excludePoints, 13);
  const broadOnly = whiteField.at(280, 1450) - egSampleFillScore(gray, W, H, 280, 1450, EG_BUBBLE_RADIUS);
  const coreOnly = whiteField.at(280, 1450) - egSampleFillScore(gray, W, H, 280, 1450, EG_CORE_RADIUS);
  console.log(`   (D: broad darkAt=${broadOnly.toFixed(1)} [would-be old-style false positive if >${EG_MARK_THRESHOLD}], core darkAt=${coreOnly.toFixed(1)} [must be >${EG_CORE_MIN_FOR_CONFIDENT} to confirm])`);
  check("annulus alone crosses the broad threshold (confirms the failure mode is real)", broadOnly > EG_MARK_THRESHOLD);
  check("...but its centre stays light, so core-confirmation correctly rejects it", coreOnly <= EG_CORE_MIN_FOR_CONFIDENT);
  const r = detect(gray, opts);
  check("net result: blank bubble D is NOT reported as marked", !(r.value && r.value.opt === 3 && r.flag === null));
}

console.log(pass ? "\nALL PASS" : "\nSOME FAILED");
if (!pass) process.exit(1);
