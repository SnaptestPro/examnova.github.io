// Builds a synthetic 1203x1536 grayscale "sheet" resembling the busy
// top-left corner from the video (Exam Set + Roll No + Section-1 Q1-4 all
// close together), with several small precisely-filled bubbles and ONE
// oversized/bold bubble, then compares old vs new darkness scoring.

const W = 1203, H = 1536;
const gray = new Float64Array(W * H);
// Simulate a realistic soft shadow gradient across the sheet (e.g. phone/
// hand blocking part of the light) instead of flat paper-white — darker
// toward the top-left corner where Exam Set + Roll No + Q1-4 all sit.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const shadow = 40 * Math.max(0, 1 - Math.hypot(x - 60, y - 100) / 700); // up to -40 near top-left
    gray[y * W + x] = 250 - shadow;
  }
}

function drawDisk(cx, cy, r, val) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      gray[y * W + x] = val;
    }
  }
}
function drawRingOutline(cx, cy, r, val) {
  for (let a = 0; a < 360; a++) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + r * Math.cos(rad)), y = Math.round(cy + r * Math.sin(rad));
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    gray[y * W + x] = val;
  }
}
function drawTextBlock(x0, y0, x1, y1, coverage) {
  // sprinkle dark "text-like" pixels at random to fake label text
  const n = Math.floor((x1 - x0) * (y1 - y0) * coverage);
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(Math.random() * (x1 - x0));
    const y = y0 + Math.floor(Math.random() * (y1 - y0));
    gray[y * W + x] = 60 + Math.random() * 40;
  }
}

// Printed (empty) bubble outlines everywhere in this corner region first.
const EXAM_SET_CENTERS = [167, 201, 235, 269, 303];
const EXAM_SET_Y = 186;
EXAM_SET_CENTERS.forEach(cx => drawRingOutline(cx, EXAM_SET_Y, 11, 90));

const rollCenters = [190, 220];
for (let c of rollCenters) for (let d = 0; d <= 9; d++) drawRingOutline(c, 265 + d * 30, 11, 90);

const qOptionCenters = [190, 220, 250, 280]; // A B C D
for (let r = 0; r < 4; r++) {
  const cy = 655 + r * 30; // Section 1 Q1..Q4 rows (matches real layout rowStart=655)
  qOptionCenters.forEach(cx => drawRingOutline(cx, cy, 11, 90));
}
// Fake label text ("Exam Set", "Roll No", "Subject 1 / Section 1", "A B C D" headers)
// — denser than before, closer to a real busy corner with borders/labels.
drawTextBlock(130, 145, 340, 180, 0.5);
drawTextBlock(130, 235, 340, 260, 0.5);
drawTextBlock(60, 590, 340, 650, 0.45);
drawTextBlock(60, 260, 340, 590, 0.08); // sparse roll-number grid lines/borders

// Now the actual marks:
// - Exam Set option D filled, normal size (r=9)
drawDisk(269, 186, 9, 25);
// - Roll col1 digit "1" filled, normal size
drawDisk(190, 295, 9, 25);
// - Roll col2 digit "3" filled, normal size
drawDisk(220, 355, 9, 25);
// - Q1 A filled normal
drawDisk(190, 655, 9, 25);
// - Q2 B filled normal
drawDisk(220, 685, 9, 25);
// - Q3 C filled BIG/BOLD (oversized ink, like the "bada" mark from the video)
drawDisk(250, 715, 15, 15);
// - Q4 D filled normal
drawDisk(280, 745, 9, 25);

