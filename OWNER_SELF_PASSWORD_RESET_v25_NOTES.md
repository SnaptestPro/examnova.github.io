# Owner khud apna password reset kar sake (v25)

## Pehle kya tha
Owner Panel (`owner-app.html`) sirf ADMIN ka password reset kar sakta
tha (🔑 "Password Reset Email" button, admins list mein) —
`ownerResetAdminPassword()`. Lekin agar Owner khud apna password bhool
jaaye, to login form mein koi "Password bhool gaye?" jaisa link hi
nahi tha — reset karne ka koi self-service tareeka nahi tha.

## Fix
Bilkul Admin Login (`index.html` → `forgot-password-link` →
`script.js` → `forgotPassword()`) jaisa hi ek "🔑 Password bhool gaye?"
link Owner Login form ke Login button ke neeche add kiya:

- **`owner-app.html`** — naya button `#owner-forgot-password-link`,
  `onclick="ownerForgotPassword()"`.
- **`owner-panel.js`** — naya function `ownerForgotPassword()`:
  - `owner-email` input mein jo email likha ho wahi le leta hai (khaali
    ho to prompt karta hai).
  - Owner ke apne **isolated** `ownerGetAuth()` instance
    (`owner-panel-session` secondary Firebase app — wahi jo
    `ownerLogin()`/`ownerResetAdminPassword()` bhi use karte hain, taaki
    Admin session se koi collision na ho) se
    `sendPasswordResetEmail(email)` call karta hai.
  - Success/fail dono par clear alert deta hai.

Real Firebase email-link based reset hai (Owner ke apne inbox mein
link aata hai) — koi password client-side type/set nahi hota, bilkul
Admin/Student wale reset flow jaisa hi surakshit tareeka.

## Zaroori step
Sirf JS + HTML change hai, `firestore.rules` nahi badli — koi Firebase
Console publish step nahi chahiye. `sw.js` cache version v96 → v97 bump
kar diya hai, isliye already-installed Owner PWA par bhi ye link agli
baar app khulte hi mil jayega.

## Test karne ka tarika
1. Naya zip deploy karein.
2. Owner App kholein, login screen par "🔑 Password bhool gaye?" link
   dikhna chahiye Login button ke neeche.
3. Owner email box mein apna Owner email likhein (ya khaali chhod kar
   link par click karein — prompt khulega) aur link par tap karein.
4. Apne inbox (aur spam folder) mein Firebase ka reset-password email
   check karein, naya password set karein, phir usi se login try karein.
