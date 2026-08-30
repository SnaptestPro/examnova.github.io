# Owner Panel session isolated from Admin Panel (v24_17)

Aapke screenshot ne exact confirm kar diya: error ke saath ab ye bhi
dikha —
> Us waqt sign-in tha: vks1234stm@gmail.com

Matlab jab aapne institute Deactivate dabaya, Firestore ke hisaab se
aap Owner (vishnu1234stm@gmail.com) nahi, balki ek **admin account**
(vks1234stm@gmail.com) ke roop mein sign-in the.

## Asli wajah
Owner Panel aur Admin Panel dono isi ek hi page/origin par hain, aur
pehle dono ek hi shared Firebase Auth session (`window.vishnuFirebase.auth`)
use karte the. Firebase Auth ke ek app instance mein ek waqt sirf EK hi
"currentUser" ho sakta hai. Isliye agar isi browser mein (chahe kisi
doosre tab mein bhi) Admin Panel se `vks1234stm@gmail.com` login hota
tha, to wo owner ke session ko **silently overwrite** kar deta tha.
Owner Panel ka UI khula/cached rehta tha (isliye kuch galat nahi lagta
tha), lekin uske baad har write asal mein us admin ke naam se jaati thi
— isliye "Missing or insufficient permissions".

## Fix
Owner Panel ab apna ek bilkul ALAG, isolated Firebase session use karta
hai (`owner-panel.js` mein naya `ownerEnsureApp()` — ek dedicated
secondary Firebase App instance, apna khud ka Auth + Firestore ke
saath). Ye wahi trick hai jo "Add Admin" wala code pehle se (temporarily)
use karta tha naya admin account banane ke liye, taaki owner ka apna
session disturb na ho — ab isi trick ko poori Owner session ke liye
persistent bana diya hai.

Isse ab: isi browser mein Admin Panel se koi bhi login/logout ho, Owner
Panel ka session bilkul untouched rehta hai — dono completely independent
ho gaye hain.

Extra safety: Owner Panel overlay ab dobara open hote waqt sirf itna
nahi dekhta ki "koi bhi signed in hai", balki ye bhi check karta hai ki
signed-in email wahi hai jo aapne pehle Owner ke roop mein login kiya
tha.

## Zaroori step
Sirf JS change hai, `firestore.rules` is baar nahi badli — koi Firebase
Console publish step nahi chahiye is fix ke liye. Bas naya zip deploy
kar dein (aur `sw.js` cache version v88 → v89 bump kar diya hai, isliye
already-installed app par bhi fix turant milega).

## Test karne ka tarika
1. Naya zip deploy karein.
2. Owner Panel login karein.
3. Usi browser ke ek doosre tab mein (ya usi tab mein URL change karke)
   Admin Panel mein `vks1234stm@gmail.com` (ya koi bhi admin) se login
   karein.
4. Owner Panel wale tab mein wapas jaakar koi institute/admin
   Activate/Deactivate try karein — ab kaam karna chahiye, error nahi
   aani chahiye.
