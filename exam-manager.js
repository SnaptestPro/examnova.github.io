/* ══════════════════════════════════════════════════════════════════
   SAVYASACHI COACHING — EXAM MANAGER (OMR hub ka 5th section)
   ══════════════════════════════════════════════════════════════════
   Ye ek halka, self-contained bookkeeping tool hai offline/paper exams
   ke liye — question bank ya "Tests" collection se koi lena-dena nahi.
   Ismein ye sab hai:
     • Exam banayein (naam, class, date, questions, sets, students,
       roll-no digit count)
     • Answer Key — har question ke liye A/B/C/D par click karke bharein
       (1 se zyada Set ho to har Set ki apni alag key)
     • Scan Sheet — camera se sheet ke 4 corner ke kaale square detect
       karke, sab align hote hi (chhota "beep" ke saath) photo apne aap
       capture karta hai, phir usi photo par:
         1) Exam Set (A–E) bubble aur Roll No bubble grid padhta hai
         2) har question ka bhara hua bubble padh kar us Set ki Answer
            Key se compare karta hai
         3) photo ke upar hi seedha rang daal deta hai — sahi jawab par
            HARA dot, galat par LAAL dot, aur jo chhoda/galat hai uske
            "sahi jawab" wale bubble par ek chhota SUNHRA (gold) dot,
            bilkul jaisa reference video mein dikhta hai
       Roll No/Marks/Set header mein turant dikh jaata hai, neeche
       Cancel / Edit / Save milta hai — Edit se galat padhi reading
       (roll, set, koi bhi answer) haath se theek kar sakte hain. Save
       dabate hi "✅ Saved" toast dikh kar camera turant agli sheet ke
       liye taiyaar ho jaata hai (bina dobara camera permission maange),
       taaki poora bandle lagataar scan ho sake.
     • OMR/Bubble Sheet — fixed 100-question/5-column printable sheet,
       Exam Set (A–E) row + Roll No block ke saath
     • Reports — har scanned sheet ka Roll No, Set, Marks, ✓/✗/○ count
       (reference video ke Reports screen jaisa)
     • Settings, Web Link, Download Excel (ab per-student rows sahit),
       Analysis (per-question difficulty), Publish, Absentees, Delete

   Pehle ye sab ek alag prototype app mein localStorage par tha; ab
   sab kuch Firestore collection "examManagerExams" mein save hota hai,
   isliye kisi bhi device/browser se same data dikhega. Har scanned
   sheet ka result us exam document ke "results" array field mein save
   hota hai (alag subcollection nahi — isliye koi extra firestore.rules
   deploy karne ki zaroorat nahi padi).

   Reuses from script.js:  getDB(), escHtml()
   Reuses from styles.css: .test-analysis-overlay / .test-analysis-sheet
                            / .test-analysis-close, .card, .btn-primary,
                            .btn-secondary, .btn-danger, .field-row,
                            .two-col, .muted-text
   Apni CSS sirf exam-manager.css mein (prefix: examgr-).

   ⚠️ IMPORTANT: firestore.rules mein "examManagerExams" collection ke
   liye rule add ki gayi hai — wo Firebase Console/CLI se deploy karna
   zaroori hai, warna reads/writes "permission-denied" denge.
   ══════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const COLLECTION = "examManagerExams";
  const MAX_QUESTIONS = 100;
  const OPTION_LETTERS = ["A", "B", "C", "D"];
  const SET_LETTERS = ["A", "B", "C", "D", "E"]; // Exam Set bubble row — max 5 sets

  // ---- state ----
  let examMgrExams = {};        // id -> Firestore doc data (local cache)
  let examMgrSortDesc = true;   // true = newest date first
  let examMgrSelectedId = null; // currently open exam (details sheet)

  // Answer Key draft (working copy until Save is pressed)
  let akeyDraft = [];
  let akeyOriginal = [];
  let akeySelectedSet = "A";    // which Set's key is being edited right now

  // Scanner state
  let scannerStream = null;
  let scannerAnimationFrame = null;
  let scannerLastDetectionAt = 0;
  let scannerStableFrames = 0;
  // Rolling window of the last few "all-4-markers-found" frames' corner
  // positions (see EG_MARKER_HISTORY_SIZE / egAverageMarkerFrames below) —
  // averaged together at capture time instead of trusting the single last
  // frame, to cancel out hand-tremor jitter in the corner read itself.
  let scannerMarkerHistory = [];
  // v10: parallel snapshot of the actual video pixels at each "all 4
  // markers found" tick (not just the marker positions) — see
  // captureAlignedOmr, where every stored frame gets warped and averaged
  // together. This is what cancels out camera sensor noise / motion blur
  // in the bubble ink itself; corner-averaging alone only fixes geometry.
  let scannerFrameHistory = [];
  let scannerCapturing = false;
  let scannerCameraRequestInProgress = false;
  // Most recent capture's detection + grading result, kept so Edit/Save can
  // act on it without re-running detection.
  let scannerDetected = null;   // { setLetter, roll, rollDigits:[...], answers:[{q,opt}] }
  let scannerGraded = null;     // { marks, correct, wrong, blank, perQuestion:[...] }
  let scannerAudioCtx = null;
  // Pristine (no colored dots) copy of the last capture, so Edit can
  // re-paint from scratch instead of drawing new dots over old ones.
  let scannerRawCanvas = null;
  // Scratch canvas holding the untouched, full-resolution video frame at
  // the instant of capture — input to the perspective warp below.
  let scannerRawVideoCanvas = null;

  function $id(id) { return document.getElementById(id); }
  function db() { return typeof getDB === "function" ? getDB() : null; }

  // ────────────────────────────────────────────────────────────────
  // small helpers
  // ────────────────────────────────────────────────────────────────
  function currentIsoDate() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fmtDateBadge(iso) {
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const d = new Date(`${iso || currentIsoDate()}T00:00:00`);
    if (isNaN(d.getTime())) return { month: "—", day: "—" };
    return { month: MONTHS[d.getMonth()], day: d.getDate() };
  }

  function safeFileName(value) {
    return (value || "exam").toString()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    return `"${String(value == null ? "" : value).replace(/"/g, '""')}"`;
  }

  // ────────────────────────────────────────────────────────────────
  // Firestore: load / create / update / delete
  // ────────────────────────────────────────────────────────────────
  async function loadExamManagerExams() {
    const listEl = $id("examgr-list");
    const database = db();
    if (!database) {
      if (listEl) listEl.innerHTML = '<div class="examgr-empty">⚠️ Firebase se connect nahi ho paya — internet check karein.</div>';
      return;
    }
    if (listEl) listEl.innerHTML = '<div class="examgr-empty">⏳ Exams load ho rahe hain...</div>';
    try {
      const snap = await database.collection(COLLECTION).get();
      examMgrExams = {};
      snap.forEach(doc => { examMgrExams[doc.id] = doc.data(); });
      renderExamMgrList();
    } catch (err) {
      if (listEl) listEl.innerHTML = `<div class="examgr-empty">⚠️ Exams load nahi ho paye: ${escHtml(err.message || String(err))}</div>`;
    }
  }
  window.loadExamManagerExams = loadExamManagerExams;

  async function createExamManagerExam(fields) {
    const database = db();
    if (!database) { alert("Firebase se connect nahi ho paya — internet check karein."); return null; }
    const id = database.collection(COLLECTION).doc().id;
    const payload = {
      examName: fields.examName,
      className: fields.className || "",
      date: fields.date,
      questions: fields.questions,
      sets: fields.sets,
      students: fields.students,
      scanned: 0,
      answerKey: [],   // legacy single key — used as Set "A"'s key / fallback
      answerKeys: {},  // { A: [...], B: [...], ... } per-set keys
      results: [],     // [{id, roll, setLetter, marks, correct, wrong, blank, answers, scannedAt, thumb}]
      absentees: "",
      webLink: "",
      published: false,
      rollDigits: Math.max(1, Math.min(5, Number(fields.rollDigits) || 2)),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      await database.collection(COLLECTION).doc(id).set(payload);
      examMgrExams[id] = { ...payload, createdAt: new Date(), updatedAt: new Date() };
      return id;
    } catch (err) {
      alert("Exam save nahi ho paya: " + (err.message || err));
      return null;
    }
  }

  async function updateExamManagerExam(id, patch) {
    const database = db();
    if (!database) { alert("Firebase se connect nahi ho paya — internet check karein."); return false; }
    try {
      await database.collection(COLLECTION).doc(id).update({
        ...patch,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (examMgrExams[id]) Object.assign(examMgrExams[id], patch);
      return true;
    } catch (err) {
      alert("Save nahi ho paya: " + (err.message || err));
      return false;
    }
  }

  async function incrementExamScanned(id) {
    const database = db();
    if (!database) return false;
    try {
      await database.collection(COLLECTION).doc(id).update({
        scanned: firebase.firestore.FieldValue.increment(1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (examMgrExams[id]) examMgrExams[id].scanned = (Number(examMgrExams[id].scanned) || 0) + 1;
      return true;
    } catch (err) {
      alert("Scan count save nahi ho paya: " + (err.message || err));
      return false;
    }
  }

  async function deleteExamManagerExam(id) {
    const ex = examMgrExams[id];
    if (!ex) return;
    if (!confirm(`"${ex.examName || "Ye exam"}" delete karein? Ye wapas nahi aayega.`)) return;
    const database = db();
    if (!database) return;
    try {
      await database.collection(COLLECTION).doc(id).delete();
      delete examMgrExams[id];
      if (examMgrSelectedId === id) examgrCloseDetails(true);
      renderExamMgrList();
    } catch (err) {
      alert("Delete nahi ho paya: " + (err.message || err));
    }
  }

  // ────────────────────────────────────────────────────────────────
  // list rendering
  // ────────────────────────────────────────────────────────────────
  function renderExamMgrList() {
    const listEl = $id("examgr-list");
    if (!listEl) return;
    const ids = Object.keys(examMgrExams);
    if (!ids.length) {
      listEl.innerHTML = '<div class="examgr-empty">🗂️ Abhi koi exam nahi bana — "+ Naya Exam Banayein" se shuru karein.</div>';
      return;
    }
    ids.sort((a, b) => {
      const da = examMgrExams[a].date || "", dbb = examMgrExams[b].date || "";
      return examMgrSortDesc ? dbb.localeCompare(da) : da.localeCompare(dbb);
    });
    listEl.innerHTML = ids.map(id => {
      const ex = examMgrExams[id];
      const d = fmtDateBadge(ex.date);
      const scanned = Number(ex.scanned) || 0;
      const students = Number(ex.students) || 0;
      return `<div class="examgr-card">
        <div class="examgr-card-main" data-open="${id}" role="button" tabindex="0">
          <div class="examgr-date-badge"><span>${d.month}</span><strong>${d.day}</strong></div>
          <div class="examgr-card-body">
            <div class="examgr-card-top">
              <span class="examgr-card-name">${escHtml(ex.examName || "Untitled Exam")}</span>
              ${ex.published ? '<span class="examgr-pub-badge">✅ Published</span>' : ""}
            </div>
            ${ex.className ? `<span class="examgr-card-class">Class: ${escHtml(ex.className)}</span>` : ""}
            <div class="examgr-card-stats">
              <span>📝 ${Number(ex.questions) || 0}Q</span>
              <span>📚 ${Number(ex.sets) || 1} set${(Number(ex.sets) || 1) > 1 ? "s" : ""}</span>
              <span>👥 ${scanned}/${students} scanned</span>
            </div>
          </div>
        </div>
        <button type="button" class="examgr-delete-btn" data-delete="${id}" aria-label="Delete exam" title="Delete">🗑️</button>
      </div>`;
    }).join("");
  }

  $id("examgr-list")?.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-delete]");
    if (delBtn) { deleteExamManagerExam(delBtn.dataset.delete); return; }
    const openEl = e.target.closest("[data-open]");
    if (openEl) examgrOpenDetails(openEl.dataset.open);
  });

  $id("examgr-sort-btn")?.addEventListener("click", () => {
    examMgrSortDesc = !examMgrSortDesc;
    $id("examgr-sort-btn").textContent = examMgrSortDesc ? "⇅ Newest first" : "⇅ Oldest first";
    renderExamMgrList();
  });

  // ────────────────────────────────────────────────────────────────
  // Add New Exam
  // ────────────────────────────────────────────────────────────────
  function examgrOpenAdd() {
    $id("examgr-add-name").value = "";
    $id("examgr-add-class").value = "";
    $id("examgr-add-date").value = currentIsoDate();
    $id("examgr-add-questions").value = "100";
    $id("examgr-add-sets").value = "1";
    $id("examgr-add-students").value = "10";
    if ($id("examgr-add-roll-digits")) $id("examgr-add-roll-digits").value = "2";
    $id("examgr-add-overlay")?.classList.remove("hidden");
    $id("examgr-add-name")?.focus();
  }
  window.examgrOpenAdd = examgrOpenAdd;

  function examgrCloseAdd() {
    $id("examgr-add-overlay")?.classList.add("hidden");
  }
  window.examgrCloseAdd = examgrCloseAdd;

  $id("examgr-add-save-btn")?.addEventListener("click", async () => {
    const examName = ($id("examgr-add-name").value || "").trim();
    const className = ($id("examgr-add-class").value || "").trim();
    const date = $id("examgr-add-date").value || currentIsoDate();
    let questions = parseInt($id("examgr-add-questions").value, 10) || 0;
    let sets = parseInt($id("examgr-add-sets").value, 10) || 1;
    let students = parseInt($id("examgr-add-students").value, 10) || 0;
    let rollDigits = parseInt($id("examgr-add-roll-digits")?.value, 10) || 2;

    if (!examName) { alert("Exam ka naam likhein."); return; }
    questions = Math.max(1, Math.min(MAX_QUESTIONS, questions));
    sets = Math.max(1, Math.min(SET_LETTERS.length, sets));
    students = Math.max(0, students);
    rollDigits = Math.max(1, Math.min(5, rollDigits));

    const btn = $id("examgr-add-save-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Save ho raha hai...";
    const id = await createExamManagerExam({ examName, className, date, questions, sets, students, rollDigits });
    btn.disabled = false;
    btn.textContent = originalLabel;

    if (id) {
      examgrCloseAdd();
      renderExamMgrList();
      examgrOpenDetails(id);
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Exam Details sheet
  // ────────────────────────────────────────────────────────────────
  function examgrOpenDetails(id) {
    if (!examMgrExams[id]) return;
    examMgrSelectedId = id;
    examgrShowNotice("");
    renderExamMgrDetails();
    $id("examgr-details-overlay")?.classList.remove("hidden");
  }

  function renderExamMgrDetails() {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    const d = fmtDateBadge(ex.date);
    $id("examgr-d-month").textContent = d.month;
    $id("examgr-d-day").textContent = d.day;
    $id("examgr-d-name").textContent = ex.examName || "Untitled Exam";
    $id("examgr-d-class").textContent = ex.className ? `Class: ${ex.className}` : (ex.date || "");
    const scanned = Number(ex.scanned) || 0;
    const students = Number(ex.students) || 0;
    $id("examgr-d-scanned-text").textContent = `${scanned}/${students} sheets scanned`;
    const pct = students > 0 ? Math.min(100, Math.round((scanned / students) * 100)) : 0;
    $id("examgr-d-progress").style.width = pct + "%";
    $id("examgr-d-questions").textContent = Number(ex.questions) || 0;
    $id("examgr-d-sets").textContent = Number(ex.sets) || 1;
  }

  function examgrCloseDetails(skipRefresh) {
    $id("examgr-details-overlay")?.classList.add("hidden");
    examgrShowNotice("");
    if (!skipRefresh) renderExamMgrList();
  }
  window.examgrCloseDetails = examgrCloseDetails;

  let examgrNoticeTimer = null;

  // ── Reports: full-screen detail for one scanned sheet ──
  let examgrReportResults = [];    // current exam's results, sorted (mirrors the list) — index = rank - 1
  let examgrReportDetailIndex = -1;
  function examgrShowNotice(msg) {
    const el = $id("examgr-d-notice");
    if (!el) return;
    clearTimeout(examgrNoticeTimer);
    if (!msg) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  $id("examgr-delete-btn")?.addEventListener("click", () => {
    if (examMgrSelectedId) deleteExamManagerExam(examMgrSelectedId);
  });

  document.querySelectorAll("#examgr-details-overlay [data-action]").forEach(btn => {
    btn.addEventListener("click", () => handleExamMgrAction(btn.dataset.action));
  });

  function handleExamMgrAction(action) {
    const id = examMgrSelectedId;
    const ex = examMgrExams[id];
    if (!ex) return;

    if (action === "answer-key") {
      examgrOpenAnswerKey();
    } else if (action === "scan-sheet") {
      examgrOpenScanner();
    } else if (action === "omr-sheet") {
      examgrOpenOmrSheet();
    } else if (action === "exam-settings") {
      const val = window.prompt("Is exam mein kitne questions hain? (max 100)", String(ex.questions || 0));
      if (val === null) return;
      const n = parseInt(val, 10);
      if (!Number.isInteger(n) || n < 1) { examgrShowNotice("⚠️ Sahi number bharein (1-100)."); return; }
      const setsVal = window.prompt(`Kitne Sets hain? (A–E, max ${SET_LETTERS.length})`, String(ex.sets || 1));
      if (setsVal === null) return;
      const setsN = parseInt(setsVal, 10);
      if (!Number.isInteger(setsN) || setsN < 1 || setsN > SET_LETTERS.length) { examgrShowNotice(`⚠️ Sahi number bharein (1-${SET_LETTERS.length}).`); return; }
      const rollVal = window.prompt("Roll No sheet par kitne digit ke bubble columns hon? (1-5)", String(ex.rollDigits || 2));
      if (rollVal === null) return;
      const rollN = parseInt(rollVal, 10);
      if (!Number.isInteger(rollN) || rollN < 1 || rollN > 5) { examgrShowNotice("⚠️ Sahi number bharein (1-5)."); return; }
      updateExamManagerExam(id, { questions: Math.min(MAX_QUESTIONS, n), sets: setsN, rollDigits: rollN }).then(ok => {
        if (ok) { renderExamMgrDetails(); renderExamMgrList(); examgrShowNotice("✅ Settings save ho gayi. (Roll No/Sets badalne ke baad OMR/Bubble Sheet dobara print karein.)"); }
      });
    } else if (action === "web-features") {
      const val = window.prompt("Is exam ke liye web link daalein:", ex.webLink || "");
      if (val === null) return;
      updateExamManagerExam(id, { webLink: val.trim() }).then(ok => { if (ok) examgrShowNotice("✅ Web link save ho gaya."); });
    } else if (action === "view-reports") {
      examgrOpenReports();
    } else if (action === "download-excel") {
      examgrDownloadCsv(ex);
    } else if (action === "analysis") {
      examgrOpenAnalysis();
    } else if (action === "publish") {
      updateExamManagerExam(id, { published: true }).then(ok => { if (ok) { renderExamMgrDetails(); examgrShowNotice("🚀 Exam publish ho gaya."); } });
    } else if (action === "absentees") {
      const val = window.prompt("Absent students ke naam, comma se separate karke likhein:", ex.absentees || "");
      if (val === null) return;
      updateExamManagerExam(id, { absentees: val.trim() }).then(ok => { if (ok) examgrShowNotice("✅ Absentees save ho gaye."); });
    }
  }

  function examgrDownloadCsv(ex) {
    const rows = [
      ["Exam Name", "Class", "Date", "Questions", "Sets", "Scanned", "Students", "Absentees", "Published"],
      [ex.examName || "", ex.className || "", ex.date || "", ex.questions || 0, ex.sets || 1, ex.scanned || 0, ex.students || 0, ex.absentees || "", ex.published ? "Yes" : "No"]
    ];
    const results = Array.isArray(ex.results) ? ex.results.slice() : [];
    if (results.length) {
      results.sort((a, b) => (Number(b.marks) || 0) - (Number(a.marks) || 0));
      rows.push([]);
      const qCount = Math.max(1, Math.min(MAX_QUESTIONS, Number(ex.questions) || 0));
      const qHeaders = Array.from({ length: qCount }, (_, i) => `Q${i + 1}`);
      rows.push(["Roll No", "Set", "Marks", "Correct", "Wrong", "Blank", "Scanned At", ...qHeaders]);
      results.forEach(r => {
        const ans = Array.isArray(r.answers) ? r.answers : [];
        const answerCells = Array.from({ length: qCount }, (_, i) => (ans[i] == null ? "" : ans[i]));
        rows.push([
          r.roll || "—", r.setLetter || "—", (Number(r.marks) || 0).toFixed(1),
          r.correct || 0, r.wrong || 0, r.blank || 0,
          r.scannedAt ? new Date(r.scannedAt).toLocaleString() : "",
          ...answerCells
        ]);
      });
    }
    const csv = rows.map(r => r.map(csvCell).join(",")).join("\n");
    downloadBlob(csv, "text/csv;charset=utf-8", safeFileName(ex.examName) + (results.length ? "-results.csv" : "-summary.csv"));
  }

  // ────────────────────────────────────────────────────────────────
  // Answer Key (manual bubble entry) — one key per Set (A–E). Single-set
  // exams just always use Set "A", and that key doubles up as the legacy
  // "answerKey" field so older saved exams keep working unchanged.
  // ────────────────────────────────────────────────────────────────
  function examgrGetAnswerKeyArray(ex, setLetter) {
    const count = Math.max(1, Math.min(MAX_QUESTIONS, Number(ex.questions) || MAX_QUESTIONS));
    const fromSets = ex.answerKeys && Array.isArray(ex.answerKeys[setLetter]) ? ex.answerKeys[setLetter] : null;
    // Fall back to the legacy single key for Set A (or if no per-set key saved yet)
    const saved = fromSets || ((setLetter === "A" || !fromSets) && Array.isArray(ex.answerKey) ? ex.answerKey : []) || [];
    const arr = new Array(count).fill(null);
    for (let i = 0; i < count; i++) {
      const val = saved[i];
      if (OPTION_LETTERS.includes(val)) arr[i] = val;
    }
    return arr;
  }

  // Resolve the answer key that should actually be used for grading a
  // scanned sheet whose Exam Set bubble came out as `setLetter` (may be
  // null if that bubble wasn't marked/detected).
  function examgrResolveAnswerKeyForGrading(ex, setLetter) {
    if (setLetter && ex.answerKeys && Array.isArray(ex.answerKeys[setLetter]) && ex.answerKeys[setLetter].some(v => v)) {
      return examgrGetAnswerKeyArray(ex, setLetter);
    }
    // No usable per-set key for the detected set (or no set detected) —
    // fall back to Set A / the legacy single key, which is what a
    // single-set exam always uses.
    return examgrGetAnswerKeyArray(ex, "A");
  }

  function examgrRenderAnswerKeyTabs(ex) {
    const wrap = $id("examgr-akey-tabs");
    if (!wrap) return;
    const setsCount = Math.max(1, Math.min(SET_LETTERS.length, Number(ex.sets) || 1));
    if (setsCount <= 1) { wrap.innerHTML = ""; wrap.hidden = true; return; }
    wrap.hidden = false;
    wrap.innerHTML = SET_LETTERS.slice(0, setsCount).map(letter =>
      `<button type="button" class="examgr-akey-tab${akeySelectedSet === letter ? " selected" : ""}" data-set="${letter}">Set ${letter}</button>`
    ).join("");
  }

  function examgrRenderAnswerKeyList() {
    const listEl = $id("examgr-akey-list");
    if (!listEl) return;
    listEl.innerHTML = akeyDraft.map((val, i) => {
      const opts = OPTION_LETTERS.map(letter =>
        `<button type="button" class="examgr-akey-opt${val === letter ? " selected" : ""}" data-q="${i}" data-letter="${letter}" aria-pressed="${val === letter}">${letter}</button>`
      ).join("");
      return `<div class="examgr-akey-row"><span class="examgr-akey-qnum">${i + 1}</span>${opts}</div>`;
    }).join("");
  }

  function examgrHasUnsavedAkeyChanges() {
    return akeyDraft.some((v, i) => v !== akeyOriginal[i]);
  }

  function examgrLoadAnswerKeyForSet(setLetter) {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    akeySelectedSet = setLetter;
    akeyDraft = examgrGetAnswerKeyArray(ex, setLetter);
    akeyOriginal = akeyDraft.slice();
    const sub = $id("examgr-akey-sub");
    const setsCount = Math.max(1, Math.min(SET_LETTERS.length, Number(ex.sets) || 1));
    if (sub) sub.textContent = `${ex.examName || "Exam"}${setsCount > 1 ? " — Set " + setLetter : ""} — ${akeyDraft.length} questions. Sahi option par click karein.`;
    examgrRenderAnswerKeyTabs(ex);
    examgrRenderAnswerKeyList();
  }

  function examgrOpenAnswerKey() {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    examgrLoadAnswerKeyForSet("A");
    $id("examgr-details-overlay")?.classList.add("hidden");
    $id("examgr-akey-overlay")?.classList.remove("hidden");
  }

  function examgrCloseAnswerKey(force) {
    if (!force && examgrHasUnsavedAkeyChanges()) {
      if (!confirm("Answer key mein kiye gaye changes save nahi hue hain. Discard karke wapas jaayein?")) return;
    }
    $id("examgr-akey-overlay")?.classList.add("hidden");
    $id("examgr-details-overlay")?.classList.remove("hidden");
  }
  window.examgrCloseAnswerKey = examgrCloseAnswerKey;

  $id("examgr-akey-tabs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-set]");
    if (!btn) return;
    if (examgrHasUnsavedAkeyChanges()) {
      if (!confirm(`Set ${akeySelectedSet} ke changes save nahi hue. Discard karke Set ${btn.dataset.set} par jaayein?`)) return;
    }
    examgrLoadAnswerKeyForSet(btn.dataset.set);
  });

  $id("examgr-akey-reset-btn")?.addEventListener("click", () => {
    akeyDraft = akeyDraft.map(() => null);
    examgrRenderAnswerKeyList();
  });

  $id("examgr-akey-save-btn")?.addEventListener("click", async () => {
    const id = examMgrSelectedId;
    const ex = examMgrExams[id];
    if (!id || !ex) return;
    const btn = $id("examgr-akey-save-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Save ho raha hai...";
    const answerKeys = { ...(ex.answerKeys || {}), [akeySelectedSet]: akeyDraft.slice() };
    const patch = { answerKeys };
    // Keep the legacy single-key field mirrored to Set A so older code
    // paths (and the "no set detected" grading fallback) keep working.
    if (akeySelectedSet === "A") patch.answerKey = akeyDraft.slice();
    const ok = await updateExamManagerExam(id, patch);
    btn.disabled = false;
    btn.textContent = originalLabel;
    if (ok) {
      akeyOriginal = akeyDraft.slice();
      examgrCloseAnswerKey(true);
      examgrShowNotice(`✅ Set ${akeySelectedSet} ki Answer Key saved.`);
    }
  });

  $id("examgr-akey-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".examgr-akey-opt");
    if (!btn) return;
    const q = Number(btn.dataset.q);
    const letter = btn.dataset.letter;
    const newVal = akeyDraft[q] === letter ? null : letter;
    akeyDraft[q] = newVal;
    const row = btn.closest(".examgr-akey-row");
    row.querySelectorAll(".examgr-akey-opt").forEach(optBtn => {
      const isSelected = optBtn.dataset.letter === newVal;
      optBtn.classList.toggle("selected", isSelected);
      optBtn.setAttribute("aria-pressed", String(isSelected));
    });
  });

  // ────────────────────────────────────────────────────────────────
  // OMR / Bubble Sheet — fixed 100-question / 5-column printable layout
  // (geometry matches the physical sheet used for "Scan Sheet" corner
  // detection below, so a printed copy lines up correctly)
  // ────────────────────────────────────────────────────────────────
  const OMR_CANVAS_SIZE = { width: 1203, height: 1536 };
  const OMR_MARKER_XS = [105, 345, 585, 825, 1065];
  const OMR_MARKER_YS = [195, 345, 495, 645, 795, 945, 1095, 1245, 1395];

  // Exam Set (A–E) bubble row — sits in the gap between the header box
  // (ends y=141) and the Roll No block (starts y=199). Registered here
  // (not just drawn) so the scanner can read back which bubble got
  // marked, the same way question/roll bubbles are registered below.
  const EXAM_SET_Y = { label: 150, header: 168, bubble: 186 };
  const EXAM_SET_CENTERS = [167, 201, 235, 269, 303];
  const OMR_COLUMN_SPECS = [
    {
      qRight: 164, subjectCenter: 235, subjectTop: 558, sectionTop: 589,
      optionCenters: [190, 220, 250, 280, 310],
      groups: [
        { headerY: 620, rowStart: 655, count: 5 },
        { headerY: 800, rowStart: 835, count: 5 },
        { headerY: 980, rowStart: 1015, count: 5 },
        { headerY: 1160, rowStart: 1195, count: 8 }
      ]
    },
    {
      qRight: 404, optionCenters: [430, 460, 490, 520, 550],
      groups: [
        { headerY: 200, rowStart: 235, count: 7 },
        { headerY: 440, rowStart: 475, count: 5 },
        { headerY: 620, rowStart: 655, count: 5 },
        { headerY: 800, rowStart: 835, count: 5 },
        { headerY: 980, rowStart: 1015, count: 5 },
        { headerY: 1160, rowStart: 1195, count: 8 }
      ]
    },
    {
      qRight: 644, optionCenters: [670, 700, 730, 760, 790],
      groups: [
        { headerY: 200, rowStart: 235, count: 7 },
        { headerY: 440, rowStart: 475, count: 5 },
        { headerY: 620, rowStart: 655, count: 5 },
        { headerY: 800, rowStart: 835, count: 5 },
        { headerY: 980, rowStart: 1015, count: 5 },
        { headerY: 1160, rowStart: 1195, count: 8 }
      ]
    },
    {
      qRight: 884, optionCenters: [910, 940, 970, 1000, 1030],
      groups: [{ headerY: 200, rowStart: 235, count: 7 }]
    }
  ];
  // 4 outer-corner registration squares the scanner looks for while
  // collecting sheets (matches OMR_MARKER_XS/YS's outer ring, refined
  // slightly from the precomputed PDF-vector calibration).
  const OMR_SCAN_MARKERS = {
    "top-left": { x: 116.26, y: 207.16 },
    "top-right": { x: 1086.74, y: 207.16 },
    "bottom-left": { x: 116.26, y: 1419.79 },
    "bottom-right": { x: 1086.74, y: 1419.79 }
  };

  const egPx = v => `${v.toFixed(3)}px`;
  function egBoxStyle(l, t, w, h) { return `left:${egPx(l)};top:${egPx(t)};width:${egPx(w)};height:${egPx(h)};`; }
  function egTextStyle(l, t, w, extra) { return `left:${egPx(l)};top:${egPx(t)};${w == null ? "" : `width:${egPx(w)};`}${extra || ""}`; }

  function egCenterText(text, centerX, top, width) {
    const half = width == null ? 0 : width / 2;
    const transform = width == null ? "transform:translateX(-50%);" : "text-align:center;transform:none;";
    return `<div class="examgr-omr-text examgr-omr-center" style="${egTextStyle(centerX - half, top, width, transform)}">${escHtml(text)}</div>`;
  }
  function egRightText(text, right, top, width) {
    width = width || 48;
    return `<div class="examgr-omr-text" style="${egTextStyle(right - width, top, width, "text-align:right;")}">${escHtml(String(text))}</div>`;
  }
  function egSmallCenterText(text, centerX, top) {
    return `<div class="examgr-omr-text examgr-omr-center examgr-omr-small" style="${egTextStyle(centerX, top, null, "transform:translateX(-50%);")}">${escHtml(text)}</div>`;
  }
  function egBubble(cx, cy) {
    return `<span class="examgr-omr-bubble" style="${egBoxStyle(cx - 11, cy - 11, 22, 22)}"></span>`;
  }
  function egMarkers() {
    return OMR_MARKER_YS.map(y => OMR_MARKER_XS.map(x => `<span class="examgr-omr-marker" style="${egBoxStyle(x, y, 20, 20)}"></span>`).join("")).join("");
  }
  function egHeader(ex) {
    const examText = `EXAM : ${ex.examName || ""}`;
    const dateClassText = `DATE : ${ex.date || ""}     CLASS : ${ex.className || ""}`;
    return `<div class="examgr-omr-header-box" style="${egBoxStyle(99, 49, 992, 92)}">
      <div class="examgr-omr-header-line" style="top:0;height:${egPx(45)};">
        <div class="examgr-omr-header-cell">NAME :</div>
        <div class="examgr-omr-header-cell">${escHtml(examText)}</div>
      </div>
      <div class="examgr-omr-header-line" style="top:${egPx(45)};height:${egPx(47)};">
        <div class="examgr-omr-header-cell">${escHtml(dateClassText)}</div>
      </div>
    </div>`;
  }
  function egRollBlock(rollDigitsCount) {
    const rollDigits = Math.max(1, Math.min(5, Number(rollDigitsCount) || 5));
    const rollCenters = [190, 220, 250, 280, 310].slice(0, rollDigits);
    let html = egCenterText("Roll No", 250, 199, 100);
    for (let i = 0; i < rollDigits; i++) {
      html += `<span class="examgr-omr-roll-digit" style="${egBoxStyle(175 + i * 30, 220, 30, 30)}"></span>`;
    }
    for (let d = 0; d <= 9; d++) {
      const cy = 265 + d * 30;
      html += egRightText(d, 166, cy - 9, 32);
      html += rollCenters.map(cx => egBubble(cx, cy)).join("");
    }
    return html;
  }

  // "Exam Set" A–E row — one bubble per set letter, read back after
  // scanning to know which Set's Answer Key to grade this sheet against.
  // Always prints all 5 (even for a 1-set exam) so a printed sheet never
  // goes stale if Settings later raises the Set count.
  function egExamSetBlock() {
    let html = egCenterText("Exam Set", 235, EXAM_SET_Y.label, 180);
    html += SET_LETTERS.map((letter, i) => egSmallCenterText(letter, EXAM_SET_CENTERS[i], EXAM_SET_Y.header)).join("");
    html += EXAM_SET_CENTERS.map(cx => egBubble(cx, EXAM_SET_Y.bubble)).join("");
    return html;
  }
  function egOptionHeader(col, headerY) {
    return OPTION_LETTERS.map((label, i) => egSmallCenterText(label, col.optionCenters[i], headerY)).join("");
  }
  function egQuestionRow(col, centerY, qNumber) {
    return egRightText(qNumber, col.qRight, centerY - 9, 52) +
      OPTION_LETTERS.map((_, i) => egBubble(col.optionCenters[i], centerY)).join("");
  }

  function examgrBuildSheetHtml(ex) {
    const total = Math.max(1, Math.min(MAX_QUESTIONS, Number(ex.questions) || MAX_QUESTIONS));
    let itemIndex = 0;
    let html = egHeader(ex) + egMarkers() + egExamSetBlock() + egRollBlock(ex.rollDigits);
    html += egCenterText(ex.examName || "Exam", OMR_COLUMN_SPECS[0].subjectCenter, OMR_COLUMN_SPECS[0].subjectTop, 150);
    html += egCenterText(ex.className || "", OMR_COLUMN_SPECS[0].subjectCenter, OMR_COLUMN_SPECS[0].sectionTop, 150);
    OMR_COLUMN_SPECS.forEach(col => {
      col.groups.forEach(group => {
        if (itemIndex >= total) return;
        html += egOptionHeader(col, group.headerY);
        for (let r = 0; r < group.count && itemIndex < total; r++) {
          const cy = group.rowStart + r * 30;
          html += egQuestionRow(col, cy, itemIndex + 1);
          itemIndex++;
        }
      });
    });
    return `<div class="examgr-omr-sheet" style="width:${OMR_CANVAS_SIZE.width}px;height:${OMR_CANVAS_SIZE.height}px;">${html}</div>`;
  }

  const EXAMGR_SHEET_CSS = `
.examgr-omr-sheet{position:relative;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;overflow:hidden;}
.examgr-omr-sheet *{box-sizing:border-box;}
.examgr-omr-sheet,.examgr-omr-sheet *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.examgr-omr-header-box{position:absolute;border:1.6px solid #333;color:#000;background:#fff;}
.examgr-omr-header-line{position:absolute;left:0;right:0;display:flex;border-bottom:1.6px solid #333;}
.examgr-omr-header-line:last-child{border-bottom:none;}
.examgr-omr-header-cell{flex:1;padding:11px 10px 0;font-size:24px;line-height:1;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.examgr-omr-header-cell + .examgr-omr-header-cell{border-left:1.6px solid #333;}
.examgr-omr-marker{position:absolute;width:20px;height:20px;background:#000;border:1px solid #000;}
.examgr-omr-text{position:absolute;color:#111;font-size:18px;line-height:1;font-weight:400;white-space:nowrap;}
.examgr-omr-small{font-size:17px;}
.examgr-omr-center{text-align:center;transform:translateX(-50%);}
.examgr-omr-roll-digit{position:absolute;width:30px;height:30px;border:2px solid #333;background:#fff;}
.examgr-omr-bubble{position:absolute;width:22px;height:22px;border:1.7px solid #222;border-radius:50%;background:#fff;}`;

  function examgrOpenOmrSheet() {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    const preview = $id("examgr-sheet-preview");
    if (preview) preview.innerHTML = examgrBuildSheetHtml(ex);
    $id("examgr-details-overlay")?.classList.add("hidden");
    $id("examgr-sheet-overlay")?.classList.remove("hidden");
  }

  function examgrCloseOmrSheet() {
    $id("examgr-sheet-overlay")?.classList.add("hidden");
    $id("examgr-details-overlay")?.classList.remove("hidden");
  }
  window.examgrCloseOmrSheet = examgrCloseOmrSheet;

  /* ── OMR Sheet → JPG image (canvas, no html2canvas) ────────────────
     Draws the sheet directly onto a <canvas> using the exact same px
     coordinates (OMR_CANVAS_SIZE / OMR_MARKER_XS/YS / EXAM_SET_Y /
     OMR_COLUMN_SPECS) that examgrBuildSheetHtml() and the scanner's
     calibration both already use — no html2canvas rasterization step
     (that pipeline was unreliable on mobile, see notes above), so
     nothing can render blank/partial. Rendered at 2x resolution so the
     downloaded JPG stays crisp enough to print or read on a phone. ──*/

  const OMR_JPG_SCALE = 2;

  function examgrBuildSheetCanvas(ex) {
    const S = OMR_JPG_SCALE;
    const px = v => v * S;
    const canvas = document.createElement("canvas");
    canvas.width = px(OMR_CANVAS_SIZE.width);
    canvas.height = px(OMR_CANVAS_SIZE.height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Alphabetic baseline (same as jsPDF's doc.text default) so the
    // y-coordinate below is where the text SITS, not its top edge —
    // matching the already-tuned "+3 / +8 / +9" baseline offsets used
    // by the old PDF exporter. Using textBaseline:"top" here previously
    // made every label render lower than intended, which is what made
    // the tightly-spaced "Exam Set" letters visually collide with the
    // bubbles right below them.
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000";

    function bubble(cx, cy) {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = px(1.7);
      ctx.beginPath();
      ctx.arc(px(cx), px(cy), px(11), 0, Math.PI * 2);
      ctx.stroke();
    }
    function centerText(text, centerX, baselineY, font) {
      ctx.textAlign = "center";
      ctx.font = font;
      ctx.fillText(String(text), px(centerX), px(baselineY));
    }
    function rightText(text, right, baselineY, font) {
      ctx.textAlign = "right";
      ctx.font = font;
      ctx.fillText(String(text), px(right), px(baselineY));
    }
    function leftText(text, left, baselineY, font) {
      ctx.textAlign = "left";
      ctx.font = font;
      ctx.fillText(String(text), px(left), px(baselineY));
    }

    // Title
    centerText("SAVYASACHI COACHING — OMR ANSWER SHEET", OMR_CANVAS_SIZE.width / 2, 30, `bold ${px(24)}px Arial, sans-serif`);

    // Corner-registration markers
    ctx.fillStyle = "#000";
    OMR_MARKER_YS.forEach(y => OMR_MARKER_XS.forEach(x => {
      ctx.fillRect(px(x), px(y), px(20), px(20));
    }));

    // Header box: NAME / EXAM row + DATE/CLASS row
    ctx.strokeStyle = "#333";
    ctx.lineWidth = px(1.6);
    ctx.strokeRect(px(99), px(49), px(992), px(92));
    ctx.beginPath(); ctx.moveTo(px(99), px(94)); ctx.lineTo(px(1091), px(94)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(595), px(49)); ctx.lineTo(px(595), px(94)); ctx.stroke();
    ctx.fillStyle = "#000";
    leftText("NAME :", 110, 78, `${px(15)}px Arial, sans-serif`);
    leftText(`EXAM : ${ex.examName || ""}`, 605, 78, `${px(15)}px Arial, sans-serif`);
    leftText(`DATE : ${ex.date || ""}     CLASS : ${ex.className || ""}`, 110, 123, `${px(15)}px Arial, sans-serif`);

    // Exam Set (A–E) row
    centerText("Exam Set", 235, EXAM_SET_Y.label + 8, `${px(14)}px Arial, sans-serif`);
    SET_LETTERS.forEach((letter, i) => centerText(letter, EXAM_SET_CENTERS[i], EXAM_SET_Y.header + 3, `${px(12)}px Arial, sans-serif`));
    EXAM_SET_CENTERS.forEach(cx => bubble(cx, EXAM_SET_Y.bubble));

    // Roll No block
    const rollDigits = Math.max(1, Math.min(5, Number(ex.rollDigits) || 5));
    const rollCenters = [190, 220, 250, 280, 310].slice(0, rollDigits);
    centerText("Roll No", 250, 208, `${px(14)}px Arial, sans-serif`);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = px(2);
    for (let i = 0; i < rollDigits; i++) {
      ctx.strokeRect(px(175 + i * 30), px(220), px(30), px(30));
    }
    for (let d = 0; d <= 9; d++) {
      const cy = 265 + d * 30;
      rightText(d, 166, cy + 3, `${px(13)}px Arial, sans-serif`);
      rollCenters.forEach(cx => bubble(cx, cy));
    }

    // Exam name / class under column 0
    centerText(ex.examName || "Exam", OMR_COLUMN_SPECS[0].subjectCenter, OMR_COLUMN_SPECS[0].subjectTop + 8, `${px(13)}px Arial, sans-serif`);
    centerText(ex.className || "", OMR_COLUMN_SPECS[0].subjectCenter, OMR_COLUMN_SPECS[0].sectionTop + 8, `${px(13)}px Arial, sans-serif`);

    // Question grid
    const total = Math.max(1, Math.min(MAX_QUESTIONS, Number(ex.questions) || MAX_QUESTIONS));
    let itemIndex = 0;
    OMR_COLUMN_SPECS.forEach(col => {
      col.groups.forEach(group => {
        if (itemIndex >= total) return;
        OPTION_LETTERS.forEach((label, i) => centerText(label, col.optionCenters[i], group.headerY + 3, `${px(12)}px Arial, sans-serif`));
        for (let r = 0; r < group.count && itemIndex < total; r++) {
          const cy = group.rowStart + r * 30;
          itemIndex++;
          rightText(itemIndex, col.qRight, cy + 3, `${px(14)}px Arial, sans-serif`);
          OPTION_LETTERS.forEach((_, i) => bubble(col.optionCenters[i], cy));
        }
      });
    });

    return canvas;
  }

  $id("examgr-sheet-jpg-btn")?.addEventListener("click", () => {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    const btn = $id("examgr-sheet-jpg-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ JPG Bana Rahe Hain...";
    try {
      const canvas = examgrBuildSheetCanvas(ex);
      canvas.toBlob(blob => {
        btn.disabled = false;
        btn.textContent = originalLabel;
        if (!blob) { alert("JPG banane mein dikkat aayi."); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = safeFileName(ex.examName || "omr") + "-omr-sheet.jpg";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/jpeg", 0.95);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = originalLabel;
      alert("JPG banane mein dikkat aayi: " + (err && err.message ? err.message : err));
    }
  });

  // ────────────────────────────────────────────────────────────────
  // GRADING ENGINE — reads bubbles off a captured, corner-aligned photo
  // (a canvas already sized/warped to exactly OMR_CANVAS_SIZE, the same
  // coordinate space egRollBlock/egExamSetBlock/OMR_COLUMN_SPECS print
  // into) and scores it against the exam's Answer Key. Self-contained —
  // does not depend on omr.js — but uses the same proven approach as
  // that module's pixel-darkness scanner: convert to grayscale, estimate
  // the sheet's OWN local paper-white level (so unfilled bubbles read as
  // "blank" even under a shadow/warm light), and call a bubble "marked"
  // when it's darker than its local white level by a clear margin.
  // ────────────────────────────────────────────────────────────────
  function egToGrayscale(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return gray;
  }

  // Desaturates a captured photo IN PLACE (R=G=B=luminance) right after
  // capture, before anything else ever reads or displays it. An OMR
  // sheet is pure black/white by design, but phone camera video frames
  // are YUV 4:2:0 under the hood (colour sampled at 1/4 the resolution
  // of brightness) — small, ultra-sharp features like the 20px
  // registration squares are exactly the kind of high-contrast edge
  // that chroma-subsampling smears a stray blue/purple tint onto, even
  // though the paper and printed ink are genuinely neutral black. That
  // shows up as a blue patch on registration squares (and sometimes
  // bubbles) in the saved/reviewed photo — cosmetic only (grading
  // already reads darkness via egToGrayscale, unaffected either way)
  // but it looks like a bug and erodes trust in the scan. Stripping
  // colour from the pristine raw capture once, up front, guarantees the
  // review photo, the saved photo, and every re-paint after Edit are
  // all clean true-grayscale with zero colour cast — the coloured
  // green/red/gold grading dots are painted AFTER this, on top, so they
  // stay fully vivid.
  function egDesaturateCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = lum;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function egLerp(a, b, t) { return a + (b - a) * t; }

  // ────────────────────────────────────────────────────────────────
  // PERSPECTIVE CORRECTION (homography)
  //
  // A hand-held phone is almost never held perfectly parallel to the
  // sheet. Even a small tilt makes one edge of the paper sit further from
  // the camera than the other ("keystoning"), so the 4 printed corner
  // markers form a skewed quadrilateral in the video frame — never a
  // clean rectangle. Averaging the 4 corners into one rectangle and doing
  // a single axis-aligned scale/crop (the old approach) is only correct
  // when the phone is dead flat; with any real tilt it quietly shifts
  // every bubble's true pixel position, by an amount that grows with
  // distance from the corners. That's why the same physical sheet could
  // read a different Roll No / miss a different option on every attempt
  // in testing — each hand-held attempt has a slightly different tilt, so
  // a different set of bubbles drifts far enough to fall outside its
  // sampling circle.
  //
  // Fix: solve the full 3×3 projective transform (homography) from the 4
  // marker correspondences, then warp the whole frame through it. This
  // makes every bubble land at (very close to) the exact pixel the print
  // template expects, regardless of camera tilt/rotation/keystone.
  // ────────────────────────────────────────────────────────────────

  // Solves H (3x3, row-major, h[8]=1) such that H·[x,y,1]ᵀ ≈ w·[X,Y,1]ᵀ for
  // 4 point correspondences src_i → dst_i. Straightforward 8-unknown
  // linear system (Gaussian elimination, partial pivoting) — exact for 4
  // non-degenerate points, no least-squares needed.
  function egSolveLinear8(A, b) {
    const n = 8;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) { if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r; }
      if (pivot !== col) { const tmp = M[col]; M[col] = M[pivot]; M[pivot] = tmp; }
      const pv = M[col][col];
      if (Math.abs(pv) < 1e-9) return null; // degenerate marker layout — caller falls back
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

  function egApplyHomography(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
  }

  // Warps sourceCanvas onto a new dstSize canvas using the homography
  // that maps templateQuad → videoQuad (both [top-left, top-right,
  // bottom-left, bottom-right]). Walks the OUTPUT pixel-by-pixel
  // (backward mapping, so there are no holes) and bilinearly samples the
  // source — smooth edges matter here because the darkness sampling
  // downstream is sensitive to jagged/aliased ink edges.
  // Falls back to a plain non-perspective (best-fit affine-ish) copy if
  // the 4 markers are degenerate (near-collinear) so a capture never hard
  // fails just because the homography solve couldn't run.
  function egWarpPerspective(sourceCanvas, videoQuad, templateQuad, dstSize) {
    const sw = sourceCanvas.width, sh = sourceCanvas.height;
    const sctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const srcData = sctx.getImageData(0, 0, sw, sh).data;

    const H = egComputeHomography(templateQuad, videoQuad);
    const out = document.createElement("canvas");
    out.width = dstSize.width; out.height = dstSize.height;
    const octx = out.getContext("2d");

    if (!H) {
      // Degenerate fallback: same simple rectangle scale as before, better
      // than throwing the capture away entirely.
      const left = (videoQuad[0].x + videoQuad[2].x) / 2, right = (videoQuad[1].x + videoQuad[3].x) / 2;
      const top = (videoQuad[0].y + videoQuad[1].y) / 2, bottom = (videoQuad[2].y + videoQuad[3].y) / 2;
      const scaleX = (right - left) / (templateQuad[1].x - templateQuad[0].x);
      const scaleY = (bottom - top) / (templateQuad[2].y - templateQuad[0].y);
      const sx0 = left - templateQuad[0].x * scaleX, sy0 = top - templateQuad[0].y * scaleY;
      octx.drawImage(sourceCanvas, sx0, sy0, dstSize.width * scaleX, dstSize.height * scaleY, 0, 0, dstSize.width, dstSize.height);
      return out;
    }

    // Homography math inlined (not via egApplyHomography) and no
    // per-pixel object allocation — this loop runs ~1.85M times for a
    // full-resolution sheet, and avoiding GC churn here keeps a single
    // capture's processing pause well under a second on a mid-range phone.
    const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;
    const outImg = octx.createImageData(dstSize.width, dstSize.height);
    const outData = outImg.data;
    let di = 0;
    for (let Y = 0; Y < dstSize.height; Y++) {
      for (let X = 0; X < dstSize.width; X++, di += 4) {
        const wDen = h6 * X + h7 * Y + h8;
        const sx = (h0 * X + h1 * Y + h2) / wDen;
        const sy = (h3 * X + h4 * Y + h5) / wDen;
        if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
          outData[di] = outData[di + 1] = outData[di + 2] = 255; outData[di + 3] = 255;
          continue;
        }
        const x0 = sx | 0, y0 = sy | 0;
        const fx = sx - x0, fy = sy - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4;
        const i01 = i00 + sw * 4, i11 = i01 + 4;
        const ifx = 1 - fx, ify = 1 - fy;
        outData[di]     = (srcData[i00]     * ifx + srcData[i10]     * fx) * ify + (srcData[i01]     * ifx + srcData[i11]     * fx) * fy;
        outData[di + 1] = (srcData[i00 + 1] * ifx + srcData[i10 + 1] * fx) * ify + (srcData[i01 + 1] * ifx + srcData[i11 + 1] * fx) * fy;
        outData[di + 2] = (srcData[i00 + 2] * ifx + srcData[i10 + 2] * fx) * ify + (srcData[i01 + 2] * ifx + srcData[i11 + 2] * fx) * fy;
        outData[di + 3] = 255;
      }
    }
    octx.putImageData(outImg, 0, 0);
    return out;
  }

  // Coarse grid of LOCAL white levels across the photo (handles a shadow
  // or angled light making one side of the sheet darker than the other),
  // bilinear-interpolated so any bubble can look up its own nearby
  // paper-white value instead of one number for the whole sheet.
  //
  // excludePoints (optional): every registered bubble centre. WHY: the
  // old version estimated "paper white" straight from raw pixels with no
  // idea where bubbles are. A bin that happens to contain several bold or
  // enlarged filled bubbles close together (e.g. Exam Set + Roll No +
  // Q1-4, which all sit in the same top-left bin on this layout) feeds
  // its own extra dark pixels into its OWN white estimate, pulling that
  // bin's "white" down. Every bubble judged against that bin then reads
  // less dark than it really is — and the biggest, boldest mark in the
  // bin contributes the most extra dark pixels, so it's the one most
  // likely to sabotage its own reference and get read as blank. Skipping
  // a small disk around every known bubble centre while building the
  // percentile keeps the estimate anchored to actual blank paper,
  // independent of how big or dark any one mark is.
  function egWhiteLevelField(gray, w, h, binsX, binsY, excludePoints, excludeRadius) {
    binsX = binsX || 5; binsY = binsY || 7;
    excludePoints = excludePoints || [];
    excludeRadius = excludeRadius || 0;
    const exR2 = excludeRadius * excludeRadius;
    const field = [];
    const binW = Math.ceil(w / binsX), binH = Math.ceil(h / binsY);
    for (let by = 0; by < binsY; by++) {
      const row = [];
      for (let bx = 0; bx < binsX; bx++) {
        const x0 = bx * binW, x1 = Math.min(w, x0 + binW);
        const y0 = by * binH, y1 = Math.min(h, y0 + binH);
        // Only the bubbles that could possibly fall in (or near) THIS bin
        // need checking per sample — keeps this from being an O(samples ×
        // all bubbles) scan on a sheet with hundreds of bubbles.
        const localExcludes = excludePoints.length ? excludePoints.filter(p =>
          p.x >= x0 - excludeRadius && p.x <= x1 + excludeRadius &&
          p.y >= y0 - excludeRadius && p.y <= y1 + excludeRadius
        ) : [];
        const samples = [];
        for (let y = y0; y < y1; y += 3) {
          for (let x = x0; x < x1; x += 3) {
            if (localExcludes.length) {
              let skip = false;
              for (let i = 0; i < localExcludes.length; i++) {
                const dx = x - localExcludes[i].x, dy = y - localExcludes[i].y;
                if (dx * dx + dy * dy <= exR2) { skip = true; break; }
              }
              if (skip) continue;
            }
            samples.push(gray[y * w + x]);
          }
        }
        samples.sort((a, b) => a - b);
        row.push(samples.length ? samples[Math.floor(samples.length * 0.85)] : 200);
      }
      field.push(row);
    }
    return {
      at(x, y) {
        const fx = Math.min(binsX - 1, Math.max(0, x / binW - 0.5));
        const fy = Math.min(binsY - 1, Math.max(0, y / binH - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = Math.min(binsX - 1, x0 + 1), y1 = Math.min(binsY - 1, y0 + 1);
        const tx = fx - x0, ty = fy - y0;
        const top = egLerp(field[y0][x0], field[y0][x1], tx);
        const bot = egLerp(field[y1][x0], field[y1][x1], tx);
        return egLerp(top, bot, ty);
      }
    };
  }

  // Robust "how dark is this bubble" measure — takes a PERCENTILE of the
  // sampled disk's pixel values, not the mean. WHY: a plain mean gets
  // diluted the moment the sample circle isn't perfectly centred on the
  // ink (a few pixels of drift is normal even after perspective
  // correction) or when the mark is bigger/bolder than the printed circle
  // and only partially overlaps a small fixed sample disk — exactly the
  // pattern behind bold, clearly-filled bubbles intermittently reading as
  // blank. The 40th percentile is forgiving: as long as roughly 40% of
  // the sampled disk sits on ink, the score reads fully dark, regardless
  // of where the "extra" ink from a bold/oversized mark spills over to.
  // A genuinely blank bubble has ~0% ink in the disk either way, so this
  // doesn't introduce false positives.
  function egSampleFillScore(gray, w, h, cx, cy, radius) {
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

  // Every bubble this sheet layout can have, in the SAME 1203×1536 pixel
  // space the printable sheet is drawn in — single source of truth so
  // printing and reading can never drift apart.
  function examgrBubbleMap(ex) {
    const total = Math.max(1, Math.min(MAX_QUESTIONS, Number(ex.questions) || MAX_QUESTIONS));
    const rollDigits = Math.max(1, Math.min(5, Number(ex.rollDigits) || 2));
    const rollCenters = [190, 220, 250, 280, 310].slice(0, rollDigits);

    const setBubbles = SET_LETTERS.map((letter, i) => ({ letter, x: EXAM_SET_CENTERS[i], y: EXAM_SET_Y.bubble }));

    const rollColumns = rollCenters.map(cx => {
      const digits = [];
      for (let d = 0; d <= 9; d++) digits.push({ digit: d, x: cx, y: 265 + d * 30 });
      return digits;
    });

    const questionBubbles = {}; // qNum -> [{opt:0..3, x, y}]
    let itemIndex = 0;
    OMR_COLUMN_SPECS.forEach(col => {
      col.groups.forEach(group => {
        if (itemIndex >= total) return;
        for (let r = 0; r < group.count && itemIndex < total; r++) {
          const cy = group.rowStart + r * 30;
          itemIndex++;
          questionBubbles[itemIndex] = OPTION_LETTERS.map((_, i) => ({ opt: i, x: col.optionCenters[i], y: cy }));
        }
      });
    });

    return { setBubbles, rollColumns, questionBubbles, totalQuestions: total };
  }

  const EG_MARK_THRESHOLD = 42;   // "dark enough to count as marked", relative to local white
  // Printed bubbles are ~22px wide (radius 11 — see the `doc.circle(...,
  // mmPos(11))` in the PDF export above), spaced 30px apart. Sample
  // radius bumped from the old 8 → 10: close to the true printed radius
  // (more tolerant of a mark that's bigger than the circle, or a few
  // px of residual misalignment) while staying under the 15px half-spacing
  // so it can never bleed into a neighbouring bubble.
  const EG_BUBBLE_RADIUS = 10;
  // v9: a second, TIGHTER sample radius centred on the same bubble. A
  // student who only puts a small dot/tick in the middle of the circle
  // (instead of fully shading it) leaves a mark that's genuinely dark at
  // the centre but covers well under 40% of the wide 10px disk — so the
  // wide sample alone reads it as blank. The narrow disk sees mostly ink
  // in that case, so it clears its own (stricter — see
  // EG_CORE_MARK_THRESHOLD) bar even though the wide sample doesn't.
  const EG_DOT_RADIUS = 5;
  // Stricter than EG_MARK_THRESHOLD on purpose: the narrow disk samples
  // far fewer pixels, so it's more exposed to a single stray fleck/shadow
  // pixel reading dark by chance. Requiring a bigger gap from local white
  // keeps it selective for real ink instead of noise.
  const EG_CORE_MARK_THRESHOLD = 60;
  // v10: a mark that only just clears its threshold (by less than this
  // many darkness-units) gets flagged "low confidence" instead of being
  // shown as an equally-certain read as one that clears it by a mile. No
  // threshold-based system can be literally 100% certain on every mark —
  // this makes the genuinely-close calls visible (a thin orange ring, see
  // examgrPaintOverlay) so they get a human glance during review instead
  // of silently blending in with the confident reads.
  const EG_LOW_CONFIDENCE_MARGIN = 8;
  // How far out to blank a bubble from the white-level reference — a
  // little larger than the sample radius so ink that overflows the
  // printed circle can't leak into its own "paper white" baseline either.
  const EG_WHITE_EXCLUDE_RADIUS = 13;

  // Reads every registered bubble off the captured canvas and returns the
  // raw detection (no right/wrong judgement yet — that's examgrGradeSheet).
  function examgrDetectFromCanvas(canvas, ex) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const gray = egToGrayscale(ctx, w, h);
    const map = examgrBubbleMap(ex);

    // Flatten every registered bubble centre so the white-level field can
    // avoid sampling "paper white" from inside a mark (see
    // egWhiteLevelField's comment for why that matters).
    const excludePoints = [];
    map.setBubbles.forEach(b => excludePoints.push({ x: b.x, y: b.y }));
    map.rollColumns.forEach(col => col.forEach(b => excludePoints.push({ x: b.x, y: b.y })));
    Object.keys(map.questionBubbles).forEach(qStr => {
      map.questionBubbles[qStr].forEach(b => excludePoints.push({ x: b.x, y: b.y }));
    });
    // v9: bumped from 5×7 to 8×11 bins — a finer grid tracks local
    // lighting (a shadow, a fold/tear crease, uneven phone-torch glare)
    // more tightly instead of averaging it away over a big chunk of the
    // sheet, which is what let a shadowed-but-blank patch of paper read
    // as "dark enough" against a white-level estimate borrowed from a
    // brighter neighbouring area.
    const whiteField = egWhiteLevelField(gray, w, h, 8, 11, excludePoints, EG_WHITE_EXCLUDE_RADIUS);

    function darkAt(x, y) {
      return whiteField.at(x, y) - egSampleFillScore(gray, w, h, x, y, EG_BUBBLE_RADIUS);
    }
    function coreDarkAt(x, y) {
      return whiteField.at(x, y) - egSampleFillScore(gray, w, h, x, y, EG_DOT_RADIUS);
    }
    // Returns EVERY candidate that clears its own mark threshold (wide
    // fill OR a solid centre dot), darkest first — not just the single
    // darkest one. This is what makes real multi-mark answers visible:
    // previously only the single best-scoring bubble was ever looked at,
    // so a student who filled two options for the same question always
    // silently became "their darkest bubble", with no record that a
    // second bubble was also genuinely marked.
    function pickBest(candidates) {
      const scored = candidates.map(c => {
        const wide = darkAt(c.x, c.y);
        const core = coreDarkAt(c.x, c.y);
        const wideMargin = wide - EG_MARK_THRESHOLD;
        const coreMargin = core - EG_CORE_MARK_THRESHOLD;
        const marked = wideMargin > 0 || coreMargin > 0;
        return { ...c, dark: Math.max(wide, core), marked, margin: Math.max(wideMargin, coreMargin) };
      });
      const above = scored.filter(s => s.marked).sort((a, b) => b.dark - a.dark);
      const value = above.length === 1 ? above[0] : null;
      return {
        value,
        multiple: above.length > 1,
        allMarked: above,
        lowConfidence: value ? value.margin < EG_LOW_CONFIDENCE_MARGIN : false
      };
    }

    const setPick = pickBest(map.setBubbles.map(b => ({ x: b.x, y: b.y, letter: b.letter })));
    const setLetter = setPick.value ? setPick.value.letter : null;

    const rollDigitsDetected = map.rollColumns.map(col => {
      const pick = pickBest(col.map(b => ({ x: b.x, y: b.y, digit: b.digit })));
      return pick.value ? pick.value.digit : null;
    });
    const rollKnown = rollDigitsDetected.every(d => d !== null);
    const roll = rollKnown ? rollDigitsDetected.join("") : rollDigitsDetected.map(d => d === null ? "?" : d).join("");

    const answers = {};
    const multiOptions = {}; // qNum -> array of opt indices, only when 2+ genuinely marked
    const lowConfidence = {}; // qNum -> true when the (single) detected mark barely cleared its threshold
    Object.keys(map.questionBubbles).forEach(qStr => {
      const q = Number(qStr);
      const pick = pickBest(map.questionBubbles[q]);
      answers[q] = pick.value ? pick.value.opt : null; // 0..3 or null (blank / multiple)
      multiOptions[q] = pick.multiple ? pick.allMarked.map(m => m.opt) : [];
      lowConfidence[q] = pick.lowConfidence;
    });

    return { setLetter, roll, rollDigitsDetected, answers, multiOptions, lowConfidence, totalQuestions: map.totalQuestions, map };
  }

  // Scores a detection against the exam's Answer Key (the key for the
  // detected Set, falling back to Set A / the legacy single key).
  function examgrGradeSheet(ex, detected) {
    const keyArr = examgrResolveAnswerKeyForGrading(ex, detected.setLetter);
    let correct = 0, wrong = 0, blank = 0, ungraded = 0;
    const perQuestion = [];
    for (let q = 1; q <= detected.totalQuestions; q++) {
      const detectedOpt = detected.answers[q]; // 0..3 or null
      const detectedLetter = detectedOpt === null || detectedOpt === undefined ? null : OPTION_LETTERS[detectedOpt];
      const correctLetter = keyArr[q - 1] || null;
      const multiOpts = (detected.multiOptions && detected.multiOptions[q]) || [];
      const lowConfidence = !!(detected.lowConfidence && detected.lowConfidence[q]);
      let status;
      // A genuine multi-mark (2+ bubbles independently cleared the mark
      // threshold) is graded wrong, same convention as a real answer
      // sheet — an OMR machine can't know which one the student "meant".
      if (multiOpts.length > 1) { status = "multiple"; if (correctLetter) wrong++; else ungraded++; }
      else if (!correctLetter) { status = "ungraded"; ungraded++; }
      else if (detectedLetter === null) { status = "blank"; blank++; }
      else if (detectedLetter === correctLetter) { status = "correct"; correct++; }
      else { status = "wrong"; wrong++; }
      perQuestion.push({ q, detectedOpt, detectedLetter, correctLetter, status, multiOpts, lowConfidence });
    }
    const marks = correct; // 1 mark per correct answer, no negative marking (matches printed sheet)
    return { marks, correct, wrong, blank, ungraded, perQuestion, setLetter: detected.setLetter, roll: detected.roll };
  }

  // Paints the grading result straight onto the captured canvas — bold
  // green/red dot on the bubble the student actually marked (matches the
  // key or not), a small pale-gold dot on the CORRECT bubble whenever the
  // student left it blank or got it wrong (so a teacher sees both what
  // was marked and what should have been marked at a glance), and a
  // neutral gold dot (with a dark centre, since it IS a real detected
  // mark) on Roll No / Exam Set bubbles, which have no right/wrong.
  function examgrPaintOverlay(canvas, ex, detected, graded) {
    const ctx = canvas.getContext("2d");
    const map = detected.map;

    function dot(x, y, r, fill, withCore, flagged) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.globalAlpha = 1;
      ctx.fill();
      if (withCore) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, r * 0.32), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(30,20,0,.55)";
        ctx.fill();
      }
      // v10: a mark that barely cleared its threshold gets a thin orange
      // outline ring — a visible "double-check this one" cue instead of
      // looking exactly as certain as an obviously dark, confident mark.
      if (flagged) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#ff8c00";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    function paleDot(x, y, r, fill) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const GREEN = "#18d631", RED = "#e11d1d", GOLD = "#f5b400";

    graded.perQuestion.forEach(pq => {
      const optsPx = map.questionBubbles[pq.q];
      if (!optsPx) return;
      if (pq.status === "multiple") {
        // Every bubble that was actually detected as filled gets a red
        // dot (not just one) — this is the visible signal that the
        // question was thrown out for having 2+ marks, and which
        // bubbles specifically triggered it.
        (pq.multiOpts || []).forEach(optIdx => {
          const px = optsPx[optIdx];
          if (px) dot(px.x, px.y, 9, RED, true);
        });
      } else if (pq.status === "correct") {
        const px = optsPx[pq.detectedOpt];
        dot(px.x, px.y, 9, GREEN, true, pq.lowConfidence);
      } else if (pq.status === "wrong") {
        const px = optsPx[pq.detectedOpt];
        dot(px.x, px.y, 9, RED, true, pq.lowConfidence);
        if (pq.correctLetter) {
          const correctIdx = OPTION_LETTERS.indexOf(pq.correctLetter);
          const cpx = optsPx[correctIdx];
          if (cpx) paleDot(cpx.x, cpx.y, 6, GOLD);
        }
      } else if (pq.status === "blank" && pq.correctLetter) {
        const correctIdx = OPTION_LETTERS.indexOf(pq.correctLetter);
        const cpx = optsPx[correctIdx];
        if (cpx) paleDot(cpx.x, cpx.y, 6, GOLD);
      } else if (pq.status === "ungraded" && pq.detectedOpt !== null && pq.detectedOpt !== undefined) {
        const px = optsPx[pq.detectedOpt];
        dot(px.x, px.y, 9, GOLD, true);
      }
    });

    if (detected.setLetter) {
      const b = map.setBubbles.find(s => s.letter === detected.setLetter);
      if (b) dot(b.x, b.y, 9, GOLD, true);
    }
    detected.rollDigitsDetected.forEach((digit, colIdx) => {
      if (digit === null) return;
      const b = map.rollColumns[colIdx].find(d => d.digit === digit);
      if (b) dot(b.x, b.y, 9, GOLD, true);
    });
  }

  // Tiny (≤ ~90px-wide) low-quality thumbnail so a scan result's photo
  // can be reopened from Reports without bloating the exam document —
  // Firestore caps a document at 1MB and a class can have 100+ results
  // saved on the SAME exam doc, so a full-resolution photo per result is
  // not an option here.
  function examgrMakeThumb(canvas) {
    // Wide enough to still read clearly on the full-screen Report Detail
    // page (not just as a small list avatar), while staying small enough
    // that many of these stacking up in one Firestore doc (results array)
    // doesn't blow the 1MB document limit.
    const scale = Math.min(1, 640 / canvas.width);
    const t = document.createElement("canvas");
    t.width = Math.round(canvas.width * scale);
    t.height = Math.round(canvas.height * scale);
    t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL("image/jpeg", 0.62); // v11: 0.55→0.62 — visibly crisper on the Report Detail photo, still small enough for many results in one Firestore doc
  }

  // Short synthesized "shutter" beep at the exact auto-capture moment —
  // no audio file needed, works offline. Two quick tones (like a camera
  // click) via Web Audio.
  function examgrPlayShutterSound() {
    try {
      if (!scannerAudioCtx) scannerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctxA = scannerAudioCtx;
      if (ctxA.state === "suspended") ctxA.resume();
      const now = ctxA.currentTime;
      [[1400, now, 0.05], [1000, now + 0.06, 0.07]].forEach(([freq, start, dur]) => {
        const osc = ctxA.createOscillator();
        const gain = ctxA.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.16, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain).connect(ctxA.destination);
        osc.start(start);
        osc.stop(start + dur);
      });
    } catch (err) { /* Web Audio not available — silently skip the sound */ }
  }

  // ────────────────────────────────────────────────────────────────
  // Scan Sheet — camera + 4-corner black-square detection, auto-capture
  // (with a shutter beep), then pixel-darkness grading against the
  // Answer Key with a green/red/gold overlay painted on the photo, a
  // Cancel/Edit/Save review step, and a continuous scan loop (Save →
  // "✅ Saved" toast → camera is immediately ready for the next sheet,
  // same stream kept alive so there's no permission re-prompt flicker).
  // ────────────────────────────────────────────────────────────────
  const scannerStage = $id("examgr-scan-stage");
  const scannerVideo = $id("examgr-scan-video");
  const scannerCaptureEl = $id("examgr-scan-capture");
  const scannerOverlayUi = $id("examgr-scan-overlay-ui");
  const scannerStatusEl = $id("examgr-scan-status");
  const scannerStatusTextEl = $id("examgr-scan-status-text");
  const scannerMarkerCountEl = $id("examgr-scan-marker-count");
  const scannerFooter = $id("examgr-scan-footer");
  const scannerPermissionEl = $id("examgr-scan-permission");
  const scannerPermissionMsgEl = $id("examgr-scan-permission-msg");
  const scannerAnalysisCanvas = $id("examgr-scan-analysis-canvas");
  const scannerCaptureCanvas = $id("examgr-scan-capture-canvas");
  const scanCornerEls = scannerOverlayUi ? [...scannerOverlayUi.querySelectorAll(".examgr-scan-corner")] : [];
  const scannerGradedHead = $id("examgr-scan-graded-head");
  const scannerGRoll = $id("examgr-scan-g-roll");
  const scannerGSet = $id("examgr-scan-g-set");
  const scannerGMarks = $id("examgr-scan-g-marks");
  const scannerReviewFooter = $id("examgr-scan-review-footer");
  const scannerSavedToast = $id("examgr-scan-saved-toast");

  function setScannerStatus(message, detectedCount, ready) {
    if (scannerStatusTextEl) scannerStatusTextEl.textContent = message;
    if (scannerMarkerCountEl) scannerMarkerCountEl.textContent = `${detectedCount} / 4 markers`;
    if (scannerStatusEl) scannerStatusEl.classList.toggle("is-ready", !!ready);
  }

  function resetScannerCorners() {
    scanCornerEls.forEach(corner => {
      corner.classList.remove("is-detected");
      const dot = corner.querySelector(".examgr-scan-dot");
      if (dot) { dot.style.left = "50%"; dot.style.top = "50%"; }
    });
  }

  function stopScannerCamera() {
    if (scannerAnimationFrame) { cancelAnimationFrame(scannerAnimationFrame); scannerAnimationFrame = null; }
    if (scannerStream) { scannerStream.getTracks().forEach(track => track.stop()); scannerStream = null; }
    if (scannerVideo) scannerVideo.srcObject = null;
  }

  function resetScannerForLivePreview() {
    scannerCapturing = false;
    scannerStableFrames = 0;
    scannerMarkerHistory = [];
    scannerFrameHistory = [];
    scannerLastDetectionAt = 0;
    scannerDetected = null;
    scannerGraded = null;
    if (scannerCaptureEl) { scannerCaptureEl.hidden = true; scannerCaptureEl.removeAttribute("src"); }
    if (scannerOverlayUi) scannerOverlayUi.hidden = false;
    if (scannerPermissionEl) scannerPermissionEl.hidden = true;
    if (scannerFooter) scannerFooter.hidden = false;
    if (scannerReviewFooter) scannerReviewFooter.hidden = true;
    if (scannerGradedHead) scannerGradedHead.hidden = true;
    if (scannerSavedToast) scannerSavedToast.hidden = true;
    resetScannerCorners();
    setScannerStatus("Kaale OMR squares dhoonde ja rahe hain...", 0, false);
  }

  // Only resumes the live DETECTION LOOP (used between consecutive scans
  // in the same session) — does NOT touch getUserMedia/the camera stream,
  // so the next sheet is ready instantly with no permission re-prompt.
  function resumeScannerDetectionLoop() {
    resetScannerForLivePreview();
    if (scannerStream && !scannerAnimationFrame) {
      scannerAnimationFrame = requestAnimationFrame(runScannerDetection);
    }
  }

  function getVideoDisplayMapping() {
    if (!scannerStage || !scannerVideo) return null;
    const stageRect = scannerStage.getBoundingClientRect();
    const videoWidth = scannerVideo.videoWidth;
    const videoHeight = scannerVideo.videoHeight;
    if (!videoWidth || !videoHeight || !stageRect.width || !stageRect.height) return null;
    const scale = Math.max(stageRect.width / videoWidth, stageRect.height / videoHeight);
    return {
      stageRect, videoWidth, videoHeight, scale,
      offsetX: (stageRect.width - videoWidth * scale) / 2,
      offsetY: (stageRect.height - videoHeight * scale) / 2
    };
  }

  function scanRegionForCorner(corner, mapping, analysisScale) {
    const cornerRect = corner.getBoundingClientRect();
    const frameX = cornerRect.left - mapping.stageRect.left;
    const frameY = cornerRect.top - mapping.stageRect.top;
    const videoX = (frameX - mapping.offsetX) / mapping.scale;
    const videoY = (frameY - mapping.offsetY) / mapping.scale;
    const videoW = cornerRect.width / mapping.scale;
    const videoH = cornerRect.height / mapping.scale;
    return {
      corner, frameX, frameY, frameW: cornerRect.width, frameH: cornerRect.height,
      x: Math.max(0, Math.round(videoX * analysisScale)),
      y: Math.max(0, Math.round(videoY * analysisScale)),
      width: Math.max(1, Math.round(videoW * analysisScale)),
      height: Math.max(1, Math.round(videoH * analysisScale))
    };
  }

  function findBlackSquare(context, region, canvasWidth, canvasHeight) {
    const x = Math.max(0, Math.min(canvasWidth - 1, region.x));
    const y = Math.max(0, Math.min(canvasHeight - 1, region.y));
    const width = Math.max(1, Math.min(canvasWidth - x, region.width));
    const height = Math.max(1, Math.min(canvasHeight - y, region.height));
    const pixels = context.getImageData(x, y, width, height).data;
    const count = width * height;
    const dark = new Uint8Array(count);
    const visited = new Uint8Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 4;
      const brightness = pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
      if (brightness < 68) dark[i] = 1;
    }

    // How dark is a small block right at one of the component's bounding
    // -box corners. A solid SQUARE marker fills its whole bounding box,
    // so all 4 corners are dark. A filled CIRCLE (a student's marked
    // answer bubble) only covers ~79% of its bounding box and leaves the
    // 4 corners as bare paper — this is the single most reliable square
    // -vs-circle test, and is what was letting a nearby marked bubble
    // get mistaken for a registration square before (the loose fill
    // -ratio/aspect-ratio checks alone can't tell a filled circle from a
    // filled square, since both are roughly square bounding boxes with a
    // moderate-to-high fill ratio).
    function cornerDarkFraction(px, py) {
      let darkN = 0, total = 0;
      for (let oy = 0; oy < 3; oy++) {
        for (let ox = 0; ox < 3; ox++) {
          const nx = px + ox, ny = py + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          total++;
          if (dark[ny * width + nx]) darkN++;
        }
      }
      return total ? darkN / total : 0;
    }

    let best = null;
    const queue = new Int32Array(count);
    for (let start = 0; start < count; start++) {
      if (!dark[start] || visited[start]) continue;
      let head = 0, tail = 0;
      queue[tail++] = start;
      visited[start] = 1;
      let pixelCount = 0, minX = width, maxX = 0, minY = height, maxY = 0;

      while (head < tail) {
        const point = queue[head++];
        const pointX = point % width, pointY = Math.floor(point / width);
        pixelCount++;
        minX = Math.min(minX, pointX); maxX = Math.max(maxX, pointX);
        minY = Math.min(minY, pointY); maxY = Math.max(maxY, pointY);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const nx = pointX + ox, ny = pointY + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const next = ny * width + nx;
            if (dark[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
          }
        }
      }

      const componentWidth = maxX - minX + 1;
      const componentHeight = maxY - minY + 1;
      const largestSide = Math.max(componentWidth, componentHeight);
      const smallestSide = Math.min(componentWidth, componentHeight);
      const fillRatio = pixelCount / (componentWidth * componentHeight);
      // Tightened from 0.72/0.58 — the old bounds were loose enough that
      // whole clusters of adjacent bubbles/text could still qualify as
      // "square enough" inside the (now smaller, but still not tiny)
      // search box.
      const squareEnough = smallestSide >= 4 && largestSide <= Math.min(width, height) * 0.55 && smallestSide / largestSide >= 0.65;
      const looksLikeFilledSquare = squareEnough && fillRatio >= 0.6 &&
        cornerDarkFraction(minX, minY) >= 0.6 &&
        cornerDarkFraction(Math.max(minX, maxX - 2), minY) >= 0.6 &&
        cornerDarkFraction(minX, Math.max(minY, maxY - 2)) >= 0.6 &&
        cornerDarkFraction(Math.max(minX, maxX - 2), Math.max(minY, maxY - 2)) >= 0.6;
      if (looksLikeFilledSquare) {
        const score = pixelCount * fillRatio;
        if (!best || score > best.score) {
          best = { score, x: x + minX + componentWidth / 2, y: y + minY + componentHeight / 2 };
        }
      }
    }
    return best;
  }

  function updateScannerCorner(region, candidate, mapping, analysisScale) {
    const corner = region.corner;
    const dot = corner.querySelector(".examgr-scan-dot");
    if (!candidate) { corner.classList.remove("is-detected"); return null; }
    const videoX = candidate.x / analysisScale, videoY = candidate.y / analysisScale;
    const frameX = videoX * mapping.scale + mapping.offsetX;
    const frameY = videoY * mapping.scale + mapping.offsetY;
    if (dot) {
      dot.style.left = `${Math.max(4, Math.min(96, ((frameX - region.frameX) / region.frameW) * 100))}%`;
      dot.style.top = `${Math.max(4, Math.min(96, ((frameY - region.frameY) / region.frameH) * 100))}%`;
    }
    corner.classList.add("is-detected");
    return { x: videoX, y: videoY };
  }

  // ────────────────────────────────────────────────────────────────
  // v8: TEMPORAL SMOOTHING OF CORNER POSITIONS
  //
  // v7 fixed the WARP MATH (true 4-point homography instead of an
  // axis-aligned rectangle). But the homography is only as accurate as
  // the 4 corner points fed into it, and the old capture logic fed it a
  // single video frame's worth of corner detection — grabbed the instant
  // scannerStableFrames first hit 6. A hand held "steady" still has a few
  // pixels of tremor from frame to frame (confirmed in the review
  // screenshots: the gold "detected" ring — drawn at the exact fixed
  // template pixel every bubble is supposed to warp to — sits visibly
  // off-centre from the real printed bubble even after the v7 fix, by an
  // amount that's different on every attempt). A perfect homography built
  // from one noisy frame still produces a noisy warp.
  //
  // Fix: keep a short rolling window of the last few consecutive
  // "all-4-found" frames' corner positions and AVERAGE them at capture
  // time instead of using just the last frame. Random per-frame tremor
  // partly cancels out in the average; a genuinely mis-held sheet still
  // reads as mis-held (averaging a few hundred ms of a steady hold does
  // not meaningfully lag behind a real, deliberate movement).
  // ────────────────────────────────────────────────────────────────
  const EG_MARKER_KEYS = ["top-left", "top-right", "bottom-left", "bottom-right"];
  const EG_MARKER_HISTORY_SIZE = 6; // v10: bumped 4→6 to match scannerStableFrames's own 6-tick
  // requirement (~780ms @130ms/tick) — every frame that was already being
  // held "stable" now also contributes to the pixel average (not just
  // the last 4 of them), for a bit more noise cancellation at no extra
  // wait time, since the app was already waiting this long regardless.

  function egAverageMarkerFrames(history) {
    const n = history.length || 1;
    const avg = {};
    EG_MARKER_KEYS.forEach(key => {
      let sx = 0, sy = 0;
      history.forEach(frame => { sx += frame[key].x; sy += frame[key].y; });
      avg[key] = { x: sx / n, y: sy / n };
    });
    return avg;
  }

  // [top-left, top-right, bottom-left, bottom-right] should form a
  // reasonably large, correctly-ordered quad fully inside the video
  // frame. Runs before the homography solve so a bad/garbled marker read
  // (a corner just outside frame, two corners collapsed onto each other,
  // slots swapped) gets caught with a clear message instead of silently
  // producing a garbage warp.
  function egQuadIsSane(quad, videoWidth, videoHeight) {
    const [tl, tr, bl, br] = quad;
    for (const p of quad) {
      if (!p || !isFinite(p.x) || !isFinite(p.y)) return false;
      if (p.x < -2 || p.y < -2 || p.x > videoWidth + 2 || p.y > videoHeight + 2) return false;
    }
    // Each side should span a meaningful chunk of the frame in the
    // expected direction — catches corners detected in the wrong slot.
    if (tr.x - tl.x < videoWidth * 0.15) return false;
    if (br.x - bl.x < videoWidth * 0.15) return false;
    if (bl.y - tl.y < videoHeight * 0.15) return false;
    if (br.y - tr.y < videoHeight * 0.15) return false;
    // Shoelace area (perimeter order tl→tr→br→bl) — must be a real
    // fraction of the frame, not a sliver from near-collinear points that
    // would still pass the per-side checks above.
    const area = Math.abs(
      tl.x * tr.y - tr.x * tl.y +
      tr.x * br.y - br.x * tr.y +
      br.x * bl.y - bl.x * br.y +
      bl.x * tl.y - tl.x * bl.y
    ) / 2;
    if (area < videoWidth * videoHeight * 0.05) return false;
    return true;
  }

  // v10: ported from the legacy upload-based scanner's proven quality
  // gate (`assessPhotoQuality` in omr.js) into the live-camera flow.
  // Almost every OMR misread traces back to a bad SOURCE photo — out of
  // focus, too dark, or blown-out by flash/glare — no amount of clever
  // scoring downstream can rescue a photo where the ink itself isn't
  // legible. Catching that BEFORE grading (instead of quietly grading a
  // bad photo and hoping the thresholds compensate) is the single
  // highest-leverage accuracy improvement available.
  function egAssessPhotoQuality(gray, w, h) {
    const issues = [];
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

    if (blurVariance < 55) issues.push("Photo dhundhli (out of focus) hai — sheet ke seedhe upar sthir rakhein.");
    if (brightness < 95) issues.push("Photo bahut andheri hai — zyada roshni mein aayein.");
    if (glarePct > 0.35) issues.push("Roshni ka glare bahut zyada hai — angle thoda badlein.");

    return { issues, brightness, blurVariance, glarePct };
  }

  function captureAlignedOmr(detectedMarkers) {
    const id = examMgrSelectedId;
    const ex = examMgrExams[id];
    const videoWidth = scannerVideo.videoWidth, videoHeight = scannerVideo.videoHeight;
    if (!id || !ex || !videoWidth || !videoHeight) return;

    const videoQuad = [
      detectedMarkers["top-left"], detectedMarkers["top-right"],
      detectedMarkers["bottom-left"], detectedMarkers["bottom-right"]
    ];
    if (!egQuadIsSane(videoQuad, videoWidth, videoHeight)) {
      scannerCapturing = false;
      scannerStableFrames = 0;
      scannerMarkerHistory = [];
      scannerFrameHistory = [];
      setScannerStatus("Sheet ko poori tarah camera frame ke andar rakhein aur dobara try karein.", 4, false);
      return;
    }

    // Freeze the detection loop and fire the shutter sound right at the
    // capture instant — matches the reference video's timing exactly.
    if (scannerAnimationFrame) { cancelAnimationFrame(scannerAnimationFrame); scannerAnimationFrame = null; }
    examgrPlayShutterSound();

    // True 4-point perspective correction (see egWarpPerspective above)
    // instead of the old single axis-aligned scale/crop — this is what
    // keeps every bubble on the flattened sheet lined up with the print
    // template regardless of how tilted the phone was held.
    const templateQuad = [
      OMR_SCAN_MARKERS["top-left"], OMR_SCAN_MARKERS["top-right"],
      OMR_SCAN_MARKERS["bottom-left"], OMR_SCAN_MARKERS["bottom-right"]
    ];

    // v10: MULTI-FRAME AVERAGING. Warp every recently-stored stable frame
    // (each through its OWN corner quad from that instant, not the
    // averaged one) into the same template-aligned space, then average
    // the resulting grayscale pixel values. A single camera frame always
    // carries some sensor noise / micro motion-blur; averaging several
    // independent real frames cancels that out the same way a longer
    // camera exposure would, without needing a longer exposure. This is
    // in addition to (not a replacement for) the v8 corner-position
    // averaging above, which only smooths where the corners are, not
    // what the pixels underneath actually look like.
    // Falls back to a single freshly-grabbed frame if, for whatever
    // reason (very fast auto-capture, older browser), no history built up.
    let framesForAveraging = scannerFrameHistory;
    if (!framesForAveraging.length) {
      if (!scannerRawVideoCanvas) scannerRawVideoCanvas = document.createElement("canvas");
      scannerRawVideoCanvas.width = videoWidth;
      scannerRawVideoCanvas.height = videoHeight;
      scannerRawVideoCanvas.getContext("2d").drawImage(scannerVideo, 0, 0, videoWidth, videoHeight);
      framesForAveraging = [{ quad: videoQuad, canvas: scannerRawVideoCanvas }];
    }

    let avgGray = null;
    framesForAveraging.forEach(frame => {
      const warped = egWarpPerspective(frame.canvas, frame.quad, templateQuad, OMR_CANVAS_SIZE);
      const wctx = warped.getContext("2d", { willReadFrequently: true });
      const g = egToGrayscale(wctx, OMR_CANVAS_SIZE.width, OMR_CANVAS_SIZE.height);
      if (!avgGray) avgGray = g;
      else for (let i = 0; i < g.length; i++) avgGray[i] += g[i];
    });
    const frameCount = framesForAveraging.length;
    if (frameCount > 1) for (let i = 0; i < avgGray.length; i++) avgGray[i] /= frameCount;

    // v10: quality gate BEFORE committing to this capture — if the photo
    // itself is too blurry/dark/glared, no amount of downstream scoring
    // can read it reliably. Reject and keep the live camera loop running
    // instead of showing a review screen built on unreadable pixels.
    const quality = egAssessPhotoQuality(avgGray, OMR_CANVAS_SIZE.width, OMR_CANVAS_SIZE.height);
    if (quality.issues.length) {
      scannerCapturing = false;
      scannerStableFrames = 0;
      scannerMarkerHistory = [];
      scannerFrameHistory = [];
      setScannerStatus(quality.issues[0] + " Dobara try karein.", 4, false);
      if (scannerStream && !scannerAnimationFrame) scannerAnimationFrame = requestAnimationFrame(runScannerDetection);
      return;
    }

    scannerCaptureCanvas.width = OMR_CANVAS_SIZE.width;
    scannerCaptureCanvas.height = OMR_CANVAS_SIZE.height;
    // Write the averaged grayscale values straight into the capture
    // canvas — this is already pure R=G=B luminance by construction, so
    // it's simultaneously the multi-frame-denoised image AND fully
    // colour-cast-free (no separate egDesaturateCanvas pass needed).
    const outCtx = scannerCaptureCanvas.getContext("2d");
    const outImg = outCtx.createImageData(OMR_CANVAS_SIZE.width, OMR_CANVAS_SIZE.height);
    for (let p = 0, i = 0; p < avgGray.length; p++, i += 4) {
      const v = avgGray[p];
      outImg.data[i] = outImg.data[i + 1] = outImg.data[i + 2] = v;
      outImg.data[i + 3] = 255;
    }
    outCtx.putImageData(outImg, 0, 0);

    if (!scannerRawCanvas) scannerRawCanvas = document.createElement("canvas");
    scannerRawCanvas.width = OMR_CANVAS_SIZE.width;
    scannerRawCanvas.height = OMR_CANVAS_SIZE.height;
    scannerRawCanvas.getContext("2d").drawImage(scannerCaptureCanvas, 0, 0);

    // Show a placeholder header immediately (mirrors the brief "Roll No :
    // 0 / Set : None" moment in the reference video) while the bubble
    // grid is read — this runs synchronously and is fast, but the
    // placeholder keeps the UI from looking frozen on a slower phone.
    if (scannerGradedHead) scannerGradedHead.hidden = false;
    if (scannerGRoll) scannerGRoll.textContent = "0";
    if (scannerGSet) scannerGSet.textContent = "None";
    if (scannerGMarks) scannerGMarks.textContent = "0.0";

    requestAnimationFrame(() => {
      const detected = examgrDetectFromCanvas(scannerCaptureCanvas, ex);
      const graded = examgrGradeSheet(ex, detected);
      scannerDetected = detected;
      scannerGraded = graded;
      examgrRepaintCapture(ex, detected, graded);

      scannerOverlayUi.hidden = true;
      scannerFooter.hidden = true;
      if (scannerReviewFooter) scannerReviewFooter.hidden = false;
    });
  }

  // Redraws the pristine captured photo, paints the current
  // detected+graded overlay on top of it, and refreshes both the visible
  // <img> and the Roll/Set/Marks header. Shared by the initial capture
  // and by "Apply" in the Edit screen.
  function examgrRepaintCapture(ex, detected, graded) {
    const ctx = scannerCaptureCanvas.getContext("2d");
    ctx.clearRect(0, 0, scannerCaptureCanvas.width, scannerCaptureCanvas.height);
    ctx.drawImage(scannerRawCanvas, 0, 0);
    examgrPaintOverlay(scannerCaptureCanvas, ex, detected, graded);
    scannerCaptureEl.src = scannerCaptureCanvas.toDataURL("image/jpeg", 0.96); // v11: 0.92→0.96, fewer compression artifacts on the review screen
    scannerCaptureEl.hidden = false;
    if (scannerGRoll) scannerGRoll.textContent = detected.roll || "0";
    if (scannerGSet) scannerGSet.textContent = detected.setLetter || "None";
    if (scannerGMarks) scannerGMarks.textContent = graded.marks.toFixed(1);
  }

  // Cancel: discard this capture, nothing saved, camera resumes instantly.
  $id("examgr-scan-cancel-btn")?.addEventListener("click", () => {
    resumeScannerDetectionLoop();
  });

  $id("examgr-scan-edit-btn")?.addEventListener("click", () => {
    examgrOpenEdit();
  });

  $id("examgr-scan-save-btn")?.addEventListener("click", async () => {
    const id = examMgrSelectedId;
    const ex = examMgrExams[id];
    if (!id || !ex || !scannerDetected || !scannerGraded) return;
    const btn = $id("examgr-scan-save-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Saving...";

    const resultObj = {
      id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      roll: scannerDetected.roll || "",
      setLetter: scannerGraded.setLetter || null,
      marks: scannerGraded.marks,
      correct: scannerGraded.correct,
      wrong: scannerGraded.wrong,
      blank: scannerGraded.blank,
      answers: scannerGraded.perQuestion.map(pq => pq.detectedLetter || null),
      // Per-question snapshot for the Report Detail screen's Q-No/Attempted/
      // Correct/Marks table — saved at scan time so it stays accurate even
      // if the Answer Key is edited later, and so a genuine multi-mark
      // (2+ bubbles filled) can still show as e.g. "A, B, C" instead of
      // collapsing to blank the way the single-letter `answers` field above
      // does.
      qDetail: scannerGraded.perQuestion.map(pq => ({
        a: pq.multiOpts && pq.multiOpts.length > 1
          ? pq.multiOpts.map(o => OPTION_LETTERS[o]).join(", ")
          : (pq.detectedLetter || ""),
        c: pq.correctLetter || "",
        m: pq.status === "correct" ? 1 : 0
      })),
      scannedAt: Date.now(),
      thumb: examgrMakeThumb(scannerCaptureCanvas)
    };

    const database = db();
    let ok = false;
    if (database) {
      try {
        await database.collection(COLLECTION).doc(id).update({
          results: firebase.firestore.FieldValue.arrayUnion(resultObj),
          scanned: firebase.firestore.FieldValue.increment(1),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (!Array.isArray(ex.results)) ex.results = [];
        ex.results.push(resultObj);
        ex.scanned = (Number(ex.scanned) || 0) + 1;
        ok = true;
      } catch (err) {
        alert("Save nahi ho paya: " + (err.message || err));
      }
    } else {
      alert("Firebase se connect nahi ho paya — internet check karein.");
    }

    btn.disabled = false;
    btn.textContent = originalLabel;
    if (!ok) return;

    renderExamMgrDetails();
    if (scannerReviewFooter) scannerReviewFooter.hidden = true;
    if (scannerSavedToast) { scannerSavedToast.hidden = false; }
    setTimeout(() => {
      if (scannerSavedToast) scannerSavedToast.hidden = true;
      resumeScannerDetectionLoop();
    }, 650);
  });

  function runScannerDetection() {
    const overlay = $id("examgr-scan-overlay");
    if (!overlay || overlay.classList.contains("hidden") || scannerCapturing) return;
    scannerAnimationFrame = requestAnimationFrame(runScannerDetection);
    if (scannerVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const now = performance.now();
    // v11: throttle tightened 130ms→90ms (≈7.7fps→~11fps corner search).
    // scannerStableFrames still needs the same 6 consecutive ready ticks
    // before auto-capture fires (unchanged — that's what keeps the
    // multi-frame averaging quality in captureAlignedOmr intact), so this
    // alone gets a sheet from "corners visible" to "captured" roughly 30%
    // faster in wall-clock time without touching how many frames get
    // averaged into the final photo.
    if (now - scannerLastDetectionAt < 90) return;
    scannerLastDetectionAt = now;

    const mapping = getVideoDisplayMapping();
    if (!mapping) return;
    // v11: 720→600 — corner search only scans the small boxed regions
    // around each marker (see scanRegionForCorner), not the whole frame,
    // so this shaves per-tick cost with negligible effect on corner
    // precision; the actual captured pixels still come from the
    // full-resolution raw video frame, not this analysis canvas.
    const analysisWidth = Math.min(600, mapping.videoWidth);
    const analysisScale = analysisWidth / mapping.videoWidth;
    const analysisHeight = Math.max(1, Math.round(mapping.videoHeight * analysisScale));
    if (scannerAnalysisCanvas.width !== analysisWidth || scannerAnalysisCanvas.height !== analysisHeight) {
      scannerAnalysisCanvas.width = analysisWidth;
      scannerAnalysisCanvas.height = analysisHeight;
    }
    const analysisContext = scannerAnalysisCanvas.getContext("2d", { willReadFrequently: true });
    analysisContext.drawImage(scannerVideo, 0, 0, analysisWidth, analysisHeight);

    const detectedMarkers = {};
    let detectedCount = 0;
    scanCornerEls.forEach(corner => {
      const region = scanRegionForCorner(corner, mapping, analysisScale);
      const candidate = findBlackSquare(analysisContext, region, analysisWidth, analysisHeight);
      const position = updateScannerCorner(region, candidate, mapping, analysisScale);
      if (position) { detectedMarkers[corner.dataset.marker] = position; detectedCount++; }
    });

    const ready = detectedCount === 4;
    scannerStableFrames = ready ? scannerStableFrames + 1 : 0;
    if (ready) {
      scannerMarkerHistory.push(detectedMarkers);
      if (scannerMarkerHistory.length > EG_MARKER_HISTORY_SIZE) scannerMarkerHistory.shift();
      // v10: snapshot the actual full-res video pixels at this tick too,
      // paired with THIS frame's own corner quad — captureAlignedOmr
      // warps and averages every stored frame together, which cancels
      // out per-frame camera noise/motion blur in the bubble ink itself
      // (corner-averaging above only fixes the geometry, not the pixels).
      const vw = scannerVideo.videoWidth, vh = scannerVideo.videoHeight;
      if (vw && vh) {
        const snap = document.createElement("canvas");
        snap.width = vw; snap.height = vh;
        snap.getContext("2d").drawImage(scannerVideo, 0, 0, vw, vh);
        scannerFrameHistory.push({
          quad: [detectedMarkers["top-left"], detectedMarkers["top-right"], detectedMarkers["bottom-left"], detectedMarkers["bottom-right"]],
          canvas: snap
        });
        if (scannerFrameHistory.length > EG_MARKER_HISTORY_SIZE) scannerFrameHistory.shift();
      }
    } else {
      scannerMarkerHistory = [];
      scannerFrameHistory = [];
    }
    setScannerStatus(ready ? "Sab 4 markers mil gaye. Steady rakhein, auto-scan ho raha hai..." : "Kaale OMR squares ko blue corner box ke andar align karein.", detectedCount, ready);
    if (ready && scannerStableFrames >= 6) {
      scannerCapturing = true;
      // Average of the last EG_MARKER_HISTORY_SIZE ready frames, not just
      // this single frame — see the v8 comment above egQuadIsSane.
      captureAlignedOmr(egAverageMarkerFrames(scannerMarkerHistory));
    }
  }

  async function startScannerCamera() {
    if (scannerCameraRequestInProgress) return;
    scannerCameraRequestInProgress = true;
    stopScannerCamera();
    if (scannerPermissionEl) scannerPermissionEl.hidden = true;
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
        const msg = window.isSecureContext
          ? "Ye browser camera access support nahi karta. Chrome ya kisi doosre modern browser mein kholein."
          : "Is window mein camera access block hai. App ko HTTPS ya localhost par kholein.";
        const err = new Error(msg);
        err.name = "NotSupportedError";
        throw err;
      }
      try {
        scannerStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          // v11: raised ideal resolution 1280×1920 → 1920×2560 — sharper
          // source pixels feeding the perspective warp, so the final
          // captured sheet (and the report photo made from it) looks
          // crisper on close inspection instead of upscaled/soft. "ideal"
          // just hints the browser toward the best match a phone's rear
          // camera actually offers; it degrades gracefully (never errors)
          // on a camera that can't hit it, unlike { exact: ... } would.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 2560 } }
        });
      } catch (error) {
        if (!["NotFoundError", "OverconstrainedError"].includes(error && error.name)) throw error;
        scannerStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      scannerVideo.srcObject = scannerStream;
      await scannerVideo.play();
      scannerAnimationFrame = requestAnimationFrame(runScannerDetection);
    } catch (error) {
      stopScannerCamera();
      const isBlocked = error && ["NotAllowedError", "SecurityError"].includes(error.name);
      const isSecureIssue = !window.isSecureContext || (error && ["NotSupportedError", "TypeError"].includes(error.name));
      if (scannerPermissionMsgEl) {
        scannerPermissionMsgEl.textContent = isBlocked
          ? "Browser ke permission popup mein Camera ko Allow karein. Pehle block kiya ho to address-bar ke lock menu se Camera ko Allow karke dobara try karein."
          : isSecureIssue
            ? "Camera ke liye secure browser window chahiye — app ko HTTPS ya localhost par kholein, phir dobara try karein."
            : "Camera start nahi ho paya. Camera use kar rahi doosri app band karke dobara try karein.";
      }
      if (scannerPermissionEl) scannerPermissionEl.hidden = false;
      setScannerStatus("Camera permission chahiye.", 0, false);
    } finally {
      scannerCameraRequestInProgress = false;
    }
  }

  function examgrOpenScanner() {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex || !scannerStage) return;
    $id("examgr-details-overlay")?.classList.add("hidden");
    $id("examgr-scan-overlay")?.classList.remove("hidden");
    resetScannerForLivePreview();
    startScannerCamera();
  }

  function examgrCloseScanner() {
    stopScannerCamera();
    $id("examgr-scan-overlay")?.classList.add("hidden");
    $id("examgr-details-overlay")?.classList.remove("hidden");
    renderExamMgrDetails();
  }
  window.examgrCloseScanner = examgrCloseScanner;

  $id("examgr-scan-done-btn")?.addEventListener("click", examgrCloseScanner);
  $id("examgr-scan-enable-btn")?.addEventListener("click", startScannerCamera);

  // ────────────────────────────────────────────────────────────────
  // Edit — hand-correct a capture's Roll No / Set / individual answers
  // before saving (in case a bubble was misread).
  // ────────────────────────────────────────────────────────────────
  let editDraftAnswers = {}; // q -> letter|null
  let editDraftRollDigits = [];
  let editDraftSet = null;

  function examgrOpenEdit() {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex || !scannerDetected || !scannerGraded) return;

    editDraftSet = scannerDetected.setLetter;
    editDraftRollDigits = scannerDetected.rollDigitsDetected.slice();
    editDraftAnswers = {};
    scannerGraded.perQuestion.forEach(pq => { editDraftAnswers[pq.q] = pq.detectedLetter; });

    const rollWrap = $id("examgr-edit-rollset");
    if (rollWrap) {
      const rollSelects = editDraftRollDigits.map((d, i) =>
        `<select class="examgr-edit-roll-digit" data-col="${i}"><option value="">?</option>${
          Array.from({ length: 10 }, (_, n) => `<option value="${n}"${d === n ? " selected" : ""}>${n}</option>`).join("")
        }</select>`
      ).join("");
      const setOpts = SET_LETTERS.map(letter =>
        `<button type="button" class="examgr-akey-opt${editDraftSet === letter ? " selected" : ""}" data-set-letter="${letter}">${letter}</button>`
      ).join("");
      rollWrap.innerHTML = `
        <div class="examgr-edit-block"><label>Roll No</label><div class="examgr-edit-roll-row">${rollSelects}</div></div>
        <div class="examgr-edit-block"><label>Exam Set</label><div class="examgr-edit-set-row">${setOpts}</div></div>`;
    }

    const qlist = $id("examgr-edit-qlist");
    if (qlist) {
      const total = scannerGraded.perQuestion.length;
      qlist.innerHTML = Array.from({ length: total }, (_, i) => {
        const q = i + 1;
        const val = editDraftAnswers[q];
        const opts = OPTION_LETTERS.map(letter =>
          `<button type="button" class="examgr-akey-opt${val === letter ? " selected" : ""}" data-eq="${q}" data-letter="${letter}">${letter}</button>`
        ).join("");
        return `<div class="examgr-akey-row"><span class="examgr-akey-qnum">${q}</span>${opts}</div>`;
      }).join("");
    }

    $id("examgr-scan-overlay")?.classList.add("hidden");
    $id("examgr-scan-edit-overlay")?.classList.remove("hidden");
  }

  function examgrCloseEdit() {
    $id("examgr-scan-edit-overlay")?.classList.add("hidden");
    $id("examgr-scan-overlay")?.classList.remove("hidden");
  }
  window.examgrCloseEdit = examgrCloseEdit;

  $id("examgr-edit-rollset")?.addEventListener("click", (e) => {
    const setBtn = e.target.closest("[data-set-letter]");
    if (setBtn) {
      editDraftSet = editDraftSet === setBtn.dataset.setLetter ? null : setBtn.dataset.setLetter;
      setBtn.parentElement.querySelectorAll(".examgr-akey-opt").forEach(b =>
        b.classList.toggle("selected", b.dataset.setLetter === editDraftSet));
    }
  });
  $id("examgr-edit-rollset")?.addEventListener("change", (e) => {
    const sel = e.target.closest(".examgr-edit-roll-digit");
    if (!sel) return;
    const col = Number(sel.dataset.col);
    editDraftRollDigits[col] = sel.value === "" ? null : Number(sel.value);
  });
  $id("examgr-edit-qlist")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-eq]");
    if (!btn) return;
    const q = Number(btn.dataset.eq);
    const letter = btn.dataset.letter;
    editDraftAnswers[q] = editDraftAnswers[q] === letter ? null : letter;
    const row = btn.closest(".examgr-akey-row");
    row.querySelectorAll(".examgr-akey-opt").forEach(b =>
      b.classList.toggle("selected", b.dataset.letter === editDraftAnswers[q]));
  });

  $id("examgr-edit-apply-btn")?.addEventListener("click", () => {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex || !scannerDetected) return;

    const rollKnown = editDraftRollDigits.every(d => d !== null);
    const roll = rollKnown ? editDraftRollDigits.join("") : editDraftRollDigits.map(d => d === null ? "?" : d).join("");
    const answers = {};
    Object.keys(scannerDetected.answers).forEach(qStr => {
      const q = Number(qStr);
      const letter = editDraftAnswers[q];
      answers[q] = letter ? OPTION_LETTERS.indexOf(letter) : null;
    });

    const editedDetected = {
      setLetter: editDraftSet,
      roll,
      rollDigitsDetected: editDraftRollDigits.slice(),
      answers,
      totalQuestions: scannerDetected.totalQuestions,
      map: scannerDetected.map
    };
    const graded = examgrGradeSheet(ex, editedDetected);
    scannerDetected = editedDetected;
    scannerGraded = graded;
    examgrRepaintCapture(ex, editedDetected, graded);
    examgrCloseEdit();
  });

  // ────────────────────────────────────────────────────────────────
  // Reports — per-student list of everything scanned for this exam.
  // ────────────────────────────────────────────────────────────────
  function examgrOpenReports() {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    const results = Array.isArray(ex.results) ? ex.results.slice() : [];
    results.sort((a, b) => (Number(b.marks) || 0) - (Number(a.marks) || 0));
    examgrReportResults = results; // shared with the Report Detail screen (rank = index + 1)

    $id("examgr-reports-title").textContent = "📊 Reports";
    $id("examgr-reports-label-1").textContent = "Σ Marks";
    $id("examgr-reports-label-2").textContent = "Reports";
    $id("examgr-reports-maxmarks").textContent = (Number(ex.questions) || 0).toFixed(1);
    $id("examgr-reports-count").textContent = String(results.length);

    const listEl = $id("examgr-reports-list");
    if (listEl) {
      listEl.innerHTML = results.length ? results.map((r, i) => `
        <div class="examgr-report-row" data-idx="${i}">
          <div class="examgr-report-avatar">👤</div>
          <div class="examgr-report-body">
            <div class="examgr-report-top">
              <span class="examgr-report-roll">Roll: ${escHtml(r.roll || "—")}${r.setLetter ? " · Set " + escHtml(r.setLetter) : ""}</span>
              <span class="examgr-report-rank">🏅${i + 1}</span>
            </div>
            <div class="examgr-report-stats">
              <span class="examgr-report-sum">Σ ${(Number(r.marks) || 0).toFixed(1)}</span>
              <span class="examgr-report-ok">✅ ${r.correct || 0}</span>
              <span class="examgr-report-bad">❌ ${r.wrong || 0}</span>
              <span class="examgr-report-blank">⭕ ${r.blank || 0}</span>
            </div>
          </div>
          ${r.thumb ? `<img class="examgr-report-thumb" src="${r.thumb}" alt="Scanned sheet">` : ""}
        </div>`).join("")
        : '<div class="examgr-empty">📷 Abhi tak koi sheet scan nahi hui — "Scan Sheet" se shuru karein.</div>';
    }

    $id("examgr-details-overlay")?.classList.add("hidden");
    $id("examgr-reports-overlay")?.classList.remove("hidden");
  }

  function examgrCloseReports() {
    $id("examgr-reports-overlay")?.classList.add("hidden");
    $id("examgr-details-overlay")?.classList.remove("hidden");
  }
  window.examgrCloseReports = examgrCloseReports;

  $id("examgr-reports-list")?.addEventListener("click", (e) => {
    const row = e.target.closest(".examgr-report-row");
    if (!row) return;
    examgrOpenReportDetail(Number(row.dataset.idx));
  });

  function examgrCloseReportPhoto() {
    $id("examgr-report-photo-overlay")?.classList.add("hidden");
  }
  window.examgrCloseReportPhoto = examgrCloseReportPhoto;

  // ────────────────────────────────────────────────────────────────
  // Report Detail — full-screen, single-sheet view opened by tapping a
  // row in Reports: Name/Class/Exam/Set/Rank, a Subject-wise marks table
  // (the printed sheet only has one Subject/Section, so those two rows
  // mirror Total Marks), the scanned photo, a Q-No/Attempted/Correct/
  // Marks table for every question, and Report i/N prev/next paging
  // across every OTHER scanned sheet for this exam — all without leaving
  // the detail screen.
  // ────────────────────────────────────────────────────────────────
  function examgrOpenReportDetail(idx) {
    const ex = examMgrExams[examMgrSelectedId];
    const r = examgrReportResults[idx];
    if (!ex || !r) return;
    examgrReportDetailIndex = idx;
    const total = examgrReportResults.length;

    $id("examgr-report-detail-title").textContent = `Roll No : ${r.roll || "—"}`;
    $id("examgr-rd-name").textContent = "—"; // sheet has no name field, only Roll No
    $id("examgr-rd-class").textContent = ex.className || "—";
    $id("examgr-rd-exam").textContent = ex.examName || "—";
    $id("examgr-rd-set").textContent = r.setLetter || "—";
    $id("examgr-rd-rank").textContent = String(idx + 1);

    const maxMarks = Number(ex.questions) || 0;
    const marks = Number(r.marks) || 0;
    const correctCount = Number(r.correct) || 0;
    const pct = maxMarks ? (marks / maxMarks * 100) : 0;
    const subjectEl = $id("examgr-rd-subject-table");
    if (subjectEl) {
      subjectEl.innerHTML = [["Subject 1", false], ["Section1", false], ["Total Marks", true]]
        .map(([label, isTotal]) => `
          <div class="examgr-rd-trow${isTotal ? " examgr-rd-trow-total" : ""}">
            <span>${escHtml(label)}</span><span>${marks.toFixed(1)}</span><span>${pct.toFixed(1)}%</span><span>${correctCount}</span>
          </div>`).join("");
    }

    const photoEl = $id("examgr-rd-photo");
    if (photoEl) {
      if (r.thumb) { photoEl.src = r.thumb; photoEl.hidden = false; }
      else photoEl.hidden = true;
    }

    const qEl = $id("examgr-rd-qtable");
    if (qEl) {
      if (Array.isArray(r.qDetail) && r.qDetail.length) {
        qEl.innerHTML = r.qDetail.map((qd, i) => `
          <div class="examgr-rd-qrow">
            <span>${i + 1}</span><span>${escHtml(qd.a || "")}</span><span>${escHtml(qd.c || "")}</span><span>${(Number(qd.m) || 0).toFixed(1)}</span>
          </div>`).join("");
      } else {
        qEl.innerHTML = '<div class="examgr-empty" style="padding:16px 4px;">Ye scan puraana hai — question-by-question detail is ke liye save nahi hui thi.</div>';
      }
    }

    $id("examgr-report-detail-pageinfo").textContent = `Report ${idx + 1}/${total}`;
    $id("examgr-rd-prev")?.classList.toggle("disabled", idx <= 0);
    $id("examgr-rd-next")?.classList.toggle("disabled", idx >= total - 1);
    $id("examgr-rd-body")?.scrollTo({ top: 0 });

    $id("examgr-reports-overlay")?.classList.add("hidden");
    $id("examgr-report-detail-overlay")?.classList.remove("hidden");
  }
  window.examgrOpenReportDetail = examgrOpenReportDetail;

  function examgrCloseReportDetail() {
    $id("examgr-report-detail-overlay")?.classList.add("hidden");
    $id("examgr-reports-overlay")?.classList.remove("hidden");
  }
  window.examgrCloseReportDetail = examgrCloseReportDetail;

  function examgrReportDetailStep(delta) {
    const next = examgrReportDetailIndex + delta;
    if (next < 0 || next >= examgrReportResults.length) return;
    examgrOpenReportDetail(next);
  }
  window.examgrReportDetailStep = examgrReportDetailStep;

  function examgrZoomReportPhoto() {
    const src = $id("examgr-rd-photo")?.src;
    if (!src) return;
    const img = $id("examgr-report-photo-img");
    if (img) img.src = src;
    $id("examgr-report-photo-overlay")?.classList.remove("hidden");
  }
  window.examgrZoomReportPhoto = examgrZoomReportPhoto;

  async function examgrDeleteReportDetail() {
    const ex = examMgrExams[examMgrSelectedId];
    const r = examgrReportResults[examgrReportDetailIndex];
    if (!ex || !r) return;
    if (!window.confirm(`Roll No ${r.roll || "—"} ka ye report delete karein? Ye undo nahi ho sakta.`)) return;

    const newResults = (ex.results || []).filter(x => x.id !== r.id);
    const database = db();
    if (database) {
      try {
        await database.collection(COLLECTION).doc(examMgrSelectedId).update({
          results: newResults,
          scanned: newResults.length,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        alert("Delete nahi ho paya: " + (err.message || err));
        return;
      }
    }
    ex.results = newResults;
    ex.scanned = newResults.length;
    examgrCloseReportDetail();
    examgrOpenReports();
  }
  window.examgrDeleteReportDetail = examgrDeleteReportDetail;

  function examgrEditReportDetail() {
    const r = examgrReportResults[examgrReportDetailIndex];
    if (!r) return;
    alert(`Roll No ${r.roll || "—"} ko theek karne ke liye is sheet ko dobara "Scan Sheet" se scan karein — naya scan isi Roll No ke against ek nayi report jod dega.`);
  }
  window.examgrEditReportDetail = examgrEditReportDetail;

  function examgrShareReportDetail() {
    const ex = examMgrExams[examMgrSelectedId];
    const r = examgrReportResults[examgrReportDetailIndex];
    if (!ex || !r) return;
    const maxMarks = Number(ex.questions) || 0;
    const text = `${ex.examName || "Exam"} — Roll No ${r.roll || "—"}\nRank: ${examgrReportDetailIndex + 1}\nMarks: ${(Number(r.marks) || 0).toFixed(1)} / ${maxMarks.toFixed(1)}\nCorrect: ${r.correct || 0}  Wrong: ${r.wrong || 0}  Blank: ${r.blank || 0}`;
    if (navigator.share) {
      navigator.share({ title: "Report", text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => examgrShowNotice("📋 Report clipboard mein copy ho gayi."));
    } else {
      alert(text);
    }
  }
  window.examgrShareReportDetail = examgrShareReportDetail;

  // ────────────────────────────────────────────────────────────────
  // Analysis — per-question difficulty across every scanned sheet, so a
  // teacher can spot which questions the whole class struggled with.
  // ────────────────────────────────────────────────────────────────
  function examgrOpenAnalysis() {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    const results = Array.isArray(ex.results) ? ex.results : [];
    const n = results.length;
    const total = Math.max(1, Math.min(MAX_QUESTIONS, Number(ex.questions) || 0));

    if (!n) {
      examgrShowNotice("📈 Analysis: abhi is exam ki koi sheet scan nahi hui.");
      return;
    }

    const marksList = results.map(r => Number(r.marks) || 0);
    const avg = marksList.reduce((a, b) => a + b, 0) / n;
    const highest = Math.max(...marksList);
    const lowest = Math.min(...marksList);

    const perQCorrect = new Array(total).fill(0);
    const perQAttempted = new Array(total).fill(0);
    results.forEach(r => {
      const ans = Array.isArray(r.answers) ? r.answers : [];
      const keyArr = examgrResolveAnswerKeyForGrading(ex, r.setLetter);
      for (let i = 0; i < total; i++) {
        if (ans[i]) perQAttempted[i]++;
        if (ans[i] && keyArr[i] && ans[i] === keyArr[i]) perQCorrect[i]++;
      }
    });
    const hardest = perQCorrect
      .map((c, i) => ({ q: i + 1, pct: n ? Math.round((c / n) * 100) : 0 }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);

    const rows = hardest.map(h => `<div class="examgr-report-row" style="padding:8px 10px;">
        <div class="examgr-report-body">
          <div class="examgr-report-top"><span class="examgr-report-roll">Q${h.q}</span><span>${h.pct}% sahi</span></div>
          <div class="examgr-progress-track" style="margin-top:4px;"><div class="examgr-progress-fill" style="width:${h.pct}%;"></div></div>
        </div>
      </div>`).join("");

    $id("examgr-reports-title").textContent = "📈 Analysis";
    $id("examgr-reports-label-1").textContent = "Average";
    $id("examgr-reports-label-2").textContent = "Sheets";
    $id("examgr-reports-maxmarks").textContent = avg.toFixed(1);
    $id("examgr-reports-count").textContent = String(n);
    const listEl = $id("examgr-reports-list");
    if (listEl) {
      listEl.innerHTML = `
        <div class="examgr-stats-row" style="margin-bottom:12px;">
          <span>🏆 Highest: <strong>${highest.toFixed(1)}</strong></span>
          <span>🔻 Lowest: <strong>${lowest.toFixed(1)}</strong></span>
          <span>📊 Average: <strong>${avg.toFixed(1)}</strong></span>
        </div>
        <div class="examgr-section-label">Sabse mushkil questions (kam % sahi)</div>
        ${rows}`;
    }
    $id("examgr-details-overlay")?.classList.add("hidden");
    $id("examgr-reports-overlay")?.classList.remove("hidden");
  }
})();
