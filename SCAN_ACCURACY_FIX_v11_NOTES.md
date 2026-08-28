# Scan Accuracy Fix — v9 (multi-mark + partial-fill + local shadow)

Aapne teen problems batayi thi (screenshot ke saath), teeno ka code mein
exact reason mila — sab `exam-manager.js` ke bubble-reading section mein.

## 1. Multiple-answer detect nahi ho raha tha
`pickBest()` sirf sabse dark bubble uthata tha aur usko "the answer" bana
deta tha. Doosra bhi genuinely dark bubble ho, code check hi nahi karta
tha — `margin` variable calculate hota tha par kahin use hi nahi hota
tha. Matlab do options bhare ho tab bhi sirf ek option "detected answer"
ban jata tha, jaise sirf ek hi bhara ho.

**Fix:** ab har candidate apne threshold pe check hota hai. Agar 2+
bubbles genuinely dark nikle, question ko `"multiple"` status milta hai
(wrong count mein jata hai, jaisa real OMR machine karti hai), aur scan
photo pe **dono/saare marked bubbles pe red dot** dikhta hai — aap turant
dekh sakte ho konse question mein double-fill hua.

## 2. Halka/adhura bhara bubble (Q20, 21, 23 jaisa) miss ho raha tha
Purana code bubble ke pure 10px circle ka 40th-percentile darkness
dekhta tha. Agar student ne circle ke sirf beech mein ek chota dot/tick
lagaya (poora shade nahi kiya), to us chote dot ka area 10px wale circle
ke 40% se kam padta hai — isliye wide sample "blank" padh leta tha.

**Fix:** ab ek dusra, tighter 5px sample bhi center pe liya jata hai.
Agar center solid dark hai (chahe bahar ka ring khali ho), wo bhi
"marked" count hota hai — thoda strict threshold ke saath, taaki koi
random halka shadow isse trigger na kare.

## 3. Q94 jisme kuch bhara hi nahi tha, phir bhi mark dikha
Photo ka white-paper "baseline" 5×7 bade grid blocks mein measure hota
tha. Aapki sheet mein beech mein ek crease/tear hai (photo mein saaf
dikh raha hai) — us jagah paper ka lighting alag hai, aur bada grid block
us local variation ko dilute nahi kar paata, so kisi paas ke blank bubble
ka "diff from white" galti se threshold cross kar jata hai.

**Fix:** grid ab 8×11 (zyada fine-grained) hai, taaki local shadow/crease
ek chhota area tak hi limited rahe, poore block ka baseline na bigade.

## v10 — pushed further (multi-frame averaging + confidence flag)

Do aur cheezein add ki hain jo directly overall accuracy badhati hain:

**1. Multi-frame pixel averaging (sabse bada change).** Pehle sirf corner
positions ka average hota tha (geometry ke liye), par bubble ki actual
darkness sirf EK video frame se aati thi — jisme camera sensor noise ya
halka motion-blur ho sakta hai. Ab jab tak sheet "steady" hoti hai, har
~130ms pe poora frame bhi save hota hai (apne khud ke corner-quad ke
saath), aur capture ke time pe un sab (typically 4) frames ko alag-alag
warp karke unki grayscale values ka average liya jata hai. Yeh bilkul
waisa hi hai jaise multiple photos click karke unhe combine karna — real
noise cancel hota hai, ek single "lucky/unlucky" frame pe dependency
khatam ho jati hai.

**2. Low-confidence warning ring.** Koi bhi threshold-based system kabhi
bhi literally 100% guarantee nahi de sakta — ek mark threshold ke bilkul
paas ho sakta hai. Ab jo bhi detected mark apne threshold ko sirf thoda
sa hi cross karta hai, uske around ek patli **orange ring** dikhti hai
scan photo pe. Baaki sab (confidently dark marks) plain green/red
rehte hain. Isse aap khaas un questions ko ek nazar de sakte ho jahan
call genuinely close thi — bina har question manually check kiye.

## v11 — photo quality gate (reject bad captures at the source)

Sabse bada insight: koi bhi scoring/threshold tuning ek genuinely kharab
photo (dhundhli, andheri, ya glare-wash-out) ko bacha nahi sakti. App mein
pehle se ek accha, tuned quality-check (`assessPhotoQuality`) mojood tha
— par sirf purane upload-wale scanner (`omr.js`) mein, naye live-camera
"Scan Sheet" flow mein wo istemal hi nahi ho raha tha.

**Fix:** wahi check (blur / darkness / glare) ab live scan mein bhi lagta
hai — averaged photo banne ke turant baad, review dikhane se pehle. Agar
photo kharab nikli (dhundhli/andheri/glare), capture reject ho jata hai
aur camera live detection loop khud-ba-khud chalta rehta hai — student ki
photo grade hi nahi hoti jab tak ek theek-thaak clear photo na mil jaye.
Isse woh sabse aam wajah (kharab source photo) hi khatam ho jaati hai
jisse zyada tar galat reads aate hain.

Saath hi averaging window 4 → 6 frames kar diya (jitna time app pehle se
"steady" hone ka wait kar raha tha, utna hi — sirf ab un saare frames ka
istemal ho raha hai, sirf aakhri 4 ka nahi).

## Honesty note
Fix #2 aur #3 dono statistical hain — real photos pe dobara test zaroor
karein (kuch tilted/creased sheets ke saath). Agar Q20/21/23-jaisa case
ab bhi miss ho ya koi naya false-positive aaye, screenshot ke saath batao
— threshold values (`EG_MARK_THRESHOLD`, `EG_CORE_MARK_THRESHOLD`) aur
tune ho sakte hain.
