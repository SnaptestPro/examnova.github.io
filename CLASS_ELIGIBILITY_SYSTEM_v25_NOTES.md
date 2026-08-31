# Class Eligibility System (v25) — Multi-Institute Shared Question Bank

## Aapne jo Master Prompt diya tha, usme se is version mein kya ban gaya

Aapke Master Prompt document ke core rules (khaas taur par Rule 3, 5, 8,
9, 10, 11, 13, 14, 16, 17) is version mein implement ho gaye hain:

- **Har Institute ki apni "Allowed Classes" list hoti hai** (Owner Panel
  se set hoti hai) — ye sirf ELIGIBILITY control karti hai.
- **Master Data (Question Bank) Institute-wise DIVIDE nahi hota** — jo
  pehle se hi sach tha (Question Bank pehle se hi sabhi institutes ke
  liye ek hi/shared hai), ab usi ke upar Class-level eligibility ka
  formal layer laga diya gaya hai.
- **Backend/Firestore-level enforcement** — sirf frontend pe dropdown
  chhupana kaafi nahi hai (Rule 14), isliye `firestore.rules` mein bhi
  server-side check hai.

## Kya naya bana

### 1. Owner Panel — Institute ki "Allowed Classes"
- Naya Institute banate waqt ab Class checkboxes dikhte hain (Class 9 /
  10 / 11 / 12). Default: **Class 10 checked** — kyunki abhi Master
  Question Bank/Exam data sirf Class 10 ka hi hai.
- Har institute card par ab "🎓 Allowed Classes" chips dikhte hain —
  kisi bhi class ko check/uncheck karte hi turant Firestore mein save ho
  jaata hai (`institutes/{id}.allowedClasses` array field).
- **Purane institutes** (jo is update se pehle bane the) ke paas ye
  field nahi hoga — unke liye card mein "abhi sabhi Classes allowed
  hain" dikhega (backward-compat, koi turant lock-out nahi hota, bilkul
  waisa hi jaisa `instituteId` field ke saath pehle se ho raha hai).

### 2. Exam Manager — Naya Exam banate waqt Class select
- "Naya Exam Banayein" form mein ab "Class Name" (free-text, jaisa pehle
  tha) ke saath ek "Class (eligibility ke liye)" dropdown bhi hai — isme
  sirf wahi Classes dikhti hain jo us Admin ke Institute ko Owner Panel
  se allow ki gayi hain.
- Agar Institute sirf 1 hi Class ke liye eligible hai (aaj-kal ka normal
  case — sirf Class 10), to dropdown khud-ba-khud chhup jaata hai (kam
  friction) — value phir bhi sahi save hoti hai.
- Ye value naye field `classId` mein exam doc ke saath save hoti hai
  (jaise `"class_10"`). Purane exams mein ye field nahi hai — unhe kuch
  nahi hota, backward-compatible.

### 3. Firestore Rules — server-side enforcement
- `adminAllowedClasses()` aur `classAllowedForAdmin()` naye helper
  functions.
- `examManagerExams` collection ke create/update rules ab check karte
  hain ki agar exam par `classId` lagi hai, to wo Admin ke Institute ki
  `allowedClasses` list mein honi chahiye — warna backend hi request
  reject kar dega (403-jaisa "permission-denied"), chahe koi frontend
  ko bypass karke seedha API/console se try kare.
- Sab kuch **backward-compatible** hai: field missing = purana data =
  allowed (bilkul jis pattern se `instituteId` wale rules pehle se
  likhe gaye hain, usi convention ko follow kiya gaya hai).

## ⚠️ ZAROORI: Firestore Rules deploy karna hoga
Jaisa is project mein hamesha hota hai (v24_8, v24_14, v24_15 notes mein
bhi likha hai) — **sirf app files update karne se rules apply NAHI
hote**. Firebase Console → Firestore Database → Rules tab → is zip ki
`firestore.rules` poori file paste karein → **Publish** dabayein.
Jab tak publish nahi karenge, naya Class dropdown/checkbox UI to dikhega
lekin uska security-enforcement (backend reject) kaam nahi karega.

## Jaan-boojh kar is version mein KYA NAHI kiya (scope/risk ki wajah se)

Aapka Master Prompt ek bahut bada system describe karta hai — poori
tarah se ek hi pass mein implement karna is live/production app ke liye
risky hota, isliye maine sabse zaroori/foundational hissa pehle diya
hai. Baaki jaan-boojh kar chhoda hai:

- **Student Login ka Institute+Class verification (Rule 4, 6, 7)** —
  abhi aapke "students" collection (jisse student login/online-test
  karta hai) mein koi `institute_id`/`class_id` field hai hi nahi — ye
  ek genuinely bada, alag structural change hai (student registration
  form, login flow, sab jagah asar padega). Isse chhedne se pehle main
  chahta hoon ki aapse confirm ho jaaye ki bilkul kya-kya fields chahiye
  (agle section mein pooch raha hoon).
- **Question Generator (qgen) ke static bank files**
  (mathematics-question-bank.js waghera) — ye already effectively
  "shared/global" hain (ek hi file sabhi institutes ko milti hai), isliye
  Rule 8 already satisfy ho raha tha. Inhe Firestore-based
  Class-tagged system mein badalna ek bada rewrite hoga (118KB+ files)
  — abhi chhedne se scan/exam features todne ka risk zyada tha, isliye
  isse touch nahi kiya.
- **Exam list ko Class ke hisaab se filter karna** — abhi sirf Class 10
  hi maujood hai, isliye filtering ka koi practical fayda nahi tha; jab
  Class 9/11/12 ka real data aayega tab ye add karna seedha hoga
  (list rendering mein ek `.filter()` bas).

## Test karne ka tarika
1. `firestore.rules` publish karein (upar wala step, sabse pehle).
2. Owner Panel kholein → naya institute banayein → Class checkboxes
   dikhne chahiye (Class 10 default-checked).
3. Kisi purane institute ke card par "🎓 Allowed Classes" dikhna
   chahiye — sab checked (backward-compat) rehna chahiye jab tak aap
   khud kisi ko uncheck na karein.
4. Us institute ke admin se login karke Exam Manager → "Naya Exam
   Banayein" kholein — agar sirf ek hi Class allowed hai to dropdown
   nahi dikhega (normal); agar 2+ allow ki hain (test ke liye Owner
   Panel se ek aur class check kar dekhein) to dropdown dikhega.
5. Ek naya Exam save karke confirm karein ki koi error nahi aata.
