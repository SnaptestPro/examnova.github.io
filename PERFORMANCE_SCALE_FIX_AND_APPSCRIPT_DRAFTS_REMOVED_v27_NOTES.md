# Performance/Scale Fixes + App Script Drafts Removed (v27)

Aapne kaha tha: "lakhon student aa jaaye lekin hang na ho" + "App Script
wala function hata do (abhi use nahi karta) + jo kaam ki nahi hai wo bhi
hata do". Poore codebase (script.js, student-features.js, exam-manager.js,
owner-panel.js, firestore.rules, firebase.json) ka audit kiya — neeche
sab kuch hai jo mila aur jo fix kiya.

## ⚠️ Sabse zaroori: 2 REAL "hang" bugs mile aur fix kiye

Ye dono functions "lakhon students" ke sath guaranteed hang/crash karte —
har student/admin ka browser **poori collection** download kar raha tha.

### 1) Leaderboard/Top Performers — sabse bada bug
`computeFullLeaderboard()` (student-features.js) **poori `studentRecords`
collection** (site ke shuru se ab tak ke SAARE test-submissions, HAR
institute ke) download karta tha. Aur ye function chalता tha:
- Har student ke **har** dashboard card open par (Top-3 podium)
- Har naye test-submit ke baad
- Admin ke "Top Performers" tab open karne par
- Har baar jab koi test edit/publish ho (`syncTests()` se piggyback)

Lakhon students + unke submissions ke sath, ye AKELA function poori site
ko hang kar sakta tha (bahut bada download + bahut zyada Firestore
read-cost, baar-baar).

**Fix:**
- Query ab sirf sabse RECENT **3000** submissions maangti hai
  (`orderBy("savedAt","desc").limit(3000)`), poori collection nahi.
- Ek **90-second TTL cache** add kiya — isi window mein aane wali
  baar-baar calls (dashboard cards, test-sync events) Firestore ko
  dobara nahi maartin. Ek saath aayi kai calls bhi ek hi network-fetch
  share karti hain (in-flight dedupe).
- Naya submit karte hi cache turant clear ho jaata hai, taaki student ko
  apna naya score turant dikhe (90-sec wait nahi).
- **Trade-off (jaan-boojh kar):** leaderboard ab "sabse recent ~3000
  submissions" par based hai, literal saare-history par nahi — bilkul
  wahi trade-off jo `records[]` array (200-cap) pehle se isi file mein
  karta hai. Agar chahiye to `LEADERBOARD_RECORD_CAP` (student-features.js
  mein) badha sakte ho — bas dhyan rahe, jitna bada utna hi dheema.

### 2) Students Directory — doosra bada bug
`loadStudentsDirectory()` aur `ensureAllStudentsCache()` (script.js)
**poori `students` collection** (SAARE institutes ke SAARE students)
download karte the, phir sirf DISPLAY karne ke liye client-side apne
institute se filter karte the. Isi tarah record-count nikaalne ke liye
**poori `studentRecords` collection** bhi download hoti thi.

**Fix:**
- Ab seedha Firestore se sirf (a) apne institute ke students, aur
  (b) jin students ka institute abhi set hi nahi hai (naye students
  mein ye field hamesha set hota hai — real ID ya null — isliye ye
  list badhti nahi, fixed rehti hai) — 2 chhoti scoped queries se
  milte hain. Kisi doosre institute ka poora data ab download hi nahi
  hota.
- Record-count ke liye ab sirf UPAR wali list ke mobile numbers ke
  liye, 10-10 ke chunks mein targeted queries chalti hain — poori
  studentRecords collection nahi.
- Side-benefit: OMR "Link to Student" naam-search (exam-manager.js)
  bhi ab automatically sirf apne institute ke students mein search
  karta hai — pehle galti se doosre institute ka student bhi match ho
  sakta tha.
- **Bahut PURANE students** (jinka `instituteId` field hi kabhi likha
  nahi gaya — institute-feature se pehle wale) is scoped fetch mein
  nahi aayenge. Unke liye Students Directory mein naya button hai:
  **"🗄️ Purane students bhi (poora scan)"** — sirf explicitly dabane
  par ek-baar poora scan karta hai, taaki koi purana data hamesha ke
  liye gayab na ho.

## 🗑️ App Script Drafts — poora feature hata diya

