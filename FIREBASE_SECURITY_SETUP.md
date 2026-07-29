# 🔒 Security Setup — Zaroori Steps (ek baar karne hain)

Maine code mein secure admin login aur Firestore rules laga diye hain,
lekin **Firebase Console mein 3 chhote steps khud karne honge** —
ye main nahi kar sakta kyunki inke liye aapke Firebase project ka
access chahiye.

Project: `the-vishnu-sharma-test` → https://console.firebase.google.com/project/the-vishnu-sharma-test

---

## Step 1 — Authentication providers ON karein

Firebase Console → **Authentication** → **Sign-in method** tab:

1. **Anonymous** → Enable karein.
   (Isse har visitor/student ko silently ek session mil jaata hai,
   taaki Firestore rules kaam kar sakein — students ko kuch alag
   se dikhega nahi, sab kuch pehle jaisa hi chalega.)
2. **Email/Password** → Enable karein.
   (Ye asli admin login ke liye hai.)

---

## Step 2 — Firestore Rules deploy karein

1. Firebase Console → **Firestore Database** → **Rules** tab.
2. Is zip mein di gayi `firestore.rules` file kholiye.
3. Us file ke andar ye line dhoondhiye:

   ```
   "REPLACE_WITH_YOUR_ADMIN_EMAIL@example.com"
   ```

   Isse apni **asli admin email** se replace karein (jo email aap
   Step 3 mein admin login ke waqt use karenge). Jaise:

   ```
   "vishnusharma123@gmail.com"
   ```

   Agar ek se zyada admin chahiye, to comma se aur emails add kar
   sakte hain:

   ```
   request.auth.token.email in [
     "vishnusharma123@gmail.com",
     "second-admin@gmail.com"
   ]
   ```

4. Poori file copy karke Firebase Console ke Rules editor mein paste
   karein, aur **Publish** dabayein.

⚠️ **Jab tak ye step nahi karenge, admin panel se koi bhi likhna/delete
karna fail hoga** (kyunki koi bhi email allow-list mein nahi hoga).
Students ka experience (register/login/test dena) bina kisi step ke
turant kaam karega — sirf admin write ke liye ye zaroori hai.

---

## Step 3 — Pehli baar admin login (auto-migration)

1. App kholein → Admin tab → same purana **Admin ID: `thevishnusharma`**
   aur password **`@admin`** daal kar login try karein (agar aapne
   pehle se naya password set nahi kiya hai).
2. App aapse aapka **asli email address** aur ek **naya strong
   password** poochhega — daal dein.
3. Isse ek real, secure Firebase account ban jaayega.
4. Wahi email jo abhi diya, use Step 2 ki `firestore.rules` file mein
   bhi daal kar dobara Publish karna na bhoolein (agar pehle nahi
   kiya tha).
5. Agli baar se seedha us email + password se login hoga (Admin ID
   field mein email hi daalein).

Agar aapne pehle hi custom password set kar rakha tha (legacy hash
wala), to ussi purane Admin ID/password se ek baar login try karein —
system automatically migration wala prompt dikhayega.

---

## "Password bhool gaye" ab kaise kaam karta hai

Pehle ek custom "security sawaal" system tha jo khud Firestore mein
store hota tha (asurakshit). Ab **real Firebase email link** se
reset hota hai:

- Login screen par **"🔑 Password bhool gaye?"** dabayein.
- Apna admin email daalein.
- Firebase khud us email par ek reset link bhejta hai — spam folder
  bhi check karein.

Isliye Step 3 mein **sahi, real email** (jise aap access kar sakte
hain) daalna zaroori hai.

---

## Kya-kya secure ho gaya

| Pehle | Ab |
|---|---|
| Admin password ek custom SHA-256 hash tha, Firestore mein open rules ke bharose store | Real Firebase Authentication (Google-grade secure) |
| Koi bhi Firestore access karke admin password hash chura sakta tha | Password kabhi Firestore mein store hi nahi hota |
| `question-generator.html` tool bina kisi login ke public tha — koi bhi seedha question bank likh sakta tha ya Groq AI key dekh sakta tha | Ab login-gate laga hai, aur `app_settings` (jahan Groq key hai) sirf admin-email padh/likh sakta hai |
| Firestore rules ka koi record nahi tha app mein (matlab "test mode" open rules par chal raha tha — koi bhi internet se sab data padh/likh/delete kar sakta tha) | `firestore.rules` file mein har collection explicitly secure — delete sirf admin kar sakta hai, baaki sab jagah default-deny |
| Students ka data (mobile+password) koi bhi bina app kholे seedha script se access kar sakta tha | Ab kam se kam signed-in (anonymous bhi) hona zaroori hai |

---

## 🆕 Update: Student "Forgot Password" account-takeover fix

**Problem jo mila:** Student ka "Password bhool gaye" flow sirf mobile
number maangta tha — matlab jis kisi ko bhi ek student ka mobile
number pata ho (classmate, group mein share hua number, etc.), wo
uska password reset karke uska account access kar sakta tha.

**Fix:** Ab registration ke waqt ek **4-digit Security PIN** bhi set
karna zaroori hai. "Password bhool gaye" flow ab mobile number ke
saath ye PIN bhi maangega — sirf sahi student ko hi ye pata hoga.

- **Naye students:** Registration form mein PIN field already hai.
- **Purane (pehle se registered) students:** Agli baar jab wo apne
  asli password se normal LOGIN karenge, app khud unse ek PIN set
  karwa lega (ek chhota popup aayega). Tab tak unka "forgot password"
  kaam nahi karega — ye jaan-boojh kar hai, taaki koi is gap ka
  fayda na utha sake.
- **Agar koi student password + PIN dono bhool jaaye:** Admin panel
  ke **Records tab** mein ek naya **"🔑 Student Password Reset
  (Admin)"** box hai — mobile number + naya password daal kar admin
  seedha reset kar sakta hai (student ki identity WhatsApp/class mein
  confirm karne ke baad hi use karein).

⚠️ **Honest note:** Ye PIN system casual/manual misuse (jaise koi
classmate seedha website use karke try kare) ko rok deta hai. Lekin
agar koi technically-skilled attacker seedha Firestore API par script
se hit kare (browser use kiye bina), to theoretically wo PIN check
bypass kar sakta hai, kyunki asli verification client-side JS mein
hoti hai, rules mein nahi (rules ke paas plaintext PIN verify karne
ka koi tarika nahi hai bina backend/Cloud Function ke). Agar 100%
bulletproof chahiye (jaise bank-grade), to sahi tareeka hai **Firebase
Phone Authentication** (real SMS OTP) implement karna — usme thoda
extra setup aur Firebase ka paid "Blaze" plan chahiye hota hai (SMS
bhejne ke liye). Agar ye chahiye to bata dena, alag se implement kar
sakte hain.

## Data-loss se extra bachaav (recommended, optional)

Firestore rules delete ko admin tak seemit kar dete hain, lekin agar
chahte hain ki galti se admin bhi kuch delete kar de to bhi wapas mil
jaaye, to Google Cloud Console mein **scheduled Firestore export/backup**
on karna recommend karta hoon:

Cloud Console → Firestore → Backups → "Create backup schedule"
(daily backup, project ke Blaze/pay-as-you-go plan par available hai,
free tier mein bhi bahut kam cost aata hai chhoti si app ke liye).

Ye step optional hai lekin agar "data loss bilkul nahi hona chahiye"
priority hai to sabse strong extra safety net yahi hai.
