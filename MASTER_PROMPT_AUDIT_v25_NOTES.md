# Master Prompt Audit (v25) — Kya Ban Gaya, Kya Baaki Hai

Aapke Master Prompt document ke har section/rule ko check kiya — neeche
poori honest list hai: ✅ = ban gaya, ⚠️ = partially ban gaya
(explanation ke saath), ❌ = nahi bana (WHY ke saath, kyunki bina
wajah bataye chhodna galat hota).

## Section-wise Status

**1. Admin Creation System** ⚠️ Partial
- Institute banate waqt Allowed Classes select karna ab **mandatory**
  hai (Owner Panel).
- ✅ Naya: Admin account banate hi ab **verification email** bhi jaata
  hai (pehle sirf password-set link jaata tha).
- ❌ Nahi kiya: Per-ADMIN alag Class permission (Master Prompt ka
  `AdminClassPermissions` table) — abhi Class permission **Institute
  level** par hai, Admin level par nahi. Wajah: is app mein practically
  1 Institute = 1 (ya bahut kam) Admin hota hai (Owner Panel ka structure
  hi aisa hai), isliye Institute-level permission hi effectively
  Admin-level permission ban jaati hai. Agar kisi Institute ke 2 alag
  Admins ko **alag-alag** Classes chahiye ho, tabhi ye asli gap banta
  hai — bataiye to alag se bana dunga.

**2. Institute Unique Identity** ✅ Done (pehle se tha, unchanged)

**3. Admin Class Eligibility** ⚠️ Partial — Exam Manager (naya Exam
banate waqt) mein poori tarah enforced hai (frontend dropdown + backend
Firestore rules dono). Question Bank (jahan se Tests banti hain) mein
abhi Class-tagging nahi hai — neeche "Sabse Bada Baaki Kaam" section
mein detail hai.

**4. Student Login System (Institute select karke login, mismatch par
deny)** ❌ Nahi ban saka — architecture-level wajah hai, neeche
"Kyun Nahi Ho Saka" section mein poora explain kiya hai.

**5–7. Master Question Bank shared, divide nahi hoga** ✅ Already
satisfied — koi bhi Question Bank Institute-wise divide nahi hota
(pehle se hi shared tha, ye architecture change ki maang hi nahi thi).

**8–9. Class+Subject exact filtering, Correct Filtering Rule** ⚠️
Partial — Exam Manager mein hai; Question Bank/Tests mein nahi.

**10. Master vs Institute-specific data separation** ✅ Conceptually
satisfied (Question Bank = master/shared; Students/Tests/Results =
institute-specific, jitna abhi isolate ho paaya hai).

**11. Result Sets Institute+Class-wise isolated** ✅ Exam Manager ke
Results ab Institute (pehle se) + Class (naya, is exam ki classId ke
zariye) dono se automatically scoped hain, kyunki results us exam doc
ke andar hi rehte hain.

**12–13. Fresh data, no stale cache on Class switch** ✅ Jo bhi naya
Class-related UI bana (Exam Manager dropdown, Registration dropdown,
Directory), sab already-existing render-on-change pattern follow karte
hain — koi purana data screen par atka nahi rehta.

**14. Backend Security (403 on unauthorized)** ⚠️ Partial — Exam
Manager ke liye Firestore Rules mein hai (backend reject karta hai).
Question Bank ke liye nahi (static/global architecture, neeche detail).

**15. Student Data Security (apna Institute+Class+resources hi)** ⚠️
Partial — naye students ab Institute+Class se linked hote hain
(registration form), aur Admin Directory ab sirf apne Institute ke
students dikhati hai. Lekin ye **Admin-side isolation** hai — asli
**Student-side** ("student sirf apna data dekh sake") backend-enforced
nahi hai (Section 4 wali wajah).

**16. DB Structure** ⚠️ Zyadatar match: Institutes/Admins/Students sab
mein ab `institute_id`/`class_id` hai. `Classes` ek Firestore collection
ki jagah code mein hardcoded list hai (Class 9–12) — kaam wahi karta
hai, bas Owner ko naya class add karne ke liye ek chhota code-update
lagta (Firestore-driven banwana ho to bata dijiye).

