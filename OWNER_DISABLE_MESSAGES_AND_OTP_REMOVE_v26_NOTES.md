# v26 — 3 fixes (Owner Panel)

## 1) Sahi message: "admin disabled" vs "institute deactivated/removed"
Pehle dono cases mein Firestore se sirf ek generic "permission-denied" milta
tha, isliye login par HAMESHA "aapka ID deactivate kar diya gaya hai" hi
dikhta tha — chahe Owner ne khud admin ko disable kiya ho, ya poore institute
ko deactivate/remove kiya ho.

**Fix:**
- `firestore.rules`: naya `isKnownAdminEmail()` helper — admin ab apna khud ka
  `admins/{email}` doc HAMESHA padh sakta hai (chahe khud disabled ho ya uska
  institute deactivate ho), taaki client ko asli wajah pata chal sake. Write
  access (`isAdmin()`) bilkul waisa hi sakht raha.
- `script.js`: `isAdminAccountDeactivated()` ki jagah `checkAdminLoginBlock()`
  — 4 alag messages: admin disabled / institute deactivated / institute
  removed / email admin hi nahi hai. Login-time AUR real-time (already logged
  in ho tab bhi turant force-logout) dono jagah lagu.

## 2) Disable/Enable ek hi button — robustness fix
Button pehle se hi ek tha (label state ke hisaab se badalta), lekin
intermittent stale-token issue (jaisa v24_16 notes mein documented hai) ke
karan kabhi kaam nahi karta tha. Ab `ownerToggleAdmin()`:
- Write se PEHLE hi ID token proactively refresh karta hai (na ki sirf
  failure ke baad retry).
- Button ko busy state deta hai (double-tap se race nahi).
- Write ke baad ek chhota verify-read karta hai — agar status update nahi
  hua to turant alert karta hai.

## 3) Institute "Remove" — ab OTP/confirm-link se gated
Ek click + ek `confirm()` popup se institute delete NAHI hota ab. Naya flow:
1. Owner "Remove" dabata hai → ek pending-removal doc (`ownerPendingRemovals/
   {token}`, 15 min expiry) banta hai.
2. Owner ke apne email par ek confirm-link jaata hai — Firebase Auth ka
   built-in, free "Email link (passwordless sign-in)" mechanism istemal
   karke (koi paid Cloud Function/backend nahi chahiye).
3. Sirf wahi link wapas click karne par (isi app mein `?ownerConfirmRemove=
   token` khulte hi) asli `institutes/{id}` delete hota hai.

**⚠️ ZAROORI ONE-TIME SETUP:** Firebase Console → Authentication → Sign-in
method → "Email link (passwordless sign-in)" provider ON karein. Agar ye OFF
hai, "Remove" click karne par saaf error dikhega ("operation-not-allowed").

## Files changed
`firestore.rules`, `script.js`, `owner-panel.js`, `sw.js` (cache-name bump).

## Deploy
Google Cloud Shell se: `firebase deploy` (rules + hosting dono ek saath ho
jayenge agar `firebase.json` dono include karta hai — nahi to
`firebase deploy --only firestore:rules,hosting`).
