# Owner App ko Poori Tarah Alag Banaya — v24 Notes

Request (paraphrased):
> Admin install aur Owner install dono ek jaise dikh rahe hain. Owner
> wale mein se Student/Admin ka sab hata do — sirf Owner Panel hona
> chahiye. Aur Owner ka login bhi Admin jaisa persist hona chahiye
> (ek baar login, phir login hi rahe).

## Asli wajah (v23 mein kya chhoot gaya tha)

v23 mein Owner ke liye alag installable icon to ban gaya tha, lekin
uske andar ka "app" alag nahi tha. `owner-app.html` sirf ek install
karne wala landing page tha — install ya "skip" karte hi seedha
`index.html?owner=1` khul jaata tha. Matlab Owner install bhi asal
mein wahi **poora** Admin/Student app (`index.html` + `script.js` +
`exam-manager.js` + `omr.js` + saare question-bank files) load karta
tha — bas ek overlay usके upar dikhta tha jo baaki sab visually chhupa
deta tha. Isi wajah se dono installs "ek hi tarah" mehsoos hote the:
ek hi document, ek hi JS bundle, sirf ek overlay ka fark.

Login-persistence khud already sahi kaam kar rahi thi (Owner ke liye
bhi Admin jaisa hi `localStorage` flag + Firebase Auth session wala
system pehle se tha, `owner-panel.js` mein) — asli masla content ka
tha, behaviour ka nahi.

## Kya badla

**`owner-app.html`** ko poori tarah rewrite kiya — ab ye khud hi ek
chhota, self-contained Owner app hai:

- Apna Firebase init (`firebase-app/auth/firestore-compat` +
  `firebase-config.js` — Storage jaan-boojh kar nahi liya, Owner Panel
  ko uski zaroorat nahi).
- Apna `owner-panel.js` (bina kisi badlaav ke — bilkul wahi login +
  institutes/admins CRUD logic).
- Apna chhota login/panel markup (`index.html` ke overlay se hi liya
  gaya, sirf dark backdrop hataya kyunki ab iske "peeche" chhupane ke
  liye kuch hai hi nahi — ye khud hi poora page hai).
- Sirf `styles.css` (shared `.card`/`.field-row`/`.btn-primary` jaisi
  design-system classes ke liye) — `theme-picker.css`,
  `creative-dashboard.css`, `exam-manager.css` jaan-boojh kar NAHI li
  gayi.
- **`script.js`, `exam-manager.js`, `omr.js`, saare question-bank
  files — in mein se KUCH bhi load nahi hota.** Yahi wo cheez hai jo
  "Student ka, Admin ka sab hata do" wali maang poori karti hai:
  ab Owner install mein Admin/Student ka code literally maujood hi
  nahi hai, sirf overlay se chhupaya nahi gaya hai.
- Install-to-home-screen button/instructions wahi purani logic hai,
  bas ab isi page ke upar ek chhota banner ki tarah dikhta hai (login
  form ke upar) — install na karke bhi seedha browser mein hi Owner
  Panel use kiya ja sakta hai, kisi redirect ki zaroorat nahi (pehle
  "skip" link `index.html?owner=1` par bhejta tha, ab zaroorat hi
  nahi kyunki login form yahin is page par hai).

**`manifest-owner.webmanifest`** — `start_url` aur `id` ab
`/?owner=1` ki jagah seedha `/owner-app.html` par point karte hain.
Matlab installed icon tap karne par (Android/Chrome) seedha isi
self-contained page par jaata hai.

**iOS ke liye simplification:** Pehle iOS ke liye ek special redirect
tha (`owner-app.html` khud check karta tha ki standalone mode mein
khula hai to `/?owner=1` par jump karo) — kyunki iOS "Add to Home
Screen" manifest ka `start_url` ignore karta hai aur hamesha usi page
ko relaunch karta hai jisse install kiya gaya tha. Ab chunki
`owner-app.html` khud hi final destination hai, ye redirect-trick ki
zaroorat hi khatam ho gayi — poori tarah hata diya.

**`sw.js`** — cache version bump (`v86`), aur `owner-panel.js` ko
precache list mein add kiya (v23 mein ye chhoot gaya tha — kaam to
karta tha kyunki online fetch ho jaata tha, lekin pehli-baar offline
load par miss ho sakta tha).

## Kya NAHI badla

- `owner-panel.js` ka andar ka logic — bilkul waisa hi, ek line bhi
  nahi chhedi. Login-persistence (`localStorage` flag +
  `auth.currentUser` check) pehle se hi Admin Panel jaisi tarah kaam
  karti thi, sirf ab isko trigger karne wala page (`owner-app.html`)
  self-contained hai.
- `firestore.rules` ka `isOwner()` — koi security change nahi.
- Admin Panel ke Settings tab wala **"🏢 Owner Panel Kholein"**
  convenience button — waisa hi chhod diya hai. Ye `index.html` ke
  andar wale overlay (`owner-overlay-bg`, `owner-login-box`,
  `owner-panel-box` — same IDs, `index.html` mein bhi maujood hain)
  ko seedha `openOwnerOverlay()` se kholta hai, kisi URL param ki
  zaroorat nahi. Agar isse bhi hata kar Owner access ko *sirf* alag
  install tak seemित karna ho (matlab Admin session se bhi Owner
  Panel na khul sake), bata dijiyega — abhi jaan-boojh kar chhoda hai
  kyunki ye Admin/Student install ke "look" ko affect nahi karta
  (jo asli complaint thi), aur ek hi banda dono role sambhal raha ho
  to kaam ka shortcut hai.
- Student/Admin install (`index.html`, `manifest.webmanifest`) —
  bilkul untouched.

## ⚠️ Deploy ke baad ek zaroori kaam

Manifest ka `id` aur `start_url` badal gaya hai (`/?owner=1` →
`/owner-app.html`). Jinhone pehle se (v23 wala) "EXAMNOVA Owner" icon
install kar rakha hai, unka **purana icon home screen se delete karke,
`owner-app.html` khol kar dobara install karna hoga** — warna purana
icon ab bhi purani (v23) manifest identity se juda reh sakta hai aur
naya standalone behaviour nahi milega. Naye installs ke liye ye step
zaroori nahi, seedha sahi kaam karega.

## Test kiya

- `owner-app.html` ke inline script par `node --check` — clean.
- `sw.js` par `node --check` — clean.
- `manifest-owner.webmanifest` — JSON valid.
- Sabhi existing `test_*.js` (OMR scanning) suites re-run kiye — sab
  pass (is feature ka OMR se koi lena-dena nahi, sirf sanity check).

## Deploy ke baad check karna

1. Naye tab mein `owner-app.html` seedha kholein (Chrome/Edge) →
   Owner login form seedha dikhna chahiye (koi Admin/Student UI
   nahi), upar gold install banner bhi dikhna chahiye → install
   karke check karein icon "EXAMNOVA Owner" naam se aata hai.
2. Icon tap karke app kholein → seedha Owner login (ya agar pehle se
   login ho, seedha Owner Panel) khulna chahiye — kuch bhi flash ya
   overlay nahi, sirf yahi content top-level par.
3. Ek baar login karke app band karein, dobara icon se kholein →
   login form nahi, seedha Owner Panel dikhna chahiye (persistent
   login check).
4. `owner-panel.js` ke saare kaam (institute add, admin add/disable/
   remove/password-reset) is naye page se bhi pehle jaisa hi kaam
   karne chahiye — logic bilkul same hai.
5. Admin/Student wala install (`index.html`) alag se test karein —
   uska koi bhi behaviour badla nahi hona chahiye.
