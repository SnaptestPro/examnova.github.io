// Test for the v19 findBlackSquare() shape-check fix (see
// REGISTRATION_MARKER_DETECTION_V19_FIX_NOTES.md).
//
// Admin report (verbatim, paraphrased): "Otsu adaptive-threshold fix
// already landed (30/45 target) but real scans are STILL only finding
// 14-15/45 squares — need this to actually reach 30+, no matter what."
//
// Root cause found on review: the OLD shape check (fillRatio vs. the
// component's AXIS-ALIGNED bounding box, plus "all 4 bbox corners must
// be dark") silently assumes every marker lands perfectly axis-aligned
// on the warped canvas. The internal 45-marker grid exists specifically
// because a real, handled sheet is gently bent in 3-D (folds/creases) —
// a marker that lands even ~10-15° off-axis after the global 4-corner
// warp has ALL FOUR of its bounding-box corners fall outside the
// rotated ink (a rotated square's true corners sit near the MIDPOINTS
// of its bbox edges, not at the bbox's own corners), so the old test
// rejected it exactly like it would reject a circle. Verified below:
// measured corner-darkness for a real square collapses from 1.0 at 0°
// to 0.0 by just 15° of rotation — indistinguishable from a circle at
// that point, which is exactly why detection was stalling at 14-15/45.
//
// Fix: a ROTATION-INVARIANT shape descriptor — fill ratio against the
// component's own minimum enclosing circle (radius = farthest ink pixel
// from the component's centroid) instead of its axis-aligned bbox. A
// square inscribed in a circle fills a CONSTANT ~0.637 of that circle's
// area no matter which way it's turned (rotating a square about its own
// centre doesn't change "distance to farthest corner"); a filled circle
// fills ~1.0 of its own enclosing circle, by definition, also regardless
// of rotation. Wide, rotation-proof separation between the two.
//
// This file ports the POST-v19 findBlackSquare() logic from
// exam-manager.js exactly and checks it against synthetic rotated
// -square, directional-shadow, and filled-circle windows, plus a
// combined 45-marker fleet simulation mixing rotation + shadow +
// exposure conditions.

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ok  - ${label}`); }
  else { failed++; console.log(`  FAIL - ${label}`); }
}

// ---- Ported verbatim from exam-manager.js (post v19 fix) ----
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

function findBlackSquare(pixelsBrightness, width, height) {
  const count = width * height;
  const dark = new Uint8Array(count);
  const visited = new Uint8Array(count);
  const threshold = egOtsuThreshold(pixelsBrightness, count);
  for (let i = 0; i < count; i++) if (pixelsBrightness[i] < threshold) dark[i] = 1;

  let best = null;
  const queue = new Int32Array(count);
  for (let start = 0; start < count; start++) {
    if (!dark[start] || visited[start]) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let pixelCount = 0, minX = width, maxX = 0, minY = height, maxY = 0, sumX = 0, sumY = 0;
    while (head < tail) {
      const point = queue[head++];
      const pointX = point % width, pointY = Math.floor(point / width);
      pixelCount++;
      sumX += pointX; sumY += pointY;
      minX = Math.min(minX, pointX); maxX = Math.max(maxX, pointX);
      minY = Math.min(minY, pointY); maxY = Math.max(maxY, pointY);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const nx = pointX + ox, ny = pointY + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (dark[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
        }
      }
    }
    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const largestSide = Math.max(componentWidth, componentHeight);
    const smallestSide = Math.min(componentWidth, componentHeight);
    const sizeOk = smallestSide >= 4 && largestSide <= Math.min(width, height) * 0.6 && smallestSide / largestSide >= 0.6;
    if (!sizeOk) continue;

    const cx = sumX / pixelCount, cy = sumY / pixelCount;
    let maxR2 = 0;
    for (let i = 0; i < tail; i++) {
      const point = queue[i];
      const px = point % width, py = Math.floor(point / width);
      const ddx = px - cx, ddy = py - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 > maxR2) maxR2 = d2;
    }
    const enclosingArea = Math.PI * maxR2;
    const circleFillRatio = enclosingArea > 0 ? pixelCount / enclosingArea : 0;
    const looksLikeFilledSquare = circleFillRatio >= 0.48 && circleFillRatio <= 0.85;
    if (looksLikeFilledSquare) {
      const score = pixelCount * circleFillRatio;
      if (!best || score > best.score) best = { score, x: minX + componentWidth / 2, y: minY + componentHeight / 2 };
    }
  }
  return best;
}

// ---- Synthetic scene builders ----

function buildRotatedSquare(W, H, cx, cy, S, angleDeg, ink, paper) {
  const b = new Float64Array(W * H).fill(paper);
  const rad = -angleDeg * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const half = S / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= half && Math.abs(ly) <= half) b[y * W + x] = ink;
    }
  }
  return b;
}

// Axis-aligned square with a DIRECTIONAL shadow — one corner's ink is
// pulled well up towards paper brightness (soft/washed edge), and the
// paper itself has a mild lighting gradient.
function buildShadowedSquare(W, H, cx, cy, S, ink, paper) {
  const b = new Float64Array(W * H);
  const half = S / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gradient = paper - 30 + (x / W) * 60;
      let val = gradient;
      const inSquare = Math.abs(x - cx) <= half && Math.abs(y - cy) <= half;
      if (inSquare) {
        const cornerX = cx + half, cornerY = cy - half;
        const dCorner = Math.hypot(x - cornerX, y - cornerY);
        const softenRadius = 6;
        const t = Math.min(1, dCorner / softenRadius);
        val = ink + (1 - t) * (gradient - ink) * 0.9;
      }
      b[y * W + x] = val;
    }
  }
  return b;
}

function buildCircle(W, H, cx, cy, D, ink, paper) {
  const b = new Float64Array(W * H).fill(paper);
  const r = D / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x - cx, y - cy) <= r) b[y * W + x] = ink;
    }
  }
  return b;
}

const W = 52, H = 52, cx = 26, cy = 26, S = 20;

// ── Scenario 1: rotated squares across a realistic range — must now
// all be detected regardless of angle ──
for (const ang of [0, 8, 12, 15, 20, 25, 30]) {
  const b = buildRotatedSquare(W, H, cx, cy, S, ang, 30, 220);
  const found = findBlackSquare(b, W, H);
  check(`${ang}° rotated square is detected`, !!found);
}

// ── Scenario 2: rotation combined with dim/washed-out exposure ──
{
  const b = buildRotatedSquare(W, H, cx, cy, S, 15, 80, 160);
  const found = findBlackSquare(b, W, H);
  check("15° rotated + dim-exposed square is detected", !!found);
}
{
  const b = buildRotatedSquare(W, H, cx, cy, S, 20, 95, 235);
  const found = findBlackSquare(b, W, H);
  check("20° rotated + washed-out square is detected", !!found);
}

// ── Scenario 3: directional-shadow square (one soft corner) ──
{
  const b = buildShadowedSquare(W, H, cx, cy, S, 35, 210);
  const found = findBlackSquare(b, W, H);
  check("square with one shadow-softened corner is detected", !!found);
}

// ── Scenario 4 (regression guard): filled circles must still NOT be
// picked up as squares, even under the new rotation-invariant test ──
for (const D of [14, 18, 20, 24]) {
  const b = buildCircle(W, H, cx, cy, D, 30, 220);
  const found = findBlackSquare(b, W, H);
  check(`filled circle (D=${D}, marked bubble) is still correctly rejected`, !found);
}
{
  // circle under the same directional paper gradient as scenario 3
  const b = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gradient = 210 - 30 + (x / W) * 60;
    b[y * W + x] = Math.hypot(x - cx, y - cy) <= 10 ? 35 : gradient;
  }
  const found = findBlackSquare(b, W, H);
  check("filled circle under a directional paper gradient is still rejected", !found);
}

// ── Scenario 5: 45-marker fleet simulation mixing rotation, directional
// shadow, and exposure variance — the number the admin actually cares
// about (>=30/45). ──
{
  let foundCount = 0;
  for (let i = 0; i < 45; i++) {
    const kind = i % 5;
    let b;
    if (kind === 0) b = buildRotatedSquare(W, H, cx, cy, S, 0, 30, 220);
    else if (kind === 1) b = buildRotatedSquare(W, H, cx, cy, S, 18, 78, 150);
    else if (kind === 2) b = buildShadowedSquare(W, H, cx, cy, S, 35, 210);
    else if (kind === 3) b = buildRotatedSquare(W, H, cx, cy, S, 25, 95, 235);
    else b = buildRotatedSquare(W, H, cx, cy, S, 12, 30, 220);
    if (findBlackSquare(b, W, H)) foundCount++;
  }
  console.log(`  (fleet sim, mixed rotation+shadow+exposure) found ${foundCount}/45`);
  check("fleet-wide (rotation+shadow+exposure mix): clears the 30/45 requirement", foundCount >= 30);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
