# Admin Welcome banner par Institute ka naam (v24_18)

## Aapka ask
Admin login karta hai to "Welcome, Admin" generic dikhta hai — kis
institute ke roop mein login hua, ye kahin confirm nahi hota.

## Samjhne wali cheez
Is app mein admin apna institute manually "select" nahi karta — Owner
Panel se jab admin banaya jaata hai, tabhi uska email ek hi institute
se permanently bandh diya jaata hai (`admins/{email}.instituteId`).
Login karte hi app khud us email se uska institute resolve kar leta
hai (`resolveCurrentAdminInstitute()` — pehle se maujood tha) — isliye
ek dropdown/filter se "select karna" zaroori nahi (ek admin sirf apne
EK institute ka hi data dekh sakta hai, Firestore rules level par bhi
enforce hai).

Jo cheez missing thi wo sirf **confirmation/visibility** — ki login ke
baad turant pata chale "maine sahi institute ke roop mein login kiya
hai ya nahi".

## Fix
`script.js` mein login/panel-open hone ke turant baad ab "Welcome,
Admin 👋" ki jagah **"Welcome, <Institute ka naam> 👋"** dikhta hai.
Naam `institutes/{instituteId}.name` se aata hai (Owner Panel mein
jo naam dikhta hai, wahi) — agar kisi wajah se wo na mil paaye
(offline waghera), admin ke apne record mein stamped naam fallback
ke roop mein use hota hai.

Isse agar kisi galat/dusre institute ke roop mein login ho jaaye (jo
normally hona hi nahi chahiye, par confirm karne ke liye), turant
pehli nazar mein pata chal jayega.

Koi rules change nahi — sirf JS. `sw.js` cache version bhi bump kar
diya hai (v89 → v90).
