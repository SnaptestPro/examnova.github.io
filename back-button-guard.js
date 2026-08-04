/* ════════════════════════════════════════════════════════════════
   SAVYASACHI — ANDROID BACK BUTTON GUARD
   ════════════════════════════════════════════════════════════════
   PROBLEM: App ko Android par TWA/APK ki tarah wrap kiya gaya hai.
   Puri app single HTML page hai jahan screens/modals sirf CSS
   (.hidden class / style.display) se show-hide hote hain — kabhi
   bhi `history.pushState` nahi hota. Isliye jab student "back"
   button dabata hai, WebView ke paas history mein kuch nahi hota
   aur poora app turant band ho jata hai — chahe exam beech mein
   ho ya kahin bhi.

   FIX: Ye script har screen/modal ke visible hone par ek history
   entry banata hai (MutationObserver se — isliye poore app mein
   kaam karta hai, kisi bhi individual button/function ko chhue
   bina). Back button dabane par:
     1. Agar EXAM chal raha hai      -> seedha exit nahi hone deta,
                                         pehle confirm poochta hai.
     2. Agar koi MODAL khula hai     -> sirf modal band karta hai.
     3. Agar koi aur screen khula hai -> home screen par le jata hai.
     4. Home par ho                  -> "Wapas dabayein exit ke liye"
                                         (double-back-to-exit).
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var $$ = function (sel) { return document.querySelector(sel); };

  // Screens aur modals jinhe guard karna hai. Naye modal/screen add
  // karne ho to bas yahan ek entry badha dein — baaki sab khud-ba-khud
  // kaam karega (MutationObserver poore <body> ko dekhta hai).
  var GUARDED = [
    { sel: "#exam-screen",         type: "exam"   },
    { sel: "#result-screen",       type: "screen" },
    { sel: "#solution-screen",     type: "screen" },
    { sel: "#student-auth-screen", type: "screen" },
    { sel: "#student-form",        type: "screen" },
    { sel: "#admin-panel",         type: "screen" },
    { sel: "#leaderboard-section", type: "screen" },
    { sel: "#bank-edit-modal",     type: "modal",
      close: function (el) { if (typeof hideBankModal === "function") hideBankModal(); else el.classList.add("hidden"); } },
    { sel: "#move-chapter-modal",  type: "modal",
      close: function (el) { if (typeof closeMoveChapterModal === "function") closeMoveChapterModal(); else el.style.display = "none"; } },
    { sel: "#theme-picker-modal",  type: "modal",
      close: function (el) { if (window.ThemeManager && typeof ThemeManager.hidePicker === "function") ThemeManager.hidePicker(); else el.style.display = "none"; } },
    { sel: "#app-install-modal",   type: "modal",
      close: function (el) { el.classList.add("hidden"); } }
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
    for (var i = 0; i < GUARDED.length; i++) {
      var el = $$(GUARDED[i].sel);
      if (isVisible(el)) parts.push(GUARDED[i].sel);
    }
    return parts.join("|");
  }

  function isExamActive() {
    var examEl = $$("#exam-screen");
    return isVisible(examEl) && typeof current !== "undefined" && current && current.test;
  }

  function topVisibleModal() {
    for (var i = GUARDED.length - 1; i >= 0; i--) {
      if (GUARDED[i].type === "modal" && isVisible($$(GUARDED[i].sel))) return GUARDED[i];
    }
    return null;
  }

  function goHome() {
    try {
      var resultScr = $$("#result-screen");
      var solutionScr = $$("#solution-screen");
      var examScr = $$("#exam-screen");
      var homeScr = $$("#home-screen");
      if (resultScr) resultScr.classList.add("hidden");
      if (solutionScr) solutionScr.classList.add("hidden");
      if (examScr) examScr.classList.add("hidden");
      if (homeScr) homeScr.classList.remove("hidden");
      if (typeof showMode === "function") showMode("student");
    } catch (e) { /* fail-safe: no-op */ }
  }

  // ── History bookkeeping ──────────────────────────────────────
  var lastSignature = "";
  history.replaceState({ savyaGuard: true, tag: "base" }, "", location.href);

  function pushGuardState(tag) {
    history.pushState({ savyaGuard: true, tag: tag }, "", location.href);
  }

  function checkAndTrack() {
    var sig = visibleSignature();
    if (sig !== lastSignature) {
      lastSignature = sig;
      if (sig !== "") pushGuardState(sig);
    }
  }

  var observer = new MutationObserver(checkAndTrack);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style"],
    subtree: true
  });

  // ── "Back dobara dabayein exit karne ke liye" toast ──────────
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
  window.addEventListener("popstate", function () {
    // 1) Test chal raha hai — turant exit mat karo, confirm lo.
    if (isExamActive()) {
      pushGuardState("exam-block"); // back navigation cancel
      var wantsExit = confirm(
        "⚠️ Test abhi chal raha hai!\n\n" +
        "Back jaane se test SUBMIT ho jayega.\n" +
        "Submit karke exit karna chahte hain?"
      );
      if (wantsExit && typeof showResult === "function") {
        showResult();
      }
      return;
    }

    // 2) Koi modal khula hai — sirf usse band karo.
    var modal = topVisibleModal();
    if (modal) {
      pushGuardState("after-modal-close");
      var el = $$(modal.sel);
      if (el && modal.close) {
        try { modal.close(el); } catch (e) { el.classList.add("hidden"); }
      }
      return;
    }

    // 3) Koi aur screen khula hai (admin panel, result, solution,
    //    login/register form, leaderboard) — home par le jao.
    var sig = visibleSignature();
    if (sig !== "") {
      pushGuardState("after-go-home");
      goHome();
      return;
    }

    // 4) Home/root par ho — double-back-to-exit.
    var now = Date.now();
    if (now - lastHomeBackAt < 2000) {
      // Doosri baar back dabaya — asli exit hone do (state re-push
      // nahi karte, isliye TWA/Browser apna default back-navigation
      // karega jo ab app close karega).
      return;
    }
    lastHomeBackAt = now;
    pushGuardState("home-guard");
    showExitToast();
  });
})();
