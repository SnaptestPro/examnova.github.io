/* ══════════════════════════════════════════════════════════════════
   SAVYASACHI — EXTRA STUDENT+ADMIN FEATURES
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
   4) Doubt Box           — student asks, admin replies (2-way)
   5) Study Streak        — daily streak badge
   ══════════════════════════════════════════════════════════════════ */

(function () {

  /* ── STALE-WHILE-REVALIDATE CACHE for student widgets ────────────
     Student baar-baar "Student" tab par click karta hai (kabhi Admin
     ya Leaderboard tab dekhne jaake wapas aata hai), aur pehle har
     baar mistakes/progress/doubts/streak — chaaron cheezein Firestore
     se dobara fetch hoti thi, jisse har baar kuch pal ke liye poora
     section khaali ya "Loading..." dikhta tha — jaise section refresh
     ho raha ho. Ab pichhli baar ka data turant (cache se) dikh jaata
     hai, aur background mein fresh data laa kar chup-chaap update kar
     diya jaata hai — "Loading..." sirf pehli baar hi dikhega. Cache
     mobile-number se linked hai, isliye agar dusra student login kare
     to purana data kabhi nahi dikhta.
  ──────────────────────────────────────────────────────────────── */
  let extrasCache = { mobile: null, mistakes: null, progressRecs: null, doubts: null, streak: null, myResults: null };
  function cacheFor(mobile) {
    if (extrasCache.mobile !== mobile) {
      extrasCache = { mobile, mistakes: null, progressRecs: null, doubts: null, streak: null, myResults: null };
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

  async function loadMyMistakes() {
    const session = getStudentSession();
    const db = getDB();
    if (!session || !db) return [];
    const mobile = normalizeMobile(session.mobile);
    if (!mobile) return [];
    try {
      const snap = await db.collection("studentMistakes").doc(mobile).get();
      return (snap.exists && Array.isArray(snap.data().items)) ? snap.data().items : [];
    } catch (e) { console.warn("Mistake load failed", e); return []; }
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

    const fresh = await loadMyMistakes();
    currentMistakes = fresh;
    cache.mistakes = fresh;
    paintMistakesList(currentMistakes, list);
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
    const dataPct = myRecs.map(r => (r.maxScore > 0) ? Math.round((r.score / r.maxScore) * 100) : 0);

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
    paintProgressChart(myRecs);
  }

  /* ── 4) DOUBT BOX ─────────────────────────────────────────────────── */

  async function submitDoubt() {
    const session = getStudentSession();
    if (!session) { alert("Doubt bhejne ke liye pehle login karein."); return; }
    const db = getDB();
    if (!db) { alert("Internet connection check karein."); return; }

    const contextInput = document.getElementById("doubt-context-input");
    const textInput = document.getElementById("doubt-text-input");
    const contextText = (contextInput?.value || "").trim();
    const doubtText = (textInput?.value || "").trim();
    if (!doubtText) { alert("Kripya apna doubt likhein."); return; }

    try {
      await db.collection("doubts").add({
        mobile: normalizeMobile(session.mobile),
        name: session.name || "",
        context: contextText,
        doubtText,
        status: "open",
        adminReply: "",
        createdAt: (typeof firebase !== "undefined") ? firebase.firestore.FieldValue.serverTimestamp() : null,
        createdIso: new Date().toISOString()
      });
      if (contextInput) contextInput.value = "";
      if (textInput) textInput.value = "";
      alert("✅ Aapka doubt bhej diya gaya! Admin jald reply karega.");
      renderMyDoubts();
    } catch (err) {
      console.error(err);
      alert("Doubt bhejne mein error: " + (err.message || err));
    }
  }

  function paintDoubtsList(docs, list) {
    if (!list) return;
    if (!docs.length) { list.innerHTML = '<p class="muted-text">Koi doubt nahi bheja abhi tak.</p>'; return; }
    list.innerHTML = docs.map(d => `
      <div class="card" style="margin-bottom:8px;padding:10px 12px;">
        <div style="font-size:.78rem;color:#64748b;">
          ${d.context ? escHtml(d.context) : "General"} · ${d.status === "answered" ? "✅ Answered" : "⏳ Pending"}
        </div>
        <div style="font-weight:600;margin:4px 0;">${escHtml(d.doubtText || "")}</div>
        ${d.adminReply ? `<div style="background:#f0fdf4;border-radius:6px;padding:8px;font-size:.85rem;color:#15803d;">👨‍🏫 ${escHtml(d.adminReply)}</div>` : ""}
      </div>`).join("");
  }

  async function renderMyDoubts() {
    const list = document.getElementById("my-doubts-list");
    const session = getStudentSession();
    const db = getDB();
    if (!list || !session || !db) return;
    const mobile = normalizeMobile(session.mobile);
    const cache = cacheFor(mobile);

    if (cache.doubts) {
      paintDoubtsList(cache.doubts, list);
    } else {
      list.innerHTML = '<p class="muted-text">Loading...</p>';
    }

    try {
      const snap = await db.collection("doubts").where("mobile", "==", mobile).get();
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdIso || "").localeCompare(a.createdIso || ""));
      cache.doubts = docs;
      paintDoubtsList(docs, list);
    } catch (err) {
      console.error(err);
      if (!cache.doubts) list.innerHTML = '<p class="muted-text">Load nahi ho paya.</p>';
    }
  }

  async function renderAdminDoubts() {
    const list = document.getElementById("admin-doubts-list");
    const db = getDB();
    if (!list || !db) return;
    list.innerHTML = '<p class="muted-text">Loading...</p>';
    try {
      const snap = await db.collection("doubts").get();
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        if (a.status !== b.status) return a.status === "answered" ? 1 : -1;
        return (b.createdIso || "").localeCompare(a.createdIso || "");
      });
      const openCount = docs.filter(d => d.status !== "answered").length;
      const badge = document.getElementById("doubts-open-count");
      if (badge) {
        badge.style.display = openCount > 0 ? "inline-block" : "none";
        badge.textContent = String(openCount);
      }
      const cdBadge = document.getElementById("cd-doubts-badge");
      if (cdBadge) cdBadge.textContent = openCount > 0 ? `${openCount} New` : "Chat";
      if (!docs.length) { list.innerHTML = '<p class="muted-text">Koi doubt nahi aaya abhi tak.</p>'; return; }
      list.innerHTML = docs.map(d => `
        <div class="card" style="margin-bottom:10px;padding:12px;border-left:4px solid ${d.status === "answered" ? "#22c55e" : "#f59e0b"};">
          <div style="font-size:.8rem;color:#64748b;">
            👤 ${escHtml(d.name || "Student")} · 📱 ${escHtml(d.mobile || "")}${d.context ? " · " + escHtml(d.context) : ""}
          </div>
          <div style="font-weight:600;margin:6px 0;">${escHtml(d.doubtText || "")}</div>
          <textarea id="reply-input-${d.id}" rows="2" placeholder="Reply likhein..." style="width:100%;margin-bottom:6px;box-sizing:border-box;">${escHtml(d.adminReply || "")}</textarea>
          <button type="button" class="btn-primary" style="font-size:.8rem;padding:4px 10px;" onclick="window.SavyaExtras.replyToDoubt('${d.id}')">📤 Reply Bhejein</button>
        </div>`).join("");
    } catch (err) {
      console.error(err);
      list.innerHTML = '<p class="muted-text">Load nahi ho paya.</p>';
    }
  }

  async function replyToDoubt(id) {
    const db = getDB();
    const ta = document.getElementById("reply-input-" + id);
    if (!db || !ta) return;
    const reply = (ta.value || "").trim();
    if (!reply) { alert("Kripya reply likhein."); return; }
    try {
      await db.collection("doubts").doc(id).update({ adminReply: reply, status: "answered" });
      alert("✅ Reply bhej diya gaya.");
      renderAdminDoubts();
    } catch (err) {
      console.error(err);
      alert("Reply save nahi hua: " + (err.message || err));
    }
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
      paintStreakBadge(streak, badge);
    } catch (e) { if (cache.streak === null) badge.style.display = "none"; }
  }

  /* ── 6) MY RESULT — SAHI/GALAT DETAIL (works for ANY record: online
     quiz, OMR-scan, or Manual Entry, since all three save the same
     `details` array via saveRecordOnline()). Student login karte hi
     apna number de chuka hota hai (session mein already save hai), isliye
     dobara number maangne ki zaroorat nahi — session ke mobile se hi
     apne-aap sab attempts dhoondh kar, ek nice summary + list ke sath
     dikha diya jaata hai. Question-by-question sahi/galat breakdown
     wahi solution-review screen reuse karta hai jo normal online
     test-takers dekhte hain. ─────────────────────────────────────── */

  function pctBand(pct) {
    if (pct >= 75) return { color: "#16a34a", bg: "#dcfce7" };
    if (pct >= 50) return { color: "#d97706", bg: "#fef3c7" };
    return { color: "#dc2626", bg: "#fee2e2" };
  }

  async function loadMyResults() {
    const session = (typeof getStudentSession === "function") ? getStudentSession() : null;
    const listEl = document.getElementById("my-result-list");
    const summaryEl = document.getElementById("my-result-summary");
    if (!session || !listEl) return;
    const mobile = normalizeMobile(session.mobile);
    const cache = cacheFor(mobile);

    // Cache mein pehle se data hai to turant dikha do (khaali "Loading"
    // flash na ho), fir background mein fresh data laa kar update karein.
    if (cache.myResults) renderMyResultsList(cache.myResults);
    else listEl.innerHTML = '<p class="muted-text">Aapka result load ho raha hai...</p>';

    const refreshBtn = document.getElementById("my-result-refresh-btn");
    if (refreshBtn) refreshBtn.classList.add("is-spinning");

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
      console.warn("[MyResult] Firestore query fail hui, local records se try kar rahe hain:", err);
      if (cache.myResults) { if (refreshBtn) refreshBtn.classList.remove("is-spinning"); return; }
      myRecs = (records || []).filter(r => normalizeMobile(r.mobile) === mobile);
    }
    myRecs.sort((a, b) => (b.submittedIso || "").localeCompare(a.submittedIso || ""));
    cache.myResults = myRecs;
    renderMyResultsList(myRecs);
    if (refreshBtn) setTimeout(() => refreshBtn.classList.remove("is-spinning"), 400);
  }

  function renderMyResultsList(myRecs) {
    const listEl = document.getElementById("my-result-list");
    const summaryEl = document.getElementById("my-result-summary");
    if (!listEl) return;

    if (!myRecs.length) {
      if (summaryEl) summaryEl.innerHTML = "";
      listEl.innerHTML = '<p class="muted-text">Abhi tak koi test attempt nahi mila. Test dene ke baad aapka result yahan apne aap dikhega.</p>';
      return;
    }

    const pcts = myRecs.map(r => r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0);
    const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    const bestPct = Math.max(...pcts);

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="my-result-stats">
          <div class="my-result-stat"><div class="my-result-stat-num">${myRecs.length}</div><div class="my-result-stat-label">Total Tests</div></div>
          <div class="my-result-stat"><div class="my-result-stat-num">${avgPct}%</div><div class="my-result-stat-label">Average Score</div></div>
          <div class="my-result-stat"><div class="my-result-stat-num">${bestPct}%</div><div class="my-result-stat-label">Best Score</div></div>
        </div>`;
    }

    listEl.innerHTML = myRecs.map((r, idx) => {
      const pct = pcts[idx];
      const band = pctBand(pct);
      const dateTxt = (typeof formatResultDate === "function") ? formatResultDate(r.submittedIso) : "";
      const hasDetails = Array.isArray(r.details) && r.details.length > 0;
      return `
        <div class="my-result-row">
          <div class="my-result-row-top">
            <div class="my-result-row-title">${escHtml(r.testTitle || r.testId || "Test")}</div>
            <div class="my-result-pct-badge" style="color:${band.color};background:${band.bg};">${pct}%</div>
          </div>
          <div class="my-result-row-bar"><div class="my-result-row-bar-fill" style="width:${pct}%;background:${band.color};"></div></div>
          <div class="my-result-row-bottom">
            <span class="my-result-row-meta">${dateTxt ? dateTxt + " · " : ""}${escHtml(r.testMode || "Online")} · Score: ${r.score}/${r.maxScore}</span>
            <button type="button" class="my-result-view-btn" data-idx="${idx}" ${hasDetails ? "" : "disabled title=\"Purane record mein sawaal-wise detail save nahi hai\""}>
              ${hasDetails ? "📖 Sahi/Galat Dekhein" : "Detail Unavailable"}
            </button>
          </div>
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
    if (typeof showMode === "function") showMode("student");
    const backBtn = document.getElementById("solution-back");
    if (backBtn) {
      backBtn.textContent = "← Back to Result";
      backBtn.onclick = (typeof showResultFromSolution === "function") ? showResultFromSolution : null;
    }
  }

  /* ── HOOK: called from script.js showResult() after every submit ─── */

  async function onTestSubmitted({ student, testTitle, details, isPractice }) {
    try { await updateStreak(student); } catch (e) { console.warn(e); }
    try { if (!isPractice) await saveMistakesFromDetails(student, testTitle, details); } catch (e) { console.warn(e); }
    renderStreakBadge();
  }

  /* ── INIT / WIRING ─────────────────────────────────────────────── */

  function refreshStudentExtras() {
    const session = (typeof getStudentSession === "function") ? getStudentSession() : null;
    if (!session) return;
    renderStreakBadge();
    renderMyMistakes();
    renderMyProgress();
    renderMyDoubts();
    loadMyResults();
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

    const doubtSubmitBtn = document.getElementById("doubt-submit-btn");
    if (doubtSubmitBtn) doubtSubmitBtn.onclick = submitDoubt;

    const myResultRefreshBtn = document.getElementById("my-result-refresh-btn");
    if (myResultRefreshBtn) myResultRefreshBtn.onclick = loadMyResults;

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
  }

  document.addEventListener("DOMContentLoaded", init);

  window.SavyaExtras = {
    onTestSubmitted,
    removeMistake,
    replyToDoubt,
    renderAdminDoubts,
    syncPracticeFilters
  };

})();
