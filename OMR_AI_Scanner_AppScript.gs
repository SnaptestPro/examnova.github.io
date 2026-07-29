/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   SAVYASACHI COACHING — AI-POWERED OMR SCANNER (Backend)         ║
 * ║   Photo → Claude Vision API → detected answers (JSON)            ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  KYUN CHAHIYE:                                                    ║
 * ║  Anthropic (Claude) API key browser mein kabhi expose nahi karni  ║
 * ║  chahiye — koi bhi Developer Tools khol ke chura sakta hai aur    ║
 * ║  aapke account se bill hoga. Isliye API key yahan, Apps Script    ║
 * ║  ke "Script Properties" mein secretly store hoti hai, aur         ║
 * ║  browser (omr.js) sirf is Apps Script URL ko photo bhejta hai —   ║
 * ║  key kabhi bhi client-side nahi jaati. Yahi pattern aap already   ║
 * ║  MCQ_Approval_AppScript.gs mein use kar rahe hain (Firebase key   ║
 * ║  wahan bhi backend script mein hi hai).                           ║
 * ║                                                                    ║
 * ║  SETUP KAISE KAREIN (ek baar karna hai):                          ║
 * ║  1. https://script.google.com par jaake "New Project" banao.      ║
 * ║  2. Is poore file ka code paste kar do (Code.gs ki jagah).        ║
 * ║  3. Left side "Project Settings" (⚙️) → "Script Properties" →    ║
 * ║     "Add script property" → Name: ANTHROPIC_API_KEY,              ║
 * ║     Value: apni Anthropic API console.anthropic.com wali key.     ║
 * ║  4. Upar-right "Deploy" → "New deployment" → gear icon → "Web app"║
 * ║     - Execute as: Me                                              ║
 * ║     - Who has access: Anyone                                      ║
 * ║     "Deploy" dabao, permissions allow karo.                       ║
 * ║  5. Jo Web app URL milega (.../exec se khatam hota hai), use       ║
 * ║     omr.js ke top wale OMR_AI_ENDPOINT constant mein paste karo.  ║
 * ║  6. Code badalne ke baad hamesha "New deployment" (naya version)  ║
 * ║     banana padta hai — "Manage deployments" → pencil icon se      ║
 * ║     bhi existing URL ko naye code se update kar sakte ho.         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// Konsa Claude model use karein. Sonnet = accha balance of accuracy/cost.
// Zyada saste/tezz results ke liye "claude-haiku-4-5-20251001" try kar sakte ho.
var CLAUDE_MODEL = "claude-sonnet-5";

function getApiKey_() {
  var key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY set nahi hai. Project Settings > Script Properties mein add karein.");
  return key;
}

/**
 * Browser se OMR photo yahan aati hai. Expected POST body (JSON, as
 * text/plain to avoid CORS preflight — omr.js isi tarah bhejta hai):
 *   {
 *     imageBase64: "<raw base64, bina data-url prefix ke>",
 *     mimeType: "image/jpeg",
 *     numQuestions: 100
 *   }
 * Response: { ok: true, answers: [ {q:1, detected:"A"}, {q:2, detected:null}, ... ] }
 * detected: "A" | "B" | "C" | "D" | null (blank ya spasht nahi / do options marked)
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var imageBase64 = body.imageBase64;
    var mimeType = body.mimeType || "image/jpeg";
    var numQuestions = Number(body.numQuestions) || 0;
    if (!imageBase64) throw new Error("imageBase64 missing");
    if (!numQuestions || numQuestions < 1) throw new Error("numQuestions missing/invalid");

    var prompt =
      "Ye ek bharе hue OMR (bubble) answer sheet ki photo hai. Isme " + numQuestions +
      " questions hain, question 1 se " + numQuestions + " tak, har ek ke saath 4 gol bubbles " +
      "hain jinke labels A, B, C, D hain (Ⓐ Ⓑ Ⓒ Ⓓ jaise circled letters ho sakte hain), " +
      "blue/black ball pen se pura dark kiya gaya bubble hi 'marked' maana jaata hai.\n\n" +
      "Har question number ke liye batao kaunsa bubble (A/B/C/D) pura/spasht dark kiya gaya hai. " +
      "Agar koi bhi bubble dark nahi hai (khali chhoda gaya) ya ek se zyada bubble dark lag rahe hain " +
      "(spasht nahi kaun sa sahi hai), to us question ke liye detected ko null rakho — guess mat karo.\n\n" +
      "STRICT OUTPUT: Sirf ek valid JSON array return karo, kuch aur text/explanation/markdown fences NAHI. " +
      "Exact format:\n" +
      "[{\"q\":1,\"detected\":\"A\"},{\"q\":2,\"detected\":null}, ... sabhi " + numQuestions + " questions ke liye]";

    var payload = {
      model: CLAUDE_MODEL,
      max_tokens: Math.min(4000, 200 + numQuestions * 25),
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
          { type: "text", text: prompt }
        ]
      }]
    };

    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": getApiKey_(),
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var status = response.getResponseCode();
    var raw = response.getContentText();
    if (status < 200 || status >= 300) {
      throw new Error("Claude API error (" + status + "): " + raw);
    }

    var data = JSON.parse(raw);
    var text = (data.content || []).map(function (c) { return c.text || ""; }).join("\n").trim();
    // Kabhi-kabhi model ```json fences ke saath wrap kar deta hai — strip kar do.
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      throw new Error("AI response JSON nahi tha: " + text.substring(0, 300));
    }
    if (!Array.isArray(parsed)) throw new Error("AI response array nahi tha.");

    // Normalize + safety: sirf A/B/C/D/null allow karo, aur sab questions cover ho.
    var byQ = {};
    parsed.forEach(function (row) {
      var q = Number(row.q);
      var d = row.detected;
      if (typeof d === "string") d = d.trim().toUpperCase();
      if (["A", "B", "C", "D"].indexOf(d) === -1) d = null;
      if (q >= 1 && q <= numQuestions) byQ[q] = d;
    });
    var answers = [];
    for (var q = 1; q <= numQuestions; q++) {
      answers.push({ q: q, detected: byQ.hasOwnProperty(q) ? byQ[q] : null });
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, answers: answers }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Deploy hone ke baad browser mein URL kholke test karne ke liye (GET) —
// sirf ye batata hai ki endpoint zinda hai, actual scanning POST se hoti hai.
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "OMR AI Scanner is live. Use POST with imageBase64 + numQuestions." }))
    .setMimeType(ContentService.MimeType.JSON);
}
