# Question Bank — Doc ID ab "Class-Chapter-Number" format mein (v34)

## Aapne kya maanga tha
ID sirf "kuch tag" ki tarah nahi, balki **readable** honi chahiye —
Class + Chapter naam + ek sequential serial number. Jaise:

- `class10-Number-System-1`
- `class10-Number-System-2`
- `class9-Samajwad-1`

(Pehle ke version mein sirf ek chhota `--c10` suffix jodta tha — is
version mein wo poori tarah replace ho gaya hai is naye readable format
se.)

## Format kaise kaam karta hai
`<classLabel>-<chapterSlug>-<serial>`

- `classLabel`: `class_10` → `class10` (underscore hata diya, number
  saaf dikhta hai)
- `chapterSlug`: Chapter ka naam, spaces `-` mein convert, aur
  Firestore ke liye risky characters (`/`, `.`, `#`, `[`, `]`) hata diye
  jaate hain. Hindi chapter names (jaise "समाजवाद") bhi as-is chalte hain
  — Firestore doc IDs Unicode support karte hain.
- `serial`: Us specific Class + Chapter combination mein ye kitwan
  question hai — 1 se shuru, aage badhta jaata hai. Har naya question
  automatically agla number leta hai (jaise agar "Class 10 → Number
  System" mein pehle se 5 questions hain, to next upload 6, 7, 8... se
  shuru hoga).

## Kahaan-kahaan lagaya (pehle jaisa hi scope)
1. **Admin Panel → Bulk Upload tab** (`index.html`) — poore batch ke
   liye ek hi baar serial-base compute hota hai, phir har question ke
   liye ek-ek badhta hai (kyunki poora batch ek hi Class+Chapter ke liye
   hota hai). **Bonus fix:** "Retry Failed" button mein ek purana bug
   tha jismein Class hi nahi bheji ja rahi thi (jiski wajah se retry ke
   dauraan galat ID ban sakti thi) — wo bhi theek kar diya.
2. **Question Generator tool** (`question-generator.html` +
   `qgen-app.js`) — Bulk Upload panel aur Add panel dono mein "Save to
   Bank" karte waqt.
3. **PDF-to-Bank verify** (`script.js`) — abhi bhi koi UI se connected
   nahi hai (dead code), lekin future-safe patch kar diya hai.

## Purani questions ki ID migrate karna
Bank tab ke top par **"🏷️ ID mein Class Tag Karein"** button — sirf tab
dikhta hai jab kisi Class-tagged question ki ID abhi is naye format mein
na ho. Ek baar sab ho jaayein to khud gayab.

Kya karta hai:
1. Sabhi Class-tagged questions ko **(Class, Chapter)** ke hisaab se
   group karta hai.
2. Har group ke andar, jo questions abhi purani-style ID mein hain unhe
   sequential serial deta hai — us group mein **jo already sahi format
   mein hain unke sabse bade number ke aage se** (taaki koi do questions
   ek hi number na paayein).
3. Purani ID par se data hata kar nayi ID par copy kar deta hai (data
   same, sirf ID naya).
4. Jin questions mein classId hi set nahi hai (untagged) — unhe touch
   nahi karta. Pehle "🎓 Class 10 Assign Karein" dabao.
5. 245 renames/batch (Firestore ke 500-ops/batch limit se safe margin),
   beech mein fail ho to resume-safe hai.

⚠️ Note: agar do alag chapter names slugify hone ke baad same ban jaayein
(jaise ek jagah "Number System" aur doosri jagah "Number  System" extra
space ke saath likha ho), to wo dono ek hi group mein migrate ho jaayenge
— practically koi dikkat nahi, bas numbering ek hi series mein chalegi.

## Test karne ka tarika
1. Deploy ke baad Bank tab kholein → agar "🏷️ ID mein Class Tag Karein"
   dikh raha hai, dabao → confirm karo.
2. Kisi question ki ID check karo — ab `class10-...-1` jaisa dikhna
   chahiye (Class + Chapter + Number).
3. Bulk Upload tab se usi Chapter mein 2-3 naye questions upload karo —
   unki ID mein number wahin se aage badhna chahiye jahan purane chhode
   the.
4. Question Generator tool se bhi ek question "Save to Bank" karke check
   karo — Class na chune to alert aana chahiye.

## Jaan-boojh kar KYA NAHI chhua
- Firestore Rules — koi change nahi, existing `allow write: if
  isAdmin();` rule rename (create+delete) ko bhi cover karta hai.
- `deletedQuestions` mein pehle se pade hue deleted questions ki
  `_originalId` — agar koi aisa question restore karega jo migration se
  PEHLE delete hua tha, wo apni purani ID par hi wapas aayega. Chhota
  edge-case hai, chahiye to bataiye.
- Agar kisi question ka **Chapter** baad mein Edit form se badal diya
  jaaye, uski ID automatically update nahi hoti (sirf naya data save
  hota hai, ID wahi purani rehti hai) — chahiye to isko bhi handle kar
  sakta hoon.
