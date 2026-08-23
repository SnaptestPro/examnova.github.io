// ═══════════════════════════════════════════════════════════════
// push-notifications.js — 100% FREE in-app notification (no card,
// no Blaze plan, no Cloud Function needed)
// ═══════════════════════════════════════════════════════════════
// HOW THIS WORKS (and its one real limitation):
//   Jab bhi Admin/Question Generator koi test publish karta hai,
//   script.js ka syncTests() (Firestore ka apna already-existing
//   real-time listener) us change ko turant dekh leta hai — aur yahan
//   se notifyTestPublished() call karta hai. Us waqt agar student ka
//   app/tab khula hai (chahe background tab ho, foreground na ho),
//   to browser turant ek native-style notification dikha deta hai.
//
//   LIMITATION: Ye asli "push" nahi hai — koi server involved nahi
//   hai, isliye agar student ne app/tab poori tarah band kar rakha
//   hai (ya phone ka browser fully killed hai), to notification nahi
//   milegi. Ye poori tarah free rakhne ka trade-off hai — asli
//   "app band ho tab bhi" push ke liye Cloud Function + Blaze plan
//   chahiye (dekhein PUSH_NOTIFICATIONS_SETUP.md agar future mein
//   wo chahiye ho).
// ═══════════════════════════════════════════════════════════════
(function () {
  const OPT_OUT_KEY = "savya_push_optout_v1"; // set only when student explicitly clicks "Off"

  function setStatus(msg) {
    const el = document.getElementById("push-notify-status");
    if (el) el.textContent = msg;
  }

  function setButtonState(on) {
    const btn = document.getElementById("push-notify-toggle-btn");
    if (!btn) return;
    btn.textContent = on ? "🔕 Notifications Off Karein" : "🔔 Notifications On Karein";
  }

  function isOn() {
    return typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      !localStorage.getItem(OPT_OUT_KEY);
  }

  async function enable(silent) {
    if (typeof Notification === "undefined") {
      if (!silent) setStatus("⚠️ Ye browser Notifications support nahi karta.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(silent ? "🔕 Notifications abhi off hain — Settings se on kar sakte hain." : "❌ Permission nahi mili — browser settings mein notifications allow karein.");
        return;
      }
      localStorage.removeItem(OPT_OUT_KEY);
      setButtonState(true);
      setStatus("✅ Notifications ON hain — jab bhi naya test publish ho aur app khula ho, yahan alert milega.");
    } catch (err) {
      console.warn("[Push] enable failed:", err);
      if (!silent) setStatus("❌ Kuch galat ho gaya: " + (err.message || err));
    }
  }

  function disable() {
    localStorage.setItem(OPT_OUT_KEY, "1"); // student ne khud band kiya — dobara auto-on nahi karna
    setButtonState(false);
    setStatus("🔕 Notifications OFF kar diye gaye.");
  }

  async function toggle() {
    if (isOn()) {
      disable();
    } else {
      await enable();
    }
  }

  // ── In-app banner (fallback, aur turant visual confirmation) ─────
  // Browser-level Notification ke saath-saath, ek chhota banner bhi
  // dikhate hain — us waqt kaam aata hai jab tab background mein hai
  // ya permission grant nahi hui (banner phir bhi dikhega, kyunki
  // ye sirf normal DOM hai, koi permission nahi chahiye).
  function showBanner(title, body) {
    const existing = document.getElementById("savya-push-banner");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.id = "savya-push-banner";
    el.style.cssText = "position:fixed;top:14px;right:14px;left:14px;max-width:360px;margin-left:auto;z-index:99999;background:#1e293b;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-family:inherit;";
    el.innerHTML = `<div style="font-weight:700;margin-bottom:2px;">🔔 ${title}</div><div style="font-size:.85rem;opacity:.9;">${body}</div>`;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }

  // Called from script.js's syncTests() whenever a test transitions
  // from draft -> published. Only fires while this tab is open.
  async function notifyTestPublished(title) {
    if (localStorage.getItem(OPT_OUT_KEY)) return;
    const body = `${title || "Ek naya test"} ab available hai — abhi attempt karein!`;
    showBanner("Naya Test Publish Hua!", body);

    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      if (navigator.serviceWorker) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification("📝 Naya Test Publish Hua!", { body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: "/" } });
      } else {
        new Notification("📝 Naya Test Publish Hua!", { body, icon: "/icon-192.png" });
      }
    } catch (err) {
      console.warn("[Push] local notification failed:", err);
    }
  }

  // ── Default ON ─────────────────────────────────────────────────
  // Jaise hi koi student login hota hai, permission apne aap maangi
  // jaati hai — button dabana nahi padta. Agar student ne pehle khud
  // "Off" kiya tha, dobara zabardasti nahi poochhte.
  function attemptAutoEnable() {
    if (localStorage.getItem(OPT_OUT_KEY)) return;
    if (typeof Notification === "undefined" || Notification.permission === "denied" || Notification.permission === "granted") return;
    const session = (typeof getStudentSession === "function") ? getStudentSession() : null;
    if (!session) return; // sirf logged-in student ke liye — login/admin screen par prompt nahi
    enable(true);
  }

  function init() {
    setButtonState(isOn());
    if (isOn()) setStatus("✅ Notifications ON hain.");
    else if (localStorage.getItem(OPT_OUT_KEY)) setStatus("🔕 Aapne notifications off kar rakhe hain.");

    attemptAutoEnable();
    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      if (isOn() || localStorage.getItem(OPT_OUT_KEY) || tries > 20) {
        clearInterval(poll);
        setButtonState(isOn());
        return;
      }
      attemptAutoEnable();
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.SavyaPush = { toggle, enable, disable, notifyTestPublished };
})();
