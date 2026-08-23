# 🔔 Push Notifications — Setup Guide

Ye feature 2 hisson mein bana hai:

1. **Client side (already ho chuka hai, file mein hai):** `push-notifications.js`,
   `sw.js` ke `push`/`notificationclick` handlers, aur Student Settings mein
   "🔔 Notifications" toggle. **Default se ON hai** — jaise hi koi student
   login karta hai, browser permission apne aap maang li jaati hai (student
   ko button dabana nahi padta); agar student manually "Off" karega tabhi
   dobara auto-on nahi hoga.
2. **Server side (aapko 1 baar setup karna hai):** `functions/index.js` — jo
   asli notification *bhejta* hai jab koi naya test publish hota hai. Iske
   bina button "not set up yet" dikhayega aur kuch nahi bhejega — client-side
   koi doosre device ko push nahi kar sakta, sirf ek server (Cloud Function)
   kar sakta hai.

Neeche dono steps hain — sirf ek baar karne hain.

---

## Step 1 — VAPID Key nikalein (Firebase Console)

1. [Firebase Console](https://console.firebase.google.com) → apna project kholein.
2. ⚙️ **Project Settings** → **Cloud Messaging** tab.
3. Neeche "**Web Push certificates**" section mein "**Generate key pair**" button dabayein.
4. Jo key generate ho, use copy karein.
5. `push-notifications.js` file kholein, sabse upar ye line dhoondhein:
   ```js
   const VAPID_KEY = "";
   ```
   Aur usme apni copy ki hui key paste kar dein:
   ```js
   const VAPID_KEY = "BN....(aapki key)....";
   ```

---

## Step 2 — Blaze Plan par upgrade karein

Cloud Functions (jo asli notification bhejta hai) sirf **Blaze (pay-as-you-go)**
plan par chalta hai — free "Spark" plan par nahi. Chinta na karein: is chhoti si
app ke liye monthly cost lagbhag ₹0-₹5 ke aas-paas hi rahegi (Google ka free
tier hi zyada tar use cover kar leta hai). Firebase Console mein neeche-left
"⚙️ Upgrade" ya "Modify plan" se Blaze select karein.

---

## Step 3 — Firebase CLI install + deploy

Apne computer par (jahan ye project files hain) terminal kholein:

```bash
npm install -g firebase-tools     # agar pehli baar hai
firebase login                    # apne Google account se login karein
cd /path/to/is-project-ka-folder
firebase deploy --only functions
```

Deploy hone mein 1-2 minute lagenge. Deploy hone ke baad, jab bhi Admin Panel
ya Question Generator se koi test **publish** hoga (draft se live), ye function
apne aap chal kar sabhi registered students ko push notification bhej dega.

---

## Step 4 — Test karein

1. Apne site ko phir se deploy karein (`firebase deploy --only hosting`) taaki
   naya `push-notifications.js` VAPID key ke saath live ho jaaye.
2. Student account se login karein — **notifications default se ON hain**, to
   login karte hi browser permission popup aa jaayega, "Allow" kar dein.
   (Agar chahiye to Settings mein jaake off/on kiya ja sakta hai.)
3. Ab koi bhi naya test publish karein (Admin se ya Question Generator se
   "Save & Admin ko Bhejein" ke baad publish karke) → us student ke device
   par notification aani chahiye, chahe app band ho.

---

## Troubleshooting

- **Button "not set up yet" dikha raha hai** → Step 1 miss ho gaya, VAPID key
  daalna bhool gaye.
- **Permission maangte waqt kuch nahi hota** → Browser ne pehle se hi block
  kar rakha hoga; browser settings → site permissions → Notifications → Allow
  karein, phir dobara try karein.
- **Function deploy fail ho raha hai "Blaze plan required"** → Step 2 miss
  ho gaya.
- **Function deploy ho gaya, phir bhi notification nahi aa raha** → Firebase
  Console → Functions tab → Logs check karein; wahan `[push]` prefix wale
  logs dikhenge jo batayenge kitne devices ko bheja gaya / koi error hai kya.
