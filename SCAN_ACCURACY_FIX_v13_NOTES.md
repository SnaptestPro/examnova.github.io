# Scan Accuracy Fix — v13.1 (blurry/washed-out captured photo)

Aapne bataya: scan complete hone ke baad jo OMR photo capture hoti hai
uski quality bahut ghatiya (dhundhli/washed-out) ho jati hai, aur usi
wajah se OMR checking mein bhi galtiyan aati hain (Roll No har frame
mein alag padhta hai, kai jagah galat bubble pe red dot). Dono ka
exact ek hi root cause mila — `exam-manager.js` ke corner-detection
loop mein.

## Root cause

v11 ("fast scan") mein speed ke liye poora video frame chhota karke
(max 600px chauda) ek "analysis canvas" pe corner-squares dhoondhe
jaate the. Comment tha ki isse precision pe "negligible effect"
padega kyunki final photo to full-resolution video frame se hi banti
hai — yeh apne aap mein sahi tha, par ek cheez miss ho gayi: jo
CORNER POSITIONS is chhote frame se milte the, wahi baad mein
full-res frame ko warp karne ke liye use hote the.

Ek phone camera ka frame typically ~2000-2400px chauda hota hai. Use
600px tak chhota karne ka matlab: analysis image ka 1 pixel = real
video ke ~3-4 pixels. Matlab corner ki position sirf un ~3-4px ke
"steps" mein hi report ho sakti thi — bhale hi sheet bilkul steady ho,
alag-alag frame mein corner ka reading kabhi 2px idhar, kabhi 3px udhar
round ho jata tha.

Yeh chhota-sa rounding v10 ke multi-frame averaging (`captureAlignedOmr`)
ke saath mil kar bada problem ban gaya: capture ke time app 6 alag
video frames ko unke APNE corner-quad se warp karke unki pixel values
average karta hai (noise cancel karne ke liye). Par agar un 6 quads
mein khud hi 2-4px ka random jitter ho (real hand-movement se nahi,
sirf rounding se), to 6 warped images ek-doosre se thoda misaligned ho
jaati hain. Misaligned images ko average karna hamesha blur/haze paida
karta hai — har bubble ka outline, har bhara hua mark, Roll No ka har
digit thoda-thoda "smear" ho jata hai. Chunki grading aur Roll No OCR
dono isi averaged photo se padhte hain, checking ki galtiyan bhi wahi
se aa rahi thi.

## Fix

Ab poore frame ko chhota nahi kiya jata. Har corner ke liye sirf uska
chhota box region seedha FULL-RESOLUTION video se crop hota hai
(1:1 scale, koi downscale nahi), aur usi crop pe square dhoonda jata
hai. Kaam utna hi (chhota region) hai jitna pehle tha — bas ab pixel
data pehle se chhota nahi kiya jata, isliye corner position full pixel
precision pe milti hai, koi rounding-jitter nahi. Isse:

- Multi-frame averaging ab genuinely well-aligned frames average karta
  hai → captured photo sharp/crisp rehti hai (blur/haze khatam).
- Roll No OCR aur bubble-darkness checking dono isi sharp photo se
  padhte hain → flickering Roll No aur galat red-dot detections bhi
  saath mein fix ho jaate hain.
- Speed pe koi meaningful farak nahi — total pixel work same hai, sirf
  full resolution pe.

## Honesty note

Yeh fix root cause (misaligned multi-frame average) theek karta hai,
par real duniya mein bahut zyada haath-hilna (genuine motion blur) ab
bhi ek genuinely kharab photo de sakta hai — us case mein `v11`-wala
quality gate (`assessPhotoQuality`) already usse reject kar dega aur
dobara try karwayega. Real sheets pe (khaas kar low-light ya bahut
tilt-wale attempts) dobara test karke confirm karein ki photo ab sharp
aa rahi hai; agar phir bhi haze dikhe to screenshot/video ke saath
batao.