Jaisा aapne bola, "App Script Drafts" (admin panel ka wo tab jahan
Apps Script se aayi draft questions approve/reject/edit hoti thi)
poori tarah hata diya:
- script.js se saare related functions/variables hataye
  (`renderAppScriptDrafts`, `syncAppScriptDrafts`, `approveAppScriptDraftToBank`,
  `editAppScriptDraft`, `rejectAppScriptDraft`, `deleteAppScriptDraft`,
  `updateAppScriptDraftStatus`, `loadAppScriptDraftsOnce`,
  `sortAppScriptDrafts`, `getDraftTime`, `makeBankIdFromDraftId`, aur
  `appScriptDraftQuestions`/`approvingAppScriptDraftId` state).
- **Bonus mila:** iska HTML tab/container to pehle se hi gayab tha
  (kisi purani cleanup mein hat gaya hoga) — matlab ye feature already
  poori tarah "dead" tha, sirf ek **live Firestore listener har admin
  session mein bina wajah chalu** rehta tha (`draftQuestions` collection
  par). Ab wo bhi band ho gaya — har admin session mein ek listener kam.
- `saveBankQuestion`/`editBank`/`clearBankForm` (Question Bank ka Edit
  form) ko simplify kar diya — ab sirf normal "Edit Question" flow ke
  liye hai, draft-approve wala extra branch hata diya.
- 2 Apps Script files jo SIRF isi feature ko feed karte the, ab bekaar
  ho gaye the — **hata diye**: `AppsScript_DraftSeeder.gs`,
  `MCQ_Approval_AppScript.gs`.
- **Chhode gaye (touch nahi kiya):** `AppsScript_NewQuestions.gs` aur
  `AppsScript_QuestionSeeder.gs` — ye seedha `questionBank` collection
  mein likhte hain (koi live web-app UI se connected nahi, standalone
  one-time seed scripts hain) — agar inki bhi zaroorat nahi to bata
  dijiye, agli baar hata dunga. `OMR_AI_Scanner_AppScript.gs` ko haath
  nahi lagaya — wo bilkul alag cheez hai (Claude Vision API key ko
  browser se chhupane wala backend proxy, abhi bhi zaroori hai).

## 🔧 Bonus fix: Firestore Rules deploy wala recurring gap

`firebase.json` mein `firestore` key hi missing thi — isliye `firebase
deploy` sirf website (hosting) deploy karta tha, **Rules kabhi deploy
nahi hoti thi** (isiliye baar-baar "rules publish karna bhool gaye"
wala issue aata tha). Ab `firebase.json` mein ye add kar diya:
```json
"firestore": { "rules": "firestore.rules" }
```
Ab se plain `firebase deploy` (Google Cloud Shell se) **hosting + rules
dono ek saath** deploy karega — alag se `--only firestore:rules` yaad
rakhne ki zaroorat nahi.

## Jo test_*.js files hain (13 files, OMR algorithm ke)

Inhe jaan-boojh kar chhoda hai — ye index.html se load hi nahi hoti
(production/live app ka hissa nahi hain, sirf dev-time testing ke liye
hain), isliye speed par koi asar nahi. Lekin OMR scanning par jitna kaam
kiya hai (bubble detection, exposure, corner markers), unke liye ye
regression-test safety net hain — hata dena risky hoga agar aage OMR
mein kuch badalna pade. Agar phir bhi hataane hain to bata dijiye.

## Files changed
`script.js`, `student-features.js`, `index.html`, `firebase.json`.
Removed: `AppsScript_DraftSeeder.gs`, `MCQ_Approval_AppScript.gs`.

## ⚠️ Deploy karne se pehle
1. Google Cloud Shell se: `firebase deploy` (ab rules + hosting dono
   automatically ek saath ho jayenge).
2. Deploy ke baad, ek baar **Students Directory** aur **Top Performers**
   khol kar dekh lena ki data sahi dikh raha hai (especially agar koi
   student बहुत purana hai aur usme instituteId field kabhi set nahi
   hui) — agar koi purana student "gayab" lage to "🗄️ Purane students
   bhi (poora scan)" button try karna.
3. `LEADERBOARD_RECORD_CAP` (3000) aur `LEADERBOARD_CACHE_TTL_MS`
   (90 sec) dono tunable constants hain (student-features.js, top of
   the leaderboard section) — scale/zaroorat ke hisaab se badal sakte ho.
