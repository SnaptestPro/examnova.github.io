/* ══════════════════════════════════════════════════════════════════
   OPTIONAL — OWNER: FULL ACCOUNT CONTROL (Cloud Functions)
   ══════════════════════════════════════════════════════════════════
   Ye file Owner Panel ke liye do EXTRA (optional) powers deti hai
   jo browser se surakshit tareeke se nahi ho sakte:

     1) ownerDeleteAdminAuth  — kisi admin ka Firebase login account
        HAMESHA KE LIYE delete karna (sirf Firestore record nahi).
     2) ownerSetAdminPassword — kisi admin ka password Owner ki
        taraf se seedha set karna (email link ke bina).

   In dono ke liye Firebase Admin SDK chahiye, jo sirf ek trusted
   server (Cloud Function) par chalta hai — isiliye ye alag file hai,
   jo aapko khud deploy karna hoga. Bina is step ke bhi Owner Panel ka
   "Disable" + "Password Reset Email" poora kaam karta hai — ye sirf
   un logon ke liye hai jinhe wahi bhi chahiye.

   SETUP: OWNER_PANEL_SETUP.md ka "Optional: Full-control Cloud
   Function" section step-by-step padhein.
   ══════════════════════════════════════════════════════════════════ */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Yahan bhi wahi Owner email daalein jo firestore.rules ke isOwner()
// mein daala tha — dono jagah SAME email hona zaroori hai.
const OWNER_EMAIL = "vishnu1234stm@gmail.com";

function assertOwner(context) {
  if (!context.auth || context.auth.token.email !== OWNER_EMAIL) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Sirf Owner hi ye action kar sakta hai."
    );
  }
}

// ── 1) Kisi admin ka Firebase login account permanently delete ─────
exports.ownerDeleteAdminAuth = functions.https.onCall(async (data, context) => {
  assertOwner(context);
  const email = (data && data.email || "").trim();
  if (!email) throw new functions.https.HttpsError("invalid-argument", "email zaroori hai.");

  const userRecord = await admin.auth().getUserByEmail(email);
  await admin.auth().deleteUser(userRecord.uid);

  // Firestore admin-record bhi saath hi clean up kar do.
  await admin.firestore().collection("admins").doc(email).delete().catch(() => {});

  return { success: true };
});

// ── 2) Kisi admin ka password Owner ki taraf se seedha set karna ───
exports.ownerSetAdminPassword = functions.https.onCall(async (data, context) => {
  assertOwner(context);
  const email = (data && data.email || "").trim();
  const newPassword = data && data.newPassword;
  if (!email || !newPassword || newPassword.length < 8) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "email aur kam se kam 8-character ka newPassword zaroori hai."
    );
  }

  const userRecord = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(userRecord.uid, { password: newPassword });

  return { success: true };
});
