/* ══════════════════════════════════════════════════════════════════
   SAVYASACHI — OMR SHEET GENERATOR + PHOTO-SCAN AUTO-GRADING
   ══════════════════════════════════════════════════════════════════
   1) Print/PDF OMR answer sheet for any existing Test (4 corner
      markers used for photo alignment, A–D bubbles per question).
   2) Admin uploads a photo of the filled sheet → this module detects
      the 4 corner markers, maps every bubble's expected position onto
      the photo (bilinear interpolation between the 4 corners), and
      measures bubble darkness to guess the marked option.
   3) Admin reviews/corrects the detected answers, then confirms —
      result is saved via the SAME saveRecordOnline() used by normal
      online tests, so it shows up in Records / Leaderboard normally.

   Reuses globals from script.js: tests, getDB, saveRecordOnline,
   getMarks, getNeg, escHtml. Nothing in script.js is modified.
   ══════════════════════════════════════════════════════════════════ */

(function () {

  // ── AI-POWERED SCANNING ────────────────────────────────────────
  // Paste your deployed Google Apps Script Web App URL here (see
  // OMR_AI_Scanner_AppScript.gs setup instructions in that file).
  // When set, the scanner sends the photo to Claude Vision (via that
  // script, so the API key never touches the browser) and uses its
  // reading as the primary result — far more robust than pixel-darkness
  // math against lighting, tilt, shadows, and phone-camera quirks.
  // When left empty, the scanner automatically falls back to the
  // original geometric pixel-darkness method below.
  const OMR_AI_ENDPOINT = ""; // e.g. "https://script.google.com/macros/s/AKfycb.../exec"

  const PAGE_W_MM = 210, PAGE_H_MM = 297;   // A4
  const MARKER_MM = 8;
  const MARGIN_MM = 6;

  /* ── Shared layout: used by BOTH the sheet generator and the
     scanner, so bubble positions always match exactly.
     Grid density (columns of 20 rows each) matches the BSEB-style
     100-question OMR sheet layout. ─────────────────────────────── */
  function computeOMRLayout(numQuestions) {
    numQuestions = Math.max(1, Math.min(100, numQuestions));
    const corners = {
      tl: { x: MARGIN_MM + MARKER_MM / 2, y: MARGIN_MM + MARKER_MM / 2 },
      tr: { x: PAGE_W_MM - MARGIN_MM - MARKER_MM / 2, y: MARGIN_MM + MARKER_MM / 2 },
      bl: { x: MARGIN_MM + MARKER_MM / 2, y: PAGE_H_MM - MARGIN_MM - MARKER_MM / 2 },
      br: { x: PAGE_W_MM - MARGIN_MM - MARKER_MM / 2, y: PAGE_H_MM - MARGIN_MM - MARKER_MM / 2 }
    };

    const gridTop = 76, gridBottom = corners.bl.y - 8;
    const gridLeft = corners.tl.x + 6, gridRight = corners.tr.x - 6;

    // Max 4 columns (25 rows each) — keeps a clear visual gap between one
    // column's last bubble and the next column's question number, so they
    // never look like they belong to the same question.
    const cols = Math.min(4, Math.max(1, Math.ceil(numQuestions / 25)));
    const rowsPerCol = Math.ceil(numQuestions / cols);
    const blockWidth = (gridRight - gridLeft) / cols;
    const rowHeight = Math.min(10.5, (gridBottom - gridTop) / rowsPerCol);

    const qLabelWidth = 10;   // mm reserved for "001" style label
    const gapWidth = 7;       // mm clear gap + divider line before next column
    const optSpacing = (blockWidth - qLabelWidth - gapWidth) / 4;

    const bubbles = [];
    for (let i = 0; i < numQuestions; i++) {
      const col = Math.floor(i / rowsPerCol);
      const rowInCol = i % rowsPerCol;
      const colX = gridLeft + col * blockWidth;
      const rowY = gridTop + rowInCol * rowHeight;
      const options = [0, 1, 2, 3].map(o => ({
        opt: o, x: colX + qLabelWidth + o * optSpacing + optSpacing / 2, y: rowY + rowHeight / 2
      }));
      bubbles.push({ q: i + 1, qLabelX: colX, qLabelY: rowY + rowHeight / 2, options });
    }

    const dividers = [];
    for (let c = 1; c < cols; c++) {
      dividers.push({ x: gridLeft + c * blockWidth - gapWidth / 2, yTop: gridTop - 4, yBottom: gridTop + rowsPerCol * rowHeight });
    }
    return {
      corners, bubbles, dividers, cols, optSpacing,
      // Full geometry exposed so buildOMRSheetDocx can render the grid at the
      // EXACT same mm coordinates the scanner assumes. Previously the docx
      // builder had its own hand-rolled table layout (colWidthMM=44, exact
      // 6.5mm rows, etc.) that had nothing to do with these numbers, so the
      // "template" the scanner mapped bubbles onto never matched what was
      // actually printed on paper — that mismatch (not the darkness sampling)
      // was the main source of wrong-option detections.
      gridTop, gridBottom, gridLeft, gridRight, blockWidth, rowHeight, rowsPerCol, qLabelWidth, gapWidth
    };
  }

  /* ── 1) SHEET GENERATOR (BSEB-style header + downloadable Word doc) ──
     NOTE: This used to render an absolutely-positioned HTML layout through
     html2canvas → jsPDF (a rasterization pipeline). That pipeline kept
     producing inconsistent output (large blank gaps, cropped columns)
     because html2canvas's offscreen-capture math is unreliable for a
     precise, single-page print layout.

     We now build a GENUINE .docx (Open XML Word document) client-side using
     the "docx" library (loaded via CDN in index.html as window.docx / DOCX).
     This is a real Word file, not an HTML-file-renamed-to-.doc trick, so
     Word/LibreOffice lay it out with their normal document engine — no
     rasterization step, nothing to crop or mis-position. Verified to render
     as a single A4 page with all 100 questions intact. ─────────────────── */

  function buildOMRSheetDocx(test, testId) {
    const D = window.docx;
    const mm = D.convertMillimetersToTwip;
    const n = test.questions.length;
    const circled = ["Ⓐ", "Ⓑ", "Ⓒ", "Ⓓ"];
    const noBorders = { top: { style: D.BorderStyle.NONE }, bottom: { style: D.BorderStyle.NONE }, left: { style: D.BorderStyle.NONE }, right: { style: D.BorderStyle.NONE } };

    // ── Question grid ──────────────────────────────────────────────
    // CRITICAL: this grid is now built from computeOMRLayout(), the SAME
    // function the scanner uses to know where every bubble is. Previously
    // this block had its own independent numbers (colWidthMM=44, exact
    // 6.5mm rows, its own column count) that had no relationship to the
    // coordinates the scanner assumed — so the "template" being scanned
    // never matched what was actually printed. Now both sides read from
    // one shared source of truth, and the whole grid is FLOATED at an
    // absolute position on the page (not flowed after the header), so its
    // position doesn't shift if the header text wraps differently.
    const layout = computeOMRLayout(n);
    const { cols, rowsPerCol, blockWidth, rowHeight, qLabelWidth } = layout;
    const outerGridCells = [];
    for (let c = 0; c < cols; c++) {
      const innerRows = [];
      for (let r = 0; r < rowsPerCol; r++) {
        const qNo = c * rowsPerCol + r + 1;
        if (qNo > n) continue;
        const qLabel = String(qNo).padStart(3, "0");
        const rowCells = [new D.TableCell({
          width: { size: mm(qLabelWidth), type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, borders: noBorders,
          children: [new D.Paragraph({ children: [new D.TextRun({ text: qLabel, bold: true, size: 18 })] })]
        })];
        const optW = (blockWidth - qLabelWidth) / 4;
        circled.forEach(ch => rowCells.push(new D.TableCell({
          width: { size: mm(optW), type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, borders: noBorders,
          children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: ch, size: 26 })] })]
        })));
        innerRows.push(new D.TableRow({ children: rowCells, height: { value: mm(rowHeight), rule: D.HeightRule.EXACT } }));
      }
      const innerTable = new D.Table({
        width: { size: mm(blockWidth), type: D.WidthType.DXA }, rows: innerRows,
        borders: { ...noBorders, insideHorizontal: { style: D.BorderStyle.NONE }, insideVertical: { style: D.BorderStyle.NONE } }
      });
      outerGridCells.push(new D.TableCell({
        width: { size: mm(blockWidth), type: D.WidthType.DXA },
        borders: { ...noBorders, left: c > 0 ? { style: D.BorderStyle.SINGLE, size: 2, color: "999999" } : { style: D.BorderStyle.NONE } },
        children: [innerTable]
      }));
    }
    // NOTE: this table used to be floated at an absolute page position (float:
    // { horizontalAnchor: PAGE, verticalAnchor: PAGE, ... }) so it would land
    // at an exact mm offset no matter how much space the header took up.
    // In practice, Word/WPS/LibreOffice all handle a large (~200mm tall)
    // page-anchored floating table very badly when it sits in the same flow
    // as normal paragraphs/tables above it: the anchor and the float fight
    // over the same space, the renderer decides it "doesn't fit" on page 1,
    // and it shoves the float (and sometimes the header too) onto page 2+,
    // with everything overlapping. That's what was producing the broken,
    // multi-page, overlapping OMR sheet.
    // Fix: let the grid flow normally, right after the instructions block.
    // Since gridTop/gridBottom in computeOMRLayout() already reserve exactly
    // enough vertical room for the header + info row + instructions above it
    // to fit on one A4 page, plain in-flow placement lands in the same spot
    // without any of the floating-table pagination bugs.
    const gridTable = new D.Table({
      width: { size: mm(layout.gridRight - layout.gridLeft), type: D.WidthType.DXA },
      rows: [new D.TableRow({ children: outerGridCells })],
      borders: { ...noBorders, insideHorizontal: { style: D.BorderStyle.NONE }, insideVertical: { style: D.BorderStyle.NONE } }
    });

    // ── Corner alignment markers ────────────────────────────────────
    // These are the fiducial squares the scanner's detectCorners() looks
    // for. Earlier versions of this file NEVER ACTUALLY DREW these on the
    // printed sheet — computeOMRLayout() only calculated where markers
    // "should" be, but nothing put ink on paper there. The scanner was
    // therefore hunting for corner squares that didn't exist, and latching
    // onto whatever dark thing (table borders, the photo box, instruction
    // text) happened to fall in each corner — which is what caused
    // essentially random wrong-option detection. These 4 small solid black
    // squares, floated at an absolute page position, fix that.
    const markerTables = ["tl", "tr", "bl", "br"].map(key => {
      const c = layout.corners[key];
      return new D.Table({
        width: { size: mm(MARKER_MM), type: D.WidthType.DXA },
        rows: [new D.TableRow({ height: { value: mm(MARKER_MM), rule: D.HeightRule.EXACT }, children: [
          new D.TableCell({ width: { size: mm(MARKER_MM), type: D.WidthType.DXA }, shading: { type: D.ShadingType.SOLID, color: "000000", fill: "000000" }, borders: noBorders, children: [new D.Paragraph({})] })
        ] })],
        borders: noBorders,
        float: {
          horizontalAnchor: D.TableAnchorType.PAGE, verticalAnchor: D.TableAnchorType.PAGE,
          absoluteHorizontalPosition: mm(c.x - MARKER_MM / 2), absoluteVerticalPosition: mm(c.y - MARKER_MM / 2)
        }
      });
    });

    // ── Header, candidate photo box, info lines, instructions ──
    const photoBox = new D.Table({
      width: { size: mm(28), type: D.WidthType.DXA },
      rows: [new D.TableRow({ height: { value: mm(34), rule: D.HeightRule.EXACT }, children: [
        new D.TableCell({ verticalAlign: D.VerticalAlign.CENTER, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: "Candidate Photo", size: 16, color: "666666" })] })] })
      ] })],
      borders: { top: { style: D.BorderStyle.SINGLE, size: 4 }, bottom: { style: D.BorderStyle.SINGLE, size: 4 }, left: { style: D.BorderStyle.SINGLE, size: 4 }, right: { style: D.BorderStyle.SINGLE, size: 4 } }
    });
    const infoRow = new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      rows: [new D.TableRow({ children: [
        new D.TableCell({ width: { size: mm(32), type: D.WidthType.DXA }, borders: noBorders, children: [photoBox] }),
        new D.TableCell({ verticalAlign: D.VerticalAlign.TOP, borders: noBorders, children: [
          new D.Paragraph({ children: [new D.TextRun("अभ्यर्थी का नाम / Candidate's Name: ________________________________")] }),
          new D.Paragraph({ spacing: { before: 120 }, children: [new D.TextRun("अनुक्रमांक / Roll Number: ______________   मोबाइल / Mobile: ______________")] }),
          new D.Paragraph({ spacing: { before: 120 }, children: [new D.TextRun(`Test ID: ${testId}   दिनांक / Date: ____________`)] })
        ] })
      ] })],
      borders: noBorders
    });
    const instructions = new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      rows: [new D.TableRow({ children: [
        new D.TableCell({
          shading: { type: D.ShadingType.SOLID, color: "F7F7F7", fill: "F7F7F7" },
          borders: { top: { style: D.BorderStyle.SINGLE, size: 4 }, bottom: { style: D.BorderStyle.SINGLE, size: 4 }, left: { style: D.BorderStyle.SINGLE, size: 4 }, right: { style: D.BorderStyle.SINGLE, size: 4 } },
          children: [new D.Paragraph({ children: [
            new D.TextRun({ text: "निर्देश (Instructions): ", bold: true }),
            new D.TextRun("वस्तुनिष्ठ प्रश्नों के सही उत्तर वाले गोले को नीले/काले बॉल पेन से पूरी तरह गहरा करें। Darken the correct circle completely using a Blue/Black Ball pen only.")
          ] })]
        })
      ] })],
      borders: noBorders
    });

    return new D.Document({
      sections: [{
        properties: { page: { size: { width: mm(210), height: mm(297) }, margin: { top: mm(10), bottom: mm(10), left: mm(14), right: mm(14) } } },
        children: [
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: "SAVYASACHI COACHING — OMR उत्तर पत्रक", bold: true, size: 32 })] }),
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 60 }, children: [new D.TextRun({ text: `${test.title || "Test"} (OMR Answer Sheet)`, bold: true, size: 22 })] }),
          new D.Paragraph({ spacing: { before: 150 }, children: [] }),
          infoRow,
          new D.Paragraph({ spacing: { before: 150 }, children: [] }),
          instructions,
          new D.Paragraph({ spacing: { before: 150 }, children: [] }),
          gridTable,
          ...markerTables
        ]
      }]
    });
  }

  async function downloadOMRSheetAsWord(test, testId) {
    if (!window.docx) throw new Error("Word library load nahi ho payi — internet connection check karein aur page reload karein.");
    const filename = `OMR-Sheet-${(test.title || "test").replace(/[^a-z0-9]+/gi, "-")}.docx`;
    const doc = buildOMRSheetDocx(test, testId);
    const blob = await window.docx.Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function generateOMRSheet() {
    const testId = document.getElementById("omr-sheet-test-select")?.value;
    if (!testId || typeof tests === "undefined" || !tests[testId]) { alert("Pehle test select karein."); return; }
    const test = tests[testId];
    if (!test.questions || !test.questions.length) { alert("Is test mein questions nahi hain."); return; }
    if (test.questions.length > 100) { alert("OMR sheet abhi max 100 questions tak support karti hai."); return; }

    const btn = document.getElementById("omr-generate-sheet-btn");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Word Doc Generate ho raha hai..."; }

    try {
      await downloadOMRSheetAsWord(test, testId);
    } catch (e) {
      console.error(e);
      alert("Word Doc generate karne mein error: " + (e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "🖨️ OMR Sheet Generate Karein (Word)"; }
    }
  }

  /* ── 2) SCANNER: corner detection + bubble darkness sampling ─── */

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function toGrayscale(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return gray;
  }

  // A phone photo of a printed sheet is almost never lit evenly — shadows,
  // warm indoor light, or glare all shift what "white paper" looks like in
  // grayscale. The old code compared every bubble against a fixed value
  // (255), so on a dim/yellowish photo even blank bubbles could look "dark
  // enough" (false marks), while on an overexposed photo a genuinely filled
  // bubble might not look dark enough (missed marks). This samples the
  // photo itself to find its actual paper-white level, and every darkness
  // comparison below is made relative to that.
  function estimateWhiteLevel(gray, w, h) {
    const samples = [];
    for (let i = 0; i < gray.length; i += 37) samples.push(gray[i]); // prime stride avoids periodic bias
    samples.sort((a, b) => a - b);
    // 85th percentile: most of a mostly-blank OMR sheet is white paper, so
    // this sits on the paper itself rather than on grid lines/text/bubbles.
    return samples[Math.floor(samples.length * 0.85)];
  }

  // A SINGLE global white level (above) assumes the whole photo is lit
  // evenly. In practice a phone's own shadow, a window's light on one side,
  // or an angled overhead light routinely makes one edge of the sheet
  // noticeably darker than the other — enough to push blank bubbles on the
  // dim side above MARK_THRESHOLD (false "marked" reads) while genuinely
  // filled bubbles on the bright side stay under it (missed marks). This
  // builds a coarse grid of LOCAL white levels across the photo and lets
  // any point on the page look up its own nearby paper-white value instead
  // of one number for the whole sheet.
  function estimateWhiteLevelField(gray, w, h, binsX, binsY) {
    binsX = binsX || 4; binsY = binsY || 6;
    const field = [];
    const binW = Math.ceil(w / binsX), binH = Math.ceil(h / binsY);
    for (let by = 0; by < binsY; by++) {
      const row = [];
      for (let bx = 0; bx < binsX; bx++) {
        const x0 = bx * binW, x1 = Math.min(w, x0 + binW);
        const y0 = by * binH, y1 = Math.min(h, y0 + binH);
        const samples = [];
        for (let y = y0; y < y1; y += 3) {
          for (let x = x0; x < x1; x += 3) samples.push(gray[y * w + x]);
        }
        samples.sort((a, b) => a - b);
        row.push(samples.length ? samples[Math.floor(samples.length * 0.85)] : 200);
      }
      field.push(row);
    }
    return {
      at(x, y) {
        // Bilinear-interpolate between the 4 nearest bin centers so the
        // white-level estimate changes smoothly across the page instead of
        // jumping at bin edges.
        const fx = Math.min(binsX - 1, Math.max(0, x / binW - 0.5));
        const fy = Math.min(binsY - 1, Math.max(0, y / binH - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = Math.min(binsX - 1, x0 + 1), y1 = Math.min(binsY - 1, y0 + 1);
        const tx = fx - x0, ty = fy - y0;
        const top = lerp(field[y0][x0], field[y0][x1], tx);
        const bot = lerp(field[y1][x0], field[y1][x1], tx);
        return lerp(top, bot, ty);
      }
    };
  }

  function findDarkestWindow(gray, w, x0, y0, x1, y1, win, stride) {
    let best = { score: 256, x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    for (let y = y0; y <= y1 - win; y += stride) {
      for (let x = x0; x <= x1 - win; x += stride) {
        let sum = 0, cnt = 0;
        for (let yy = y; yy < y + win; yy += 2) {
          for (let xx = x; xx < x + win; xx += 2) {
            sum += gray[yy * w + xx]; cnt++;
          }
        }
        const avg = sum / cnt;
        if (avg < best.score) best = { score: avg, x: x + win / 2, y: y + win / 2 };
      }
    }
    return best;
  }

  function detectCorners(gray, w, h) {
    // The printed marker is an 8mm solid square, centered 10mm in from each
    // page edge, on an A4 (210×297mm) page — so its expected position as a
    // FRACTION of the page is known and the same for every photo. We search
    // a generous window around that fraction (to tolerate the photo not
    // being framed exactly to the page edges, plus some tilt/rotation) but
    // make the SEARCH WINDOW SIZE roughly match the marker's own size. That
    // second part matters: a small window can sit entirely inside a bold
    // line of text or a table border and look just as dark as a solid
    // marker; a window sized close to the real marker footprint only comes
    // out fully-dark when it's actually on the solid square, so thin
    // text/lines score noticeably lighter and stop winning by accident.
    const win = Math.max(8, Math.round(Math.min(w * MARKER_MM / PAGE_W_MM, h * MARKER_MM / PAGE_H_MM) * 0.8));
    const stride = Math.max(2, Math.floor(win / 4));
    const searchFracX = 0.20, searchFracYTop = 0.20; // tolerance around the expected corner

    // BUG FIX: the bottom-left/bottom-right markers sit only ~8mm above the
    // grid's bottom edge by design (computeOMRLayout: gridBottom = corners.bl.y
    // - 8), so the sheet stays a single A4 page. A 20%-of-height search zone
    // (~59mm on A4) reaches straight past that 8mm gap into the last several
    // rows of answer bubbles. On any test with many questions (bubbles fill
    // most of the page), if a student's last few answers are filled in, this
    // made the darkest-window search latch onto a FILLED BUBBLE near the
    // bottom edge instead of the real corner marker — which silently shifts
    // every single bubble position computed from that corner (via bilinear
    // interpolation) and reads back wrong options across the whole sheet.
    // This is almost certainly the "student marked X, sheet shows Y" bug.
    // Fix: keep the top search generous (the gap above the grid is ~66mm,
    // plenty of room), but tighten the bottom search to stay inside the
    // actual physical gap so it can no longer reach into the bubble grid.
    const searchFracYBottom = 0.06;
    const sx = Math.floor(w * searchFracX);
    const syTop = Math.floor(h * searchFracYTop);
    const syBottom = Math.floor(h * searchFracYBottom);
    const found = {
      tl: findDarkestWindow(gray, w, 0, 0, sx, syTop, win, stride),
      tr: findDarkestWindow(gray, w, w - sx, 0, w, syTop, win, stride),
      bl: findDarkestWindow(gray, w, 0, h - syBottom, sx, h, win, stride),
      br: findDarkestWindow(gray, w, w - sx, h - syBottom, w, h, win, stride)
    };

    // ISOLATION CHECK: a real corner marker is a solid 8mm square surrounded
    // by plain white paper margin. Anything else that scores similarly dark
    // (a run of table-border lines, a cluster of filled bubbles, bold text)
    // usually has more dark pixels packed AROUND it too. Sample a ring just
    // outside each found window — if that ring isn't clearly lighter than
    // the window itself, this corner's detection is unreliable, and every
    // bubble position computed from it (via bilinear interpolation) would
    // be off. We flag this per-corner rather than silently trusting it.
    const ringGap = Math.round(win * 0.6);
    for (const key of ["tl", "tr", "bl", "br"]) {
      const c = found[key];
      const ringScore = sampleRing(gray, w, h, c.x, c.y, win / 2 + ringGap, win / 2 + ringGap + Math.round(win * 0.5));
      c.isolated = (ringScore - c.score) > 40; // ring should read noticeably whiter than the marker
    }
    return found;
  }

  // Average darkness along a ring (annulus) around (cx,cy) between the two
  // given radii — used to confirm a detected corner marker sits on plain
  // white paper, not inside a larger dark cluster.
  function sampleRing(gray, w, h, cx, cy, rInner, rOuter) {
    let sum = 0, cnt = 0;
    const step = Math.max(1, Math.round((rOuter - rInner) / 3));
    for (let r = rInner; r <= rOuter; r += step) {
      const steps = 12;
      for (let i = 0; i < steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        const xx = Math.round(cx + r * Math.cos(ang));
        const yy = Math.round(cy + r * Math.sin(ang));
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        sum += gray[yy * w + xx]; cnt++;
      }
    }
    return cnt ? sum / cnt : 255;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function templateToPixel(layout, corners, xMM, yMM) {
    const u = (xMM - layout.corners.tl.x) / (layout.corners.tr.x - layout.corners.tl.x);
    const v = (yMM - layout.corners.tl.y) / (layout.corners.bl.y - layout.corners.tl.y);
    const topX = lerp(corners.tl.x, corners.tr.x, u), topY = lerp(corners.tl.y, corners.tr.y, u);
    const botX = lerp(corners.bl.x, corners.br.x, u), botY = lerp(corners.bl.y, corners.br.y, u);
    return { x: lerp(topX, botX, v), y: lerp(topY, botY, v) };
  }

  function sampleDarkness(gray, w, h, cx, cy, radius) {
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

  let detectedAnswers = [];

  // Original geometric method: find corner markers, map every bubble by
  // bilinear interpolation, measure ink darkness. Kept as an automatic
  // fallback for when the AI endpoint isn't configured or is unreachable
  // (e.g. no internet, Apps Script quota, key not set yet).
  function detectAnswersByPixels(ctx, w, h, test) {
    const gray = toGrayscale(ctx, w, h);
    const corners = detectCorners(gray, w, h);
    const layout = computeOMRLayout(test.questions.length);
    const radius = Math.max(4, Math.round(Math.min(w, h) * 0.012));
    // Local white-level field instead of one global number — handles a
    // shadow or uneven light falling across the photo (see
    // estimateWhiteLevelField comment for why this matters).
    const whiteField = estimateWhiteLevelField(gray, w, h);
    const MARK_THRESHOLD = 45; // "dark" is measured relative to this bubble's own local paper-white level

    const cornersReliable = ["tl", "tr", "bl", "br"].every(k => corners[k].isolated !== false);

    const answers = layout.bubbles.map(b => {
      const scored = b.options.map(o => {
        const px = templateToPixel(layout, corners, o.x, o.y);
        const localWhite = whiteField.at(px.x, px.y);
        return { opt: o.opt, dark: localWhite - sampleDarkness(gray, w, h, px.x, px.y, radius) };
      }).sort((a, b2) => b2.dark - a.dark);
      const top = scored[0], second = scored[1];
      let detected = null, confidence;
      if (top.dark > MARK_THRESHOLD) {
        detected = top.opt;
        confidence = (top.dark - second.dark > 30) ? "high" : (top.dark - second.dark > 12) ? "medium" : "unclear";
      } else {
        confidence = (MARK_THRESHOLD - top.dark > 15) ? "blank" : "unclear";
      }
      return { q: b.q, detected, confidence };
    });

    return { answers, cornersReliable };
  }

  // AI method: sends the photo to Claude Vision (via the Apps Script proxy
  // in OMR_AI_ENDPOINT, so the API key stays server-side) and asks it to
  // read every question's marked bubble directly off the image. This
  // sidesteps corner-marker detection and darkness thresholds entirely —
  // it reads the photo the way a human checker would — so it's far less
  // sensitive to uneven lighting, slight tilt, shadows, or a slightly
  // mis-cropped photo, which were the main causes of wrong detections in
  // the pixel-based method.
  async function detectAnswersWithAI(canvas, numQuestions) {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const commaIdx = dataUrl.indexOf(",");
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
    const imageBase64 = dataUrl.slice(commaIdx + 1);

    const res = await fetch(OMR_AI_ENDPOINT, {
      method: "POST",
      // text/plain avoids a CORS preflight against Apps Script (which
      // doesn't handle OPTIONS) — the body is still valid JSON, and
      // doPost() on the server parses e.postData.contents as JSON.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ imageBase64, mimeType, numQuestions })
    });
    if (!res.ok) throw new Error("AI endpoint HTTP " + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "AI endpoint returned an error");

    const letters = ["A", "B", "C", "D"];
    return data.answers.map(r => ({
      q: r.q,
      detected: r.detected ? letters.indexOf(r.detected) : null,
      // AI doesn't give a numeric confidence, but it's told to return null
      // instead of guessing on genuinely ambiguous bubbles — so treat every
      // non-null answer as high confidence and every null as blank/unclear,
      // still fully editable in the review step either way.
      confidence: r.detected ? "high" : "blank"
    }));
  }

  async function scanOMRSheet() {
    const testId = document.getElementById("omr-scan-test-select")?.value;
    const nameInput = document.getElementById("omr-scan-student-name");
    const mobileInput = document.getElementById("omr-scan-student-mobile");
    const fileInput = document.getElementById("omr-scan-file-input");
    const statusEl = document.getElementById("omr-scan-status");

    if (!testId || typeof tests === "undefined" || !tests[testId]) { alert("Pehle test select karein."); return; }
    const test = tests[testId];
    if (!fileInput?.files?.length) { alert("Pehle OMR sheet ki photo upload karein."); return; }
    const name = (nameInput?.value || "").trim();
    const mobile = (mobileInput?.value || "").trim();
    if (!name || !/^\d{10}$/.test(mobile)) { alert("Student ka naam aur sahi 10-digit mobile number bharein."); return; }

    if (statusEl) statusEl.textContent = "⏳ Scan ho raha hai...";
    const scanBtn = document.getElementById("omr-scan-btn");
    if (scanBtn) scanBtn.disabled = true;

    try {
      const img = await loadImageFromFile(fileInput.files[0]);
      const maxDim = 1400;

      // ORIENTATION FIX: the OMR sheet is always printed A4 portrait, but
      // phones commonly save a sideways photo (held horizontally) without
      // rotating the pixel data — only an EXIF orientation flag, which
      // browsers often ignore when drawing into a <canvas>. A landscape
      // (wider-than-tall) image processed as if it were portrait would put
      // every corner marker and bubble in the wrong place. Since we know
      // the sheet must be portrait, a clearly-landscape photo is rotated
      // 90° here before anything else runs.
      const isLandscape = img.width > img.height * 1.15;
      const srcW = isLandscape ? img.height : img.width;
      const srcH = isLandscape ? img.width : img.height;
      const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
      const w = Math.round(srcW * scale), h = Math.round(srcH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (isLandscape) {
        ctx.translate(w, 0);
        ctx.rotate(Math.PI / 2);
        // after rotate(90°), draw using the ORIGINAL (unrotated) image
        // dimensions scaled to fit the now-swapped canvas
        ctx.drawImage(img, 0, 0, h, w);
      } else {
        ctx.drawImage(img, 0, 0, w, h);
      }

      let usedAI = false;
      let cornersReliable = true;
      if (OMR_AI_ENDPOINT) {
        if (statusEl) statusEl.textContent = "⏳ AI se sheet padhi ja rahi hai...";
        try {
          detectedAnswers = await detectAnswersWithAI(canvas, test.questions.length);
          usedAI = true;
        } catch (aiErr) {
          console.warn("AI OMR detection failed, falling back to pixel method:", aiErr);
          if (statusEl) statusEl.textContent = "⚠️ AI detection fail hui, pixel-method se try kar rahe hain...";
        }
      }

      if (!usedAI) {
        const result = detectAnswersByPixels(ctx, w, h, test);
        detectedAnswers = result.answers;
        cornersReliable = result.cornersReliable;
      }

      renderOMRReview(test, name, mobile, testId, usedAI, cornersReliable);
      if (statusEl) {
        statusEl.textContent = cornersReliable
          ? "✅ Scan complete — neeche review karke confirm karein."
          : "⚠️ Scan hui, lekin corner markers spasht nahi mile — neeche har answer zaroor check karein.";
      }
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = "";
      alert("Scan karne mein error: " + (err.message || err));
    } finally {
      if (scanBtn) scanBtn.disabled = false;
    }
  }

  function renderOMRReview(test, name, mobile, testId, usedAI, cornersReliable) {
    const container = document.getElementById("omr-review-area");
    if (!container) return;
    const letters = ["A", "B", "C", "D"];
    let unclearCount = 0;
    const badgeFor = { high: "✅", medium: "🟡", unclear: "⚠️", blank: "⬜" };
    const rows = detectedAnswers.map(r => {
      if (r.confidence === "unclear") unclearCount++;
      const badge = badgeFor[r.confidence] || "⚠️";
      const opts = [0, 1, 2, 3].map(o => `<option value="${o}" ${r.detected === o ? "selected" : ""}>${letters[o]}</option>`).join("")
        + `<option value="" ${r.detected === null ? "selected" : ""}>— Blank —</option>`;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:.85rem;${r.confidence === "unclear" ? "background:#fffbeb;" : ""}">
          <span style="width:56px;font-weight:700;">${badge} Q${r.q}</span>
          <select data-q="${r.q}" class="omr-answer-select" style="padding:3px 6px;">${opts}</select>
        </div>`;
    }).join("");

    const methodNote = usedAI
      ? `<span style="color:#059669;">🤖 AI (Claude Vision) se detect kiya gaya</span>`
      : `<span style="color:#64748b;">📐 Pixel-darkness method se detect kiya gaya${OMR_AI_ENDPOINT ? " (AI abhi fail hui, fallback use hua)" : " (AI configure nahi hai)"}</span>`;

    const cornerWarning = (!usedAI && cornersReliable === false)
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:.82rem;">
           ⚠️ Corner markers (4 kone ke kaale square) photo mein spasht nahi mile — poori sheet ki position galat ho sakti hai.
           Har answer neeche zaroor check karein, ya sheet ko flat rakh ke, achi roshni mein, seedhe upar se dobara photo lekar re-scan karein.
         </div>`
      : "";

    container.innerHTML = `
      <div class="card" style="margin-top:14px;">
        <h4 style="margin-bottom:6px;">📝 Review Detected Answers ${unclearCount ? `<span style="color:#d97706;font-size:.8rem;">(${unclearCount} unclear — kripya check karein)</span>` : ""}</h4>
        ${cornerWarning}
        <p class="muted-text" style="margin-bottom:2px;font-size:.8rem;">${methodNote}</p>
        <p class="muted-text" style="margin-bottom:8px;">✅ confident marked · 🟡 medium confidence · ⚠️ unclear, verify karein khud · ⬜ confidently blank (not attempted). Dropdown se koi bhi answer badal sakte hain.</p>
        <div style="max-height:340px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">${rows}</div>
        <button type="button" id="omr-confirm-save-btn" class="btn-primary" style="margin-top:12px;">✅ Confirm & Result Save Karein</button>
      </div>`;

    document.getElementById("omr-confirm-save-btn").onclick = () => confirmAndSaveOMR(test, name, mobile, testId);
  }

  async function confirmAndSaveOMR(test, name, mobile, testId) {
    const selects = document.querySelectorAll(".omr-answer-select");
    const answers = {};
    selects.forEach(sel => {
      const q = Number(sel.getAttribute("data-q"));
      answers[q] = sel.value === "" ? null : Number(sel.value);
    });

    let correct = 0, wrong = 0, unattempted = 0, pendingSubjective = 0;
    const marks = getMarks(test), neg = getNeg(test);
    // Online exam ki tarah hi "attempt any N" limit yahan bhi lagti hai —
    // agar test mein attemptLimit set hai to sirf pehle N attempted MCQs
    // hi count honge, baaki "Extra (Not Counted)" ban jaate hain — taaki
    // OMR/offline result online result se hamesha match kare.
    const attemptLimit = Number(test.attemptLimit) > 0 ? Number(test.attemptLimit) : null;
    let attemptedSoFar = 0, extraCount = 0;
    const details = test.questions.map((ques, idx) => {
      const qNo = idx + 1;
      const sel = answers[qNo];
      const isSubjective = ques.qType === "subjective";
      const qM = (typeof getQuestionMarks === "function") ? getQuestionMarks(test, ques) : marks;

      // Subjective (long-answer) questions aren't bubble-answers, so the
      // OMR sheet has no MCQ option to match here. They can't be
      // auto-scored — mark them "Pending Review" (same as the online
      // quiz flow) so they show up in the admin "Grade Subjective" tab,
      // where marks get added in by hand and folded into the total.
      if (isSubjective) {
        pendingSubjective++;
        return {
          questionNo: qNo, subject: ques.subject || "", chapter: ques.chapter || "",
          questionEN: ques.textEN || ques.text || "", questionHI: ques.textHI || ques.text || "",
          optionsEN: [], optionsHI: [],
          correctAnswer: null, studentAnswer: null,
          qType: "subjective", subjectiveGraded: false,
          status: "Pending Review", marksAwarded: 0, marksPerQuestion: qM,
          explanationEN: ques.explanationEN || ques.explanation || "",
          explanationHI: ques.explanationHI || ques.explanation || ""
        };
      }

      const blank = sel === null || sel === undefined;
      const right = !blank && sel === ques.answer;
      let counted = true;
      if (!blank) {
        attemptedSoFar++;
        if (attemptLimit && attemptedSoFar > attemptLimit) { counted = false; extraCount++; }
      }
      if (counted) { if (blank) unattempted++; else if (right) correct++; else wrong++; }
      return {
        questionNo: qNo, subject: ques.subject || "", chapter: ques.chapter || "",
        questionEN: ques.textEN || ques.text || "", questionHI: ques.textHI || ques.text || "",
        optionsEN: ques.optionsEN || ques.options || [], optionsHI: ques.optionsHI || ques.options || [],
        correctAnswer: ques.answer, studentAnswer: blank ? null : sel,
        qType: "mcq", status: blank ? "Not answered" : !counted ? "Extra (Not Counted)" : right ? "Correct" : "Wrong",
        marksAwarded: (blank || !counted) ? 0 : right ? qM : (neg > 0 ? -neg : 0), marksPerQuestion: qM,
        explanationEN: ques.explanationEN || ques.explanation || "",
        explanationHI: ques.explanationHI || ques.explanation || ""
      };
    });
    // maxScore hamesha getTestMaxMarks() (shared function) se — same jo
    // online exam aur admin test-list use karte hain, taaki attemptLimit
    // wale tests ka result OMR/Manual Entry mein bhi sahi (70/100 ki jagah
    // 130/100 jaisi galti nahi) dikhe.
    const maxScore = (typeof getTestMaxMarks === "function") ? getTestMaxMarks(test) : details.reduce((s, d) => s + (Number(d.marksPerQuestion) || marks), 0);
    const score = details.reduce((s, d) => s + d.marksAwarded, 0);
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const submittedAt = new Date();

    try {
      await saveRecordOnline({
        name, mobile, email: "",
        testId, testTitle: test.title, testMode: "OMR Offline",
        totalQuestions: test.questions.length, attempted: correct + wrong,
        negativeEnabled: neg > 0, negativeMarks: neg,
        maxScore, score, percentage: pct, correct, wrong, unattempted, details,
        pendingSubjective,
        durationSeconds: 0,
        submittedAt: submittedAt.toLocaleString("en-IN"),
        submittedIso: submittedAt.toISOString()
      });
      alert(`✅ Result save ho gaya!\n${name}: ${score}/${maxScore} (${Math.round(pct)}%)` + (pendingSubjective ? `\n📝 ${pendingSubjective} subjective answer(s) abhi bhi grading ke liye pending hain — "Grade Subjective" tab mein jaakar marks daalein.` : ""));
      document.getElementById("omr-review-area").innerHTML = "";
      document.getElementById("omr-scan-file-input").value = "";
      document.getElementById("omr-scan-student-name").value = "";
      document.getElementById("omr-scan-student-mobile").value = "";
      const statusEl = document.getElementById("omr-scan-status");
      if (statusEl) statusEl.textContent = "";
    } catch (err) {
      console.error(err);
      alert("Result save karne mein error: " + (err.message || err));
    }
  }

  /* ── 4) MANUAL ANSWER ENTRY (type "1 c 2 b 3 a ..." → grade + save) ──
     Same idea as photo-scan grading, minus the photo: admin types the
     student's answers as plain text (question number + option letter,
     in almost any reasonable separator style), reviews/corrects them in
     an editable table exactly like the scan-review step, then Confirm &
     Save runs through the SAME scoring + saveRecordOnline() path as the
     photo-scan flow — so results land in Records/Leaderboard identically,
     just tagged testMode "Manual Entry" instead of "OMR Offline". ────── */

  const LETTER_TO_OPT = { a: 0, b: 1, c: 2, d: 3 };

  // Accepts formats like: "1 c 2 b 3 a", "1) C  2) B", "1-c,2-b,3-a",
  // "1. c\n2. b\n3. a", or even "1c2b3a" with no separators at all.
  // "x" or "-" after the number marks that question as not attempted.
  function parseManualAnswers(text, numQuestions) {
    const answers = {};
    const re = /(\d{1,3})\s*[).:\-]?\s*([abcdABCD]|[xX]|-)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const q = parseInt(m[1], 10);
      if (!q || q < 1 || q > numQuestions) continue;
      const letter = m[2].toLowerCase();
      answers[q] = (letter === "x" || letter === "-") ? null : LETTER_TO_OPT[letter];
    }
    return answers;
  }

  function parseAndPreviewManual() {
    const testId = document.getElementById("omr-manual-test-select")?.value;
    const nameInput = document.getElementById("omr-manual-student-name");
    const mobileInput = document.getElementById("omr-manual-student-mobile");
    const textInput = document.getElementById("omr-manual-answers-text");
    const statusEl = document.getElementById("omr-manual-status");

    if (!testId || typeof tests === "undefined" || !tests[testId]) { alert("Pehle test select karein."); return; }
    const test = tests[testId];
    const name = (nameInput?.value || "").trim();
    const mobile = (mobileInput?.value || "").trim();
    if (!name || !/^\d{10}$/.test(mobile)) { alert("Student ka naam aur sahi 10-digit mobile number bharein."); return; }
    const raw = (textInput?.value || "").trim();
    if (!raw) { alert("Pehle answers type karein — jaise: 1 c 2 b 3 a"); return; }

    const answers = parseManualAnswers(raw, test.questions.length);
    if (Object.keys(answers).length === 0) {
      if (statusEl) statusEl.textContent = "⚠️ Koi bhi answer samajh nahi aaya — format check karein (jaise: 1 c 2 b 3 a).";
      return;
    }
    if (statusEl) statusEl.textContent = `✅ ${Object.keys(answers).length} / ${test.questions.length} answers mile — neeche review karke confirm karein.`;
    renderManualReview(test, name, mobile, testId, answers);
  }

  function renderManualReview(test, name, mobile, testId, answers) {
    const container = document.getElementById("omr-manual-review-area");
    if (!container) return;
    const letters = ["A", "B", "C", "D"];
    let missingCount = 0;
    const rows = test.questions.map((ques, idx) => {
      const q = idx + 1;
      const has = Object.prototype.hasOwnProperty.call(answers, q);
      if (!has) missingCount++;
      const val = has ? answers[q] : null;
      const opts = [0, 1, 2, 3].map(o => `<option value="${o}" ${val === o ? "selected" : ""}>${letters[o]}</option>`).join("")
        + `<option value="" ${val === null ? "selected" : ""}>— Blank —</option>`;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:.85rem;${!has ? "background:#fffbeb;" : ""}">
          <span style="width:64px;font-weight:700;">${has ? "✅" : "⚠️"} Q${q}</span>
          <select data-q="${q}" class="omr-manual-answer-select" style="padding:3px 6px;">${opts}</select>
        </div>`;
    }).join("");

    container.innerHTML = `
      <div class="card" style="margin-top:14px;">
        <h4 style="margin-bottom:6px;">📝 Review Answers ${missingCount ? `<span style="color:#d97706;font-size:.8rem;">(${missingCount} nahi mile — blank maan liya, check karein)</span>` : ""}</h4>
        <p class="muted-text" style="margin-bottom:8px;">✅ text se mila · ⚠️ nahi mila (blank set kiya, dropdown se sahi answer bharein).</p>
        <div style="max-height:340px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">${rows}</div>
        <button type="button" id="omr-manual-confirm-save-btn" class="btn-primary" style="margin-top:12px;">✅ Confirm & Result Save Karein</button>
      </div>`;

    document.getElementById("omr-manual-confirm-save-btn").onclick = () => confirmAndSaveManual(test, name, mobile, testId);
  }

  async function confirmAndSaveManual(test, name, mobile, testId) {
    const selects = document.querySelectorAll(".omr-manual-answer-select");
    const answers = {};
    selects.forEach(sel => {
      const q = Number(sel.getAttribute("data-q"));
      answers[q] = sel.value === "" ? null : Number(sel.value);
    });

    let correct = 0, wrong = 0, unattempted = 0, pendingSubjective = 0;
    const marks = getMarks(test), neg = getNeg(test);
    // Online exam ki tarah hi "attempt any N" limit yahan bhi lagti hai.
    const attemptLimit = Number(test.attemptLimit) > 0 ? Number(test.attemptLimit) : null;
    let attemptedSoFar = 0, extraCount = 0;
    const details = test.questions.map((ques, idx) => {
      const qNo = idx + 1;
      const sel = answers[qNo];
      const isSubjective = ques.qType === "subjective";
      const qM = (typeof getQuestionMarks === "function") ? getQuestionMarks(test, ques) : marks;

      // Same reasoning as confirmAndSaveOMR above: subjective questions
      // have no MCQ option to type in here either, so mark them pending
      // for manual grading instead of scoring them as wrong.
      if (isSubjective) {
        pendingSubjective++;
        return {
          questionNo: qNo, subject: ques.subject || "", chapter: ques.chapter || "",
          questionEN: ques.textEN || ques.text || "", questionHI: ques.textHI || ques.text || "",
          optionsEN: [], optionsHI: [],
          correctAnswer: null, studentAnswer: null,
          qType: "subjective", subjectiveGraded: false,
          status: "Pending Review", marksAwarded: 0, marksPerQuestion: qM,
          explanationEN: ques.explanationEN || ques.explanation || "",
          explanationHI: ques.explanationHI || ques.explanation || ""
        };
      }

      const blank = sel === null || sel === undefined;
      const right = !blank && sel === ques.answer;
      let counted = true;
      if (!blank) {
        attemptedSoFar++;
        if (attemptLimit && attemptedSoFar > attemptLimit) { counted = false; extraCount++; }
      }
      if (counted) { if (blank) unattempted++; else if (right) correct++; else wrong++; }
      return {
        questionNo: qNo, subject: ques.subject || "", chapter: ques.chapter || "",
        questionEN: ques.textEN || ques.text || "", questionHI: ques.textHI || ques.text || "",
        optionsEN: ques.optionsEN || ques.options || [], optionsHI: ques.optionsHI || ques.options || [],
        correctAnswer: ques.answer, studentAnswer: blank ? null : sel,
        qType: "mcq", status: blank ? "Not answered" : !counted ? "Extra (Not Counted)" : right ? "Correct" : "Wrong",
        marksAwarded: (blank || !counted) ? 0 : right ? qM : (neg > 0 ? -neg : 0), marksPerQuestion: qM,
        explanationEN: ques.explanationEN || ques.explanation || "",
        explanationHI: ques.explanationHI || ques.explanation || ""
      };
    });
    // maxScore hamesha getTestMaxMarks() (shared function) se — attemptLimit
    // wale tests ka result yahan bhi sahi (130/100 jaisi galti nahi) dikhe.
    const maxScore = (typeof getTestMaxMarks === "function") ? getTestMaxMarks(test) : details.reduce((s, d) => s + (Number(d.marksPerQuestion) || marks), 0);
    const score = details.reduce((s, d) => s + d.marksAwarded, 0);
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const submittedAt = new Date();

    try {
      await saveRecordOnline({
        name, mobile, email: "",
        testId, testTitle: test.title, testMode: "Manual Entry",
        totalQuestions: test.questions.length, attempted: correct + wrong,
        negativeEnabled: neg > 0, negativeMarks: neg,
        maxScore, score, percentage: pct, correct, wrong, unattempted, details,
        pendingSubjective,
        durationSeconds: 0,
        submittedAt: submittedAt.toLocaleString("en-IN"),
        submittedIso: submittedAt.toISOString()
      });
      alert(`✅ Result save ho gaya!\n${name}: ${score}/${maxScore} (${Math.round(pct)}%)` + (pendingSubjective ? `\n📝 ${pendingSubjective} subjective answer(s) abhi bhi grading ke liye pending hain — "Grade Subjective" tab mein jaakar marks daalein.` : ""));
      document.getElementById("omr-manual-review-area").innerHTML = "";
      document.getElementById("omr-manual-answers-text").value = "";
      document.getElementById("omr-manual-student-name").value = "";
      document.getElementById("omr-manual-student-mobile").value = "";
      const statusEl = document.getElementById("omr-manual-status");
      if (statusEl) statusEl.textContent = "";
    } catch (err) {
      console.error(err);
      alert("Result save karne mein error: " + (err.message || err));
    }
  }

  /* ── SEARCHABLE TEST SELECT (type to filter saved tests) ────────
     Wraps a plain <select> with a text-input + dropdown list so the
     user can either type to filter the saved tests, or click to open
     the full list and pick one. The underlying <select> keeps working
     exactly as before (same id, same .value, same "change" event) so
     no other code needs to change. ──────────────────────────────── */

  const _searchableSelects = new WeakMap();

  function enhanceSearchableSelect(selectEl) {
    if (!selectEl || _searchableSelects.has(selectEl)) return;

    const wrap = document.createElement("div");
    wrap.className = "searchable-select-wrap";
    selectEl.parentNode.insertBefore(wrap, selectEl);
    wrap.appendChild(selectEl);
    selectEl.classList.add("searchable-select-native");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "searchable-select-input";
    input.placeholder = "Test type karke dhoondhein ya list se chunein…";
    input.autocomplete = "off";
    wrap.appendChild(input);

    const list = document.createElement("div");
    list.className = "searchable-select-list hidden";
    wrap.appendChild(list);

    let activeIndex = -1;

    function getOptions() {
      return Array.from(selectEl.options).filter(o => o.value !== "");
    }

    function renderList(filterText) {
      const q = (filterText || "").trim().toLowerCase();
      const opts = getOptions().filter(o => !q || o.textContent.toLowerCase().includes(q));
      list.innerHTML = "";
      activeIndex = -1;
      if (!opts.length) {
        const empty = document.createElement("div");
        empty.className = "searchable-select-empty";
        empty.textContent = q ? `"${filterText}" se milta koi saved test nahi mila` : "Koi saved test nahi mila";
        list.appendChild(empty);
        return;
      }
      opts.forEach(o => {
        const item = document.createElement("div");
        item.className = "searchable-select-option";
        item.textContent = o.textContent;
        item.dataset.value = o.value;
        if (o.value === selectEl.value) item.classList.add("active");
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          pick(o.value, o.textContent);
        });
        list.appendChild(item);
      });
    }

    function pick(value, text) {
      selectEl.value = value;
      input.value = text || "";
      closeList();
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function openList() {
      renderList(input.value);
      list.classList.remove("hidden");
      wrap.classList.add("open");
    }
    function closeList() {
      list.classList.add("hidden");
      wrap.classList.remove("open");
      activeIndex = -1;
    }

    input.addEventListener("focus", openList);
    input.addEventListener("click", openList);
    input.addEventListener("input", () => {
      if (!input.value) selectEl.value = "";
      openList();
    });
    input.addEventListener("keydown", (e) => {
      const items = Array.from(list.querySelectorAll(".searchable-select-option"));
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (list.classList.contains("hidden")) { openList(); return; }
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle("highlight", i === activeIndex));
        items[activeIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        items.forEach((it, i) => it.classList.toggle("highlight", i === activeIndex));
        items[activeIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          pick(items[activeIndex].dataset.value, items[activeIndex].textContent);
        }
      } else if (e.key === "Escape") {
        closeList();
        input.blur();
      }
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) closeList();
    });

    _searchableSelects.set(selectEl, { input, list, renderList });
    syncSearchableSelectDisplay(selectEl);
  }

  function syncSearchableSelectDisplay(selectEl) {
    const rec = _searchableSelects.get(selectEl);
    if (!rec) return;
    const opt = selectEl.options[selectEl.selectedIndex];
    rec.input.value = (opt && opt.value) ? opt.textContent : "";
  }

  /* ── STUDENT NAME / WHATSAPP AUTOCOMPLETE (Students Directory se) ─
     Suggests students straight from Students Directory (`allStudentsCache`,
     script.js mein load hota hai — yahi list jo Records → Students
     Directory mein dikhti hai, i.e. ALL registered students) as the admin
     types in the Naam / WhatsApp Number fields. Picking a suggestion
     auto-fills BOTH fields with the EXACT registered name+mobile, so the
     Manual Entry record hamesha sahi student ke registered account se
     match ho (Students Directory ka record-count sahi rahe). Typing a
     name/number that isn't registered yet still works like a normal text
     box — nothing is forced to match the list. ───────────────────────── */

  function getUniqueSavedStudents() {
    if (typeof allStudentsCache === "undefined" || !Array.isArray(allStudentsCache)) return [];
    return allStudentsCache
      .map(s => ({ name: (s.name || "").trim(), mobile: (s.mobile || "").trim() }))
      .filter(s => s.name || s.mobile);
  }

  function enhanceStudentAutocomplete(nameInput, mobileInput) {
    [
      { input: nameInput, matchField: "name", fillOther: mobileInput, otherField: "mobile" },
      { input: mobileInput, matchField: "mobile", fillOther: nameInput, otherField: "name" }
    ].forEach(cfg => {
      const input = cfg.input;
      if (!input || input.dataset.autocompleteBound) return;
      input.dataset.autocompleteBound = "1";
      input.autocomplete = "off";

      const wrap = document.createElement("div");
      wrap.className = "searchable-select-wrap";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);

      const list = document.createElement("div");
      list.className = "searchable-select-list hidden";
      wrap.appendChild(list);

      let activeIndex = -1;

      function render() {
        const q = input.value.trim().toLowerCase();
        if (!q) { list.classList.add("hidden"); return; }
        const students = getUniqueSavedStudents().filter(s => (s[cfg.matchField] || "").toLowerCase().includes(q));
        list.innerHTML = "";
        activeIndex = -1;
        if (!students.length) {
          const empty = document.createElement("div");
          empty.className = "searchable-select-empty";
          empty.textContent = "Koi registered student nahi mila — naya naam/number type karte rahein";
          list.appendChild(empty);
          list.classList.remove("hidden");
          return;
        }
        students.slice(0, 8).forEach(s => {
          const item = document.createElement("div");
          item.className = "searchable-select-option";
          item.textContent = (s.name && s.mobile) ? `${s.name} — ${s.mobile}` : (s.name || s.mobile);
          item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            input.value = s[cfg.matchField] || "";
            if (s[cfg.otherField]) cfg.fillOther.value = s[cfg.otherField];
            closeList();
          });
          list.appendChild(item);
        });
        list.classList.remove("hidden");
      }

      function closeList() {
        list.classList.add("hidden");
        activeIndex = -1;
      }

      input.addEventListener("input", render);
      input.addEventListener("focus", () => { if (input.value.trim()) render(); });
      document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) closeList(); });
      input.addEventListener("keydown", (e) => {
        const items = Array.from(list.querySelectorAll(".searchable-select-option"));
        if (!items.length) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, items.length - 1);
          items.forEach((it, i) => it.classList.toggle("highlight", i === activeIndex));
          items[activeIndex]?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          activeIndex = Math.max(activeIndex - 1, 0);
          items.forEach((it, i) => it.classList.toggle("highlight", i === activeIndex));
          items[activeIndex]?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
          if (activeIndex >= 0 && items[activeIndex]) {
            e.preventDefault();
            items[activeIndex].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          }
        } else if (e.key === "Escape") {
          closeList();
        }
      });
    });
  }

  /* ── INIT / WIRING ────────────────────────────────────────────── */

  let lastTestsKey = "";
  function populateOMRTestSelects() {
    if (typeof tests === "undefined") return;
    const key = Object.keys(tests).join("|");
    if (key === lastTestsKey) return;
    lastTestsKey = key;
    [document.getElementById("omr-sheet-test-select"), document.getElementById("omr-manual-test-select")].forEach(sel => {
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">— Test chunein —</option>';
      Object.keys(tests).forEach(id => {
        const t = tests[id];
        if (!t || t.isDraft) return;
        const op = document.createElement("option");
        op.value = id; op.textContent = t.title || id;
        sel.appendChild(op);
      });
      if (cur && tests[cur]) sel.value = cur;
      enhanceSearchableSelect(sel);
      syncSearchableSelectDisplay(sel);
    });
  }

  function init() {
    const genBtn = document.getElementById("omr-generate-sheet-btn");
    if (genBtn) genBtn.onclick = generateOMRSheet;
    const manualBtn = document.getElementById("omr-manual-parse-btn");
    if (manualBtn) manualBtn.onclick = parseAndPreviewManual;

    populateOMRTestSelects();
    setInterval(populateOMRTestSelects, 4000);

    enhanceStudentAutocomplete(
      document.getElementById("omr-manual-student-name"),
      document.getElementById("omr-manual-student-mobile")
    );
  }

  document.addEventListener("DOMContentLoaded", init);

})();
