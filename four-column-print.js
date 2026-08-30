/* ==========================================================================
   🗞️ 4-COLUMN PRINT MODE  (four-column-print.js)
   --------------------------------------------------------------------------
   Aapke reference PDF (science_and_hindi.pdf) ke objective-question pages
   (page 2-5) jaisa hi format: A4 PORTRAIT, poore page ko 4 barabar chaudi
   columns mein CSS se auto-flow karta hai — bilkul jaisa Word/Google Docs
   ka "Columns" feature karta hai. Booklet Print (A5-fold wala) se ALAG hai
   — 4 columns A5-half mein fit nahi ho sakte (bahut narrow ho jaate), isliye
   ye poore-width portrait page use karta hai jaisa reference mein hai.

   Kaise kaam karta hai:
   - Header/Instructions ek baar top pe pura-width mein aata hai
     (CSS `column-span: all` se — jaisa reference ke page 1 pe title hai)
   - Uske neeche saare questions 4 columns mein flow hote hain
   - Browser khud content ko multiple A4 pages mein todta hai jab print
     karte hain (koi manual page-measurement JS nahi chahiye)
   - Correct-answer highlight NAHI dikhaya jaata (ye students ka asli paper
     hai, teacher ka preview nahi)

   Integration:
     question-generator.html mein, booklet-print.js include line ke baad:
       <script>document.write('<script src="four-column-print.js?v=' + Date.now() + '"><\/script>');</script>
     Aur ek button:
       <button class="btn btn-sm btn-outline" onclick="printPaperFourColumn()">🗞️ 4-Column Print</button>
   ========================================================================== */

