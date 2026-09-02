# Student Multi-Tenant Isolation + Admin False-Deactivation Fix (v30)

Aapne 2 cheezein bataayin — dono fix ho gayi.

## 1️⃣ Student ko sirf apne coaching ka data dikhna chahiye

Yahan 2 alag jagah bug tha — **student ko doosre institutes ke tests
aur unka leaderboard dikh raha tha**:

### a) Test List — sabse bada bug
`renderStudentTestCards()` (jo student ko "available tests" dikhata
hai) mein **koi institute filter tha hi nahi** — sirf `!isDraft` check
tha. Matlab **har student, kisi bhi coaching ka bana hua koi bhi
published test dekh sakta tha aur de sakta tha**, chahe wo test kisi
bilkul alag institute ke admin ne banaya ho.

**Fix:** ab sirf student ke APNE institute ke tests hi dikhte hain.

**Bonus (defense-in-depth):** sirf list se hataana kaafi nahi tha —
agar koi student seedha testId jaan kar (jaise browser console se)
test start karne ki koshish karta, to bhi rok nahi tha. Ab actual
"test start karo" wale function mein bhi wahi institute-check hai,
list ke alawa.

### b) Top Performers / Podium
Student ke dashboard ka "🏆 Top Performers" podium **poori site ka**
(sabhi institutes ke students milaakar) leaderboard dikhata tha — jab
ki Admin ke apne "Top Performers" tab mein pehle se hi apna-institute
filter tha (ye asymmetry khud comment mein documented thi). Matlab
kisi bilkul doosre coaching ka topper student ke apne podium mein
"top performer" dikh sakta tha.

**Fix:** ab student ka podium bhi sirf apne institute ke students/
tests tak scoped hai.

### Ye kaise kaam karta hai (thoda technical)
Student ka apna `instituteId` ab login/register ke time session mein
cache ho jaata hai. **Purane (is fix se pehle ke) logged-in students**
ke session mein ye nahi hoga — unke liye pehli baar app kholne par
ek chhota, one-time Firestore read hota hai (sirf apna hi record),
jo turant session mein cache ho jaata hai — uske baad se instant hai,
koi extra load nahi.

⚠️ **Zaroori:** jab tak institute pata nahi chal jaata, test list aur
podium **khaali/"Loading..."** dikhate hain (kabhi bhi galti se kisi
aur institute ka data ek pal ke liye bhi flash nahi hota) — phir turant
sahi data aa jaata hai.

## 2️⃣ Admin ka "Deactivated" false-alarm — FIX

**Asli wajah mil gayi:** Firebase ka offline-storage feature
(`enablePersistence`) is app mein already ON hai (achhi cheez —
internet jaane par bhi kaam karta rehta hai). Lekin iska side-effect:
jab bhi koi real-time listener (`onSnapshot`) start hota hai, Firestore
**sabse pehle turant purana LOCAL (cached) data deta hai**, aur uske
kuch der baad hi asli, FRESH server data aata hai.

Isliye scenario ye tha: Owner ne kabhi aapko deactivate/delete kiya →
phir kuch samay baad dobara activate/add kiya → jab aap login karte,
login khud to sahi se ho jaata (fresh check), LEKIN uske turant baad
jo real-time "kahin deactivate to nahi ho gaye" watcher start hota hai,
wo pehle is browser ka PURANA (deactivate wale time ka) cached data
dikha deta — aur turant (galti se) **logout + "Deactivated" alert**
kar deta, server ka sahi (active) data aane se PEHLE hi.

**Fix:** ab ye watcher purana (cached) data par koi bhi faisla nahi
leta — sirf tabhi react karta hai jab Firestore SERVER se confirm
ho chuka ho. Matlab agar aap genuinely active hain, ye false alarm
ab kabhi nahi aayega. (Agar aap genuinely deactivate hain, to bhi
detect ekdum turant hi hoga — server confirmation aane mein normally
sirf ek-do second lagte hain jab internet chalu ho.)

## Files changed
`script.js`, `student-features.js`

## ⚠️ Deploy se pehle
1. `firebase deploy`
2. Ek naya student ka test/podium check karna, aur ek PURANE (pehle se
   logged-in) student ka bhi — dono ko sirf apna institute dikhna
   chahiye.
3. Kisi admin ko deactivate → reactivate karke check karna ki login
   par ab false "deactivated" message nahi aata.
