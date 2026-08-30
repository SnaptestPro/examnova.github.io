# Naya Institute Add Permission Error + Slow Admin Login (v24_15)

Aapne 2 problem bataye the:
1. Naya institute **bar-bar add karne par** "Missing or insufficient permissions"
2. Admin ko **login hone mein bahut samay** lagta hai

Dono ki alag-alag wajah hai — neeche dono cover kiye hain.

---

## 1️⃣ "Missing or insufficient permissions" — naya institute add karte waqt

Maine `owner-panel.js` ka Add-Institute code aur `firestore.rules` dono
dhyan se check kiye — **code mein koi bug nahi mila**. `institutes`
collection ka rule bilkul sahi hai:

```
match /institutes/{instituteId} {
  allow read, write: if isOwner();   // sirf vishnu1234stm@gmail.com
  ...
}
```

Jab bhi `institutes` collection par **har** request permission-denied de
(sirf kabhi-kabhi nahi, balki har baar) — iska matlab 99% yahi hota hai
ki **jo `firestore.rules` file abhi Firebase Console mein LIVE/Published
hai, wo is zip wali file se match nahi karti** (purani hai, ya kisi
purane version ki hai jisme `institutes` collection ka rule tha hi nahi
— ye feature v24_8 mein add hua tha).

⚠️ Ye bilkul wahi pattern hai jo pehle bhi ho chuka hai (v37 wala issue,
aur khud is zip ke andar v24_8 / v24_14 notes mein bhi likha hai) — is
project mein rules deploy karna ek manual copy-paste step hai (koi CLI
nahi), isliye code update karne ke baad ye step bhoolna bahut aasan hai.

### Abhi check/fix karein
1. Firebase Console kholein → **Firestore Database → Rules** tab.
2. Wahan jo rules likhe hain, unhe is zip ki `firestore.rules` file se
   compare karein — khaas taur par neeche wali line dhoondhein aur
   confirm karein ki wahi email hai jisse aap Owner Panel mein login
   karte hain:
   ```
   request.auth.token.email == "vishnu1234stm@gmail.com"
   ```
   (Ek baar pehle isi tarah ka email-mismatch legacy admin ke liye bhi
   mil chuka tha — `vishnu1234stmp@gmail.com` vs `vishnu1234stm@gmail.com`
   — isliye ek baar aankh se character-by-character check kar lein.)
3. Agar match nahi karta ya purana lagta hai: is zip ki poori
   `firestore.rules` file copy karke Console ke Rules editor mein paste
   karein → **Publish** dabayein.
4. Publish hone ke turant baad, ek naya institute add karke dobara try
   karein.

Isse code ka koi lena-dena nahi (isliye maine iske liye koi file nahi
badli) — sirf Console ka deploy step hi missing/purana ho sakta hai.

---

## 2️⃣ Admin login slow — asli bug mila aur fix kar diya

Ye ek genuine code bug tha, `script.js` ke `migrateLegacyInstituteData()`
function mein.

### Kya ho raha tha
Har baar jab koi **legacy admin** (jiske `admins/{email}` doc mein
`instituteId` pehle se nahi hai) login karta hai, aur uske browser mein
one-time "migrated" flag set nahi hai (naya device/browser, ya
localStorage clear ho gaya ho) — to login ke dauraan ek poora
`db.collection("examManagerExams").get()` (bina kisi `.where()` ke)
chalta tha.

Problem ye hai: `examManagerExams` collection ka read-rule ab
`instituteId`-based hai (multi-tenant isolation, v24_8 se):
```
allow read: if isAdmin() && (
  !('instituteId' in resource.data) ||
  resource.data.instituteId == adminInstituteId()
);
```
Jab rule kisi doc ke **data** par depend kare, Firestore ek bina-filter
wali `.get()` (poori collection list) ko **hamesha reject** kar deta hai
— chahe rules bilkul sahi publish ho chuke hoon — kyunki Firestore
query-time par proof nahi kar pata ki collection ke saare docs is rule
ko pass karenge. Matlab ye call **guaranteed** "missing or insufficient
permissions" deta tha, har baar.

Ye error `catch (e) { console.warn(...) }` mein chup-chaap absorb ho
jaata tha, isliye app crash nahi hota tha ya alert nahi dikhta tha —
lekin har aisi login par ek poora (fail hone waala) network round-trip
extra jud jaata tha, jo login ko slow mehsoos karwata tha, aur asal mein
kuch migrate bhi nahi karta tha.

### Fix (script.js)
Maine ye doomed call hata diya hai — isse ab wo login step wahan pe
time waste nahi karta. Comment bhi chhoda hai code mein taaki future
mein koi confuse na ho ki ye jaan-boojh kar hataya gaya hai.

**Isse kya fark padta hai:**
- Legacy admin ka login (khaas taur par naye/fresh browser-session mein,
  jahan migration flag set nahi hai) ab thoda fast hoga — ek guaranteed-
  fail Firestore call kam ho gaya.
- `tests` collection wali migration (jo waise hi kaam kar rahi thi,
  kyunki uska read-rule data-dependent nahi hai) waisी hi chalti rahegi
  — usmein koi change nahi kiya.
- Purane (bina `instituteId` wale) `examManagerExams` docs abhi bhi
  individually readable hain (rules ke backward-compat OR-check ki
  wajah se) — bas Exam Manager ki list mein tab tak nahi dikhenge jab
  tak unhe `instituteId` na mil jaaye (kyunki list wahan se
  `.where("instituteId","==",...)` se load hoti hai). Agar koi purana
  exam wapas list mein chahiye: Firebase Console → Firestore Database →
  `examManagerExams` collection → wo document kholkar manually
  `instituteId` field add karke uski value apne institute ki asli ID
  jitni rakh dein (Owner Panel mein institute card par ID dikh jaata
  hai) — ek baar ka chhota manual step hai, poori tarah safe hai.

`sw.js` ka cache version bhi bump kar diya hai (v86 → v87) taaki jinke
paas already-installed app hai, unhe ye fix turant milega, purana
cached `script.js` nahi.

### ⚠️ Zaroori step (waisa hi jaisa upar bhi bataya)
`firestore.rules` is baar change NAHI hui hai, isliye agar sirf ye
issue #2 ka fix chahiye tha to dobara publish karne ki zaroorat nahi.
Lekin agar issue #1 (institute add) abhi bhi permission error de raha
hai, to upar wale Section 1 ke steps zaroor follow karein.

## Test karne ka tarika
1. Naya zip deploy karein.
2. **Section 1 ke steps se rules verify/publish karein** (sabse pehle
   ye — isi se institute-add wala issue theek hona chahiye).
3. Ek naya institute add karke confirm karein ki ab bina error ke ban
   jaata hai.
4. Legacy admin (`vishnu1234stmp@gmail.com`) se, ek fresh/incognito
   browser session mein login karke dekhein — login pehle se thoda
   fast lagna chahiye, aur console mein ab
   `[migrate] examManagerExams failed` wala warning nahi aana chahiye.
