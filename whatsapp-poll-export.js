/***********************************************************************
 * WHATSAPP POLL EXPORT
 * ----------------------------------------------------------------------
 * WhatsApp khud "Poll" feature deta hai (group ya chat mein + icon ->
 * Poll). Koi app bulk mein WhatsApp polls nahi bana sakta (WhatsApp ka
 * apna rule hai) — lekin ye tool har question ko copy-paste-ready
 * banata hai, taaki aapko sirf paste karna pade, type na karna pade.
 *
 * Use: har test ke "📊 Poll" button se ye modal khulta hai, jisme har
 * question ke liye:
 *   - "Copy Poll Question" button -> question text clipboard mein
 *   - "Copy Option A/B/C/D" buttons -> har option clipboard mein
 * WhatsApp mein Poll banate waqt: question paste karein, "Add Option"
 * dabate jaayein aur har option paste karte jaayein.
 ***********************************************************************/

function copyToClipboard_(text, btnEl) {
  const done = () => {
    if (!btnEl) return;
    const old = btnEl.textContent;
    btnEl.textContent = "✅ Copied!";
    setTimeout(() => { btnEl.textContent = old; }, 1200);
  };
  const fail = () => showManualCopyBox_(text);

  // Mobile browsers (khaaskar iOS Safari aur kuch Android WebView) mein
  // navigator.clipboard.writeText permission ya secure-context restriction
  // ki wajah se silently fail ho sakta hai — isliye hamesha fallback chain
  // rakhte hain aur end mein manual copy box dikhate hain taaki kabhi bhi
  // "kuch nahi hua" wali situation na bane.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy_(text, done, fail));
  } else {
    fallbackCopy_(text, done, fail);
  }
}

function fallbackCopy_(text, done, fail) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // Mobile (khaaskar iOS) par opacity:0 / off-screen textarea se
    // selection kaam nahi karta — isliye chhota, screen ke andar,
    // lekin near-invisible box use karte hain jise select kiya ja sake.
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.fontSize = "16px"; // iOS auto-zoom rokne ke liye
    document.body.appendChild(ta);

    ta.contentEditable = "true";
    ta.readOnly = false;
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS/Android touch selection ke liye zaroori

    // Extra: window Selection/Range se bhi select karke rakhte hain,
    // kuch mobile browsers ise hi follow karte hain.
    try {
      const range = document.createRange();
      range.selectNodeContents(ta);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}

    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (window.getSelection) window.getSelection().removeAllRanges();

    if (ok) { done(); } else { fail(); }
  } catch (e) {
    fail();
  }
}

// Sab automatic tareeke fail ho jaayein (kuch purane/locked-down mobile
// browsers mein aisa ho sakta hai) to ye box text ko highlight-select
// karke dikhata hai, taaki user khud "Copy" long-press kar sake.
function showManualCopyBox_(text) {
  const old = document.getElementById("wa-poll-manual-copy");
  if (old) old.remove();

  const ov = document.createElement("div");
  ov.id = "wa-poll-manual-copy";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;";
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:420px;width:100%;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);">
      <div style="font-size:.82rem;color:#92400e;background:#fef3c7;padding:8px 10px;border-radius:8px;margin-bottom:10px;">
        Auto-copy is fone par kaam nahi kar payi. Neeche diya text already highlighted hai — bas <b>press-and-hold → Copy</b> karein.
      </div>
      <textarea readonly style="width:100%;min-height:110px;font-size:16px;padding:8px;border:1px solid #d1d5db;border-radius:8px;" id="wa-poll-manual-ta"></textarea>
      <button type="button" style="margin-top:10px;width:100%;padding:10px;border:none;border-radius:8px;background:#128c7e;color:#fff;font-weight:600;" onclick="document.getElementById('wa-poll-manual-copy').remove()">Band Karein</button>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });

  const ta = document.getElementById("wa-poll-manual-ta");
  ta.value = text;
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
}

