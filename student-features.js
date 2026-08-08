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
     dekhne jaake wapas aata hai), aur pehle har baar mistakes/progress/
     doubts/streak/myResults — sab cheezein Firestore se dobara fetch
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
  let extrasCache = { mobile: null, mistakes: null, progressRecs: null, doubts: null, streak: null, myResults: null };

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
        doubts: stored.doubts || null,
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
    persistExtrasCache();
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
    persistExtrasCache();
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
      persistExtrasCache();
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
  }

  function renderMyResultsList(myRecs) {
    const listEl = document.getElementById("my-result-list");
    if (!listEl) return;
    if (!myRecs.length) {
      listEl.innerHTML = '<p class="muted-text">Is number se abhi tak koi result nahi mila.</p>';
      return;
    }
    listEl.innerHTML = myRecs.map((r, idx) => {
      const pct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
      const dateTxt = (typeof formatResultDate === "function") ? formatResultDate(r.submittedIso) : "";
      const hasDetails = Array.isArray(r.details) && r.details.length > 0;
      return `
        <div class="card" style="margin-bottom:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;">${escHtml(r.testTitle || r.testId || "Test")}</div>
            <div style="font-size:.78rem;color:#64748b;">${dateTxt ? dateTxt + " · " : ""}${escHtml(r.testMode || "Online")} · Score: ${r.score}/${r.maxScore} (${pct}%)</div>
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

  async function computeTopStudents() {
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
    // Admin ki per-test "Leaderboard ON/OFF" setting — script.js ke syncTests()
    // wale live listener se global `tests` object pehle se hi synced rehta hai,
    // isliye yahan koi extra Firestore read nahi karni padi.
    const excludedTestIds = getLeaderboardExcludedTestIds(typeof tests !== "undefined" ? tests : null);
    const byMobile = {};
    all.forEach(r => {
      if (r.isPractice) return;
      if (r.testId && excludedTestIds.has(r.testId)) return; // admin ne is test ko leaderboard se hataya hai
      const mobile = normalizeMobile(r.mobile || "");
      if (!mobile) return;
      if (!byMobile[mobile]) byMobile[mobile] = { mobile, name: r.name || "Student", totalScore: 0, totalMaxScore: 0, testCount: 0, _latestIso: "" };
      byMobile[mobile].totalScore += Number(r.score) || 0;
      byMobile[mobile].totalMaxScore += Number(r.maxScore) || 0;
      byMobile[mobile].testCount += 1;
      if (r.submittedIso && r.submittedIso > byMobile[mobile]._latestIso) {
        byMobile[mobile]._latestIso = r.submittedIso;
        byMobile[mobile].name = r.name || byMobile[mobile].name;
      }
    });
    return Object.values(byMobile)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3)
      .map(({ _latestIso, ...rest }) => rest);
  }

  function paintPodium(list, wrap) {
    if (!wrap) return;
    if (!list || !list.length) { wrap.innerHTML = ""; return; }
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
        <div class="cd-podium-item ${meta.cls}">
          ${meta.crown ? '<div class="cd-podium-crown">👑</div>' : ""}
          <div class="cd-podium-avatar">${escHtml(podiumInitials(student.name))}<span class="cd-podium-medal">${meta.medal}</span></div>
          <div class="cd-podium-name">${escHtml(student.name || "Student")}</div>
          <div class="cd-podium-score">${fmtNum(student.totalScore)}/${fmtNum(student.totalMaxScore)} marks</div>
          <div class="cd-podium-tests">${student.testCount} test${student.testCount === 1 ? "" : "s"}</div>
        </div>`;
    }).join("");
    wrap.innerHTML = `
      <div class="cd-podium">
        <div class="cd-podium-title">🏆 Top Performers</div>
        <div class="cd-podium-row">${itemsHtml}</div>
      </div>`;
  }

  async function renderTopStudentsPodium() {
    const wrap = document.getElementById("cd-podium-wrap");
    if (!wrap) return;
    const cached = loadTopStudentsCache();
    if (cached && Array.isArray(cached.list) && cached.list.length) paintPodium(cached.list, wrap);
    try {
      const fresh = await computeTopStudents();
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
    else if (id === "doubt-box-card") renderMyDoubts();
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
    renderMyDoubts();
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

    const doubtSubmitBtn = document.getElementById("doubt-submit-btn");
    if (doubtSubmitBtn) doubtSubmitBtn.onclick = submitDoubt;

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
    replyToDoubt,
    renderAdminDoubts,
    syncPracticeFilters,
    onStudentSectionShown,
    renderTopStudentsPodium
  };

})();
