/* ══════════════════════════════════════════════════════════════════
   EXAMNOVA — EXTRA STUDENT+ADMIN FEATURES
   ══════════════════════════════════════════════════════════════════
   Ye file script.js ke baad load hoti hai aur usi ke globals
   (current, records, questionBank, $, getDB, escHtml, fillFilter,
   getCustomSubjectOptions, getCustomChapterOptions, isValidQ,
   getQuestionSubject, cloneQ, shuffleArray, getStudentSession,
   normalizeMobile, beginExam, formatResultDate, bindEvent) reuse
   karti hai — koi bhi cheez dobara define nahi ki gayi.

   Features:
   1) Practice Mode      — unlimited, no timer-pressure, no leaderboard
   2) My Mistakes         — auto-collected wrong answers (revise anytime)
   3) My Progress         — score trend chart across all tests
   4) Study Streak        — daily streak badge
   ══════════════════════════════════════════════════════════════════ */

(function () {

  /* ── STALE-WHILE-REVALIDATE CACHE for student widgets ────────────
     Student baar-baar "Student" tab par click karta hai (kabhi Admin
     dekhne jaake wapas aata hai), aur pehle har baar mistakes/progress/
     streak/myResults — sab cheezein Firestore se dobara fetch
     hoti thin, jisse har baar kuch pal ke liye poora section khaali ya
     "Loading..." dikhta tha — jaise section refresh ho raha ho. Ab
     pichhli baar ka data turant (localStorage cache se) dikh jaata hai
     — chahe poora page hi kyun na reload hua ho — aur background mein
     fresh data laa kar chup-chaap update kar diya jaata hai —
     "Loading..." sirf bilkul pehli baar hi dikhega. Cache mobile-number
     se linked hai, isliye agar dusra student login kare to purana data
     kabhi nahi dikhta.
  ──────────────────────────────────────────────────────────────── */
  const EXTRAS_CACHE_PREFIX = "savya_extras_cache_";
  let extrasCache = { mobile: null, mistakes: null, progressRecs: null, streak: null, myResults: null };

  function loadExtrasCacheFromStorage(mobile) {
    try {
      const raw = localStorage.getItem(EXTRAS_CACHE_PREFIX + mobile);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function persistExtrasCache() {
    if (!extrasCache.mobile) return;
    try {
      const { mobile, ...rest } = extrasCache;
      localStorage.setItem(EXTRAS_CACHE_PREFIX + mobile, JSON.stringify(rest));
    } catch (e) { /* storage full/unavailable — silently skip, live data still works */ }
  }
  function cacheFor(mobile) {
    if (extrasCache.mobile !== mobile) {
      const stored = loadExtrasCacheFromStorage(mobile) || {};
      extrasCache = {
        mobile,
        mistakes: stored.mistakes || null,
        progressRecs: stored.progressRecs || null,
        streak: (typeof stored.streak === "number" ? stored.streak : null),
        myResults: stored.myResults || null
      };
    }
    return extrasCache;
  }

  /* ── 1) PRACTICE MODE ─────────────────────────────────────────── */

  let lastPracticeOptionsKey = "";
  let lastPracticeChapterKey = "";

  function getCheckedPracticeChapters() {
    return Array.from(document.querySelectorAll('#practice-chapter-list input[type=checkbox]:checked')).map(cb => cb.value);
  }

  function renderPracticeChapterList(subject) {
    const container = document.getElementById("practice-chapter-list");
    if (!container || typeof getCustomChapterOptions !== "function") return;
    const chapters = getCustomChapterOptions(subject);
    const key = subject + "::" + chapters.join("|");
    if (key === lastPracticeChapterKey && container.children.length) return; // avoid needless rebuild/flicker
    lastPracticeChapterKey = key;

    if (!chapters.length) {
      container.innerHTML = '<p class="muted-text">Is subject mein koi chapter nahi mila.</p>';
      return;
    }
    container.innerHTML = chapters.map(ch => `
      <label class="chapter-choice">
        <input type="checkbox" value="${escHtml(ch)}" />
        ${escHtml(ch)}
      </label>`).join("");
  }

  function selectAllPracticeChapters() {
    document.querySelectorAll('#practice-chapter-list input[type=checkbox]').forEach(cb => { cb.checked = true; });
  }

  function clearAllPracticeChapters() {
    document.querySelectorAll('#practice-chapter-list input[type=checkbox]').forEach(cb => { cb.checked = false; });
  }

  function syncPracticeFilters() {
    const subjSel = document.getElementById("practice-subject-filter");
    if (!subjSel || typeof questionBank === "undefined") return;

    const subjects = getCustomSubjectOptions();
    const key = subjects.join("|");
    if (key !== lastPracticeOptionsKey || !subjSel.options.length) {
      lastPracticeOptionsKey = key;
      fillFilter(subjSel, subjects, subjSel.value || "all", "— Sabhi Subjects —");
    }
    renderPracticeChapterList(subjSel.value || "all");
  }

  function startPracticeMode() {
    const session = getStudentSession();
    if (!session) { alert("Practice ke liye pehle login karein."); return; }
    if (typeof questionBank === "undefined" || !questionBank.length) {
      alert("Abhi koi question bank load nahi hua. Thodi der baad try karein.");
      return;
    }

    const subject = document.getElementById("practice-subject-filter")?.value || "all";
    const checkedChapters = getCheckedPracticeChapters();
    const count = Number(document.getElementById("practice-question-count")?.value || 10);
    if (!count || count <= 0) { alert("Questions count 0 se zyada hona chahiye."); return; }

    let pool = questionBank
      .filter(q => isValidQ(q) &&
        (subject === "all" || getQuestionSubject(q) === subject) &&
        (checkedChapters.length === 0 || checkedChapters.includes(q.chapter)))
      .map(cloneQ);
    pool = shuffleArray(pool);

    if (!pool.length) {
      alert("Is filter ke liye koi question available nahi hai.");
      return;
    }
    const finalQ = pool.slice(0, Math.min(count, pool.length));

    const chapterLabel = checkedChapters.length === 1
      ? checkedChapters[0]
      : (checkedChapters.length > 1 ? checkedChapters.length + " Chapters" : (subject !== "all" ? subject : "Mixed Topics"));

    current.student = {
      name: document.getElementById("student-name")?.value.trim() || session.name || "Student",
      mobile: document.getElementById("student-mobile")?.value.trim() || session.mobile || "",
      email: ""
    };
    current.testId = "practice-" + Date.now();
    current.test = {
      title: "🎯 Practice: " + chapterLabel,
      minutes: 999,
      marksPerQuestion: 1,
      negativeEnabled: false,
      negativeMarks: 0,
      custom: true,
      isPractice: true,
      questions: finalQ
    };
    beginExam();
  }

  /* ── 2) MY MISTAKES (auto-bookmark wrong answers) ────────────────── */

  function mistakeKeyFor(d) {
    const base = (d.subject || "") + "|" + (d.chapter || "") + "|" +
      (d.questionEN || d.questionHI || "").slice(0, 60);
    return base.toLowerCase().replace(/\s+/g, " ").trim();
  }

  async function saveMistakesFromDetails(student, testTitle, details) {
    const db = getDB();
    const mobile = normalizeMobile(student?.mobile || "");
    if (!db || !mobile) return;
    const wrongOnes = (details || []).filter(d => d.status === "Wrong");
    if (!wrongOnes.length) return;

    const ref = db.collection("studentMistakes").doc(mobile);
    const snap = await ref.get();
    let items = (snap.exists && Array.isArray(snap.data().items)) ? snap.data().items : [];
    const existingKeys = new Set(items.map(mistakeKeyFor));

    wrongOnes.forEach(d => {
      const key = mistakeKeyFor(d);
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      items.push({
        subject: d.subject || "", chapter: d.chapter || "",
        questionEN: d.questionEN || "", questionHI: d.questionHI || "",
        optionsEN: d.optionsEN || [], optionsHI: d.optionsHI || [],
        correctAnswer: d.correctAnswer,
        explanationEN: d.explanationEN || "", explanationHI: d.explanationHI || "",
        testTitle: testTitle || "", addedAt: new Date().toISOString()
      });
    });
    if (items.length > 300) items = items.slice(items.length - 300);
    try { await ref.set({ mobile, items }, { merge: true }); }
    catch (e) { console.warn("Mistake save failed", e); }
  }

  let currentMistakes = [];
  let _mistakesUnsub = null;
  let _mistakesUnsubMobile = null;

  // Live (real-time) subscription instead of a one-time read: once
  // subscribed for a given student, ANY change to their mistakes doc
  // (a new wrong answer saved right after a test, or "✅ Maine sikh liya"
  // removing one) repaints this list immediately — no need to wait for
  // the tab-visible 25s refresh poll or a manual tab re-open.
  function subscribeMyMistakesLive(mobile) {
    const db = getDB();
    if (!db || !mobile) return;
    if (_mistakesUnsubMobile === mobile && _mistakesUnsub) return; // already live for this student
    if (_mistakesUnsub) { _mistakesUnsub(); _mistakesUnsub = null; }
    _mistakesUnsubMobile = mobile;
    _mistakesUnsub = db.collection("studentMistakes").doc(mobile).onSnapshot(snap => {
      const items = (snap.exists && Array.isArray(snap.data().items)) ? snap.data().items : [];
      currentMistakes = items;
      cacheFor(mobile).mistakes = items;
      persistExtrasCache();
      paintMistakesList(currentMistakes, document.getElementById("my-mistakes-list"));
    }, (e) => console.warn("Mistakes live-sync failed", e));
  }

  function paintMistakesList(items, list) {
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<p class="muted-text">Koi mistake save nahi hai — bahut badhiya! 🎉</p>';
      return;
    }
    list.innerHTML = items.map((it, idx) => {
      const opts = (it.optionsHI && it.optionsHI.length) ? it.optionsHI : (it.optionsEN || []);
      const correctText = opts[it.correctAnswer] || "";
      const explain = it.explanationHI || it.explanationEN || "";
      return `
        <div class="card" style="margin-bottom:10px;padding:12px;">
          <div style="font-size:.78rem;color:#64748b;margin-bottom:4px;">
            ${escHtml(it.subject || "")}${it.chapter ? " · " + escHtml(it.chapter) : ""}
          </div>
          <div style="font-weight:600;margin-bottom:6px;">${escHtml(it.questionHI || it.questionEN || "")}</div>
          <div style="font-size:.85rem;color:#16a34a;margin-bottom:6px;">✅ Sahi jawab: ${escHtml(correctText)}</div>
          ${explain ? `<div style="font-size:.82rem;color:#475569;background:#f8fafc;border-radius:6px;padding:8px;margin-bottom:6px;">💡 ${escHtml(explain)}</div>` : ""}
          <button type="button" class="btn-secondary" style="font-size:.78rem;padding:4px 10px;" onclick="window.SavyaExtras.removeMistake(${idx})">✅ Maine sikh liya</button>
        </div>`;
    }).join("");
  }

  async function renderMyMistakes() {
    const list = document.getElementById("my-mistakes-list");
    const session = getStudentSession();
    if (!list || !session) return;
    const mobile = normalizeMobile(session.mobile);
    const cache = cacheFor(mobile);

    // Pichhli baar ka data cache mein ho to turant dikha do — "Loading..."
    // sirf pehli baar hi dikhega, dobara tab kholne par nahi.
    if (cache.mistakes) {
      currentMistakes = cache.mistakes;
      paintMistakesList(currentMistakes, list);
    } else {
      list.innerHTML = '<p class="muted-text">Loading...</p>';
    }

    subscribeMyMistakesLive(mobile); // switches to true real-time updates from here on
  }

  async function removeMistake(idx) {
    const session = getStudentSession();
    const db = getDB();
    if (!session || !db) return;
    const mobile = normalizeMobile(session.mobile);
    if (!mobile) return;
    const items = currentMistakes.slice();
    items.splice(idx, 1);
    try {
      await db.collection("studentMistakes").doc(mobile).set({ mobile, items }, { merge: true });
      cacheFor(mobile).mistakes = items; // optimistic — list se turant hata hua dikhe
      persistExtrasCache();
      renderMyMistakes();
    } catch (e) { console.warn("Remove mistake failed", e); alert("Remove nahi ho paya, dobara try karein."); }
  }

  function practiceMyMistakes() {
    if (!currentMistakes.length) { alert("Koi mistake nahi hai practice ke liye! 🎉"); return; }
    const session = getStudentSession();
    const pool = currentMistakes.map(it => ({
      textEN: it.questionEN, textHI: it.questionHI,
      text: it.questionHI || it.questionEN,
      optionsEN: it.optionsEN, optionsHI: it.optionsHI,
      options: (it.optionsHI && it.optionsHI.length) ? it.optionsHI : it.optionsEN,
      answer: Number(it.correctAnswer || 0),
      explanationEN: it.explanationEN, explanationHI: it.explanationHI,
      explanation: it.explanationHI || it.explanationEN,
      subject: it.subject, chapter: it.chapter
    }));
    current.student = {
      name: document.getElementById("student-name")?.value.trim() || session?.name || "Student",
      mobile: document.getElementById("student-mobile")?.value.trim() || session?.mobile || "",
      email: ""
    };
    current.testId = "mistakes-" + Date.now();
    current.test = {
      title: "🔁 Mistake Revision Practice",
      minutes: 999, marksPerQuestion: 1, negativeEnabled: false, negativeMarks: 0,
      custom: true, isPractice: true, questions: pool
    };
    beginExam();
  }

  /* ── 1b) WEAK-CHAPTER AUTO PRACTICE ───────────────────────────────
     Result screen ke "Chapter-wise Analysis" mein jo chapters weak/average
     (< 70% accuracy) nikalte hain, unhi chapters se poore question bank
     mein se (sirf is ek test ke questions se nahi) ek fresh mini-test bana
     deta hai — taaki student turant apni sabse kamzor jagah par practice
     kar sake, bina khud filters chunne ke.
  ──────────────────────────────────────────────────────────────── */
  function startWeakChapterPractice(chapters, count) {
    const session = getStudentSession();
    if (!session) { alert("Practice ke liye pehle login karein."); return; }
    if (typeof questionBank === "undefined" || !questionBank.length) {
      alert("Abhi koi question bank load nahi hua. Thodi der baad try karein.");
      return;
    }
    if (!chapters || !chapters.length) {
      alert("Koi weak chapter nahi mila — bahut badhiya performance hai! 🎉");
      return;
    }
    let pool = questionBank
      .filter(q => isValidQ(q) && chapters.includes(q.chapter))
      .map(cloneQ);
    pool = shuffleArray(pool);
    if (!pool.length) {
      alert("In chapters ke liye bank mein aur questions available nahi hain.");
      return;
    }
    const finalQ = pool.slice(0, Math.min(count || 15, pool.length));
    const label = chapters.length === 1 ? chapters[0] : chapters.length + " Weak Chapters";

    current.student = { name: session.name || "Student", mobile: session.mobile || "", email: "" };
    current.testId = "weakpractice-" + Date.now();
    current.test = {
      title: "🎯 Weak Topics Practice: " + label,
      minutes: 999, marksPerQuestion: 1, negativeEnabled: false, negativeMarks: 0,
      custom: true, isPractice: true, questions: finalQ
    };
    beginExam();
  }

  /* ── 3) MY PROGRESS (score trend chart) ─────────────────────────── */

  let progressChartInstance = null;

  function paintProgressChart(myRecs) {
    const emptyEl = document.getElementById("my-progress-empty");
    const canvas = document.getElementById("my-progress-chart");
    if (!emptyEl || !canvas || typeof Chart === "undefined") return;

    if (!myRecs.length) {
      emptyEl.style.display = "block";
      canvas.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";
    canvas.style.display = "block";

    const labels = myRecs.map(r => {
      const dateTxt = (typeof formatResultDate === "function") ? formatResultDate(r.submittedIso) : "";
      return (r.testTitle || "Test").slice(0, 16) + (dateTxt ? " · " + dateTxt : "");
    });
    const dataPct = myRecs.map(r => {
      const testCfg = (typeof tests !== "undefined") ? tests[r.testId] : null;
      const liveMax = (testCfg && typeof getTestGrandTotalMarks === "function") ? getTestGrandTotalMarks(testCfg) : 0;
      const maxScore = liveMax > 0 ? liveMax : (r.maxScore || 0);
      return maxScore > 0 ? Math.round((r.score / maxScore) * 100) : 0;
    });

    if (progressChartInstance) { progressChartInstance.destroy(); }
    progressChartInstance = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Score %",
          data: dataPct,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        scales: { y: { min: 0, max: 100, ticks: { callback: v => v + "%" } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  async function renderMyProgress() {
    const session = getStudentSession();
    const emptyEl = document.getElementById("my-progress-empty");
    const canvas = document.getElementById("my-progress-chart");
    if (!session || !emptyEl || !canvas || typeof Chart === "undefined") return;
    const mobile = normalizeMobile(session.mobile);
    const cache = cacheFor(mobile);

    // Cache mein pichhle records hue to unse chart turant bana do — tab
    // dobara kholte hi khaali chart flash na ho.
    if (cache.progressRecs) paintProgressChart(cache.progressRecs);

    // NOTE: don't rely on the shared `records` array here — syncRecords()
    // in script.js only keeps the most-recently-submitted 200 records
    // SITE-WIDE (across every student) for performance. Once the site has
    // more than 200 total submissions, an individual student's older
    // attempts silently fall out of that window and this chart would
    // show "no data" even though their records genuinely exist in
    // Firestore (this is exactly what admin's per-student "📄 Answers"
    // lookup in the Students Directory does correctly, since that runs
    // its own unlimited `where("mobile","==",...)` query — which is why
    // opening that panel "finds" data this chart couldn't). Query this
    // student's own records directly instead, with no limit.
    let myRecs = [];
    const db = (typeof getDB === "function") ? getDB() : null;
    try {
      if (db) {
        const snap = await db.collection("studentRecords").where("mobile", "==", mobile).get();
        myRecs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        myRecs = (records || []).filter(r => normalizeMobile(r.mobile) === mobile);
      }
    } catch (err) {
      console.warn("[MyProgress] Firestore query fail hui:", err);
      if (cache.progressRecs) return; // cache pehle se dikh rahi hai, ussi ko rehne do
      myRecs = (records || []).filter(r => normalizeMobile(r.mobile) === mobile);
    }
    myRecs = myRecs
      .filter(r => r.submittedIso)
      .sort((a, b) => (a.submittedIso || "").localeCompare(b.submittedIso || ""));

    cache.progressRecs = myRecs;
    persistExtrasCache();
    paintProgressChart(myRecs);
  }

  /* ── 5) STUDY STREAK ─────────────────────────────────────────────── */

  function dateStr(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function updateStreak(student) {
    const db = getDB();
    const mobile = normalizeMobile(student?.mobile || "");
    if (!db || !mobile) return;
    try {
      const ref = db.collection("students").doc(mobile);
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      const today = dateStr(0);
      if (data.lastActiveDate === today) return; // already counted today
      const streak = (data.lastActiveDate === dateStr(-1)) ? Number(data.streakCount || 0) + 1 : 1;
      await ref.set({ lastActiveDate: today, streakCount: streak }, { merge: true });
    } catch (e) { console.warn("Streak update failed", e); }
  }

  function paintStreakBadge(streak, badge) {
    if (!badge) return;
    if (streak > 0) {
      badge.style.display = "inline-block";
      badge.textContent = "🔥 " + streak + "-din streak";
    } else {
      badge.style.display = "none";
    }
  }

  async function renderStreakBadge() {
    const session = getStudentSession();
    const badge = document.getElementById("student-streak-badge");
    const db = getDB();
    if (!session || !badge || !db) return;
    const mobile = normalizeMobile(session.mobile);
    const cache = cacheFor(mobile);

    if (cache.streak !== null) paintStreakBadge(cache.streak, badge);

    try {
      const snap = await db.collection("students").doc(mobile).get();
      const streak = snap.exists ? Number(snap.data().streakCount || 0) : 0;
      cache.streak = streak;
      persistExtrasCache();
      paintStreakBadge(streak, badge);
    } catch (e) { if (cache.streak === null) badge.style.display = "none"; }
  }

  /* ── 6) MY RESULT — SAHI/GALAT DETAIL (works for ANY record: online
     quiz, OMR-scan, or Manual Entry, since all three save the same
     `details` array via saveRecordOnline()). Student already logged in
     hai, isliye apna number dobara type karne ki zaroorat nahi — seedha
     unke session ke mobile number se auto-load hota hai, sees every
     past attempt, and can open a question-by-question sahi/galat
     breakdown reusing the exact same solution-review screen normal
     online test-takers see. ──────────────────────────────────────── */

  async function loadMyResults() {
    const listEl = document.getElementById("my-result-list");
    const session = getStudentSession();
    if (!listEl || !session) return;
    const mobile = normalizeMobile(session.mobile);
    if (!mobile) return;
    const cache = cacheFor(mobile);

    // Pichhli baar ka data cache mein ho to turant dikha do.
    if (cache.myResults) {
      renderMyResultsList(cache.myResults);
    } else {
      listEl.innerHTML = '<p class="muted-text">Dhoondh rahe hain...</p>';
    }

    const db = getDB();
    let myRecs = [];
    try {
      if (db) {
        const snap = await db.collection("studentRecords").where("mobile", "==", mobile).get();
        myRecs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        myRecs = (records || []).filter(r => normalizeMobile(r.mobile) === mobile);
      }
    } catch (err) {
      console.warn("Firestore query fail hui, local records se try kar rahe hain:", err);
      if (cache.myResults) return; // cache pehle se dikh rahi hai, ussi ko rehne do
      myRecs = (records || []).filter(r => normalizeMobile(r.mobile) === mobile);
    }
    myRecs.sort((a, b) => (b.submittedIso || "").localeCompare(a.submittedIso || ""));
    cache.myResults = myRecs;
    persistExtrasCache();
    renderMyResultsList(myRecs);
    loadMyPaperExamReports(mobile);
  }

  /* ── 6b) MY PAPER/OMR EXAM REPORTS — scanned sheets an admin has
     linked to this student's mobile via Exam Manager → 🔗 Link to
     Student. Separate small collection (studentScanReports) so this
     student only ever reads their own linked reports, not the whole
     admin exam data. ──────────────────────────────────────────────── */

  let myPaperExamReports = [];

  async function loadMyPaperExamReports(mobile) {
    const section = document.getElementById("my-paper-exam-section");
    const listEl = document.getElementById("my-paper-exam-list");
    if (!section || !listEl) return;
    const db = getDB();
    if (!db) return;
    try {
      const snap = await db.collection("studentScanReports").where("mobile", "==", mobile).get();
      myPaperExamReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Paper exam reports load fail hui:", err);
      return;
    }
    if (!myPaperExamReports.length) { section.classList.add("hidden"); listEl.innerHTML = ""; return; }
    section.classList.remove("hidden");
    myPaperExamReports.sort((a, b) => (Number(b.scannedAt) || 0) - (Number(a.scannedAt) || 0));
    listEl.innerHTML = myPaperExamReports.map((r, idx) => {
      const pct = r.totalQuestions ? Math.round((Number(r.marks) || 0) / r.totalQuestions * 100) : 0;
      return `
        <div class="card" style="margin-bottom:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;">${escHtml(r.examName || "Exam")}</div>
            <div style="font-size:.78rem;color:#64748b;">${escHtml(r.className || "")}${r.date ? " · " + escHtml(r.date) : ""} · Marks: ${r.marks}/${r.totalQuestions} (${pct}%)</div>
          </div>
          <button type="button" class="btn-primary my-paper-exam-view-btn" data-idx="${idx}" style="font-size:.82rem;padding:6px 12px;">👁️ Dekhein</button>
        </div>`;
    }).join("");
    listEl.querySelectorAll(".my-paper-exam-view-btn").forEach(btn => {
      btn.onclick = () => openMyPaperExamDetail(myPaperExamReports[Number(btn.getAttribute("data-idx"))]);
    });
  }

  function openMyPaperExamDetail(r) {
    if (!r) return;
    const body = document.getElementById("my-paper-exam-detail-body");
    if (!body) return;
    const pct = r.totalQuestions ? Math.round((Number(r.marks) || 0) / r.totalQuestions * 100) : 0;
    body.innerHTML = `
      <div class="test-analysis-title">${escHtml(r.examName || "Exam")}</div>
      <div class="examgr-rd-info-row"><span>Class</span><span>${escHtml(r.className || "—")}</span></div>
      <div class="examgr-rd-info-row"><span>Roll No</span><span>${escHtml(r.roll || "—")}</span></div>
      <div class="examgr-rd-info-row"><span>Marks</span><span>${r.marks}/${r.totalQuestions} (${pct}%)</span></div>
      <div class="examgr-rd-info-row"><span>Correct / Wrong / Blank</span><span>${r.correct} / ${r.wrong} / ${r.blank}</span></div>
      ${r.thumb ? `
        <div class="examgr-rd-sheet-img-wrap" style="margin-top:10px;"><img src="${r.thumb}" alt="Scanned sheet" style="width:100%;border-radius:8px;"></div>
        <div style="text-align:center;margin-top:8px;">
          <a href="${r.thumb}" download="roll-${escHtml(r.roll || 'na')}-report.jpg" class="btn-secondary" style="display:inline-block;font-size:.8rem;padding:6px 14px;text-decoration:none;">⬇️ Photo Download Karein</a>
        </div>
      ` : ""}
    `;
    document.getElementById("my-paper-exam-detail-overlay")?.classList.remove("hidden");
  }
  function closeMyPaperExamDetail() {
    document.getElementById("my-paper-exam-detail-overlay")?.classList.add("hidden");
  }
  window.closeMyPaperExamDetail = closeMyPaperExamDetail;


  function renderMyResultsList(myRecs) {
    const listEl = document.getElementById("my-result-list");
    if (!listEl) return;
    if (!myRecs.length) {
      listEl.innerHTML = '<p class="muted-text">Is number se abhi tak koi result nahi mila.</p>';
      return;
    }
    listEl.innerHTML = myRecs.map((r, idx) => {
      // maxScore hamesha test ke LIVE config se — record ke apne purane/stale
      // maxScore field se nahi (Result Sheet/Top Performers mein bhi isi
      // wajah se fix kiya gaya tha — same reasoning yahan bhi).
      const testCfg = (typeof tests !== "undefined") ? tests[r.testId] : null;
      const liveMax = (testCfg && typeof getTestGrandTotalMarks === "function") ? getTestGrandTotalMarks(testCfg) : 0;
      const maxScore = liveMax > 0 ? liveMax : (r.maxScore || 0);
      const pct = maxScore > 0 ? Math.round((r.score / maxScore) * 100) : 0;
      const dateTxt = (typeof formatResultDate === "function") ? formatResultDate(r.submittedIso) : "";
      const hasDetails = Array.isArray(r.details) && r.details.length > 0;
      return `
        <div class="card" style="margin-bottom:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;">${escHtml(r.testTitle || r.testId || "Test")}</div>
            <div style="font-size:.78rem;color:#64748b;">${dateTxt ? dateTxt + " · " : ""}${escHtml(r.testMode || "Online")} · Score: ${r.score}/${maxScore} (${pct}%)</div>
          </div>
          <button type="button" class="btn-primary my-result-view-btn" data-idx="${idx}" style="font-size:.82rem;padding:6px 12px;" ${hasDetails ? "" : "disabled title=\"Purane record mein sawaal-wise detail save nahi hai\""}>
            ${hasDetails ? "📖 Sahi/Galat Dekhein" : "Detail Unavailable"}
          </button>
        </div>`;
    }).join("");

    listEl.querySelectorAll(".my-result-view-btn").forEach(btn => {
      btn.onclick = () => openMyResultDetail(myRecs[Number(btn.getAttribute("data-idx"))]);
    });
  }

  function openMyResultDetail(record) {
    if (!record || !Array.isArray(record.details) || !record.details.length) {
      alert("Is result ke sath sawaal-wise detail save nahi hai.");
      return;
    }
    // Reuse script.js's solution-review screen/globals as-is.
    currentDetails = record.details;
    currentSolIndex = 0;
    currentSolLang = "hi";
    document.getElementById("home-screen")?.classList.add("hidden");
    document.getElementById("solution-screen")?.classList.remove("hidden");
    setSolLang("hi");
    renderSolNav();

    const backBtn = document.getElementById("solution-back");
    if (backBtn) {
      backBtn.textContent = "← Wapas Jaayein";
      backBtn.onclick = closeMyResultDetail;
    }
  }

  function closeMyResultDetail() {
    document.getElementById("solution-screen")?.classList.add("hidden");
    document.getElementById("home-screen")?.classList.remove("hidden");
    // Wapas dashboard reset nahi — student jahan the (My Result list),
    // wahi par le jao, isolated-card system ke through.
    if (typeof showMode === "function") showMode("student", { preserveSection: true });
    if (typeof goStudentSection === "function") goStudentSection("my-result-detail-card");
    const backBtn = document.getElementById("solution-back");
    if (backBtn) {
      backBtn.textContent = "← Back to Result";
      backBtn.onclick = (typeof showResultFromSolution === "function") ? showResultFromSolution : null;
    }
  }

  /* ── 7) TOP-3 PODIUM — Student dashboard ke top par overall top
     performers (sabhi tests ke calculated marks jodkar — Practice Mode
     attempts count nahi hote kyunki wo studentRecords mein save hi
     nahi hote, script.js dekhein). Ek baar ka unlimited collection
     scan hota hai (bilkul Admin ki Students Directory jaisa — dekhein
     script.js ki loadStudentsDirectory), result localStorage mein
     cache hota hai taaki reload par turant dikhe, aur background mein
     silently refresh hota rahta hai. Koi photo-upload feature nahi hai,
     isliye naam ke initials se ek creative gradient avatar banaya jaata
     hai. ─────────────────────────────────────────────────────────── */

  const TOP_STUDENTS_CACHE_KEY = "savya_top_students_cache_v1";

  function loadTopStudentsCache() {
    try { return JSON.parse(localStorage.getItem(TOP_STUDENTS_CACHE_KEY) || "null"); } catch (e) { return null; }
  }
  function saveTopStudentsCache(list) {
    try { localStorage.setItem(TOP_STUDENTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), list })); } catch (e) {}
  }
  function podiumInitials(name) {
    return (name || "S").trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  }

  // Admin ki "Leaderboard: ON/OFF" setting (script.js -> toggleTestLeaderboard,
  // test doc ka includeInLeaderboard field) se batata hai kaunse testId ko
  // podium ke calculation se bahar rakhna hai. Field missing/undefined ho to
  // us test ko included hi maana jaata hai (default ON, backward-compatible).
  function getLeaderboardExcludedTestIds(testsMap) {
    const excluded = new Set();
    if (testsMap && typeof testsMap === "object") {
      Object.entries(testsMap).forEach(([id, t]) => {
        if (t && t.includeInLeaderboard === false) excluded.add(id);
      });
    }
    return excluded;
  }

  async function computeFullLeaderboard() {
    // Same aggregation as computeTopStudents() lekin poori list deta hai
    // (top 3 tak crop nahi karta) — Admin ke "Top Performers" tab ke liye,
    // taaki admin dekh sake ki total marks kis-kis test se ban rahe hain.
    const db = (typeof getDB === "function") ? getDB() : null;
    let all = [];
    try {
      if (db) {
        const snap = await db.collection("studentRecords").get();
        all = snap.docs.map(d => d.data());
      } else {
        all = records || [];
      }
    } catch (e) {
      console.warn("[TopStudents] fetch fail hui, cached records se fallback:", e);
      all = records || [];
    }
    const excludedTestIds = getLeaderboardExcludedTestIds(typeof tests !== "undefined" ? tests : null);

    // STEP 1 — Agar koi student wahi test kai baar de chuka hai (retake),
    // to Result Sheet ki tarah sirf uska SABSE ACHHA attempt rakho — baaki
    // attempts total mein dobara nahi juden. (script.js ki getBestRecordsForTest
    // jaisi hi logic, bas yahan sab tests ke liye ek saath.) Identity ke liye
    // studentIdentityKey() use karte hain (script.js mein defined, globally
    // available) — wahi function fake/placeholder mobile numbers (jaise
    // "1111111111") ko bhi sahi tarah handle karta hai.
    const identityOf = (typeof studentIdentityKey === "function")
      ? studentIdentityKey
      : (r => "m:" + normalizeMobile(r.mobile || ""));
    const bestPerTest = new Map(); // key: identity + "||" + testId
    all.forEach(r => {
      if (r.isPractice) return;
      const mobile = normalizeMobile(r.mobile || "");
      if (!mobile) return;
      const key = identityOf(r) + "||" + (r.testId || "");
      const cur = bestPerTest.get(key);
      if (!cur) { bestPerTest.set(key, r); return; }
      const rScore = Number(r.score) || 0, curScore = Number(cur.score) || 0;
      if (rScore > curScore) { bestPerTest.set(key, r); return; }
      if (rScore === curScore) {
        const rTime = String(r.submittedIso || ""), curTime = String(cur.submittedIso || "");
        if (rTime && curTime && rTime < curTime) bestPerTest.set(key, r);
      }
    });

    // STEP 2 — Ab in (ek student, ek test = ek best attempt) records ko
    // student ke hisaab se jodo, taaki total kai alag-alag tests ka sahi
    // sahi jod bane.
    const byIdentity = {};
    bestPerTest.forEach(r => {
      const identity = identityOf(r);
      const mobile = normalizeMobile(r.mobile || "");
      if (!byIdentity[identity]) byIdentity[identity] = { mobile, name: r.name || "Student", totalScore: 0, totalMaxScore: 0, testCount: 0, tests: [], _latestIso: "" };
      const excludedFromLb = !!(r.testId && excludedTestIds.has(r.testId));
      const testCfg = (typeof tests !== "undefined") ? tests[r.testId] : null;
      const testTitle = r.testTitle || testCfg?.title || r.testId || "Test";
      // maxScore hamesha test ke LIVE config se — record ke apne purane/stale
      // maxScore field se nahi (dekhein getRankedResultsForTest mein isi
      // wajah se ki gayi fix — same reasoning yahan bhi lagta hai, taaki
      // Result Sheet aur Top Performers hamesha SAME "out of X" dikhayein).
      const liveMax = (testCfg && typeof getTestGrandTotalMarks === "function") ? getTestGrandTotalMarks(testCfg) : 0;
      const recMaxScore = liveMax > 0 ? liveMax : (Number(r.maxScore) || 0);
      byIdentity[identity].tests.push({
        testId: r.testId || "",
        title: testTitle,
        score: Number(r.score) || 0,
        maxScore: recMaxScore,
        submittedIso: r.submittedIso || "",
        excludedFromLb
      });
      if (!excludedFromLb) {
        byIdentity[identity].totalScore += Number(r.score) || 0;
        byIdentity[identity].totalMaxScore += recMaxScore;
        byIdentity[identity].testCount += 1;
      }
      if (r.submittedIso && r.submittedIso > byIdentity[identity]._latestIso) {
        byIdentity[identity]._latestIso = r.submittedIso;
        byIdentity[identity].name = r.name || byIdentity[identity].name;
      }
    });
    return Object.values(byIdentity)
      .sort((a, b) => b.totalScore - a.totalScore)
      .map(({ _latestIso, ...rest }) => rest);
  }

  // ── Admin: "Top Performers" tab — poori leaderboard list, har student
  //    ke total marks kis-kis test se bane hain wo saaf-saaf dikhata hai,
  //    aur jo test leaderboard se OFF (excluded) hai wo bhi label ho jaata
  //    hai — taaki admin verify kar sake ki calculation sahi ho raha hai.
  async function renderAdminLeaderboard() {
    const box = document.getElementById("admin-leaderboard-list");
    if (!box) return;
    box.innerHTML = '<p class="muted-text">Loading…</p>';
    let list = [];
    try {
      list = await computeFullLeaderboard();
    } catch (e) {
      box.innerHTML = `<p style="color:#dc2626;">Load nahi ho paya: ${escHtml(e.message || String(e))}</p>`;
      return;
    }
    window._adminLeaderboardList = list;
    if (!list.length) {
      box.innerHTML = '<p class="muted-text">Abhi tak koi test record nahi mila.</p>';
      return;
    }
    const medalFor = i => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);
    box.innerHTML = list.map((s, i) => {
      const rowsHtml = (s.tests || []).slice().sort((a, b) => (b.submittedIso || "").localeCompare(a.submittedIso || "")).map(t => `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px dashed #e5e7eb;font-size:.82rem;">
          <span style="color:${t.excludedFromLb ? "#9ca3af" : "#374151"};">${escHtml(t.title)}${t.excludedFromLb ? ' <em style="color:#f59e0b;">(leaderboard se OFF — count nahi hua)</em>' : ""}</span>
          <strong style="color:${t.excludedFromLb ? "#9ca3af" : "#4338ca"};white-space:nowrap;">${fmtNum(t.score)}/${fmtNum(t.maxScore)}</strong>
        </div>`).join("");
      return `
        <details class="card" style="margin-bottom:10px;padding:12px 16px;">
          <summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;list-style:none;">
            <span style="font-weight:700;color:#1e1b4b;">${medalFor(i)} ${escHtml(s.name || "Student")} <small style="color:#6b7280;font-weight:500;">(${escHtml(s.mobile)})</small></span>
            <span style="font-weight:700;color:#4338ca;">${fmtNum(s.totalScore)}/${fmtNum(s.totalMaxScore)} marks · ${s.testCount} test${s.testCount === 1 ? "" : "s"}</span>
          </summary>
          <div style="margin-top:10px;">${rowsHtml || '<p class="muted-text" style="margin:0;">Koi test nahi.</p>'}</div>
        </details>`;
    }).join("");
  }
  window.renderAdminLeaderboard = renderAdminLeaderboard;

  // Podium item par click karne se ye modal khulta hai — student ke total
  // marks kis-kis test se mile hain, wo breakdown yahan dikhta hai. List
  // window par store karte hain taaki inline onclick se index se access ho sake.
  window._topPodiumList = [];
  window.showPodiumBreakdown = function (rank) {
    const student = (window._topPodiumList || [])[rank];
    if (!student) return;
    let overlay = document.getElementById("podium-breakdown-modal");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "podium-breakdown-modal";
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,15,30,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";
      overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
      document.body.appendChild(overlay);
    }
    const rows = (student.tests || [])
      .slice()
      .sort((a, b) => (b.submittedIso || "").localeCompare(a.submittedIso || ""))
      .map(t => `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #e5e7eb;">
          <span style="color:#374151;font-size:.85rem;">${escHtml(t.title)}</span>
          <strong style="color:#4338ca;font-size:.85rem;white-space:nowrap;">${fmtNum(t.score)}/${fmtNum(t.maxScore)}</strong>
        </div>`).join("");
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.3);max-height:80vh;overflow:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <h3 style="margin:0;color:#1e1b4b;font-size:1.05rem;">🏆 ${escHtml(student.name || "Student")}</h3>
          <button onclick="document.getElementById('podium-breakdown-modal').remove()" style="background:#f3f4f6;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:.9rem;">✕</button>
        </div>
        <p style="margin:0 0 12px;color:#6b7280;font-size:.82rem;">Total ${fmtNum(student.totalScore)}/${fmtNum(student.totalMaxScore)} marks — ${student.testCount} test${student.testCount === 1 ? "" : "s"} ka jod:</p>
        ${rows || '<p style="color:#9ca3af;font-size:.85rem;">Koi test record nahi mila.</p>'}
      </div>`;
  };

  // Logged-in student ka apna record poori (full) leaderboard list mein
  // dhoondhta hai — chahe wo top-3 mein ho ya na ho — taaki "Aapki Rank"
  // strip mein uska sahi rank/score dikhaya ja sake.
  function findSelfInLeaderboard(fullList) {
    const session = (typeof getStudentSession === "function") ? getStudentSession() : null;
    if (!session || !fullList || !fullList.length) return null;
    const myMobile = normalizeMobile(session.mobile || "");
    if (!myMobile) return null;
    const idx = fullList.findIndex(s => normalizeMobile(s.mobile || "") === myMobile);
    if (idx === -1) return null;
    return { rank: idx + 1, total: fullList.length, student: fullList[idx] };
  }

  // "Aapki Rank" strip — podium ke neeche ek chhoti si patti jo har
  // student ko (top-3 mein ho ya na ho) uska apna rank, total students
  // mein se, aur total marks batati hai. Tap karne par usi breakdown
  // modal ka use karta hai jo podium items par bhi hai.
  function renderSelfRankStrip(self) {
    if (!self) return "";
    const { rank, total, student } = self;
    const isTop3 = rank <= 3;
    return `
      <div class="cd-self-rank" ${isTop3 ? "" : `onclick="showSelfRankBreakdown()"`} style="${isTop3 ? "" : "cursor:pointer;"}">
        <span class="cd-self-rank-badge">#${rank}</span>
        <span class="cd-self-rank-text">Aapki Rank — <strong>${total}</strong> students mein se</span>
        <span class="cd-self-rank-score">${fmtNum(student.totalScore)}/${fmtNum(student.totalMaxScore)} marks</span>
      </div>`;
  }

  window._selfRankStudent = null;
  window.showSelfRankBreakdown = function () {
    const self = window._selfRankStudent;
    if (!self) return;
    // Reuse the same breakdown modal used by podium items — bas iske liye
    // ek temporary single-item list bana kar rank 0 par daal dete hain.
    window._topPodiumList = [self];
    window.showPodiumBreakdown(0);
  };

  function paintPodium(fullList, wrap) {
    if (!wrap) return;
    const list = (fullList || []).slice(0, 3);
    window._topPodiumList = list;
    const self = findSelfInLeaderboard(fullList);
    window._selfRankStudent = self ? self.student : null;
    if (!list.length) { wrap.innerHTML = ""; return; }
    // Classic podium order on screen: 2nd - 1st - 3rd (1st tallest & center).
    const rankMeta = [
      { medal: "🥇", cls: "cd-rank-1", crown: true  },
      { medal: "🥈", cls: "cd-rank-2", crown: false },
      { medal: "🥉", cls: "cd-rank-3", crown: false }
    ];
    const order = [1, 0, 2].filter(i => list[i]);
    const itemsHtml = order.map(rank => {
      const student = list[rank];
      const meta = rankMeta[rank];
      return `
        <div class="cd-podium-item ${meta.cls}" onclick="showPodiumBreakdown(${rank})" title="Kis test se kitne marks aaye, dekhne ke liye click karein" style="cursor:pointer;">
          ${meta.crown ? '<div class="cd-podium-crown">👑</div>' : ""}
          <div class="cd-podium-avatar">${escHtml(podiumInitials(student.name))}<span class="cd-podium-rank-badge">#${rank + 1}</span><span class="cd-podium-medal">${meta.medal}</span></div>
          <div class="cd-podium-name">${escHtml(student.name || "Student")}</div>
          <div class="cd-podium-score">${fmtNum(student.totalScore)}/${fmtNum(student.totalMaxScore)} marks</div>
          <div class="cd-podium-tests">${student.testCount} test${student.testCount === 1 ? "" : "s"} · ℹ️ details</div>
        </div>`;
    }).join("");
    wrap.innerHTML = `
      <div class="cd-podium">
        <div class="cd-podium-title">🏆 Top Performers</div>
        <div class="cd-podium-row">${itemsHtml}</div>
      </div>
      ${renderSelfRankStrip(self)}`;
  }

  async function renderTopStudentsPodium() {
    const wrap = document.getElementById("cd-podium-wrap");
    if (!wrap) return;
    const cached = loadTopStudentsCache();
    if (cached && Array.isArray(cached.list) && cached.list.length) paintPodium(cached.list, wrap);
    try {
      const fresh = await computeFullLeaderboard();
      if (fresh.length) {
        saveTopStudentsCache(fresh);
        paintPodium(fresh, wrap);
      } else if (!cached) {
        wrap.innerHTML = "";
      }
    } catch (e) { console.warn("[TopStudents] render fail", e); }
  }

  /* ── HOOK: called from script.js's goStudentSection() whenever a
     student opens a dashboard card, so that card's data is refreshed
     right then (cheap thanks to the stale-while-revalidate cache —
     cached data already shows instantly, this just re-validates it,
     and for My Progress it also re-builds the Chart.js canvas at the
     moment it becomes visible/correctly-sized). ───────────────────── */
  function onStudentSectionShown(id) {
    if (id === "my-progress-card") renderMyProgress();
    else if (id === "my-mistakes-card") renderMyMistakes();
    else if (id === "my-result-detail-card") loadMyResults();
  }

  /* ── HOOK: called from script.js showResult() after every submit ─── */

  async function onTestSubmitted({ student, testTitle, details, isPractice }) {
    try { await updateStreak(student); } catch (e) { console.warn(e); }
    try { if (!isPractice) await saveMistakesFromDetails(student, testTitle, details); } catch (e) { console.warn(e); }
    renderStreakBadge();
    // Naya scored record ban gaya — My Progress / Mera Result / Top-3
    // podium sabme purana (stale) data reh gaya hoga, turant refresh
    // kar do taaki naya score turant sab jagah dikhe.
    if (!isPractice) {
      renderMyProgress();
      loadMyResults();
      renderTopStudentsPodium();
    }
  }

  /* ── INIT / WIRING ─────────────────────────────────────────────── */

  function refreshStudentExtras() {
    const session = (typeof getStudentSession === "function") ? getStudentSession() : null;
    if (!session) return;
    renderStreakBadge();
    renderMyMistakes();
    renderMyProgress();
    renderTopStudentsPodium();
  }

  function init() {
    // Practice Mode needs the full question bank (subject/chapter lists,
    // question pool) — start that Firestore sync here for students too.
    // syncBank() itself guards against double-subscribing if the admin
    // panel already started it.
    if (typeof syncBank === "function") syncBank();

    const startBtn = document.getElementById("practice-start-btn");
    if (startBtn) startBtn.onclick = startPracticeMode;

    const refreshBtn = document.getElementById("refresh-mistakes-btn");
    if (refreshBtn) refreshBtn.onclick = renderMyMistakes;

    const practiceMistakesBtn = document.getElementById("practice-mistakes-btn");
    if (practiceMistakesBtn) practiceMistakesBtn.onclick = practiceMyMistakes;

    const myResultBtn = document.getElementById("my-result-refresh-btn");
    if (myResultBtn) myResultBtn.onclick = loadMyResults;

    const subjSel = document.getElementById("practice-subject-filter");
    if (subjSel) subjSel.onchange = syncPracticeFilters;

    const selectAllBtn = document.getElementById("practice-select-all-chapters");
    if (selectAllBtn) selectAllBtn.onclick = selectAllPracticeChapters;

    const clearAllBtn = document.getElementById("practice-clear-all-chapters");
    if (clearAllBtn) clearAllBtn.onclick = clearAllPracticeChapters;

    syncPracticeFilters();
    setInterval(syncPracticeFilters, 500);

    // Refresh student widgets when Student tab is opened (uses addEventListener
    // so we don't clobber script.js's own onclick handler on the same button).
    document.getElementById("student-tab")?.addEventListener("click", refreshStudentExtras);
    setTimeout(refreshStudentExtras, 900); // initial load after session restore
    renderTopStudentsPodium(); // podium doesn't need a session — show it right away

    // ── AUTO-UPDATE: puri site khud-b-khud fresh rahe ────────────────
    // Pehle sirf tab khol-band karne par data refresh hota tha. Ab agar
    // student page khula hi chhod de (aur admin doosri taraf se koi
    // naya test/doubt-reply/record add kare), to bhi kuch hi second
    // mein purana data khud update ho jaata hai — reload karne ki
    // zaroorat nahi. Sirf tab visible hone par chalta hai (background
    // tab mein battery/data waste nahi karta).
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshStudentExtras();
    }, 25000);
  }

  document.addEventListener("DOMContentLoaded", init);

  window.SavyaExtras = {
    onTestSubmitted,
    removeMistake,
    syncPracticeFilters,
    onStudentSectionShown,
    renderTopStudentsPodium,
    renderAdminLeaderboard,
    startWeakChapterPractice
  };

})();
