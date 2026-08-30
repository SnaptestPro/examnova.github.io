/* ══════════════════════════════════════════════════════════════════
   EXAMNOVA — OMR SHEET GENERATOR + MANUAL ANSWER ENTRY
   ══════════════════════════════════════════════════════════════════
   1) Print/PDF OMR answer sheet for any existing Test (4 corner
      markers used for photo alignment, A–D bubbles per question).
   2) Manual Entry: admin types a student's answers as plain text
      (question number + option letter), reviews/corrects them in an
      editable table, then Confirm & Save runs through the same
      saveRecordOnline() used by normal online tests, so results show
      up in Records / Leaderboard identically.

   (Photo-upload auto-scan + AI cross-check grading — corner detection,
   bubble-darkness sampling, live-camera capture — has been removed.
   Offline paper exams are now scanned via Exam Manager instead;
   see exam-manager.js.)

   Reuses globals from script.js: tests, getDB, saveRecordOnline,
   getMarks, getNeg, escHtml. Nothing in script.js is modified.
   ══════════════════════════════════════════════════════════════════ */

(function () {

  const PAGE_W_MM = 210, PAGE_H_MM = 297;   // A4
  const MARKER_MM = 8;
  const MARGIN_MM = 6;

  /* ── Shared layout: used by BOTH the sheet generator and the
     scanner, so bubble positions always match exactly.
     Matches the standard printed BSEB-style OMR sheet the coaching
     center already uses on paper: boxed NAME/EXAM/DATE header, an
     "Exam Set" (A–E) row, a 2-digit "Roll No" bubble block (rows 0–9,
     tens+units columns), a "Subject 1 / Section 1" label, then up to
     4 columns of questions with the "A B C D" option header re-printed
     above every group of 5 questions. Column 0 carries the Exam
     Set + Roll No + Subject/Section block above its own questions,
     exactly like the reference sheet, so it holds fewer questions
     than columns 2–4. ─────────────────────────────────────────────── */

  // Given R available row-slots in a column, how many questions fit if
  // an extra "A B C D" header row is inserted before every group of 5?
  function maxQuestionsForRows(R) {
    if (R <= 0) return 0;
    let q = 0;
    while (q < 200) {
      const next = q + 1;
      if (next + Math.ceil(next / 5) > R) break;
      q = next;
    }
    return q;
  }

  // Column 0 only: "Exam Set" label + letter/bubble row (2) + Roll No
  // digit rows 0–9 (10) + "Subject 1 / Section 1" label (1) = 13 rows,
  // reserved above that column's own question rows.
  const OMR_COL0_PREFIX_ROWS = 13;

  function computeOMRLayout(numQuestions) {
    numQuestions = Math.max(1, Math.min(100, numQuestions));
    const corners = {
      tl: { x: MARGIN_MM + MARKER_MM / 2, y: MARGIN_MM + MARKER_MM / 2 },
      tr: { x: PAGE_W_MM - MARGIN_MM - MARKER_MM / 2, y: MARGIN_MM + MARKER_MM / 2 },
      bl: { x: MARGIN_MM + MARKER_MM / 2, y: PAGE_H_MM - MARGIN_MM - MARKER_MM / 2 },
      br: { x: PAGE_W_MM - MARGIN_MM - MARKER_MM / 2, y: PAGE_H_MM - MARGIN_MM - MARKER_MM / 2 }
    };

    const gridTop = 78, gridBottom = corners.bl.y - 8;
    const gridLeft = corners.tl.x + 6, gridRight = corners.tr.x - 6;
    const gridHeightMM = gridBottom - gridTop;
    const prefixRows = OMR_COL0_PREFIX_ROWS;

    // Column width is always a QUARTER of the grid width — the same
    // compact bubble spacing whether the sheet ends up using 1 column or
    // 4. Without this, a short test (few columns needed) would stretch
    // its single column across the FULL page width, spacing option
    // bubbles absurdly far apart. Unused width on the right (for short
    // tests) is simply left blank, same as the printed reference sheet
    // being a fixed template regardless of how many questions a given
    // test actually has.
    const blockWidth = (gridRight - gridLeft) / 4;

    // Pick the smallest column count (1–4) and smallest rows-per-column
    // (i.e. the LARGEST row height, for the easiest-to-scan sheet) that
    // still has enough total capacity for numQuestions, keeping row
    // height within a sane printable/scan-able range (5mm–10.5mm).
    let chosen = null;
    for (let cols = 1; cols <= 4 && !chosen; cols++) {
      const minRows = Math.ceil(gridHeightMM / 10.5);
      const maxRows = Math.floor(gridHeightMM / 5.0);
      for (let rowsPerCol = minRows; rowsPerCol <= maxRows; rowsPerCol++) {
        let capacity = 0;
        for (let c = 0; c < cols; c++) {
          capacity += maxQuestionsForRows(rowsPerCol - (c === 0 ? prefixRows : 0));
        }
        if (capacity >= numQuestions) { chosen = { cols, rowsPerCol }; break; }
      }
    }
    if (!chosen) chosen = { cols: 4, rowsPerCol: Math.floor(gridHeightMM / 5.0) };

    const { cols, rowsPerCol } = chosen;
    const rowHeight = gridHeightMM / rowsPerCol;
    const qLabelWidth = 9;   // mm reserved for the "001" style label
    const gapWidth = 6;      // mm clear gap + divider line before next column
    const optSpacing = (blockWidth - qLabelWidth - gapWidth) / 4;

    const bubbles = [];
    const headers = [];   // repeating "A B C D" rows: { col, rowIndex }
    const colMeta = [];   // per-column row plan, used by the docx builder
    let qNum = 1;
    for (let c = 0; c < cols && qNum <= numQuestions; c++) {
      const prefix = c === 0 ? prefixRows : 0;
      const capacity = maxQuestionsForRows(rowsPerCol - prefix);
      const take = Math.min(capacity, numQuestions - qNum + 1);
      const rows = [];
      let rowCursor = prefix, localQ = 0;
      while (localQ < take) {
        headers.push({ col: c, rowIndex: rowCursor });
        rows.push({ type: "header", rowIndex: rowCursor });
        rowCursor++;
        const groupSize = Math.min(5, take - localQ);
        for (let g = 0; g < groupSize; g++) {
          const q = qNum;
          const colX = gridLeft + c * blockWidth;
          const rowY = gridTop + rowCursor * rowHeight;
          const options = [0, 1, 2, 3].map(o => ({
            opt: o, x: colX + qLabelWidth + o * optSpacing + optSpacing / 2, y: rowY + rowHeight / 2
          }));
          bubbles.push({ q, qLabelX: colX, qLabelY: rowY + rowHeight / 2, options });
          rows.push({ type: "question", q, rowIndex: rowCursor });
          rowCursor++; qNum++; localQ++;
        }
      }
      colMeta.push({ colIndex: c, prefix, rows, totalRows: rowCursor });
    }

    const dividers = [];
    for (let c = 1; c < cols; c++) {
      dividers.push({ x: gridLeft + c * blockWidth - gapWidth / 2, yTop: gridTop - 4, yBottom: gridTop + rowsPerCol * rowHeight });
    }
    return {
      corners, bubbles, headers, colMeta, dividers, cols, optSpacing,
      // Full geometry exposed so buildOMRSheetDocx can render the grid at the
      // EXACT same mm coordinates the scanner assumes — the docx builder
      // walks colMeta row-by-row with fixed-height rows, so the printed
      // position of every row always lands at gridTop + rowIndex*rowHeight,
      // which is exactly what templateToPixel() assumes when mapping a
      // scanned photo back onto this template.
      gridTop, gridBottom, gridLeft, gridRight, blockWidth, rowHeight, rowsPerCol, qLabelWidth, gapWidth,
      prefixRows
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
    const noBorders = { top: { style: D.BorderStyle.NONE }, bottom: { style: D.BorderStyle.NONE }, left: { style: D.BorderStyle.NONE }, right: { style: D.BorderStyle.NONE } };
    const thinBox = { top: { style: D.BorderStyle.SINGLE, size: 4 }, bottom: { style: D.BorderStyle.SINGLE, size: 4 }, left: { style: D.BorderStyle.SINGLE, size: 4 }, right: { style: D.BorderStyle.SINGLE, size: 4 } };

    function circleCell(width, size) {
      return new D.TableCell({
        width: { size: mm(width), type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, borders: noBorders,
        children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: "○", size: size || 20 })] })]
      });
    }
    function textCell(width, text, opts) {
      opts = opts || {};
      return new D.TableCell({
        width: { size: mm(width), type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, borders: noBorders,
        children: [new D.Paragraph({ alignment: opts.align || D.AlignmentType.LEFT, children: [new D.TextRun({ text: text, bold: !!opts.bold, size: opts.size || 16 })] })]
      });
    }

    // ── Question grid ──────────────────────────────────────────────
    // Built entirely from computeOMRLayout()'s colMeta, the SAME function
    // (and the SAME row plan) the scanner uses to know where every bubble
    // is. Each column's nested table is a plain sequence of fixed-height
    // rows (D.HeightRule.EXACT) in the order colMeta lays out — header
    // rows ("A B C D"), question rows, and for column 0 the Exam
    // Set + Roll No + Subject/Section block first — so the printed
    // position of every row always lands at exactly gridTop + rowIndex *
    // rowHeight, matching what templateToPixel() assumes when mapping a
    // scanned photo back onto this template.
    const layout = computeOMRLayout(n);
    const { cols, rowHeight, blockWidth, qLabelWidth, colMeta } = layout;
    const optW = (blockWidth - qLabelWidth) / 4;
    const outerGridCells = [];
    for (let c = 0; c < cols; c++) {
      const meta = colMeta[c];
      const innerRows = [];

      if (c === 0) {
        // Exam Set: label row, then a row of letter+bubble cells (A–E)
        innerRows.push(new D.TableRow({
          height: { value: mm(rowHeight), rule: D.HeightRule.EXACT },
          children: [new D.TableCell({ columnSpan: 5, borders: noBorders, verticalAlign: D.VerticalAlign.CENTER, children: [new D.Paragraph({ children: [new D.TextRun({ text: "Exam Set", bold: true, size: 14 })] })] })]
        }));
        const esW = (blockWidth - qLabelWidth) / 5;
        const esCells = [textCell(qLabelWidth, "", {})];
        ["A", "B", "C", "D", "E"].forEach(L => esCells.push(new D.TableCell({
          width: { size: mm(esW), type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, borders: noBorders,
          children: [
            new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: L, bold: true, size: 12 })] }),
            new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: "○", size: 18 })] })
          ]
        })));
        innerRows.push(new D.TableRow({ children: esCells, height: { value: mm(rowHeight), rule: D.HeightRule.EXACT } }));

        // Roll No: label row, then digit rows 0–9 with tens + units bubbles
        innerRows.push(new D.TableRow({
          height: { value: mm(rowHeight), rule: D.HeightRule.EXACT },
          children: [new D.TableCell({ columnSpan: 5, borders: noBorders, verticalAlign: D.VerticalAlign.CENTER, children: [new D.Paragraph({ children: [new D.TextRun({ text: "Roll No.", bold: true, size: 14 })] })] })]
        }));
        const rollBubbleW = (blockWidth - qLabelWidth) / 2;
        for (let d = 0; d <= 9; d++) {
          innerRows.push(new D.TableRow({
            height: { value: mm(rowHeight), rule: D.HeightRule.EXACT },
            children: [textCell(qLabelWidth, String(d), { size: 14, align: D.AlignmentType.CENTER }), circleCell(rollBubbleW, 18), circleCell(rollBubbleW, 18)]
          }));
        }

        // Subject / Section label
        innerRows.push(new D.TableRow({
          height: { value: mm(rowHeight), rule: D.HeightRule.EXACT },
          children: [new D.TableCell({
            columnSpan: 3, borders: noBorders, verticalAlign: D.VerticalAlign.CENTER,
            children: [
              new D.Paragraph({ children: [new D.TextRun({ text: "Subject 1", bold: true, size: 14 })] }),
              new D.Paragraph({ children: [new D.TextRun({ text: "Section 1", bold: true, size: 14 })] })
            ]
          })]
        }));
      }

      meta.rows.forEach(r => {
        if (r.type === "header") {
          const cells = [textCell(qLabelWidth, "", {})];
          ["A", "B", "C", "D"].forEach(L => cells.push(textCell(optW, L, { bold: true, size: 16, align: D.AlignmentType.CENTER })));
          innerRows.push(new D.TableRow({ children: cells, height: { value: mm(rowHeight), rule: D.HeightRule.EXACT } }));
        } else {
          const qLabel = String(r.q).padStart(r.q >= 100 ? 3 : (r.q >= 10 ? 2 : 1), "0");
          const rowCells = [textCell(qLabelWidth, qLabel, { bold: true, size: 16 })];
          for (let o = 0; o < 4; o++) rowCells.push(circleCell(optW, 20));
          innerRows.push(new D.TableRow({ children: rowCells, height: { value: mm(rowHeight), rule: D.HeightRule.EXACT } }));
        }
      });

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
      width: { size: mm(layout.blockWidth * layout.cols), type: D.WidthType.DXA },
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

    // ── Header: boxed NAME / EXAM / DATE row (matches the reference
    // sheet's header exactly), plus a secondary line for the written-out
    // roll number/mobile (redundant with the Roll No bubble block in
    // column 0 — same double written+bubbled convention as the paper
    // reference), and the instructions box. ─────────────────────────
    const headerBoxRow = new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      rows: [
        new D.TableRow({ children: [
          new D.TableCell({ width: { size: mm(110), type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, borders: thinBox, children: [new D.Paragraph({ children: [new D.TextRun("NAME : ")] })] }),
          new D.TableCell({ verticalAlign: D.VerticalAlign.CENTER, borders: thinBox, children: [new D.Paragraph({ children: [new D.TextRun(`EXAM : ${test.title || "Test"}`)] })] })
        ] }),
        new D.TableRow({ children: [
          new D.TableCell({ columnSpan: 2, verticalAlign: D.VerticalAlign.CENTER, borders: thinBox, children: [new D.Paragraph({ children: [new D.TextRun(`DATE : ____________     Roll Number: ______________   Mobile: ______________   Test ID: ${testId}`)] })] })
        ] })
      ],
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
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: "EXAMNOVA — OMR उत्तर पत्रक", bold: true, size: 32 })] }),
          new D.Paragraph({ spacing: { before: 100 }, children: [] }),
          headerBoxRow,
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

  // Test se linked Exam Management wali exam dhoondhta hai (jo Test save
  // hote hi khud-ba-khud ban jaati hai — script.js ka syncTestToExamManager
  // dekhein). Isi exam ka OMR/Bubble Sheet yahan bhi dikhaya/download
  // kiya jaata hai, taaki Test ka aur Exam Management ka OMR — dono
  // EK HI sheet hon (alag-alag layout na banein).
  async function findLinkedExamManagerExam(testId) {
    const db = typeof getDB === "function" ? getDB() : null;
    if (!db) return null;
    try {
      const snap = await db.collection("examManagerExams").where("linkedTestId", "==", testId).limit(1).get();
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (err) {
      console.warn("[findLinkedExamManagerExam] lookup failed:", err);
      return null;
    }
  }

  async function generateOMRSheet() {
    const testId = document.getElementById("omr-sheet-test-select")?.value;
    if (!testId || typeof tests === "undefined" || !tests[testId]) { alert("Pehle test select karein."); return; }
    const test = tests[testId];
    if (!test.questions || !test.questions.length) { alert("Is test mein questions nahi hain."); return; }
    if (test.questions.length > 100) { alert("OMR sheet abhi max 100 questions tak support karti hai."); return; }

    const btn = document.getElementById("omr-generate-sheet-btn");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ OMR Sheet (JPG) Bana Rahe Hain..."; }

    try {
      const linkedExam = await findLinkedExamManagerExam(testId);
      if (!linkedExam) {
        alert("Ye test abhi Exam Management se link nahi hua — pehle test ko \"Create/Edit Test\" se ek baar Save/Publish karein (draft nahi), phir dobara try karein.");
        return;
      }
      if (typeof window.examgrDownloadSheetJpg !== "function") {
        alert("OMR sheet module load nahi ho paya — page reload karke dobara try karein.");
        return;
      }
      await window.examgrDownloadSheetJpg(linkedExam, test.title);
    } catch (e) {
      console.error(e);
      alert("OMR Sheet generate karne mein error: " + (e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "🖨️ OMR Sheet Generate Karein (JPG)"; }
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

      // Subjective questions have no MCQ option to type in here either,
      // so mark them pending for manual grading instead of scoring them
      // as wrong.
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

  // Custom-sheet OMR template trainer ("Naya Sheet Sikhayein") removed —
  // unused feature; scanning always uses the default system-generated sheet.


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

  // Exposed so other pages (e.g. the Question Generator) can build a
  // blank OMR bubble-sheet for an in-progress paper that hasn't been
  // saved/published as a test yet — same exact grid geometry the
  // scanner uses (computeOMRLayout), just called directly with a
  // {title, questions} object instead of a saved `tests[testId]`.
  window.buildOMRSheetDocx = buildOMRSheetDocx;

})();
