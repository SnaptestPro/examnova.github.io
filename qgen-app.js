// ═══════════════════════════════════════════════
// APP LOGIC — qgen-app.js
// EXAMNOVA
// ═══════════════════════════════════════════════

// ⚠️ SECURITY: This API key is client-side visible. Restrict access
// via Firebase Security Rules so only authenticated users can read/write.
const PROJECT_ID = "the-vishnu-sharma-test";
const API_KEY    = "AIzaSyBTrkAoQ2T9KNB2vcacv4EPehaDboXmUxk";
const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/questionBank`;

window.QUESTION_BANK = []; // Initialize empty bank

let paperQuestions = [];   // questions currently on paper
let qIdCounter      = 1;
let visibleBankItems = []; // filtered bank items
let editingPaperQId = null; // paper question being edited
let editingBankDocId = null; // bank question being edited (left panel)
let editingDraftQId = null; // question being edited in Draft Edit tab
let editingDraftId  = null; // loaded draft test id (update on save)
let loadedDraftTitle = "";
let loadedDraftMarks = 2;
let draftTestsCache = [];

// ── QUESTION → TEST USAGE INDEX ──────────────────
// Maps a bank question's Firestore docId to the list of tests (draft or
// published) that already contain that question, so the bank list can
// show "🔁 <Test Name> mein hai" when the same question is being added
// again to a different test.
let questionTestMap = {};      // { [questionId]: [{id, title}, ...] }
let questionTestTextMap = {};  // { [normalizedText]: [{id, title}, ...] } — legacy fallback

const LABELS = ['A','B','C','D'];

// ── VIRTUAL SCROLLING + PERFORMANCE ──────────────
const BANK_PAGE_SIZE = 50;      // questions rendered per bank page
const PAPER_PAGE_SIZE = 100;    // questions rendered per paper page
const BANK_ITEM_HEIGHT = 72;    // estimated px per bank item (for virtual scroll)
let bankCurrentPage = 0;        // current visible bank page
let bankTotalPages = 0;         // total bank pages
let bankScrollTimer = null;     // scroll debounce timer
let bankFilterTimer = null;     // filter debounce timer
let paperCurrentPage = 0;       // current paper page
let paperTotalPages = 0;        // total paper pages

// ── SECTION SUPPORT ──────────────────────────
// sections: [{id, name, questions:[...]}]
// activeSection: index into sections array
let sections = []; // empty = no section mode
let activeSection = 0; // which section is active for adding questions

function isSectionMode() { return sections.length > 0; }

function initSections() {
  sections = [
    { id: 'sec-a', name: 'Section A', questions: [] },
    { id: 'sec-b', name: 'Section B', questions: [] }
  ];
  activeSection = 0;
  paperQuestions = getSectionQuestions();
  renderSectionTabs();
  reRenderPaper();
  toast('✅ Section Mode ON — 2 sections bane!');
}

function disableSections() {
  if (!confirm('Section mode band karein? Saare sections ka data hata diya jayega.')) return;
  sections = [];
  activeSection = 0;
  paperQuestions = [];
  renderSectionTabs();
  reRenderPaper();
  toast('❌ Section Mode OFF');
}

function addSection() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const name = prompt('Naye section ka naam likhein:', 'Section ' + letters[sections.length]);
  if (!name) return;
  sections.push({ id: 'sec-' + Date.now(), name: name.trim(), questions: [] });
  renderSectionTabs();
  toast('➕ Section "' + name + '" add ho gaya!');
}

function renameSection(idx) {
  const cur = sections[idx]?.name || '';
  const name = prompt('Section ka naya naam:', cur);
  if (!name || name === cur) return;
  sections[idx].name = name.trim();
  renderSectionTabs();
  reRenderPaper();
}

function deleteSection(idx) {
  if (sections.length <= 1) { toast('⚠️ Kam se kam 1 section hona chahiye!'); return; }
  if (!confirm(`"${sections[idx].name}" aur iske ${sections[idx].questions.length} questions hata dein?`)) return;
  sections.splice(idx, 1);
  activeSection = Math.min(activeSection, sections.length - 1);
  paperQuestions = getSectionQuestions();
  renderSectionTabs();
  reRenderPaper();
}

function switchActiveSection(idx) {
  if (!isSectionMode()) return;
  activeSection = idx;
  paperQuestions = getSectionQuestions();
  renderSectionTabs();
  reRenderPaper();
  updateSelectedCount();
}

function getSectionQuestions() {
  if (!isSectionMode()) return paperQuestions;
  return sections[activeSection]?.questions || [];
}

function getActiveSectionObj() {
  if (!isSectionMode()) return null;
  return sections[activeSection];
}

function renderSectionTabs() {
  const wrap = document.getElementById('sectionTabsWrap');
  const btn = document.getElementById('toggleSectionBtn');
  if (!wrap) return;

  if (btn) btn.textContent = isSectionMode() ? '🗂️ Sections ON' : '🗂️ Sections OFF';

  if (!isSectionMode()) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';

  const totalAll = sections.reduce((s, sec) => s + sec.questions.length, 0);
  wrap.innerHTML = `
    <div class="sec-tabs-header">
      <span class="sec-tabs-label">📂 Active Section</span>
      <span class="sec-total-badge">${totalAll} Q total</span>
      <button class="btn btn-xs btn-outline sec-add-btn" onclick="addSection()">+ Add Section</button>
    </div>
    <div class="sec-tabs-row">
      ${sections.map((sec, i) => `
        <div class="sec-tab${i === activeSection ? ' active' : ''}" onclick="switchActiveSection(${i})">
          <span class="sec-tab-name">${escHtml(sec.name)}</span>
          <span class="sec-tab-count">${sec.questions.length}Q</span>
          <span class="sec-tab-actions">
            <button class="sec-tab-btn" title="Rename" onclick="event.stopPropagation();renameSection(${i})">✏️</button>
            <button class="sec-tab-btn sec-tab-del" title="Delete" onclick="event.stopPropagation();deleteSection(${i})">✕</button>
          </span>
        </div>
      `).join('')}
    </div>`;
}

// ── Override paper question operations for section mode ──────────

function _addToPaperCore(q) {
  if (isSectionMode()) {
    const sec = getActiveSectionObj();
    if (!sec) return;
    const bankIdx = getBankIdx(q);
    const alreadyInAnySection = sections.some(s => s.questions.some(p => p.bankIdx === bankIdx && bankIdx >= 0));
    if (alreadyInAnySection && bankIdx >= 0) {
      toast('⚠️ Ye question kisi aur section mein pehle se hai!'); return;
    }
    sec.questions.push({
      id: qIdCounter++,
      firestoreId: q[4] || null,
      text: q[0], opts: q[1], ans: q[2], chapter: q[3], subject: q[5] || 'General',
      qType: q[6] === 'subjective' ? 'subjective' : 'mcq',
      marks: q[7] ?? null,
      modelAnswer: q[8] || '',
      bankIdx
    });
    paperQuestions = sec.questions;
  } else {
    const bankIdx = getBankIdx(q);
    if (paperQuestions.some(p => p.bankIdx === bankIdx && bankIdx >= 0)) return;
    paperQuestions.push({
      id: qIdCounter++,
      firestoreId: q[4] || null,
      text: q[0], opts: q[1], ans: q[2], chapter: q[3], subject: q[5] || 'General',
      qType: q[6] === 'subjective' ? 'subjective' : 'mcq',
      marks: q[7] ?? null,
      modelAnswer: q[8] || '',
      bankIdx
    });
  }
}

function getAllQuestionsFlat() {
  if (!isSectionMode()) return paperQuestions;
  return sections.flatMap(sec => sec.questions);
}

// ── Toast ─────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

// ══════════════════════════════════════════════════════════════
//  BULK ADD (Paper Generator) — paste many questions at once
// ══════════════════════════════════════════════════════════════
let bulkParsedQG = [];

function slugQG(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40) || 'na';
}

// Same free-text format as the Admin "📦 Bulk Upload" tab (script.js /
// index.html), so questions can be copy-pasted between the two tools.
// Extended here to also recognise subjective (long-answer) questions —
// via a "Marks:" (or "अंक:") line, a "Model Answer:" line, an inline
// "(5 marks)" tag on the question line itself, an explicit
// "Type: Subjective" tag, or simply because the block never came out
// looking like a real, complete MCQ (see pushCurrent below).
//
// Root cause of "subjective ban kar MCQ jaisa dikhta hai": a subjective
// question's rough answer/explanation is very often written as lettered
// points — "(a) ... (b) ... (c) ..." — which is *exactly* the same
// syntax as MCQ options. If no "Marks:"/"Model Answer:" line was given
// either, the old parser had no way to tell the two apart and quietly
// filed it as a 4-option MCQ with "A" as the (wrong, made-up) answer.
// The fix: a block only counts as a real MCQ if it has 2+ options *and*
// an explicit answer-key line ("Ans: A" / "उत्तर: क") was found — a real
// MCQ always needs a marked correct answer, so its absence is a strong
// signal the "options" were actually explanation bullets. In that case
// we reclassify as subjective and fold those bullets into the model
// answer instead of losing them.
function parseBulkQuestionsQG(text) {
  const lines = text.split('\n')
    .map(l => l.trim()
      .replace(/\*\*/g, '')
      .replace(/\u200d|\u00ad|\u200b/g, '')
      .replace(/^[#>\s]+/, '')
      .trim()
    )
    .filter(Boolean);

  const questions = [];
  let currentQ = null;
  const hindiOptMap = { 'क':0,'ख':1,'ग':2,'घ':3,'ङ':4,'A':0,'B':1,'C':2,'D':3,'E':4,'अ':0,'ब':1,'स':2,'द':3,'1':0,'2':1,'3':2,'4':3 };

  function pushCurrent() {
    if (!currentQ) return;
    if (currentQ.qType === 'subjective') { questions.push(currentQ); return; }
    if (currentQ.options.length >= 2 && currentQ._hasAnswerKey) { questions.push(currentQ); return; }
    // Not a confirmed MCQ (either <2 options, or no "Ans:" key was ever
    // given) — treat as subjective rather than guessing/dropping it.
    if (currentQ.text && currentQ.text.trim()) {
      currentQ.qType = 'subjective';
      if (currentQ.options.length && !currentQ.modelAnswer) {
        // Fold what looked like MCQ options into the model answer so the
        // content isn't lost — they were most likely explanation points.
        currentQ.modelAnswer = currentQ.options.join(' ');
      }
      questions.push(currentQ);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const qMatch = line.match(/^(?:प्र(?:श्‍?न)?\.?\s*|Q\.?\s*)?(\d+)[\.)\-\s]\s*(.+)/i);
    if (qMatch) {
      pushCurrent();
      currentQ = { text: qMatch[2].trim(), options: [], answer: 0, qType: 'mcq', marks: null, modelAnswer: '', _hasAnswerKey: false };
      // Inline marks tag on the question line itself, e.g. "... (5 marks)"
      const inlineMarks = currentQ.text.match(/[\(\[]\s*(\d+)\s*(?:marks?|अंक)\s*[\)\]]\s*$/i);
      if (inlineMarks) {
        currentQ.marks = parseInt(inlineMarks[1]);
        currentQ.qType = 'subjective';
        currentQ.text = currentQ.text.replace(inlineMarks[0], '').trim();
      }
      continue;
    }
    if (!currentQ) continue;

    // Explicit type tag: "Type: Subjective" / "(Subjective)" / "प्रकार: विषयनिष्ठ"
    const typeTagMatch = line.match(/^(?:type|प्रकार)\s*[:\-]\s*(subjective|विषयनिष्ठ|वर्णनात्मक|long\s*answer|short\s*answer)/i) ||
                          line.match(/^[\(\[]\s*subjective\s*[\)\]]\s*$/i);
    if (typeTagMatch) {
      currentQ.qType = 'subjective';
      continue;
    }

    const marksMatch = line.match(/^(?:marks|अंक)\s*[:\-]\s*(\d+)/i);
    if (marksMatch) {
      currentQ.qType = 'subjective';
      currentQ.marks = parseInt(marksMatch[1]);
      continue;
    }

    const modelAnsMatch = line.match(/^(?:model\s*answer|मॉडल\s*उत्तर|expected\s*answer)\s*[:\-]\s*(.+)/i);
    if (modelAnsMatch) {
      currentQ.qType = 'subjective';
      currentQ.modelAnswer = (currentQ.modelAnswer ? currentQ.modelAnswer + " " : "") + modelAnsMatch[1].trim();
      continue;
    }

    // MCQ-style single-letter answer key, e.g. "Ans: A" / "उत्तर: क"
    const ansMatch = line.match(/^(?:उत्तर[\u2013\u2014\-:\s]*|ans(?:wer)?[\s:\-]*|correct[\s:\-]*|सही\s*उत्तर[\s:\-]*)\s*[\(\[]?([कखगघङA-E1-4])[\)\]]?\s*$/i);
    if (ansMatch) {
      const key = ansMatch[1];
      currentQ.answer = hindiOptMap[key] ?? hindiOptMap[key.toUpperCase()] ?? 0;
      currentQ._hasAnswerKey = true;
      continue;
    }

    // Free-text answer, e.g. "Answer: Because of typhoid..." — this is a
    // subjective (written) answer, not an MCQ option key, so route it
    // into modelAnswer instead of falling through to option parsing.
    const looseAnsMatch = line.match(/^(?:उत्तर[\u2013\u2014\-:\s]*|ans(?:wer)?[\s:\-]*|correct[\s:\-]*|सही\s*उत्तर[\s:\-]*)(.+)/i);
    if (looseAnsMatch) {
      currentQ.qType = 'subjective';
      currentQ.modelAnswer = (currentQ.modelAnswer ? currentQ.modelAnswer + " " : "") + looseAnsMatch[1].trim();
      continue;
    }

    const inlineOpts = line.match(/^[\(\[]([कखगघङABCDE1234])[\)\]]\s*.+/i);
    if (inlineOpts) {
      const parts = line.split(/(?=[\(\[][कखगघABCDE1-4][\)\]])/i).filter(Boolean);
      if (parts.length > 1) {
        parts.forEach(part => {
          const m = part.match(/^[\(\[]([कखगघABCDE1-4])[\)\]]\s*(.+)/i);
          if (m) currentQ.options.push(m[2].trim());
        });
        continue;
      }
    }
    const optMatch = line.match(/^[\(\[]?([कखगघङA-E1-4])[\)\].\-]\s*(.+)/i);
    if (optMatch && optMatch[2]) {
      currentQ.options.push(optMatch[2].trim());
      continue;
    }

    // Plain continuation line — goes to the model answer while capturing
    // a subjective answer, otherwise appends to the question text (only
    // while no options have been seen yet).
    if (currentQ.qType === 'subjective') {
      currentQ.modelAnswer = (currentQ.modelAnswer ? currentQ.modelAnswer + " " : "") + line;
    } else if (currentQ.options.length === 0) {
      currentQ.text += " " + line;
    }
  }
  pushCurrent();
  return questions;
}

function previewBulkQuestions_QG() {
  const rawText = (document.getElementById('bulkRawText')?.value || '').trim();
  if (!rawText) { toast('⚠️ Pehle questions paste karein'); return; }
  const parsed = parseBulkQuestionsQG(rawText);
  if (!parsed.length) { toast('❌ Koi valid question nahi mila! Format check karein'); return; }

  bulkParsedQG = parsed.map(q => ({
    text: autoMathFmt(sanitizeQuestionText(q.text)),
    opts: q.qType === 'subjective' ? ["", "", "", ""] : q.options.slice(0, 4).map(o => autoMathFmt(sanitizeQuestionText(o))).concat(["", "", "", ""]).slice(0, 4),
    ans: q.answer,
    qType: q.qType,
    marks: q.marks,
    modelAnswer: q.qType === 'subjective' ? autoMathFmt(sanitizeQuestionText(q.modelAnswer || '')) : ''
  }));

  const box = document.getElementById('bulkPreviewBox');
  box.classList.remove('hidden');
  box.innerHTML = `<div style="font-weight:700;margin-bottom:6px;">${bulkParsedQG.length} question(s) mile:</div>` +
    bulkParsedQG.map((q, i) => `
      <div style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:.82rem;">
        <b>Q${i+1}.</b> ${escHtml(q.text.substring(0,90))}${q.text.length>90?'…':''}
        <div style="color:#64748b;margin-top:2px;">
          ${q.qType === 'subjective' ? `📝 Subjective${q.marks!=null?' · '+q.marks+' marks':' · ⚠️ marks nahi mila'}${q.modelAnswer?' · ✅ model answer diya':' · ⚠️ model answer nahi mila'}` : `✅ MCQ · Ans: ${LABELS[q.ans]||'A'} · ${q.opts.filter(Boolean).length}/4 options`}
        </div>
      </div>`).join('');

  const btn = document.getElementById('bulkUploadBtn');
  btn.disabled = false;
  btn.style.opacity = '1';
}

// Remembers what the *last* bulk upload created (Firestore docIds + the
// paper-question ids they were auto-added as), so a mistaken paste can be
// undone in one click instead of having to hunt down and delete each
// question by hand.
let lastBulkUploadBatch = [];

async function confirmBulkUpload_QG() {
  if (!bulkParsedQG.length) { toast('⚠️ Pehle Preview karein'); return; }
  const db = window.vishnuFirebase?.db;
  if (!db) { toast('❌ Firebase connected nahi hai'); return; }

  const subject = document.getElementById('bulkSubject')?.value.trim() || 'General';
  const rawChapter = document.getElementById('bulkChapter')?.value.trim() || 'Custom';
  // v107: Naya chapter-naam save hone se PEHLE, dekh lo ki isi Class mein
  // pehle se koi "exactly same" (sirf spacing/invisible-character farak
  // wali) chapter maujood hai ya nahi — agar hai to uski EXACT purani
  // spelling use karo, taaki naya duplicate chapter kabhi bane hi na.
  const classId = document.getElementById('bulkClass')?.value || '';
  if (!classId) { toast('⚠️ Kripya Class chunein'); return; }
  const bankAsChapterList = window.QUESTION_BANK.map(arr => ({ chapter: arr[3], classId: arr[10] }));
  const chapter = window.SubjectResolver.resolveCanonicalChapterName(bankAsChapterList, classId, rawChapter);
  const log = document.getElementById('bulkUploadLog');
  log.classList.remove('hidden');
  log.innerHTML = '';

  const btn = document.getElementById('bulkUploadBtn');
  btn.disabled = true;
  btn.style.opacity = '.5';
  btn.textContent = '⏳ Uploading...';

  let ok = 0, failed = 0;
  const thisBatch = [];
  // v34: Doc ID ab readable hai — Class + Chapter + Serial (jaise
  // "class10-Number-System-1"). Poore batch mein Class+Chapter same hai,
  // isliye serial ek hi baar compute karke phir har question ke liye
  // badhate jaate hain.
  const bankAsIdList = window.QUESTION_BANK.map(arr => ({ id: arr[4] }));
  let nextSerial = window.SubjectResolver.nextSerialForGroup(bankAsIdList, classId, chapter);
  for (let i = 0; i < bulkParsedQG.length; i++) {
    const q = bulkParsedQG[i];
    const docId = window.SubjectResolver.buildQuestionDocId(classId, chapter, nextSerial++);
    try {
      await saveBankQuestionToCloud(docId, { text: q.text, opts: q.opts, ans: q.ans, chapter, qType: q.qType, marks: q.marks, modelAnswer: q.modelAnswer || '', classId }, subject);
      // Also drop straight into the current paper so the whole batch is
      // ready to use immediately, without needing to re-find it in the bank.
      const bankArr = [q.text, q.opts, q.ans, chapter, docId, subject, q.qType, q.marks, q.modelAnswer || '', null, classId];
      const bankIdx = window.QUESTION_BANK.length;
      window.QUESTION_BANK.push(bankArr);
      const newQ = addQFromBank(bankArr, bankIdx);
      thisBatch.push({ docId, paperQId: newQ?.id ?? null, inSection: isSectionMode() ? getActiveSectionObj()?.id : null });
      ok++;
      log.innerHTML += `<div>✅ Q${i+1} uploaded${q.qType==='subjective'?' (subjective)':''}</div>`;
    } catch (e) {
      failed++;
      log.innerHTML += `<div>❌ Q${i+1} failed: ${escHtml(e.message||'error')}</div>`;
    }
    log.scrollTop = log.scrollHeight;
  }

  lastBulkUploadBatch = thisBatch;
  const undoBtn = document.getElementById('bulkUndoBtn');
  if (undoBtn) undoBtn.classList.toggle('hidden', thisBatch.length === 0);

  btn.textContent = '🚀 Upload All (Bank + Paper)';
  btn.disabled = true;
  btn.style.opacity = '.5';
  toast(`✅ ${ok} uploaded${failed?`, ❌ ${failed} failed`:''}`);
  bulkParsedQG = [];
  document.getElementById('bulkRawText').value = '';
  document.getElementById('bulkPreviewBox').classList.add('hidden');
  buildBankList();
}

// Undo the most recent bulk upload: deletes those questions from
// Firestore, from the local bank array, and from the paper/section they
// were auto-added to. Only the last batch is remembered (single-level
// undo), which matches how the button is presented in the UI.
async function undoLastBulkUpload_QG() {
  if (!lastBulkUploadBatch.length) { toast('⚠️ Undo karne ke liye kuch nahi hai'); return; }
  const db = window.vishnuFirebase?.db;
  const batch = lastBulkUploadBatch;
  const undoBtn = document.getElementById('bulkUndoBtn');
  if (undoBtn) { undoBtn.disabled = true; undoBtn.textContent = '⏳ Undo ho raha hai...'; }

  let removed = 0, failed = 0;
  for (const item of batch) {
    try {
      if (db) await db.collection('questionBank').doc(item.docId).delete();
      window.QUESTION_BANK = (window.QUESTION_BANK || []).filter(q => q[4] !== item.docId);
      paperQuestions = paperQuestions.filter(p => p.firestoreId !== item.docId);
      if (Array.isArray(sections)) {
        sections.forEach(sec => {
          if (Array.isArray(sec.questions)) sec.questions = sec.questions.filter(p => p.firestoreId !== item.docId);
        });
      }
      removed++;
    } catch (e) {
      failed++;
    }
  }

  lastBulkUploadBatch = [];
  if (undoBtn) { undoBtn.classList.add('hidden'); undoBtn.disabled = false; undoBtn.textContent = '↩️ Undo Last Upload'; }
  reRenderPaper();
  buildBankList();
  toast(`↩️ ${removed} question(s) hata diye${failed?`, ❌ ${failed} fail hue`:''}`);
}


function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) {
    sidebar.classList.remove('collapsed');
    sidebar.classList.toggle('mobile-open');
    return;
  }
  sidebar.classList.toggle('collapsed');
}

// ── Side tab switcher ─────────────────────────
function switchSideTab(tab) {
  ['bank','add','bulk','draftedit','settings'].forEach(t => {
    document.getElementById(`stab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`panel-${t}`).classList.toggle('hidden', t !== tab);
  });
  if (tab === 'draftedit') renderDraftEditSection();
  if (tab === 'add') {
    refreshSubjectDatalists();
    refreshChapterDatalist('qSubject', 'qChapterList');
  }
  if (tab === 'bulk') {
    refreshSubjectDatalists();
    refreshChapterDatalist('bulkSubject', 'bulkChapterList');
  }
}

