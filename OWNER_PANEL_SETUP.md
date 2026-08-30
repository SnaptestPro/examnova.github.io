# 🏢 Owner Panel — Setup Guide

Ye guide bataata hai ki naya **Owner Panel** kaise activate karein.
Owner Panel ek naya, sabse upar ka role hai:

| Role  | Kaun | Kya kar sakta hai |
|-------|------|--------------------|
| **Owner** | Aap (product/company ke maalik) — sirf ek email | Dekh sakta hai ki kitne institutes hain, har ek ka admin kaun hai; naya institute+admin add karna; kisi admin ka access disable/enable karna; kisi admin ka record remove karna; kisi admin ko password-reset email bhejna |
| **Admin** | Har coaching institute ka apna alag admin | Sirf apna login use karke Tests/Question Bank/Records/OMR/Exam Manager chalata hai (jaisa pehle se tha) |

---

## 1) Owner email — already set ✅

`firestore.rules` mein `isOwner()` function ab pehle se hi aapke email
ke saath set hai:

```
function isOwner() {
  return request.auth != null &&
    request.auth.token.email != null &&
    request.auth.token.email == "vishnu1234stm@gmail.com";
}
```

Bas isse Firebase Console → Firestore Database → Rules mein paste
karke **Publish** karna hai (ya `firebase deploy --only
firestore:rules` CLI se, agar aap CLI use karte hain) — tabhi ye
active hoga.

## 2) Apna Owner account banayein

Firebase Console → **Authentication → Users → Add user** mein:

- Email: `vishnu1234stm@gmail.com`
- Password: `thevishnusharma`

daal ke account bana lein. (Security ke liye baad mein Owner Panel se
login karke ye password khud change kar sakte hain — Firebase
Console mein user ka password edit karne ka option bhi hai.)

⚠️ Ek baar app live/public ho jaaye to `thevishnusharma` jaisa simple
password badal lena behtar rahega, kyunki ye Owner account hai — isi
se saare institutes ke admin control hote hain.

## 3) Owner Panel kholein

App mein `?owner=1` add karke URL kholein, jaise:

```
https://aapki-site.com/?owner=1
```

ya Admin Panel → **Settings** tab mein "🏢 Owner Panel Kholein" button
se. Apna Owner email + password se login karein.

---

## Ye kya-kya karta hai

- **+ Naya Institute** — institute ka naam daalke ek record banayein.
- **+ Admin Add Karein** (har institute card ke andar) — us institute
  ke liye admin ka email daalein. App khud:
  1. Uska Firestore admin-record bana deta hai (yehi record decide
     karta hai ki wo login karke Admin Panel access kar sake).
  2. Agar uska Firebase login account pehle se nahi hai, ek naya bana
     deta hai.
  3. Us email par ek **"apna password set karein"** link bhej deta
     hai — Owner ko kabhi bhi kisi ka password type/daalna nahi
     padta, na hi dekhna padta hai. Admin khud apne inbox se apna
     password set karta hai.
- **⛔ Disable / ✅ Enable** — ek click mein us admin ka access turant
  band/chालू ho jaata hai (poore app mein — Tests, Question Bank,
  Records, sab kuch), bina uska login account delete kiye.
- **🔑 Password Reset Email** — us admin ko dobara ek password-reset
  link bhej dijiye (jaise wo khud "Password bhool gaye" dabaata).
- **🗑️ Remove** (admin row) — us institute se admin ka record hata
  deta hai (access khatam ho jaata hai), lekin uska Firebase login
  account technically delete nahi hota (neeche Section "Full Delete"
  dekhein agar wahi bhi chahiye).
- **🗑️ Remove** (institute card) — poora institute record hata deta
  hai.

---

## ⚠️ Ek zaroori technical baat: "Disable" vs "Permanent Delete"

Firebase Authentication surakshit tareeke se design kiya gaya hai
taaki koi bhi (chahe Owner ho) client-side app se **kisi doosre ke
login account ko seedha delete ya uska password force-set** na kar
sake — asli password kabhi kisi ko dikhna nahi chahiye, aur account
delete karna ek "trusted server" (Firebase Admin SDK) se hi surakshit
hai, browser se nahi.

Isliye Owner Panel ke "Disable" button ne wahi practical result diya
hai jo "Delete" se chahiye — us admin ka access turant, poori tarah
band ho jaata hai (chahe uska login account technically abhi bhi
Firebase Authentication list mein dikhe). Zyada tar cases mein Disable
hi kaafi hai.

Agar aapko wākai **permanent account delete + Owner khud directly
naya password set kare** wala full control chahiye, uske liye ek
chhota **Cloud Function** deploy karna hoga (ye optional hai — code
neeche di gayi file mein taiyar hai):

### Optional: Full-control Cloud Function

`OWNER_CLOUD_FUNCTIONS_optional.js` file dekhein — usmein do functions
hain:
- `ownerDeleteAdminAuth` — kisi admin ka Firebase Auth account poori
  tarah delete karta hai.
- `ownerSetAdminPassword` — kisi admin ka password Owner ki taraf se
  seedha set kar deta hai.

Deploy karne ke steps:

1. Firebase CLI install karein: `npm install -g firebase-tools`
2. `firebase login`
3. Apne project folder mein: `firebase init functions` (existing
   project select karein, JavaScript chunein)
4. `OWNER_CLOUD_FUNCTIONS_optional.js` ka content
   `functions/index.js` mein paste karein.
5. `functions` folder mein: `npm install firebase-admin firebase-functions`
6. `firebase deploy --only functions`
7. Note: naye (2nd gen) Cloud Functions ke liye Firebase **Blaze
   (pay-as-you-go)** plan zaroori hai — free Spark plan par functions
   deploy nahi hote. In dono functions ka actual cost bahut kam hai
   (chhoti si admin-only calls), lekin billing account link karna
   zaroori hai.
8. Deploy hone ke baad, `owner-panel.js` mein diye gaye
   `ownerDeleteAdminAuth(email)` / `ownerSetAdminPassword(email, pass)`
   helper calls (comments mein already likhe hain) ko admin row ke
   buttons se jod dein.

Jab tak ye extra step nahi karte, **Disable / Password-Reset-Email**
wala tareeka hi use hoga — jo daily use ke liye poora kaam karta hai.
