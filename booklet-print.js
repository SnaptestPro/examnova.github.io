/* ==========================================================================
   📖 BOOKLET PRINT MODE — v2 (4-column, per-page fold-safe)  (booklet-print.js)
   --------------------------------------------------------------------------
   Aapke offline test wale format (A4 ko 2 hisso mein baant kar, aage-piche
   print karke fold karne pe book jaisa banna) ko is Question Generator ke
   andar se ek button-click mein reproduce karta hai.

   v2 mein kya badla (purani version "single column, poore A5 half mein
   ek hi list" tha — usse book jaisa nahi lagta tha):
   1. Har A5 half-page ab 4-Column Print jaisi 4 columns mein bata hai
      (question ka number + text + options, sab compact).
   2. Columns ka batwara CSS `column-count` (jo browser-print ke waqt kabhi
      bhi differently balance kar sakta hai) se NAHI, balki JS khud
      har question-block ko explicitly ek column mein daalta hai — isliye
      jo humne preview mein measure kiya wahi hi print mein bhi aayega,
      koi surprise reflow nahi.
   3. Spine (beech ka fold) ke paas ek extra "gutter" margin diya gaya hai
      taaki stapling/fold ke baad text spine mein dabkar illegible na ho —
      yehi cheez print-shop wale asli booklet mein karte hain.
   4. Baaki sab (A5 "logical pages" banana, phir unhe saddle-stitch
      imposition order mein A4-landscape sheets pe jamana taaki fold karne
      pe sahi sequence 1,2,3...N mein aaye) waisa hi hai jaisa pehle tha.

   Integration (already wired — koi HTML change nahi chahiye):
     question-generator.html mein already hai:
       <script src="booklet-print.js?v=..."></script>
       <button onclick="printPaperBooklet()">📖 Booklet Print (Fold-able)</button>
     Bas is file ko replace karke purani jagah rakh dijiye.

   Print instructions (student ko A5 booklet chahiye):
     Ctrl+P → Two-sided printing ON → "Flip on SHORT edge" (page landscape
     hai isliye) → Paper A4, Layout Landscape, Margins None → print → beech
     se fold + staple.
   ========================================================================== */