// ── Main tab switcher ─────────────────────────
function switchMainTab(tab) {
  ['preview','answerkey'].forEach(t => {
    document.getElementById(`mtab-${t}`)?.classList.toggle('active', t === tab);
    document.getElementById(`tab-${t}`)?.classList.toggle('hidden', t !== tab);
  });
}

// ── Sync header ───────────────────────────────
function syncHeader() {
  const no    = document.getElementById('testNo').value    || '4';
  const subj  = (document.getElementById('subject').value  || 'COMBINED AUB.').toUpperCase();
  const marks = document.getElementById('maxMarks').value  || '100';
  const time  = document.getElementById('timeMin').value   || '27';
  const date  = document.getElementById('testDate').value;
  const instr = document.getElementById('instructions').value;

  const fmt = date
    ? new Date(date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
    : '——';

  ['h-testno','ak-testno'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = no;
  });
  ['h-subject','ak-subject'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = subj;
  });
  document.getElementById('h-date').textContent  = fmt;
  document.getElementById('h-time').textContent  = time;
  document.getElementById('h-marks').textContent = marks;
  document.getElementById('h-total').textContent = isSectionMode() ? getAllQuestionsFlat().length : paperQuestions.length;
  document.getElementById('paper-instr').textContent = '📌 ' + instr;
}

// ── Fetch Bank from Firebase (same SDK as Admin) ──────────
// Legacy questions saved by the old code wrapped the ENTIRE sentence
// (Hindi text + math together) inside \( ... \). LaTeX math mode collapses
// literal whitespace, which is why those questions show no spaces between
// Hindi words on render. Patching spacing with KaTeX's \; command isn't
// reliable here (KaTeX's atom-spacing rules don't treat raw Devanagari
// Unicode fallback text the same as real math atoms). The robust fix is to
// pull the Hindi text completely OUT of math mode — same as we do for new
// questions — so normal browser text layout handles the spacing, and only
// wrap the genuine math runs (numbers/operators/LaTeX commands) in \( \).
function unwrapLegacyFullMathWrap(s) {
  if (!s) return s;
  const trimmed = s.trim();
  let m = /^\\\(([\s\S]*)\\\)$/.exec(trimmed);
  let openTag = "\\(", closeTag = "\\)";
  if (!m) {
    m = /^\\\[([\s\S]*)\\\]$/.exec(trimmed);
    openTag = "\\["; closeTag = "\\]";
  }
  if (!m) return s; // not a full single-wrap — leave to the per-segment spacing fix
  const inner = m[1];
  if (!/[\u0900-\u097F]/.test(inner)) return s; // pure math, nothing to unwrap

  const parts = inner.split(/(\s+)/);
  let out = "";
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    const isHindi = /[\u0900-\u097F]/.test(part);
    if (part.trim() !== "" && !isHindi) {
      // Gather the run of consecutive non-Hindi tokens into one math chunk.
      let chunk = part;
      let j = i + 1;
      while (j + 1 < parts.length && parts[j].trim() === "" &&
             parts[j+1].trim() !== "" && !/[\u0900-\u097F]/.test(parts[j+1])) {
        chunk += parts[j] + parts[j+1];
        j += 2;
      }
      out += openTag + chunk.trim() + closeTag;
      i = j;
    } else {
      out += part;
      i++;
    }
  }
  return out.trim();
}

// Clean up bad/leftover formatting in question/option text:
//  1. Empty or placeholder math markers like \(...\), \(. . .\), \(…\)
//     that carry no real content — just remove them.
//  2. Irregular runs of multiple spaces (e.g. from copy-paste) collapsed
//     to a single space.
function sanitizeQuestionText(s) {
  if (!s) return s;
  let t = s;
  t = t.replace(/\\\(\s*(?:\.\s*){2,}\s*\\\)/g, '');   // \(...\), \(. . .\)
  t = t.replace(/\\\(\s*…\s*\\\)/g, '');                // \(…\)
  t = t.replace(/[ \t]{2,}/g, ' ');                     // multi-space → single
  return t.trim();
}

function fetchBankFromFirebase() {
  const list = document.getElementById('bankList');
  list.innerHTML = '<div class="bank-loading">Loading questions from cloud... ⏳</div>';

  const db = window.vishnuFirebase?.db;
  if (!db) {
    window.QUESTION_BANK = [];
    buildBankList();
    return;
  }

  function mapDocs(docs) {
    return docs.map(d => {
      const data = d.data();
      const rawText = data.textHI || data.textEN || data.text || "";
      const rawOpts = data.optionsHI?.length ? data.optionsHI
                    : data.optionsEN?.length  ? data.optionsEN
                    : data.options || [];
      const text    = sanitizeQuestionText(unwrapLegacyFullMathWrap(rawText));
      const options = rawOpts.map(o => sanitizeQuestionText(unwrapLegacyFullMathWrap(o)));
      const ans     = parseInt(data.answer ?? 0);
      const chapter = data.chapter || "Unknown";
      const subject = window.SubjectResolver
        ? window.SubjectResolver.resolveQuestionSubject({ subject: data.subject, chapter }, d.id)
        : (data.subject || "General");
      const qType   = data.qType === 'subjective' ? 'subjective' : 'mcq';
      const marks   = (data.marks !== undefined && data.marks !== null) ? data.marks : null;
      const modelAnswer = data.modelAnswer || '';
      const difficulty  = (data.difficulty || '').toLowerCase();
      return [text, options, ans, chapter, d.id, subject, qType, marks, modelAnswer, difficulty, (data.classId || '')];
    });
  }

  // NOTE: this used to be a one-time paginated `.get()` load, separate from
  // the Admin question-bank tab's own live `.onSnapshot()` (in script.js's
  // syncBank()). Two different loading mechanisms for the same collection
  // meant the two screens could silently drift apart — e.g. a question
  // added/edited/deleted in one tab wouldn't show up in the other until a
  // manual refresh. Switching to a full `.onSnapshot()` here mirrors
  // syncBank() exactly, so the Paper Generator's bank and the Admin's
  // Question Bank are always reading the same live data and can never
  // show a different question set from one another.
  db.collection("questionBank").onSnapshot(snap => {
    const all = mapDocs(snap.docs);
    all.sort((a, b) => a[4].localeCompare(b[4]));
    window.QUESTION_BANK = all;
    console.log(`[Bank] Synced ${window.QUESTION_BANK.length} questions (live).`);
    buildBankList();
  }, err => {
    console.warn("[Bank] Firestore sync failed:", err);
    // Retry once after 3 seconds, same fallback pattern as syncBank()
    setTimeout(() => {
      db.collection("questionBank").get().then(snap => {
        const all = mapDocs(snap.docs);
        all.sort((a, b) => a[4].localeCompare(b[4]));
        window.QUESTION_BANK = all;
        console.log(`[Bank] Retry synced ${window.QUESTION_BANK.length} questions.`);
        buildBankList();
      }).catch(e => {
        console.warn("[Bank] Retry failed:", e);
        window.QUESTION_BANK = [];
        buildBankList();
      });
    }, 3000);
  });
}


function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ── Debounce utility ─────────────────────────────
function debounce(fn, wait) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ── Throttle utility ─────────────────────────────
function throttle(fn, limit) {
  let last;
  return function(...args) {
    const now = Date.now();
    if (!last || now - last >= limit) {
      last = now;
      fn.apply(this, args);
    }
  };
}

function getBankSubject(q) {
  if (window.SubjectResolver) {
    return window.SubjectResolver.resolveQuestionSubject(
      { subject: q[5], chapter: q[3] },
      q[4]
    );
  }
  return q[5] || 'General';
}

function getBankSubjectOptions(bank) {
  if (window.SubjectResolver) {
    return window.SubjectResolver.getSubjectFilterOptions(bank, getBankSubject);
  }
  return [...new Set(bank.map(getBankSubject))].sort();
}

// ── Subject/Chapter combobox helpers (Add New + Bulk Add panels) ──
// These power the <input list="..."> comboboxes so users can pick from
// subjects/chapters that already exist (either the app's standard list,
// or whatever's actually in the live bank) while still being free to
// type a brand-new one. Kept separate from the strict bankSubject/
// bankChapter <select> filters above, which only ever show existing data.
// v35: classId diya jaaye to sirf usi Class ke bank-questions se Subject/
// Chapter list banti hai (Class → Subject → Chapter cascading) — Question
// Generator tool mein ab Class field sabse pehle hai (qClass/bulkClass),
// aur usi ke hisaab se ye datalists refresh hoti hain.
function getAllKnownSubjects(classId) {
  const bank = window.QUESTION_BANK || [];
  const pool = classId ? bank.filter(q => q[10] === classId) : bank;
  const fromBank = getBankSubjectOptions(pool);
  const standard = classId ? [] : (window.SubjectResolver?.STANDARD_SUBJECTS || []);
  return [...new Set([...standard, ...fromBank])];
}

function getChaptersForSubject(subject, classId) {
  const bank = window.QUESTION_BANK || [];
  let pool = classId ? bank.filter(q => q[10] === classId) : bank;
  if (subject) pool = pool.filter(q => getBankSubject(q) === subject);
  const predefined = (!classId && subject && window.SubjectResolver?.SUBJECT_CHAPTERS?.[subject]) || [];
  const fromBank = [...new Set(pool.map(q => q[3]).filter(Boolean))];
  return [...new Set([...predefined, ...fromBank])].sort();
}

function fillDatalist(datalistId, values) {
  const dl = document.getElementById(datalistId);
  if (!dl) return;
  dl.innerHTML = values.map(v => `<option value="${escAttr(v)}"></option>`).join('');
}

// Repopulates the Subject datalists (Add New + Bulk Add) from the current
// bank data. Safe to call often — e.g. whenever the bank re-syncs, or a
// side-panel tab that uses these fields is opened.
function refreshSubjectDatalists() {
  const qClassId = document.getElementById('qClass')?.value || '';
  const bulkClassId = document.getElementById('bulkClass')?.value || '';
  fillDatalist('qSubjectList', getAllKnownSubjects(qClassId));
  fillDatalist('bulkSubjectList', getAllKnownSubjects(bulkClassId));
}

// Repopulates a Chapter datalist based on whatever Subject is currently
// typed into the paired Subject input, combining that subject's
// predefined chapter list with any chapters already used in the bank —
// scoped to whichever Class is currently chosen for that panel.
function refreshChapterDatalist(subjectInputId, chapterListId) {
  const subj = document.getElementById(subjectInputId)?.value.trim();
  const classFieldId = subjectInputId === 'bulkSubject' ? 'bulkClass' : 'qClass';
  const classId = document.getElementById(classFieldId)?.value || '';
  fillDatalist(chapterListId, getChaptersForSubject(subj, classId));
}

// Class field badalte hi Subject/Chapter datalists ko us Class ke hisaab
// se refresh karo, aur pehle se bhare Subject/Chapter ko reset karo taaki
// galti se dusri Class ka chapter is Class mein na lag jaaye.
function onQClassChange() {
  const classId = document.getElementById('qClass')?.value || '';
  fillDatalist('qSubjectList', getAllKnownSubjects(classId));
  const subjInp = document.getElementById('qSubject');
  if (subjInp) subjInp.value = '';
  const chapInp = document.getElementById('qChapter');
  if (chapInp) chapInp.value = '';
  fillDatalist('qChapterList', getChaptersForSubject('', classId));
}
function onBulkQClassChange() {
  const classId = document.getElementById('bulkClass')?.value || '';
  fillDatalist('bulkSubjectList', getAllKnownSubjects(classId));
  const subjInp = document.getElementById('bulkSubject');
  if (subjInp) subjInp.value = '';
  const chapInp = document.getElementById('bulkChapter');
  if (chapInp) chapInp.value = '';
  fillDatalist('bulkChapterList', getChaptersForSubject('', classId));
}
window.onQClassChange = onQClassChange;
window.onBulkQClassChange = onBulkQClassChange;

function buildBankList() {
  const bank = window.QUESTION_BANK || [];
  refreshSubjectDatalists();
  const classSel = document.getElementById('bankClassFilter');
  const subjSel = document.getElementById('bankSubject');
  const chapSel = document.getElementById('bankChapter');
  const curClass = classSel?.value || '';
  const curSubj = subjSel?.value || '';
  const curChap = chapSel?.value || '';

  const classPool = curClass ? bank.filter(q => q[10] === curClass) : bank;
  const subjects = getBankSubjectOptions(classPool);
  subjSel.innerHTML = '<option value="">— कोई नहीं (Subject) —</option>' +
    subjects.map(s => `<option value="${escAttr(s)}">${escHtml(s)}</option>`).join('');
  subjSel.value = subjects.includes(curSubj) ? curSubj : '';

  const pool = subjSel.value ? classPool.filter(q => getBankSubject(q) === subjSel.value) : classPool;
  const chapters = [...new Set(pool.map(q => q[3]).filter(Boolean))].sort();
  chapSel.innerHTML = '<option value="">— कोई नहीं (Chapter) —</option>' +
    chapters.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('');
  chapSel.value = chapters.includes(curChap) ? curChap : '';

  filterBankDebounced();
}

// Reuse-from-Bank list ke "Class" filter — Subject/Chapter dropdown ab
// isi chuni gayi Class tak simit ho jaate hain (Class → Subject → Chapter).
function onBankClassFilterChange() {
  const classId = document.getElementById('bankClassFilter')?.value || '';
  const bank = window.QUESTION_BANK || [];
  const classPool = classId ? bank.filter(q => q[10] === classId) : bank;
  const subjSel = document.getElementById('bankSubject');
  const chapSel = document.getElementById('bankChapter');
  const subjects = getBankSubjectOptions(classPool);
  subjSel.innerHTML = '<option value="">— कोई नहीं (Subject) —</option>' +
    subjects.map(s => `<option value="${escAttr(s)}">${escHtml(s)}</option>`).join('');
  subjSel.value = '';
  const chapters = [...new Set(classPool.map(q => q[3]).filter(Boolean))].sort();
  chapSel.innerHTML = '<option value="">— कोई नहीं (Chapter) —</option>' +
    chapters.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('');
  chapSel.value = '';
  filterBank();
}
window.onBankClassFilterChange = onBankClassFilterChange;

