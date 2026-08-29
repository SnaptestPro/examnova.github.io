# Install-App Popup — 24h Cooldown Fix

## Bug report
"Laptop pe Exam Manager ke 'Naya Exam Banayein' / 'Purane Publish Kiye Tests
Ko Sync Karein' buttons click karne par kuch nahi hota. Phone pe theek chalta
hai."

## Root cause (confirmed via headless-browser reproduction)
Ye code bug nahi tha — ye ek pehle se maujood **intentional** feature ka
side-effect nikla:

- `index.html` mein ek "📲 App Install Karein" popup (`#app-install-modal`)
  hai jo `position:fixed; inset:0; z-index:9999` ke saath **poori screen**
  cover kar leta hai.
- Ye popup `DOMContentLoaded` par turant khud khul jaata tha
  (`if (!isStandaloneMode()) showAppInstallModal();`), **har single
  page-load par**, jab tak app installed (standalone mode) na ho.
- Jab tak is popup ko "Baad Mein" ya "Install Karein" dabakar band na karo,
  neeche kuch bhi click nahi hota — Admin tab tak nahi (poori header bhi
  isi overlay ke neeche dab jaati hai).
- Phone par kaam isliye "theek" lagta tha kyunki wahan app pehle se
  home-screen se installed hai → `isStandaloneMode()` true → popup kabhi
  aata hi nahi.
- Laptop par (normal browser tab, not installed) → popup har reload par
  aata → jab tak dismiss na karo, **koi bhi button** (sirf Exam Manager ke
  nahi, sabhi) "kaam nahi karta" jaisa mehsoos hota hai.

Verified via a scripted headless-browser click: `page.click()` on the
"+ Naya Exam Banayein" button timed out (blocked) while the popup was open,
and succeeded immediately once the popup was dismissed — confirming the
overlay, not the button's own code, was the actual blocker.

## Fix applied
Vishnu's choice: **popup sirf 24 ghante mein ek baar dikhe, baar-baar reload
par nahi** — manual "⬇️ App Install Karein" header button hamesha turant
kaam karega (cooldown se unaffected), sirf **auto**-show (page-load wala)
gated hai.

`index.html`:
- Do naye constants: `INSTALL_POPUP_LAST_SHOWN_KEY` (localStorage key) aur
  `INSTALL_POPUP_COOLDOWN_MS` (24 * 60 * 60 * 1000).
- `showAppInstallModal()` ke end mein, jab bhi modal *actually* dikhta hai
  (chahe auto ho ya manual header-button se), `localStorage` mein
  `Date.now()` timestamp save hota hai.
- `DOMContentLoaded` wale auto-trigger block mein, ab `showAppInstallModal()`
  call karne se pehle check hota hai: last-shown se 24 ghante ho chuke hain
  ya nahi. Agar nahi ho chuke, popup is baar skip ho jaata hai.
- `beforeinstallprompt` listener wala "already-open modal ko upgrade karo"
  logic untouched hai — wo sirf tab chalta hai jab modal *already* khula ho.

## Verified (headless browser, 3 sequential loads in same context)
1. Fresh load (no localStorage) → popup shows. ✅
2. Immediate reload (within cooldown) → popup stays hidden, Exam Manager
   button click succeeds **without needing to dismiss anything**. ✅
3. localStorage timestamp backdated 25h → popup shows again on next load. ✅

All pre-existing `test_*.js` files (detection algo, exposure threshold,
multi-mark grading, homography, temporal smoothing, warp fusion/integration,
local registration v16) still pass unchanged — this fix only touches the
install-popup script block in `index.html`, nothing scan/grading-related.

## Note for Vishnu
Testing/refreshing baar-baar karte waqt is se agla farak padega: ab
`localStorage` clear na karo to popup baar-baar nahi aayega. Agar kabhi
turant popup dekhna ho (testing ke liye), header ke "⬇️ App Install Karein"
button (jab visible ho) ya browser console mein
`localStorage.removeItem('savya_install_popup_last_shown')` chala kar reload
karo.
