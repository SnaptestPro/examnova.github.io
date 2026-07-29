// ═══════════════════════════════════════════════════════════════
// qgen-admin-gate.js
// Ye tool (Question Generator) pehle bina kisi login ke publicly
// khula hua tha — koi bhi is URL par aakar seedha questionBank mein
// likh sakta tha aur Groq AI key bhi dekh sakta tha.
//
// Asli security Firestore Rules se aati hai (firestore.rules mein
// isAdmin() check) — ye overlay sirf UI ke liye hai taaki admin ko
// pehle login karna padhe, warna neeche ka tool dikhega hi nahi.
// ═══════════════════════════════════════════════════════════════
(function () {
  function showGate() {
    const overlay = document.createElement("div");
    overlay.id = "qgen-admin-gate-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#0f172a,#1e293b);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif;";
    overlay.innerHTML = `
      <form id="qgen-gate-form" style="background:#fff;border-radius:16px;padding:28px 26px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4);">
        <h2 style="margin:0 0 6px;font-size:1.25rem;color:#0f172a;">🔐 Admin Login</h2>
        <p style="margin:0 0 18px;font-size:.85rem;color:#64748b;">Ye tool sirf admin ke liye hai. Apna admin email aur password daalein.</p>
        <input id="qgen-gate-email" type="email" placeholder="Admin email" autocomplete="username" style="width:100%;box-sizing:border-box;padding:10px 12px;margin-bottom:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:.95rem;" />
        <input id="qgen-gate-pass" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:10px 12px;margin-bottom:14px;border:1px solid #cbd5e1;border-radius:8px;font-size:.95rem;" />
        <button type="submit" style="width:100%;padding:11px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;font-size:.95rem;cursor:pointer;">Login</button>
        <p id="qgen-gate-error" style="color:#dc2626;font-size:.82rem;margin:12px 0 0;min-height:1.2em;"></p>
        <p style="margin:14px 0 0;font-size:.78rem;color:#94a3b8;">Naya admin abhi tak setup nahi hua? Pehle main app (index.html) ke Admin panel se login/migrate karein.</p>
      </form>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#qgen-gate-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = overlay.querySelector("#qgen-gate-email").value.trim();
      const pass = overlay.querySelector("#qgen-gate-pass").value;
      const errEl = overlay.querySelector("#qgen-gate-error");
      errEl.textContent = "";
      try {
        if (typeof firebase === "undefined" || !firebase.auth) throw new Error("Firebase Auth load nahi hua.");
        await firebase.auth().signInWithEmailAndPassword(email, pass);
        overlay.remove();
      } catch (err) {
        console.error(err);
        errEl.textContent = "Login fail: Galat email/password ya account admin list mein nahi hai.";
      }
    });
  }

  function init() {
    if (typeof firebase === "undefined" || !firebase.auth) { showGate(); return; }
    firebase.auth().onAuthStateChanged((user) => {
      const existing = document.getElementById("qgen-admin-gate-overlay");
      if (user && !user.isAnonymous) {
        if (existing) existing.remove();
      } else if (!existing) {
        showGate();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
