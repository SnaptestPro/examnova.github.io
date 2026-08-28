// Solve the 3x3 perspective homography H such that H * [x,y,1]^T ~ [X,Y,1]^T
// for 4 point correspondences src_i -> dst_i. Returns [h0..h8] row-major, h8=1.
function computeHomography(src, dst) {
  // Build the 8x8 linear system A*h = b (h8 fixed to 1).
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solveLinearSystem(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

// Gaussian elimination with partial pivoting for a square system A*x = b.
function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => row.concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (pivot !== col) { const tmp = M[col]; M[col] = M[pivot]; M[pivot] = tmp; }
    const pv = M[col][col];
    if (Math.abs(pv) < 1e-12) throw new Error("Singular matrix - degenerate marker points");
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / pv;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function applyHomography(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

// ---- TESTS ----

// Test 1: identity mapping (src == dst) should round-trip exactly.
{
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }];
  const H = computeHomography(pts, pts);
  const out = applyHomography(H, 50, 50);
  console.log("Test 1 (identity):", out, "expect ~ (50,50)");
}

// Test 2: pure translation.
{
  const src = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }];
  const dst = src.map(p => ({ x: p.x + 20, y: p.y + 30 }));
  const H = computeHomography(src, dst);
  const out = applyHomography(H, 50, 50);
  console.log("Test 2 (translate +20,+30):", out, "expect ~ (70,80)");
}

// Test 3: real perspective/keystone distortion (simulates a tilted phone).
// Template is a perfect rectangle; "video" positions are skewed like a
// camera looking at the sheet from an angle (right edge appears closer/
// bigger than the left edge - classic keystoning).
{
  const template = [
    { x: 116.26, y: 207.16 },   // top-left
    { x: 1086.74, y: 207.16 },  // top-right
    { x: 116.26, y: 1419.79 },  // bottom-left
    { x: 1086.74, y: 1419.79 } // bottom-right
  ];
  // Simulated video-space corners: right side of the sheet is further from
  // the camera (physically shifted + compressed vertically) than the left
  // side - a real keystone effect a simple axis-aligned scale cannot model.
  const video = [
    { x: 140, y: 260 },   // top-left
    { x: 980, y: 300 },   // top-right (pulled in and down vs top-left)
    { x: 150, y: 1360 },  // bottom-left
    { x: 940, y: 1250 }  // bottom-right (pulled in and up vs bottom-left)
  ];
  const H = computeHomography(template, video);
  // Round-trip check: template corners must map exactly onto video corners.
  template.forEach((p, i) => {
    const out = applyHomography(H, p.x, p.y);
    console.log(`Test 3 corner ${i}:`, out, "expect", video[i]);
  });
  // A bubble at the exact centre of the template sheet should now land at
  // the perspective-correct centre of the video quad, NOT the naive
  // average of the 4 corners (which is what axis-aligned scaling would
  // effectively assume).
  const centerTemplate = { x: (116.26 + 1086.74) / 2, y: (207.16 + 1419.79) / 2 };
  const centerOut = applyHomography(H, centerTemplate.x, centerTemplate.y);
  const naiveAvg = {
    x: (video[0].x + video[1].x + video[2].x + video[3].x) / 4,
    y: (video[0].y + video[1].y + video[2].y + video[3].y) / 4
  };
  console.log("Test 3 center (true perspective):", centerOut);
  console.log("Test 3 center (naive 4-corner average, for comparison):", naiveAvg);
}

console.log("All homography tests completed.");