**17. Super Admin** ✅ Owner hi effectively Super Admin hai (poore
system ka access) — naam alag hai, kaam wahi hai.

**18. Final Access Architecture diagram** ⚠️ Zyadatar match, Student
Login wala hissa (Section 4) chhoda hua hai.

**19. Final Rules 1–18 checklist** — har Rule upar wale sections mein
cover ho gaya hai (Rule 1→§1, Rule 4/6/7→§4, waghera).

---

## Is baar (audit ke baad) kya naya add hua

1. **Admin Email Verification** — naye Admin ko verification email;
   Admin Dashboard par ek non-blocking ⚠️ banner (jab tak verify na ho)
   + "Resend" button.
2. **Student Registration mein Institute + Class ab MANDATORY** —
   naya student register karte hi seedha apne Institute+Class se
   link ho jaata hai (Rule 6, naye students ke liye).
3. **Students Directory ab Institute-wise isolated** — Admin ko sirf
   apne Institute ke students dikhte hain (jinka Institute set hi nahi
   hai wo abhi bhi dikhte hain, taaki purana data gayab na ho jaaye) —
   kitne students doosre Institute se hain wo bhi ek chhoti si info-line
   mein dikh jaata hai.

## ⚠️ Zaroori: Firestore Rules FIR SE publish karna hoga
Is baar bhi `institutes` collection ka read-rule badla hai (students ko
Institute list dikhane ke liye) — Firebase Console → Firestore →
Rules → is zip ki `firestore.rules` paste → Publish.

---

## Sabse Bada Baaki Kaam: Question Bank (Tests) mein Class-tagging

Aapke asli **"Question Bank"** (jahan se Tests banti hain — real-time
sync hoti hai, students seedha isse test lete hain) abhi bhi poori
tarah global hai — koi Class-tag nahi hai. Maine jaan-boojh kar isse
is pass mein NAHI chheda, kyunki:

- Ye aapki **sabse zyada roz-roz use hoti feature** hai (Question
  Bank add/edit/bulk-upload + Test creation + Student ka live test
  lena — sab isi ek collection se juda hai).
- Isme Class-eligibility jodne ke liye Question add/edit/bulk-upload
  ke **kai alag jagah** (single add, bulk import x2, edit) badalne
  padte, aur Student ke "Test lo" flow ko bhi Class-aware banana
  padta — bina achhi tarah test kiye, live app par galti se questions
  chhupa dena ya galat dikha dena bahut risky hota.

Agar ye chahiye, to agla dedicated pass isme:
- Har Question par `classId` field (optional — purane questions
  automatically "sabke liye" maane jaayenge).
- Question Bank list ko Admin ki Allowed Classes se filter karna.
- Test creation aur Student ke "Start Test" screen ko bhi Class-aware
  banana.

Bata dijiye to yehi agla kaam banata hoon.

## Kyun "Student Login → Institute select → mismatch par deny"
## (Section 4) Nahi Ban Saka

Ye is app ke authentication architecture ki wajah se hai, na ki
kaam-chori: Student "login" karte waqt real Firebase Auth account nahi
banta — poori app **anonymous Firebase sign-in** use karti hai (App
khulte hi automatically ho jaata hai), aur mobile+password ka match
Firestore Rules ke andar ek clever hash-compare trick se hota hai.

Iska matlab: Firestore Rules ke paas ye jaanne ka koi tarika hi nahi
hai ki "ye request LITERALLY kis mobile number wale student ki taraf
se aa rahi hai" — koi bhi anonymous session kisi bhi mobile number ke
liye ye "proof" attempt kar sakta hai. Isliye "Student ne Institute X
select kiya lekin uska account Institute Y ka hai — DENY karo" jaisa
backend check ban hi nahi sakta jab tak har student ka apna real,
unique Firebase Auth account na ho (jaisa Admin ka hai) — jo ek bada,
sensitive rearchitecture hai (sab existing students ko migrate karna
padega, login flow poora badalna padega). Isse bina aapse consult kiye
akele nahi kar sakta — itna bada, risky change hai.

Jo maine iski jagah kiya (Institute+Class ab account ke saath store
hote hain, Admin-side Directory isolated hai) — wo isi disha mein ek
practical, safe kadam hai, bina live student accounts ko todne ke
risk ke.
