// ═══════════════════════════════════════════════════════════════
// functions/index.js — the SERVER side of Push Notifications.
// ═══════════════════════════════════════════════════════════════
// Browsers can only register to RECEIVE a push, never send one to
// another device directly — that has to come from a server. This
// Cloud Function is that server: it watches Firestore, and whenever
// a test goes from draft -> published, it reads every device token
// saved in "pushTokens" (by push-notifications.js) and asks Firebase
// Cloud Messaging to deliver a notification to all of them.
//
// See PUSH_NOTIFICATIONS_SETUP.md in the project root for how to
// deploy this (needs the Blaze pay-as-you-go plan — Cloud Functions
// don't run on the free Spark plan).
// ═══════════════════════════════════════════════════════════════

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ── Trigger: a test just got published ───────────────────────────
// "Published" = isDraft was true (or missing) before, and is
// explicitly false after. Matches how Question Generator's Save/
// Admin flow and the main Admin "Create/Edit Test" form both mark a
// test live (see qgen-app.js savePaperAsDraft/saveAndReturnToAdmin,
// and script.js's own test-save flow).
exports.onTestPublished = onDocumentWritten("tests/{testId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after) return; // deleted, nothing to notify

  const wasDraft = !before || before.isDraft !== false;
  const isNowLive = after.isDraft === false;
  if (!(wasDraft && isNowLive)) return; // not a fresh publish — ignore edits to already-live tests

  const tokensSnap = await db.collection("pushTokens").get();
  const tokens = tokensSnap.docs.map((d) => d.id).filter(Boolean);
  if (!tokens.length) {
    console.log("[push] No registered devices — skipping send.");
    return;
  }

  const title = "📝 Naya Test Publish Hua!";
  const body = `${after.title || "Ek naya test"} ab available hai — abhi attempt karein!`;

  // sendEachForMulticast batches up to 500 tokens per call and reports
  // per-token success/failure, so one dead token can't fail the whole
  // batch — we use that to prune stale tokens (uninstalled app, revoked
  // permission, etc.) straight after sending.
  const BATCH = 500;
  const staleTokens = [];
  for (let i = 0; i < tokens.length; i += BATCH) {
    const chunk = tokens.slice(i, i + BATCH);
    const res = await getMessaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      webpush: {
        notification: { icon: "/icon-192.png" },
        fcmOptions: { link: "/" }
      },
      data: { url: "/" }
    });
    res.responses.forEach((r, idx) => {
      if (!r.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(r.error?.code)) {
        staleTokens.push(chunk[idx]);
      }
    });
  }

  if (staleTokens.length) {
    const batch = db.batch();
    staleTokens.forEach((t) => batch.delete(db.collection("pushTokens").doc(t)));
    await batch.commit();
    console.log(`[push] Cleaned up ${staleTokens.length} stale tokens.`);
  }

  console.log(`[push] Sent "${title}" to ${tokens.length - staleTokens.length} devices.`);
});
