# 🔔 Notifications — 100% Free Version

Koi setup nahi karna — ye already deploy karne layak hai, kuch kharcha nahi
aur koi card nahi lagti.

## Ye kaam kaise karta hai

Jab Admin (ya Question Generator se) koi test **publish** karta hai, jitne
bhi students ka app us waqt **khula** hai (chahe background tab ho), unko
turant ek notification dikhti hai — bina kisi server ke, sirf app ke apne
already-existing real-time Firestore listener (`syncTests()`) ke through.

Student ki taraf se:
- **Settings** mein "🔔 Notifications" **default se ON** hai.
- Login karte hi browser permission apne aap maang li jaati hai.
- Agar student chahe to Settings se Off/On kar sakta hai.

## ⚠️ Ek limitation (free rehne ka trade-off)

Ye **asli push nahi hai** — matlab agar student ne app/tab **poori tarah
band** kar rakha hai (ya phone ka browser fully close/kill kar diya hai),
to notification nahi milegi. Notification sirf tab milegi jab app kisi
bhi tarah khula/background mein ho.

Isse behtar (app band ho tab bhi kaam kare) ke liye Firebase Cloud
Function + FCM chahiye hoga, jiske liye Blaze (billing) plan zaroori hai —
chahe usage free tier mein hi rahe, Google phir bhi card maangta hai.
Filhaal aapne bina-card wala free version chuna hai, isliye ye feature
skip kar diya gaya hai.

Agar future mein kabhi "app band ho tab bhi" wala asli push chahiye ho,
bata dijiyega — us waqt Cloud Function wala scaffold dobara bana denge.

## Test kaise karein

1. Do browser tabs kholein — ek mein Admin panel se login, doosre mein
   Student account se login (ya do alag devices use karein).
2. Student tab mein Settings mein jaakar notification permission "Allow"
   karein.
3. Admin tab se koi naya test publish karein.
4. Student tab (chahe background mein ho) mein turant banner + browser
   notification dikhni chahiye.
