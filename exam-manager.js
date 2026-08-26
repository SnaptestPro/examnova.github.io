/* ══════════════════════════════════════════════════════════════════
   SAVYASACHI COACHING — EXAM MANAGER (OMR hub ka 5th section)
   ══════════════════════════════════════════════════════════════════
   Ye ek halka, self-contained bookkeeping tool hai offline/paper exams
   ke liye — question bank ya "Tests" collection se koi lena-dena nahi.
   Ismein ye sab hai:
     • Exam banayein (naam, class, date, questions, sets, students)
     • Answer Key — har question ke liye A/B/C/D par click karke bharein
     • Scan Sheet — camera se sheet ke 4 corner ke kaale square detect
       karke "kitni sheets collect ho chuki" ka counter (⚠️ ye grading
       NAHI karta, sirf collection-counter hai — asli AI-based answer
       padhne/grading ke liye upar wala "📷 Photo Se Scan" tool use karein)
     • OMR/Bubble Sheet — fixed 100-question/5-column printable sheet
     • Settings, Web Link, View Reports, Download Excel, Analysis,
       Publish, Absentees, Delete

   Pehle ye sab ek alag prototype app mein localStorage par tha; ab
   sab kuch Firestore collection "examManagerExams" mein save hota hai,
   isliye kisi bhi device/browser se same data dikhega.

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

  // ---- state ----
  let examMgrExams = {};        // id -> Firestore doc data (local cache)
  let examMgrSortDesc = true;   // true = newest date first
  let examMgrSelectedId = null; // currently open exam (details sheet)

  // Answer Key draft (working copy until Save is pressed)
  let akeyDraft = [];
  let akeyOriginal = [];

  // Scanner state
  let scannerStream = null;
  let scannerAnimationFrame = null;
  let scannerLastDetectionAt = 0;
  let scannerStableFrames = 0;
  let scannerCapturing = false;
  let scannerCameraRequestInProgress = false;

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
      answerKey: [],
      absentees: "",
      webLink: "",
      published: false,
      rollDigits: 5,
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

    if (!examName) { alert("Exam ka naam likhein."); return; }
    questions = Math.max(1, Math.min(MAX_QUESTIONS, questions));
    sets = Math.max(1, sets);
    students = Math.max(0, students);

    const btn = $id("examgr-add-save-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Save ho raha hai...";
    const id = await createExamManagerExam({ examName, className, date, questions, sets, students });
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
      updateExamManagerExam(id, { questions: Math.min(MAX_QUESTIONS, n) }).then(ok => {
        if (ok) { renderExamMgrDetails(); renderExamMgrList(); examgrShowNotice("✅ Settings save ho gayi."); }
      });
    } else if (action === "web-features") {
      const val = window.prompt("Is exam ke liye web link daalein:", ex.webLink || "");
      if (val === null) return;
      updateExamManagerExam(id, { webLink: val.trim() }).then(ok => { if (ok) examgrShowNotice("✅ Web link save ho gaya."); });
    } else if (action === "view-reports") {
      examgrShowNotice(`📊 ${Number(ex.scanned) || 0} sheet(s) collect ho chuki hain. ${ex.absentees ? "Absentees list saved hai." : "Absentees abhi save nahi hui."}`);
    } else if (action === "download-excel") {
      examgrDownloadCsv(ex);
    } else if (action === "analysis") {
      examgrShowNotice(`📈 Analysis: ${Number(ex.scanned) || 0} sheet(s) is exam ke liye ready hain.`);
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
    const csv = rows.map(r => r.map(csvCell).join(",")).join("\n");
    downloadBlob(csv, "text/csv;charset=utf-8", safeFileName(ex.examName) + "-summary.csv");
  }

  // ────────────────────────────────────────────────────────────────
  // Answer Key (manual bubble entry)
  // ────────────────────────────────────────────────────────────────
  function examgrGetAnswerKeyArray(ex) {
    const count = Math.max(1, Math.min(MAX_QUESTIONS, Number(ex.questions) || MAX_QUESTIONS));
    const saved = Array.isArray(ex.answerKey) ? ex.answerKey : [];
    const arr = new Array(count).fill(null);
    for (let i = 0; i < count; i++) {
      const val = saved[i];
      if (OPTION_LETTERS.includes(val)) arr[i] = val;
    }
    return arr;
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

  function examgrOpenAnswerKey() {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    akeyDraft = examgrGetAnswerKeyArray(ex);
    akeyOriginal = akeyDraft.slice();
    const sub = $id("examgr-akey-sub");
    if (sub) sub.textContent = `${ex.examName || "Exam"} — ${akeyDraft.length} questions. Sahi option par click karein.`;
    examgrRenderAnswerKeyList();
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

  $id("examgr-akey-reset-btn")?.addEventListener("click", () => {
    akeyDraft = akeyDraft.map(() => null);
    examgrRenderAnswerKeyList();
  });

  $id("examgr-akey-save-btn")?.addEventListener("click", async () => {
    const id = examMgrSelectedId;
    if (!id) return;
    const btn = $id("examgr-akey-save-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Save ho raha hai...";
    const ok = await updateExamManagerExam(id, { answerKey: akeyDraft.slice() });
    btn.disabled = false;
    btn.textContent = originalLabel;
    if (ok) {
      akeyOriginal = akeyDraft.slice();
      examgrCloseAnswerKey(true);
      examgrShowNotice("✅ Answer key saved.");
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
    let html = egHeader(ex) + egMarkers() + egRollBlock(ex.rollDigits);
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
.examgr-omr-header-box{position:absolute;border:1.6px solid #333;color:#000;background:#fff;}
.examgr-omr-header-line{position:absolute;left:0;right:0;display:flex;border-bottom:1.6px solid #333;}
.examgr-omr-header-line:last-child{border-bottom:none;}
.examgr-omr-header-cell{flex:1;padding:11px 10px 0;font-size:24px;line-height:1;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.examgr-omr-header-cell + .examgr-omr-header-cell{border-left:1.6px solid #333;}
.examgr-omr-marker{position:absolute;width:20px;height:20px;background:#000;}
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

  function examgrBuildSheetPdf(ex) {
    const { jsPDF } = window.jspdf || {};
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
    doc.text("SAVYASACHI COACHING — OMR उत्तर पत्रक", mmPos(OMR_CANVAS_SIZE.width / 2), mmPos(30), { align: "center" });

    // Roll No block
    const rollDigits = Math.max(1, Math.min(5, Number(ex.rollDigits) || 5));
    const rollCenters = [190, 220, 250, 280, 310].slice(0, rollDigits);
    doc.setFontSize(pxFontToPt(14));
    doc.text("Roll No", mmPos(250), mmPos(208), { align: "center" });
    doc.setLineWidth(0.25);
    for (let i = 0; i < rollDigits; i++) doc.rect(mmPos(175 + i * 30), mmPos(220), mmPos(30), mmPos(30));
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

  $id("examgr-sheet-pdf-btn")?.addEventListener("click", () => {
    const ex = examMgrExams[examMgrSelectedId];
    if (!ex) return;
    const btn = $id("examgr-sheet-pdf-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ PDF Bana Rahe Hain...";
    try {
      const doc = examgrBuildSheetPdf(ex);
      doc.save(safeFileName(ex.examName || "omr") + "-omr-sheet.pdf");
    } catch (err) {
      alert("PDF banane mein dikkat aayi: " + (err && err.message ? err.message : err));
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Scan Sheet — camera + 4-corner black-square detection.
  // This is a COLLECTION COUNTER, not a grader: jab chaaron corner ke
  // kaale square align/detect ho jaate hain, ek photo capture hoti hai
  // aur exam.scanned +1 ho jaata hai. Answers padhne ke liye upar wala
  // asli "Photo Se Scan" (AI + pixel cross-check) tool istemal karein.
  // ────────────────────────────────────────────────────────────────
  const scannerStage = $id("examgr-scan-stage");
  const scannerVideo = $id("examgr-scan-video");
  const scannerCaptureEl = $id("examgr-scan-capture");
  const scannerOverlayUi = $id("examgr-scan-overlay-ui");
  const scannerStatusEl = $id("examgr-scan-status");
  const scannerStatusTextEl = $id("examgr-scan-status-text");
  const scannerMarkerCountEl = $id("examgr-scan-marker-count");
  const scannerFooter = $id("examgr-scan-footer");
  const scannerResultEl = $id("examgr-scan-result");
  const scannerResultTextEl = $id("examgr-scan-result-text");
  const scannerPermissionEl = $id("examgr-scan-permission");
  const scannerPermissionMsgEl = $id("examgr-scan-permission-msg");
  const scannerAnalysisCanvas = $id("examgr-scan-analysis-canvas");
  const scannerCaptureCanvas = $id("examgr-scan-capture-canvas");
  const scanCornerEls = scannerOverlayUi ? [...scannerOverlayUi.querySelectorAll(".examgr-scan-corner")] : [];

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
    if (scannerCaptureEl) { scannerCaptureEl.hidden = true; scannerCaptureEl.removeAttribute("src"); }
    if (scannerOverlayUi) scannerOverlayUi.hidden = false;
    if (scannerResultEl) scannerResultEl.hidden = true;
    if (scannerPermissionEl) scannerPermissionEl.hidden = true;
    if (scannerFooter) scannerFooter.hidden = false;
    resetScannerCorners();
    setScannerStatus("Kaale OMR squares dhoonde ja rahe hain...", 0, false);
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
      const squareEnough = smallestSide >= 4 && largestSide <= Math.min(width, height) * 0.72 && smallestSide / largestSide >= 0.58;
      if (squareEnough && fillRatio >= 0.38) {
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
    const videoWidth = scannerVideo.videoWidth, videoHeight = scannerVideo.videoHeight;
    if (!id || !videoWidth || !videoHeight) return;

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

    scannerCaptureCanvas.width = OMR_CANVAS_SIZE.width;
    scannerCaptureCanvas.height = OMR_CANVAS_SIZE.height;
    scannerCaptureCanvas.getContext("2d").drawImage(
      scannerVideo, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, OMR_CANVAS_SIZE.width, OMR_CANVAS_SIZE.height
    );
    scannerCaptureEl.src = scannerCaptureCanvas.toDataURL("image/jpeg", 0.92);
    scannerCaptureEl.hidden = false;
    scannerOverlayUi.hidden = true;
    scannerFooter.hidden = true;
    scannerResultEl.hidden = false;
    scannerResultTextEl.textContent = "Chaaron corner ke registration square detect ho gaye aur sheet capture ho gayi.";
    incrementExamScanned(id).then(() => renderExamMgrDetails());
    stopScannerCamera();
  }

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
    if (ready && scannerStableFrames >= 4) {
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

  $id("examgr-scan-again-btn")?.addEventListener("click", () => {
    resetScannerForLivePreview();
    startScannerCamera();
  });
  $id("examgr-scan-done-btn")?.addEventListener("click", examgrCloseScanner);
  $id("examgr-scan-enable-btn")?.addEventListener("click", startScannerCamera);
})();
