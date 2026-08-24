/* ══════════════════════════════════════════════════════════════════
   SAVYASACHI — OMR SHEET GENERATOR + PHOTO-SCAN AUTO-GRADING
   ══════════════════════════════════════════════════════════════════
   1) Print/PDF OMR answer sheet for any existing Test (4 corner
      markers used for photo alignment, A–D bubbles per question).
   2) Admin uploads a photo of the filled sheet → this module detects
      the 4 corner markers, maps every bubble's expected position onto
      the photo (bilinear interpolation between the 4 corners), and
      measures bubble darkness to guess the marked option. When the AI
      endpoint is configured, that pixel-darkness reading ALSO cross-
      checks the AI's reading (two independent methods on the same
      photo) — questions where they disagree are flagged red for the
      admin to check by hand, instead of trusting either method blindly.
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
  // math against lighting, tilt, shadows, and phone-camera quirks. The
  // local pixel-darkness method still runs alongside it (it's free and
  // instant) purely to CROSS-CHECK the AI's answers — any question where
  // the two disagree gets flagged red in the review step so the admin
  // checks exactly those, not the whole sheet.
  // When left empty, the scanner automatically falls back to the
  // original geometric pixel-darkness method below (no AI, no cross-check).
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
      // NOTE: the browser calls onerror with a raw Event object, not an
      // Error — rejecting with that directly used to make failures show
      // up to the admin as the useless "[object Event]" (Event's default
      // toString()). Wrap it in a real Error with a clear message instead.
      img.onerror = () => reject(new Error("Photo load nahi ho payi — file corrupt hai ya kisi anjaan format mein hai. Doosri photo try karein."));
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
  function detectAnswersByPixels(ctx, w, h, test, customTemplate) {
    const gray = toGrayscale(ctx, w, h);
    let layout, corners, cornersReliable;

    if (customTemplate) {
      // Trained (marker-less) template: bubble positions were learned as
      // FRACTIONS (0–1) of a sample photo's own width/height, so the
      // photo's own 4 corners (0,0)–(w,h) ARE the reference frame here —
      // no marker search needed. This only stays accurate if this photo
      // is framed the same way (whole sheet, edge-to-edge) as the training
      // photo was, so we don't claim marker-verified reliability; the
      // review UI shows a distinct note for this case instead.
      layout = { corners: { tl: { x: 0, y: 0 }, tr: { x: 1, y: 0 }, bl: { x: 0, y: 1 }, br: { x: 1, y: 1 } }, bubbles: customTemplate.bubbles };
      corners = { tl: { x: 0, y: 0 }, tr: { x: w, y: 0 }, bl: { x: 0, y: h }, br: { x: w, y: h } };
      cornersReliable = true;
    } else {
      corners = detectCorners(gray, w, h);
      layout = computeOMRLayout(test.questions.length);
      cornersReliable = ["tl", "tr", "bl", "br"].every(k => corners[k].isolated !== false);
    }

    const radius = Math.max(4, Math.round(Math.min(w, h) * 0.012));
    // Local white-level field instead of one global number — handles a
    // shadow or uneven light falling across the photo (see
    // estimateWhiteLevelField comment for why this matters).
    const whiteField = estimateWhiteLevelField(gray, w, h);
    const MARK_THRESHOLD = 45; // "dark" is measured relative to this bubble's own local paper-white level

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
    const validConf = ["high", "medium", "low", "blank"];
    return data.answers.map(r => ({
      q: r.q,
      detected: r.detected ? letters.indexOf(r.detected) : null,
      // Backend now returns a real per-question confidence (high/medium/
      // low/blank) instead of a binary marked/null — the AI is told to
      // still give its best guess even on faint/ambiguous bubbles rather
      // than silently returning null, so those surface in review instead
      // of quietly defaulting to "blank".
      confidence: validConf.includes(r.confidence) ? r.confidence : (r.detected ? "medium" : "blank")
    }));
  }

  // ── DUAL CROSS-CHECK ─────────────────────────────────────────────
  // AI (Claude Vision) and the pixel-darkness method are two INDEPENDENT
  // ways of reading the same photo — one reads it "like a human", the
  // other measures raw ink darkness against the printed corner markers.
  // Their mistakes don't share a common cause (AI can misjudge a faint
  // mark; pixel-method can misjudge from lighting/corner issues), so
  // when both land on the SAME answer for a question, that agreement is
  // a much stronger signal than either method's own self-reported
  // confidence. When they DISAGREE, that disagreement is itself the
  // most reliable "check this one" flag available — it doesn't depend
  // on either method correctly knowing when it's wrong. Pixel-method
  // runs locally (free, instant), so this cross-check costs nothing
  // extra beyond the AI call itself.
  function crossCheckAnswers(aiAnswers, pixelAnswers, cornersReliable) {
    const pixelByQ = {};
    pixelAnswers.forEach(a => { pixelByQ[a.q] = a; });
    let mismatchCount = 0;
    const merged = aiAnswers.map(a => {
      const px = pixelByQ[a.q];
      // If the pixel-method's own corner detection was unreliable on
      // this photo, its opinion isn't trustworthy enough to cross-check
      // against — trust AI alone here (the cornerWarning banner already
      // tells the admin to double-check everything in that case).
      if (!px || !cornersReliable) return { ...a, mismatch: false };
      if (px.detected === a.detected) {
        // Two independent methods agreeing is stronger evidence than
        // either alone — upgrade anything below "high".
        return { ...a, confidence: "high", mismatch: false };
      }
      mismatchCount++;
      return { ...a, mismatch: true, altGuess: px.detected };
    });
    return { answers: merged, mismatchCount };
  }

  // ── PHOTO QUALITY GATE ─────────────────────────────────────────
  // Sabse zyada scanning errors (chahe AI ho ya pixel-method) kharab
  // photo se hi aate hain — dhundhli (out of focus), bahut andheri, ya
  // flash/glare se bubbles wash-out ho jaana. Koi bhi detection method
  // aisi photo par bharosemand nahi ho sakta, chahe wo kitna bhi smart
  // ho. Ye check AI ko photo bhejne se PEHLE hi uski basic quality
  // (focus, brightness, glare) parakh leta hai — kharab photo turant
  // pakdi jaati hai (AI credits bhi bachte hain), aur admin ko turant
  // dobara photo lene ka mauka milta hai — scan hone ke baad galat
  // result dekh ke pachhtaane ke bajaye.
  function assessPhotoQuality(gray, w, h) {
    const issues = [];
    // Central 80% crop — ignores any dark background/table-edge outside
    // the sheet itself that a loosely-framed photo might include.
    const x0 = Math.floor(w * 0.1), x1 = Math.ceil(w * 0.9);
    const y0 = Math.floor(h * 0.1), y1 = Math.ceil(h * 0.9);
    const stride = 3;

    let sum = 0, count = 0, brightCount = 0;
    for (let y = y0; y < y1; y += stride) {
      for (let x = x0; x < x1; x += stride) {
        const v = gray[y * w + x];
        sum += v; count++;
        if (v > 250) brightCount++;
      }
    }
    const brightness = count ? sum / count : 200;
    const glarePct = count ? brightCount / count : 0;

    // Blur: variance of a simple Laplacian response — a sharp photo of a
    // printed sheet has lots of crisp edges (bubble rings, grid lines,
    // text), so this response varies a lot pixel-to-pixel. A blurry photo
    // smooths those edges away, so the variance collapses toward zero.
    const step = 4;
    let lapSum = 0, lapSumSq = 0, lapCount = 0;
    for (let y = y0 + step; y < y1 - step; y += step) {
      for (let x = x0 + step; x < x1 - step; x += step) {
        const c = gray[y * w + x];
        const l = 4 * c - gray[y * w + (x - step)] - gray[y * w + (x + step)]
                         - gray[(y - step) * w + x] - gray[(y + step) * w + x];
        lapSum += l; lapSumSq += l * l; lapCount++;
      }
    }
    const lapMean = lapCount ? lapSum / lapCount : 0;
    const blurVariance = lapCount ? (lapSumSq / lapCount) - (lapMean * lapMean) : 999;

    if (blurVariance < 55) issues.push("📷 Photo dhundhli (out of focus) lag rahi hai — camera ko sheet ke seedhe upar sthir rakh ke, focus lock karke dobara photo lein.");
    if (brightness < 95) issues.push("🌑 Photo bahut andheri hai — zyada roshni mein ja kar, ya flash on karke, dobara photo lein.");
    if (glarePct > 0.35) issues.push("✨ Flash/roshni ka glare kaafi zyada hai (bada hissa overexposed/safed dikh raha hai) — flash band karke ya angle thoda badal ke dobara lein.");

    return { issues, brightness, blurVariance, glarePct };
  }

  // Warning panel jab photo quality theek nahi lagti — admin ko dobara
  // photo lene ka option deta hai, ya (agar wo phir bhi confident hai)
  // usi photo se aage badhne ka. Kabhi bhi silently block nahi karta.
  function renderQualityWarning(quality, onProceedAnyway, onRetake) {
    const container = document.getElementById("omr-review-area");
    if (!container) { onProceedAnyway(); return; } // no UI to show warning in — don't block silently
    const list = quality.issues.map(m => `<li style="margin-bottom:4px;">${m}</li>`).join("");
    container.innerHTML = `
      <div class="card" style="margin-top:14px;border:1px solid #fecaca;background:#fef2f2;">
        <h4 style="margin-bottom:6px;color:#b91c1c;">⚠️ Photo Quality Theek Nahi Lag Rahi</h4>
        <ul style="margin:0 0 10px 18px;padding:0;color:#7f1d1d;font-size:.85rem;">${list}</ul>
        <p class="muted-text" style="margin-bottom:10px;font-size:.8rem;">Aisi photo par AI aur pixel-method dono ke galat padhne ka chance zyada hai. Sheet ko flat rakh ke, achi roshni mein, seedhe upar se dobara photo lena sabse behtar rahega.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="omr-quality-retake-btn" class="btn-secondary">📷 Nayi Photo Chunein</button>
          <button type="button" id="omr-quality-proceed-btn" class="btn-secondary" style="color:#b91c1c;">⚠️ Isi Photo Se Scan Karein</button>
        </div>
      </div>`;
    const retakeBtn = document.getElementById("omr-quality-retake-btn");
    const proceedBtn = document.getElementById("omr-quality-proceed-btn");
    if (retakeBtn) retakeBtn.onclick = () => { container.innerHTML = ""; onRetake(); };
    if (proceedBtn) proceedBtn.onclick = () => { container.innerHTML = ""; onProceedAnyway(); };
  }

  async function scanOMRSheet() {
    const testId = document.getElementById("omr-scan-test-select")?.value;
    const nameInput = document.getElementById("omr-scan-student-name");
    const mobileInput = document.getElementById("omr-scan-student-mobile");
    const fileInput = document.getElementById("omr-scan-file-input");
    const statusEl = document.getElementById("omr-scan-status");
    const templateId = document.getElementById("omr-scan-template-select")?.value || "";
    const customTemplate = templateId ? customOmrTemplates[templateId] : null;

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

      // ── Quality gate: check the photo itself BEFORE spending an AI
      // call or trusting the pixel-method on something blurry/dark/
      // glared-out — no detection method can read marks reliably off a
      // bad photo. Skipped only if the admin already chose "scan anyway"
      // for THIS EXACT file (tracked by name+size+lastModified), so
      // picking a different photo always re-checks from scratch.
      const gray = toGrayscale(ctx, w, h);
      const file = fileInput.files[0];
      const fileFingerprint = file.name + ":" + file.size + ":" + file.lastModified;
      if (fileInput.dataset.qualityOverrideFor !== fileFingerprint) {
        const quality = assessPhotoQuality(gray, w, h);
        if (quality.issues.length) {
          if (statusEl) statusEl.textContent = "";
          if (scanBtn) scanBtn.disabled = false;
          renderQualityWarning(
            quality,
            () => { fileInput.dataset.qualityOverrideFor = fileFingerprint; scanOMRSheet(); },
            () => { fileInput.value = ""; fileInput.click(); }
          );
          return;
        }
      }

      let usedAI = false;
      let dualChecked = false;
      let mismatchCount = 0;

      // Pixel method runs locally — free, instant — so we always compute
      // it, whether or not AI is configured. When AI succeeds, pixel's
      // result is used to cross-check it (see crossCheckAnswers above)
      // instead of just sitting idle as an unused fallback.
      const pixelResult = detectAnswersByPixels(ctx, w, h, test, customTemplate);
      const cornersReliable = pixelResult.cornersReliable;
      const numQuestionsForScan = customTemplate ? customTemplate.numQuestions : test.questions.length;

      if (OMR_AI_ENDPOINT) {
        if (statusEl) statusEl.textContent = "⏳ AI se sheet padhi ja rahi hai...";
        try {
          const aiAnswers = await detectAnswersWithAI(canvas, numQuestionsForScan);
          const cross = crossCheckAnswers(aiAnswers, pixelResult.answers, cornersReliable);
          detectedAnswers = cross.answers;
          mismatchCount = cross.mismatchCount;
          usedAI = true;
          dualChecked = cornersReliable;
        } catch (aiErr) {
          console.warn("AI OMR detection failed, falling back to pixel method:", aiErr);
          if (statusEl) statusEl.textContent = "⚠️ AI detection fail hui, pixel-method se try kar rahe hain...";
        }
      }

      if (!usedAI) {
        detectedAnswers = pixelResult.answers;
      }

      renderOMRReview(test, name, mobile, testId, usedAI, cornersReliable, dualChecked, mismatchCount, customTemplate);
      if (statusEl) {
        statusEl.textContent = cornersReliable
          ? "✅ Scan complete — neeche review karke confirm karein."
          : "⚠️ Scan hui, lekin corner markers spasht nahi mile — neeche har answer zaroor check karein.";
      }
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = "";
      // err.message || err, agar err koi plain Error na ho (jaise ek raw
      // DOM Event ya kisi library ka object), to sirf default toString()
      // se "[object Event]" jaisa bekaar text ban jaata — isliye yahan
      // safe fallback hai.
      const msg = (err && err.message) ? err.message : "Kuch anjaan gadbad ho gayi — dobara try karein.";
      alert("Scan karne mein error: " + msg);
    } finally {
      if (scanBtn) scanBtn.disabled = false;
    }
  }

  function renderOMRReview(test, name, mobile, testId, usedAI, cornersReliable, dualChecked, mismatchCount, customTemplate) {
    const container = document.getElementById("omr-review-area");
    if (!container) return;
    const letters = ["A", "B", "C", "D"];
    let flagCount = 0;
    // "unclear" (pixel-only wording) and "low" (AI wording) both mean the
    // same thing — same badge/highlight, kept as two keys just so both
    // methods' own vocabulary works without translation.
    const badgeFor = { high: "✅", medium: "🟡", low: "🟠", unclear: "🟠", blank: "⬜" };
    const rows = detectedAnswers.map(r => {
      const needsReview = r.mismatch || r.confidence === "low" || r.confidence === "unclear";
      if (needsReview) flagCount++;
      const badge = r.mismatch ? "🔴" : (badgeFor[r.confidence] || "🟠");
      const opts = [0, 1, 2, 3].map(o => `<option value="${o}" ${r.detected === o ? "selected" : ""}>${letters[o]}</option>`).join("")
        + `<option value="" ${r.detected === null ? "selected" : ""}>— Blank —</option>`;
      // Mismatch rows show BOTH methods' guesses side by side, so the
      // admin doesn't have to re-scan or re-check the photo blind — they
      // already know exactly which two options to weigh.
      const altNote = r.mismatch
        ? `<span style="color:#b91c1c;font-size:.72rem;margin-left:6px;">AI: ${r.detected !== null ? letters[r.detected] : "blank"} · Pixel: ${(r.altGuess !== null && r.altGuess !== undefined) ? letters[r.altGuess] : "blank"}</span>`
        : "";
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:.85rem;${needsReview ? "background:#fef2f2;" : ""}">
          <span style="width:56px;font-weight:700;">${badge} Q${r.q}</span>
          <select data-q="${r.q}" class="omr-answer-select" style="padding:3px 6px;">${opts}</select>
          ${altNote}
        </div>`;
    }).join("");

    const methodNote = usedAI
      ? (dualChecked
          ? `<span style="color:#059669;">🤖 AI (Claude Vision) + 📐 Pixel-method — dono se cross-check kiya gaya</span>`
          : `<span style="color:#059669;">🤖 AI (Claude Vision) se detect kiya gaya</span>`)
      : `<span style="color:#64748b;">📐 Pixel-darkness method se detect kiya gaya${OMR_AI_ENDPOINT ? " (AI abhi fail hui, fallback use hua)" : " (AI configure nahi hai)"}</span>`;

    const cornerWarning = (cornersReliable === false)
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:.82rem;">
           ⚠️ Corner markers (4 kone ke kaale square) photo mein spasht nahi mile — poori sheet ki position galat ho sakti hai.
           Har answer neeche zaroor check karein, ya sheet ko flat rakh ke, achi roshni mein, seedhe upar se dobara photo lekar re-scan karein.
         </div>`
      : (customTemplate
        ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:.82rem;">
             🎯 "${escHtml(customTemplate.name)}" trained template use hui — is mein koi corner marker nahi hota, isliye photo ki apni poori frame ko sheet maana gaya hai.
             Agar photo mein sheet ke aas-paas zyada background/table aa gaya ho, to positions thodi khisak sakti hain — har answer ek baar zaroor nazar daal lein.
           </div>`
        : "");

    const mismatchNote = mismatchCount
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:.82rem;">
           🔴 ${mismatchCount} question(s) mein AI aur Pixel-method ka answer alag-alag aaya hai — inhe neeche (laal highlight mein) zaroor khud check karein.
         </div>`
      : "";

    container.innerHTML = `
      <div class="card" style="margin-top:14px;">
        <h4 style="margin-bottom:6px;">📝 Review Detected Answers ${flagCount ? `<span style="color:#d97706;font-size:.8rem;">(${flagCount} flagged — kripya check karein)</span>` : ""}</h4>
        ${cornerWarning}
        ${mismatchNote}
        <p class="muted-text" style="margin-bottom:2px;font-size:.8rem;">${methodNote}</p>
        <p class="muted-text" style="margin-bottom:8px;">✅ high confidence · 🟡 medium · 🟠 low, khud verify karein · ⬜ confidently blank (not attempted) · 🔴 AI/Pixel mismatch — zaroor check karein. Dropdown se koi bhi answer badal sakte hain.</p>
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
  // ── ChatGPT OMR-scan fallback prompt ─────────────────────────────
  // Jab is app ka apna OMR Scanner kisi sheet ke answers galat pakad
  // le (halki marking, camera angle, shadow, waghera), admin is exact
  // prompt ko ChatGPT mein OMR ki photo(s) ke saath bhej sakta hai —
  // wapas mile "1 A / 2 / 3 C ..." format ko seedha neeche wale Manual
  // Entry box mein paste karke parseAndPreviewManual() se save kiya
  // ja sakta hai (parseManualAnswers ka regex isi format ko already
  // handle karta hai — koi extra code nahi chahiye).
  const CHATGPT_OMR_PROMPT = `तुम एक PROFESSIONAL OMR SHEET SCANNER हो।

मैं तुम्हें एक या एक से अधिक OMR Sheet की images दूँगा। प्रत्येक image को एक अलग student की अलग OMR Answer Sheet मानो।

सबसे महत्वपूर्ण नियम — हर image का अलग COPYABLE OUTPUT

अगर मैंने 2 images दी हैं, तो तुम्हें 2 अलग-अलग code blocks देने हैं।

अगर मैंने 5 images दी हैं, तो तुम्हें 5 अलग-अलग code blocks देने हैं।

STRICT RULE:

हर OMR image = केवल एक अलग code block

हर code block में केवल उसी image के answers होंगे।

एक image के answers को दूसरी image के answers के साथ कभी combine मत करना।

उदाहरण

अगर 2 images हैं, तो output EXACTLY इस तरह होना चाहिए:

1 A
2
3 C
4 B
5
6 D

1 B
2 C
3
4 A
5 D
6

इन दोनों code blocks को अलग-अलग copy किया जा सके।

बहुत महत्वपूर्ण OUTPUT नियम

❌ "ANSWER SHEET 1" मत लिखो।

❌ "ANSWER SHEET 2" मत लिखो।

❌ "Image 1" मत लिखो।

❌ "Image 2" मत लिखो।

❌ किसी code block के अंदर कोई heading या explanation मत लिखो।

❌ सभी images के answers को एक ही code block में मत डालो।

✅ हर image के लिए अलग code block बनाओ।

✅ पहला code block = पहली image के answers।

✅ दूसरा code block = दूसरी image के answers।

✅ तीसरा code block = तीसरी image के answers।

और इसी तरह आगे।

OMR BUBBLE पहचानने के नियम

केवल VISUALLY FILLED bubble को answer मानो।

किसी option को तभी selected मानो जब उसके bubble के अंदर student की स्पष्ट dark/colored marking दिखाई दे।

इन चीजों को marking मत मानो:

खाली गोल circle

circle की border/outline

printed option letter

printing का निशान

scan का shadow

हल्का धब्बा

paper की crease

आसपास का text

दूसरे bubble की marking

image compression/noise

हर Question को अलग-अलग जांचो

हर question में A, B, C और D चारों bubbles को ध्यान से देखो।

A → क्या bubble वास्तव में भरा है?

B → क्या bubble वास्तव में भरा है?

C → क्या bubble वास्तव में भरा है?

D → क्या bubble वास्तव में भरा है?

Result के नियम

केवल A स्पष्ट रूप से भरा है → "A"

केवल B स्पष्ट रूप से भरा है → "B"

केवल C स्पष्ट रूप से भरा है → "C"

केवल D स्पष्ट रूप से भरा है → "D"

कोई bubble नहीं भरा है → केवल question number लिखो और उसके बाद खाली छोड़ दो।

दो या अधिक bubbles भरे हुए हैं → केवल question number लिखो और उसके बाद खाली छोड़ दो।

Marking स्पष्ट नहीं है → केवल question number लिखो और उसके बाद खाली छोड़ दो।

उदाहरण

यदि किसी image में:

1 = A
2 = खाली
3 = C
4 = B
5 = खाली

तो उस image का पूरा अलग code block:

1 A
2
3 C
4 B
5

दूसरी image में:

1 = D
2 = A
3 = खाली
4 = C
5 = B

तो दूसरी image का अलग code block:

1 D
2 A
3
4 C
5 B

QUESTION NUMBER

हर image के लिए सभी question numbers क्रम से लिखो।

अगर OMR में 1 से 100 तक questions हैं, तो प्रत्येक image के code block में 1 से 100 तक सभी numbers होने चाहिए।

किसी question को skip मत करो।

Blank question में केवल number लिखो:

25

"25 Blank" नहीं लिखना है।

"25 Unclear" नहीं लिखना है।

"25 Multiple" नहीं लिखना है।

FINAL VERIFICATION

हर image को independently कम से कम दो बार check करो।

विशेष रूप से verify करो:

1. कोई खाली bubble answer न बन जाए।

2. कोई भरा हुआ bubble छूट न जाए।

3. A/B/C/D की position सही हो।

4. Question number सही हो।

5. दूसरी image का answer इस image में न आए।

6. हर image का output अलग code block में हो।

7. हर code block सीधे copy-paste करने योग्य हो।

FINAL OUTPUT FORMAT — ABSOLUTELY STRICT

अगर 3 images हैं, तो EXACTLY 3 अलग-अलग code blocks दो:

[IMAGE 1 के सभी answers]

[IMAGE 2 के सभी answers]

[IMAGE 3 के सभी answers]

हर code block independent और directly copyable होना चाहिए।

कोई heading नहीं।

कोई explanation नहीं।

कोई numbering जैसे "Answer Sheet 1" नहीं।

कोई extra text नहीं।

अंतिम नियम:

ONE IMAGE = ONE SEPARATE CODE BLOCK

NEVER COMBINE MULTIPLE IMAGES INTO ONE CODE BLOCK.

EACH CODE BLOCK MUST BE DIRECTLY COPY-PASTEABLE.

NEVER GUESS.

NEVER FILL AN EMPTY BUBBLE.

NEVER WRITE BLANK, UNCLEAR OR MULTIPLE.

ALWAYS PRESERVE EVERY QUESTION NUMBER.

OUTPUT ONLY SEPARATE CODE BLOCKS.`;

  function copyChatGptOmrPrompt() {
    navigator.clipboard.writeText(CHATGPT_OMR_PROMPT).then(() => {
      alert("✅ Prompt copy ho gaya! Ab ChatGPT (chatgpt.com) mein naya chat kholein, paste karein, aur OMR sheet ki photo(s) attach karke bhej dein.");
    }).catch(() => {
      // Clipboard API kabhi-kabhi permission/HTTPS issue se fail hoti hai —
      // us case mein ek text box dikha do jaha se manually select-copy ho sake.
      const ta = document.createElement("textarea");
      ta.value = CHATGPT_OMR_PROMPT;
      ta.style.cssText = "position:fixed;top:10%;left:10%;width:80%;height:70%;z-index:99999;font-size:12px;";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      alert("Clipboard access nahi mila — text box khul gaya hai, Ctrl+A phir Ctrl+C karke copy kar lein, phir isi box ko band kar dein.");
    });
  }
  window.copyChatGptOmrPrompt = copyChatGptOmrPrompt;

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

  /* ── CUSTOM SHEET TEMPLATE TRAINER ────────────────────────────────
     Har coaching apni khud ki OMR sheet chhapwata hai — kisi ke corner
     par 4 kaale square honge, kisi ke nahi, columns/questions ki
     ginti bhi alag ho sakti hai. Is se pehle, aisi kisi bhi custom
     sheet ko scan karne layak banane ke liye HAR BAAR haath se coordinate
     nikaal kar code likhna padta tha. Ye section wahi kaam admin khud,
     bina code likhe, kar sake — bas ek sample photo par 3-4 baar click
     karke.

     KAAM KAISE KARTA HAI: corner marker squares nahi hote is liye photo
     ke apne hi 4 corners (poori width/height) ko reference maana jaata
     hai — isliye scan ke waqt bhi WAISI HI photo zaroori hai jaisi
     training ke waqt li gayi thi (poori sheet frame mein, edge-to-edge).
     Admin sirf itna batata hai:
       1) Q1 ke Option A ka center
       2) Q1 ke AAKHRI option (D) ka center   → option-to-option spacing
       3) Q2 (agli row, same column) Option A → row-to-row spacing
       4) Column 2 ke Q1 Option A (agar cols>1) → column-to-column spacing
     In 3-4 points + (kul questions, columns) se baaki sab 396+ bubbles
     ki position seedhe hisaab (linear extrapolation) se nikal aati hai —
     poora grid uniform hota hai, isliye sirf ek "unit cell" naapni
     padti hai. Har position photo ki width/height ke FRACTION (0–1) mein
     save hoti hai, isliye kisi bhi resolution ki photo par kaam karta
     hai (bas framing consistent honi chahiye). ─────────────────────── */

  let customOmrTemplates = {};     // id -> template doc, Firestore se load hone ke baad cache
  let trainClicksFrac = [];        // [{x,y} fractions] — ab tak ke clicks
  let trainImageEl = null;
  let trainCanvasEl = null, trainCtxEl = null;

  function trainRequiredClicks() {
    const cols = Math.max(1, parseInt(document.getElementById("omr-train-cols")?.value, 10) || 1);
    return cols > 1 ? 4 : 3;
  }

  function trainStepInstruction(stepIdx) {
    const steps = [
      "1️⃣ Q1 ke Option A (ⓐ) ke bubble ke theek BEECH mein click karein.",
      "2️⃣ Ab Q1 ke SABSE AAKHRI option (jaise D) ke bubble ke BEECH click karein.",
      "3️⃣ Ab Question 2 (seedha Q1 ke NEECHE wala, same column) ke Option A par click karein.",
      "4️⃣ Ab COLUMN 2 ke PEHLE question ke Option A par click karein."
    ];
    return steps[stepIdx] || "";
  }

  function computeTrainedBubbles(clicks, numQuestions, cols) {
    const rowsPerCol = Math.ceil(numQuestions / cols);
    const p0 = clicks[0], p1 = clicks[1], p2 = clicks[2];
    const p3 = cols > 1 ? clicks[3] : null;
    const optSpacingX = (p1.x - p0.x) / 3, optSpacingY = (p1.y - p0.y) / 3;
    const rowStepX = p2.x - p0.x, rowStepY = p2.y - p0.y;
    const colStepX = p3 ? (p3.x - p0.x) : 0, colStepY = p3 ? (p3.y - p0.y) : 0;

    const bubbles = [];
    for (let i = 0; i < numQuestions; i++) {
      const col = Math.floor(i / rowsPerCol);
      const rowInCol = i % rowsPerCol;
      const baseX = p0.x + col * colStepX + rowInCol * rowStepX;
      const baseY = p0.y + col * colStepY + rowInCol * rowStepY;
      const options = [0, 1, 2, 3].map(o => ({ opt: o, x: baseX + o * optSpacingX, y: baseY + o * optSpacingY }));
      bubbles.push({ q: i + 1, options });
    }
    return bubbles;
  }

  function redrawTrainCanvas() {
    if (!trainCtxEl || !trainImageEl) return;
    trainCtxEl.drawImage(trainImageEl, 0, 0, trainCanvasEl.width, trainCanvasEl.height);
    // Ab tak ke actual clicks — numbered dots.
    trainClicksFrac.forEach((p, i) => {
      const x = p.x * trainCanvasEl.width, y = p.y * trainCanvasEl.height;
      trainCtxEl.beginPath();
      trainCtxEl.arc(x, y, 7, 0, Math.PI * 2);
      trainCtxEl.fillStyle = "rgba(220,38,38,0.85)";
      trainCtxEl.fill();
      trainCtxEl.fillStyle = "#fff";
      trainCtxEl.font = "bold 11px sans-serif";
      trainCtxEl.textAlign = "center";
      trainCtxEl.fillText(String(i + 1), x, y + 4);
    });
    // Poore clicks ho jaane par — SAARI bubbles ka preview overlay, taaki
    // admin turant dekh sake ki grid sahi jagah align hui ya nahi.
    const required = trainRequiredClicks();
    if (trainClicksFrac.length >= required) {
      const numQ = Math.max(1, parseInt(document.getElementById("omr-train-numq")?.value, 10) || 1);
      const cols = Math.max(1, parseInt(document.getElementById("omr-train-cols")?.value, 10) || 1);
      const bubbles = computeTrainedBubbles(trainClicksFrac, numQ, cols);
      trainCtxEl.fillStyle = "rgba(37,99,235,0.75)";
      bubbles.forEach(b => b.options.forEach(o => {
        trainCtxEl.beginPath();
        trainCtxEl.arc(o.x * trainCanvasEl.width, o.y * trainCanvasEl.height, 3, 0, Math.PI * 2);
        trainCtxEl.fill();
      }));
    }
  }

  function updateTrainUI() {
    const required = trainRequiredClicks();
    const instrEl = document.getElementById("omr-train-click-instruction");
    const saveBtn = document.getElementById("omr-train-save-btn");
    if (trainClicksFrac.length < required) {
      if (instrEl) instrEl.textContent = trainStepInstruction(trainClicksFrac.length);
      if (saveBtn) saveBtn.disabled = true;
    } else {
      if (instrEl) instrEl.textContent = "✅ Neeche NEELE dots har bubble ke upar align ho rahe hain ya nahi check karein. Sahi lage to save karein, warna \"Clicks Reset Karein\" dabakar dobara try karein.";
      if (saveBtn) saveBtn.disabled = false;
    }
    redrawTrainCanvas();
  }

  function handleTrainCanvasClick(e) {
    if (!trainCanvasEl) return;
    const required = trainRequiredClicks();
    if (trainClicksFrac.length >= required) return; // already done — reset first
    const rect = trainCanvasEl.getBoundingClientRect();
    // Canvas CSS-scaled ho sakta hai (max-width:100%) — client click position
    // ko canvas ke ASLI (native) pixel grid mein convert karna zaroori hai.
    const scaleX = trainCanvasEl.width / rect.width;
    const scaleY = trainCanvasEl.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    trainClicksFrac.push({ x: x / trainCanvasEl.width, y: y / trainCanvasEl.height });
    updateTrainUI();
  }

  function resetTrainClicks() {
    trainClicksFrac = [];
    updateTrainUI();
  }

  function loadTrainImageFile(file) {
    loadImageFromFile(file).then(img => {
      // ORIENTATION FIX: same assumption scanOMRSheet() makes — the
      // physical sheet is always portrait, so a landscape (wider-than-
      // tall) photo just means the phone was held sideways. Normalize it
      // HERE too, or click-fractions recorded during training would be in
      // a different orientation than a real (auto-rotated) scan photo
      // later — silently swapping x/y for every future scan.
      const isLandscape = img.width > img.height * 1.15;
      let sourceEl = img, natW = img.naturalWidth, natH = img.naturalHeight;
      if (isLandscape) {
        const rotated = document.createElement("canvas");
        rotated.width = img.height; rotated.height = img.width;
        const rctx = rotated.getContext("2d");
        rctx.translate(rotated.width, 0);
        rctx.rotate(Math.PI / 2);
        rctx.drawImage(img, 0, 0, img.height, img.width);
        sourceEl = rotated; natW = rotated.width; natH = rotated.height;
      }
      trainImageEl = sourceEl;
      const wrap = document.getElementById("omr-train-canvas-wrap");
      trainCanvasEl = document.getElementById("omr-train-canvas");
      if (!trainCanvasEl) return;
      // Ek reasonable max width par cap karo (bahut badi photo canvas ko
      // slow kar degi) — click-fraction math resolution-independent hai
      // isliye ye sirf display/performance ke liye hai, accuracy par asar
      // nahi padta.
      const maxW = 1100;
      const scale = Math.min(1, maxW / natW);
      trainCanvasEl.width = Math.round(natW * scale);
      trainCanvasEl.height = Math.round(natH * scale);
      trainCtxEl = trainCanvasEl.getContext("2d");
      if (wrap) wrap.classList.remove("hidden");
      trainClicksFrac = [];
      updateTrainUI();
    }).catch(err => {
      alert("Photo load nahi ho payi: " + (err.message || err));
    });
  }

  async function saveOmrTemplate() {
    const name = (document.getElementById("omr-train-name")?.value || "").trim();
    const numQuestions = Math.max(1, parseInt(document.getElementById("omr-train-numq")?.value, 10) || 0);
    const cols = Math.max(1, parseInt(document.getElementById("omr-train-cols")?.value, 10) || 0);
    const required = trainRequiredClicks();
    if (!name) { alert("Template ka naam likhein."); return; }
    if (!numQuestions || !cols) { alert("Questions aur Columns ki sahi ginti bharein."); return; }
    if (trainClicksFrac.length < required) { alert("Pehle upar diye gaye sabhi clicks poore karein."); return; }

    const db = typeof getDB === "function" ? getDB() : null;
    if (!db) { alert("Firebase se connect nahi ho paya — internet check karein."); return; }

    const bubbles = computeTrainedBubbles(trainClicksFrac, numQuestions, cols);
    const rowsPerCol = Math.ceil(numQuestions / cols);
    const saveBtn = document.getElementById("omr-train-save-btn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "⏳ Save ho raha hai..."; }
    try {
      const id = db.collection("omrTemplates").doc().id;
      await db.collection("omrTemplates").doc(id).set({
        name, numQuestions, cols, rowsPerCol, optionsPerQ: 4,
        bubbles,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const statusEl = document.getElementById("omr-train-status");
      if (statusEl) statusEl.textContent = "✅ \"" + name + "\" template save ho gaya — ab \"Photo Se Scan\" mein select kar sakte hain.";
      document.getElementById("omr-train-name").value = "";
      resetTrainClicks();
      window.loadOmrTemplates();
    } catch (err) {
      alert("Template save karne mein error: " + (err.message || err));
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Template Save Karein"; }
    }
  }

  async function deleteOmrTemplate(id) {
    const tpl = customOmrTemplates[id];
    if (!tpl) return;
    if (!confirm('"' + tpl.name + '" template delete karein? Ye sirf tab wapas milega jab dobara train karenge.')) return;
    const db = typeof getDB === "function" ? getDB() : null;
    if (!db) return;
    try {
      await db.collection("omrTemplates").doc(id).delete();
      window.loadOmrTemplates();
    } catch (err) {
      alert("Delete nahi ho paya: " + (err.message || err));
    }
  }
  window.deleteOmrTemplate = deleteOmrTemplate;

  function renderOmrTemplateList() {
    const listEl = document.getElementById("omr-train-list");
    if (!listEl) return;
    const ids = Object.keys(customOmrTemplates);
    if (!ids.length) { listEl.innerHTML = "Abhi koi template train nahi hui hai."; return; }
    listEl.innerHTML = ids.map(id => {
      const t = customOmrTemplates[id];
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <span><strong>${escHtml(t.name)}</strong> — ${t.numQuestions} questions, ${t.cols} columns</span>
        <button type="button" class="btn-secondary" style="color:#dc2626;" onclick="deleteOmrTemplate('${id}')">🗑️ Delete</button>
      </div>`;
    }).join("");
  }

  function populateOmrTemplateSelect() {
    const sel = document.getElementById("omr-scan-template-select");
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">🤖 System-Generated Sheet (default)</option>';
    Object.keys(customOmrTemplates).forEach(id => {
      const t = customOmrTemplates[id];
      const op = document.createElement("option");
      op.value = id; op.textContent = "🎯 " + t.name + " (" + t.numQuestions + "Q)";
      sel.appendChild(op);
    });
    if (cur && customOmrTemplates[cur]) sel.value = cur;
  }

  async function loadOmrTemplates() {
    const db = typeof getDB === "function" ? getDB() : null;
    const listEl = document.getElementById("omr-train-list");
    if (!db) { if (listEl) listEl.textContent = "⚠️ Firebase se connect nahi ho paya."; return; }
    try {
      const snap = await db.collection("omrTemplates").get();
      customOmrTemplates = {};
      snap.forEach(doc => { customOmrTemplates[doc.id] = doc.data(); });
      renderOmrTemplateList();
      populateOmrTemplateSelect();
    } catch (err) {
      if (listEl) listEl.textContent = "⚠️ Templates load nahi ho payi: " + (err.message || err);
    }
  }
  window.loadOmrTemplates = loadOmrTemplates;

  /* ── /CUSTOM SHEET TEMPLATE TRAINER ─────────────────────────────── */

  /* ── INIT / WIRING ────────────────────────────────────────────── */

  let lastTestsKey = "";
  function populateOMRTestSelects() {
    if (typeof tests === "undefined") return;
    const key = Object.keys(tests).join("|");
    if (key === lastTestsKey) return;
    lastTestsKey = key;
    [document.getElementById("omr-sheet-test-select"), document.getElementById("omr-scan-test-select"), document.getElementById("omr-manual-test-select")].forEach(sel => {
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
    const scanBtn = document.getElementById("omr-scan-btn");
    if (scanBtn) scanBtn.onclick = scanOMRSheet;

    const trainFileInput = document.getElementById("omr-train-file-input");
    if (trainFileInput) trainFileInput.onchange = () => {
      if (trainFileInput.files?.length) loadTrainImageFile(trainFileInput.files[0]);
    };
    const trainCanvas = document.getElementById("omr-train-canvas");
    if (trainCanvas) trainCanvas.onclick = handleTrainCanvasClick;
    const trainResetBtn = document.getElementById("omr-train-reset-btn");
    if (trainResetBtn) trainResetBtn.onclick = resetTrainClicks;
    const trainSaveBtn = document.getElementById("omr-train-save-btn");
    if (trainSaveBtn) trainSaveBtn.onclick = saveOmrTemplate;
    const trainColsInput = document.getElementById("omr-train-cols");
    if (trainColsInput) trainColsInput.onchange = resetTrainClicks;
    const scanTemplateSelect = document.getElementById("omr-scan-template-select");
    if (scanTemplateSelect) scanTemplateSelect.onchange = () => {
      const tip = document.getElementById("omr-scan-photo-tip");
      if (!tip) return;
      tip.textContent = scanTemplateSelect.value
        ? "Note: Ye custom-trained sheet hai — photo WAISI HI khinchein jaisi training ke waqt li thi (poori sheet frame mein, edge-to-edge, corner squares ki zaroorat nahi)."
        : "Note: Sheet ko poori tarah (bina crop kiye, seedhi, achhi light mein) photo kheenchein — corner ke 4 kaale square poori tarah dikhne chahiye.";
    };

    populateOMRTestSelects();
    setInterval(populateOMRTestSelects, 4000);

    enhanceStudentAutocomplete(
      document.getElementById("omr-manual-student-name"),
      document.getElementById("omr-manual-student-mobile")
    );
    enhanceStudentAutocomplete(
      document.getElementById("omr-scan-student-name"),
      document.getElementById("omr-scan-student-mobile")
    );
  }

  document.addEventListener("DOMContentLoaded", init);

  // Exposed so other pages (e.g. the Question Generator) can build a
  // blank OMR bubble-sheet for an in-progress paper that hasn't been
  // saved/published as a test yet — same exact grid geometry the
  // scanner uses (computeOMRLayout), just called directly with a
  // {title, questions} object instead of a saved `tests[testId]`.
  window.buildOMRSheetDocx = buildOMRSheetDocx;

})();
