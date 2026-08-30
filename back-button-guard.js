/* ════════════════════════════════════════════════════════════════
   EXAMNOVA — ANDROID BACK BUTTON GUARD (v2)
   ════════════════════════════════════════════════════════════════
   PROBLEM 1: App APK (TWA) ke andar back button dabate hi poora
   app band ho jata hai — chahe kahin bhi ho — kyunki app kabhi
   history.pushState use nahi karti (sirf CSS show/hide).

   PROBLEM 2 (is version ka fix): Pehle back dabate hi seedha
   "exit/submit" confirm aa jata tha. Sahi behavior ye hai ki:
     - Exam ke andar back dabane par har baar EK QUESTION PEECHE
       jaye (jaise "Previous" button) — jab tak pehle question
       (Q1) tak na pahunch jaye.
     - Solution/Answer-review screen mein bhi back se ek-ek karke
       peechla question dikhe.
     - Kisi bhi doosri screen (admin, login/register, result) se back
       dabane par pichli screen par jaye — ek hi jhatke mein home par
       nahi phekna.
     - Sirf jab bilkul shuruaat (Q1, ya home screen) par pahunch
       jaye, tab hi exit/submit confirm ya "dobara back se exit"
       dikhna chahiye.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var $$ = function (sel) { return document.querySelector(sel); };

  // Poori-page screens jinhe track karna hai (modal alag se neeche hai)
  var SCREENS = [
    "#exam-screen", "#result-screen", "#solution-screen",
    "#student-auth-screen", "#student-form", "#admin-panel"
  ];

  var MODALS = [
    { sel: "#bank-edit-modal",    close: function (el) { if (typeof hideBankModal === "function") hideBankModal(); else el.classList.add("hidden"); } },
    { sel: "#move-chapter-modal", close: function (el) { if (typeof closeMoveChapterModal === "function") closeMoveChapterModal(); else el.style.display = "none"; } },
    { sel: "#theme-picker-modal", close: function (el) { if (window.ThemeManager && typeof ThemeManager.hidePicker === "function") ThemeManager.hidePicker(); else el.style.display = "none"; } },
    { sel: "#app-install-modal",  close: function (el) { el.classList.add("hidden"); } },
    // Exam Manager (OMR hub → 🗂️ Exam Manager) ke full-screen overlays —
    // in mein se ek waqt par sirf ek hi visible hota hai, isliye har ek
    // apni "close" call karta hai jo pichli screen (list/Details) khud
    // wapas dikha deta hai.
    { sel: "#examgr-add-overlay",     close: function (el) { if (typeof examgrCloseAdd === "function") examgrCloseAdd(); else el.classList.add("hidden"); } },
    { sel: "#examgr-details-overlay", close: function (el) { if (typeof examgrCloseDetails === "function") examgrCloseDetails(); else el.classList.add("hidden"); } },
    { sel: "#examgr-akey-overlay",    close: function (el) { if (typeof examgrCloseAnswerKey === "function") examgrCloseAnswerKey(); else el.classList.add("hidden"); } },
    { sel: "#examgr-sheet-overlay",   close: function (el) { if (typeof examgrCloseOmrSheet === "function") examgrCloseOmrSheet(); else el.classList.add("hidden"); } },
    { sel: "#examgr-scan-overlay",    close: function (el) { if (typeof examgrCloseScanner === "function") examgrCloseScanner(); else el.classList.add("hidden"); } }
  ];

  function isVisible(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains("hidden")) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    return true;
  }

  function visibleSignature() {
    var parts = [];
    for (var i = 0; i < SCREENS.length; i++) {
      if (isVisible($$(SCREENS[i]))) parts.push(SCREENS[i]);
    }
    return parts.join("|");
  }

  function topVisibleModal() {
    for (var i = MODALS.length - 1; i >= 0; i--) {
      if (isVisible($$(MODALS[i].sel))) return MODALS[i];
    }
    return null;
  }

  function isExamActive() {
    return isVisible($$("#exam-screen")) && typeof current !== "undefined" && current && current.test;
  }

  function isSolutionActive() {
    return isVisible($$("#solution-screen")) && typeof currentDetails !== "undefined" &&
      Array.isArray(currentDetails) && currentDetails.length > 0;
  }

  // ── Admin panel ke ANDAR ke sections (dashboard-home <-> Tests/Bank/
  //    OMR/Grade/... ) — ye #admin-panel ke andar hi CSS show/hide se
  //    switch hote hain, isliye topSCREENS signature nahi badalti aur
  //    pehle koi history step nahi banta tha. Isi wajah se section ke
  //    andar se back dabate hi seedha student/home pe chala jata tha —
  //    beech ka "admin dashboard" step history mein tha hi nahi.
  var ADMIN_SUBTABS = [
    { tab: "tests",       box: "tests-area" },
    { tab: "bank",        box: "bank-box" },
    { tab: "bulk-upload", box: "bulk-upload-box" },
    { tab: "records",     box: "records-box" },
    { tab: "generator",   box: "generator-box" },
    { tab: "trash",       box: "trash-box" },
    { tab: "omr",         box: "omr-box" },
    { tab: "grade",       box: "grade-box" },
    { tab: "settings",    box: "settings-box" }
  ];
  function currentAdminTab() {
    if (!isVisible($$("#admin-panel"))) return null;
    for (var i = 0; i < ADMIN_SUBTABS.length; i++) {
      if (isVisible(document.getElementById(ADMIN_SUBTABS[i].box))) return ADMIN_SUBTABS[i].tab;
    }
    return null; // dashboard-home (admin ka "root") khula hai
  }

  // ── Admin tab ke ANDAR ke "hub -> sub-card" system (Tests: Create Test/
  //    All Tests, Records: Password Reset/Directory/Result Sheets, OMR:
  //    Generate/Manual Entry) — showTestsSubTab/showRecordsSubTab/
  //    showOmrSubTab (aur unke backTo...Hub) se hokar switch hote hain,
  //    lekin ye "tests"/"records"/"omr" jaisi top-level admin-tab
  //    signature nahi badalte (tests-area hamesha visible hi rehta hai,
  //    andar sirf hub <-> sub-card CSS-hide/show hoti hai) — isi wajah
  //    se pehle koi history step nahi banta tha, aur sub-card (jaise
  //    "Create Test") ke andar se back dabate hi seedha "app exit" toast
  //    aa jaata tha, hub (pichli slide) par nahi jaata tha.
  var ADMIN_HUB_SUBTABS = {
    tests: [
      { sub: "create", box: "test-create-box" },
      { sub: "list",   box: "test-list-box" }
    ],
    records: [
      { sub: "reset",     box: "record-reset-box" },
      { sub: "directory", box: "record-directory-box" },
      { sub: "results",   box: "record-results-box" }
    ],
    omr: [
      { sub: "generate", box: "omr-generate-box" },
      { sub: "manual",   box: "omr-manual-box" }
    ]
  };
  function currentAdminSub(tab) {
    var list = tab && ADMIN_HUB_SUBTABS[tab];
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (isVisible(document.getElementById(list[i].box))) return list[i].sub;
    }
    return null; // hub khula hai (koi sub-card nahi)
  }
  function goToAdminSub(tab, sub) {
    var pair = { tests: ["showTestsSubTab", "backToTestsHub"],
                 records: ["showRecordsSubTab", "backToRecordsHub"],
                 omr: ["showOmrSubTab", "backToOmrHub"] }[tab];
    if (!pair) return;
    if (sub) { try { (window[pair[0]] || function () {})(sub); } catch (e) {} }
    else { try { (window[pair[1]] || function () {})(); } catch (e) {} }
  }

  // ── Student dashboard ke ANDAR ke cards (dashboard-home <-> Start
  //    Test/My Progress/My Mistakes/Doubt Box/...) — Admin subtabs jaisa
  //    hi isolated-card system hai (goStudentSection/backToStudentDashboard,
  //    dekhein script.js), isliye back button bhi wahi treatment paata
  //    hai: card ke andar se back dabane par seedha Student dashboard-home
  //    par (aur uske baad hi peechli screen par) jao.
  var STUDENT_SUBTABS = [
    "student-form-fields-anchor", "practice-mode-card", "student-results-card",
    "my-result-detail-card", "my-progress-card", "my-mistakes-card", "student-settings-card"
  ];
  function currentStudentTab() {
    if (!isVisible($$("#student-form"))) return null;
    for (var i = 0; i < STUDENT_SUBTABS.length; i++) {
      if (isVisible(document.getElementById(STUDENT_SUBTABS[i]))) return STUDENT_SUBTABS[i];
    }
    return null; // dashboard-home (student ka "root") khula hai
  }

  function reconcileToSignature(targetSig) {
    var targetSet = targetSig ? targetSig.split("|") : [];
    for (var i = 0; i < SCREENS.length; i++) {
      var sel = SCREENS[i];
      var el = $$(sel);
      if (!el) continue;
      var shouldShow = targetSet.indexOf(sel) !== -1;
      if (shouldShow && !isVisible(el)) {
        el.classList.remove("hidden");
        if (el.style && el.style.display === "none") el.style.display = "";
      } else if (!shouldShow && isVisible(el)) {
        el.classList.add("hidden");
      }
    }
    if (targetSet.length === 0) {
      var home = $$("#home-screen");
      if (home) home.classList.remove("hidden");
      if (typeof showMode === "function") { try { showMode("student"); } catch (e) {} }
    }
  }

  // ── History state bookkeeping ────────────────────────────────
  var lastSignature = "";
  var lastExamIndex = null;
  var lastSolIndex  = null;
  var lastAdminTab  = null;
  var lastAdminSub  = null;
  var lastStudentTab = null;
  var suppress = false; // true jab hum khud UI update kar rahe hain (loop rokne ke liye)

  history.replaceState({ g: true, sig: "", examIndex: null, solIndex: null, adminTab: null, studentTab: null, adminSub: null }, "", location.href);

  function pushGuardState(sig, examIndex, solIndex, adminTab, studentTab, adminSub) {
    history.pushState({
      g: true,
      sig: sig || "",
      examIndex: (typeof examIndex === "number") ? examIndex : null,
      solIndex:  (typeof solIndex  === "number") ? solIndex  : null,
      adminTab:  (typeof adminTab  !== "undefined") ? adminTab : null,
      studentTab: (typeof studentTab !== "undefined") ? studentTab : null,
      adminSub:  (typeof adminSub  !== "undefined") ? adminSub : null
    }, "", location.href);
  }

  // ── Screen-level changes track karo (MutationObserver) ───────
  var pending = false;
  function scheduleCheck() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      checkScreenChange();
    });
  }
  function checkScreenChange() {
    if (suppress) return;
    var sig = visibleSignature();
    if (sig === lastSignature) return;
    lastSignature = sig;
    lastExamIndex = isExamActive() ? (typeof current.index === "number" ? current.index : 0) : null;
    lastSolIndex  = isSolutionActive() ? currentSolIndex : null;
    lastAdminTab  = currentAdminTab();
    lastAdminSub  = currentAdminSub(lastAdminTab);
    lastStudentTab = currentStudentTab();
    pushGuardState(sig, lastExamIndex, lastSolIndex, lastAdminTab, lastStudentTab, lastAdminSub);
  }
  var observer = new MutationObserver(scheduleCheck);
  observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"], subtree: true });

  // ── Exam: har question-change par history step banao ─────────
  if (typeof window.renderQuestion === "function") {
    var _origRenderQuestion = window.renderQuestion;
    window.renderQuestion = function () {
      var result = _origRenderQuestion.apply(this, arguments);
      trackExamIndex();
      return result;
    };
  }
  function trackExamIndex() {
    if (suppress) return;
    if (!isExamActive()) return;
    if (typeof current.index !== "number") return;
    if (current.index === lastExamIndex) return;
    lastExamIndex = current.index;
    pushGuardState(lastSignature, lastExamIndex, lastSolIndex, lastAdminTab, lastStudentTab, lastAdminSub);
  }

  // ── Admin: dashboard-home <-> Tests/Bank/OMR/... switch par bhi
  //    history step banao (goAdmin/showAdminTab/backToAdminDashboard
  //    sabhi isi showAdminTab() aur backToAdminDashboard() se hokar
  //    guzarte hain, isliye sirf inhe wrap karna kaafi hai).
  if (typeof window.showAdminTab === "function") {
    var _origShowAdminTab = window.showAdminTab;
    window.showAdminTab = function () {
      var result = _origShowAdminTab.apply(this, arguments);
      trackAdminTab();
      return result;
    };
  }
  if (typeof window.backToAdminDashboard === "function") {
    var _origBackToAdminDashboard = window.backToAdminDashboard;
    window.backToAdminDashboard = function () {
      var result = _origBackToAdminDashboard.apply(this, arguments);
      trackAdminTab();
      return result;
    };
  }
  function trackAdminTab() {
    if (suppress) return;
    var tab = currentAdminTab();
    var sub = currentAdminSub(tab);
    if (tab === lastAdminTab && sub === lastAdminSub) return;
    lastAdminTab = tab;
    lastAdminSub = sub;
    pushGuardState(lastSignature, lastExamIndex, lastSolIndex, lastAdminTab, lastStudentTab, lastAdminSub);
  }

  // ── Admin tab ke ANDAR hub <-> sub-card (Tests: Create/All, Records:
  //    Reset/Directory/Results, OMR: Generate/Manual) switch par bhi
  //    history step banao — bilkul trackAdminTab() jaisa hi, bas ek
  //    level neeche. ──────────────────────────────────────────────────
  ["showTestsSubTab", "backToTestsHub", "showRecordsSubTab", "backToRecordsHub",
   "showOmrSubTab", "backToOmrHub"].forEach(function (fnName) {
    if (typeof window[fnName] === "function") {
      var _origFn = window[fnName];
      window[fnName] = function () {
        var result = _origFn.apply(this, arguments);
        trackAdminSub();
        return result;
      };
    }
  });
  function trackAdminSub() {
    if (suppress) return;
    var tab = currentAdminTab();
    var sub = currentAdminSub(tab);
    if (tab === lastAdminTab && sub === lastAdminSub) return;
    lastAdminTab = tab;
    lastAdminSub = sub;
    pushGuardState(lastSignature, lastExamIndex, lastSolIndex, lastAdminTab, lastStudentTab, lastAdminSub);
  }

  // ── Student: dashboard-home <-> Start Test/My Progress/Doubt Box/...
  //    switch par bhi history step banao (goStudentSection/backToStudent-
  //    Dashboard sabhi hi card navigation ka istemal karte hain, isliye
  //    sirf inhe wrap karna kaafi hai — bilkul Admin jaisa hi).
  if (typeof window.goStudentSection === "function") {
    var _origGoStudentSection = window.goStudentSection;
    window.goStudentSection = function () {
      var result = _origGoStudentSection.apply(this, arguments);
      trackStudentTab();
      return result;
    };
  }
  if (typeof window.backToStudentDashboard === "function") {
    var _origBackToStudentDashboard = window.backToStudentDashboard;
    window.backToStudentDashboard = function () {
      var result = _origBackToStudentDashboard.apply(this, arguments);
      trackStudentTab();
      return result;
    };
  }
  function trackStudentTab() {
    if (suppress) return;
    var tab = currentStudentTab();
    if (tab === lastStudentTab) return;
    lastStudentTab = tab;
    pushGuardState(lastSignature, lastExamIndex, lastSolIndex, lastAdminTab, lastStudentTab, lastAdminSub);
  }

  // ── Solution review: har question-change par history step ────
  if (typeof window.renderSolQuestion === "function") {
    var _origRenderSolQuestion = window.renderSolQuestion;
    window.renderSolQuestion = function () {
      var result = _origRenderSolQuestion.apply(this, arguments);
      trackSolIndex();
      return result;
    };
  }
  function trackSolIndex() {
    if (suppress) return;
    if (!isSolutionActive()) return;
    if (typeof currentSolIndex !== "number") return;
    if (currentSolIndex === lastSolIndex) return;
    lastSolIndex = currentSolIndex;
    pushGuardState(lastSignature, lastExamIndex, lastSolIndex, lastAdminTab, lastStudentTab, lastAdminSub);
  }

  // ── "Dobara Back dabayein exit karne ke liye" toast ───────────
  var toastEl = null;
  function showExitToast() {
    if (toastEl) return;
    toastEl = document.createElement("div");
    toastEl.textContent = "⬅️ App band karne ke liye dobara Back dabayein";
    toastEl.style.cssText = "position:fixed;left:50%;bottom:30px;transform:translateX(-50%);" +
      "background:#1e1b4b;color:#fff;padding:11px 20px;border-radius:24px;font-size:.85rem;" +
      "z-index:999999;box-shadow:0 6px 18px rgba(0,0,0,.35);opacity:0;transition:opacity .25s ease;" +
      "max-width:88vw;text-align:center;pointer-events:none;";
    document.body.appendChild(toastEl);
    requestAnimationFrame(function () { toastEl.style.opacity = "1"; });
    setTimeout(function () {
      if (!toastEl) return;
      toastEl.style.opacity = "0";
      setTimeout(function () { if (toastEl) { toastEl.remove(); toastEl = null; } }, 250);
    }, 1800);
  }
  var lastHomeBackAt = 0;

  // ── Main back-button handler ─────────────────────────────────
  window.addEventListener("popstate", function (e) {
    var st = (e.state && e.state.g) ? e.state : { g: true, sig: "", examIndex: null, solIndex: null };

    // 1) Exam active, aur target state mein exam-screen nahi hai
    //    -> matlab student pehle question par tha aur ab back se
    //    poora exam chhodna chahta hai -> confirm poocho.
    if (isExamActive() && (!st.sig || st.sig.indexOf("#exam-screen") === -1)) {
      suppress = true;
      pushGuardState(lastSignature, lastExamIndex, lastSolIndex, lastAdminTab, lastStudentTab, lastAdminSub); // is back ko cancel karo
      suppress = false;
      var wantsExit = confirm(
        "⚠️ Test abhi chal raha hai!\n\n" +
        "Ye pehla sawaal hai — back jaane se test SUBMIT ho jayega.\n" +
        "Submit karke exit karna chahte hain?"
      );
      if (wantsExit && typeof showResult === "function") showResult();
      return;
    }

    // 2) Exam active aur exam-screen abhi bhi target mein hai
    //    -> sirf pichle QUESTION par le jao (slide-by-slide back).
    if (isExamActive() && st.sig && st.sig.indexOf("#exam-screen") !== -1) {
      var idx = (typeof st.examIndex === "number") ? st.examIndex : 0;
      suppress = true;
      current.index = idx;
      try { (window.renderQuestion || function () {})(); } catch (e) {}
      lastExamIndex = idx;
      suppress = false;
      return;
    }

    // 3) Solution-review screen: pichle reviewed question par jao
    if (isSolutionActive() && st.sig && st.sig.indexOf("#solution-screen") !== -1) {
      var sidx = (typeof st.solIndex === "number") ? st.solIndex : 0;
      suppress = true;
      currentSolIndex = sidx;
      try { (window.renderSolQuestion || function () {})(); } catch (e) {}
      try { if (typeof renderSolNav === "function") renderSolNav(); } catch (e) {}
      lastSolIndex = sidx;
      suppress = false;
      return;
    }

    // 4) Koi modal khula hai -> sirf usse band karo, screen wahi rahe
    var modal = topVisibleModal();
    if (modal) {
      suppress = true;
      pushGuardState(lastSignature, lastExamIndex, lastSolIndex, lastAdminTab, lastStudentTab, lastAdminSub);
      suppress = false;
      var el = $$(modal.sel);
      if (el) { try { modal.close(el); } catch (e2) { el.classList.add("hidden"); } }
      return;
    }

    // 5) Admin panel ke ANDAR hain (Tests/Bank/OMR/... ya dashboard-home),
    //    aur target state bhi wahi admin-panel screen mein hai -> seedha
    //    student/home mat phenko, sirf pichle admin section (ya dashboard-
    //    home) par jao. Isi se woh bug fix hota hai jahan section ke andar
    //    se back dabate hi seedha Student tab khul jaata tha.
    if (isVisible($$("#admin-panel")) && st.sig && st.sig.indexOf("#admin-panel") !== -1 &&
        (st.sig || "") === lastSignature) {
      var targetAdminTab = (typeof st.adminTab !== "undefined") ? st.adminTab : null;
      if (targetAdminTab !== lastAdminTab) {
        suppress = true;
        if (targetAdminTab) {
          try { (window.showAdminTab || function () {})(targetAdminTab); } catch (e) {}
        } else {
          try { (window.backToAdminDashboard || function () {})(); } catch (e) {}
        }
        lastAdminTab = targetAdminTab;
        lastAdminSub = currentAdminSub(targetAdminTab);
        suppress = false;
        return;
      }
    }

    // 5a) Wahi admin tab (Tests/Records/OMR) ke ANDAR hain, aur sirf
    //     hub <-> sub-card (jaise "Create Test" ya "All Tests") badla
    //     hai -> poori tab hi mat chhodo, sirf hub (ya target sub-card)
    //     par jao. Isi se woh bug fix hota hai jahan sub-card ke andar
    //     se back dabate hi seedha "app exit" toast aa jaata tha.
    if (isVisible($$("#admin-panel")) && st.sig && st.sig.indexOf("#admin-panel") !== -1 &&
        (st.sig || "") === lastSignature && ADMIN_HUB_SUBTABS[lastAdminTab]) {
      var targetAdminSub = (typeof st.adminSub !== "undefined") ? st.adminSub : null;
      if (targetAdminSub !== lastAdminSub) {
        suppress = true;
        goToAdminSub(lastAdminTab, targetAdminSub);
        lastAdminSub = targetAdminSub;
        suppress = false;
        return;
      }
    }

    // 5b) Student dashboard ke ANDAR hain (Start Test/My Progress/Doubt
    //     Box/... ya dashboard-home), aur target state bhi wahi student
    //     form mein hai -> seedha peechli screen (ya app-exit) mat phenko,
    //     sirf pichle student card (ya dashboard-home) par jao.
    if (isVisible($$("#student-form")) && st.sig && st.sig.indexOf("#student-form") !== -1 &&
        (st.sig || "") === lastSignature) {
      var targetStudentTab = (typeof st.studentTab !== "undefined") ? st.studentTab : null;
      if (targetStudentTab !== lastStudentTab) {
        suppress = true;
        if (targetStudentTab) {
          try { (window.goStudentSection || function () {})(targetStudentTab); } catch (e) {}
        } else {
          try { (window.backToStudentDashboard || function () {})(); } catch (e) {}
        }
        lastStudentTab = targetStudentTab;
        suppress = false;
        return;
      }
    }

    // 6) Baaki sab screens (admin/login-register/result)
    //    -> ek step peechli screen par jao (seedha home mat phenko)
    if ((st.sig || "") !== lastSignature) {
      suppress = true;
      reconcileToSignature(st.sig);
      suppress = false;
      lastSignature = st.sig || "";
      lastExamIndex = null;
      lastSolIndex  = null;
      lastAdminTab  = currentAdminTab();
      lastAdminSub  = currentAdminSub(lastAdminTab);
      lastStudentTab = currentStudentTab();
      return;
    }

    // 7) Ab bilkul home/root par hain -> dobara back = exit
    var now = Date.now();
    if (now - lastHomeBackAt < 2000) {
      return; // asli exit hone do
    }
    lastHomeBackAt = now;
    suppress = true;
    pushGuardState("", null, null, null, null, null);
    suppress = false;
    showExitToast();
  });
})();
