# Google Search Console Verification — v36

## Kya kiya
Aapne Google Search Console me `examnova.github.io` ko URL-prefix property ke roop me add kiya aur verification ke liye ek HTML meta tag diya tha. Wahi tag `index.html` ke `<head>` me, `<meta charset="UTF-8" />` ke turant baad, add kar diya gaya hai:

```html
<meta name="google-site-verification" content="HtcxjavFdH_XaiWe2j2akgwavPfXS9z3yjA63h-n2U8" />
```

## Kyun yahi jagah
Google iss tag ko sirf `<head>` section ke andar dhoondhta hai (page ke actual rendered HTML me), isliye ye top par rakha gaya hai taaki verification crawl me miss na ho. Iske alawa index.html me aur kahin kuch change nahi kiya gaya — sirf yahi ek meta tag add hua hai.

## Aage kya karein
1. Ye zip deploy/publish karein (jahan bhi `examnova.github.io` host hota hai).
2. Deploy hone ke baad, Google Search Console me jaake "VERIFY" button dabayein.
3. Verify hone ke baad chahen to ye meta tag hata bhi sakte hain, lekin usually isse rehne dena hi behtar hai — agar future me kabhi re-verify karna pade to kaam aayega.

## Note
- `robots.txt` aur `sitemap.xml` pehle se maujood hain project me — inhe touch nahi kiya gaya kyunki verification ke liye inki zaroorat nahi hoti.
- Baaki koi file is release me change nahi hui hai.
