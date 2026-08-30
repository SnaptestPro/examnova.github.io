# Institute Isolation (v24_8) — Har Admin Ko Apna Alag Data

## Kya badla
Ab har Admin ko sirf **apne institute ka** data dikhta hai — kisi doosre
admin ka nahi. Ye 4 areas cover kiye gaye hain (jo aapne select kiya tha):

1. **Tests** (online MCQ tests) — Admin Panel ke Tests tab mein sirf apne
   banaye hue tests dikhte hain, list/edit/delete/subjective-grading sab
   jagah.
2. **Exam Manager** (OMR/paper exams) — sirf apne institute ke exams.
3. **Records/Results** — Records tab mein sirf apne tests ke results
   dikhte hain.
4. **Leaderboard/Top Performers** — sirf apne institute ke tests ke marks
   count hote hain.

Student-facing cheezein (jo test student ko dikhte hain "Start Test"
list mein, student apna khud ka result dekhna, student ka apna dashboard
Top-Performers podium) **jaan-boojh kar unchanged** rakhi gayi hain — wo
sabko dikhti rehti hain jaisa pehle thi, sirf ADMIN ka apna panel-view
scoped hua hai.

## Kaise kaam karta hai
- Owner Panel se bana admin: uska `instituteId` pehle se `admins/{email}`
  doc mein hota hai — usko turant use kar liya jaata hai.
- **Legacy admin** (purana, ADMIN_EMAILS list wala, Owner Panel se nahi
  bana): pehli baar login karte hi app khud uske liye ek institute record
  bana deta hai (naam: "My Institute (uska-email)") — **ye Owner Panel
  mein bhi dikhega**, jaisa aapne poocha tha.
- Isi pehli login par, uska **purana (bina instituteId wala) Tests aur
  Exam Manager data khud-ba-khud usi naye institute se migrate/jud
  jaata hai** — koi manual step nahi, ek hi baar hota hai.

## ⚠️ ZAROORI: Firestore Rules deploy karna hoga
Ye feature security ke level par bhi kaam kare, isके liye `firestore.rules`
file bhi update ki gayi hai. **Sirf app code update karne se ye security
part apply NAHI hoga** — Firebase Console mein jaakar naye rules
publish/deploy karne honge (Firestore Database → Rules tab → paste →
Publish), jaisa aapne pehle bhi kiya tha.

## Kya isse chhoot gaya (jaan-boojh kar)
- **Question Bank** — jaisa aapne kaha, ye shared/global hi raha (sabhi
  institutes ke liye ek hi bank) — isolate nahi kiya.
- `studentRecords` collection khud raw level par instituteId se tagged
  nahi hai (isse student registration/login system chhedna padta, jo
  risky tha) — Records/Leaderboard ki isolation "kaunsa test kiska hai"
  ke through hoti hai, jo app ke andar se 100% sahi kaam karta hai. Agar
  koi technical user seedha Firestore console/API se raw studentRecords
  collection browse kare to wahan sabhi records dikhenge (bas app ke
  UI se nahi) — future improvement ke liye note kar liya hai.

## Test karne ka tarika
1. Pehle admin se login karein → Tests/Exam Manager/Records/Leaderboard
   check karein — purana data waisa hi dikhna chahiye (migrate ho chuka).
2. Owner Panel se ek NAYA doosra admin banayein (naya institute ke saath)
   → us naye admin se login karein → sab kuch khaali/fresh dikhna
   chahiye, pehle wale admin ka kuch bhi nahi dikhna chahiye.
3. Naye admin se ek test banayein → sirf usi ko dikhna chahiye, purane
   admin ko nahi.
