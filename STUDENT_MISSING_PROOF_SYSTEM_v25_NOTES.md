# Student "Missing Proof" Identity System (v25)

Purane registered students (jo sirf naam+mobile+password se sign-up hue
the) ka pehchan-data ab admin khud, Students Directory se, ek-ek karke
complete kar sakta hai.

## Kaunse fields "pehchan" (identity proof) maane gaye

Aapne kaha tha "jo admin ko apne student ko pehchan sake" — isliye
maine ye 6 fields rakhe hain (`students/{mobile}` doc mein naye
fields):

1. **Photo** (`photoDataUrl`)
2. **Class** (`classId`) — Part A wali Class Eligibility list se hi
   (admin ke Institute ki allowed Classes)
3. **Roll Number** (`rollNumber`)
4. **Parent/Guardian ka Naam** (`guardianName`)
5. **Parent/Guardian ka Mobile** (`guardianMobile`)
6. **Institute** (`instituteId`) — admin apne Institute se link karta
   hai (dropdown nahi hai — koi doosre Institute ka student "chura" na
   sake)

Agar in 6 mein se koi bhi khaali hai, to us student ka profile
"incomplete" maana jaata hai.

## Kahan milega

**Admin Dashboard → Records → Students Directory** (jahan pehle se
naam/mobile/tests-diye dikhte the):

- Top par ek amber banner: *"⚠️ N student(s) ka pehchan-data
  incomplete hai"*.
- Ek naya checkbox: *"⚠️ Sirf incomplete pehchan-data wale students
  dikhayein"* — sirf incomplete waale filter kar deta hai.
- Naya column **"Pehchan"**: ✅ Poora, ya ⚠️ N missing (hover karne par
  kaun-kaun se fields missing hain wo bhi dikhta hai).
- Har row mein naya button: **🪪 Profile** (incomplete ho to orange +
  bold, complete ho to grey "✏️ Profile" — dono se hi form khulta hai,
  taaki baad mein edit bhi kiya ja sake).

## Form kaise kaam karta hai

Button dabate hi ek form khulta hai — **seedha us specific student ki
ID (mobile) se juda hua**:

- Jo field khaali/missing hai, uske around halka **amber highlight**
  aata hai aur label ke aage "⚠️ missing" likh jaata hai — baaki
  already-filled values pre-filled dikhti hain.
- Photo: file input se choose karo (camera bhi khul sakta hai mobile
  par) — code khud resize + compress karke chhota sa JPEG banata hai
  (koi Firebase Storage/paid plan nahi chahiye, seedha usi
  `students/{mobile}` doc mein base64 ke roop mein save hota hai —
  bilkul waise hi jaise OMR scan photos already save hote hain).
- Class: dropdown, sirf us Admin ke Institute ki allowed Classes se
  (Part A wali list).
- Roll Number, Guardian Naam, Guardian Mobile: simple text fields.
- Institute: khud-ba-khud admin ke apne Institute se set hota hai —
  koi dropdown nahi (safety: koi bhi admin kisi doosre Institute ke
  student ko apne yahan shift nahi kar sakta).
- **Save Karein** dabate hi seedha `students/{mobile}` doc mein
  `merge: true` se save hota hai — kuch bhi delete/overwrite nahi hota,
  sirf naye fields add/update hote hain.

## Jaan-boojh kar chhodi gayi cheez

Aapne "Dono" (online-login + OMR/roll-number wale students) dono ke
liye poocha tha — maine dekha ki aapke system mein already ek hi
"Students Directory" hai jo dono ko cover karti hai: chahe student ne
online MCQ diya ho, OMR scan se ho, ya Manual Entry se marks chadhe ho
— sab isi "students" collection (mobile-based) se match hote hain
(jaisa Records → "Fake/Galat Mobile Number Theek Karein" tool ke
description mein bhi likha hai). Isliye ye ek hi system dono cases
cover kar leta hai — alag se do systems banane ki zaroorat nahi thi.

⚠️ Ek cheez zaroor bata dena chahta hoon: abhi Students Directory
**poore system mein sabhi Institutes ke students dikhati hai** (koi
per-Institute isolation nahi hai, kyunki `students` collection mein
pehle se `instituteId` field hi nahi tha). Ye Admin-side Master Prompt
ke Rule 14 se related hai — is form se Institute assign hona shuru ho
jaayega, lekin Directory ki LISTING ko khud current-admin-ke-institute
tak seedha nahi kiya hai (risky change hota, live data par bina
poochhe). Agar chahiye to ye agla safe step ho sakta hai — bata dijiye
to bana dunga.
