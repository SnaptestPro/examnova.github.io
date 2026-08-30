/* ==========================================================================
   📖 BOOKLET PRINT MODE  (booklet-print.js)
   --------------------------------------------------------------------------
   Aapke offline test wale format (A4 ko 2 hisso mein baant kar, aage-piche
   print karke fold karne pe book jaisa banna) ko is Question Generator ke
   andar se ek button-click mein reproduce karta hai.

   Kya karta hai:
   1. Current paper (header + instructions + saare questions, MCQ ya
      subjective — jitne bhi paperQuestions/section mein hain) ko uthata hai.
   2. Unhe A5-size "logical pages" mein todta hai (jitna A5 page mein fit
      hoga utna hi ek page mein rakhta hai — jaisa print shop wale karte
      hain).
   3. In logical pages ko saheed booklet imposition order mein A4-landscape
      sheets pe 2-2 karke jamaata hai (page N aur page 1 saath, phir 2 aur
      N-1 saath... — yehi wo trick hai jisse fold karne pe number sahi
      sequence mein aata hai).
   4. Ek naye tab mein print-ready HTML kholta hai — bas Ctrl+P karke
      "Double-sided printing → Flip on SHORT edge" choose karna hai
      (kyunki page landscape hai). Print hone ke baad beech se fold + staple
      karne pe wahi "book" wala result milega jo aap haath se banate the.

   Integration (1 line + 1 button):
     question-generator.html ke </body> se pehle:
       <script src="booklet-print.js"></script>
     Sidebar "Actions" bar mein (qgen-app.js/HTML jahan printPaper() button
     hai, uske paas) ek naya button daal dijiye:
       <button class="btn btn-sm btn-outline" onclick="printPaperBooklet()">
         📖 Booklet Print
       </button>

   Ye file kisi existing file ko chhedti nahi — sirf ek naya global function
   window.printPaperBooklet() add karti hai, jo aapke existing
   paperQuestions / sections / renderPqOpts (qgen-app.js) data ka reuse
   karta hai.
   ========================================================================== */

