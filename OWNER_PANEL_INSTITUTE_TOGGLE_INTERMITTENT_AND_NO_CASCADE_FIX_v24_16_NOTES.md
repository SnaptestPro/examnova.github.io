# Owner Panel: Institute Activate/Deactivate intermittent error + no auto-logout (v24_16)

Aapne 3 problem bataye the:
1. Institute card ka "Activate"/"Deactivate" button kabhi kaam karta hai,
   kabhi "Missing or insufficient permissions" de deta hai.
2. Kabhi Deactivate hi nahi hota.
3. Deactivate hone ke baad, agar wo institute ka admin us waqt app use kar
   raha ho, to wo automatically logout nahi hota.

Maine `firestore.rules` compare kiya jo aapne chat mein paste kiya tha — wo
is zip ki purani `firestore.rules` se **character-by-character identical**
nikla. Matlab aapka publish sahi tha; ye "purani rules file" wala issue
nahi tha. Do asli bug mile:

## Bug A — Institute Deactivate kabhi kaam karta hai kabhi nahi
`ownerToggleInstitute()` ka write sirf `isOwner()` par depend karta hai
(sirf email match, koi extra lookup nahi) — isliye normally ye
deterministic hona chahiye: ya to hamesha chalega ya kabhi nahi. Intermittent
hona iska matlab hai ki us waqt Firestore ke paas aapka **stale/expired ID
token** tha (Firebase Auth session sahi tha, par token cache purana ho gaya
tha — tab bahut der khula rehne ya laptop/phone sleep se wapas aane par ye
ho sakta hai).

### Fix
`owner-panel.js` mein ab har Owner-write (Institute Activate/Deactivate,
Admin Enable/Disable) `permission-denied` milte hi khud-ba-khud **ek baar
token force-refresh karke retry** karta hai, isse pehle user ko error
dikhaye. Agar retry ke baad bhi fail ho, to ab error message mein ye bhi
dikhega ki us waqt Firestore ke hisaab se aap kis email se (ya anonymous,
ya bilkul signed-out) the — isse agli baar aisa hua to turant pata chal
jayega ki asli wajah kya hai.

## Bug B — Deactivate hone par admin turant logout nahi hota (asli root cause)
Ye code bug nahi, **rules ka gap** tha: `isAdmin()` sirf admin ke apne
`admins/{email}` doc ka `active` field check karta tha — `institutes/{id}`
ka `active` field kabhi check hi nahi hota tha. Matlab Owner Panel se
poora **institute** deactivate karne ka us institute ke admin ke asli
Firestore access par **koi asar hi nahi padta tha** — wo admin poora
kaam karta reh sakta tha, real-time force-logout bhi trigger nahi hota
(kyunki wo sirf admin-doc ke permission-denied par depend karta hai,
`script.js` ka `watchAdminActiveStatus()`).

### Fix
`firestore.rules` mein `isAdmin()` ab admin ke apne institute ka `active`
status bhi check karta hai (naya helper `adminInstituteActive()`). Isse:
- Institute Deactivate karte hi us institute ke saare admins ka har
  Firestore access turant deny ho jaata hai.
- **Koi JS change zaroori nahi thi** iske liye — kyunki `admins/{email}`
  ka self-read rule pehle se hi `isAdmin()` par depend karta hai, aur
  `script.js` ka real-time watcher pehle se hi "is doc ka permission-denied
  = deactivated, force logout karo" treat karta hai. Institute-inactive
  hote hi `isAdmin()` false ho jaata hai → self-read permission-denied →
  automatic force-logout apne aap trigger ho jaata hai.
- Institute **delete/remove** (jaisa pehle se tha) admin ko block nahi
  karta — sirf explicit Deactivate karta hai. Ye jaan-boojh kar rakha hai
  (documented behavior already).

⚠️ **Zaroori step**: `firestore.rules` change hui hai, isliye Firebase
Console → Firestore Database → Rules tab → is zip ki `firestore.rules`
poori copy-paste karke **Publish** zaroor karein.

`sw.js` cache version bhi bump kar diya hai (v87 → v88) taaki already-
installed app par ye fix turant mile.
