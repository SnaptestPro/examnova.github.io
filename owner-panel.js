/* ══════════════════════════════════════════════════════════════════
   EXAMNOVA — OWNER PANEL
   ══════════════════════════════════════════════════════════════════
   Ye "Admin Panel" se bilkul ALAG, upar ka ek role hai:

     Owner  →  ek hi banda (aapka, product ka maalik)
     Admin  →  har coaching institute ka apna alag admin

   Owner Panel se ye sab dikhta/hota hai:
     • Kitne institutes hain, har ek ka naam
     • Har institute ka admin (email) kaun hai
     • Naya institute + uska admin add karna
     • Kisi admin ki access turant band/chालू (disable/enable) karna
     • Kisi admin ka record hata dena (institute se unlink)
     • Kisi admin ko password-reset email bhejna (taaki uska password
       badal sake — Owner khud kisi ka password type karke nahi daal
       sakta, ye Firebase ki apni security design hai; reset EMAIL
       LINK hi sabse surakshit tareeka hai)

   Access sirf usi email ko milta hai jo firestore.rules mein
   OWNER_EMAIL ki jagah likha gaya hai (function isOwner() dekhein) —
   is file mein koi email hardcode nahi hai, asli security rules se
   hi aati hai (bilkul admin wale system jaisa).

   Poori tarah ek permanent Firebase Auth account DELETE karna (sirf
   Firestore record nahi, balki asli login account) client-side se
   surakshit tareeke se nahi ho sakta — uske liye ek Cloud Function
   (Firebase Admin SDK, server-side) chahiye. Wo optional add-on
   OWNER_CLOUD_FUNCTIONS_optional.js + OWNER_PANEL_SETUP.md mein diya
   gaya hai. Yahan diya gaya "Disable" button practically wahi kaam
   karta hai (admin turant access khota hai) bina us extra setup ke.
   ══════════════════════════════════════════════════════════════════ */

const OWNER_LOGIN_KEY = "examnova_owner_logged_in";
const OWNER_EMAIL_LOCAL_KEY = "examnova_owner_email";

let _ownerInstitutesCache = {};   // instituteId -> {id, name, active}
let _ownerAdminsCache = {};       // email -> {email, instituteId, instituteName, active}
let _ownerListenersStarted = false;
let _ownerSecondaryAppCounter = 0;

// ── FIX (v24_17): Owner Panel apna ALAG, isolated login session use karta hai ──
// ROOT CAUSE jo is se pehle mila: Owner Panel aur Admin Panel dono isi ek
// hi page par hain aur pehle dono ek hi shared `window.vishnuFirebase.auth`
// (Firebase ka default/primary app) use karte the. Firebase Auth ke ek app
// instance mein EK waqt sirf EK hi "currentUser" ho sakta hai — isliye agar
// isi browser mein (chahe kisi doosre tab mein bhi) Admin Panel se
// `vks1234stm@gmail.com` jaisa koi ADMIN login hota tha, to wo shared session
// ko silently OVERWRITE kar deta tha. Owner Panel ka UI khula/cached rehta
// tha (isliye kuch galat nahi lagta tha), lekin uske baad har write asal mein
// us admin ke naam se jaati thi — isliye "Missing or insufficient
// permissions" (jaisa debug message ne confirm kiya: "Us waqt sign-in tha:
// vks1234stm@gmail.com").
//
// FIX: Owner Panel ab apna ek ALAG, persistent secondary Firebase App
// instance use karta hai (`ownerEnsureApp()` neeche) — bilkul us tarah jaise
// "Add Admin" wala code pehle se ek TEMPORARY secondary app use karta tha
// (naya admin account banane ke liye, taaki owner ka session disturb na ho).
// Farak sirf itna hai ki ye wala persistent hai (poori Owner session ke
// liye) aur apna khud ka Firebase Auth + Firestore rakhta hai — isliye ab
// isi browser mein Admin Panel se koi bhi login/logout ho, Owner Panel ka
// session bilkul untouched rehta hai.
let _ownerApp = null;
let _ownerAuthInstance = null;
let _ownerDbInstance = null;
function ownerEnsureApp() {
  if (_ownerApp) return;
  try {
    _ownerApp = firebase.initializeApp(firebase.app().options, "owner-panel-session");
  } catch (e) {
    // Agar (rare) pehle se bana hua mil jaaye (e.g. hot-reload), usi ko use kar lo.
    _ownerApp = firebase.app("owner-panel-session");
  }
  _ownerAuthInstance = _ownerApp.auth();
  _ownerDbInstance = _ownerApp.firestore();
}

