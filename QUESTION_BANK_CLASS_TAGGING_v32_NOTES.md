# Question Bank — Class Tagging (v32)

## Aapne kya maanga tha
1. Jitne bhi questions abhi Firebase (`questionBank` collection) mein
   maujood hain, sabko **Class 10** assign kar diya jaaye.
2. Aage se jab bhi Bulk Upload se naye questions daale jaayein, tab app
   **puche ki kaunsi Class hai** — aur ye field **mandatory** ho (bina
   chune upload na ho paaye).

## Kya naya bana

### 1. Bulk Upload tab — naya mandatory "Class" dropdown
- Admin Panel → 📦 Bulk Upload tab mein, Subject/Chapter/Difficulty ke
  saath ab ek **"Class (कक्षा)"** dropdown bhi hai (Class 9/10/11/12 —
  wahi list jo Owner Panel ki "Allowed Classes" mein use hoti hai).
- Ye dropdown **khaali start hota hai** (koi default pre-select nahi) —
  jaan-boojh kar, taaki har baar admin ko active choice karni pade,
  jaisa aapne kaha tha.
- **"🔍 Preview Questions"** aur **"🚀 Confirm & Upload"** dono buttons
  ab bina Class chune kaam nahi karte — clear alert dikhta hai.
- Poora batch (jo bhi is ek Bulk Upload session mein upload ho raha hai)
  usi ek chuni hui Class ke saath save hota hai — bilkul Subject/Chapter
  ki tarah, per-question alag Class nahi hai (agar future mein kabhi
  ek hi paste mein alag-alag Class ke questions daalne ki zaroorat pade,
  to filhaal unhe do alag Bulk Upload runs mein karna hoga).
- Har upload hue question ke Firestore doc mein ab `classId` field save
  hoti hai (jaise `"class_10"`) — bilkul wahi convention jo Exam Manager
  ke `classId` field mein pehle se (v25) use ho rahi hai.

### 2. Bank tab — "🎓 Class 10 Assign Karein" (one-time migration button, khud-hide hone wala)
- Admin Panel → Bank tab ke top par, "🔄 Refresh from Firebase" ke bagal
  mein ek button hai — **par ye sirf tab dikhta hai jab kam se kam ek
  question abhi bhi "untagged" (bina Class ke) ho**. Ek baar sabko
  Class mil jaaye, button apne aap gayab ho jaata hai — permanent UI
  clutter nahi banta, aur na hi ise hataane ke liye dobara koi code
  change/redeploy karna padega.
- Dabane par: jitne bhi questions mein abhi `classId` set NAHI hai,
  unhe **Class 10** assign kar deta hai (confirm popup ke saath — pehle
  batata hai kitne questions affected honge).
- **Already-tagged questions ko chhuta nahi** — agar kisi question mein
  pehle se koi Class set hai (chahe Class 10 ho ya koi aur), use skip
  kar diya jaata hai. Isliye ye button **safe hai baar-baar dabane ke
  liye** — jo ek baar ho chuka, dobara touch nahi hoga.
- Firestore ke 500-ops/batch limit ke andar rehne ke liye 490/batch ke
  chunks mein commit karta hai (bilkul wahi safety-margin convention jo
  is app mein har jagah bulk-write ke liye use hoti hai).
- Agar beech mein fail ho jaaye (network issue waghera), jo ho chuke hain
  wo save rahenge — button dobara dabane par sirf baaki bache hue
  questions process honge (resume-safe).
- Bonus: agar kabhi future mein koi naya untagged question kisi aur
  raaste se (jaise purani AppScript seed) aa jaaye, to button khud-ba-
  khud wapas dikhne lagega — bina kisi manual intervention ke.

### 3. "Edit Question" form — Class field add hui
- Bank tab mein kisi existing question ko "Edit" karte waqt, ab wahan
  bhi ek "Class" dropdown dikhta hai (Subject/Chapter/Difficulty ke
  saath) — us specific question ki Class dikhata/badalta hai.
- Isse migration ke baad agar koi ek-do question galti se Class 10 ke
  bajaye kisi aur Class ka nikle, to use Firebase Console kholne ki
  zaroorat nahi — seedha yahin se fix kar sakte ho.
- Ye field yahan **mandatory nahi** rakha hai (sirf naye Bulk Upload
  path par mandatory hai, jaisa aapne kaha tha) — agar khaali chhod kar
  save karoge to wo question phir se "untagged" ban jaayega aur agli
  baar "🎓 Class 10 Assign Karein" dabane par wapas Class 10 mil
  jaayegi.

## Test karne ka tarika
1. Naya deploy karne ke baad, pehle Bank tab kholein → **"🎓 Class 10
   Assign Karein"** dabayein → confirm karein → sab existing questions
   ko Class 10 mil jaani chahiye (dobara dabane par ab "Sabhi questions
   mein pehle se hi Class set hai" dikhna chahiye).
2. Bulk Upload tab kholein → kuch questions paste karein → **bina Class
   chune** "Preview Questions" dabayein → alert aana chahiye.
3. Class select karein (jaise Class 10) → ab Preview aur Confirm &
   Upload dono kaam karne chahiye → Bank tab mein wapas jaakar us naye
   question ko Edit karein → Class dropdown mein sahi Class dikhni
   chahiye.

## Jaan-boojh kar is version mein KYA NAHI chhua
- **Question Generator tool** (`question-generator.html` /
  `qgen-app.js`) — ye ek alag, separate admin tool hai jiska apna bulk
  upload button hai aur ye bhi seedha isi shared `questionBank`
  collection mein likhta hai, lekin uska UI pattern (datalist-based
  Subject/Chapter, no dropdown-select style) is Bulk Upload tab se
  alag hai. Maine ise jaan-boojh kar touch nahi kiya taaki bina
  confirm kiye kisi aisi tool mein badlaav na ho jo shaayad ab active
  use mein na ho. **Agar ye tool bhi abhi use hoti hai, bataiye — usmein
  bhi Class dropdown add kar dunga**, warna wahan se upload hue naye
  questions bina Class ke rah jaayenge.
- **Firestore Rules** — is baar koi rules change nahi ki gayi (na
  zaroorat thi) — `questionBank` ka existing rule
  (`allow write: if isAdmin();`) already `classId` field ko cover kar
  leta hai, backend-enforcement ke liye kuch naya publish karne ki
  zaroorat nahi.
