# Owner ke liye Alag Installable App — v23 Notes

Request (paraphrased):
> Owner ko admin panel se login na karna pade, uske liye website se hi
> Owner ka app seedha install ho sake — jaise abhi "App Install Karein"
> button hai, waise hi ek doosra install button ho jo Owner ka ho. Do
> install options dikhein: 1) Admin+Student wala (jaisa hai), 2) Owner
> wala (naya).

Pehle Owner Panel tak pahunchne ka raasta tha: Admin Panel mein login
karo → Settings tab → "🏢 Owner Panel Kholein" button. Matlab Owner ko
bhi Admin password se pehle login karna padta tha, sirf tab jaake Owner
Panel button dikhta tha. (`?owner=1` URL seedha bhi kaam karta tha, par
wo hidden/undiscoverable tha — koi button website par nahi tha.)

## Kya badla

Ek naya, bilkul ALAG installable PWA banaya — Admin/Student wale app se
poori tarah independent, apna manifest/icon/name ke saath — taaki home
screen par Owner ke liye ek doosra, seedha app-icon ban sake jo turant
Owner login khole.

**Technical wajah ek naya HTML page banane ki:** ek hi document (jaise
`index.html`) mein do `<link rel="manifest">` ek saath kaam nahi karte —
browser sirf ek hi manifest ko us page ka "installable app" maanta hai.
Isliye Owner ke liye ek chhota, alag "install landing" page zaroori tha.

### Naye files

- **`manifest-owner.webmanifest`** — alag manifest: `name: "EXAMNOVA
  Owner Panel"`, `start_url: "/?owner=1"` (matlab install ke baad icon
  tap karte hi seedha Owner login/overlay khulta hai — `index.html`
  ka wahi existing `?owner=1` auto-open logic use hota hai, usme kuch
  nahi badla), apna `id` (admin/student wale manifest se alag, taaki
  Chrome/Edge inhe do alag apps maane).
- **`owner-app.html`** — chhota "install landing" page. Sirf ye page
  `manifest-owner.webmanifest` link karta hai. Isme:
  - Native install button (`beforeinstallprompt` capture — bilkul
    `index.html` wale install-flow jaisa logic, isi page ke liye alag
    se likha gaya).
  - iOS/Firefox/Safari jaise browsers ke liye manual "Add to Home
    Screen" instructions (jaise pehle se admin/student wale flow mein
    hai).
  - iOS ke liye special handling: iOS manifest ka `start_url` ignore
    karta hai, installed icon hamesha isi page ko relaunch karta hai —
    isliye is page mein check hai ki agar standalone mode mein khula
    hai (`navigator.standalone` / `display-mode: standalone`), to
    turant `/?owner=1` par redirect ho jaata hai. Android/Chrome ke
    liye ye zaroorat nahi (start_url seedha `/?owner=1` hai).
  - "Bina install kiye, seedha Owner Panel kholein →" link (`/?owner=1`)
    — fallback, jo pehle se tha wahi.
  - Same `sw.js` register karta hai (scope `/`) taaki installability
    criteria pehli visit par bhi poore ho.
- **`icon-192-owner.png`, `icon-512-owner.png`, `icon-192-maskable-owner.png`,
  `icon-512-maskable-owner.png`** — original app icon par ek gold
  "OWNER" ribbon overlay kiya gaya (Python/Pillow se), taaki dono
  installed icons home screen par saaf-saaf alag dikhein.

### Modified files

- **`index.html`** — header nav mein ek naya button add kiya, existing
  "⬇️ App Install Karein" ke bilkul baraabar: **"🏢 Owner App Install
  Karein"** (gold color, admin/student wale se visually alag). Isme
  koi native-install JS nahi hai — bas `owner-app.html` par navigate
  karta hai (kyunki native install sirf usi page se ho sakta hai jo
  owner wala manifest link karta hai). Ye button hamesha visible hai
  (kisi login ki zaroorat nahi) — isi se "Admin Panel se login na karna
  pade" wali maang poori hoti hai. Admin Settings tab wala purana
  "Owner Panel Kholein" button waisa hi chhod diya hai (extra convenience,
  kisi ko disturb nahi karta).
- **`styles.css`** — `.main-tabs` ko `flex-wrap: wrap` diya, aur mobile
  breakpoint (≤480px) par tabs ko `flex: 1 1 45%` kiya (pehle `flex: 1`
  tha) — taaki 4 nav-buttons (Student/Admin/Install/Owner-Install) chhote
  phone screens par 2-2 karke neat do rows mein wrap ho jaayein, ek row
  mein squished/unreadable na hon.
- **`sw.js`** — cache version bump (`v85`), aur naye files
  (`owner-app.html`, `manifest-owner.webmanifest`, 4 owner icons)
  precache list mein add kiye — offline/first-load par bhi kaam karega.
- **`firebase.json`** / **`_headers`** — `owner-app.html` aur
  `manifest-owner.webmanifest` ke liye wahi `no-cache` headers add kiye
  jo `index.html`/`manifest.webmanifest` ko already milte hain (taaki
  deploy ke baad turant fresh version mile, purana cached na dikhe).

## Kya NAHI badla

- Owner Panel ka andar ka login/CRUD logic (`owner-panel.js`,
  `firestore.rules` ka `isOwner()`) — bilkul waisa hi hai, koi security
  ya access-control change nahi hua. Install button sirf ek "shortcut"
  hai; asli access ab bhi Owner ke Firebase email+password se hi milta
  hai.
- Admin/Student wala install flow (`manifest.webmanifest`,
  `index.html` ka beforeinstallprompt handling) — bilkul untouched.

## Test kiya

- `node --check` — `sw.js` aur `owner-app.html` ke inline script par,
  dono clean.
- `manifest-owner.webmanifest` aur `firebase.json` — JSON valid.
- Sabhi existing `test_*.js` (OMR scanning) suites re-run kiye — sab
  pass (is feature ka OMR se koi lena-dena nahi, sirf sanity check ke
  liye).

## Deploy ke baad check karna

1. `owner-app.html` ko kisi Chrome/Edge (Android ya desktop) par
   kholein → "⬇️ Owner App Install Karein" button dikhna chahiye →
   install karke home-screen/app-list icon check karein (naam:
   "EXAMNOVA Owner", gold ribbon wala icon) → icon tap karke seedha
   Owner login khulna chahiye.
2. Wahi flow iPhone Safari par bhi try karein (Share → Add to Home
   Screen) — icon tap karne par seedha Owner login khulna chahiye
   (redirect ke through).
3. Home screen ke header mein dono buttons (green "App Install Karein"
   aur gold "Owner App Install Karein") ek saath dikhein, chhote phone
   par bhi neat dikhein (wrap ho kar).
