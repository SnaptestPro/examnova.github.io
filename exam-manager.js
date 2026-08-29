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
  // collecting sheets. Both the HTML preview (egMarkers, via egBoxStyle)
  // and the printed PDF (doc.rect(mmPos(x), mmPos(y), mmPos(20), mmPos(20)))
  // draw each 20x20 marker square with its TOP-LEFT corner at
  // (OMR_MARKER_XS[i], OMR_MARKER_YS[j]) — so the square's true CENTER,
  // which is what the scanner's blob detector locks onto in the photo
  // (see the "x + minX + componentWidth / 2" center-of-mass calculation
  // above), is (x + 10, y + 10), not (x, y).
  //
  // These were previously hand-tuned to slightly different values
  // (116.26/207.16/1086.74/1419.79) that did NOT match that true center,
  // and by a DIFFERENT amount on each corner (left columns off by ~1.3px,
  // right columns by ~11.7px; top rows by ~2.2px, bottom rows by
  // ~14.8px). Because this is the template-space reference the
  // scan-time homography is solved against, feeding it a corner that
  // doesn't match where that corner is actually printed distorts the
  // whole warp — every bubble on the flattened sheet lands off by an
  // amount that grows toward the bottom-right, exactly matching the
  // "circle/dot doesn't sit on the bubble" symptom. Using the true
  // geometric centers here removes that distortion.
  const OMR_SCAN_MARKERS = {
    "top-left": { x: 115, y: 205 },
    "top-right": { x: 1075, y: 205 },
    "bottom-left": { x: 115, y: 1405 },
    "bottom-right": { x: 1075, y: 1405 }
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
      html += egCenterText(String(i + 1), 175 + i * 30 + 15, 227, 30);
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

  $id("examgr-sheet-download-btn")?.addEventListener("click", () => {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    const sheetHtml = examgrBuildSheetHtml(ex);
    const doc = `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=${OMR_CANVAS_SIZE.width}, initial-scale=1.0"><title>${escHtml(ex.examName || "OMR Sheet")}</title><style>body{margin:0;background:#fff;}${EXAMGR_SHEET_CSS}</style></head><body>${sheetHtml}</body></html>`;
    downloadBlob(doc, "text/html;charset=utf-8", safeFileName(ex.examName || "omr") + "-omr-sheet.html");
  });

  /* ── OMR Sheet → real PDF (vector, no html2canvas) ────────────────
     NOTE: this used to render examgrBuildSheetHtml() into an off-screen
     div and rasterize it via html2pdf (html2canvas → jsPDF). That
     pipeline is exactly the "large blank gaps" / unreliable-capture
     problem already documented and fixed in omr.js's OMR sheet
     generator — html2canvas has to paint a huge (~2400x3000px at
     scale:2) off-screen canvas, which silently produces a blank/partial
     canvas on many phones (low memory → the canvas context allocation
     fails quietly instead of throwing), and jsPDF's blob-download
     trick that html2pdf's .save() relies on is unreliable on mobile
     Safari/Chrome, which is why the download didn't even start there.

     Fix: draw the sheet directly as PDF vector shapes (rects for the
     header box/markers, circles for bubbles, text for labels) with
     jsPDF's own drawing API — no HTML, no canvas rasterization, so
     there is nothing that can render blank and the output file is a
     few KB instead of a multi-megabyte rasterized image. All layout
     numbers are reused as-is from OMR_CANVAS_SIZE/OMR_COLUMN_SPECS
     (same source the on-screen preview and the scanner calibration
     use), just uniformly scaled from px → mm to fit one A4 page, so
     corner-marker/bubble geometry stays exactly proportional to what
     the scanner already expects. ─────────────────────────────────── */

  // Scale the 1203×1536 "px" layout down to fit an A4 page width
  // (210mm), preserving aspect ratio so bubbles stay circular and the
  // corner markers keep the same relative geometry the scanner uses.
  const OMR_PDF_PAGE_MM = { width: 210, height: 297 };
  const OMR_PX_TO_MM = OMR_PDF_PAGE_MM.width / OMR_CANVAS_SIZE.width;
  const mmPos = px => px * OMR_PX_TO_MM;
  // jsPDF font sizes are always in pt regardless of document unit.
  const pxFontToPt = px => px * OMR_PX_TO_MM * 2.834645669;

  // Slow/mobile connections sometimes click the button before the
  // deferred jsPDF <script> tag has finished downloading. Instead of
  // failing immediately, wait briefly for it to show up.
  function waitForJsPdf(timeoutMs) {
    return new Promise(resolve => {
      if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);
      const start = Date.now();
      const iv = setInterval(() => {
        if (window.jspdf && window.jspdf.jsPDF) {
          clearInterval(iv);
          resolve(window.jspdf.jsPDF);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          resolve(null);
        }
      }, 150);
    });
  }

  async function examgrBuildSheetPdf(ex) {
    const jsPDF = await waitForJsPdf(6000);
    if (!jsPDF) throw new Error("PDF library abhi load nahi ho payi — internet check karke page reload karein.");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.setDrawColor(40, 40, 40);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    // corner-registration markers (solid black squares)
    doc.setFillColor(0, 0, 0);
    OMR_MARKER_YS.forEach(y => OMR_MARKER_XS.forEach(x => {
      doc.rect(mmPos(x), mmPos(y), mmPos(20), mmPos(20), "F");
    }));

    // header box: NAME / EXAM row + DATE/CLASS row
    doc.setLineWidth(0.3);
    doc.rect(mmPos(99), mmPos(49), mmPos(992), mmPos(92)); // outer box
    doc.line(mmPos(99), mmPos(94), mmPos(1091), mmPos(94)); // row divider
    doc.line(mmPos(595), mmPos(49), mmPos(595), mmPos(94)); // NAME/EXAM divider
    doc.setFontSize(pxFontToPt(15));
    doc.text(`NAME :`, mmPos(110), mmPos(78));
    doc.text(`EXAM : ${ex.examName || ""}`, mmPos(605), mmPos(78));
    doc.text(`DATE : ${ex.date || ""}     CLASS : ${ex.className || ""}`, mmPos(110), mmPos(123));

    doc.setFontSize(pxFontToPt(24));
    doc.text("SAVYASACHI COACHING — OMR ANSWER SHEET", mmPos(OMR_CANVAS_SIZE.width / 2), mmPos(30), { align: "center" });

    // Exam Set (A–E) row
    doc.setFontSize(pxFontToPt(14));
    doc.text("Exam Set", mmPos(235), mmPos(EXAM_SET_Y.label + 8), { align: "center" });
    doc.setFontSize(pxFontToPt(12));
    SET_LETTERS.forEach((letter, i) => doc.text(letter, mmPos(EXAM_SET_CENTERS[i]), mmPos(EXAM_SET_Y.header + 3), { align: "center" }));
    doc.setLineWidth(0.2);
    EXAM_SET_CENTERS.forEach(cx => doc.circle(mmPos(cx), mmPos(EXAM_SET_Y.bubble), mmPos(11)));

    // Roll No block
    const rollDigits = Math.max(1, Math.min(5, Number(ex.rollDigits) || 5));
    const rollCenters = [190, 220, 250, 280, 310].slice(0, rollDigits);
    doc.setFontSize(pxFontToPt(14));
    doc.text("Roll No", mmPos(250), mmPos(208), { align: "center" });
    doc.setLineWidth(0.25);
    for (let i = 0; i < rollDigits; i++) {
      doc.rect(mmPos(175 + i * 30), mmPos(220), mmPos(30), mmPos(30));
      doc.setFontSize(pxFontToPt(12));
      doc.text(String(i + 1), mmPos(175 + i * 30 + 15), mmPos(220 + 19), { align: "center" });
    }
    doc.setFontSize(pxFontToPt(13));
    for (let d = 0; d <= 9; d++) {
      const cy = 265 + d * 30;
      doc.text(String(d), mmPos(166), mmPos(cy + 3), { align: "right" });
      rollCenters.forEach(cx => doc.circle(mmPos(cx), mmPos(cy), mmPos(11)));
    }

    // Exam name / class under column 0
    doc.setFontSize(pxFontToPt(13));
    doc.text(ex.examName || "Exam", mmPos(OMR_COLUMN_SPECS[0].subjectCenter), mmPos(OMR_COLUMN_SPECS[0].subjectTop + 8), { align: "center" });
    doc.text(ex.className || "", mmPos(OMR_COLUMN_SPECS[0].subjectCenter), mmPos(OMR_COLUMN_SPECS[0].sectionTop + 8), { align: "center" });

    // Question grid
    const total = Math.max(1, Math.min(MAX_QUESTIONS, Number(ex.questions) || MAX_QUESTIONS));
    let itemIndex = 0;
    OMR_COLUMN_SPECS.forEach(col => {
      col.groups.forEach(group => {
        if (itemIndex >= total) return;
        doc.setFontSize(pxFontToPt(12));
        OPTION_LETTERS.forEach((label, i) => doc.text(label, mmPos(col.optionCenters[i]), mmPos(group.headerY + 3), { align: "center" }));
        for (let r = 0; r < group.count && itemIndex < total; r++) {
          const cy = group.rowStart + r * 30;
          itemIndex++;
          doc.setFontSize(pxFontToPt(14));
          doc.text(String(itemIndex), mmPos(col.qRight), mmPos(cy + 3), { align: "right" });
          doc.setLineWidth(0.2);
          OPTION_LETTERS.forEach((_, i) => doc.circle(mmPos(col.optionCenters[i]), mmPos(cy), mmPos(11)));
        }
      });
    });

    return doc;
  }

  $id("examgr-sheet-pdf-btn")?.addEventListener("click", async () => {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    const btn = $id("examgr-sheet-pdf-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ PDF Bana Rahe Hain...";
    try {
      const doc = await examgrBuildSheetPdf(ex);
      doc.save(safeFileName(ex.examName || "omr") + "-omr-sheet.pdf");
    } catch (err) {
      alert("PDF banane mein dikkat aayi: " + (err && err.message ? err.message : err));
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
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
  // mmPos(11))` in the PDF export above) with a 1.7px ring stroke, so the
  // ring's own ink starts at radius ~10.15. Sample radius kept at 9 (not
  // pushed back up to 11) so the sample disk always stays a little inside
  // that ring, leaving a bit more headroom than radius-10 did against a
  // few px of residual scan misalignment, while still comfortably
  // covering genuine ink (nearly always well inside the ring, not hugging
  // its edge) and staying under the 15px half-spacing so it can never
  // bleed into a neighbour bubble.
  const EG_BUBBLE_RADIUS = 9;
  // Small inner-only radius used for two things below: (a) a genuinely
  // filled bubble must ALSO show real ink dead-centre, not just broad
  // coverage — a review of a captured scan showed the gold "detected"
  // dot lighting up a completely BLANK bubble, most likely because
  // something OTHER than a real fill (the printed ring's own edge, a
  // nearby label letter, a shadow) happened to cover enough of the wider
  // sample disk to look dark on average, while the bubble's true centre
  // was untouched paper. A genuine pencil/pen fill darkens the centre
  // every time; a boundary/text/shadow artefact usually doesn't. (b) a
  // fallback "faint mark" read (see pickBest) for a light dot/tick that
  // never covers enough of the full bubble to pass the broad check at all.
  const EG_CORE_RADIUS = 4;
  const EG_CORE_MIN_FOR_CONFIDENT = 20; // even a normal full mark must clear this at the centre
  const EG_CORE_THRESHOLD = 55;   // faint-mark fallback: require genuinely solid ink in that core
  const EG_CORE_MARGIN = 15;      // ...and clearly darker than this question's other options
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
    const whiteField = egWhiteLevelField(gray, w, h, 5, 7, excludePoints, EG_WHITE_EXCLUDE_RADIUS);

    function darkAt(x, y, radius) {
      return whiteField.at(x, y) - egSampleFillScore(gray, w, h, x, y, radius);
    }

    // pickBest now returns THREE possible outcomes instead of two:
    //  - flag: null    -> normal confident pick (or nothing marked at all)
    //  - flag: "multi" -> two or more options both look genuinely filled;
    //                     we can't safely guess which one the student
    //                     meant, so every one of them is reported back
    //                     (via multiOptions) instead of silently picking one.
    //  - flag: "faint" -> nothing covered enough of the full bubble to
    //                     pass the normal check, but one option has a
    //                     small, solid, clearly-the-darkest core — a
    //                     light pencil dot/tick instead of full shading.
    //                     Used as the answer, but flagged for a quick
    //                     human glance rather than trusted silently.
    function pickBest(rawCandidates) {
      const candidates = rawCandidates.map(c => ({
        ...c,
        broad: darkAt(c.x, c.y, EG_BUBBLE_RADIUS),
        core: darkAt(c.x, c.y, EG_CORE_RADIUS)
      }));
      // "Genuinely filled" = broad coverage passes AND the centre itself
      // is actually inked — see EG_CORE_MIN_FOR_CONFIDENT above for why
      // the second half matters.
      const genuine = c => c.broad > EG_MARK_THRESHOLD && c.core > EG_CORE_MIN_FOR_CONFIDENT;

      let best = null, second = -Infinity;
      const aboveThreshold = [];
      candidates.forEach(c => {
        if (genuine(c)) aboveThreshold.push(c);
        if (!best || c.broad > best.broad) { second = best ? best.broad : second; best = c; }
        else if (c.broad > second) { second = c.broad; }
      });

      if (aboveThreshold.length >= 2) {
        return { value: best, margin: best.broad - second, flag: "multi", multiOptions: aboveThreshold };
      }
      if (best && genuine(best)) {
        return { value: best, margin: best.broad - (second === -Infinity ? 0 : second), flag: null };
      }

      let coreBest = null, coreSecond = -Infinity;
      candidates.forEach(c => {
        if (!coreBest || c.core > coreBest.core) { coreSecond = coreBest ? coreBest.core : coreSecond; coreBest = c; }
        else if (c.core > coreSecond) { coreSecond = c.core; }
      });
      const coreMargin = coreBest ? coreBest.core - (coreSecond === -Infinity ? 0 : coreSecond) : 0;
      if (coreBest && coreBest.core > EG_CORE_THRESHOLD && coreMargin > EG_CORE_MARGIN) {
        return { value: coreBest, margin: coreMargin, flag: "faint" };
      }

      return { value: null, margin: best ? best.broad - (second === -Infinity ? 0 : second) : 0, flag: null };
    }

    const setPick = pickBest(map.setBubbles.map(b => ({ x: b.x, y: b.y, letter: b.letter })));
    const setLetter = setPick.value ? setPick.value.letter : null;
    const setFlag = setPick.flag || null;
    const setMultiOptions = setPick.flag === "multi" ? setPick.multiOptions : null;

    const rollFlags = [];
    const rollMultiOptions = [];
    const rollDigitsDetected = map.rollColumns.map(col => {
      const pick = pickBest(col.map(b => ({ x: b.x, y: b.y, digit: b.digit })));
      rollFlags.push(pick.flag || null);
      rollMultiOptions.push(pick.flag === "multi" ? pick.multiOptions : null);
      return pick.value ? pick.value.digit : null;
    });
    const rollKnown = rollDigitsDetected.every(d => d !== null);
    const roll = rollKnown ? rollDigitsDetected.join("") : rollDigitsDetected.map(d => d === null ? "?" : d).join("");

    const answers = {};
    const answerFlags = {};
    const answerMultiOptions = {};
    Object.keys(map.questionBubbles).forEach(qStr => {
      const q = Number(qStr);
      const pick = pickBest(map.questionBubbles[q]);
      answers[q] = pick.value ? pick.value.opt : null; // 0..3 or null (blank)
      answerFlags[q] = pick.flag || null;
      if (pick.flag === "multi") answerMultiOptions[q] = pick.multiOptions;
    });

    return {
      setLetter, setFlag, setMultiOptions,
      roll, rollDigitsDetected, rollFlags, rollMultiOptions,
      answers, answerFlags, answerMultiOptions,
      totalQuestions: map.totalQuestions, map
    };
  }

  // Scores a detection against the exam's Answer Key (the key for the
  // detected Set, falling back to Set A / the legacy single key).
  function examgrGradeSheet(ex, detected) {
    const keyArr = examgrResolveAnswerKeyForGrading(ex, detected.setLetter);
    let correct = 0, wrong = 0, blank = 0, ungraded = 0, flagged = 0;
    const perQuestion = [];
    for (let q = 1; q <= detected.totalQuestions; q++) {
      const detectedOpt = detected.answers[q]; // 0..3 or null
      const detectedLetter = detectedOpt === null || detectedOpt === undefined ? null : OPTION_LETTERS[detectedOpt];
      const correctLetter = keyArr[q - 1] || null;
      const flag = detected.answerFlags ? (detected.answerFlags[q] || null) : null;
      const multiOptions = detected.answerMultiOptions ? (detected.answerMultiOptions[q] || null) : null;
      let status;
      if (!correctLetter) { status = "ungraded"; ungraded++; }
      else if (detectedLetter === null) { status = "blank"; blank++; }
      else if (detectedLetter === correctLetter) { status = "correct"; correct++; }
      else { status = "wrong"; wrong++; }
      if (flag) flagged++;
      perQuestion.push({ q, detectedOpt, detectedLetter, correctLetter, status, flag, multiOptions });
    }
    const marks = correct; // 1 mark per correct answer, no negative marking (matches printed sheet)
    return { marks, correct, wrong, blank, ungraded, flagged, perQuestion, setLetter: detected.setLetter, roll: detected.roll };
  }

  // Paints the grading result straight onto the captured canvas — bold
  // green/red dot on the bubble the student actually marked (matches the
  // key or not), a small pale-gold dot on the CORRECT bubble whenever the
  // student left it blank or got it wrong (so a teacher sees both what
  // was marked and what should have been marked at a glance), a
  // neutral gold dot (with a dark centre, since it IS a real detected
  // mark) on Roll No / Exam Set bubbles, which have no right/wrong, and a
  // blue outline ring on anything pickBest flagged "faint" (a light
  // dot/tick, not a fully-shaded bubble) or "multi" (two-plus options
  // both look genuinely filled) — signals "double check this one by eye"
  // without silently guessing either way.
  function examgrPaintOverlay(canvas, ex, detected, graded) {
    const ctx = canvas.getContext("2d");
    const map = detected.map;

    function dot(x, y, r, fill, withCore) {
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
    }
    function paleDot(x, y, r, fill) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Thin outline ring, drawn ON TOP of (never instead of) the normal
    // grading dot — a distinct colour reserved only for "please double
    // check this one", so it's never confused with correct/wrong/blank.
    function ringOutline(x, y, r, color) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
      ctx.stroke();
    }

    const GREEN = "#18d631", RED = "#e11d1d", GOLD = "#f5b400", REVIEW_BLUE = "#2f7bff";

    graded.perQuestion.forEach(pq => {
      const optsPx = map.questionBubbles[pq.q];
      if (!optsPx) return;
      if (pq.status === "correct") {
        const px = optsPx[pq.detectedOpt];
        dot(px.x, px.y, 9, GREEN, true);
      } else if (pq.status === "wrong") {
        const px = optsPx[pq.detectedOpt];
        dot(px.x, px.y, 9, RED, true);
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

      // Low-confidence flags — a blue ring around the picked bubble for a
      // faint/partial mark, or around EVERY option that looked genuinely
      // filled when two or more competed (multiple marks). Independent of
      // the correct/wrong colouring above, so it always stands out the
      // same way regardless of grading outcome.
      if (pq.flag === "faint" && pq.detectedOpt !== null && pq.detectedOpt !== undefined) {
        const px = optsPx[pq.detectedOpt];
        if (px) ringOutline(px.x, px.y, 13, REVIEW_BLUE);
      } else if (pq.flag === "multi" && Array.isArray(pq.multiOptions)) {
        pq.multiOptions.forEach(o => ringOutline(o.x, o.y, 13, REVIEW_BLUE));
      }
    });

    if (detected.setLetter) {
      const b = map.setBubbles.find(s => s.letter === detected.setLetter);
      if (b) dot(b.x, b.y, 9, GOLD, true);
    }
    if (detected.setFlag === "faint" && detected.setLetter) {
      const b = map.setBubbles.find(s => s.letter === detected.setLetter);
      if (b) ringOutline(b.x, b.y, 13, REVIEW_BLUE);
    } else if (detected.setFlag === "multi" && Array.isArray(detected.setMultiOptions)) {
      detected.setMultiOptions.forEach(o => ringOutline(o.x, o.y, 13, REVIEW_BLUE));
    }

    detected.rollDigitsDetected.forEach((digit, colIdx) => {
      if (digit !== null) {
        const b = map.rollColumns[colIdx].find(d => d.digit === digit);
        if (b) dot(b.x, b.y, 9, GOLD, true);
      }
      const flag = detected.rollFlags ? detected.rollFlags[colIdx] : null;
      if (flag === "faint" && digit !== null) {
        const b = map.rollColumns[colIdx].find(d => d.digit === digit);
        if (b) ringOutline(b.x, b.y, 13, REVIEW_BLUE);
      } else if (flag === "multi" && detected.rollMultiOptions && Array.isArray(detected.rollMultiOptions[colIdx])) {
        detected.rollMultiOptions[colIdx].forEach(o => ringOutline(o.x, o.y, 13, REVIEW_BLUE));
      }
    });
  }

  // Tiny (≤ ~90px-wide) low-quality thumbnail so a scan result's photo
  // can be reopened from Reports without bloating the exam document —
  // Firestore caps a document at 1MB and a class can have 100+ results
  // saved on the SAME exam doc, so a full-resolution photo per result is
  // not an option here.
  function examgrMakeThumb(canvas) {
    const scale = 90 / canvas.width;
    const t = document.createElement("canvas");
    t.width = Math.round(canvas.width * scale);
    t.height = Math.round(canvas.height * scale);
    t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL("image/jpeg", 0.45);
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
  const EG_MARKER_HISTORY_SIZE = 4; // ~4 × 130ms ≈ half a second of averaging

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
      setScannerStatus("Sheet ko poori tarah camera frame ke andar rakhein aur dobara try karein.", 4, false);
      return;
    }

    // Freeze the detection loop and fire the shutter sound right at the
    // capture instant — matches the reference video's timing exactly.
    if (scannerAnimationFrame) { cancelAnimationFrame(scannerAnimationFrame); scannerAnimationFrame = null; }
    examgrPlayShutterSound();

    // Grab the FULL raw frame at native video resolution first — the old
    // code cropped straight out of <video> with a single rectangle, which
    // is exactly what a true perspective warp can't do (it needs the
    // whole frame to sample from, since the 4 markers are rarely an
    // axis-aligned rectangle on a hand-held shot).
    if (!scannerRawVideoCanvas) scannerRawVideoCanvas = document.createElement("canvas");
    scannerRawVideoCanvas.width = videoWidth;
    scannerRawVideoCanvas.height = videoHeight;
    scannerRawVideoCanvas.getContext("2d").drawImage(scannerVideo, 0, 0, videoWidth, videoHeight);

    // True 4-point perspective correction (see egWarpPerspective above)
    // instead of the old single axis-aligned scale/crop — this is what
    // keeps every bubble on the flattened sheet lined up with the print
    // template regardless of how tilted the phone was held.
    const templateQuad = [
      OMR_SCAN_MARKERS["top-left"], OMR_SCAN_MARKERS["top-right"],
      OMR_SCAN_MARKERS["bottom-left"], OMR_SCAN_MARKERS["bottom-right"]
    ];
    const warped = egWarpPerspective(scannerRawVideoCanvas, videoQuad, templateQuad, OMR_CANVAS_SIZE);

    scannerCaptureCanvas.width = OMR_CANVAS_SIZE.width;
    scannerCaptureCanvas.height = OMR_CANVAS_SIZE.height;
    scannerCaptureCanvas.getContext("2d").drawImage(warped, 0, 0);
    // Strip any camera/video colour cast (see egDesaturateCanvas) right
    // away, on the ONE canvas everything downstream is copied from —
    // registration squares and bubbles are pure black/white ink, so a
    // clean grayscale capture here is what stops a blue tint from ever
    // reaching the raw copy, the grading read, the review photo, or the
    // saved image.
    egDesaturateCanvas(scannerCaptureCanvas);
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
    scannerCaptureEl.src = scannerCaptureCanvas.toDataURL("image/jpeg", 0.92);
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
      totalQuestions: scannerGraded.perQuestion.length,
      answers: scannerGraded.perQuestion.map(pq => pq.detectedLetter || null),
      // flag/multiOptions per question (see pickBest) — kept so the Report
      // Detail screen can show "A, C" for a double-marked question instead
      // of silently collapsing it to whichever option pickBest guessed.
      // Stored as a comma-joined STRING (not a nested array) — Firestore
      // rejects an array whose elements are themselves arrays, even
      // inside arrayUnion(), so ["A","C"] per question would break every
      // save the moment any question had a genuine double-mark.
      flags: scannerGraded.perQuestion.map(pq => pq.flag || null),
      multiOptions: scannerGraded.perQuestion.map(pq =>
        pq.multiOptions && pq.multiOptions.length ? pq.multiOptions.map(o => OPTION_LETTERS[o.opt]).join(",") : null),
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
    if (now - scannerLastDetectionAt < 130) return;
    scannerLastDetectionAt = now;

    const mapping = getVideoDisplayMapping();
    if (!mapping) return;
    const analysisWidth = Math.min(720, mapping.videoWidth);
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
    } else {
      scannerMarkerHistory = [];
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
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1920 } }
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
          ${r.thumb ? `<img class="examgr-report-thumb" src="${r.thumb}" data-full="${r.thumb}" alt="Scanned sheet">` : ""}
        </div>`).join("")
        : '<div class="examgr-empty">📷 Abhi tak koi sheet scan nahi hui — "Scan Sheet" se shuru karein.</div>';
    }

    // Sorted list + which student to jump to are shared with Report Detail
    // (tapping a row opens the same order, so rank/prev/next line up).
    examgrReportList = results;

    $id("examgr-details-overlay")?.classList.add("hidden");
    $id("examgr-reports-overlay")?.classList.remove("hidden");
  }

  function examgrCloseReports() {
    $id("examgr-reports-overlay")?.classList.add("hidden");
    $id("examgr-details-overlay")?.classList.remove("hidden");
  }
  window.examgrCloseReports = examgrCloseReports;

  $id("examgr-reports-list")?.addEventListener("click", (e) => {
    const thumb = e.target.closest(".examgr-report-thumb");
    if (thumb) {
      const img = $id("examgr-report-photo-img");
      if (img) img.src = thumb.dataset.full;
      $id("examgr-report-photo-overlay")?.classList.remove("hidden");
      return;
    }
    const row = e.target.closest(".examgr-report-row");
    if (!row) return;
    examgrOpenReportDetail(Number(row.dataset.idx));
  });

  function examgrCloseReportPhoto() {
    $id("examgr-report-photo-overlay")?.classList.add("hidden");
  }
  window.examgrCloseReportPhoto = examgrCloseReportPhoto;

  // ────────────────────────────────────────────────────────────────
  // Report Detail — single-student drill-down from the Reports list:
  // full Subject/Marks/Percentage/Correct-Answers summary, the scanned
  // sheet photo, a per-question Attempted/Correct/Marks table, and
  // Delete / Edit / Share actions with Prev/Next to flip through every
  // scanned student without going back to the list each time.
  // ────────────────────────────────────────────────────────────────
  let examgrReportList = [];   // same sorted array examgrOpenReports built
  let examgrReportIndex = 0;

  // This app doesn't have a real multi-subject/section configuration (an
  // exam is just N questions against one Answer Key) — the summary table
  // below always shows a single generic "Subject 1" / "Section1" row
  // mirroring the exam's one true total, plus the "Total Marks" row.
  function examgrReportSummaryRows(ex, r) {
    const total = Number(r.totalQuestions) || Number(ex.questions) || 0;
    const marks = Number(r.marks) || 0;
    const pct = total ? (marks / total * 100) : 0;
    const correct = Number(r.correct) || 0;
    const row = { marks: marks.toFixed(1), pct: pct.toFixed(1) + "%", correct };
    return [
      { label: "Subject 1", ...row },
      { label: "Section1", ...row },
      { label: "Total Marks", ...row, total: true }
    ];
  }

  function examgrReportQuestionRows(ex, r) {
    const total = Number(r.totalQuestions) || Number(ex.questions) || 0;
    const keyArr = examgrResolveAnswerKeyForGrading(ex, r.setLetter);
    const answers = Array.isArray(r.answers) ? r.answers : [];
    const flags = Array.isArray(r.flags) ? r.flags : [];
    const multi = Array.isArray(r.multiOptions) ? r.multiOptions : [];
    const rows = [];
    for (let i = 0; i < total; i++) {
      const correctLetter = keyArr[i] || null;
      const detected = answers[i] || null;
      const flag = flags[i] || null;
      const attemptedText = flag === "multi" && multi[i]
        ? multi[i].split(",").join(", ")
        : (detected || "");
      let status = "blank";
      if (!correctLetter) status = "ungraded";
      else if (!detected) status = "blank";
      else if (detected === correctLetter) status = "correct";
      else status = "wrong";
      const marks = status === "correct" ? 1 : 0;
      rows.push({ q: i + 1, attemptedText, correctLetter: correctLetter || "—", marks, status, flag });
    }
    return rows;
  }

  function examgrRenderReportDetail() {
    const ex = examMgrExams[examMgrSelectedId];
    const r = examgrReportList[examgrReportIndex];
    if (!ex || !r) return;

    $id("examgr-rd-title").textContent = `Roll No : ${r.roll || "—"}`;
    $id("examgr-rd-page-text").textContent = `Report ${examgrReportIndex + 1}/${examgrReportList.length}`;
    $id("examgr-rd-prev-btn").disabled = examgrReportIndex <= 0;
    $id("examgr-rd-next-btn").disabled = examgrReportIndex >= examgrReportList.length - 1;

    const summaryRows = examgrReportSummaryRows(ex, r);
    const qRows = examgrReportQuestionRows(ex, r);

    const body = $id("examgr-rd-body");
    if (!body) return;
    body.innerHTML = `
      <div class="examgr-rd-info-row"><span>Class</span><span>${escHtml(ex.className || "—")}</span></div>
      <div class="examgr-rd-info-row"><span>Exam</span><span>${escHtml(ex.examName || "—")}</span></div>
      <div class="examgr-rd-info-row"><span>Exam Set</span><span>${escHtml(r.setLetter || "—")}</span></div>
      <div class="examgr-rd-info-row"><span>Rank</span><span>${examgrReportIndex + 1}</span></div>

      <table class="examgr-rd-table">
        <thead><tr><th>Subject</th><th>Marks</th><th>Percentage</th><th>Correct Answers</th></tr></thead>
        <tbody>
          ${summaryRows.map(row => `
            <tr${row.total ? ' class="examgr-rd-total-row"' : ""}>
              <td>${escHtml(row.label)}</td>
              <td class="examgr-rd-num">${row.marks}</td>
              <td class="examgr-rd-num">${row.pct}</td>
              <td class="examgr-rd-num">${row.correct}</td>
            </tr>`).join("")}
        </tbody>
      </table>

      ${r.thumb ? `<div class="examgr-rd-sheet-img-wrap"><img class="examgr-rd-sheet-img" id="examgr-rd-sheet-img" src="${r.thumb}" alt="Scanned sheet"></div>` : ""}

      <table class="examgr-rd-table examgr-rd-qtable">
        <thead><tr><th>Q No</th><th>Attempted</th><th>Correct</th><th>Marks</th></tr></thead>
        <tbody>
          ${qRows.map(row => `
            <tr class="examgr-rd-row-${row.status}">
              <td>${row.q}</td>
              <td class="examgr-rd-attempted${row.flag === "multi" ? " examgr-rd-flag-multi" : row.flag === "faint" ? " examgr-rd-flag-faint" : ""}">${escHtml(row.attemptedText)}</td>
              <td>${escHtml(row.correctLetter)}</td>
              <td class="examgr-rd-num">${row.marks.toFixed(1)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    `;
  }

  function examgrOpenReportDetail(idx) {
    if (!examgrReportList.length) return;
    examgrReportIndex = Math.max(0, Math.min(examgrReportList.length - 1, idx || 0));
    examgrRenderReportDetail();
    $id("examgr-reports-overlay")?.classList.add("hidden");
    $id("examgr-report-detail-overlay")?.classList.remove("hidden");
  }

  function examgrCloseReportDetail() {
    $id("examgr-report-detail-overlay")?.classList.add("hidden");
    $id("examgr-reports-overlay")?.classList.remove("hidden");
  }
  window.examgrCloseReportDetail = examgrCloseReportDetail;

  $id("examgr-rd-back-btn")?.addEventListener("click", examgrCloseReportDetail);
  $id("examgr-rd-prev-btn")?.addEventListener("click", () => {
    if (examgrReportIndex > 0) { examgrReportIndex--; examgrRenderReportDetail(); }
  });
  $id("examgr-rd-next-btn")?.addEventListener("click", () => {
    if (examgrReportIndex < examgrReportList.length - 1) { examgrReportIndex++; examgrRenderReportDetail(); }
  });
  $id("examgr-rd-body")?.addEventListener("click", (e) => {
    const img = e.target.closest("#examgr-rd-sheet-img");
    if (!img) return;
    const photoImg = $id("examgr-report-photo-img");
    if (photoImg) photoImg.src = img.src;
    $id("examgr-report-photo-overlay")?.classList.remove("hidden");
  });

  // Persists the (possibly edited/deleted) results array for the current
  // exam back to Firestore. arrayUnion only appends, so any edit/delete
  // has to overwrite the whole `results` field.
  async function examgrPersistResults(id, ex) {
    const database = db();
    if (!database) { alert("Firebase se connect nahi ho paya — internet check karein."); return false; }
    try {
      await database.collection(COLLECTION).doc(id).update({
        results: ex.results,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (err) {
      alert("Save nahi ho paya: " + (err.message || err));
      return false;
    }
  }

  $id("examgr-rd-delete-btn")?.addEventListener("click", async () => {
    const id = examMgrSelectedId;
    const ex = examMgrExams[id];
    const r = examgrReportList[examgrReportIndex];
    if (!ex || !r) return;
    if (!confirm(`Roll No ${r.roll || "—"} ka result delete karein? Ye wapas nahi hoga.`)) return;

    const results = Array.isArray(ex.results) ? ex.results : [];
    const pos = results.findIndex(x => x.id === r.id);
    if (pos === -1) return;
    results.splice(pos, 1);
    ex.results = results;
    ex.scanned = results.length;

    const ok = await examgrPersistResults(id, ex);
    if (!ok) return;

    const nextIndex = Math.min(examgrReportIndex, results.length - 1);
    examgrOpenReports(); // rebuilds + re-sorts the list (and examgrReportList) from ex.results
    if (results.length) examgrOpenReportDetail(nextIndex);
    else examgrCloseReportDetail();
  });

  $id("examgr-rd-share-btn")?.addEventListener("click", async () => {
    const ex = examMgrExams[examMgrSelectedId];
    const r = examgrReportList[examgrReportIndex];
    if (!ex || !r) return;
    const total = Number(r.totalQuestions) || Number(ex.questions) || 0;
    const text = `${ex.examName || "Exam"} — Roll No ${r.roll || "—"}\n` +
      `Class: ${ex.className || "—"} · Set: ${r.setLetter || "—"}\n` +
      `Marks: ${(Number(r.marks) || 0).toFixed(1)} / ${total} (${total ? ((Number(r.marks) || 0) / total * 100).toFixed(1) : "0.0"}%)\n` +
      `Correct: ${r.correct || 0} · Wrong: ${r.wrong || 0} · Blank: ${r.blank || 0}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Roll No ${r.roll} Report`, text }); }
      catch (err) { /* user cancelled share — nothing to do */ }
    } else if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(text); examgrShowNotice("📋 Report clipboard mein copy ho gaya."); }
      catch (err) { alert(text); }
    } else {
      alert(text);
    }
  });

  // ── Report Detail → Edit (Roll No / Set / individual answers) ──
  let editRdDraftSet = null;
  let editRdDraftRollDigits = [];
  let editRdDraftAnswers = {};

  function examgrOpenReportEdit() {
    const ex = examMgrExams[examMgrSelectedId];
    const r = examgrReportList[examgrReportIndex];
    if (!ex || !r) return;

    const rollDigits = Math.max(1, Math.min(5, Number(ex.rollDigits) || 5));
    editRdDraftRollDigits = String(r.roll || "").padStart(rollDigits, "?").slice(-rollDigits)
      .split("").map(c => (c >= "0" && c <= "9") ? Number(c) : null);
    editRdDraftSet = r.setLetter || null;
    const total = Number(r.totalQuestions) || Number(ex.questions) || 0;
    const answers = Array.isArray(r.answers) ? r.answers : [];
    editRdDraftAnswers = {};
    for (let i = 0; i < total; i++) editRdDraftAnswers[i + 1] = answers[i] || null;

    const rollsetEl = $id("examgr-rd-edit-rollset");
    if (rollsetEl) {
      rollsetEl.innerHTML = `
        <div class="examgr-edit-block">
          <label>Roll No</label>
          <div style="display:flex;gap:6px;">
            ${editRdDraftRollDigits.map((d, i) => `
              <select class="examgr-edit-roll-digit" data-col="${i}" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid rgba(30,27,75,.15);text-align:center;font-weight:700;color:var(--navy);background:#fff;">
                <option value="">?</option>
                ${Array.from({ length: 10 }, (_, n) => `<option value="${n}"${d === n ? " selected" : ""}>${n}</option>`).join("")}
              </select>`).join("")}
          </div>
        </div>
        <div class="examgr-edit-block" style="margin-top:12px;">
          <label>Exam Set</label>
          <select id="examgr-rd-edit-set" style="width:100%;padding:9px;border-radius:8px;border:1.5px solid rgba(30,27,75,.15);font-weight:700;color:var(--navy);background:#fff;">
            ${SET_LETTERS.map(l => `<option value="${l}"${editRdDraftSet === l ? " selected" : ""}>${l}</option>`).join("")}
          </select>
        </div>`;
      rollsetEl.querySelectorAll(".examgr-edit-roll-digit").forEach(sel => {
        sel.addEventListener("change", (e) => {
          const col = Number(e.target.dataset.col);
          editRdDraftRollDigits[col] = e.target.value === "" ? null : Number(e.target.value);
        });
      });
      $id("examgr-rd-edit-set")?.addEventListener("change", (e) => { editRdDraftSet = e.target.value; });
    }

    const qlistEl = $id("examgr-rd-edit-qlist");
    if (qlistEl) {
      qlistEl.innerHTML = Array.from({ length: total }, (_, i) => {
        const q = i + 1;
        return `
        <div class="examgr-akey-row">
          <span class="examgr-akey-qnum">${q}</span>
          ${OPTION_LETTERS.map(letter => `
            <button type="button" class="examgr-akey-opt${editRdDraftAnswers[q] === letter ? " selected" : ""}" data-rq="${q}" data-letter="${letter}">${letter}</button>`).join("")}
        </div>`;
      }).join("");
    }

    $id("examgr-report-detail-overlay")?.classList.add("hidden");
    $id("examgr-report-edit-overlay")?.classList.remove("hidden");
  }

  function examgrCloseReportEdit() {
    $id("examgr-report-edit-overlay")?.classList.add("hidden");
    $id("examgr-report-detail-overlay")?.classList.remove("hidden");
  }
  window.examgrCloseReportEdit = examgrCloseReportEdit;

  $id("examgr-rd-edit-btn")?.addEventListener("click", examgrOpenReportEdit);

  $id("examgr-rd-edit-qlist")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rq]");
    if (!btn) return;
    const q = Number(btn.dataset.rq);
    const letter = btn.dataset.letter;
    editRdDraftAnswers[q] = editRdDraftAnswers[q] === letter ? null : letter;
    const row = btn.closest(".examgr-akey-row");
    row.querySelectorAll(".examgr-akey-opt").forEach(b =>
      b.classList.toggle("selected", b.dataset.letter === editRdDraftAnswers[q]));
  });

  $id("examgr-rd-edit-save-btn")?.addEventListener("click", async () => {
    const id = examMgrSelectedId;
    const ex = examMgrExams[id];
    const r = examgrReportList[examgrReportIndex];
    if (!ex || !r) return;

    const rollKnown = editRdDraftRollDigits.every(d => d !== null);
    const roll = rollKnown ? editRdDraftRollDigits.join("") : editRdDraftRollDigits.map(d => d === null ? "?" : d).join("");
    const total = Number(r.totalQuestions) || Number(ex.questions) || 0;
    const keyArr = examgrResolveAnswerKeyForGrading(ex, editRdDraftSet);

    let correct = 0, wrong = 0, blank = 0;
    const answers = [];
    for (let i = 0; i < total; i++) {
      const letter = editRdDraftAnswers[i + 1] || null;
      answers.push(letter);
      const correctLetter = keyArr[i] || null;
      if (!letter) blank++;
      else if (correctLetter && letter === correctLetter) correct++;
      else wrong++;
    }

    r.roll = roll;
    r.setLetter = editRdDraftSet;
    r.answers = answers;
    r.flags = new Array(total).fill(null);   // manual edit resolves any multi/faint flag
    r.multiOptions = new Array(total).fill(null);
    r.correct = correct;
    r.wrong = wrong;
    r.blank = blank;
    r.marks = correct;

    const results = Array.isArray(ex.results) ? ex.results : [];
    const pos = results.findIndex(x => x.id === r.id);
    if (pos !== -1) results[pos] = r;
    ex.results = results;

    const btn = $id("examgr-rd-edit-save-btn");
    const originalLabel = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Saving..."; }
    const ok = await examgrPersistResults(id, ex);
    if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
    if (!ok) return;

    examgrReportList[examgrReportIndex] = r;
    examgrRenderReportDetail();
    examgrCloseReportEdit();
  });

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