(function () {
  'use strict';

  // 1mm in CSS px (browser-standard: 96px per inch, 25.4mm per inch)
  var MM_PX = 96 / 25.4;

  // ---- A5 half-page geometry (tweak here if content overflows/underflows)
  var PAGE_W_MM = 148;      // A5 width
  var PAGE_H_MM = 210;      // A5 height
  var PAD_MM    = 9;        // inner padding of each A5 half
  var GUTTER_MM = 6;        // extra safety margin near the centre fold

  var CONTENT_W_MM = PAGE_W_MM - PAD_MM * 2;
  var CONTENT_H_MM = PAGE_H_MM - PAD_MM * 2;
  var CONTENT_W_PX = Math.floor(CONTENT_W_MM * MM_PX);
  var CONTENT_H_PX = Math.floor(CONTENT_H_MM * MM_PX);

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
    return (window.paperQuestions || []);
  }

  // Render MCQ options WITHOUT the "correct answer" highlight — this is
  // the actual paper students will write on, unlike the editor Preview
  // (which purposely shows the green highlight for the teacher).
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
  // Greedy pagination: fill an off-screen A5-width sandbox, add blocks
  // one at a time, and start a new logical page whenever the next block
  // would overflow CONTENT_H_PX. Header always opens page 1.
  // -------------------------------------------------------------------
  function paginate(headerHtml, blocksHtml) {
    var sandbox = document.createElement('div');
    sandbox.style.cssText =
      'position:fixed;left:-9999px;top:0;width:' + CONTENT_W_PX + 'px;' +
      'visibility:hidden;pointer-events:none;';
    sandbox.className = 'bp-sandbox bp-half-inner';
    document.body.appendChild(sandbox);

    function heightOf(html) {
      sandbox.innerHTML = html;
      return sandbox.getBoundingClientRect().height;
    }

    var pages = [];
    var pageParts = [];

    if (headerHtml) {
      pageParts.push(headerHtml);
    }

    blocksHtml.forEach(function (block) {
      var testHtml = pageParts.join('') + block;
      var h = heightOf(testHtml);
      if (h > CONTENT_H_PX && pageParts.length) {
        pages.push(pageParts.join(''));
        pageParts = [block];
        // agar akela block bhi ek page se lamba hai to bhi usko apna
        // page de dete hain (overflow ho sakta hai — chhote font/marks
        // wale bade paragraph question ke liye PAD_MM ya CONTENT_H_MM
        // thoda badha dein)
      } else {
        pageParts.push(block);
      }
    });
    if (pageParts.length) pages.push(pageParts.join(''));

    sandbox.remove();
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

  function halfHtml(pageHtml, isBlank) {
    return '<div class="bp-half' + (isBlank ? ' bp-half-blank' : '') + '">' +
             '<div class="bp-half-inner">' + pageHtml + '</div>' +
           '</div>';
  }

  function sheetHtml(sides) {
    // sides = [leftHtml, rightHtml]
    return '<div class="bp-sheet">' +
             halfHtml(sides[0], !sides[0]) +
             '<div class="bp-fold"></div>' +
             halfHtml(sides[1], !sides[1]) +
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
        '<div><b>📖 Booklet Print Ready</b> — ' + sheets.length + ' sheet' + (sheets.length > 1 ? 's' : '') + ' (' + (sheets.length * 4) + ' pages)</div>' +
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
      '.bp-half-blank{background:repeating-linear-gradient(45deg,#fafafa,#fafafa 10px,#fff 10px,#fff 20px)}',
      '.bp-fold{width:0;border-left:1px dashed #cbd5e1}',
      '.bp-half-inner{width:' + CONTENT_W_MM + 'mm;height:' + CONTENT_H_MM + 'mm;overflow:hidden}',
      // header (cloned from the live paper — reuse its own look)
      '.bp-header-wrap{margin:-2px -2px 8px;border-radius:4px;overflow:hidden}',
      '.paper-header{background:linear-gradient(135deg,#1a0533,#2d0a5e 50%,#1a0533);padding:0}',
      '.paper-header-top{display:flex;align-items:center;justify-content:space-between;padding:9px 12px 6px;gap:8px}',
      '.hbadge{background:rgba(255,255,255,.12);border:1.2px solid rgba(255,255,255,.28);color:#fff;font-size:9.5px;font-weight:700;padding:3px 9px;border-radius:4px;white-space:nowrap}',
      '.htopic{color:#ffd700;font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-align:center;flex:1}',
      '.paper-header-meta{display:flex;align-items:center;justify-content:center;gap:12px;padding:5px 12px 8px;color:rgba(255,255,255,.88);font-size:10px;font-weight:500;border-top:1px solid rgba(255,255,255,.1)}',
      '.sep{color:rgba(255,255,255,.3)}',
      '.paper-instructions{background:#fffbeb;border-left:3px solid #f59e0b;padding:6px 10px;font-size:9.5px;color:#78350f;line-height:1.5}',
      // question items
      '.bp-item{padding:6px 0;border-bottom:1px dashed #cbd5e1;break-inside:avoid;page-break-inside:avoid}',
      '.bp-item:last-child{border-bottom:none}',
      '.bp-qhead{display:flex;gap:6px;font-size:10.5px;line-height:1.45;color:#111827}',
      '.bp-num{font-weight:800;color:#4a0e8f;min-width:16px;flex-shrink:0}',
      '.bp-opts{display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;padding-left:22px;margin-top:2px}',
      '.bp-opt{display:flex;gap:4px;font-size:9.5px;color:#1f2937;line-height:1.4}',
      '.bp-opt-tag{font-weight:700;color:#4a0e8f;flex-shrink:0}',
      '.bp-sub-badge{margin-left:22px;margin-top:2px;font-size:9px;color:#92400e;font-weight:600}',
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
