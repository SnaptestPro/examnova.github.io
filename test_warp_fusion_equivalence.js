// Equivalence check for the perf fix that fused desaturation + grayscale
// extraction into egWarpPerspective's per-pixel loop (see its comment in
// exam-manager.js). This ISN'T a bug-report regression test like the
// others — it's a proof that a pure performance refactor didn't quietly
// change the numbers the grading engine reads.
//
// OLD pipeline (3 full-canvas passes): warp -> RGB canvas (each channel
// rounds to a Uint8) -> egDesaturateCanvas reads those rounded channels,
// computes luminance, rounds AGAIN into R=G=B -> egToGrayscale re-reads
// that already-gray, already-rounded canvas and recomputes luminance from
// it (a no-op in theory, since 0.299+0.587+0.114 = 1.000 exactly, but it
// still goes through a canvas round-trip).
// NEW pipeline (1 pass): egWarpPerspective computes luminance ONCE,
// directly from the unrounded bilinear-sampled r/g/b, straight into a
// Float32Array — skipping both extra rounding round-trips entirely.
//
// Since the OLD path rounds twice and the NEW path doesn't round at all
// before storing the float, the two can't be bit-identical — this checks
// they're identical to within a rounding error's tolerance, run across
// many pixels sampled through a real (non-axis-aligned) homography so
// bilinear interpolation is genuinely exercised.

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
function clamp8(v) { return Math.max(0, Math.min(255, Math.round(v))); }

const SW = 80, SH = 100;
const srcData = new Uint8ClampedArray(SW * SH * 4);
let seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
for (let i = 0; i < SW * SH; i++) {
  srcData[i * 4] = Math.floor(rnd() * 255);
  srcData[i * 4 + 1] = Math.floor(rnd() * 255);
  srcData[i * 4 + 2] = Math.floor(rnd() * 255);
  srcData[i * 4 + 3] = 255;
}

const dstSize = { width: 40, height: 50 };
const templateQuad = [{ x: 0, y: 0 }, { x: dstSize.width, y: 0 }, { x: 0, y: dstSize.height }, { x: dstSize.width, y: dstSize.height }];
const videoQuad = [{ x: 8, y: 6 }, { x: 70, y: 10 }, { x: 4, y: 92 }, { x: 74, y: 96 }]; // tilted, not axis-aligned

const H = egComputeHomography(templateQuad, videoQuad);
const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;

function bilinear(sx, sy) {
  if (sx < 0 || sy < 0 || sx >= SW - 1 || sy >= SH - 1) return [255, 255, 255];
  const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
  const i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4;
  const ifx = 1 - fx, ify = 1 - fy;
  const r = (srcData[i00] * ifx + srcData[i10] * fx) * ify + (srcData[i01] * ifx + srcData[i11] * fx) * fy;
  const g = (srcData[i00 + 1] * ifx + srcData[i10 + 1] * fx) * ify + (srcData[i01 + 1] * ifx + srcData[i11 + 1] * fx) * fy;
  const b = (srcData[i00 + 2] * ifx + srcData[i10 + 2] * fx) * ify + (srcData[i01 + 2] * ifx + srcData[i11 + 2] * fx) * fy;
  return [r, g, b];
}

let maxDiff = 0, n = 0, sumDiff = 0;
for (let Y = 0; Y < dstSize.height; Y++) {
  for (let X = 0; X < dstSize.width; X++) {
    const wDen = h6 * X + h7 * Y + h8;
    const sx = (h0 * X + h1 * Y + h2) / wDen, sy = (h3 * X + h4 * Y + h5) / wDen;
    const [r, g, b] = bilinear(sx, sy);

    const rC = clamp8(r), gC = clamp8(g), bC = clamp8(b);
    const lumOldRounded = clamp8(0.299 * rC + 0.587 * gC + 0.114 * bC); // egDesaturateCanvas's stored value
    const lumOldFinal = 0.299 * lumOldRounded + 0.587 * lumOldRounded + 0.114 * lumOldRounded; // egToGrayscale re-read

    const lumNew = 0.299 * r + 0.587 * g + 0.114 * b; // fused, unrounded

    const diff = Math.abs(lumNew - lumOldFinal);
    maxDiff = Math.max(maxDiff, diff);
    sumDiff += diff; n++;
  }
}

let pass = true;
function check(label, cond) { console.log(`${cond ? "PASS" : "FAIL"}: ${label}`); if (!cond) pass = false; }

// Two independent 8-bit roundings in the old path bound the worst case at
// <2.0; detection thresholds downstream (EG_MARK_THRESHOLD=42,
// EG_CORE_MIN_FOR_CONFIDENT=20, EG_CORE_MARGIN=15) are an order of
// magnitude larger, so anything under ~2 is functionally identical.
check(`fused vs old-three-pass luminance stays within rounding noise (max diff ${maxDiff.toFixed(3)} < 2.0, mean ${(sumDiff / n).toFixed(3)})`, maxDiff < 2.0);
check("weights sum to 1.0 (re-reading an already-gray pixel is a no-op) — sanity check the test itself", Math.abs(0.299 + 0.587 + 0.114 - 1) < 1e-9);

console.log(pass ? "\nALL PASS" : "\nSOME FAILED");
if (!pass) process.exit(1);
