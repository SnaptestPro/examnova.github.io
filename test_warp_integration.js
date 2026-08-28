// Simulates a "photographed at an angle" sheet as a raw pixel buffer,
// then runs the exact warp algorithm (ported verbatim from
// exam-manager.js) to check a known mark lands back at its correct
// template coordinate after correction.

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

// ---- Build a synthetic "photo" ----
// Template (print) space: same as the real app.
const OMR_CANVAS_SIZE = { width: 1203, height: 1536 };
const OMR_SCAN_MARKERS = {
  "top-left": { x: 116.26, y: 207.16 },
  "top-right": { x: 1086.74, y: 207.16 },
  "bottom-left": { x: 116.26, y: 1419.79 },
  "bottom-right": { x: 1086.74, y: 1419.79 }
};

// A "hand-held, tilted" video frame: markers form a skewed quad (right
// side of the sheet appears smaller/shifted - simulates the phone being
// rotated + tilted relative to the paper), video frame is 900x1200.
const sw = 900, sh = 1200;
const videoQuad = [
  { x: 90, y: 160 },   // top-left
  { x: 800, y: 190 },  // top-right (compressed + dropped vs a flat shot)
  { x: 110, y: 1100 }, // bottom-left
  { x: 760, y: 1010 } // bottom-right (pulled in vs bottom-left)
];
const templateQuad = [
  OMR_SCAN_MARKERS["top-left"], OMR_SCAN_MARKERS["top-right"],
  OMR_SCAN_MARKERS["bottom-left"], OMR_SCAN_MARKERS["bottom-right"]
];

// Homography mapping TEMPLATE -> VIDEO (used to PLACE our synthetic mark
// realistically into the tilted photo, mimicking how a real mark at a
// known template position would actually appear on a tilted camera shot).
const H_fwd = egComputeHomography(templateQuad, videoQuad);
function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

// Paint a white "photo" with a black disk representing a filled bubble
// whose TRUE template-space centre is a known Q3-option-C-like point.
const knownTemplatePoint = { x: 250, y: 824 }; // arbitrary bubble centre in template space
const videoPoint = applyH(H_fwd, knownTemplatePoint.x, knownTemplatePoint.y);
console.log("Synthetic mark placed in video frame at:", videoPoint);

const src = new Uint8ClampedArray(sw * sh * 4).fill(255);
for (let i = 3; i < src.length; i += 4) src[i] = 255; // alpha
const blobRadius = 9; // px, roughly what an oversized/bold real mark looks like in video-res
for (let dy = -blobRadius; dy <= blobRadius; dy++) {
  for (let dx = -blobRadius; dx <= blobRadius; dx++) {
    if (dx * dx + dy * dy > blobRadius * blobRadius) continue;
    const xx = Math.round(videoPoint.x + dx), yy = Math.round(videoPoint.y + dy);
    if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
    const idx = (yy * sw + xx) * 4;
    src[idx] = src[idx + 1] = src[idx + 2] = 20; // near-black ink
  }
}

// ---- Run the ACTUAL warp algorithm (mirrors egWarpPerspective) ----
const H = egComputeHomography(templateQuad, videoQuad);
const dstW = OMR_CANVAS_SIZE.width, dstH = OMR_CANVAS_SIZE.height;
const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;
const out = new Uint8ClampedArray(dstW * dstH * 4);
let di = 0;
for (let Y = 0; Y < dstH; Y++) {
  for (let X = 0; X < dstW; X++, di += 4) {
    const wDen = h6 * X + h7 * Y + h8;
    const sx = (h0 * X + h1 * Y + h2) / wDen;
    const sy = (h3 * X + h4 * Y + h5) / wDen;
    if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
      out[di] = out[di + 1] = out[di + 2] = 255; out[di + 3] = 255;
      continue;
    }
    const x0 = sx | 0, y0 = sy | 0;
    const fx = sx - x0, fy = sy - y0;
    const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4;
    const i01 = i00 + sw * 4, i11 = i01 + 4;
    const ifx = 1 - fx, ify = 1 - fy;
    out[di] = (src[i00] * ifx + src[i10] * fx) * ify + (src[i01] * ifx + src[i11] * fx) * fy;
    out[di + 1] = out[di];
    out[di + 2] = out[di];
    out[di + 3] = 255;
  }
}

// ---- Check: is the warped output dark exactly at knownTemplatePoint? ----
function sampleOut(x, y) {
  const idx = (Math.round(y) * dstW + Math.round(x)) * 4;
  return out[idx];
}
const centerVal = sampleOut(knownTemplatePoint.x, knownTemplatePoint.y);
console.log(`Warped output at true template point (${knownTemplatePoint.x},${knownTemplatePoint.y}): pixel value = ${centerVal} (expect dark, <60)`);

// Compare against what the OLD naive axis-aligned scale/crop would have
// produced at the same template point, to show the improvement.
function naiveOldMapping(X, Y) {
  const left = (videoQuad[0].x + videoQuad[2].x) / 2, right = (videoQuad[1].x + videoQuad[3].x) / 2;
  const top = (videoQuad[0].y + videoQuad[1].y) / 2, bottom = (videoQuad[2].y + videoQuad[3].y) / 2;
  const scaleX = (right - left) / (templateQuad[1].x - templateQuad[0].x);
  const scaleY = (bottom - top) / (templateQuad[2].y - templateQuad[0].y);
  const sourceX = left - templateQuad[0].x * scaleX;
  const sourceY = top - templateQuad[0].y * scaleY;
  // old code: dst pixel (X,Y) in OMR_CANVAS_SIZE <- src (sourceX + X*scaleX, sourceY + Y*scaleY)
  return { x: sourceX + X * scaleX, y: sourceY + Y * scaleY };
}
const oldSrcPoint = naiveOldMapping(knownTemplatePoint.x, knownTemplatePoint.y);
const dx = oldSrcPoint.x - videoPoint.x, dy = oldSrcPoint.y - videoPoint.y;
const oldPixelError = Math.sqrt(dx * dx + dy * dy);
console.log(`OLD naive scale/crop would have sampled ${oldPixelError.toFixed(1)}px away from the actual mark's centre in the source photo (bubble radius is only ~9-11px) -> would very plausibly miss it entirely.`);

if (centerVal < 60) {
  console.log("PASS: perspective-corrected warp puts the mark exactly where the template expects, despite the tilt.");
} else {
  console.log("FAIL: warp did not line up the mark correctly.");
  process.exit(1);
}