// ---- OLD algorithm: mean sampling, radius 8, NO exclusion in white field ----
function oldWhiteLevelField(gray, w, h, binsX, binsY) {
  binsX = binsX || 5; binsY = binsY || 7;
  const field = [];
  const binW = Math.ceil(w / binsX), binH = Math.ceil(h / binsY);
  for (let by = 0; by < binsY; by++) {
    const row = [];
    for (let bx = 0; bx < binsX; bx++) {
      const x0 = bx * binW, x1 = Math.min(w, x0 + binW);
      const y0 = by * binH, y1 = Math.min(h, y0 + binH);
      const samples = [];
      for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) samples.push(gray[y * w + x]);
      samples.sort((a, b) => a - b);
      row.push(samples.length ? samples[Math.floor(samples.length * 0.85)] : 200);
    }
    field.push(row);
  }
  return { field, binW, binH, binsX, binsY };
}
function fieldAt(fieldObj, x, y) {
  const { field, binW, binH, binsX, binsY } = fieldObj;
  const fx = Math.min(binsX - 1, Math.max(0, x / binW - 0.5));
  const fy = Math.min(binsY - 1, Math.max(0, y / binH - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(binsX - 1, x0 + 1), y1 = Math.min(binsY - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const top = field[y0][x0] * (1 - tx) + field[y0][x1] * tx;
  const bot = field[y1][x0] * (1 - tx) + field[y1][x1] * tx;
  return top * (1 - ty) + bot * ty;
}
function oldSampleDarkness(gray, w, h, cx, cy, radius) {
  let sum = 0, cnt = 0;
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = Math.round(cy + dy);
    if (yy < 0 || yy >= h) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const xx = Math.round(cx + dx);
      if (xx < 0 || xx >= w) continue;
      sum += gray[yy * w + xx]; cnt++;
    }
  }
  return cnt ? sum / cnt : 255;
}

// ---- NEW algorithm: percentile sampling radius 10, WITH exclusion ----
function newWhiteLevelField(gray, w, h, binsX, binsY, excludePoints, excludeRadius) {
  binsX = binsX || 5; binsY = binsY || 7;
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
  return { field, binW, binH, binsX, binsY };
}
function newSampleFillScore(gray, w, h, cx, cy, radius) {
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

const marks = [
  { name: "ExamSet_D", x: 269, y: 186 },
  { name: "Roll_col1_digit1", x: 190, y: 295 },
  { name: "Roll_col2_digit3", x: 220, y: 355 },
  { name: "Q1_A", x: 190, y: 655 },
  { name: "Q2_B", x: 220, y: 685 },
  { name: "Q3_C (BIG/BOLD mark)", x: 250, y: 715 },
  { name: "Q4_D", x: 280, y: 745 }
];

const THRESHOLD = 42;

console.log("=== OLD algorithm (mean, radius 8, no exclusion) ===");
const oldField = oldWhiteLevelField(gray, W, H, 5, 7);
marks.forEach(m => {
  const dark = fieldAt(oldField, m.x, m.y) - oldSampleDarkness(gray, W, H, m.x, m.y, 8);
  console.log(`${m.name.padEnd(24)} darkAt=${dark.toFixed(1).padStart(6)}  marked=${dark > THRESHOLD}`);
});

console.log("\n=== NEW algorithm (40th percentile, radius 10, white-field exclusion) ===");
const excludePoints = [];
EXAM_SET_CENTERS.forEach(cx => excludePoints.push({ x: cx, y: EXAM_SET_Y }));
rollCenters.forEach(c => { for (let d = 0; d <= 9; d++) excludePoints.push({ x: c, y: 265 + d * 30 }); });
for (let r = 0; r < 4; r++) { const cy = 655 + r * 30; qOptionCenters.forEach(cx => excludePoints.push({ x: cx, y: cy })); }
const newField = newWhiteLevelField(gray, W, H, 5, 7, excludePoints, 13);
marks.forEach(m => {
  const dark = fieldAt(newField, m.x, m.y) - newSampleFillScore(gray, W, H, m.x, m.y, 10);
  console.log(`${m.name.padEnd(24)} darkAt=${dark.toFixed(1).padStart(6)}  marked=${dark > THRESHOLD}`);
});