(function () {
  'use strict';

  function getQuestions() {
    try {
      if (typeof isSectionMode === 'function' && isSectionMode() &&
          typeof getAllQuestionsFlat === 'function') {
        return getAllQuestionsFlat();
      }
    } catch (e) {}
    try {
      if (typeof paperQuestions !== 'undefined') return paperQuestions || [];
    } catch (e) {}
    return [];
  }

  // Plain option renderer — NO correct-answer highlight (this is the
  // student's actual paper, unlike the editor Preview which highlights
  // the correct answer for the teacher).
  function renderOptsPlain(q) {
    if (q.qType === 'subjective') {
      var marksLabel = (q.marks !== undefined && q.marks !== null && q.marks !== '')
        ? (q.marks + ' marks') : '';
      return '<div class="fc-sub-badge">📝' + (marksLabel ? ' · ' + marksLabel : '') + '</div>';
    }
    var LBL = (typeof LABELS !== 'undefined') ? LABELS : ['A', 'B', 'C', 'D'];
    return (q.opts || []).map(function (opt, oi) {
      return '<div class="fc-opt"><span class="fc-opt-tag">[' + LBL[oi] + ']</span>' +
             '<span class="math-text">' + opt + '</span></div>';
    }).join('');
  }

  function buildHeaderHtml() {
    var header = document.querySelector('#paper .paper-header');
    var instr  = document.getElementById('paper-instr');
    var html = '<div class="fc-header-wrap">';
    if (header) html += header.outerHTML;
    if (instr)  html += instr.outerHTML;
    html += '</div>';
    return html;
  }

  function buildQuestionsHtml(questions) {
    return questions.map(function (q, i) {
      return '<div class="fc-item">' +
               '<div class="fc-qhead"><span class="fc-num">' + (i + 1) + '.</span>' +
               '<span class="math-text">' + q.text + '</span></div>' +
               '<div class="fc-opts">' + renderOptsPlain(q) + '</div>' +
             '</div>';
    }).join('');
  }

  function css() {
    return [
      '@page{size:A4 portrait;margin:12mm 10mm}',
      '*{box-sizing:border-box}',
      'body{margin:0;font-family:"Inter","Noto Sans Devanagari",sans-serif;background:#525659;color:#111}',
      '.fc-toolbar{position:sticky;top:0;z-index:9;background:#111827;color:#fff;display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 18px;font-size:13px}',
      '.fc-toolbar b{color:#facc15}',
      '.fc-toolbar button{margin-left:auto;background:#4a0e8f;color:#fff;border:0;border-radius:6px;padding:8px 16px;font-weight:700;cursor:pointer}',
      '.fc-page{max-width:210mm;margin:14px auto;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);padding:12mm 10mm}',
      // header spans all 4 columns, sits above the flowing questions
      '.fc-header-wrap{column-span:all;margin-bottom:10px}',
      '.paper-header{background:linear-gradient(135deg,#1a0533,#2d0a5e 50%,#1a0533);padding:0;border-radius:4px;overflow:hidden}',
      '.paper-header-top{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 7px;gap:10px}',
      '.hbadge{background:rgba(255,255,255,.12);border:1.2px solid rgba(255,255,255,.28);color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;white-space:nowrap}',
      '.htopic{color:#ffd700;font-size:14px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-align:center;flex:1}',
      '.paper-header-meta{display:flex;align-items:center;justify-content:center;gap:14px;padding:6px 14px 9px;color:rgba(255,255,255,.88);font-size:11px;font-weight:500;border-top:1px solid rgba(255,255,255,.1)}',
      '.sep{color:rgba(255,255,255,.3)}',
      '.paper-instructions{background:#fffbeb;border-left:3px solid #f59e0b;padding:7px 12px;font-size:10.5px;color:#78350f;line-height:1.55;margin-top:6px}',
      // the actual 4-column flow — this is the reference PDF's layout
      '.fc-columns{column-count:4;column-gap:16px;column-rule:1px solid #d1d5db;column-fill:auto}',
      '.fc-item{break-inside:avoid;page-break-inside:avoid;margin-bottom:11px}',
      '.fc-qhead{display:flex;gap:5px;font-size:10.5px;line-height:1.4;color:#111827;font-weight:600}',
      '.fc-num{font-weight:800;color:#111;flex-shrink:0}',
      '.fc-opts{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin-top:3px}',
      '.fc-opt{display:flex;gap:4px;font-size:9.5px;color:#1f2937;line-height:1.4}',
      '.fc-opt-tag{font-weight:600;flex-shrink:0}',
      '.fc-sub-badge{margin-top:3px;font-size:9px;color:#92400e;font-weight:600}',
      '@media print{',
        'body{background:#fff}',
        '.no-print{display:none!important}',
        '.fc-page{box-shadow:none;margin:0;padding:0;max-width:none}',
      '}'
    ].join('\n');
  }

  function buildDocument(headerHtml, questionsHtml, count) {
    var head =
      '<meta charset="UTF-8"/><title>4-Column Print</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet"/>' +
      '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"/>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"><\/script>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"><\/script>' +
      '<style>' + css() + '</style>';

    var toolbar =
      '<div class="fc-toolbar no-print">' +
        '<div><b>🗞️ 4-Column Print Ready</b> — ' + count + ' questions</div>' +
        '<div>Print dialog mein: <b>Paper A4 · Portrait · Margins None</b></div>' +
        '<button onclick="window.print()">🖨️ Print Now</button>' +
      '</div>';

    var body = '<div class="fc-page">' + headerHtml +
                 '<div class="fc-columns">' + questionsHtml + '</div>' +
               '</div>';

    return '<!DOCTYPE html><html><head>' + head + '</head><body>' +
           toolbar + body +
           '<script>window.addEventListener("load",function(){' +
             'if(window.renderMathInElement){renderMathInElement(document.body,{' +
               'delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],' +
               'throwOnError:false});}' +
           '});<\/script>' +
           '</body></html>';
  }

  window.printPaperFourColumn = function printPaperFourColumn() {
    var questions = getQuestions();
    if (!questions.length) {
      alert('Pehle paper mein kam se kam ek question add karein.');
      return;
    }
    var headerHtml = buildHeaderHtml();
    var questionsHtml = buildQuestionsHtml(questions);
    var html = buildDocument(headerHtml, questionsHtml, questions.length);

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
