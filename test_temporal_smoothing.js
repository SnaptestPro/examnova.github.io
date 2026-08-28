// v8 fix check: does averaging the last few "all-4-markers-found" frames'
// corner positions actually reduce warp error compared to trusting only
// the single last frame (the old behaviour), under a realistic amount of
// hand-tremor jitter?
//
// This mirrors runScannerDetection's new logic (egAverageMarkerFrames)
// and re-runs the exact homography math (ported verbatim from
// exam-manager.js, same as test_warp_integration.js does) against many
// randomized "steady hold with tremor" trials.

function egSolveLinear8(A, b) {
  const n = 8;
  const M = A.map((row, i) => row.concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) { if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r; }
    if (pivot !== col) { const tmp = M[col]; M[col] = M[pivot]; M[pivot] = tmp; }
    const pv = M[col][col];
    if (Math.abs(pv) < 1e-9) return null;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / pv;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}
function egComputeHomography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], X = dst[i].x, Y = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  const h = egSolveLinear8(A, b);
  return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
}
function egApplyHomography(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

// ---- Simple seeded PRNG so the test is deterministic ----
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OMR_CANVAS_SIZE = { width: 1203, height: 1536 };
const OMR_SCAN_MARKERS = {
  "top-left": { x: 116.26, y: 207.16 },
  "top-right": { x: 1086.74, y: 207.16 },
  "bottom-left": { x: 116.26, y: 1419.79 },
  "bottom-right": { x: 1086.74, y: 1419.79 }
};
const templateQuad = [
  OMR_SCAN_MARKERS["top-left"], OMR_SCAN_MARKERS["top-right"],
  OMR_SCAN_MARKERS["bottom-left"], OMR_SCAN_MARKERS["bottom-right"]
];

// A "held reasonably steady, mild tilt" true quad (900x1200 video frame).
const trueQuad = [
  { x: 96, y: 150 },   // top-left
  { x: 812, y: 168 },  // top-right
  { x: 104, y: 1080 }, // bottom-left
  { x: 800, y: 1062 }  // bottom-right
];

const EG_MARKER_HISTORY_SIZE = 4;
const JITTER_PX = 3.5; // per-frame hand-tremor std-dev, in video pixels — a conservative
                        // real-world estimate for a hand-held phone at typical scan distance

// A handful of bubble centres scattered across the sheet (near corners
// AND far from all 4 corners, since warp error grows with distance from
// the calibration points — this is exactly where v7's fix helped least).
const testPoints = [
  { name: "Q3-C (mid-left)", x: 250, y: 824 },
  { name: "Q47 (dead centre)", x: 601, y: 768 },
  { name: "Roll digit row 7 (upper area)", x: 190, y: 475 },
  { name: "Q88 (far bottom-right)", x: 1030, y: 1281 }
];

function randn(rng) { // Box-Muller
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function jitteredQuad(rng) {
  return trueQuad.map(p => ({ x: p.x + randn(rng) * JITTER_PX, y: p.y + randn(rng) * JITTER_PX }));
}
function averageQuads(quads) {
  const n = quads.length;
  return [0, 1, 2, 3].map(i => {
    let sx = 0, sy = 0;
    quads.forEach(q => { sx += q[i].x; sy += q[i].y; });
    return { x: sx / n, y: sy / n };
  });
}

// "Ground truth" video-space position of each test point under the TRUE
// (noise-free) quad — what a perfect capture would have sampled.
const H_true = egComputeHomography(templateQuad, trueQuad);
const truePositions = testPoints.map(p => egApplyHomography(H_true, p.x, p.y));

const TRIALS = 2000;
let sumErrOld = 0, sumErrNew = 0;
let worstOld = 0, worstNew = 0;
const rng = mulberry32(42);

for (let t = 0; t < TRIALS; t++) {
  // Simulate EG_MARKER_HISTORY_SIZE consecutive "ready" frames, each with
  // independent tremor noise — the last one is what the OLD code used;
  // the average of all of them is what the NEW code uses.
  const frames = [];
  for (let f = 0; f < EG_MARKER_HISTORY_SIZE; f++) frames.push(jitteredQuad(rng));
  const lastFrameQuad = frames[frames.length - 1];
  const avgQuad = averageQuads(frames);

  const H_old = egComputeHomography(templateQuad, lastFrameQuad);
  const H_new = egComputeHomography(templateQuad, avgQuad);

  testPoints.forEach((p, i) => {
    const truth = truePositions[i];
    const oldPos = egApplyHomography(H_old, p.x, p.y);
    const newPos = egApplyHomography(H_new, p.x, p.y);
    const errOld = Math.hypot(oldPos.x - truth.x, oldPos.y - truth.y);
    const errNew = Math.hypot(newPos.x - truth.x, newPos.y - truth.y);
    sumErrOld += errOld; sumErrNew += errNew;
    worstOld = Math.max(worstOld, errOld); worstNew = Math.max(worstNew, errNew);
  });
}

const n = TRIALS * testPoints.length;
const meanOld = sumErrOld / n, meanNew = sumErrNew / n;

console.log(`Trials: ${TRIALS}, sample points per trial: ${testPoints.length}, per-frame jitter std-dev: ${JITTER_PX}px`);
console.log(`OLD (single last frame)   -> mean sampled-pixel error: ${meanOld.toFixed(2)}px, worst-case: ${worstOld.toFixed(2)}px`);
console.log(`NEW (avg of last ${EG_MARKER_HISTORY_SIZE} frames) -> mean sampled-pixel error: ${meanNew.toFixed(2)}px, worst-case: ${worstNew.toFixed(2)}px`);
console.log(`Improvement: ${(100 * (1 - meanNew / meanOld)).toFixed(1)}% lower mean error, ${(100 * (1 - worstNew / worstOld)).toFixed(1)}% lower worst-case error.`);

// Bubble radius ~11px, sample radius 10px -> a few px of error is the
// difference between comfortably on-ink and right at the edge. Averaging
// should meaningfully shrink both the mean AND the worst case.
if (meanNew < meanOld * 0.75 && worstNew < worstOld) {
  console.log("PASS: temporal averaging measurably reduces both mean and worst-case corner-position error.");
} else {
  console.log("FAIL: averaging did not meaningfully help — investigate before shipping.");
  process.exit(1);
}