function ownerGetAuth() {
  ownerEnsureApp();
  return _ownerAuthInstance;
}
function ownerGetDb() {
  ownerEnsureApp();
  return _ownerDbInstance;

}
function ownerIsLoggedInFlag() {
  try { return localStorage.getItem(OWNER_LOGIN_KEY) === "true"; } catch (e) { return false; }
}
function ownerSetLoggedInFlag() {
  try { localStorage.setItem(OWNER_LOGIN_KEY, "true"); } catch (e) {}
}
function ownerClearLoggedInFlag() {
  try { localStorage.removeItem(OWNER_LOGIN_KEY); } catch (e) {}
}
function ownerRememberEmail(email) {
  try { localStorage.setItem(OWNER_EMAIL_LOCAL_KEY, email); } catch (e) {}
}
function ownerGetRememberedEmail() {
  try { return localStorage.getItem(OWNER_EMAIL_LOCAL_KEY) || ""; } catch (e) { return ""; }
}
function ownerIsEmailLike(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

// ── Show/hide overlay ──────────────────────────────────────────────
function openOwnerOverlay() {
  document.getElementById("owner-overlay-bg")?.classList.remove("hidden");
  const auth = ownerGetAuth();
  if (ownerIsLoggedInFlag() && auth && auth.currentUser && auth.currentUser.email === ownerGetRememberedEmail()) {
    ownerShowPanel();
  } else {
    ownerShowLogin();
  }
}
function closeOwnerOverlay() {
  document.getElementById("owner-overlay-bg")?.classList.add("hidden");
  // ?owner=1 URL se aaye the to usse hata do taaki reload par dobara na khule
  const url = new URL(window.location.href);
  if (url.searchParams.get("owner")) {
    url.searchParams.delete("owner");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
}
function ownerShowLogin() {
  document.getElementById("owner-login-box")?.classList.remove("hidden");
  document.getElementById("owner-panel-box")?.classList.add("hidden");
  const emailInput = document.getElementById("owner-email");
  if (emailInput) emailInput.value = ownerGetRememberedEmail();
}
function ownerShowPanel() {
  document.getElementById("owner-login-box")?.classList.add("hidden");
  document.getElementById("owner-panel-box")?.classList.remove("hidden");
  ownerStartListeners();
}

// ── Login / Logout ─────────────────────────────────────────────────
async function ownerLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const auth = ownerGetAuth();
  if (!auth) { alert("⚠️ Firebase Auth load nahi hua. Page reload karein."); return; }
  const email = (document.getElementById("owner-email")?.value || "").trim();
  const pass = document.getElementById("owner-password")?.value || "";
  if (!ownerIsEmailLike(email)) { alert("Sahi email address likhein."); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    ownerRememberEmail(email);
    ownerSetLoggedInFlag();
    ownerShowPanel();
  } catch (err) {
    console.warn("[owner] login failed", err && err.code);
    alert("Galat email ya password (ya ye email Owner ke roop mein authorize nahi hai).");
  }
}
function ownerLogout() {
  if (!confirm("Owner session se logout karein?")) return;
  try {
    const auth = ownerGetAuth();
    if (auth && auth.currentUser) auth.signOut().catch(() => {});
  } catch (e) {}
  ownerClearLoggedInFlag();
  closeOwnerOverlay();
  ownerShowLogin();
}

// ── Realtime listeners: institutes + admins ────────────────────────
function ownerStartListeners() {
  if (_ownerListenersStarted) { ownerRenderList(); return; }
  const db = ownerGetDb();
  if (!db) { alert("⚠️ Firestore load nahi hua."); return; }
  _ownerListenersStarted = true;

  db.collection("institutes").onSnapshot((snap) => {
    _ownerInstitutesCache = {};
    snap.forEach((doc) => { _ownerInstitutesCache[doc.id] = { id: doc.id, ...doc.data() }; });
    ownerRenderList();
  }, (err) => {
    console.error("[owner] institutes listener error", err);
    const box = document.getElementById("owner-institutes-list");
    if (box) box.innerHTML = `<p class="muted-text">⚠️ Load nahi ho paaya: ${err.message || err}</p>`;
  });

  db.collection("admins").onSnapshot((snap) => {
    _ownerAdminsCache = {};
    snap.forEach((doc) => { _ownerAdminsCache[doc.id] = { email: doc.id, ...doc.data() }; });
    ownerRenderList();
  }, (err) => console.error("[owner] admins listener error", err));
}

// ── Render institutes + their admins ───────────────────────────────
function ownerRenderList() {
  const box = document.getElementById("owner-institutes-list");
  if (!box) return;

  const institutes = Object.values(_ownerInstitutesCache).sort((a, b) =>
    (a.name || "").localeCompare(b.name || ""));
  const adminsByInstitute = {};
  const orphanAdmins = [];
  Object.values(_ownerAdminsCache).forEach((a) => {
    if (a.instituteId && _ownerInstitutesCache[a.instituteId]) {
      (adminsByInstitute[a.instituteId] = adminsByInstitute[a.instituteId] || []).push(a);
    } else {
      orphanAdmins.push(a);
    }
  });

  if (institutes.length === 0 && orphanAdmins.length === 0) {
    box.innerHTML = `<p class="muted-text">Abhi koi institute add nahi hua. Upar wale form se pehla institute banayein.</p>`;
    return;
  }

  let html = "";
  institutes.forEach((inst) => {
    const admins = adminsByInstitute[inst.id] || [];
    html += `
      <div class="owner-inst-card">
        <div class="owner-inst-head">
          <div>
            <strong>${ownerDecorateInstituteName(inst.name || "(naam nahi)")}</strong>
            <span class="owner-badge ${inst.active === false ? "owner-badge-off" : "owner-badge-on"}">${inst.active === false ? "Inactive" : "Active"}</span>
          </div>
          <div class="owner-inst-actions">
            <button type="button" class="owner-mini-btn" onclick="ownerRenameInstitute('${inst.id}', '${ownerEscAttr(inst.name || "")}')">✏️ Rename</button>
            <button type="button" class="owner-mini-btn" onclick="ownerToggleInstitute('${inst.id}', ${inst.active === false})">${inst.active === false ? "▶️ Activate" : "⏸️ Deactivate"}</button>
            <button type="button" class="owner-mini-btn owner-mini-danger" onclick="ownerDeleteInstitute('${inst.id}')">🗑️ Remove</button>
          </div>
        </div>

        <div class="owner-admin-list">
          ${admins.length === 0 ? `<p class="muted-text" style="margin:6px 0;">Is institute ka abhi koi admin nahi hai.</p>` : admins.map(ownerAdminRowHtml).join("")}
        </div>

        <form class="owner-add-admin-form" onsubmit="return ownerAddAdminSubmit(event, '${inst.id}', '${ownerEscAttr(inst.name || "")}')">
          <input type="email" placeholder="Naye admin ka email" required style="flex:1;min-width:160px;" />
          <button type="submit" class="owner-mini-btn owner-mini-primary">+ Admin Add Karein</button>
        </form>
      </div>`;
  });

  if (orphanAdmins.length > 0) {
    html += `
      <div class="owner-inst-card owner-inst-card-orphan">
        <div class="owner-inst-head"><strong>⚠️ Bina institute ke admins</strong></div>
        <div class="owner-admin-list">${orphanAdmins.map(ownerOrphanAdminBlockHtml).join("")}</div>
      </div>`;
  }

  box.innerHTML = html;
}

// Orphan admin = jiska institute record delete/remove ho gaya (admin ka
// apna `admins/{email}` doc abhi bhi hai, uska `instituteId` field bhi
// abhi bhi wahi purani ID rakhta hai — bas us ID ka institute doc ab
// nahi hai). Aisi admin row ke saath ek "🔁 Institute Wapas Banayein"
// mini-form bhi dikhate hain (agar stale instituteId maujood hai), jo
// institute ko EXACT USI purani ID se dobara banata hai — naye
// ".add()" se random nayi ID se NAHI, isliye is admin ka purana
// Tests/Exam Manager data (jo isi instituteId se tagged hai) turant
// khud-ba-khud dobara connect ho jaata hai, kuch migrate/tootna nahi
// padta.
function ownerOrphanAdminBlockHtml(a) {
  const row = ownerAdminRowHtml(a);
  if (!a.instituteId) {
    // Kabhi kisi institute se juda hi nahi tha (instituteId field hi
    // nahi hai) — "wapas banayein" ka matlab nahi (kuch tha hi nahi
    // recreate karne ko), isliye ALAG form: naya institute banao aur
    // isi admin ko usse jodo, ek hi click mein.
    return row + `
      <form class="owner-add-admin-form" onsubmit="return ownerAssignNewInstituteSubmit(event, '${ownerEscAttr(a.email)}')" style="margin:-4px 0 14px;">
        <input type="text" placeholder="Institute ka naam (is admin ke liye)" required style="flex:1;min-width:160px;" />
        <button type="submit" class="owner-mini-btn owner-mini-primary">🏢 Institute Naam Set Karein</button>
      </form>`;
  }
  return row + `
    <form class="owner-add-admin-form" onsubmit="return ownerRecreateInstituteSubmit(event, '${ownerEscAttr(a.instituteId)}', '${ownerEscAttr(a.email)}')" style="margin:-4px 0 14px;">
      <input type="text" placeholder="Institute ka naam (wapas banane ke liye)" required style="flex:1;min-width:160px;" />
      <button type="submit" class="owner-mini-btn owner-mini-primary">🔁 Institute Wapas Banayein</button>
    </form>`;
}

function ownerAdminRowHtml(a) {
  const disabled = a.active === false;
  return `
    <div class="owner-admin-row">
      <div class="owner-admin-email">
        ${ownerEsc(a.email)}
        <span class="owner-badge ${disabled ? "owner-badge-off" : "owner-badge-on"}">${disabled ? "Disabled" : "Active"}</span>
      </div>
      <div class="owner-admin-actions">
        <button type="button" class="owner-mini-btn" onclick="ownerToggleAdmin('${ownerEscAttr(a.email)}', ${!disabled})">${disabled ? "✅ Enable" : "⛔ Disable"}</button>
        <button type="button" class="owner-mini-btn" onclick="ownerResetAdminPassword('${ownerEscAttr(a.email)}')">🔑 Password Reset Email</button>
        <button type="button" class="owner-mini-btn owner-mini-danger" onclick="ownerRemoveAdminRecord('${ownerEscAttr(a.email)}')">🗑️ Remove</button>
      </div>
    </div>`;
}

function ownerEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function ownerEscAttr(s) {
  return String(s == null ? "" : s).replace(/'/g, "\\'");
}

// ── Decorative institute-name display (v24_21) ─────────────────────
// Owner ne khud maanga hai ki har institute ka naam Owner Panel mein
// isi block-character style ke saath dikhe:
// "█▓▒▒░░░NAAM░░░▒▒▓█". Ye SIRF DISPLAY par lagta hai — asli stored
// `institutes/{id}.name` ab bhi plain text hi rehta hai (Rename box,
// Add-Admin form waghera mein plain naam hi dikhta hai) — isse dobara
// Rename karne par ye decoration doubled/nested nahi hoti.
function ownerDecorateInstituteName(name) {
  return "█▓▒▒░░░" + ownerEsc(String(name || "").toUpperCase()) + "░░░▒▒▓█";
}

// ── Add institute ───────────────────────────────────────────────────
async function ownerAddInstituteSubmit(e) {
  e.preventDefault();
  const db = ownerGetDb();
  const input = document.getElementById("owner-new-institute-name");
  const name = (input?.value || "").trim();
  if (!name) { alert("Institute ka naam likhein."); return false; }
  try {
    await db.collection("institutes").add({
      name,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (input) input.value = "";
  } catch (err) {
    console.error(err);
    alert("Institute add nahi hua: " + (err.message || err));
  }
  return false;
}

// ── Recreate a removed institute for an orphan admin ─────────────────
// Institute card "🗑️ Remove" karne se sirf institute DOC delete hota
// hai — us institute ke admin ka `admins/{email}` doc (aur usme purani
// instituteId) waisa hi rehta hai (jaan-boojh kar, taaki ek click se
// accidental data-loss na ho). Ye function usi purani instituteId se
// institute doc WAPAS bana deta hai (.doc(id).set(), naya .add() nahi)
// — isse admin ka purana Tests/Exam Manager data turant reconnect ho
// jaata hai — aur saath hi admin ko activate bhi kar deta hai, taaki
// "institute remove + admin disable" wali state ek hi click mein wapas
// normal ho jaaye.
async function ownerRecreateInstituteSubmit(e, instituteId, email) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('input[type="text"]');
  const name = (input?.value || "").trim();
  if (!name) { alert("Institute ka naam likhein."); return false; }

  const db = ownerGetDb();
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Recreate ho raha hai..."; }

  try {
    await db.collection("institutes").doc(instituteId).set({
      name,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("admins").doc(email).update({ active: true, instituteName: name });
    alert("✅ Institute wapas ban gaya (\"" + name + "\") aur " + email + " activate ho gaya.");
  } catch (err) {
    console.error(err);
    alert("Nahi hua: " + (err.message || err));
    if (btn) { btn.disabled = false; btn.textContent = "🔁 Institute Wapas Banayein"; }
  }
  return false;
}

// ── Naya institute banao aur ise ek admin se jodo (jiska instituteId
// bilkul bhi set nahi hai) ──────────────────────────────────────────
// Alag se naya institute doc banata hai (naya ".add()" ID) aur usi
// email ke admin doc mein wo instituteId + naam stamp kar deta hai —
// isse aisa admin bhi turant kisi institute se jud jaata hai jise
// pehle kabhi koi institute name mila hi nahi tha.
async function ownerAssignNewInstituteSubmit(e, email) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('input[type="text"]');
  const name = (input?.value || "").trim();
  if (!name) { alert("Institute ka naam likhein."); return false; }

  const db = ownerGetDb();
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Set ho raha hai..."; }

  try {
    const instRef = await db.collection("institutes").add({
      name,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("admins").doc(email).update({
      instituteId: instRef.id,
      instituteName: name
    });
    alert("✅ \"" + name + "\" institute ban gaya aur " + email + " ab isse juda hai.");
  } catch (err) {
    console.error(err);
    alert("Nahi hua: " + (err.message || err));
    if (btn) { btn.disabled = false; btn.textContent = "🏢 Institute Naam Set Karein"; }
  }
  return false;
}

// ── Fix (v24_16): intermittent "Missing or insufficient permissions" ──
// Owner Panel ke writes sirf isOwner() (exact email match) par depend
// karte hain, jo deterministic hai — isliye agar wahi button kabhi
// kaam karta hai kabhi nahi, iski sabse aam wajah ye hai ki Firestore
// ke paas us waqt owner ka STALE ID token tha (auth state theek hai,
// lekin token cache mein purana/expired). Firebase SDK usually khud
// refresh karta hai, par kabhi-kabhi ek stale token slip ho jaata hai
// — khaaskar jab tab bahut der se khula pada ho ya laptop sleep se
// wapas aaya ho. Fix: permission-denied milte hi ek baar force token
// refresh karke write khud-ba-khud dobara try karo, tabhi user ko error
// dikhao jab retry ke baad bhi fail ho — aur us error mein ab ye bhi
// batao ki us waqt Firestore ke hisaab se sign-in kis email se tha,
// taaki agar dobara aaye to turant pata chal jaaye ki auth-drop hua ya
// kuch aur.
async function ownerRetryOnPermissionDenied(writeFn) {
  try {
    await writeFn();
  } catch (err) {
    const isPermission = String(err && err.code || "").toLowerCase().includes("permission");
    const auth = ownerGetAuth();
    if (isPermission && auth && auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(true); // force refresh, stale-token slip fix karta hai
        await writeFn();
        return; // retry ke baad chal gaya — user ko kuch dikhane ki zaroorat nahi
      } catch (retryErr) {
        err = retryErr;
      }
    }
    const whoAmI = auth && auth.currentUser
      ? (auth.currentUser.isAnonymous ? "anonymous session (owner login drop ho gaya)" : auth.currentUser.email)
      : "koi bhi login nahi (signed out)";
    alert("Update nahi hua: " + (err.message || err) + "\n\n(Us waqt sign-in tha: " + whoAmI + ")");
  }
}

// ── Rename institute ────────────────────────────────────────────────
// "My Institute (email)" jaisa default naam tab ban jaata hai jab
// koi admin email pehli baar seedha Admin Panel se login karta hai
// bina Owner Panel se pehle proper naam ke saath banaye gaye
// (legacy self-migration, script.js resolveCurrentAdminInstitute()) —
// app khud ek placeholder naam de deta hai taaki kaam rukta na rahe.
// Ye button us placeholder ko asli naam se badalne ke liye hai — ID
// (aur us se juda saara Tests/Exam Manager data) bilkul wahi rehta
// hai, sirf display naam badalta hai.
async function ownerRenameInstitute(id, currentName) {
  const newName = prompt("Institute ka naya naam likhein:", currentName || "");
  if (newName === null) return; // cancel
  const trimmed = newName.trim();
  if (!trimmed) { alert("Naam khaali nahi ho sakta."); return; }
  const db = ownerGetDb();
  await ownerRetryOnPermissionDenied(async () => {
    await db.collection("institutes").doc(id).update({ name: trimmed });
    // Admin doc mein bhi stamped copy hai (Welcome banner isse padhta
    // hai fallback ke roop mein) — usse bhi sync kar do.
    const admins = Object.values(_ownerAdminsCache).filter(a => a.instituteId === id);
    await Promise.all(admins.map(a =>
      db.collection("admins").doc(a.email).update({ instituteName: trimmed }).catch(() => {})
    ));
  });
}

async function ownerToggleInstitute(id, makeActive) {
  const db = ownerGetDb();
  await ownerRetryOnPermissionDenied(() =>
    db.collection("institutes").doc(id).update({ active: makeActive })
  );
}

async function ownerDeleteInstitute(id) {
  const admins = Object.values(_ownerAdminsCache).filter(a => a.instituteId === id);
  const msg = admins.length > 0
    ? `Is institute ke saath ${admins.length} admin record bhi juda hai. Institute hatane se wo admin bhi "bina institute ke" list mein chala jayega (uska access khud disable nahi hoga). Aage badhein?`
    : "Ye institute record hamesha ke liye hata diya jayega. Aage badhein?";
  if (!confirm(msg)) return;
  const db = ownerGetDb();
  try {
    await db.collection("institutes").doc(id).delete();
  } catch (err) {
    alert("Delete nahi hua: " + (err.message || err));
  }
}

// ── Add admin to an institute ────────────────────────────────────────
// Naya Firebase Auth account (agar pehle se nahi hai) ek SECONDARY
// firebase app instance se banaya jaata hai — isse Owner ka apna
// current login session disturb/replace nahi hota. Turant baad usi
// email par ek "password set karein" link bhej diya jaata hai, taaki
// asli password sirf wahi admin khud, apne inbox se, set kare — Owner
// (ya koi bhi) ko wo password kabhi type/dekhna nahi padta.
async function ownerAddAdminSubmit(e, instituteId, instituteName) {
  e.preventDefault();
  const form = e.target;
  const emailInput = form.querySelector('input[type="email"]');
  const email = (emailInput?.value || "").trim().toLowerCase();
  if (!ownerIsEmailLike(email)) { alert("Sahi email address likhein."); return false; }

  const db = ownerGetDb();
  const auth = ownerGetAuth();
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "Adding..."; }

  try {
    // 1) Firestore admin record (ye hi isAdmin() rule check karta hai)
    await db.collection("admins").doc(email).set({
      email,
      instituteId,
      instituteName,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2) Real Firebase Auth login account — agar pehle se nahi hai to
    //    secondary app instance se ek random temp password ke saath
    //    bana dete hain (owner ka apna session isse touch nahi hota).
    _ownerSecondaryAppCounter += 1;
    const secondaryApp = firebase.initializeApp(firebase.app().options, "owner-secondary-" + _ownerSecondaryAppCounter);
    const secondaryAuth = secondaryApp.auth();
    const tempPassword = "Tmp-" + Math.random().toString(36).slice(2) + "Aa1!";
    let accountCreated = false;
    try {
      await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
      accountCreated = true;
    } catch (createErr) {
      if (createErr.code !== "auth/email-already-in-use") {
        console.warn("[owner] admin auth account create failed", createErr);
      }
    }
    try { await secondaryAuth.signOut(); } catch (e2) {}
    try { await secondaryApp.delete(); } catch (e3) {}

    // 3) Password-set/reset link bhej do (naye account ke liye "pehli
    //    baar apna password chunein", purane ke liye normal reset).
    try {
      await auth.sendPasswordResetEmail(email);
    } catch (mailErr) {
      console.warn("[owner] password reset email failed", mailErr);
    }

    form.reset();
    alert(
      (accountCreated
        ? "✅ Naya admin add ho gaya (" + email + ").\n\n"
        : "✅ Admin is institute se link ho gaya (" + email + ").\n\n") +
      "📧 Us email par ek link bhej diya gaya hai jisse wo apna password khud set kar sakta/sakti hai."
    );
  } catch (err) {
    console.error(err);
    alert("Admin add nahi hua: " + (err.message || err));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "+ Admin Add Karein"; }
  }
  return false;
}

// ── Disable / Enable admin access ─────────────────────────────────
// Ye asli Firebase Auth account delete nahi karta (client se surakshit
// tareeke se nahi ho sakta) — lekin firestore.rules ka isAdmin() check
// "active" field par hi depend karta hai, isliye Disable karte hi us
// admin ka HAR jagah access (Tests/Question Bank/Records — sab kuch)
// turant band ho jaata hai. Yahi is button ka "delete jaisa" asar hai.
async function ownerToggleAdmin(email, makeActive) {
  const db = ownerGetDb();
  await ownerRetryOnPermissionDenied(() =>
    db.collection("admins").doc(email).update({ active: makeActive })
  );
}

async function ownerResetAdminPassword(email) {
  if (!confirm(`${email} ko password-reset email bhejein?`)) return;
  const auth = ownerGetAuth();
  try {
    await auth.sendPasswordResetEmail(email);
    alert("✅ Password reset link bhej diya gaya (" + email + ").");
  } catch (err) {
    alert("Bhej nahi paaya: " + (err.message || err));
  }
}

async function ownerRemoveAdminRecord(email) {
  if (!confirm(
    `${email} ka admin record hatayein?\n\n` +
    `Isse is institute se uska access turant band ho jayega. (Uska ` +
    `Firebase Auth login account is se delete nahi hota — poori tarah ` +
    `account delete karne ke liye OWNER_PANEL_SETUP.md dekhein.)`
  )) return;
  const db = ownerGetDb();
  try {
    await db.collection("admins").doc(email).delete();
  } catch (err) {
    alert("Remove nahi hua: " + (err.message || err));
  }
}

// ── OPTIONAL: full permanent delete / direct password set ─────────
// In dono ko kaam karne ke liye pehle OWNER_CLOUD_FUNCTIONS_optional.js
// deploy karna padta hai (OWNER_PANEL_SETUP.md dekhein), AUR index.html
// mein ye script tag add karna padta hai:
//   <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js"></script>
// Tab tak ye dono sirf ek clear error dikhayenge, kuch todenge nahi.
async function ownerDeleteAdminAuth(email) {
  if (!confirm(`${email} ka Firebase login account HAMESHA KE LIYE delete karein? Ye undo nahi ho sakta.`)) return;
  try {
    if (!firebase.functions) throw new Error("Cloud Functions SDK load nahi hai — OWNER_PANEL_SETUP.md dekhein.");
    const fn = firebase.app().functions().httpsCallable("ownerDeleteAdminAuth");
    await fn({ email });
    await ownerRemoveAdminRecordSilently(email);
    alert("✅ Account permanently delete ho gaya.");
  } catch (err) {
    alert("Delete nahi hua: " + (err.message || err));
  }
}
async function ownerSetAdminPassword(email, newPassword) {
  try {
    if (!firebase.functions) throw new Error("Cloud Functions SDK load nahi hai — OWNER_PANEL_SETUP.md dekhein.");
    const fn = firebase.app().functions().httpsCallable("ownerSetAdminPassword");
    await fn({ email, newPassword });
    alert("✅ Password set ho gaya.");
  } catch (err) {
    alert("Password set nahi hua: " + (err.message || err));
  }
}
async function ownerRemoveAdminRecordSilently(email) {
  try { await ownerGetDb().collection("admins").doc(email).delete(); } catch (e) {}
}
window.ownerDeleteAdminAuth = ownerDeleteAdminAuth;
window.ownerSetAdminPassword = ownerSetAdminPassword;

// ── Auto-open on ?owner=1 ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("owner") === "1") {
    if (window.vishnuFirebase && window.vishnuFirebase.authReady) {
      window.vishnuFirebase.authReady.then(() => openOwnerOverlay());
    } else {
      openOwnerOverlay();
    }
  }
});

window.openOwnerOverlay = openOwnerOverlay;
window.closeOwnerOverlay = closeOwnerOverlay;
window.ownerLogin = ownerLogin;
window.ownerLogout = ownerLogout;
window.ownerAddInstituteSubmit = ownerAddInstituteSubmit;
window.ownerRecreateInstituteSubmit = ownerRecreateInstituteSubmit;
window.ownerAssignNewInstituteSubmit = ownerAssignNewInstituteSubmit;
window.ownerRenameInstitute = ownerRenameInstitute;
window.ownerToggleInstitute = ownerToggleInstitute;
window.ownerDeleteInstitute = ownerDeleteInstitute;
window.ownerAddAdminSubmit = ownerAddAdminSubmit;
window.ownerToggleAdmin = ownerToggleAdmin;
window.ownerResetAdminPassword = ownerResetAdminPassword;
window.ownerRemoveAdminRecord = ownerRemoveAdminRecord;
