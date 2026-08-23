// ═══════════════════════════════════════════════════════════════
// push-notifications.js — Web Push (Firebase Cloud Messaging) client
// ═══════════════════════════════════════════════════════════════
// SETUP REQUIRED before this actually sends anything — see
// PUSH_NOTIFICATIONS_SETUP.md for full step-by-step instructions:
//   1) Firebase Console > Project Settings > Cloud Messaging >
//      "Web Push certificates" > Generate key pair -> paste it below
//      as VAPID_KEY.
//   2) Deploy the Cloud Function in /functions (needs Blaze plan) —
//      that's the part that actually SENDS the push when a test is
//      published. Without it, this file only registers the device;
//      nothing will be sent.
//
// This file only handles the CLIENT side: asking the student for
// permission, getting a device token from FCM, and saving that token
// to Firestore ("pushTokens" collection) so the Cloud Function can
// find it later. It never sends anything itself — browsers can't push
// to other devices directly, only a server (the Cloud Function) can.
// ═══════════════════════════════════════════════════════════════
(function () {
  // ⚠️ REPLACE with your own key from Firebase Console (see setup doc
  // above). Left blank by default so this feature stays a harmless
  // no-op (button shows a clear "not set up yet" message) until you
  // deliberately turn it on.
  const VAPID_KEY = "";

  const STORAGE_KEY = "savya_push_token_v1";
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

  async function getMessaging() {
    if (typeof firebase === "undefined" || !firebase.messaging) return null;
    if (!(await firebase.messaging.isSupported().catch(() => false))) return null;
    return firebase.messaging();
  }

  async function enable(silent) {
    if (!VAPID_KEY) {
      if (!silent) setStatus("⚠️ Ye feature abhi setup nahi hua hai — Admin ko PUSH_NOTIFICATIONS_SETUP.md dikhayein.");
      return;
    }
    const messaging = await getMessaging();
    if (!messaging) {
      if (!silent) setStatus("⚠️ Ye browser/device Push Notifications support nahi karta.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // Default-ON par bhi, agar student "Block" kar de to hum use
        // dobara-dobara nahi poochhte — browser khud dobara prompt nahi
        // karta jab tak student khud settings se allow na kare.
        setStatus(silent ? "🔕 Notifications abhi off hain — Settings se on kar sakte hain." : "❌ Permission nahi mili — browser settings mein notifications allow karein.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) {
        if (!silent) setStatus("❌ Token nahi mila — dobara try karein.");
        return;
      }

      const db = window.vishnuFirebase?.db;
      if (db) {
        // getStudentSession() is script.js's real helper for "who is
        // logged in right now" (localStorage-backed) — falls back to
        // null (anonymous token, still useful for a broadcast-style
        // "naya test publish hua" push) if nobody's logged in yet.
        const session = (typeof getStudentSession === "function") ? getStudentSession() : null;
        const mobile = session?.mobile || null;
        await db.collection("pushTokens").doc(token).set({
          token, mobile, role: "student",
          userAgent: navigator.userAgent,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      localStorage.setItem(STORAGE_KEY, token);
      localStorage.removeItem(OPT_OUT_KEY);
      setButtonState(true);
      setStatus("✅ Notifications ON hain — naya test publish hote hi yahan alert milega.");
    } catch (err) {
      console.warn("[Push] enable failed:", err);
      if (!silent) setStatus("❌ Kuch galat ho gaya: " + (err.message || err));
    }
  }

  async function disable() {
    const token = localStorage.getItem(STORAGE_KEY);
    const db = window.vishnuFirebase?.db;
    try {
      if (token && db) await db.collection("pushTokens").doc(token).delete();
      const messaging = await getMessaging();
      if (messaging) await messaging.deleteToken().catch(() => {});
    } catch (err) {
      console.warn("[Push] disable cleanup failed:", err);
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(OPT_OUT_KEY, "1"); // student ne khud band kiya — dobara auto-on nahi karna
    setButtonState(false);
    setStatus("🔕 Notifications OFF kar diye gaye.");
  }

  async function toggle() {
    if (localStorage.getItem(STORAGE_KEY)) {
      await disable();
    } else {
      await enable();
    }
  }

  // ── Default ON ─────────────────────────────────────────────────
  // Jaise hi koi student login hota hai (ya already-logged-in state
  // mein page reload hota hai), notifications apne aap ON karne ki
  // koshish karta hai — student ko button dabana nahi padta. Agar
  // student ne pehle khud "Off" kiya tha (OPT_OUT_KEY), ya browser ne
  // permission block kar rakhi hai, to dobara zabardasti nahi poochhte.
  // Session localStorage mein login ke turant baad set hota hai lekin
  // page reload zaroori nahi (SPA-style), isliye thodi der poll karte
  // hain taaki login hote hi (bina reload) bhi auto-on ho jaaye.
  function attemptAutoEnable() {
    if (localStorage.getItem(STORAGE_KEY)) return; // already on
    if (localStorage.getItem(OPT_OUT_KEY)) return;  // student ne khud mana kiya tha
    if (typeof Notification === "undefined" || Notification.permission === "denied") return;
    const session = (typeof getStudentSession === "function") ? getStudentSession() : null;
    if (!session) return; // sirf logged-in student ke liye — login/admin screen par prompt nahi
    enable(true);
  }

  function init() {
    const hasToken = !!localStorage.getItem(STORAGE_KEY);
    setButtonState(hasToken);
    if (hasToken) setStatus("✅ Notifications ON hain.");
    else if (localStorage.getItem(OPT_OUT_KEY)) setStatus("🔕 Aapne notifications off kar rakhe hain.");

    attemptAutoEnable();
    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      if (localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OPT_OUT_KEY) || tries > 20) {
        clearInterval(poll);
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

  window.SavyaPush = { toggle, enable, disable };
})();
