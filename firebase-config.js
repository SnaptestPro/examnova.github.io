// ⚠️ SECURITY NOTE: This API key is client-side visible by design — that is
// normal and safe for Firebase. Real protection comes from Firestore
// Security Rules (see firestore.rules) + Firebase Authentication below,
// NOT from hiding this key.
const firebaseConfig = {
  apiKey: "AIzaSyBTrkAoQ2T9KNB2vcacv4EPehaDboXmUxk",
  authDomain: "the-vishnu-sharma-test.firebaseapp.com",
  projectId: "the-vishnu-sharma-test",
  storageBucket: "the-vishnu-sharma-test.firebasestorage.app",
  messagingSenderId: "57228202591",
  appId: "1:57228202591:web:6011f163e5ed22c1ba8dea",
  measurementId: "G-FYQB0PX72R"
};

window.vishnuFirebase = { db: null, storage: null, auth: null, enabled: false, authReady: null };

try {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  if (typeof firebase !== 'undefined') {
    window.vishnuFirebase.db = firebase.firestore();
    try { window.vishnuFirebase.storage = firebase.storage(); } catch (e) { console.warn("Firebase Storage unavailable", e); }

    // ── Offline persistence (IndexedDB local cache) ──────────────
    // Bina iske, har refresh par Firestore ka pehla onSnapshot result
    // aane tak wait karna padta hai (network round-trip) — isliye
    // questionBank/tests/records "load" hote hue dikhte the.
    // Persistence on hone se pichhli baar ka data turant (instant,
    // local IndexedDB se) mil jaata hai, aur uske baad fresh data
    // background mein network se aake usi onSnapshot listener ke
    // through silently update ho jaata hai — koi extra code nahi
    // likhna padta, jitni bhi jagah onSnapshot use ho raha hai wahan
    // apne aap fayda milega. synchronizeTabs:true isliye taaki ek se
    // zyada tab khule hone par bhi persistence error na aaye.
    try {
      window.vishnuFirebase.db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        // failed-precondition: bahut purane browser ne synchronizeTabs
        // support nahi kiya (rare) — unimplemented: browser hi support
        // nahi karta (rare/old browsers). Dono cases mein app normal
        // (bina local cache ke) chalta rahega, bas thoda slower.
        console.warn("Firestore offline persistence enable nahi ho payi:", err && err.code);
      });
    } catch (e) {
      console.warn("Firestore offline persistence setup error", e);
    }

    // ── Firebase Authentication ──────────────────────────────────
    // Har visitor (student ho ya abhi tak login na kiya ho) ko
    // silently "anonymous" sign-in mil jaata hai. Isse Firestore
    // Security Rules ke liye request.auth kabhi null nahi rehta,
    // aur random bots/scripts (jo kabhi app load hi nahi karte)
    // Firestore ko seedha access nahi kar sakte.
    //
    // Admin real email/password se sign-in karta hai (script.js mein
    // loginAdmin() dekhein) — wahi asli "proper admin login" hai jo
    // firestore.rules ke ADMIN_EMAILS allow-list se match hota hai.
    try {
      window.vishnuFirebase.auth = firebase.auth();
      window.vishnuFirebase.authReady = new Promise((resolve) => {
        const unsub = window.vishnuFirebase.auth.onAuthStateChanged((user) => {
          if (user) { unsub(); resolve(user); return; }
          // Koi bhi signed-in nahi hai abhi -> anonymous sign-in try karo
          window.vishnuFirebase.auth.signInAnonymously().catch((err) => {
            console.warn("Anonymous sign-in failed (enable it in Firebase Console > Authentication)", err);
            unsub();
            resolve(null);
          });
        });
      });
    } catch (e) {
      console.warn("Firebase Auth unavailable", e);
    }

    window.vishnuFirebase.enabled = true;
  }
} catch (error) {
  console.warn("Firebase unavailable", error);
}