(function () {
  'use strict';

  // 1mm in CSS px (browser-standard: 96px per inch, 25.4mm per inch)
  var MM_PX = 96 / 25.4;

  // ---- A5 half-page geometry (tweak here if content overflows/underflows)
  var PAGE_W_MM   = 148;      // A5 width  (one half of the A4-landscape sheet)
  var PAGE_H_MM   = 210;      // A5 height
  var PAD_MM      = 7;        // outer padding of each A5 half
  var GUTTER_MM   = 5;        // EXTRA inner margin on the spine (fold) side —
                               // keeps text away from the centre fold so
                               // nothing gets lost/illegible after binding.
  var COLS        = 4;        // columns per A5 half, as requested
  var COL_GAP_MM  = 2.5;      // gap between the 4 columns

  var CONTENT_W_MM = PAGE_W_MM - PAD_MM * 2 - GUTTER_MM;
  var CONTENT_H_MM = PAGE_H_MM - PAD_MM * 2;
  var CONTENT_W_PX = Math.floor(CONTENT_W_MM * MM_PX);
  var CONTENT_H_PX = Math.floor(CONTENT_H_MM * MM_PX);

  var COL_WIDTH_MM = (CONTENT_W_MM - COL_GAP_MM * (COLS - 1)) / COLS;
  var COL_WIDTH_PX = Math.floor(COL_WIDTH_MM * MM_PX);

  // -------------------------------------------------------------------
  // Grab current paper data (works both in normal mode and section mode)
  // -------------------------------------------------------------------
  function getBookletQuestions() {
    try {
      if (typeof isSectionMode === 'function' && isSectionMode() &&
          typeof getAllQuestionsFlat === 'function') {
        return getAllQuestionsFlat();
      }
    } catch (e) { /* isSectionMode/getAllQuestionsFlat not present */ }
    // NOTE: qgen-app.js declares `let paperQuestions = []` at top level of a
    // classic <script> — that does NOT attach it as `window.paperQuestions`
    // (only `var`/`function` do). So we must reference the bare identifier
    // here, not `window.paperQuestions` (which is always undefined).
    try {
      if (typeof paperQuestions !== 'undefined') return paperQuestions || [];
    } catch (e) { /* paperQuestions not in scope */ }
    return [];
  }

  // Render MCQ options WITHOUT the "correct answer" highlight — this is
  // the actual paper students will write on, unlike the editor Preview
  // (which purposely shows the green highlight for the teacher).
  // Options are stacked one-per-line (not a 2-column grid) because each
  // of the 4 print-columns is already narrow — a nested grid here would
  // be unreadable.
  function renderOptsPlain(q) {
    if (q.qType === 'subjective') {
      var marksLabel = (q.marks !== undefined && q.marks !== null && q.marks !== '')
        ? (q.marks + ' marks') : '';
      return '<div class="bp-sub-badge">📝' + (marksLabel ? ' · ' + marksLabel : '') + '</div>';
    }
    var LBL = (typeof LABELS !== 'undefined') ? LABELS : ['A', 'B', 'C', 'D'];
    return (q.opts || []).map(function (opt, oi) {
      return '<div class="bp-opt"><span class="bp-opt-tag">[' + LBL[oi] + ']</span>' +
             '<span class="math-text">' + opt + '</span></div>';
    }).join('');
  }

  function buildHeaderHtml() {
    var header = document.querySelector('#paper .paper-header');
    var instr  = document.getElementById('paper-instr');
    var html = '<div class="bp-header-wrap">';
    if (header) html += header.outerHTML;
    if (instr)  html += instr.outerHTML;
    html += '</div>';
    return html;
  }

  function buildQuestionBlocksHtml(questions) {
    return questions.map(function (q, i) {
      var opts = renderOptsPlain(q);
      return '<div class="bp-item">' +
               '<div class="bp-qhead"><span class="bp-num">' + (i + 1) + '.</span>' +
               '<span class="math-text">' + q.text + '</span></div>' +
               '<div class="bp-opts">' + opts + '</div>' +
             '</div>';
    });
  }

  // -------------------------------------------------------------------
  // Greedy pagination — now column-aware.
  //
  // Each "logical page" = one A5 half, holding up to 4 explicit columns.
  // We measure blocks off-screen at the ACTUAL column width (not the
  // full A5-half width like v1 did), and manually decide which of the
  // 4 columns each block lands in. Because we build the exact same
  // <div class="bp-col">...</div> markup that will be printed, there is
  // no separate CSS-column reflow step that could disagree with our
  // measurement.
  //
  // The header only appears once, on the very first logical page, and
  // spans the full content width above the 4 columns (reduces that
  // page's column capacity by the header's rendered height).
  // -------------------------------------------------------------------
  function paginate(headerHtml, blocksHtml) {
    // Sandbox #1: measure the header at full content width (it spans all
    // 4 columns when placed on the page).
    var headerSandbox = document.createElement('div');
    headerSandbox.style.cssText =
      'position:fixed;left:-9999px;top:0;width:' + CONTENT_W_PX + 'px;' +
      'visibility:hidden;pointer-events:none;';
    document.body.appendChild(headerSandbox);
    headerSandbox.innerHTML = headerHtml || '';
    var headerHeightPx = headerHtml ? headerSandbox.getBoundingClientRect().height : 0;
    headerSandbox.remove();

    // Sandbox #2: measure question blocks at the narrow single-column width.
    var colSandbox = document.createElement('div');
    colSandbox.style.cssText =
      'position:fixed;left:-9999px;top:0;width:' + COL_WIDTH_PX + 'px;' +
      'visibility:hidden;pointer-events:none;';
    colSandbox.className = 'bp-col';
    document.body.appendChild(colSandbox);

    function heightOf(html) {
      colSandbox.innerHTML = html;
      return colSandbox.getBoundingClientRect().height;
    }

    var pages = [];
    var curCols = [[], [], [], []];
    var colIdx = 0;
    var pageHasHeader = true; // only the very first logical page gets it

    function capacity() {
      return pageHasHeader ? (CONTENT_H_PX - headerHeightPx) : CONTENT_H_PX;
    }

    function finalizePage() {
      var colsHtml = curCols.map(function (blocks) {
        return '<div class="bp-col">' + blocks.join('') + '</div>';
      }).join('');
      var html = (pageHasHeader && headerHtml ? headerHtml : '') +
                 '<div class="bp-cols">' + colsHtml + '</div>';
      pages.push(html);
      curCols = [[], [], [], []];
      colIdx = 0;
      pageHasHeader = false;
    }

    blocksHtml.forEach(function (block) {
      var candidate = curCols[colIdx].join('') + block;
      var h = heightOf(candidate);

      if (h > capacity() && curCols[colIdx].length) {
        // this column is full — move to the next one
        colIdx++;
        if (colIdx >= COLS) {
          finalizePage(); // resets colIdx to 0 on a fresh page
        }
        // place block fresh in the (now-empty) column — even if it alone
        // overflows the column, give it its own column rather than losing
        // it (mirrors v1's "give an oversized block its own page" rule,
        // just scoped to a column instead of a whole page).
        curCols[colIdx].push(block);
      } else {
        curCols[colIdx].push(block);
      }
    });

    if (curCols.some(function (c) { return c.length; }) || pages.length === 0) {
      finalizePage();
    }

    colSandbox.remove();
    return pages.length ? pages : [''];
  }

  // -------------------------------------------------------------------
  // Booklet imposition: given P logical pages (padded to a multiple of
  // 4), returns sheets = [{front:[left,right]}, {back:[left,right]}, ...]
  // Standard saddle-stitch formula so that after duplex print + centre
  // fold, pages read 1,2,3,...P in order.
  // -------------------------------------------------------------------
  function imposeSheets(pages) {
    var arr = pages.slice();
    while (arr.length % 4 !== 0) arr.push(''); // blank filler pages
    var P = arr.length;
    var sheets = [];
    for (var j = 0; j < P / 4; j++) {
      var frontLeftIdx  = P - 2 * j - 1;
      var frontRightIdx = 2 * j;
      var backLeftIdx   = 2 * j + 1;
      var backRightIdx  = P - 2 * j - 2;
      sheets.push({
        front: [arr[frontLeftIdx] || '', arr[frontRightIdx] || ''],
        back:  [arr[backLeftIdx]  || '', arr[backRightIdx]  || '']
      });
    }
    return sheets;
  }

  // side: 'left' | 'right' — controls which edge gets the extra spine
  // gutter, so the fold-facing edge always has the wider margin.
  function halfHtml(pageHtml, isBlank, side) {
    return '<div class="bp-half bp-half-' + side + (isBlank ? ' bp-half-blank' : '') + '">' +
             '<div class="bp-half-inner">' + pageHtml + '</div>' +
           '</div>';
  }

  function sheetHtml(sides) {
    // sides = [leftHtml, rightHtml]
    return '<div class="bp-sheet">' +
             halfHtml(sides[0], !sides[0], 'left') +
             '<div class="bp-fold"></div>' +
             halfHtml(sides[1], !sides[1], 'right') +
           '</div>';
  }

  function buildDocument(sheets) {
    var body = sheets.map(function (s) {
      return sheetHtml(s.front) + sheetHtml(s.back);
    }).join('');

    var head =
      '<meta charset="UTF-8"/>' +
      '<title>Booklet Print</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet"/>' +
      '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"/>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"><\/script>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"><\/script>' +
      '<style>' + bookletCss() + '</style>';

    var toolbar =
      '<div class="bp-toolbar no-print">' +
        '<div><b>📖 Booklet Print Ready</b> — ' + sheets.length + ' sheet' + (sheets.length > 1 ? 's' : '') + ' (' + (sheets.length * 4) + ' pages · ' + COLS + ' columns/page)</div>' +
        '<div class="bp-toolbar-hint">Print dialog mein: <b>Two-sided → Flip on Short Edge</b> · Paper size <b>A4</b> · Layout <b>Landscape</b> · Margins <b>None</b></div>' +
        '<button onclick="window.print()">🖨️ Print Now</button>' +
      '</div>';

    return '<!DOCTYPE html><html><head>' + head + '</head><body>' +
           toolbar + '<div class="bp-doc">' + body + '</div>' +
           '<script>window.addEventListener("load",function(){' +
             'if(window.renderMathInElement){renderMathInElement(document.body,{' +
               'delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],' +
               'throwOnError:false});}' +
           '});<\/script>' +
           '</body></html>';
  }

  function bookletCss() {
    return [
      '@page{size:A4 landscape;margin:0}',
      '*{box-sizing:border-box}',
      'body{margin:0;font-family:"Inter","Noto Sans Devanagari",sans-serif;background:#525659}',
      '.bp-toolbar{position:sticky;top:0;z-index:9;background:#111827;color:#fff;display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 18px;font-size:13px}',
      '.bp-toolbar b{color:#facc15}',
      '.bp-toolbar-hint{opacity:.85;font-size:12px}',
      '.bp-toolbar button{margin-left:auto;background:#4a0e8f;color:#fff;border:0;border-radius:6px;padding:8px 16px;font-weight:700;cursor:pointer}',
      '.bp-doc{display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px 0 40px}',
      '.bp-sheet{width:297mm;height:210mm;background:#fff;display:flex;box-shadow:0 2px 10px rgba(0,0,0,.35);page-break-after:always;break-after:page}',
      '.bp-half{width:148.5mm;height:210mm;padding:' + PAD_MM + 'mm;overflow:hidden;position:relative}',
      // spine-side gutter: left half's spine edge is its RIGHT edge,
      // right half's spine edge is its LEFT edge.
      '.bp-half-left{padding-right:' + (PAD_MM + GUTTER_MM) + 'mm}',
      '.bp-half-right{padding-left:' + (PAD_MM + GUTTER_MM) + 'mm}',
      '.bp-half-blank{background:repeating-linear-gradient(45deg,#fafafa,#fafafa 10px,#fff 10px,#fff 20px)}',
      '.bp-fold{width:0;border-left:1px dashed #cbd5e1}',
      '.bp-half-inner{width:' + CONTENT_W_MM + 'mm;height:' + CONTENT_H_MM + 'mm;overflow:hidden}',
      // header (cloned from the live paper — reuse its own look)
      '.bp-header-wrap{margin:-2px -2px 6px;border-radius:4px;overflow:hidden}',
      '.paper-header{background:linear-gradient(135deg,#1a0533,#2d0a5e 50%,#1a0533);padding:0}',
      '.paper-header-top{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 4px;gap:6px}',
      '.hbadge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);color:#fff;font-size:7px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap}',
      '.htopic{color:#ffd700;font-size:8.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;text-align:center;flex:1}',
      '.paper-header-meta{display:flex;align-items:center;justify-content:center;gap:8px;padding:3px 8px 5px;color:rgba(255,255,255,.88);font-size:7px;font-weight:500;border-top:1px solid rgba(255,255,255,.1)}',
      '.sep{color:rgba(255,255,255,.3)}',
      '.paper-instructions{background:#fffbeb;border-left:2px solid #f59e0b;padding:4px 6px;font-size:6.5px;color:#78350f;line-height:1.4}',
      // 4-column layout — explicit flex columns, JS-assigned (no CSS
      // column-count auto-balancing, so print always matches preview)
      '.bp-cols{display:flex;gap:' + COL_GAP_MM + 'mm;align-items:flex-start;height:100%}',
      '.bp-col{width:' + COL_WIDTH_MM + 'mm;flex:0 0 ' + COL_WIDTH_MM + 'mm;overflow:hidden}',
      '.bp-col:not(:first-child){border-left:1px dashed #d1d5db;padding-left:' + (COL_GAP_MM / 2) + 'mm;margin-left:-' + (COL_GAP_MM / 2) + 'mm}',
      // question items — sized for a narrow (~30mm) column
      '.bp-item{padding:3px 0;border-bottom:1px dashed #e2e8f0;break-inside:avoid;page-break-inside:avoid}',
      '.bp-item:last-child{border-bottom:none}',
      '.bp-qhead{display:flex;gap:3px;font-size:7px;line-height:1.35;color:#111827}',
      '.bp-num{font-weight:800;color:#4a0e8f;flex-shrink:0}',
      '.bp-opts{display:flex;flex-direction:column;gap:1px;padding-left:9px;margin-top:1px}',
      '.bp-opt{display:flex;gap:2px;font-size:6.5px;color:#1f2937;line-height:1.3}',
      '.bp-opt-tag{font-weight:700;color:#4a0e8f;flex-shrink:0}',
      '.bp-sub-badge{margin-left:9px;margin-top:1px;font-size:6.5px;color:#92400e;font-weight:600}',
      '@media print{',
        'body{background:#fff}',
        '.no-print{display:none!important}',
        '.bp-doc{padding:0;gap:0}',
        '.bp-sheet{box-shadow:none}',
      '}'
    ].join('\n');
  }

  // -------------------------------------------------------------------
  // Public entry point
  // -------------------------------------------------------------------
  window.printPaperBooklet = function printPaperBooklet() {
    var questions = getBookletQuestions();
    if (!questions.length) {
      alert('Pehle paper mein kam se kam ek question add karein.');
      return;
    }
    var headerHtml = buildHeaderHtml();
    var blocksHtml = buildQuestionBlocksHtml(questions);
    var pages = paginate(headerHtml, blocksHtml);
    var sheets = imposeSheets(pages);
    var html = buildDocument(sheets);

    var win = window.open('', '_blank');
    if (!win) {
      alert('Popup blocked ho gaya — browser mein is site ke liye popups allow karein aur dobara try karein.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };
})();
