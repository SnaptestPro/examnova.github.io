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

  // Coarse grid of LOCAL white levels across the photo (handles a shadow
  // or angled light making one side of the sheet darker than the other),
  // bilinear-interpolated so any bubble can look up its own nearby
  // paper-white value instead of one number for the whole sheet.
  function egWhiteLevelField(gray, w, h, binsX, binsY) {
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

  function egSampleDarkness(gray, w, h, cx, cy, radius) {
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
  const EG_BUBBLE_RADIUS = 8;     // px — bubbles are drawn ~22px wide, sample safely inside the ring

  // Reads every registered bubble off the captured canvas and returns the
  // raw detection (no right/wrong judgement yet — that's examgrGradeSheet).
  function examgrDetectFromCanvas(canvas, ex) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const gray = egToGrayscale(ctx, w, h);
    const whiteField = egWhiteLevelField(gray, w, h);
    const map = examgrBubbleMap(ex);

    function darkAt(x, y) {
      return whiteField.at(x, y) - egSampleDarkness(gray, w, h, x, y, EG_BUBBLE_RADIUS);
    }
    function pickBest(candidates) {
      let best = null, second = -Infinity;
      candidates.forEach(c => {
        const dark = darkAt(c.x, c.y);
        if (!best || dark > best.dark) { second = best ? best.dark : second; best = { ...c, dark }; }
        else if (dark > second) { second = dark; }
      });
      const marked = best && best.dark > EG_MARK_THRESHOLD;
      return { value: marked ? best : null, margin: best ? best.dark - (second === -Infinity ? 0 : second) : 0 };
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
    Object.keys(map.questionBubbles).forEach(qStr => {
      const q = Number(qStr);
      const pick = pickBest(map.questionBubbles[q]);
      answers[q] = pick.value ? pick.value.opt : null; // 0..3 or null (blank)
    });

    return { setLetter, roll, rollDigitsDetected, answers, totalQuestions: map.totalQuestions, map };
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
      let status;
      if (!correctLetter) { status = "ungraded"; ungraded++; }
      else if (detectedLetter === null) { status = "blank"; blank++; }
      else if (detectedLetter === correctLetter) { status = "correct"; correct++; }
      else { status = "wrong"; wrong++; }
      perQuestion.push({ q, detectedOpt, detectedLetter, correctLetter, status });
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

    const GREEN = "#18d631", RED = "#e11d1d", GOLD = "#f5b400";

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

  function captureAlignedOmr(detectedMarkers) {
    const id = examMgrSelectedId;
    const ex = examMgrExams[id];
    const videoWidth = scannerVideo.videoWidth, videoHeight = scannerVideo.videoHeight;
    if (!id || !ex || !videoWidth || !videoHeight) return;

    const left = (detectedMarkers["top-left"].x + detectedMarkers["bottom-left"].x) / 2;
    const right = (detectedMarkers["top-right"].x + detectedMarkers["bottom-right"].x) / 2;
    const top = (detectedMarkers["top-left"].y + detectedMarkers["top-right"].y) / 2;
    const bottom = (detectedMarkers["bottom-left"].y + detectedMarkers["bottom-right"].y) / 2;
    const scaleX = (right - left) / (OMR_SCAN_MARKERS["top-right"].x - OMR_SCAN_MARKERS["top-left"].x);
    const scaleY = (bottom - top) / (OMR_SCAN_MARKERS["bottom-left"].y - OMR_SCAN_MARKERS["top-left"].y);
    const sourceX = Math.max(0, left - OMR_SCAN_MARKERS["top-left"].x * scaleX);
    const sourceY = Math.max(0, top - OMR_SCAN_MARKERS["top-left"].y * scaleY);
    const sourceWidth = Math.min(videoWidth - sourceX, OMR_CANVAS_SIZE.width * scaleX);
    const sourceHeight = Math.min(videoHeight - sourceY, OMR_CANVAS_SIZE.height * scaleY);
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      scannerCapturing = false;
      setScannerStatus("Sheet ko poori tarah camera frame ke andar rakhein aur dobara try karein.", 4, false);
      return;
    }

    // Freeze the detection loop and fire the shutter sound right at the
    // capture instant — matches the reference video's timing exactly.
    if (scannerAnimationFrame) { cancelAnimationFrame(scannerAnimationFrame); scannerAnimationFrame = null; }
    examgrPlayShutterSound();

    scannerCaptureCanvas.width = OMR_CANVAS_SIZE.width;
    scannerCaptureCanvas.height = OMR_CANVAS_SIZE.height;
    scannerCaptureCanvas.getContext("2d").drawImage(
      scannerVideo, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, OMR_CANVAS_SIZE.width, OMR_CANVAS_SIZE.height
    );
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
      answers: scannerGraded.perQuestion.map(pq => pq.detectedLetter || null),
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
    setScannerStatus(ready ? "Sab 4 markers mil gaye. Steady rakhein, auto-scan ho raha hai..." : "Kaale OMR squares ko blue corner box ke andar align karein.", detectedCount, ready);
    if (ready && scannerStableFrames >= 6) {
      scannerCapturing = true;
      captureAlignedOmr(detectedMarkers);
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
        <div class="examgr-report-row">
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
    if (!thumb) return;
    const img = $id("examgr-report-photo-img");
    if (img) img.src = thumb.dataset.full;
    $id("examgr-report-photo-overlay")?.classList.remove("hidden");
  });

  function examgrCloseReportPhoto() {
    $id("examgr-report-photo-overlay")?.classList.add("hidden");
  }
  window.examgrCloseReportPhoto = examgrCloseReportPhoto;

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