function toggleAutogenBox() {
  document.getElementById('autogenFields')?.classList.toggle('hidden');
}

// ── Difficulty-balanced auto-generator ─────────────────────────
// Randomly picks unused (not already on paper, not a text-duplicate)
// MCQ questions from the bank matching the current Subject/Chapter
// filter, split across Easy/Medium/Hard counts, and adds them straight
// to the paper (or active section, if Section Mode is ON).
function autoGenerateByDifficulty() {
  const bank = window.QUESTION_BANK || [];
  const subj = document.getElementById('bankSubject')?.value || '';
  const chap = document.getElementById('bankChapter')?.value || '';
  const counts = {
    easy:   parseInt(document.getElementById('agEasy')?.value   || '0', 10) || 0,
    medium: parseInt(document.getElementById('agMedium')?.value || '0', 10) || 0,
    hard:   parseInt(document.getElementById('agHard')?.value   || '0', 10) || 0
  };
  const totalWanted = counts.easy + counts.medium + counts.hard;
  if (totalWanted <= 0) { toast('⚠️ Kam se kam ek difficulty mein count daalein'); return; }

  const curList = getAllQuestionsFlat();
  const usedFirestoreIds = new Set(curList.map(p => p.firestoreId).filter(Boolean));
  const usedTexts = new Set(curList.map(p => normalizeQText(p.text)));

  const pool = bank.filter(q =>
    (q[6] !== 'subjective') && // MCQ only — an auto-count picker doesn't mix well with subjective marks/format
    (!subj || getBankSubject(q) === subj) &&
    (!chap || q[3] === chap) &&
    !usedFirestoreIds.has(q[4]) &&
    !usedTexts.has(normalizeQText(q[0]))
  );

  function pickN(list, n) {
    const shuffled = list.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  const shortfall = {};
  let addedCount = 0;
  ['easy', 'medium', 'hard'].forEach(level => {
    const need = counts[level];
    if (!need) return;
    const levelPool = pool.filter(q => (q[9] || '') === level && !usedFirestoreIds.has(q[4]));
    const picked = pickN(levelPool, need);
    picked.forEach(q => {
      addQFromBank(q, getBankIdx(q));
      usedFirestoreIds.add(q[4]);
      usedTexts.add(normalizeQText(q[0]));
      addedCount++;
    });
    if (picked.length < need) shortfall[level] = need - picked.length;
  });

  buildBankList(); // refresh so just-added / already-used questions re-sort to the bottom
  const shortMsg = Object.keys(shortfall).length
    ? ' ⚠️ Kam pade: ' + Object.entries(shortfall).map(([l, n]) => `${n} ${l}`).join(', ') + ' (bank mein itne is difficulty ke nahi hain)'
    : '';
  toast(addedCount ? `⚡ ${addedCount} questions auto-add ho gaye!${shortMsg}` : `ℹ️ Filter ke hisaab se koi matching question nahi mila.${shortMsg}`);
}

function onBankSubjectChange() {
  const bank = window.QUESTION_BANK || [];
  const classId = document.getElementById('bankClassFilter')?.value || '';
  const subj = document.getElementById('bankSubject').value;
  const chapSel = document.getElementById('bankChapter');
  let pool = classId ? bank.filter(q => q[10] === classId) : bank;
  pool = subj ? pool.filter(q => getBankSubject(q) === subj) : pool;
  const chapters = [...new Set(pool.map(q => q[3]).filter(Boolean))].sort();
  chapSel.innerHTML = '<option value="">— कोई नहीं (Chapter) —</option>' +
    chapters.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('');
  filterBank();
}

function onBankChapterChange() {
  const marksSel = document.getElementById('bankMarks');
  if (document.getElementById('bankQType').value === 'subjective' && marksSel && !marksSel.classList.contains('hidden')) {
    onBankQTypeChange(); // repopulates marks options for the new chapter, and calls filterBank()
  } else {
    filterBank();
  }
}

// "Kitne number ka subjective chahiye" filter — Marks dropdown only shows
// up (and is only populated) once "Subjective" type is selected, listing
// every distinct marks value actually present among subjective questions
// in the current Subject/Chapter selection.
function onBankQTypeChange() {
  const qtype = document.getElementById('bankQType').value;
  const marksSel = document.getElementById('bankMarks');
  if (qtype !== 'subjective') {
    marksSel.classList.add('hidden');
    marksSel.value = '';
    filterBank();
    return;
  }
  marksSel.classList.remove('hidden');
  const bank = window.QUESTION_BANK || [];
  const subj = document.getElementById('bankSubject').value;
  const chap = document.getElementById('bankChapter').value;
  const pool = bank.filter(q =>
    (q[6] === 'subjective') &&
    (!subj || getBankSubject(q) === subj) &&
    (!chap || q[3] === chap)
  );
  const marksVals = [...new Set(pool.map(q => q[7]).filter(m => m !== null && m !== undefined))]
    .sort((a, b) => a - b);
  marksSel.innerHTML = '<option value="">— सभी Marks —</option>' +
    marksVals.map(m => `<option value="${escAttr(String(m))}">${escHtml(String(m))} marks</option>`).join('');
  filterBank();
}

function renderBankList(items) {
  visibleBankItems = items;
  bankCurrentPage = 0;
  bankTotalPages = Math.ceil(items.length / BANK_PAGE_SIZE) || 1;
  renderBankPage();
}

function renderBankPage() {
  const list = document.getElementById('bankList');
  const items = visibleBankItems;
  if (!items.length) {
    list.innerHTML = '<div class="bank-no-results">कोई प्रश्न नहीं मिला</div>';
    return;
  }
  const start = bankCurrentPage * BANK_PAGE_SIZE;
  const end = Math.min(start + BANK_PAGE_SIZE, items.length);
  const pageItems = items.slice(start, end);
  const allQ = isSectionMode() ? getAllQuestionsFlat() : paperQuestions;

  let html = '';
  for (let i = 0; i < pageItems.length; i++) {
    const q = pageItems[i];
    const visIdx = start + i;
    const bankIdx = getBankIdx(q);
    // NOTE: match by the question's stable Firestore docId (q[4]), not by
    // bankIdx. bankIdx is just "current position in window.QUESTION_BANK",
    // and since the bank now live-syncs via onSnapshot (mapDocs() builds
    // brand-new array objects on every update), that position can shift
    // any time the bank changes elsewhere — which would silently break
    // this "already added" indicator if we compared against an old stored
    // bankIdx. The docId never changes, so it's the only safe key here.
    const alreadyAdded = allQ.some(p => p.firestoreId && p.firestoreId === q[4]);
    const inActiveSection = isSectionMode() && (getActiveSectionObj()?.questions || []).some(p => p.firestoreId && p.firestoreId === q[4]);
    const usedInLabel = getQuestionUsageLabel(q[4], q[0]);
    html += `
      <div class="bank-item${alreadyAdded?' selected':''}${inActiveSection?' in-active-sec':''}" id="bi-${visIdx}" onclick="toggleBankCheck(${visIdx})">
        <input type="checkbox" id="bc-${visIdx}" ${inActiveSection?'checked':''} onclick="event.stopPropagation();toggleBankCheck(${visIdx})"/>
        <div class="bank-item-body">
          <div class="bank-q-text">${escHtml(q[0].substring(0,90))}${q[0].length>90?'…':''}</div>
          <div class="bank-q-chapter">📚 ${escHtml(getBankSubject(q))} · 📖 ${escHtml(q[3])}${q[6]==='subjective' ? ` · <span class="bank-subjective-tag">📝 Subjective${q[7]!=null?' · '+escHtml(String(q[7]))+' marks':''}</span>` : ''}${alreadyAdded && !inActiveSection ? ' · <span style="color:#f59e0b">⚠️ other section</span>':''}${usedInLabel ? ` · <span class="bank-used-in-tag" title="Ye question pehle se in test(s) mein hai: ${escHtml(usedInLabel)}">🔁 ${escHtml(usedInLabel)} mein hai</span>` : ''}</div>
        </div>
        <button type="button" class="bank-edit-btn" title="Edit question" onclick="event.stopPropagation();editBankQuestion(${visIdx})">✏️</button>
      </div>`;
  }

  // Pagination controls
  if (bankTotalPages > 1) {
    html += '<div class="bank-pagination">';
    if (bankCurrentPage > 0) {
      html += `<button class="btn btn-xs btn-outline" onclick="changeBankPage(${bankCurrentPage - 1})">← Prev</button>`;
    }
    html += `<span style="font-size:.8rem;color:#6b7280;">Page ${bankCurrentPage + 1} / ${bankTotalPages} · ${items.length} total</span>`;
    if (bankCurrentPage < bankTotalPages - 1) {
      html += `<button class="btn btn-xs btn-outline" onclick="changeBankPage(${bankCurrentPage + 1})">Next →</button>`;
    }
    html += '</div>';
  }

  list.innerHTML = html;
}

function changeBankPage(page) {
  bankCurrentPage = Math.max(0, Math.min(page, bankTotalPages - 1));
  renderBankPage();
  const list = document.getElementById('bankList');
  if (list) list.scrollTo({ top: 0, behavior: 'smooth' });
}

function getBankIdx(q) {
  return window.QUESTION_BANK.indexOf(q);
}

function filterBank() {
  const search = document.getElementById('bankSearch').value.toLowerCase().trim();
  const classId = document.getElementById('bankClassFilter')?.value || '';
  const subj   = document.getElementById('bankSubject').value;
  const chap   = document.getElementById('bankChapter').value;
  const qtype  = document.getElementById('bankQType')?.value || '';
  const marksSel = document.getElementById('bankMarks')?.value || '';
  const bank   = window.QUESTION_BANK || [];
  const total  = bank.length;

  // Show loading for large datasets
  const list = document.getElementById('bankList');
  if (total > 5000 && list) {
    list.innerHTML = '<div class="bank-loading">Filtering ' + total + ' questions... ⏳</div>';
  }

  // Use requestIdleCallback for large datasets if available
  const doFilter = () => {
    const filtered = bank.filter(q => {
      const matchClass  = !classId || q[10] === classId;
      const matchSubj   = !subj || getBankSubject(q) === subj;
      const matchChap   = !chap || q[3] === chap;
      const matchSearch = !search || q[0].toLowerCase().includes(search) ||
                          q[1].some(o => o.toLowerCase().includes(search));
      const qType       = q[6] === 'subjective' ? 'subjective' : 'mcq';
      const matchQType  = !qtype || qType === qtype;
      // Marks filter only makes sense for subjective questions (MCQ has no
      // marks field here), so it's a no-op unless "Subjective" type is
      // also selected — the UI hides the marks dropdown otherwise anyway.
      const matchMarks  = !marksSel || (qType === 'subjective' && String(q[7] ?? '') === marksSel);
      return matchClass && matchSubj && matchChap && matchSearch && matchQType && matchMarks;
    });

    // Push questions already used in another saved test to the end —
    // keeps fresh/unused questions on top within the current chapter/
    // filter view so new tests can be built from not-yet-used questions
    // first. Stable sort: relative order within each group (used /
    // not-used) is otherwise unchanged.
    // Perf: compute each question's "used" flag once up front (O(n))
    // instead of re-deriving it inside the comparator, which sort()
    // would otherwise call O(n log n) times.
    if (filtered.length) {
      const usedFlag = new Map();
      for (const q of filtered) usedFlag.set(q, getQuestionUsageLabel(q[4], q[0]) ? 1 : 0);
      filtered.sort((a, b) => usedFlag.get(a) - usedFlag.get(b));
    }

    renderBankList(filtered);
    const totalEl = document.getElementById('bankTotal');
    if (totalEl) totalEl.textContent = filtered.length;
  };

  if (total > 10000 && typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(doFilter, { timeout: 500 });
  } else {
    doFilter();
  }
}

const filterBankDebounced = debounce(filterBank, 250);

function toggleBankCheck(visIdx) {
  const q       = visibleBankItems[visIdx];
  const bankIdx = getBankIdx(q);
  const cb      = document.getElementById(`bc-${visIdx}`);
  const item    = document.getElementById(`bi-${visIdx}`);

  // In section mode, check active section only; otherwise check paperQuestions
  const curList = isSectionMode() ? (getActiveSectionObj()?.questions || []) : paperQuestions;
  const alreadyIdx = q[4]
    ? curList.findIndex(p => p.firestoreId && p.firestoreId === q[4])
    : curList.findIndex(p => p.bankIdx === bankIdx);

  if (alreadyIdx >= 0) {
    // Remove from current section/paper
    curList.splice(alreadyIdx, 1);
    if (isSectionMode()) paperQuestions = curList;
    cb.checked = false;
    item.classList.remove('selected');
    reRenderPaper();
    toast('❌ Question hata diya');
  } else {
    const dup = findDuplicateQuestionInPaper(q[0], q[4]);
    if (dup) {
      const preview = (dup.text || '').replace(/\s+/g, ' ').trim().slice(0, 70);
      const ok = confirm(`⚠️ Milta-julta ek question paper mein pehle se hai:\n\n"${preview}${preview.length === 70 ? '…' : ''}"\n\nPhir bhi ye wala add karein?`);
      if (!ok) return;
    }
    const newQ = addQFromBank(q, bankIdx);
    cb.checked = true;
    item.classList.add('selected');
    const secLabel = isSectionMode() ? ` → ${getActiveSectionObj()?.name}` : '';
    toast(`✅ Question add ho gaya${secLabel}!`);
    scrollToPaperQuestion(newQ.id);
  }
  updateSelectedCount();
}

// ── Duplicate detection (by normalized question text, across different
// bank doc IDs) — catches copies that were entered into the bank twice
// under separate Firestore documents, which the existing bankIdx/
// firestoreId check in _addToPaperCore/toggleBankCheck can't see since
// that only stops the SAME doc being added twice.
function findDuplicateQuestionInPaper(text, excludeFirestoreId) {
  const norm = normalizeQText(text);
  if (!norm) return null;
  const list = getAllQuestionsFlat();
  return list.find(p => (p.firestoreId || null) !== (excludeFirestoreId || null) && normalizeQText(p.text) === norm) || null;
}

// Scroll the paper preview panel so a just-added question is visible.
// Handles pagination too — if the question landed on a page that isn't
// currently shown, switch to that page first, then scroll to it.
function scrollToPaperQuestion(qid) {
  if (qid == null) return;
  const list = isSectionMode() ? (getActiveSectionObj()?.questions || []) : paperQuestions;
  const idx = list.findIndex(q => q.id === qid);
  if (idx === -1) return;

  if (list.length > PAPER_PAGE_SIZE) {
    const targetPage = Math.floor(idx / PAPER_PAGE_SIZE);
    if (targetPage !== paperCurrentPage) {
      paperCurrentPage = targetPage;
      reRenderPaper();
    }
  }

  // Wait for the DOM (and KaTeX render) to settle before scrolling.
  setTimeout(() => {
    const el = document.getElementById(`pq-${qid}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
}

function addQFromBank(q, bankIdx) {
  const newQ = {
    id: qIdCounter++,
    firestoreId: q[4] || null,
    text: q[0],
    opts: q[1],
    ans: q[2],
    chapter: q[3],
    subject: q[5] || 'General',
    qType: q[6] === 'subjective' ? 'subjective' : 'mcq',
    marks: q[7] ?? null,
    modelAnswer: q[8] || '',
    bankIdx: bankIdx
  };
  if (isSectionMode()) {
    const sec = getActiveSectionObj();
    if (sec) { sec.questions.push(newQ); paperQuestions = sec.questions; }
  } else {
    paperQuestions.push(newQ);
  }
  reRenderPaper();
  return newQ;
}

function selectAllVisible() {
  const curList = isSectionMode() ? (getActiveSectionObj()?.questions || []) : paperQuestions;
  // With pagination, only select currently visible page items
  const start = bankCurrentPage * BANK_PAGE_SIZE;
  const end = Math.min(start + BANK_PAGE_SIZE, visibleBankItems.length);
  let addedCount = 0;
  let lastAddedId = null;
  for (let i = start; i < end; i++) {
    const q = visibleBankItems[i];
    const bankIdx = getBankIdx(q);
    if (!curList.some(p => p.firestoreId && p.firestoreId === q[4])) {
      const newQ = addQFromBank(q, bankIdx);
      lastAddedId = newQ.id;
      const cb   = document.getElementById(`bc-${i}`);
      const item = document.getElementById(`bi-${i}`);
      if(cb) cb.checked = true;
      if(item) item.classList.add('selected');
      addedCount++;
    }
  }
  updateSelectedCount();
  toast(addedCount > 0 ? `✅ ${addedCount} questions add ho gaye!` : `ℹ️ Sab already selected hain!`);
  if (lastAddedId !== null) scrollToPaperQuestion(lastAddedId);
}

function deselectAll() {
  // Deselect all visible items across all pages (operates on filtered list)
  const visIds = visibleBankItems.map(q => q[4]).filter(Boolean);
  if (isSectionMode()) {
    const sec = getActiveSectionObj();
    if (sec) { sec.questions = sec.questions.filter(p => !(p.firestoreId && visIds.includes(p.firestoreId))); paperQuestions = sec.questions; }
  } else {
    paperQuestions = paperQuestions.filter(p => !(p.firestoreId && visIds.includes(p.firestoreId)));
  }
  // Only update checkboxes on current page (DOM performance)
  const start = bankCurrentPage * BANK_PAGE_SIZE;
  const end = Math.min(start + BANK_PAGE_SIZE, visibleBankItems.length);
  for (let i = start; i < end; i++) {
    const cb   = document.getElementById(`bc-${i}`);
    const item = document.getElementById(`bi-${i}`);
    if(cb) cb.checked = false;
    if(item) item.classList.remove('selected');
  }
  reRenderPaper();
  updateSelectedCount();
  toast('☐ Deselect ho gaye!');
}

function addSelectedToPaper() {
  const curList = isSectionMode() ? (getActiveSectionObj()?.questions || []) : paperQuestions;
  const start = bankCurrentPage * BANK_PAGE_SIZE;
  const end = Math.min(start + BANK_PAGE_SIZE, visibleBankItems.length);
  let newlyAdded = [];
  for (let i = start; i < end; i++) {
    const q = visibleBankItems[i];
    const cb = document.getElementById(`bc-${i}`);
    if (cb && cb.checked && !curList.some(p => p.firestoreId && p.firestoreId === q[4])) {
      newlyAdded.push(q);
    }
  }
  // Flag (not block) text-duplicates within this bulk batch — a confirm()
  // popup per row would be unusable for a multi-select add, so instead we
  // add everything the teacher selected and just call out the count.
  let dupCount = 0;
  const seenTexts = new Set(curList.map(p => normalizeQText(p.text)));
  newlyAdded.forEach(q => {
    const norm = normalizeQText(q[0]);
    if (seenTexts.has(norm)) dupCount++;
    seenTexts.add(norm);
  });
  const addedQs = newlyAdded.map(q => addQFromBank(q, getBankIdx(q)));
  updateSelectedCount();
  if(newlyAdded.length) {
    const secLabel = isSectionMode() ? ` → ${getActiveSectionObj()?.name}` : '';
    const dupMsg = dupCount ? ` (⚠️ ${dupCount} duplicate lag rahe hain, check karein)` : '';
    toast(`✅ ${newlyAdded.length} questions add ho gaye${secLabel}!${dupMsg}`);
    scrollToPaperQuestion(addedQs[addedQs.length - 1].id);
  } else toast('ℹ️ Pehle questions select karein');
}

function updateSelectedCount() {
  const total = isSectionMode() ? getAllQuestionsFlat().length : paperQuestions.length;
  document.getElementById('bankSelected').textContent = total;
}

// ── Add / edit custom question ────────────────
function formatMathChunk(t) {
  var supMap = {"⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9"};
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function(m){ return "^{"+m.split("").map(function(c){return supMap[c]||c;}).join("")+"}"; });
  t = t.replace(/√\(([^)]+)\)/g, "\\sqrt{$1}");
  t = t.replace(/√\s*([a-zA-Z0-9]+)/g, "\\sqrt{$1}");
  t = t.replace(/\bsqrt\(([^)]+)\)/gi, "\\sqrt{$1}");
  t = t.replace(/\^\(([^)]+)\)/g, "^{$1}");
  t = t.replace(/\^([a-zA-Z0-9]+)/g, "^{$1}");
  // Fractions: numeric ("3/2") AND single-letter-variable ("a/x", "b/y")
  // fractions must both become a proper stacked \dfrac{}{} — book/textbook
  // equations like (a/x) + (b/y) = 0 use variable denominators, not just
  // numbers, so limiting this to \d+/\d+ left those printing as flat
  // "(a/x)" text instead of a real fraction. \dfrac (not \frac) is used on
  // purpose: KaTeX shrinks a plain \frac down to compressed "textstyle"
  // sizing whenever it sits inside inline \( ... \) math (which every
  // question/option here does) — so "3/2" was rendering as a tiny,
  // cramped fraction instead of the full textbook-size stack. \dfrac forces
  // full "displaystyle" sizing even inline.
  t = t.replace(/\b([a-zA-Z0-9]+)\s*\/\s*([a-zA-Z0-9]+)\b/g, "\\dfrac{$1}{$2}");
  t = t.replace(/<=/g,"\\leq ").replace(/>=/g,"\\geq ").replace(/!=/g,"\\neq ");
  t = t.replace(/≤/g,"\\leq ").replace(/≥/g,"\\geq ").replace(/≠/g,"\\neq ");
  t = t.replace(/×/g,"\\times ").replace(/÷/g,"\\div ").replace(/π/g,"\\pi ");
  t = t.replace(/(\d)\s*x\s*(\d)/g,"$1 \\times $2");
  t = t.replace(/\b(sin|cos|tan|cot|sec|cosec|log|ln)\b(?!\\)/gi, function(m){return "\\"+m.toLowerCase();});
  return t;
}

// A token "looks like math" if it's built only from math-ish characters
// (digits, operators, single-letter variables, etc.) and contains no
// Devanagari text. Hindi words are left completely alone so the browser's
// normal text spacing applies to them — only the actual math runs get
// wrapped in \( ... \) for KaTeX.
function isMathToken(tok) {
  if (/[\u0900-\u097F]/.test(tok)) return false; // contains Hindi — never math-wrap
  return /^[0-9a-zA-Z+\-*/^=()<>.,√π≤≥≠×÷⁰¹²³⁴⁵⁶⁷⁸⁹%]+$/.test(tok) &&
         /[0-9+\-*/^=√π≤≥≠×÷⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(tok); // must have at least one math-y char
}

// Handles "(expr)/(expr)", "(expr)/token", and "token/(expr)" fractions —
// e.g. "(ax - c)/b", "(ax - c)/(-b)", "b/(-ax + c)" — up front, fully
// converting each straight to \(\frac{...}{...}\).
//
// Why this can't just be left to the per-token loop in autoMathFmt(): that
// loop only classifies a *single whitespace-delimited token* as "math" if
// it directly contains an operator/digit/etc itself. The opening piece of
// an expression like "(ax" has no digit or operator of its own (just
// letters and a paren), so isMathToken() rejects it, the math-run breaks
// right there, and everything from "(ax" onward gets left as flat,
// unconverted text — exactly the "(ax - c)/b" bug. Resolving the whole
// paren-fraction shape before that per-token pass runs sidesteps the
// problem entirely, since \frac{...} sequences that come out of this
// function simply pass through the later tokenizer untouched (backslashes
// and braces aren't in its "math-ish character" set, so it never tries to
// re-wrap or re-split them).
function wrapParenFractions(s) {
  if (!s) return s;
  var tok = "[a-zA-Z0-9\\-\u2010-\u2015]+"; // digits/letters + hyphen/en-dash/em-dash variants
  s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, function(_, a, b) {
    return "\\(\\dfrac{" + a.trim() + "}{" + b.trim() + "}\\)";
  });
  s = s.replace(new RegExp("\\(([^()]+)\\)\\s*/\\s*(" + tok + ")\\b", "g"), function(_, a, b) {
    return "\\(\\dfrac{" + a.trim() + "}{" + b.trim() + "}\\)";
  });
  s = s.replace(new RegExp("\\b(" + tok + ")\\s*/\\s*\\(([^()]+)\\)", "g"), function(_, a, b) {
    return "\\(\\dfrac{" + a.trim() + "}{" + b.trim() + "}\\)";
  });
  return s;
}

function autoMathFmt(s) {
  if (!s) return s;

  // Protect any hand-typed / legacy-saved explicit LaTeX segments —
  // \( ... \), \[ ... \], $$ ... $$ — so they're never re-touched or
  // mangled. IMPORTANT: this used to be an all-or-nothing check — if the
  // text had EVEN ONE existing \(...\) chunk anywhere in it, the whole
  // function bailed out and left everything else in the string exactly
  // as typed. That meant editing a question that already had legacy
  // LaTeX in it (e.g. appending plain "3/2" after an existing
  // "\(9x - 10y = 14\)") never auto-formatted the new plain part — it
  // just stayed flat, unconverted text forever. Now only the existing
  // LaTeX chunks themselves are protected; everything else around them
  // still gets auto-formatted normally.
  var placeholders = [];
  var protect = function(re) {
    s = s.replace(re, function(m) {
      placeholders.push(m);
      return "\u0001" + (placeholders.length - 1) + "\u0002";
    });
  };
  protect(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g);

  s = wrapParenFractions(s);

  // wrapParenFractions() may have produced \(\dfrac{...}{...}\) segments
  // whose numerator/denominator contain internal spaces (e.g. "ax - c").
  // The tokenizer below splits purely on whitespace, so without protection
  // it would slice straight through the middle of that segment and mangle
  // it. Swap each finished segment out for a space-free placeholder, run
  // the normal tokenizer on what's left, then swap the real text back in.
  protect(/\\\(\\dfrac\{[^{}]*\}\{[^{}]*\}\\\)/g);

  var hasMath = placeholders.length > 0 ||
    /[=+\-*/^√π≤≥≠×÷]|\b\d+\s*\/\s*\d+\b|\bsqrt\b|\b(sin|cos|tan|log)\b/i.test(s);
  if (!hasMath) return s;

  // Split into tokens, keeping whitespace, so we can selectively wrap only
  // the runs of consecutive math-looking tokens.
  var parts = s.split(/(\s+)/);
  var out = "";
  var i = 0;
  while (i < parts.length) {
    var part = parts[i];
    if (part.trim() !== "" && isMathToken(part)) {
      // Gather the full run of consecutive math tokens (including the
      // whitespace between them) into one chunk to wrap together.
      var chunk = part;
      var j = i + 1;
      while (j + 1 < parts.length && parts[j].trim() === "" && isMathToken(parts[j+1])) {
        chunk += parts[j] + parts[j+1];
        j += 2;
      }
      out += "\\(" + formatMathChunk(chunk.trim()) + "\\)";
      i = j;
    } else {
      out += part;
      i++;
    }
  }
  // Swap the protected LaTeX / \dfrac{...}{...} segments back in.
  if (placeholders.length) {
    out = out.replace(/\u0001(\d+)\u0002/g, function(_, idx) { return placeholders[idx]; });
  }
  return out;
}

// LaTeX math mode collapses literal whitespace. When a Hindi sentence gets
// wrapped entirely inside \( ... \) (old-style saved questions), the spaces
// between Hindi words disappear on render even though they're present in the
// raw text. Fix: inside any math segment that contains Devanagari text,
// replace literal spaces with an explicit KaTeX space command so they survive
// rendering. This is idempotent (safe to run repeatedly / via MutationObserver).
function fixMixedScriptMathSpacing(html) {
  if (!html) return html;
  var fixSeg = function(full, inner, openTag, closeTag) {
    if (/[\u0900-\u097F]/.test(inner)) {
      var fixed = inner.replace(/[ \t]+/g, "\\;");
      return openTag + fixed + closeTag;
    }
    return full;
  };
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, function(full, inner) {
    return fixSeg(full, inner, "\\(", "\\)");
  });
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, function(full, inner) {
    return fixSeg(full, inner, "\\[", "\\]");
  });
  return html;
}

function renderMathIn(el) {
  if (!el || !window.renderMathInElement) return;
  try {
    var fixed = fixMixedScriptMathSpacing(el.innerHTML);
    if (fixed !== el.innerHTML) el.innerHTML = fixed;
    window.renderMathInElement(el, {
      delimiters: [
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "$$", right: "$$", display: true }
      ],
      throwOnError: false
    });
  } catch(e) {}
}

// ── Live math preview (Add / Draft Edit forms) ────────────────
// Renders exactly what the question text will look like, live, as the
// admin types — for BOTH paths: plain notation that autoMathFmt() auto-
// converts (e.g. "3/2" or "x^2"), AND any hand-typed LaTeX attempt.
// Previously the Add-tab preview only appeared when autoMathFmt() had
// actually changed the text — which is precisely the one case where it
// DOESN'T fire: the moment someone hand-types a \frac(...)/\(...\)
// attempt, autoMathFmt() intentionally leaves it untouched (so it never
// mangles already-correct LaTeX), so the preview silently hid at exactly
// the moment it was needed most, and a broken fraction only ever showed
// up later in the main Preview tab with no clue why. Now the box always
// shows for any non-empty text and flags outright KaTeX render errors,
// plus always reminds admins that no LaTeX is needed at all — every
// existing bank question already uses plain "3/2"-style notation, which
// auto-converts to a proper stacked fraction on its own.
function updateMathPreviewBox(rawText, box) {
  if (!box) return;
  var raw = (rawText || '').trim();
  if (!raw) { box.style.display = 'none'; box.innerHTML = ''; return; }
  var fmt = typeof autoMathFmt === 'function' ? autoMathFmt(raw) : raw;
  box.style.display = 'block';
  box.innerHTML =
    '<span style="font-size:.75rem;font-weight:600;color:#3b82f6;display:block;margin-bottom:4px;">👁️ Preview:</span>' +
    '<span class="math-text">' + fmt + '</span>' +
    '<div style="margin-top:6px;font-size:.75rem;color:#3b82f6;">💡 Fraction ke liye sirf <b>3/2</b> likhein (jaise <b>(3/2)x</b>), root ke liye <b>sqrt(16)</b> ya <b>√16</b>, power ke liye <b>x^2</b> — LaTeX (\\frac, \\sqrt) haath se likhne ki zaroorat nahi, khud ban jayega.</div>' +
    '<div class="mp-err" style="display:none;margin-top:6px;font-size:.8rem;font-weight:600;color:#b91c1c;"></div>';
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(box, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "$$", right: "$$", display: true }
        ],
        throwOnError: false
      });
    } catch (e) {}
  }
  if (box.querySelector('.katex-error')) {
    var err = box.querySelector('.mp-err');
    if (err) {
      err.style.display = 'block';
      err.textContent = '⚠️ Kuch format galat lag raha hai (upar laal text dekhein). LaTeX hataakar sirf plain notation try karein.';
    }
  }
}

function readAddForm() {
  var rawText = document.getElementById('qText').value.trim();
  const qTypeEl = document.getElementById('qType');
  const qType = (qTypeEl && qTypeEl.value === 'subjective') ? 'subjective' : 'mcq';
  const chap = document.getElementById('qChapter').value.trim() || 'Custom';
  const subj = document.getElementById('qSubject')?.value.trim() || 'General';
  if(!rawText){ toast('⚠️ Question text likhein!'); return null; }
  rawText = sanitizeQuestionText(rawText);
  const text = autoMathFmt(rawText);

  if (qType === 'subjective') {
    const marksVal = document.getElementById('qMarks')?.value.trim() || '';
    const marks = marksVal !== '' ? Number(marksVal) : null;
    const modelAnswer = autoMathFmt(sanitizeQuestionText(document.getElementById('qModelAnswer')?.value.trim() || ''));
    // Options/answer are meaningless for subjective questions, but every
    // other function in this file (rendering, bank storage, WhatsApp export)
    // expects opts to be a 4-item array and ans to be a number — so we keep
    // harmless placeholders instead of threading `undefined` everywhere.
    return { text, opts: ["", "", "", ""], ans: 0, chapter: chap, subject: subj, qType, marks, modelAnswer };
  }

  var rawA = document.getElementById('optA').value.trim();
  var rawB = document.getElementById('optB').value.trim();
  var rawC = document.getElementById('optC').value.trim();
  var rawD = document.getElementById('optD').value.trim();
  const ans = parseInt(document.getElementById('correctAns').value);
  if(!rawA||!rawB||!rawC||!rawD){ toast('⚠️ Saare 4 options bharen!'); return null; }
  // Strip stray placeholder markers / irregular spacing before formatting
  rawA = sanitizeQuestionText(rawA);
  rawB = sanitizeQuestionText(rawB);
  rawC = sanitizeQuestionText(rawC);
  rawD = sanitizeQuestionText(rawD);
  // Auto-convert plain math to LaTeX
  const opts = [autoMathFmt(rawA), autoMathFmt(rawB), autoMathFmt(rawC), autoMathFmt(rawD)];
  return { text, opts, ans, chapter:chap, subject: subj, qType: 'mcq', marks: null, modelAnswer: '' };
}

function onQTypeChange() {
  const isSub = document.getElementById('qType')?.value === 'subjective';
  const mcqBox = document.getElementById('mcqFieldsBox');
  const subBox = document.getElementById('subjectiveFieldsBox');
  if (mcqBox) mcqBox.classList.toggle('hidden', isSub);
  if (subBox) subBox.classList.toggle('hidden', !isSub);
}


function setAddFormMode(mode) {
  const btn = document.getElementById('addQuestionBtn');
  if (!btn) return;
  if (mode === 'bank') btn.textContent = '💾 Update in Bank';
  else if (mode === 'paper') btn.textContent = '💾 Update Question';
  else btn.textContent = '➕ Add to Paper';
}

function populateAddFormFromData(data) {
  document.getElementById('qText').value = data.text || '';
  document.getElementById('optA').value = data.opts?.[0] || '';
  document.getElementById('optB').value = data.opts?.[1] || '';
  document.getElementById('optC').value = data.opts?.[2] || '';
  document.getElementById('optD').value = data.opts?.[3] || '';
  document.getElementById('correctAns').value = String(data.ans ?? 0);
  const qSubjectEl = document.getElementById('qSubject');
  if (qSubjectEl) qSubjectEl.value = data.subject || 'General';
  document.getElementById('qChapter').value = data.chapter || 'Custom';
  refreshChapterDatalist('qSubject', 'qChapterList');
  const qTypeEl = document.getElementById('qType');
  if (qTypeEl) qTypeEl.value = data.qType === 'subjective' ? 'subjective' : 'mcq';
  const marksEl = document.getElementById('qMarks');
  if (marksEl) marksEl.value = (data.marks !== undefined && data.marks !== null) ? data.marks : '';
  const modelEl = document.getElementById('qModelAnswer');
  if (modelEl) modelEl.value = data.modelAnswer || '';
  onQTypeChange();
  updateMathPreviewBox(data.text || '', document.getElementById('q-math-preview'));
}

async function saveBankQuestionToCloud(docId, data, subject) {
  const db = window.vishnuFirebase?.db;
  if (!db) return false;
  // v107: final safety-net — jo bhi caller ho, save hone se pehle chapter
  // ko existing spelling se resolve kar lo (agar "exactly same" chapter
  // pehle se maujood hai) taaki edit ya kisi bhi rasty se naya duplicate
  // chapter kabhi bane hi na.
  const bankAsChapterList = (window.QUESTION_BANK || []).map(arr => ({ chapter: arr[3], classId: arr[10] }));
  const resolvedChapter = window.SubjectResolver
    ? window.SubjectResolver.resolveCanonicalChapterName(bankAsChapterList, data.classId, data.chapter)
    : data.chapter;
  await db.collection("questionBank").doc(docId).set({
    subject: subject || "General",
    chapter: resolvedChapter,
    textHI: data.text,
    textEN: "",
    text: data.text,
    optionsHI: data.opts,
    optionsEN: [],
    options: data.opts,
    answer: data.ans,
    qType: data.qType === 'subjective' ? 'subjective' : 'mcq',
    marks: data.qType === 'subjective' ? (data.marks ?? null) : null,
    modelAnswer: data.qType === 'subjective' ? (data.modelAnswer || '') : '',
    ...(data.classId ? { classId: data.classId } : {}),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return true;
}

function syncPaperFromBankEdit(docId, data) {
  paperQuestions.forEach((pq, i) => {
    if (pq.firestoreId !== docId) return;
    paperQuestions[i] = {
      ...pq,
      text: data.text,
      opts: data.opts,
      ans: data.ans,
      chapter: data.chapter,
      qType: data.qType === 'subjective' ? 'subjective' : 'mcq',
      marks: data.marks ?? null,
      modelAnswer: data.modelAnswer || ''
    };
  });
  reRenderPaper();
}

function editBankQuestion(visIdx) {
  const q = visibleBankItems[visIdx];
  if (!q) return;
  editingBankDocId = q[4];
  editingPaperQId = null;
  populateAddFormFromData({
    text: q[0],
    opts: q[1],
    ans: q[2],
    chapter: q[3],
    subject: getBankSubject(q),
    qType: q[6] === 'subjective' ? 'subjective' : 'mcq',
    marks: q[7] ?? null,
    modelAnswer: q[8] || ''
  });
  setAddFormMode('bank');
  switchSideTab('add');
  document.getElementById('qText').focus();
  toast('✏️ Bank question edit — Update in Bank dabayein');
}

async function updateBankQuestion(data) {
  const docId = data._bankDocId || editingBankDocId;
  const bankIdx = window.QUESTION_BANK.findIndex(q => q[4] === docId);
  if (bankIdx < 0) {
    if (!data._fromDraftEdit) toast('⚠️ Bank question nahi mila');
    if (!data._fromDraftEdit) editingBankDocId = null;
    return false;
  }

  const existing = window.QUESTION_BANK[bankIdx];
  const subject = data.subject || data._subject || existing[5] || "General";
  const saveDocId = docId;
  window.QUESTION_BANK[bankIdx] = [
    data.text,
    data.opts,
    data.ans,
    data.chapter,
    saveDocId,
    subject,
    data.qType === 'subjective' ? 'subjective' : 'mcq',
    data.qType === 'subjective' ? (data.marks ?? null) : null,
    data.qType === 'subjective' ? (data.modelAnswer || '') : ''
  ];

  if (!data._fromDraftEdit) {
    syncPaperFromBankEdit(docId, data);
    filterBank();
    toast('💾 Cloud mein save ho raha hai... ⏳');
  }
  try {
    const saved = await saveBankQuestionToCloud(saveDocId, data, subject);
    if (!saved) {
      if (!data._fromDraftEdit) toast('⚠️ Local update ho gaya, Firebase connected nahi hai');
      return true;
    }
    if (!data._fromDraftEdit) toast('✅ Bank question update ho gaya!');
    return true;
  } catch (err) {
    console.error(err);
    if (!data._fromDraftEdit) toast('❌ Cloud save fail: ' + err.message);
    return false;
  }
}

function addCustomQuestion() {
  const data = readAddForm();
  if(!data) return;

  if (editingBankDocId !== null) {
    updateBankQuestion(data).then(ok => { if (ok) clearAddForm(); });
    return;
  }

  if (editingPaperQId !== null) {
    const idx = paperQuestions.findIndex(p => p.id === editingPaperQId);
    if (idx >= 0) {
      const existing = paperQuestions[idx];
      paperQuestions[idx] = {
        ...existing,
        text: data.text,
        opts: data.opts,
        ans: data.ans,
        chapter: data.chapter,
        qType: data.qType === 'subjective' ? 'subjective' : 'mcq',
        marks: data.marks ?? null,
        modelAnswer: data.modelAnswer || ''
      };
      reRenderPaper();
      clearAddForm();
      toast('✅ Question update ho gaya!');
      return;
    }
    editingPaperQId = null;
  }

  const newQ = { id: qIdCounter++, text: data.text, opts: data.opts, ans: data.ans, chapter: data.chapter, subject: data.subject || 'General', qType: data.qType === 'subjective' ? 'subjective' : 'mcq', marks: data.marks ?? null, modelAnswer: data.modelAnswer || '', bankIdx:-1 };
  if (isSectionMode()) {
    const sec = getActiveSectionObj();
    if (sec) { sec.questions.push(newQ); paperQuestions = sec.questions; }
  } else {
    paperQuestions.push(newQ);
  }
  reRenderPaper();
  clearAddForm();
  const secLabel = isSectionMode() ? ` → ${getActiveSectionObj()?.name}` : '';
  toast(`✅ Question paper mein add ho gaya${secLabel}!`);
}

function editPaperQuestion(id) {
  openDraftEditForm(id);
}

async function saveToBank() {
  const data = readAddForm();
  if (!data) return;

  if (editingBankDocId) {
    const ok = await updateBankQuestion(data);
    if (ok) clearAddForm();
    return;
  }

  // v33: Class mandatory hai Bank mein save karne ke liye (Add to Paper
  // ke liye zaroori nahi — wo bank mein likhta hi nahi).
  const classId = document.getElementById('qClass')?.value || '';
  if (!classId) { toast('⚠️ Kripya Class chunein (Save to Bank ke liye zaroori)'); return; }

  const { text, opts: [optA, optB, optC, optD], ans, chapter: rawChap, subject: subj, qType, marks, modelAnswer } = data;
  const bankAsIdList = window.QUESTION_BANK.map(arr => ({ id: arr[4] }));
  const bankAsChapterList = window.QUESTION_BANK.map(arr => ({ chapter: arr[3], classId: arr[10] }));
  // v107: existing chapter spelling reuse karo agar "exactly same" hai —
  // taaki naya duplicate chapter kabhi bane hi na.
  const chap = window.SubjectResolver.resolveCanonicalChapterName(bankAsChapterList, classId, rawChap);
  const serial = window.SubjectResolver.nextSerialForGroup(bankAsIdList, classId, chap);
  const docId = window.SubjectResolver.buildQuestionDocId(classId, chap, serial);
  const subject = subj || 'General';
  const newQ = [text,[optA,optB,optC,optD],ans,chap, docId, subject, qType, marks, modelAnswer, null, classId];
  
  window.QUESTION_BANK.unshift(newQ); // Add to top of local bank
  addCustomQuestion(); // Adds to paper
  buildBankList();
  toast('💾 Saving to cloud... ⏳');
  
  // POST to Firebase
  try {
    const body = {
      fields: {
        subject: { stringValue: subject },
        chapter: { stringValue: chap },
        textHI:  { stringValue: text },
        textEN:  { stringValue: "" },
        text:    { stringValue: text },
        optionsHI: { arrayValue: { values: [optA,optB,optC,optD].map(o => ({ stringValue: o })) } },
        optionsEN: { arrayValue: { values: [] } },
        options:   { arrayValue: { values: [optA,optB,optC,optD].map(o => ({ stringValue: o })) } },
        answer:  { integerValue: String(ans) },
        qType:   { stringValue: qType === 'subjective' ? 'subjective' : 'mcq' },
        marks:   qType === 'subjective' && marks !== null ? { integerValue: String(marks) } : { nullValue: null },
        modelAnswer: { stringValue: qType === 'subjective' ? (modelAnswer || '') : '' },
        classId: { stringValue: classId },
        seededBy: { stringValue: "QuestionGeneratorUI" }
      }
    };
    
    await fetch(`${FIREBASE_URL}/${docId}?key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    toast('✅ Saved to Cloud Bank!');
  } catch(e) {
    console.error(e);
    toast('❌ Error saving to cloud');
  }
}

function clearAddForm() {
  ['qText','optA','optB','optC','optD','qChapter','qSubject','qMarks','qModelAnswer'].forEach(id => { const el = document.getElementById(id); if (el) el.value=''; });
  document.getElementById('correctAns').value = '0';
  document.getElementById('qChapter').value = 'Custom';
  const qSubjectEl = document.getElementById('qSubject');
  if (qSubjectEl) qSubjectEl.value = 'General';
  const qTypeEl = document.getElementById('qType');
  if (qTypeEl) qTypeEl.value = 'mcq';
  onQTypeChange();
  editingPaperQId = null;
  editingBankDocId = null;
  setAddFormMode('add');
  updateMathPreviewBox('', document.getElementById('q-math-preview'));
  document.getElementById('qText').focus();
}

// ── Draft Edit section ────────────────────────
function readDraftEditForm() {
  const rawText = document.getElementById('de-qText')?.value.trim() || '';
  const rawA = document.getElementById('de-optA')?.value.trim() || '';
  const rawB = document.getElementById('de-optB')?.value.trim() || '';
  const rawC = document.getElementById('de-optC')?.value.trim() || '';
  const rawD = document.getElementById('de-optD')?.value.trim() || '';
  const ans  = parseInt(document.getElementById('de-correctAns')?.value || '0');
  const chap = document.getElementById('de-qChapter')?.value.trim() || 'Mixed';
  if (!rawText) { toast('⚠️ Question text likhein!'); return null; }
  // Subjective questions don't have MCQ options — this quick panel doesn't
  // expose marks/model-answer editing (use the main Add/Edit form for
  // that), but it must not block saving text/chapter changes just because
  // the (irrelevant, blank) option boxes aren't filled in.
  const allQ = isSectionMode() ? getAllQuestionsFlat() : paperQuestions;
  const existing = allQ.find(p => p.id === editingDraftQId);
  const isSub = existing?.qType === 'subjective';
  if (!isSub && (!rawA || !rawB || !rawC || !rawD)) { toast('⚠️ Saare 4 options bharen!'); return null; }
  // Run the same math-formatting pipeline used by the main Add form and by
  // bank imports (autoMathFmt + sanitizeQuestionText) — without this, plain
  // notation like "(a/x) + (b/y) = 0" typed here was being saved as raw,
  // un-formatted text and printing literally instead of as a proper
  // textbook-style stacked fraction.
  const text = autoMathFmt(sanitizeQuestionText(rawText));
  const opts = isSub ? (existing.opts || ["", "", "", ""]) : [rawA, rawB, rawC, rawD].map(o => autoMathFmt(sanitizeQuestionText(o)));
  return { text, opts, ans, chapter: chap };
}

function clearDraftEditForm() {
  ['de-qText','de-optA','de-optB','de-optC','de-optD','de-qChapter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const ansEl = document.getElementById('de-correctAns');
  if (ansEl) ansEl.value = '0';
  updateMathPreviewBox('', document.getElementById('de-math-preview'));
  editingDraftQId = null;
  const title = document.getElementById('draftFormTitle');
  if (title) title.textContent = '✏️ Question Edit';
  const btn = document.getElementById('de-updateBtn');
  if (btn) btn.textContent = '💾 Update Question';
}

function openDraftEditForm(id) {
  // Search in all sections or paperQuestions
  const allQ = isSectionMode() ? getAllQuestionsFlat() : paperQuestions;
  const q = allQ.find(p => p.id === id);
  if (!q) return;
  editingDraftQId = id;
  document.getElementById('de-qText').value = q.text || '';
  document.getElementById('de-optA').value = q.opts?.[0] || '';
  document.getElementById('de-optB').value = q.opts?.[1] || '';
  document.getElementById('de-optC').value = q.opts?.[2] || '';
  document.getElementById('de-optD').value = q.opts?.[3] || '';
  document.getElementById('de-correctAns').value = String(q.ans ?? 0);
  document.getElementById('de-qChapter').value = q.chapter || 'Mixed';
  updateMathPreviewBox(q.text || '', document.getElementById('de-math-preview'));
  const idx = allQ.findIndex(p => p.id === id);
  document.getElementById('draftFormTitle').textContent = `✏️ Q${idx + 1} Edit`;
  document.getElementById('de-updateBtn').textContent = `💾 Q${idx + 1} Update`;
  switchSideTab('draftedit');
  document.getElementById('de-qText').focus();
  if (q.qType === 'subjective') {
    toast('📝 Subjective question — marks/model-answer edit karne ke liye "Add" tab use karein');
  }
}

function saveDraftEditForm() {
  const data = readDraftEditForm();
  if (!data || editingDraftQId === null) {
    if (editingDraftQId === null) toast('ℹ️ Pehle list se question select karein');
    return;
  }
  // Find in sections or flat
  let targetList = isSectionMode() ? null : paperQuestions;
  if (isSectionMode()) {
    for (const sec of sections) {
      if (sec.questions.some(p => p.id === editingDraftQId)) { targetList = sec.questions; break; }
    }
  }
  if (!targetList) { clearDraftEditForm(); return; }
  const idx = targetList.findIndex(p => p.id === editingDraftQId);
  if (idx < 0) { clearDraftEditForm(); return; }

  const existing = targetList[idx];
  targetList[idx] = { ...existing, text: data.text, opts: data.opts, ans: data.ans, chapter: data.chapter };
  if (isSectionMode()) paperQuestions = getActiveSectionObj()?.questions || [];

  if (existing.firestoreId) {
    updateBankQuestion({
      ...data,
      _fromDraftEdit: true,
      _bankDocId: existing.firestoreId,
      _subject: existing.subject
    }).catch(() => {});
  }

  reRenderPaper();
  clearDraftEditForm();
  renderDraftEditSection();
  toast('✅ Draft question update ho gaya!');
}

function removeDraftQuestion(id) {
  if (!confirm('Is question ko paper se hata dena hai?')) return;
  removeFromPaper(id);
  if (editingDraftQId === id) clearDraftEditForm();
  renderDraftEditSection();
}

// Permanently deletes a wrong/bad question — not just from this paper, but
// from the shared question bank itself (Firestore "questionBank" collection
// + the in-memory window.QUESTION_BANK array), so it never gets pulled into
// any future test again. This is intentionally a separate, more destructive
// action than removeDraftQuestion()/✕ (which only unselects the question
// from the current paper — the question stays in the bank and can still be
// picked again later).
async function permanentlyDeleteBankQuestion(id) {
  if (id === null || id === undefined) { toast('ℹ️ Pehle list se question select karein'); return; }
  const allQ = isSectionMode() ? getAllQuestionsFlat() : paperQuestions;
  const q = allQ.find(p => p.id === id);
  if (!q) return;

  const warnBank = q.firestoreId
    ? '⚠️ Yeh question PAPER se aur poore QUESTION BANK se HAMESHA ke liye delete ho jayega — aage kabhi kisi bhi test mein nahi aayega. Yeh wapas nahi ho sakta.'
    : '⚠️ Yeh question hamesha ke liye delete ho jayega. Yeh wapas nahi ho sakta.';
  if (!confirm(warnBank + '\n\nPakka delete karna hai?')) return;

  // Remove from the current paper/section first so the UI updates immediately.
  removeFromPaper(id);
  if (editingDraftQId === id) clearDraftEditForm();

  if (q.firestoreId) {
    const db = window.vishnuFirebase?.db;
    try {
      if (db) await db.collection('questionBank').doc(q.firestoreId).delete();
      window.QUESTION_BANK = (window.QUESTION_BANK || []).filter(bq => bq[4] !== q.firestoreId);
      toast('🗑️ Question bank se permanently delete ho gaya!');
    } catch (e) {
      toast('⚠️ Bank se delete karte waqt error aaya — sirf paper se hataya gaya hai');
    }
  } else {
    toast('🗑️ Question delete ho gaya!');
  }

  renderDraftEditSection();
  if (typeof buildBankList === 'function') buildBankList();
}

function renderDraftEditSection() {
  const list = document.getElementById('draftEditList');
  const countEl = document.getElementById('draftEditCount');
  const titleEl = document.getElementById('draftEditTitle');
  if (!list) return;

  const allQ = isSectionMode() ? getAllQuestionsFlat() : paperQuestions;
  const count = allQ.length;
  if (countEl) countEl.textContent = `${count} question${count !== 1 ? 's' : ''}`;
  if (titleEl) titleEl.textContent = loadedDraftTitle || (editingDraftId ? 'Saved Draft' : 'Naya Paper');

  if (!count) {
    list.innerHTML = '<div class="draft-empty">Abhi koi question nahi — Generator se add karein</div>';
    return;
  }

  if (isSectionMode()) {
    let globalNum = 1;
    list.innerHTML = sections.map((sec, si) => {
      if (!sec.questions.length) return `<div class="draft-sec-label">📂 ${escHtml(sec.name)} — khaali</div>`;
      return `<div class="draft-sec-label${si === activeSection ? ' active' : ''}">📂 ${escHtml(sec.name)} (${sec.questions.length}Q)</div>` +
        sec.questions.map(q => {
          const num = globalNum++;
          const active = q.id === editingDraftQId ? ' active' : '';
          const preview = (q.text || '').substring(0, 60) + ((q.text || '').length > 60 ? '…' : '');
          return `
            <div class="draft-q-item${active}" id="dqi-${q.id}">
              <div class="draft-q-body">
                <div class="draft-q-num">Q${num}</div>
                <div class="draft-q-info">
                  <div class="draft-q-text">${escHtml(preview)}</div>
                  <div class="draft-q-meta">${q.qType === 'subjective' ? `📝 Subjective${q.marks!=null?' · '+escHtml(String(q.marks))+' marks':''}` : `Ans: ${LABELS[q.ans] || 'A'}`} · ${escHtml(q.chapter || 'Mixed')}</div>
                </div>
              </div>
              <div class="draft-q-actions">
                <button type="button" class="draft-q-edit" onclick="openDraftEditForm(${q.id})">✏️</button>
                <button type="button" class="draft-q-del" onclick="removeDraftQuestion(${q.id})" title="Sirf is paper se hatayein">✕</button>
                <button type="button" class="draft-q-del" onclick="permanentlyDeleteBankQuestion(${q.id})" title="Bank se permanently delete karein">🗑️</button>
              </div>
            </div>`;
        }).join('');
    }).join('');
    return;
  }

  list.innerHTML = allQ.map((q, i) => {
    const active = q.id === editingDraftQId ? ' active' : '';
    const preview = (q.text || '').substring(0, 70) + ((q.text || '').length > 70 ? '…' : '');
    return `
      <div class="draft-q-item${active}" id="dqi-${q.id}">
        <div class="draft-q-body">
          <div class="draft-q-num">Q${i + 1}</div>
          <div class="draft-q-info">
            <div class="draft-q-text">${escHtml(preview)}</div>
            <div class="draft-q-meta">${q.qType === 'subjective' ? `📝 Subjective${q.marks!=null?' · '+escHtml(String(q.marks))+' marks':''}` : `Answer: ${LABELS[q.ans] || 'A'}`} · ${escHtml(q.chapter || 'Mixed')}</div>
          </div>
        </div>
        <div class="draft-q-actions">
          <button type="button" class="draft-q-edit" onclick="openDraftEditForm(${q.id})">✏️</button>
          <button type="button" class="draft-q-del" onclick="removeDraftQuestion(${q.id})" title="Sirf is paper se hatayein">✕</button>
          <button type="button" class="draft-q-del" onclick="permanentlyDeleteBankQuestion(${q.id})" title="Bank se permanently delete karein">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

// ── Render paper ──────────────────────────────
// Renders either the 4 MCQ options (with correct-answer highlight) or, for
// subjective questions, a marks badge instead — used by every place that
// prints a paper question (normal mode, section mode, paginated mode).
function renderPqOpts(q) {
  if (q.qType === 'subjective') {
    const marksLabel = (q.marks !== undefined && q.marks !== null && q.marks !== '') ? `${q.marks} marks` : 'Marks not set';
    return `<div class="pq-subjective-badge">📝 Subjective · ${escHtml(String(marksLabel))}</div>`;
  }
  return q.opts.map((opt, oi) => `
      <div class="pq-opt${q.ans===oi?' correct':''}">
        <span class="opt-tag">[${LABELS[oi]}]</span>
        <span class="math-text">${opt}</span>
      </div>`).join('');
}

function reRenderPaper() {
  const list = document.getElementById('paperQList');
  syncHeader();
  updateCount();
  updateAnswerKey();

  if (isSectionMode()) {
    const allFlat = getAllQuestionsFlat();
    if (allFlat.length === 0) {
      list.innerHTML = `
        <div class="empty-paper">
          <div class="ep-icon">📋</div>
          <div class="ep-title">Paper khaali hai</div>
          <div class="ep-sub">Upar section select karein phir questions add karein</div>
        </div>`;
      renderDraftEditSection();
      return;
    }
    // For section mode, keep full render but paginate if huge
    if (allFlat.length > PAPER_PAGE_SIZE) {
      renderPaperPaginated(list, allFlat, true);
      return;
    }
    let globalNum = 1;
    list.innerHTML = sections.map((sec, si) => {
      const qs = sec.questions;
      const qHtml = qs.length === 0
        ? `<div class="sec-empty-hint">🔹 Is section mein koi question nahi. Section "${sec.name}" select karke add karein.</div>`
        : qs.map((q) => {
            const num = globalNum++;
            const opts = renderPqOpts(q);
            return `
              <div class="pq-item" id="pq-${q.id}">
                <div class="pq-actions">
                  <button class="pq-edit" onclick="editPaperQuestion(${q.id})" title="Edit">✏️</button>
                  <button class="pq-del" onclick="removeFromPaper(${q.id})" title="Remove">✕</button>
                </div>
                <div class="pq-header">
                  <span class="pq-num">${num}.</span>
                  <span class="pq-text math-text">${q.text}</span>
                </div>
                ${pqUsageBadgeHtml(q)}
                <div class="pq-opts">${opts}</div>
              </div>`;
          }).join('');
      return `<div class="paper-section${si === activeSection ? ' active-section' : ''}">
        <div class="paper-section-header">
          <span class="paper-section-title">${escHtml(sec.name)}</span>
          <span class="paper-section-count">${qs.length} Question${qs.length !== 1 ? 's' : ''}</span>
        </div>
        ${qHtml}
      </div>`;
    }).join('');
    renderDraftEditSection();
    return;
  }

  // Normal (no sections) mode
  if (!paperQuestions.length) {
    list.innerHTML = `
      <div class="empty-paper">
        <div class="ep-icon">📋</div>
        <div class="ep-title">Question paper khaali hai</div>
        <div class="ep-sub">Left panel se Question Bank select karein ya naya question add karein</div>
      </div>`;
    renderDraftEditSection();
    return;
  }

  // Paginate if paper has many questions
  if (paperQuestions.length > PAPER_PAGE_SIZE) {
    renderPaperPaginated(list, paperQuestions, false);
    return;
  }

  list.innerHTML = paperQuestions.map((q, i) => {
    const opts = renderPqOpts(q);

    return `
      <div class="pq-item" id="pq-${q.id}">
        <div class="pq-actions">
          <button class="pq-edit" onclick="editPaperQuestion(${q.id})" title="Edit question">✏️</button>
          <button class="pq-del" onclick="removeFromPaper(${q.id})" title="Remove">✕</button>
        </div>
        <div class="pq-header">
          <span class="pq-num">${i+1}.</span>
          <span class="pq-text math-text">${q.text}</span>
        </div>
        ${pqUsageBadgeHtml(q)}
        <div class="pq-opts">${opts}</div>
      </div>`;
  }).join('');
  renderDraftEditSection();
  // Render KaTeX math equations after DOM update
  requestAnimationFrame(function() {
    var list = document.getElementById('paperQList');
    if (list) renderMathIn(list);
  });
}

function renderPaperPaginated(list, questions, isSectionMode) {
  paperTotalPages = Math.ceil(questions.length / PAPER_PAGE_SIZE) || 1;
  if (paperCurrentPage >= paperTotalPages) paperCurrentPage = 0;
  const start = paperCurrentPage * PAPER_PAGE_SIZE;
  const end = Math.min(start + PAPER_PAGE_SIZE, questions.length);
  const pageItems = questions.slice(start, end);

  let html = pageItems.map((q, i) => {
    const globalIdx = start + i + 1;
    const opts = renderPqOpts(q);
    return `
      <div class="pq-item" id="pq-${q.id}">
        <div class="pq-actions">
          <button class="pq-edit" onclick="editPaperQuestion(${q.id})" title="Edit question">✏️</button>
          <button class="pq-del" onclick="removeFromPaper(${q.id})" title="Remove">✕</button>
        </div>
        <div class="pq-header">
          <span class="pq-num">${globalIdx}.</span>
          <span class="pq-text math-text">${q.text}</span>
        </div>
        ${pqUsageBadgeHtml(q)}
        <div class="pq-opts">${opts}</div>
      </div>`;
  }).join('');

  // Pagination controls
  if (paperTotalPages > 1) {
    html += '<div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:16px 0;border-top:1px dashed #e5e7eb;margin-top:12px;">';
    if (paperCurrentPage > 0) {
      html += `<button class="btn btn-sm btn-outline" onclick="changePaperPage(${paperCurrentPage - 1})">← Previous</button>`;
    }
    html += `<span style="font-size:.85rem;color:#6b7280;font-weight:600;">Page ${paperCurrentPage + 1} / ${paperTotalPages} · ${questions.length} questions</span>`;
    if (paperCurrentPage < paperTotalPages - 1) {
      html += `<button class="btn btn-sm btn-outline" onclick="changePaperPage(${paperCurrentPage + 1})">Next →</button>`;
    }
    html += '</div>';
  }

  list.innerHTML = html;
  renderDraftEditSection();
  requestAnimationFrame(function() {
    var list = document.getElementById('paperQList');
    if (list) renderMathIn(list);
  });
}

function changePaperPage(page) {
  paperCurrentPage = Math.max(0, Math.min(page, paperTotalPages - 1));
  reRenderPaper();
  const list = document.getElementById('paperQList');
  if (list) list.scrollTo({ top: 0, behavior: 'smooth' });
}

function removeFromPaper(id) {
  // Find and remove from section or flat list
  let q;
  if (isSectionMode()) {
    for (const sec of sections) {
      const idx = sec.questions.findIndex(p => p.id === id);
      if (idx >= 0) { q = sec.questions[idx]; sec.questions.splice(idx, 1); break; }
    }
    paperQuestions = getActiveSectionObj()?.questions || [];
  } else {
    q = paperQuestions.find(p => p.id === id);
    paperQuestions = paperQuestions.filter(p => p.id !== id);
  }
  if(q && q.firestoreId) {
    visibleBankItems.forEach((bq, vi) => {
      if(bq[4] === q.firestoreId) {
        const cb   = document.getElementById(`bc-${vi}`);
        const item = document.getElementById(`bi-${vi}`);
        if(cb) cb.checked = false;
        if(item) item.classList.remove('selected');
      }
    });
  }
  reRenderPaper();
  updateSelectedCount();
  toast('🗑️ Question hata diya!');
}

// ── Answer key ────────────────────────────────
function renderAkItem(q, num) {
  if (q.qType === 'subjective') {
    const marksLabel = (q.marks !== undefined && q.marks !== null && q.marks !== '') ? `${q.marks} marks` : 'Marks not set';
    const modelHtml = q.modelAnswer
      ? `<div class="ak-sub-model"><span class="ak-sub-model-label">Model Answer:</span><span class="math-text">${q.modelAnswer}</span></div>`
      : `<div class="ak-sub-model" style="color:#b91c1c;">⚠️ Model answer nahi diya gaya — "Add" tab se edit karein</div>`;
    return `
      <div class="ak-item-subjective">
        <div class="ak-sub-head">📝 Q${num} · Subjective · ${escHtml(marksLabel)}</div>
        <div class="ak-sub-q math-text">${q.text}</div>
        ${modelHtml}
      </div>`;
  }
  return `
      <div class="ak-item">
        <span class="ak-qnum">Q${num}</span>
        <span class="ak-ans">${LABELS[q.ans]}</span>
      </div>`;
}

function updateAnswerKey() {
  const grid = document.getElementById('akGrid');
  const allQ = isSectionMode() ? getAllQuestionsFlat() : paperQuestions;
  if(!allQ.length) {
    grid.innerHTML = `<div class="empty-paper" style="grid-column:1/-1"><div class="ep-icon">🔑</div><div class="ep-sub">Pehle questions add karein</div></div>`;
    return;
  }
  if (isSectionMode()) {
    let globalNum = 1;
    grid.innerHTML = sections.map(sec => {
      if (!sec.questions.length) return '';
      return `<div class="ak-sec-header" style="grid-column:1/-1">${escHtml(sec.name)}</div>` +
        sec.questions.map(q => renderAkItem(q, globalNum++)).join('');
    }).join('');
  } else {
    grid.innerHTML = allQ.map((q,i) => renderAkItem(q, i+1)).join('');
  }
  if (grid) renderMathIn(grid);
}

// ── Count badge ───────────────────────────────
function updateCount() {
  const n = isSectionMode() ? getAllQuestionsFlat().length : paperQuestions.length;
  document.getElementById('paperCount').textContent = `${n} Question${n!==1?'s':''}`;
}

// ── Shuffle ───────────────────────────────────
function shuffleQuestions() {
  const list = isSectionMode() ? (getActiveSectionObj()?.questions || []) : paperQuestions;
  if(!list.length){ toast('ℹ️ Koi question nahi hai!'); return; }
  for(let i = list.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [list[i],list[j]] = [list[j],list[i]];
  }
  if (isSectionMode()) paperQuestions = list;
  reRenderPaper();
  toast('🔀 Questions shuffle ho gaye!');
}

// ── Clear paper ───────────────────────────────
// Shared reset logic: wipes the live paper builder (questions, sections,
// loaded-draft pointer) back to a blank slate and refreshes every panel
// that reflects that state. Used by the manual "Clear" button AND
// automatically after a successful "Save as Draft" (see savePaperAsDraft),
// so the builder is ready for a new paper right away instead of staying
// loaded with what was just saved.
function resetPaperBuilder() {
  if (isSectionMode()) { sections.forEach(s => s.questions = []); paperQuestions = []; }
  else { paperQuestions = []; }
  editingDraftId = null;
  loadedDraftTitle = "";
  loadedDraftMarks = 2;
  _qgenAdminLinked = false;
  _qgenAdminMeta = null;
  document.getElementById('admin-link-banner')?.remove();
  document.getElementById('send-back-to-admin-btn')?.classList.add('hidden');
  updateDraftSaveButton();
  renderDraftsList();
  renderBankPage();
  document.querySelectorAll('.bank-item input[type=checkbox]').forEach(cb => cb.checked=false);
  document.querySelectorAll('.bank-item').forEach(item => item.classList.remove('selected'));
  reRenderPaper();
  updateSelectedCount();
}

function clearPaper() {
  const total = isSectionMode() ? getAllQuestionsFlat().length : paperQuestions.length;
  if(!total && !editingDraftId){ toast('ℹ️ Paper pehle se khaali hai!'); return; }
  if(!confirm(`Kya aap ${total} saare questions hata dena chahte hain?`)) return;
  resetPaperBuilder();
  toast('🗑️ Paper clear ho gaya!');
}

// ── Export to Word ────────────────────────────
// ── HTML (jo mathToWordHtml banata hai: <sup>/<sub>/fraction-<table>) ko
// asli docx TextRun objects mein todta hai, taaki real Word file mein bhi
// powers/roots/fractions sahi dikhein. Fraction ke liye stacked-table ki
// jagah "num⁄den" (Unicode fraction slash) use karte hain — docx.js mein
// paragraph ke andar inline stacked-table daalna support nahi hai.
function htmlToDocxRuns(html, opts) {
  opts = opts || {};
  const container = document.createElement('div');
  container.innerHTML = html;
  const runs = [];
  function walk(node, state) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) runs.push(new docx.TextRun({ text, bold: state.bold, superScript: state.sup, subScript: state.sub }));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sup') {
      Array.from(node.childNodes).forEach(c => walk(c, Object.assign({}, state, { sup: true, sub: false })));
    } else if (tag === 'sub') {
      Array.from(node.childNodes).forEach(c => walk(c, Object.assign({}, state, { sub: true, sup: false })));
    } else if (tag === 'radical') {
      // \sqrt / \sqrt[n]{} — asli OOXML radical object (bar poori
      // expression ke upar, jaisa Word mein khud type karne par dikhta hai).
      const degree = node.getAttribute('degree');
      runs.push(new docx.Math({
        children: [
          new docx.MathRadical(Object.assign(
            { children: [new docx.MathRun(node.textContent.trim())] },
            (degree && degree.trim()) ? { degree: [new docx.MathRun(degree.trim())] } : {}
          ))
        ]
      }));
    } else if (tag === 'table') {
      // Ye humara fraction-table hai (mathToWordHtml se). Isko asli Word
      // equation (OOXML Math/MathFraction) bana dete hain, taaki Word mein
      // bilkul stacked fraction ki tarah dikhe (upar numerator, neeche
      // denominator, beech mein line) — plain "a/b" text nahi.
      const rows = node.querySelectorAll('tr');
      const num = rows[0] ? rows[0].textContent.trim() : '';
      const den = rows[1] ? rows[1].textContent.trim() : '';
      runs.push(new docx.Math({
        children: [
          new docx.MathFraction({
            numerator: [new docx.MathRun(num)],
            denominator: [new docx.MathRun(den)]
          })
        ]
      }));
    } else {
      Array.from(node.childNodes).forEach(c => walk(c, state));
    }
  }
  Array.from(container.childNodes).forEach(c => walk(c, opts));
  if (!runs.length) runs.push(new docx.TextRun({ text: '' }));
  return runs;
}

function docxOptionCell(label, text) {
  const runs = [new docx.TextRun({ text: `[${label}] ` })].concat(htmlToDocxRuns(mathToWordHtml(text)));
  return new docx.TableCell({
    width: { size: 50, type: docx.WidthType.PERCENTAGE },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new docx.Paragraph({ children: runs })]
  });
}

// Blank ruled line used as writing space under subjective questions in
// the exported Word paper (a bottom border on an empty paragraph draws
// the line — same trick used for a signature line).
function docxBlankLine() {
  return new docx.Paragraph({
    spacing: { after: 260 },
    border: { bottom: { color: "999999", space: 1, style: docx.BorderStyle.SINGLE, size: 4 } },
    text: ""
  });
}

function docxQuestionBlock(num, q) {
  const blocks = [];
  const titleRuns = [new docx.TextRun({ text: `${num}. `, bold: true })]
    .concat(htmlToDocxRuns(mathToWordHtml(q.text), { bold: true }));
  blocks.push(new docx.Paragraph({ children: titleRuns, spacing: { after: 100 } }));

  if (q.qType === 'subjective') {
    // Subjective questions have no options — showing empty [A][B][C][D]
    // boxes (the old behaviour) was confusing since there was nothing to
    // fill in. Show the marks instead, plus blank ruled lines to write
    // the answer on.
    const marksLabel = (q.marks !== undefined && q.marks !== null && q.marks !== '') ? `[${q.marks} Marks]` : '[Subjective]';
    blocks.push(new docx.Paragraph({
      children: [ new docx.TextRun({ text: marksLabel, italics: true, color: "555555" }) ],
      spacing: { after: 150 }
    }));
    for (let i = 0; i < 4; i++) blocks.push(docxBlankLine());
  } else {
    blocks.push(new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: {
        top: { style: docx.BorderStyle.NONE }, bottom: { style: docx.BorderStyle.NONE },
        left: { style: docx.BorderStyle.NONE }, right: { style: docx.BorderStyle.NONE },
        insideHorizontal: { style: docx.BorderStyle.NONE }, insideVertical: { style: docx.BorderStyle.NONE }
      },
      rows: [
        new docx.TableRow({ children: [docxOptionCell('A', q.opts[0]), docxOptionCell('B', q.opts[1])] }),
        new docx.TableRow({ children: [docxOptionCell('C', q.opts[2]), docxOptionCell('D', q.opts[3])] })
      ]
    }));
  }

  blocks.push(new docx.Paragraph({ text: "", spacing: { after: 200 } }));
  return blocks;
}

// ── Export to Word (genuine .docx) ────────────
async function exportToWord() {
  const totalQ = isSectionMode() ? getAllQuestionsFlat().length : paperQuestions.length;
  if(!totalQ){ toast('ℹ️ Paper khaali hai!'); return; }

  if (!window.docx) {
    toast('❌ Word export library load nahi hui — internet check karke page reload karein.');
    return;
  }

  const testNo = document.getElementById('testNo').value || '';
  const subject = document.getElementById('subject').value || '';
  const timeMin = document.getElementById('timeMin').value || '';
  const maxMarks = document.getElementById('maxMarks').value || '';
  const instructions = document.getElementById('instructions').value || '';

  const children = [
    new docx.Paragraph({ text: `TEST NO. ${testNo}`.toUpperCase(), heading: docx.HeadingLevel.HEADING1, alignment: docx.AlignmentType.CENTER }),
    new docx.Paragraph({ text: subject.toUpperCase(), heading: docx.HeadingLevel.HEADING2, alignment: docx.AlignmentType.CENTER }),
    new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      children: [ new docx.TextRun({ text: `Time: ${timeMin} min    |    MM: ${maxMarks}` }) ]
    }),
    new docx.Paragraph({
      border: { bottom: { color: "000000", space: 4, style: docx.BorderStyle.SINGLE, size: 6 } },
      text: ""
    }),
    new docx.Paragraph({
      children: [ new docx.TextRun({ text: `Instructions: ${instructions}`, italics: true }) ],
      spacing: { after: 200 }
    })
  ];

  if (isSectionMode()) {
    let globalNum = 1;
    sections.forEach(sec => {
      if (!sec.questions.length) return;
      children.push(new docx.Paragraph({
        text: sec.name.toUpperCase(),
        heading: docx.HeadingLevel.HEADING3,
        alignment: docx.AlignmentType.CENTER,
        shading: { fill: "F0E6FF" },
        spacing: { before: 300, after: 150 }
      }));
      sec.questions.forEach(q => { children.push(...docxQuestionBlock(globalNum++, q)); });
    });
  } else {
    paperQuestions.forEach((q, i) => { children.push(...docxQuestionBlock(i + 1, q)); });
  }

  const filename = `Test_${testNo || 'Paper'}.docx`;

  try {
    const wordDoc = new docx.Document({ sections: [{ properties: {}, children }] });
    const blob = await docx.Packer.toBlob(wordDoc);

    // ── MOBILE FIX ──────────────────────────────────────────────────
    // Ab ye ek asli binary .docx file hai (pehle wali file dikhne mein
    // ".doc" thi par asal mein HTML thi, jise mobile ka Word app khol
    // nahi paata tha — "no recent documents" isi wajah se aata tha).
    // Mobile par pehle native Share sheet try karte hain (jisse seedha
    // Word/Google Docs mein khul jaaye); agar wo available na ho to
    // seedha download.
    try {
      const file = new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename, text: 'Test paper (Word file)' });
        toast('📄 Word (.docx) file share ho gayi!');
        return;
      }
    } catch (shareErr) {
      console.warn('Share failed, falling back to direct download:', shareErr);
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('📄 Word (.docx) file download shuru ho gayi!');
  } catch (err) {
    console.error(err);
    toast('❌ Word file banane mein error: ' + (err.message || err));
  }
}

// ── Print ─────────────────────────────────────
// ── Back navigation (generator is loaded inside an <iframe> in index.html) ──
function goBackFromGenerator() {
  try {
    // Same-origin iframe: directly call parent's admin-tab switcher — no refresh needed
    if (window.parent && window.parent !== window && typeof window.parent.showAdminTab === 'function') {
      window.parent.showAdminTab('generator');
      return;
    }
  } catch (e) { /* cross-origin or not embedded — fall through */ }
  // Fallback: standalone page open (not inside iframe, or parent function missing).
  // Don't use window.history.back() here — that can exit the whole admin flow
  // and land the user on whatever page they visited before this site.
  // Instead, explicitly reopen the admin panel on the "tests" tab.
  window.location.href = 'index.html?admin=1&tab=generator';
}

function printPaper() {
  switchMainTab('preview');
  setTimeout(() => window.print(), 350);
}

// ── OMR Sheet (blank, for the paper currently being built) ──────
// Reuses omr.js's buildOMRSheetDocx (exposed on window) so the bubble
// grid is pixel/mm-identical to what the OMR Scanner later expects —
// but works on the in-progress paper directly, without needing to
// save/publish it as a test first. Only needs {title, questions.length}.
async function generateOMRSheetForPaper() {
  const list = getAllQuestionsFlat().filter(q => q.qType !== 'subjective');
  if (!list.length) { alert('OMR Sheet ke liye pehle paper mein kam se kam ek MCQ question add karein.'); return; }
  if (list.length > 100) { alert('OMR sheet abhi max 100 MCQ questions tak support karti hai.'); return; }
  if (typeof window.buildOMRSheetDocx !== 'function' || !window.docx) {
    alert('OMR sheet generator load nahi hua — page reload karke dobara try karein.');
    return;
  }
  const title = loadedDraftTitle || document.getElementById('subject')?.value || 'Test';
  const testIdLabel = editingDraftId || ('draft-' + Date.now());
  const btn = document.getElementById('omr-sheet-btn-qgen');
  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generate ho raha hai...'; }
    const doc = window.buildOMRSheetDocx({ title, questions: list }, testIdLabel);
    const blob = await window.docx.Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OMR-Sheet-${String(title).replace(/[^a-z0-9]+/gi, '-')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('✅ OMR Sheet (Word) download ho gaya!');
  } catch (e) {
    console.error(e);
    alert('OMR sheet banane mein error: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🎯 OMR Sheet (Blank)'; }
  }
}

// ── Utility ───────────────────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Convert LaTeX math (as used by KaTeX on-screen) into real Word-compatible
// HTML (<sup>/<sub> tags, actual symbols) so .doc export looks like a printed
// book instead of showing raw "\( x^{2} \)" markup.
function mathToWordHtml(raw) {
  if (!raw) return "";
  let s = String(raw);

  // Pull out each \( ... \), \[ ... \], $$ ... $$ math segment and convert it;
  // plain text outside math segments is just HTML-escaped as before.
  const mathRe = /\\\((.*?)\\\)|\\\[(.*?)\\\]|\$\$(.*?)\$\$/gs;
  let out = "";
  let lastIndex = 0;
  let m;
  while ((m = mathRe.exec(s)) !== null) {
    out += escHtml(s.slice(lastIndex, m.index));
    const inner = m[1] ?? m[2] ?? m[3] ?? "";
    out += convertLatexInner(inner);
    lastIndex = mathRe.lastIndex;
  }
  out += escHtml(s.slice(lastIndex));
  return out;
}

function convertLatexInner(latex) {
  let s = String(latex);

  // \frac{a}{b} / \dfrac{a}{b} -> real stacked fraction (numerator,
  // dividing line, denominator). Word's HTML-import engine has no support
  // for CSS display:inline-block on divs, so a <table> is genuinely the
  // only reliable way to get a true stacked fraction with a line in Word.
  // We reset border/cellpadding/cellspacing explicitly to 0/none on every
  // part so no stray gridlines show up while editing — only the one
  // border-bottom line under the numerator remains.
  s = s.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g,
    (_, a, b) => `<table border="0" cellpadding="0" cellspacing="0" style="display:inline-table;border-collapse:collapse;vertical-align:middle;text-align:center;margin:0 2px;font-size:0.9em;line-height:1.15;"><tr><td style="border:none;border-bottom:1px solid #000;padding:0 3px 1px;">${a}</td></tr><tr><td style="border:none;padding:1px 3px 0;">${b}</td></tr></table>`);

  // \sqrt{x} -> real radical marker (Word export ise asli OOXML radical
  // object banata hai — checkmark-shape symbol + poori expression ke upar
  // bar). \sqrt[n]{x} -> nth-root marker (degree ke saath).
  s = s.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, (_, n, x) => `<radical degree="${n}">${x}</radical>`);
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_, x) => `<radical>${x}</radical>`);

  // \text{word} -> word (plain upright text)
  s = s.replace(/\\text\{([^{}]*)\}/g, (_, t) => t);

  // Superscript: x^{ab} or x^a
  s = s.replace(/\^\{([^{}]*)\}/g, (_, e) => `<sup>${e}</sup>`);
  s = s.replace(/\^(-?[A-Za-z0-9])/g, (_, e) => `<sup>${e}</sup>`);

  // Subscript: x_{ab} or x_a
  s = s.replace(/_\{([^{}]*)\}/g, (_, e) => `<sub>${e}</sub>`);
  s = s.replace(/_(-?[A-Za-z0-9])/g, (_, e) => `<sub>${e}</sub>`);

  // Symbols / operators
  const symbolMap = {
    "\\times": "×", "\\div": "÷", "\\leq": "≤", "\\geq": "≥", "\\neq": "≠",
    "\\pm": "±", "\\cdot": "·", "\\infty": "∞", "\\approx": "≈",
    "\\pi": "π", "\\theta": "θ", "\\alpha": "α", "\\beta": "β", "\\gamma": "γ",
    "\\delta": "δ", "\\lambda": "λ", "\\mu": "μ", "\\sigma": "σ", "\\omega": "ω",
    "\\sin": "sin", "\\cos": "cos", "\\tan": "tan", "\\cot": "cot",
    "\\sec": "sec", "\\cosec": "cosec", "\\log": "log", "\\ln": "ln"
  };
  Object.keys(symbolMap).forEach(k => {
    s = s.split(k).join(symbolMap[k]);
  });

  // Drop any leftover LaTeX backslash-commands and stray braces we didn't map
  s = s.replace(/\\[a-zA-Z]+/g, "");
  s = s.replace(/[{}]/g, "");

  return s.trim();
}

// Every question destined for a draft needs a stable id that both the
// flat `questions[]` list AND `sections[].questionIds` agree on. Bank
// questions already have one (firestoreId). Custom/manually-typed
// questions (e.g. most subjective questions, which are usually typed
// directly rather than pulled from the bank) don't — so we mint one here
// and write it back onto the in-memory question object itself. This must
// run once, before buildDraftQuestionsPayload() and buildSectionsPayload()
// are both called, otherwise each of them independently invents a
// *different* random id for the same question and the section's
// questionIds end up pointing at ids that don't exist in questions[] —
// which is what caused mixed MCQ+subjective sectioned papers to lose/
// scramble questions when the draft was reloaded.
function ensureDraftQuestionIds() {
  const list = isSectionMode() ? getAllQuestionsFlat() : paperQuestions;
  list.forEach(pq => {
    if (!pq.firestoreId) {
      pq.firestoreId = "q-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
    }
  });
}

function buildDraftQuestionsPayload() {
  const list = isSectionMode() ? getAllQuestionsFlat() : paperQuestions;
  return list.map(pq => ({
    id: pq.firestoreId,
    subject: pq.subject || "General",
    chapter: pq.chapter || "Mixed",
    text: pq.text || "",
    textEN: "",
    textHI: pq.text || "",
    options: pq.opts || [],
    optionsEN: [],
    optionsHI: pq.opts || [],
    answer: parseInt(pq.ans || 0),
    qType: pq.qType === 'subjective' ? 'subjective' : 'mcq',
    marks: pq.qType === 'subjective' ? (pq.marks ?? null) : null,
    modelAnswer: pq.qType === 'subjective' ? (pq.modelAnswer || '') : '',
    explanationEN: "",
    explanationHI: ""
  }));
}

function buildSectionsPayload() {
  if (!isSectionMode()) return null;
  return sections.map(sec => ({
    id: sec.id,
    name: sec.name,
    questionIds: sec.questions.map(q => q.firestoreId)
  }));
}

async function savePaperAsDraft() {
  const totalQ = isSectionMode() ? getAllQuestionsFlat().length : paperQuestions.length;
  if (totalQ === 0) {
    alert("Draft mein save karne ke liye pehle paper mein questions add karein.");
    return;
  }

  const db = window.vishnuFirebase?.db;
  if (!db) {
    alert("Firebase connected nahi hai!");
    return;
  }

  const defaultTitle = editingDraftId && loadedDraftTitle
    ? loadedDraftTitle
    : "Mock Test " + new Date().toLocaleDateString('en-GB');
  const title = prompt("Test ka naam likhein (e.g. Weekly Test 1):", defaultTitle);
  if (!title) return;

  ensureDraftQuestionIds();
  const questions = buildDraftQuestionsPayload();
  const sectionsPayload = buildSectionsPayload();
  const timeMin = Number(document.getElementById('timeMin').value || 30);
  const marks = loadedDraftMarks || 2;
  const isUpdate = Boolean(editingDraftId);
  const id = editingDraftId || `test-${Date.now()}`;
  // Agar ye paper Admin panel se connected hai (loadTestFromAdmin ke
  // through), to uske category/attemptLimit/subjectiveMarks fields yahan
  // bhi jod do — warna plain "Save to Drafts" unhe Firestore se hata deta
  // (merge:true ke bawajood in fields ko explicitly na bhejna unhe
  // "as-is" chhod dega, jo theek hai, lekin negativeEnabled/negativeMarks
  // jaise fields yahan overwrite ho sakte the isliye admin meta se bharo).
  const linkedMeta = (isUpdate && _qgenAdminLinked && _qgenAdminMeta) ? _qgenAdminMeta : null;
  const t = {
    title: title.trim(),
    minutes: timeMin,
    marksPerQuestion: marks,
    negativeEnabled: linkedMeta ? (linkedMeta.negativeEnabled || false) : false,
    negativeMarks: linkedMeta ? (linkedMeta.negativeMarks || 0) : 0,
    ...(linkedMeta ? { category: linkedMeta.category ?? null, attemptLimit: linkedMeta.attemptLimit ?? null, subjectiveMarks: linkedMeta.subjectiveMarks ?? null } : {}),
    questions: questions,
    isDraft: true,
    ...(sectionsPayload ? { sections: sectionsPayload, hasSections: true } : {})
  };

  try {
    const btn = document.querySelector('button[onclick="savePaperAsDraft()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = "☁️ Saving..."; }

    // merge:true taaki koi aur field (jaise chunkCount, includeInLeaderboard,
    // ya Admin-connected meta jo upar shamil nahi hai) galti se delete na ho.
    await db.collection("tests").doc(id).set(t, { merge: true });
    if (btn) { btn.disabled = false; }
    // Save is a "commit" now, not a "keep editing" action: clear the
    // builder so Preview goes back to blank and a new paper can be
    // started right away. The saved paper isn't lost — it's sitting in
    // the left panel's Drafts list, one click away via loadDraftIntoPaper.
    resetPaperBuilder();
    alert(isUpdate
      ? "✅ Draft update ho gaya!\nPaper builder khaali kar diya gaya hai — naya paper shuru karein, ya isi draft ko dubara edit karne ke liye left panel ki Drafts list se select karein."
      : "✅ Paper Draft mein save ho gaya!\nPaper builder khaali kar diya gaya hai — naya paper shuru karein, ya is draft ko edit karne ke liye left panel ki Drafts list se select karein. Publish karne ke liye Admin Panel -> Tests tab use karein.");
  } catch (err) {
    console.error(err);
    alert("Save nahi ho paya. Error: " + err.message);
    const btn = document.querySelector('button[onclick="savePaperAsDraft()"]');
    if (btn) { btn.disabled = false; updateDraftSaveButton(); }
  }
}

function updateDraftSaveButton() {
  const btn = document.querySelector('button[onclick="savePaperAsDraft()"]');
  if (btn) btn.innerHTML = editingDraftId ? "☁️ Update Draft" : "☁️ Save to Drafts";
}

// Drafts saved via the main Test Creator (script.js -> saveTestOnline) keep
// their questions in a "tests/{id}/qchunks/c0, c1, ..." subcollection rather
// than inline on the doc (to stay under Firestore's 1MB doc limit), and the
// main doc's "questions" field is deleted in that flow. Question Generator's
// own draft save keeps questions inline. This helper transparently loads
// either shape, so Draft Edit works no matter which flow created the draft.
async function fetchDraftQuestionsPayload(t, testId) {
  if (t.questions && t.questions.length) return t.questions;
  const chunkCount = t.chunkCount || 0;
  if (!chunkCount) return [];
  const db = window.vishnuFirebase?.db;
  if (!db) return [];
  const snaps = await Promise.all(
    Array.from({ length: chunkCount }, (_, i) => db.collection("tests").doc(testId).collection("qchunks").doc("c" + i).get())
  );
  let questions = [];
  snaps.forEach(s => { if (s.exists) questions = questions.concat(s.data().questions || []); });
  return questions;
}

async function loadDraftIntoPaper(testId) {
  const t = draftTestsCache.find(d => d.id === testId)?.data;
  if (!t) { toast('⚠️ Draft load nahi ho paya'); return; }
  if (paperQuestions.length && !confirm('Current paper replace ho jayega. Draft load karein?')) return;

  let questionsPayload;
  try {
    if (!t.questions?.length && t.chunkCount) toast('⏳ Draft ke questions load ho rahe hain...');
    questionsPayload = await fetchDraftQuestionsPayload(t, testId);
  } catch (err) {
    console.error(err);
    toast('⚠️ Draft ke questions load nahi ho paye');
    return;
  }

  editingDraftId = testId;
  loadedDraftTitle = t.title || '';
  loadedDraftMarks = t.marksPerQuestion || 2;
  document.getElementById('timeMin').value = t.minutes || 27;
  syncHeader();
  updateDraftSaveButton();

  // Build question map for section restoration
  const allQMapped = (questionsPayload || []).map((q) => ({
    id: qIdCounter++,
    firestoreId: q.id,
    text: q.textHI || q.textEN || q.text || '',
    opts: (q.optionsHI?.length ? q.optionsHI : q.optionsEN?.length ? q.optionsEN : q.options) || [],
    ans: parseInt(q.answer ?? 0),
    chapter: q.chapter || 'Mixed',
    subject: q.subject || 'General',
    qType: q.qType === 'subjective' ? 'subjective' : 'mcq',
    marks: q.qType === 'subjective' ? (q.marks ?? null) : null,
    modelAnswer: q.qType === 'subjective' ? (q.modelAnswer || '') : '',
    bankIdx: -1
  }));

  if (t.hasSections && t.sections?.length) {
    // Restore section structure
    const qById = {};
    allQMapped.forEach(q => { if (q.firestoreId) qById[q.firestoreId] = q; });
    sections = t.sections.map(sec => ({
      id: sec.id || ('sec-' + Date.now()),
      name: sec.name || 'Section',
      questions: (sec.questionIds || []).map(qid => qById[qid]).filter(Boolean)
    }));
    // Any questions not in any section -> add to last section
    const assignedIds = new Set(sections.flatMap(s => s.questions.map(q => q.firestoreId)));
    const orphans = allQMapped.filter(q => !assignedIds.has(q.firestoreId));
    if (orphans.length && sections.length) sections[sections.length-1].questions.push(...orphans);
    activeSection = 0;
    paperQuestions = sections[0]?.questions || [];
    renderSectionTabs();
  } else {
    sections = [];
    paperQuestions = allQMapped;
    renderSectionTabs();
  }

  document.querySelectorAll('.bank-item input[type=checkbox]').forEach(cb => cb.checked = false);
  document.querySelectorAll('.bank-item').forEach(item => item.classList.remove('selected'));
  reRenderPaper();
  renderBankPage();
  updateSelectedCount();
  switchSideTab('draftedit');
  switchMainTab('preview');
  toast(`📂 Draft "${loadedDraftTitle}" load — Draft Edit tab mein questions edit karein`);
}

// ── QUESTION → TEST USAGE INDEX ──────────────────
// Builds questionTestMap by scanning EVERY test doc in the "tests"
// collection — both drafts (which store their questions inline as
// data.questions) and published tests (which move questions into a
// "qchunks" subcollection to stay under Firestore's 1MB doc limit, see
// saveTestOnline() in script.js). For each question id found, we record
// which test(s) already contain it so the bank list can warn the admin
// when the same question is being added to another test.
//
// FALLBACK: older tests built via the Admin panel's own "Tests" tab
// (script.js) used to save questions through a cloneQ() that silently
// dropped the bank question's id — so those tests can't be matched by id
// at all. That's now fixed going forward, but already-saved old tests
// still have no id on their questions. For those, we also index by
// normalized question text as a best-effort fallback, so "already used"
// still gets detected for pre-existing tests until they're re-saved.
//
// PERF: rather than re-fetching every test's questions (incl. re-reading
// every published test's qchunks subcollection) on every "tests" change,
// we keep a per-test cache (_testQuestionsCache) and only touch the
// Firestore doc(s) for the test(s) that actually changed. The combined
// map is then just rebuilt from local memory, which is instant even with
// hundreds of tests, so nothing hangs while the admin is working.
function normalizeQText(t) {
  return (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function addQuestionsToTestIndex(map, textMap, questions, testId, title) {
  (questions || []).forEach(q => {
    if (!q) return;
    const qId = q.id;
    if (qId) {
      if (!map[qId]) map[qId] = [];
      if (!map[qId].some(t => t.id === testId)) map[qId].push({ id: testId, title });
    } else {
      // No id (legacy test) — fall back to matching by question text.
      const key = normalizeQText(q.text || q.textHI || q.textEN);
      if (!key) return;
      if (!textMap[key]) textMap[key] = [];
      if (!textMap[key].some(t => t.id === testId)) textMap[key].push({ id: testId, title });
    }
  });
}

let _testQuestionsCache = {};  // testId -> { title, questions: [...] }
let _testIndexRebuildTimer = null;
let _testIndexInFlight = new Set(); // testIds currently being (re)fetched
// Authoritative set of test IDs that currently exist in the "tests"
// collection, refreshed from the FULL snapshot (snap.docs, not just the
// deltas) every time onSnapshot fires below. This is the single source of
// truth for "does this test still exist?" — see rebuildMapFromCache() and
// refreshTestInCache() for why it's needed on top of _testQuestionsCache.
let _liveTestIds = new Set();

// Cheap, local-only: recombine the per-test cache into the lookup maps
// used by getQuestionUsageLabel(). No network calls here.
//
// IMPORTANT: only cache entries whose testId is still in _liveTestIds are
// included. Without this filter, a deleted test's "🔁 <Test> mein hai"
// badge could keep showing: refreshTestInCache() awaits a Firestore read
// (qchunks) before writing into _testQuestionsCache, and if the test gets
// deleted while that read is still in-flight, the 'removed' doc-change
// clears the cache entry first but the in-flight fetch then finishes and
// writes it right back in — resurrecting a badge for a test that no
// longer exists. Filtering against _liveTestIds here guarantees a deleted
// test can never contribute to the badge, no matter how that race plays out.
function rebuildMapFromCache() {
  const map = {};
  const textMap = {};
  for (const testId in _testQuestionsCache) {
    if (!_liveTestIds.has(testId)) continue; // test no longer exists — skip
    const entry = _testQuestionsCache[testId];
    addQuestionsToTestIndex(map, textMap, entry.questions, testId, entry.title);
  }
  questionTestMap = map;
  questionTestTextMap = textMap;
  filterBank();    // re-filter + re-sort so already-used questions drop to the end
  reRenderPaper();  // same badge also shown on the paper/right panel
}

function scheduleMapRebuild() {
  clearTimeout(_testIndexRebuildTimer);
  // Short debounce: this only coalesces bursts of doc changes into one
  // render pass — the actual rebuild is local/instant, no fetch involved.
  _testIndexRebuildTimer = setTimeout(rebuildMapFromCache, 150);
}

// Fetches (or re-fetches) just ONE test's questions and updates the cache.
async function refreshTestInCache(db, doc) {
  const testId = doc.id;
  if (_testIndexInFlight.has(testId)) return; // already being fetched, skip duplicate work
  _testIndexInFlight.add(testId);
  try {
    const data = doc.data() || {};
    const title = data.title || 'Untitled Test';
    if (Array.isArray(data.questions)) {
      // Draft tests (and any legacy inline-questions tests) store the
      // full questions array right on the doc — no extra read needed.
      if (_liveTestIds.has(testId)) _testQuestionsCache[testId] = { title, questions: data.questions };
    } else {
      // Published tests: questions live in the qchunks subcollection.
      // We read it directly (instead of trusting a chunkCount field) so
      // this still works even if that metadata is missing/stale on an
      // older test doc.
      const chunkSnap = await db.collection("tests").doc(testId).collection("qchunks").get();
      // Re-check AFTER the await: the test may have been deleted while
      // this read was in-flight. If so, drop the result instead of
      // writing it back into the cache (see rebuildMapFromCache() comment).
      if (!_liveTestIds.has(testId)) return;
      let qs = [];
      chunkSnap.docs.forEach(c => { qs = qs.concat(c.data().questions || []); });
      _testQuestionsCache[testId] = { title, questions: qs };
    }
  } catch (e) {
    console.warn('[TestIndex] fetch failed for', testId, e);
  } finally {
    _testIndexInFlight.delete(testId);
    scheduleMapRebuild();
  }
}

function initQuestionTestIndex() {
  const db = window.vishnuFirebase?.db;
  if (!db) return;
  // onSnapshot (unlike a one-time .get()) auto-retries once anonymous
  // sign-in finishes, so no need to gate this on authReady.
  db.collection("tests").onSnapshot(snap => {
    // snap.docs is the FULL current set of test docs (not just what
    // changed this event) — always rebuild _liveTestIds from it first, so
    // it's authoritative before any of the per-change handling below runs.
    _liveTestIds = new Set(snap.docs.map(d => d.id));
    snap.docChanges().forEach(change => {
      if (change.type === 'removed') {
        delete _testQuestionsCache[change.doc.id];
        scheduleMapRebuild();
      } else {
        // 'added' (incl. initial load) or 'modified' — only this one
        // test's questions need (re)fetching, everything else in the
        // cache is left untouched.
        refreshTestInCache(db, change.doc);
      }
    });
  }, err => console.warn('[TestIndex] snapshot error', err));
}

// Returns a short display label (e.g. "Weekly Test 1") listing the other
// saved test(s) this question already belongs to, excluding the test
// currently being edited (so editing/re-saving your own draft doesn't
// falsely flag itself). Empty string if the question is new / unused.
// `qText` is optional — used as a fallback lookup (by matching question
// text) for legacy tests whose saved questions have no bank id at all.
function getQuestionUsageLabel(qId, qText) {
  let entries = qId ? (questionTestMap[qId] || []) : [];
  if (!entries.length && qText) {
    entries = questionTestTextMap[normalizeQText(qText)] || [];
  }
  entries = entries.filter(t => t.id !== editingDraftId);
  if (!entries.length) return '';
  const names = entries.map(t => t.title);
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
}

// Same badge as the bank list, reused for the Paper (right panel) so a
// question that's already sitting in another saved test is flagged there
// too — not just while browsing the bank.
function pqUsageBadgeHtml(q) {
  const label = getQuestionUsageLabel(q.firestoreId, q.text);
  if (!label) return '';
  return `<div class="bank-used-in-tag" style="font-size:10px;margin-top:4px" title="Ye question pehle se in test(s) mein hai: ${escHtml(label)}">🔁 ${escHtml(label)} mein hai</div>`;
}

let _draftTestsUnsub = null;
async function fetchDraftTests() {
  const list = document.getElementById('draftsList');
  if (!list) return;
  const db = window.vishnuFirebase?.db;
  if (!db) {
    list.innerHTML = '<div class="draft-empty">Firebase connected nahi hai</div>';
    return;
  }
  // Already live-syncing — no need to re-subscribe. The listener below
  // keeps draftTestsCache in sync in real time, so this list always
  // matches however many draft tests exist in the Tests tab, even ones
  // created/saved after this page was opened.
  if (_draftTestsUnsub) return;
  list.innerHTML = '<div class="draft-empty">Loading drafts... ⏳</div>';
  try {
    _draftTestsUnsub = db.collection("tests").where("isDraft", "==", true)
      .onSnapshot(snap => {
        draftTestsCache = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        draftTestsCache.sort((a, b) => (b.data.title || '').localeCompare(a.data.title || ''));
        renderDraftsList();
      }, err => {
        console.error(err);
        list.innerHTML = '<div class="draft-empty">Drafts load nahi ho paye</div>';
      });
  } catch (err) {
    console.error(err);
    list.innerHTML = '<div class="draft-empty">Drafts load nahi ho paye</div>';
  }
}

// ── Admin Panel bridge ───────────────────────────────────────────
// Called by script.js (parent page) via window.parent → the "Create /
// Edit Test" form's "📄 Questions Paper Generator mein Add Karein" button
// calls this with the Firestore test id it just saved. We load that
// test's meta + existing questions (if any) straight into the paper
// builder, remember the admin-only fields (category/attemptLimit/
// subjectiveMarks) that this UI has no fields for so they survive the
// round trip, and reveal the "Save & Admin ko Bhejein" button.
let _qgenAdminMeta = null;
let _qgenAdminLinked = false;

window.loadTestFromAdmin = async function (testId) {
  const db = window.vishnuFirebase?.db;
  if (!db) { toast('⚠️ Firebase connect nahi hai'); return; }

  const totalExisting = isSectionMode() ? getAllQuestionsFlat().length : paperQuestions.length;
  if (totalExisting && !confirm('Current paper builder khaali karke Admin test load karein?')) return;

  let t = draftTestsCache.find(d => d.id === testId)?.data;
  if (!t) {
    try {
      const snap = await db.collection('tests').doc(testId).get();
      if (snap.exists) t = snap.data();
    } catch (err) { console.error(err); }
  }
  if (!t) { toast('⚠️ Test data nahi mila, dobara try karein'); return; }

  _qgenAdminLinked = true;
  _qgenAdminMeta = {
    category: t.category ?? null,
    attemptLimit: t.attemptLimit ?? null,
    subjectiveMarks: t.subjectiveMarks ?? null,
    negativeEnabled: t.negativeEnabled ?? false,
    negativeMarks: t.negativeMarks ?? 0
  };

  let questionsPayload = [];
  try {
    if (!t.questions?.length && t.chunkCount) toast('⏳ Questions load ho rahe hain...');
    questionsPayload = await fetchDraftQuestionsPayload(t, testId);
  } catch (err) {
    console.error(err);
    toast('⚠️ Test ke questions load nahi ho paye, khaali paper se shuru kar rahe hain');
  }

  editingDraftId = testId;
  loadedDraftTitle = t.title || '';
  loadedDraftMarks = t.marksPerQuestion || 2;
  const subjEl = document.getElementById('subject');
  if (subjEl) subjEl.value = loadedDraftTitle;
  const timeEl = document.getElementById('timeMin');
  if (timeEl) timeEl.value = t.minutes || 30;
  syncHeader();
  updateDraftSaveButton();

  const allQMapped = (questionsPayload || []).map((q) => ({
    id: qIdCounter++,
    firestoreId: q.id,
    text: q.textHI || q.textEN || q.text || '',
    opts: (q.optionsHI?.length ? q.optionsHI : q.optionsEN?.length ? q.optionsEN : q.options) || [],
    ans: parseInt(q.answer ?? 0),
    chapter: q.chapter || 'Mixed',
    subject: q.subject || 'General',
    qType: q.qType === 'subjective' ? 'subjective' : 'mcq',
    marks: q.qType === 'subjective' ? (q.marks ?? null) : null,
    modelAnswer: q.qType === 'subjective' ? (q.modelAnswer || '') : '',
    bankIdx: -1
  }));

  if (t.hasSections && t.sections?.length) {
    const qById = {};
    allQMapped.forEach(q => { if (q.firestoreId) qById[q.firestoreId] = q; });
    sections = t.sections.map(sec => ({
      id: sec.id || ('sec-' + Date.now()),
      name: sec.name || sec.title || 'Section',
      questions: (sec.questionIds || []).map(qid => qById[qid]).filter(Boolean)
    }));
    const assignedIds = new Set(sections.flatMap(s => s.questions.map(q => q.firestoreId)));
    const orphans = allQMapped.filter(q => !assignedIds.has(q.firestoreId));
    if (orphans.length && sections.length) sections[sections.length - 1].questions.push(...orphans);
    activeSection = 0;
    paperQuestions = sections[0]?.questions || [];
    renderSectionTabs();
  } else {
    sections = [];
    paperQuestions = allQMapped;
    renderSectionTabs();
  }

  document.querySelectorAll('.bank-item input[type=checkbox]').forEach(cb => cb.checked = false);
  document.querySelectorAll('.bank-item').forEach(item => item.classList.remove('selected'));
  reRenderPaper();
  renderBankPage();
  updateSelectedCount();
  switchSideTab('bank');
  switchMainTab('preview');
  showAdminLinkBanner(loadedDraftTitle, allQMapped.length);
};

function showAdminLinkBanner(title, qCount) {
  const backBtn = document.getElementById('send-back-to-admin-btn');
  if (backBtn) backBtn.classList.remove('hidden');
  let banner = document.getElementById('admin-link-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'admin-link-banner';
    banner.style.cssText = 'background:#ecfdf5;border:1.5px solid #10b981;color:#065f46;font-size:.76rem;font-weight:600;line-height:1.5;padding:8px 10px;border-radius:8px;margin:0 0 10px;';
    document.querySelector('.sidebar-logo')?.insertAdjacentElement('afterend', banner);
  }
  banner.innerHTML = `🔗 Admin Test se connected: <b>${escHtml(title || 'Untitled')}</b> (${qCount || 0} Q abhi)<br/>Bank se questions add karein, phir neeche <b>"✅ Save &amp; Admin ko Bhejein"</b> dabayein.`;
}

// "✅ Save & Admin ko Bhejein" — abhi tak banaya gaya paper Firestore mein
// isi test id par save karta hai (admin ke category/attemptLimit/
// subjectiveMarks fields ko bhi wapas jodta hai, taaki wo delete na hon),
// aur phir parent (Admin panel) ko wapas bhej deta hai — jahan wahi test
// "Create / Edit Test" form mein, questions samet, khul jaata hai.
async function saveAndReturnToAdmin() {
  const totalQ = isSectionMode() ? getAllQuestionsFlat().length : paperQuestions.length;
  if (totalQ === 0) {
    alert('Pehle paper mein kam se kam ek question add karein.');
    return;
  }
  if (!editingDraftId || !_qgenAdminLinked) {
    alert('Ye paper kisi Admin test se connected nahi hai.\nAdmin panel ke "Create / Edit Test" form se "📄 Questions Paper Generator mein Add Karein" button use karein.');
    return;
  }

  const db = window.vishnuFirebase?.db;
  if (!db) { alert('Firebase connected nahi hai!'); return; }

  ensureDraftQuestionIds();
  const questions = buildDraftQuestionsPayload();
  const sectionsPayload = buildSectionsPayload();
  const timeMin = Number(document.getElementById('timeMin').value || 30);
  const marks = loadedDraftMarks || 2;
  const meta = _qgenAdminMeta || {};
  const idToOpen = editingDraftId;

  const t = {
    title: loadedDraftTitle || 'Untitled Test',
    minutes: timeMin,
    marksPerQuestion: marks,
    negativeEnabled: meta.negativeEnabled || false,
    negativeMarks: meta.negativeMarks || 0,
    category: meta.category ?? null,
    attemptLimit: meta.attemptLimit ?? null,
    subjectiveMarks: meta.subjectiveMarks ?? null,
    questions: questions,
    isDraft: true,
    ...(sectionsPayload ? { sections: sectionsPayload, hasSections: true } : {})
  };

  const btn = document.getElementById('send-back-to-admin-btn');
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Save ho raha hai...'; }
    await db.collection('tests').doc(idToOpen).set(t, { merge: true });
    toast('✅ Save ho gaya — Admin panel mein wapas ja rahe hain...');
    resetPaperBuilder();
    _qgenAdminLinked = false;
    _qgenAdminMeta = null;
    document.getElementById('admin-link-banner')?.remove();
    if (btn) btn.classList.add('hidden');
    setTimeout(() => {
      if (window.parent && window.parent !== window && typeof window.parent.receiveTestBackFromGenerator === 'function') {
        window.parent.receiveTestBackFromGenerator(idToOpen);
      } else {
        window.location.href = 'index.html?admin=1&tab=tests&openTest=' + encodeURIComponent(idToOpen);
      }
    }, 400);
  } catch (err) {
    console.error(err);
    alert('Save nahi ho paya: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '✅ Save &amp; Admin ko Bhejein'; }
  }
}
window.saveAndReturnToAdmin = saveAndReturnToAdmin;

function renderDraftsList() {
  const list = document.getElementById('draftsList');
  if (!list) return;
  if (!draftTestsCache.length) {
    list.innerHTML = '<div class="draft-empty">Koi saved draft nahi hai</div>';
    return;
  }
  list.innerHTML = draftTestsCache.map(d => {
    const t = d.data;
    const active = d.id === editingDraftId ? ' active' : '';
    // Drafts saved from the main Test Creator (script.js -> saveTestOnline)
    // store questions in a "qchunks" subcollection instead of inline, and
    // strip the "questions" field off the main doc to stay under Firestore's
    // 1MB limit. For those, t.questions is empty but t.questionCount holds
    // the real count -> fall back to that so the sidebar doesn't show "0 Q".
    const qCount = (t.questions || []).length || t.questionCount || 0;
    return `
      <div class="draft-item${active}" onclick="loadDraftIntoPaper('${d.id}')">
        <div class="draft-item-title">${escHtml(t.title || 'Untitled')}</div>
        <div class="draft-item-meta">${qCount} Q · ${t.minutes || 30} min</div>
        ${d.id === editingDraftId ? '<span class="draft-editing-badge">Editing</span>' : ''}
      </div>`;
  }).join('');
}

// ── Init ──────────────────────────────────────
(function init() {
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('testDate').value = today;
  syncHeader();

  // Fetch from same Firebase as Admin (onSnapshot calls buildBankList automatically)
  fetchBankFromFirebase();
  fetchDraftTests();
  initQuestionTestIndex();

  updateCount();
  updateAnswerKey();
  renderDraftEditSection();
  renderSectionTabs();

  // Auto-render KaTeX whenever paper content changes (MutationObserver)
  var paperList = document.getElementById('paperQList');
  if (paperList && window.MutationObserver) {
    // NOTE: renderMathIn() itself edits the DOM (spacing-fix rewrites
    // el.innerHTML, and KaTeX's auto-render replaces \( ... \) text with
    // rendered spans). Both of those are DOM mutations, which — without a
    // guard — get picked up by this very observer and re-trigger
    // renderMathIn() again, which mutates the DOM again, forever. For most
    // questions the render happens to settle after 1-2 passes so nothing is
    // visibly wrong, but certain question text (e.g. Hindi mixed inside
    // math delimiters, or unbalanced \( \) pairs) never settles, so the
    // observer keeps firing continuously and the tab hangs/freezes. Guard
    // against this by disconnecting the observer while we do our own DOM
    // writes, and only re-attaching once that work has finished.
    var isSyncingMath = false;
    var mathObserver = new MutationObserver(function() {
      if (isSyncingMath) return;
      isSyncingMath = true;
      mathObserver.disconnect();
      renderMathIn(paperList);
      requestAnimationFrame(function() {
        mathObserver.observe(paperList, {childList:true, subtree:true});
        isSyncingMath = false;
      });
    });
    mathObserver.observe(paperList, {childList:true, subtree:true});
  }
})();
