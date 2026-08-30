# Handwritten-name OCR → Link-to-Student suggestion (v22)

Requested: "OMR mein jo naam likha hai wo bhi AI se detect ho, aur us se
registered student se link ho jaaye." Chose the free/no-billing route
(Tesseract.js, client-side) over a paid cloud Vision API — see the
in-chat discussion for the accuracy trade-off; this is meant as a
**suggestion the admin confirms**, not an automatic linker.

## What changed

1. **`OMR_NAME_BOX`** — the header box already prints a blank area next
   to "NAME :" for students to write in (it existed on the sheet before
   this fix; it just wasn't read back by the scanner). Its coordinates
   in the same `OMR_CANVAS_SIZE` template space every bubble already
   uses: `{ x: 175, y: 52, width: 415, height: 40 }`. Because
   `scannerCaptureCanvas` is already warped into that exact coordinate
   space by the existing 4-corner homography, this box can be cropped
   straight out of any capture with no extra alignment work.

2. **OCR (`examgrRunNameOcr`)** — right when a sheet is captured (in
   parallel with bubble grading, so it doesn't add wait time), the name
   box is cropped, upscaled 3x (`OCR_UPSCALE`, handwriting reads better
   bigger), and run through a Tesseract.js worker
   (`examgrGetOcrWorker` — loaded from CDN via a `<script defer>` tag in
   index.html, kept alive for the whole Scan Sheet session so its
   language-data download only happens once). Result is shown live under
   the Roll No/Set/Marks header ("📝 Naam (OCR guess): ...") as soon as
   it resolves.

3. **Fuzzy match (`examgrBestNameMatches`)** — a plain Levenshtein
   edit-distance similarity (`examgrNameSimilarity`) ranks the existing
   registered-students directory (`examgrSavedStudentsForNameSearch`,
   already used by the Link-to-Student name-search box) against the raw
   OCR text. Deliberately lenient (0.35 floor) since OCR misreads a
   letter or two even on a clean capture — this is for ranking
   candidates for a human to see, not for deciding on its own.

4. **Link-to-Student prefill (`examgrOpenLinkStudentForScan`)** — after
   Save, if the roll-based prior-link prefill (already existed) didn't
   already fill the mobile field:
   - A confident, unambiguous top match (score ≥ 0.6 AND at least 0.15
     clear of the second-best) prefills BOTH the name and mobile fields,
     with a status line telling the admin to verify against the sheet
     before tapping "Link Karein".
   - Anything weaker just drops the raw OCR text into the existing
     name-search box (triggering its normal suggestion list) so the
     admin has a starting point instead of typing from scratch, without
     the system guessing on their behalf.
   - **Nothing here ever links automatically** — "Link Karein" is still
     a required, explicit tap either way.

5. Save now also stores `resultObj.ocrNameGuess` (raw OCR text, or
   `null`) on the scan result — kept for later reference, e.g. if the
   admin wants to search on it manually after the fact.

## Accuracy expectations (set these with the admin)

Tesseract.js is a printed-text OCR engine repurposed for handwriting; it
was NOT trained specifically on handwritten characters. On a clearly
printed capital-letter name it can do reasonably well; on genuine cursive
or messy handwriting, expect meaningfully more misreads than the roll
number bubbles ever have. That's exactly why every result here is
surfaced as a suggestion (with the raw guess always shown) rather than
an auto-link — same principle as `egResolveDuplicateRoll` and other
"admin has the final say" patterns already in this codebase.

## What this does NOT change

Bubble grading (roll/set/answers), the 4-corner homography, and the
existing roll-number-based prior-link prefill are all untouched — this
only adds a new, independent, best-effort signal alongside them.
