# Deep Scale Audit — 1 Lakh+ Students (v28)

Aapne kaha "kam se kam 1 lakh students ke liye detailed analysis karke
sabko fix karo". v27 (pichhla) fix ke baad, ab poore codebase ka ek
gehra pass kiya — har `.collection()`, har `.batch()`, har jagah jahan
data STUDENT-COUNT ke saath badhta hai. Neeche sab kuch hai jo mila.

## 🚨 Sabse gambhir naya bug: `clearRecords()` (data-loss risk)

"🗑️ Clear All Records" button 2 tarah se toota hua tha:
1. **Multi-tenant isolation nahi thi** — ye button galti se **kisi bhi
   doosre institute ka bhi poora result-data delete** kar sakta tha,
   na ki sirf apna.
2. Firestore ek batch mein max **500 operations** allow karta hai —
   isse zyada records hone par (jo 1 lakh+ students ke sath turant
   hoga) ye seedha crash/fail ho jaata.

**Fix:** ab sirf apne institute ke tests se match karte records
dhoonde jaate hain (poori collection download kiye bina), aur delete
500-500 ke safe batches mein hota hai.

## 🚨 Chupa hua bug: `window.tests` hamesha `undefined` tha

Records/Result Sheets tab mein "sirf apna institute dikhao" wala check
`window.tests || {}` use karta tha — lekin classic (non-module) script
mein `let` se declare kiya variable kabhi `window.X` nahi banta (sirf
`var`/function declarations bante hain). Matlab ye check **hamesha
fail** hota tha, aur har test "not mine" maan liya jaata tha.

**Fix:** top-level `let tests` ko `var tests` kiya — ab `window.tests`
sahi, live object ki taraf point karta hai. (Baaki poori file mein
"tests" ka behavior bilkul same rehta hai.)

## 🚨 Sabse important correctness bug: 200-cap wali `records[]` galat jagah use ho rahi thi

Speed ke liye `records` (in-memory array) sirf **site-wide sabse
recent 200** studentRecords rakhta hai (ye pehle se tha, theek hai).
Lekin ye array kai jagah **per-test "poore" data ke liye** bhi use ho
raha tha — jaise hi site 200 total submissions paar karti (jo 1 lakh
students ke sath turant hoga), ye jagahein **silently INCOMPLETE data**
dikhane lagti:

- **Result Sheet / rank / "kitne students ne diya"** (Records tab)
- **WhatsApp bulk-send panel** (kis-kis ko bhejna hai)
- **Subjective Grading list aur dropdown** ("kis test mein grading
  pending hai") — ⚠️ **iska sabse bada risk**: agar koi test grading
  ke liye dropdown mein dikhna hi band ho jaaye, to admin ko pata hi
  nahi chalega ki kuch students ke marks abhi tak final nahi hue hain.
- **"Classwide Weak Chapters" analysis** (Records tab ke neeche) —
  poori class ka chapter-wise strong/weak % bhi isi capped array se
  ban raha tha, isliye scale ke saath ye analysis purani/adhoori
  tasveer dikhata.

**Fix:** ek naya per-test cache (`ensureFullRecordsForTest` +
`_fullTestRecordsCache`) banaya — jab bhi kisi specific test ka poora,
sahi data chahiye hota hai, ek chhoti (sirf US TEST ke records)
Firestore query background mein chalti hai, aur turant available data
(best-effort) dikhaya jaata hai jab tak fresh data nahi aata. Fresh
data aate hi UI khud-ba-khud sahi ho jaata hai — bilkul wahi pattern
jo Students Directory (`allStudentsCache`) mein already istemal ho
raha hai. Naya submit/delete/naam-edit hone par ye cache turant sync
bhi hota hai.

## 🔧 Firestore 500-op batch limit — 3 aur jagah chunk-size galat thi

Comment mein likha tha "2 ops/item" lekin asal mein **3 ops/item** the
(set + 2 delete) — 240×3=720, jo 500 se zyada hai:
- `restoreAllQuestions()` — Recycle Bin se "Restore All"
- `restoreSelectedQuestions()` — Recycle Bin se selected restore

Aur 2 jagah "1 op/item" maan liya tha jab asal mein 2 the:
- `deleteSelectedChapter()` — poora chapter delete
- `deleteSelectedBankQuestions()` — bulk selected questions delete

Sabme chunk size sahi kar di (jahan zaroorat thi, 500-limit ke andar).
`recomputeRecordsForTest()` (test ka answer-key edit karne par sabke
score dobara calculate karna) bhi ab 500-500 ke chunks mein commit
karta hai — pehle ek popular test (500+ students) ke liye ye seedha
crash ho jaata.

## 🖥️ Students Directory — bahut badi list render (UI safety cap)

Agar kisi EK institute mein khud hi bahut zyada (jaise 1000+)
registered students hon, to ek saath itni badi table banana browser
ko kuch second ke liye jam kar sakta hai. Ab default mein sirf pehle
**500** dikhaye jaate hain, aur admin ko turant apne student tak
pahunchne ke liye search box ka suggestion diya jaata hai — koi data
hide/delete nahi hota, sirf ek baar mein render kam hota hai.

## ✅ Verify kiya, sab theek mila (koi change nahi chahiye)

- **exam-manager.js (OMR scanning)** — already bahut acche se
  optimize hai: har scan apna chhota, alag doc hai (batch se), 500-op
  limit ka dhyan already rakha gaya tha. Ek exam ke saare scans ka
  list bhi sirf US EXAM tak bounded hai, poori site tak nahi.
- **`renderMyProgress()`, `loadMyResults()`, mistakes/streak** ("Mera
  Result", "Meri Progress" jaisi student-facing cheezein) — ye sab
  **pehle se hi** sahi tarike se bane hain: har ek sirf apne (student
  ke) mobile number se scoped query karta hai, poori collection ya
  200-cap wali `records[]` par depend nahi karta. (Isi pattern ko
  main is round mein baaki admin-side jagahon tak extend kar raha hu.)
- **`loadMyTestAttempts()`** ("maine kaunse test diye") — already
  sirf apne (student ke) records ki chhoti, scoped query karta hai,
  poori collection nahi.
- **Hot-document/counter contention** — check kiya ki kahin saare
  students ek hi shared "total submissions" jaisa document to nahi
  badal rahe (jo lakhon simultaneous writes se contention/slow-down
  karta) — nahi mila; har submission apna alag, independent document
  banata hai. OMR ke per-exam "scanned" counter bhi per-exam alag hai
  (sirf ek admin dwara, ek-ek scan karke update hota hai), koi
  student-scale contention nahi.
- **N+1 query patterns** (loop ke andar ek-ek karke Firestore calls) —
  poore codebase mein check kiya, kahin nahi mila jo student-count ke
  saath badhta ho.
- **owner-panel.js, qgen-app.js** — institutes/tests collections use
  karte hain, ye kabhi students jitne bade nahi honge.
- **Question-bank seed files** — sabme 41-53 questions hain (Math
  wali file already 400-chunk karti hai) — 500-limit se bahut door,
  koi risk nahi.
- **localStorage usage** — sab jagah pehle se hi bounded/capped hai
  (records 500 max, top-students list chhoti, etc.)
- **Firestore rules** — naye saare queries (`where in`, `where ==
  null`, `orderBy+limit`) ke liye koi extra composite index nahi
  chahiye (sab single-field hain, Firestore automatically bana deta
  hai) — aur `allow list` rules mein query-shape ki koi restriction
  nahi hai, isliye ye sab bina kisi Firestore Console change ke kaam
  karenge.

## ℹ️ Ek security note (performance wala issue nahi, alag se)

`firestore.rules` mein `studentRecords` collection par `allow list: if
isSignedIn()` hai — matlab koi bhi signed-in student (app ke UI se
bahar, seedha Firestore se) THEORETICALLY poori collection query kar
sakta hai. Ye aapke apne MASTER_PROMPT_AUDIT mein bhi already note tha
("Student Data Security ⚠️ Partial"). Ye AAJ ke "hang na ho" wale fix
se alag topic hai (app apni taraf se ab sahi/scoped queries hi karta
hai) — agar isko bhi tighten karna hai to alag se bata dena, kyunki
rules change carefully test karna padega taaki koi legitimate feature
na toote.

## Files changed (is round mein)
`script.js` (baaki sab files is round mein untouched — v27 ke changes
already in).

## ⚠️ Deploy se pehle (dono rounds milaake)
1. `firebase deploy` (rules + hosting dono ab saath deploy honge — v27
   ka fix).
2. Ek baar khol kar dekhna: **Result Sheets**, **Subjective Grading**,
   **Students Directory**, **Top Performers**.
3. `clearRecords()` ("Clear All Records") ab sirf apne institute ka
   data delete karega — agar kabhi genuinely SAARI institutes ka data
   clear karna ho (bahut rare, jaise testing/reset), wo ab alag se
   sirf Firebase Console se hi ho sakta hai, is button se nahi.