function openWhatsAppPollModal(testId) {
  try {
    const t = (typeof tests !== "undefined") ? tests[testId] : null;
    if (!t || !t.questions || !t.questions.length) { alert("Is test mein sawaal nahi mile."); return; }

    const old = document.getElementById("wa-poll-modal");
    if (old) old.remove();

    const ov = document.createElement("div");
    ov.id = "wa-poll-modal";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;";

    ov.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:560px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;">
        <div style="padding:14px 18px;background:linear-gradient(135deg,#25d366,#128c7e);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <h3 style="margin:0;color:#fff;font-size:.95rem;">📊 WhatsApp Poll Banayein</h3>
          <button type="button" id="wa-poll-close" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
        </div>
        <div style="padding:8px 18px;background:#fef3c7;color:#92400e;font-size:.76rem;">
          👉 WhatsApp kholein → us group/chat mein jaayein → <b>+</b> ya attachment icon → <b>Poll</b> → neeche se "Copy Sawaal" dabakar Poll ke question box mein paste karein, phir har option ke liye "Add Option" dabate jaayein aur A/B/C/D copy-paste karte jaayein.
        </div>
        <div id="wa-poll-rows" style="padding:14px 18px;overflow-y:auto;"></div>
      </div>`;
    document.body.appendChild(ov);

    // Buttons ko DOM API + addEventListener se banate hain (inline onclick
    // string ke bajaye). Pehle inline onclick='copyToClipboard_(${JSON.stringify(text)}...)'
    // use ho raha tha — agar question/option text mein apostrophe (') hota
    // (jaise "Gandhi's", "India's" — history questions mein bahut common),
    // to woh single-quoted onclick attribute ko beech mein hi tod deta tha
    // aur button chup-chaap kaam karna band kar deta tha. DOM + closures
    // is poori class ki escaping problem ko khatam kar dete hain.
    const rowsWrap = ov.querySelector("#wa-poll-rows");
    const subjectiveSkipped = t.questions.filter(q => q.qType === "subjective").length;
    if (subjectiveSkipped > 0) {
      const note = document.createElement("div");
      note.style.cssText = "background:#fef3c7;color:#92400e;font-size:.78rem;padding:8px 10px;border-radius:8px;margin-bottom:10px;";
      note.textContent = `⚠️ Is test ke ${subjectiveSkipped} subjective (likhkar jawab wale) question yahan nahi dikhaye gaye — WhatsApp Poll sirf fixed options (MCQ) support karta hai. Unhe alag se text message ke through bhejein.`;
      rowsWrap.appendChild(note);
    }
    t.questions.forEach((q, i) => {
      if (q.qType === "subjective") return; // Poll mein sirf MCQ questions dikhte hain

      const qText = q.textHI || q.text || "";
      const opts = q.optionsHI || q.options || [];

      const card = document.createElement("div");
      card.style.cssText = "border:1px solid #d1fae5;border-radius:10px;padding:10px 12px;margin-bottom:10px;";

      const qLabel = document.createElement("div");
      qLabel.style.cssText = "font-size:.82rem;color:#1e293b;font-weight:600;margin-bottom:6px;";
      qLabel.textContent = `Q${i + 1}. ${qText}`;
      card.appendChild(qLabel);

      const qBtn = document.createElement("button");
      qBtn.type = "button";
      qBtn.className = "btn btn-xs btn-primary";
      qBtn.textContent = "📋 Copy Sawaal";
      qBtn.addEventListener("click", () => copyToClipboard_(qText, qBtn));
      card.appendChild(qBtn);

      const optWrap = document.createElement("div");
      optWrap.style.marginTop = "6px";
      opts.forEach((o, oi) => {
        const label = "ABCD"[oi] || String(oi + 1);
        const oBtn = document.createElement("button");
        oBtn.type = "button";
        oBtn.className = "btn btn-xs btn-outline";
        oBtn.style.margin = "2px";
        oBtn.textContent = `📋 ${label}`;
        oBtn.addEventListener("click", () => copyToClipboard_(o, oBtn));
        optWrap.appendChild(oBtn);
      });
      card.appendChild(optWrap);

      rowsWrap.appendChild(card);
    });

    ov.querySelector("#wa-poll-close").addEventListener("click", () => ov.remove());
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
  } catch (err) {
    console.error("openWhatsAppPollModal error:", err);
    alert("Poll list banane mein error aayi: " + (err && err.message ? err.message : err));
  }
}

window.openWhatsAppPollModal = openWhatsAppPollModal;
window.copyToClipboard_ = copyToClipboard_;
