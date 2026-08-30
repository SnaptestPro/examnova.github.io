// PDF text extract + MCQ question parser for EXAMNOVA
(function () {
  const OPT_PATTERNS = [
    /^\(?\[?([A-Da-d])\)?\]?\s*[\.\):\-]\s*(.+)$/,
    /^\(?\[?(अ|ब|स|द)\)?\]?\s*[\.\):\-]\s*(.+)$/,
    /^\[([A-D])\]\s*(.+)$/
  ];

  const ANSWER_PATTERNS = [
    /^(?:answer|ans|correct|उत्तर|सही\s*उत्तर)\s*[:\-]\s*\(?([A-Da-dअबसद1-4])\)?/i,
    /^(?:answer|ans)\s+is\s+([A-D])/i
  ];

  const EXPL_PATTERNS = [
    /^(?:explanation|explain|solution|व्याख्या|हल)\s*[:\-]\s*(.+)$/i
  ];

  const SECTION_PATTERNS = [
    /^section\s*[-:]?\s*(.+)$/i,
    /^खंड\s*[-:]?\s*(.+)$/i,
    /^part\s*[-:]?\s*(.+)$/i
  ];

  const Q_START = /^(?:(?:Q(?:uestion)?|प्रश्न)\s*)?(\d+)\s*[\.\):\-]\s*(.*)$/i;

  function answerToIndex(val) {
    if (!val) return 0;
    const v = String(val).trim().toUpperCase();
    const map = { A: 0, B: 1, C: 2, D: 3, अ: 0, ब: 1, स: 2, द: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
    return map[v] ?? 0;
  }

  function isSectionLine(line) {
    return SECTION_PATTERNS.some(p => p.test(line));
  }

  function parseSectionTitle(line) {
    for (const p of SECTION_PATTERNS) {
      const m = line.match(p);
      if (m) return m[1].trim() || line;
    }
    return line;
  }

  function parseOptionLine(line) {
    for (const p of OPT_PATTERNS) {
      const m = line.match(p);
      if (m) {
        const letter = m[1].toUpperCase();
        const idx = answerToIndex(letter);
        return { index: idx, text: m[2].trim() };
      }
    }
    return null;
  }

  function parseBlock(lines, startIdx, sectionTitle) {
    const first = lines[startIdx];
    const qm = first.match(Q_START);
    if (!qm) return null;

    const question = {
      textHI: qm[2]?.trim() || "",
      textEN: "",
      optionsHI: ["", "", "", ""],
      optionsEN: ["", "", "", ""],
      answer: 0,
      explanationHI: "",
      explanationEN: "",
      section: sectionTitle,
      subject: "General",
      chapter: "PDF Import",
      status: "pending",
      source: "pdf"
    };

    let i = startIdx + 1;
    const textLines = [];

    while (i < lines.length) {
      const line = lines[i];
      if (isSectionLine(line) || Q_START.test(line)) break;

      let matched = false;
      for (const p of ANSWER_PATTERNS) {
        const m = line.match(p);
        if (m) {
          question.answer = answerToIndex(m[1]);
          matched = true;
          break;
        }
      }
      if (matched) { i++; continue; }

      for (const p of EXPL_PATTERNS) {
        const m = line.match(p);
        if (m) {
          question.explanationHI = m[1].trim();
          i++;
          while (i < lines.length && !Q_START.test(lines[i]) && !isSectionLine(lines[i]) && !ANSWER_PATTERNS.some(ap => ap.test(lines[i]))) {
            if (!parseOptionLine(lines[i])) question.explanationHI += " " + lines[i];
            i++;
          }
          matched = true;
          break;
        }
      }
      if (matched) continue;

      const opt = parseOptionLine(line);
      if (opt) {
        question.optionsHI[opt.index] = opt.text;
        i++;
        continue;
      }

      if (/^explanation|^व्याख्या/i.test(line)) {
        question.explanationHI = line.replace(/^[^:]+:\s*/, "").trim();
        i++;
        continue;
      }

      textLines.push(line);
      i++;
    }

    if (textLines.length && !question.textHI) {
      question.textHI = textLines.join(" ").trim();
    }

    question.text = question.textHI;
    question.options = question.optionsHI;
    question.explanation = question.explanationHI;

    const filledOpts = question.optionsHI.filter(Boolean).length;
    if (!question.textHI || filledOpts < 2) return null;

    while (question.optionsHI.length < 4) question.optionsHI.push("");
    return { question, nextIndex: i };
  }

  function parseQuestionsFromText(rawText) {
    const normalized = rawText
      .replace(/\r\n/g, "\n")
      .replace(/([A-Da-dअबसद])\)\s*/g, "\n($1) ")
      .replace(/(\d+)\.\s+/g, "\n$1. ");

    const lines = normalized.split("\n").map(l => l.trim()).filter(Boolean);
    const questions = [];
    let sectionTitle = "Section A";
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (isSectionLine(line)) {
        sectionTitle = parseSectionTitle(line);
        i++;
        continue;
      }
      if (Q_START.test(line)) {
        const block = parseBlock(lines, i, sectionTitle);
        if (block?.question) {
          questions.push(block.question);
          i = block.nextIndex;
          continue;
        }
      }
      i++;
    }
    return questions;
  }

  async function extractTextFromPdf(file) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("PDF.js load nahi hua");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const parts = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      parts.push(content.items.map(it => it.str).join(" "));
    }
    return parts.join("\n\n");
  }

  async function importQuestionsFromPdf(file) {
    const text = await extractTextFromPdf(file);
    const questions = parseQuestionsFromText(text);
    return { text, questions, fileName: file.name };
  }

  window.PdfImport = {
    extractTextFromPdf,
    parseQuestionsFromText,
    importQuestionsFromPdf
  };
})();
