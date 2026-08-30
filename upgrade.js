/* 
  EXAMNOVA App 2.0 - Simple Login (No Firebase Auth)
  Student: Sirf Naam + WhatsApp Number se test shuru karo
  Admin: Password se login karo (same as before)
*/

(function initSimpleMode() {
  // Auth modal aur Firebase dashboard - hamesha hidden
  const authModal = document.getElementById("auth-modal");
  if (authModal) authModal.style.display = "none";

  const dashboard = document.getElementById("student-dashboard-screen");
  if (dashboard) dashboard.style.display = "none";

  // Page load pe seedha Student form dikhao
  // script.js ka init() DOMContentLoaded pe chalta hai
  // Hum uske baad showMode("student") call karenge
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(() => { if (typeof showMode === "function") showMode("student"); }, 100);
    });
  } else {
    setTimeout(() => { if (typeof showMode === "function") showMode("student"); }, 100);
  }
})();

// Auto-Save: test ke beech refresh ho toh data bachao
setInterval(() => {
  const examScreen = document.getElementById("exam-screen");
  if (examScreen && !examScreen.classList.contains("hidden")) {
    if (typeof current !== "undefined" && current.test) {
      localStorage.setItem("savya_ongoing_test", JSON.stringify(current));
    }
  }
}, 5000);

function checkAutoSave() {
  const saved = localStorage.getItem("savya_ongoing_test");
  if (saved) {
    try {
      const state = JSON.parse(saved);
      if (state && state.test && confirm("Aapka ek adhoora test ('" + state.test.title + "') mila hai. Kya aap wahi se shuru karna chahte hain?")) {
        Object.assign(current, state);
        document.getElementById("home-screen").classList.add("hidden");
        const examScreen = document.getElementById("exam-screen");
        if (examScreen) examScreen.classList.remove("hidden");
        const examTitle = document.getElementById("exam-title");
        if (examTitle) examTitle.textContent = current.test.title;
        if (typeof renderQuestion === "function") renderQuestion();
        if (typeof startTimer === "function") startTimer();
      } else {
        localStorage.removeItem("savya_ongoing_test");
      }
    } catch(e) {
      localStorage.removeItem("savya_ongoing_test");
    }
  }
}

// Confetti celebration on result
const _origShowResult = window.showResult;
window.showResult = async function() {
  localStorage.removeItem("savya_ongoing_test");
  if (_origShowResult) await _origShowResult();
  try {
    if (typeof confetti === "function") {
      var end = Date.now() + 3000;
      (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#4f46e5','#fbbf24','#f97316'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ec4899','#2dd4bf','#ef4444'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
    }
  } catch(e) {}
};

// Excel Export
function exportToExcel() {
  if (!records || records.length === 0) { alert("No records to export"); return; }
  const testId = document.getElementById("admin-result-test-select")?.value || document.getElementById("result-test-select")?.value;
  let data = records;
  if (testId) data = records.filter(r => r.testId === testId);
  const wsData = [["Rank","Name","Mobile","Score","Max Score","Percentage","Date"]];
  const ranked = (testId && typeof getRankedResultsForTest === "function") ? getRankedResultsForTest(testId) : [];
  data.forEach((r) => {
    const pct = r.percentage ? Math.round(r.percentage) : (r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0);
    const rankObj = ranked.find(row => row.name === (r.name || "Student"));
    const rank = rankObj ? rankObj.rank : "-";
    const dateStr = r.submittedIso ? new Date(r.submittedIso).toLocaleString() : (r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "-");
    wsData.push([rank, r.name || "-", r.mobile || r.parentPhone || "-", r.score ?? 0, r.maxScore ?? 0, pct + "%", dateStr]);
  });
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.writeFile(wb, "EXAMNOVA_Results.xlsx");
}

// PDF Export
function exportToPdf() {
  const element = document.getElementById("records-list");
  html2pdf().from(element).save("EXAMNOVA_Results.pdf");
}

// WhatsApp Bulk API
function bulkSendWhatsApp() {
  const testId = document.getElementById("admin-result-test-select")?.value || document.getElementById("result-test-select")?.value;
  if (!testId) { alert("Pehle upar se ek test select karo (📋 Select Test dropdown)."); return; }
  const data = records.filter(r => r.testId === testId);
  if (data.length === 0) { alert("No results found"); return; }
  const withNumber = data.filter(r => {
    const phone = (r.mobile || r.parentPhone || "").replace(/\D/g, "");
    return phone.length >= 10;
  });
  if (withNumber.length === 0) { alert("Is test ke kisi bhi student ka mobile number save nahi hai."); return; }

  const ranked = (typeof getRankedResultsForTest === "function") ? getRankedResultsForTest(testId) : [];
  const items = withNumber.map(r => {
    const phoneDigits = (r.mobile || r.parentPhone || "").replace(/\D/g, "");
    const fullPhone = phoneDigits.startsWith("91") && phoneDigits.length > 10 ? phoneDigits : "91" + phoneDigits.slice(-10);
    const score = r.score ?? 0;
    const maxScore = r.maxScore ?? 0;
    const pct = r.percentage ? Math.round(r.percentage) : (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);
    const rankObj = ranked.find(row => row.name === (r.name || "Student"));
    const rank = rankObj ? rankObj.rank : "N/A";
    const msg = "Hello " + (r.name || "Student") + ", your result for EXAMNOVA Test is out! Score: " + score + "/" + maxScore + " (" + pct + "%), Rank: " + rank + ". Check the portal for details.";
    const url = "https://wa.me/" + fullPhone + "?text=" + encodeURIComponent(msg);
    return { name: r.name || "Student", phone: phoneDigits, url };
  });

  // Browsers block multiple auto window.open() calls in a loop (popup blocker).
  // So instead we show a list — each click is a real user-gesture and always opens.
  const old = document.getElementById("wa-bulk-modal");
  if (old) old.remove();
  const ov = document.createElement("div");
  ov.id = "wa-bulk-modal";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";
  let rows = items.map((it, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-top:${i>0?'1px solid #d1fae5':'none'};">
      <div>
        <div style="font-weight:600;font-size:.86rem;color:#1e293b;">${escHtml(it.name)}</div>
        <div style="font-size:.74rem;color:#64748b;">${escHtml(it.phone)}</div>
      </div>
      <a href="${it.url}" target="_blank" rel="noopener" style="background:#25d366;color:#fff;border-radius:8px;padding:6px 14px;font-size:.8rem;font-weight:700;text-decoration:none;white-space:nowrap;">📱 Bhejein</a>
    </div>`).join("");
  ov.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:480px;width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;">
    <div style="padding:14px 18px;background:linear-gradient(135deg,#25d366,#128c7e);display:flex;align-items:center;justify-content:space-between;">
      <h3 style="margin:0;color:#fff;font-size:.95rem;">💬 WhatsApp Bhejein (${items.length} students)</h3>
      <button onclick="document.getElementById('wa-bulk-modal').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
    </div>
    <div style="padding:6px 4px;background:#fef3c7;color:#92400e;font-size:.74rem;text-align:center;">⚠️ Har student ke liye "Bhejein" button alag se click karo — browser ek saath sabhi tab khulne nahi deta.</div>
    <div style="overflow-y:auto;flex:1;">${rows}</div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
}
