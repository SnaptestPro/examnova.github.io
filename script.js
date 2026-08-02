/* ═══════════════════════════════════════════════════════════════
   Savyasachi Coaching Test – Board Exam Platform
   script.js  |  Full App Logic
   ═══════════════════════════════════════════════════════════════ */

/* ── SSC Chapter Analysis Data (from PDF) ── */
const sscChaptersData = [
  { name: "Number System",             count: 374, pct: 6.8  },
  { name: "LCM and HCF",              count: 162, pct: 2.9  },
  { name: "Simplification",           count: 267, pct: 4.9  },
  { name: "Indices & Surds",          count: 204, pct: 3.7  },
  { name: "Average",                   count: 189, pct: 3.5  },
  { name: "Percentage",                count: 342, pct: 6.2  },
  { name: "Ratio and Proportion",      count: 256, pct: 4.7  },
  { name: "Profit and Loss",           count: 387, pct: 7.1  },
  { name: "Discount",                  count: 148, pct: 2.7  },
  { name: "Simple Interest",           count: 178, pct: 3.2  },
  { name: "Compound Interest",         count: 201, pct: 3.7  },
  { name: "Partnership",               count: 127, pct: 2.3  },
  { name: "Alligation",                count: 113, pct: 2.1  },
  { name: "Time and Work",             count: 267, pct: 4.9  },
  { name: "Pipes and Cisterns",        count: 156, pct: 2.8  },
  { name: "Speed, Time and Distance",  count: 312, pct: 5.7  },
  { name: "Problems Related to Train", count: 167, pct: 3.0  },
  { name: "Boat and Stream",           count: 142, pct: 2.6  },
  { name: "Age Problems",              count: 134, pct: 2.4  },
  { name: "Algebra",                   count: 298, pct: 5.4  },
  { name: "Geometry",                  count: 389, pct: 7.1  },
  { name: "Mensuration 2D",            count: 278, pct: 5.1  },
  { name: "Mensuration 3D",            count: 156, pct: 2.8  },
  { name: "Trigonometry",              count: 312, pct: 5.7  },
  { name: "Height and Distance",       count: 198, pct: 3.6  },
  { name: "Co-ordinate Geometry",      count: 89,  pct: 1.6  },
  { name: "Statistics",                count: 67,  pct: 1.2  },
  { name: "Data Interpretation",       count: 234, pct: 4.3  },
  { name: "Decimal and Fraction",      count: 98,  pct: 1.8  },
];

/* ── Math Question Generators ── */
const mathGenerators = {};

mathGenerators["Number System"] = () => {
  const a = randInt(2, 20), b = randInt(2, 20);
  const s = a + b;
  const opts = shuffleWithCorrect(s, [s - randInt(1,5), s + randInt(1,5), a * b]);
  return mkQ(`${a} + ${b} = ?`, opts.options, opts.correct,
    `EN: ${a} + ${b} = ${s} | HI: ${a} + ${b} = ${s}`, "Number System");
};
mathGenerators["LCM and HCF"] = () => {
  const pairs = [[4,6],[6,8],[8,12],[10,15],[6,9],[12,18]];
  const [a,b] = pairs[randInt(0, pairs.length-1)];
  const lcm = (a*b)/gcd(a,b);
  const opts = shuffleWithCorrect(lcm, [lcm-randInt(1,4), lcm+randInt(1,4), a*b]);
  return mkQ(`${a} aur ${b} ka LCM kya hai? / LCM of ${a} and ${b}?`, opts.options, opts.correct,
    `LCM(${a},${b}) = ${lcm}`, "LCM and HCF");
};
mathGenerators["Simplification"] = () => {
  const a = randInt(10,50), b = randInt(2,10), c = randInt(2,8);
  const ans = a - b * c;
  const opts = shuffleWithCorrect(ans, [ans+randInt(1,5), ans-randInt(1,5), a*b-c]);
  return mkQ(`${a} - ${b} × ${c} = ?`, opts.options, opts.correct,
    `${a} - ${b}×${c} = ${a} - ${b*c} = ${ans}`, "Simplification");
};
mathGenerators["Percentage"] = () => {
  const base = [100,200,500,1000,250][randInt(0,4)];
  const pct  = [10,20,25,15,5,30,40,50][randInt(0,7)];
  const ans  = Math.round(base * pct / 100);
  const opts = shuffleWithCorrect(ans, [ans+5, ans-5, ans+10]);
  return mkQ(`${base} ka ${pct}% kya hai? / What is ${pct}% of ${base}?`, opts.options, opts.correct,
    `${base} × ${pct}/100 = ${ans}`, "Percentage");
};
mathGenerators["Profit and Loss"] = () => {
  const cp = [400,500,600,800,1000][randInt(0,4)];
  const pp = [10,15,20,25][randInt(0,3)];
  const sp = cp + Math.round(cp * pp / 100);
  const opts = shuffleWithCorrect(sp, [sp-50, sp+50, cp]);
  return mkQ(`Ek vastu ko Rs.${cp} mein kharida aur ${pp}% laabh pe becha. Selling price? / Item bought for Rs.${cp} sold at ${pp}% profit. SP?`,
    opts.options, opts.correct, `SP = CP × (1 + P/100) = ${cp} × ${(1+pp/100)} = ${sp}`, "Profit and Loss");
};
mathGenerators["Simple Interest"] = () => {
  const p = [1000,2000,5000,10000][randInt(0,3)];
  const r = [5,10,12,15][randInt(0,3)];
  const t = randInt(1,5);
  const si = p * r * t / 100;
  const opts = shuffleWithCorrect(si, [si+100, si-100, p*r/100]);
  return mkQ(`Rs.${p} par ${r}% vaarshik dar se ${t} saal ka saadhaaran byaj? / SI on Rs.${p} at ${r}% per annum for ${t} years?`,
    opts.options, opts.correct, `SI = PRT/100 = ${p}×${r}×${t}/100 = ${si}`, "Simple Interest");
};
mathGenerators["Algebra"] = () => {
  const a = randInt(2,10);
  const val = a * a + 1/(a*a);
  const prev = a + 1/a;
  const ans  = Math.round(prev*prev - 2);
  const opts = shuffleWithCorrect(ans, [ans+2, ans-2, ans+4]);
  return mkQ(`Agar x + 1/x = ${prev.toFixed(0)} hai, to x² + 1/x² = ? / If x + 1/x = ${prev.toFixed(0)}, x² + 1/x² = ?`,
    opts.options, opts.correct, `(x+1/x)² - 2 = ${prev.toFixed(0)}² - 2 = ${ans}`, "Algebra");
};
mathGenerators["Geometry"] = () => {
  const facts = [
    { q: "Tribhuj ke teeno konon ka yog? / Sum of all angles of a triangle?", a: 180, wrong: [90, 270, 360] },
    { q: "Chaturbhuj ke teeno konon ka yog? / Sum of angles in a quadrilateral?", a: 360, wrong: [180, 270, 720] },
    { q: "Ek samabaahu tribhuj ke har kon ka maan? / Each angle of equilateral triangle?", a: 60, wrong: [45, 90, 120] },
  ];
  const f = facts[randInt(0, facts.length-1)];
  const opts = shuffleWithCorrect(f.a, f.wrong);
  return mkQ(f.q, opts.options, opts.correct, `Sahi uttar: ${f.a}°`, "Geometry");
};
mathGenerators["Average"] = () => {
  const n = randInt(3,7);
  const nums = Array.from({length: n}, () => randInt(10, 50));
  const avg  = Math.round(nums.reduce((s,x) => s+x, 0) / n);
  const opts = shuffleWithCorrect(avg, [avg+2, avg-2, avg+5]);
  return mkQ(`${nums.join(", ")} ka average kya hai? / Average of ${nums.join(", ")}?`,
    opts.options, opts.correct, `Sum = ${nums.reduce((s,x)=>s+x,0)}, Average = ${avg}`, "Average");
};
mathGenerators["Trigonometry"] = () => {
  const trig = [
    { q: "sin 30° ka maan? / Value of sin 30°?", a: "1/2", w: ["√3/2","1","0"] },
    { q: "cos 60° ka maan? / Value of cos 60°?", a: "1/2", w: ["√3/2","1","0"] },
    { q: "tan 45° ka maan? / Value of tan 45°?", a: "1", w: ["0","1/2","√3"] },
    { q: "sin 90° ka maan? / Value of sin 90°?", a: "1", w: ["0","1/2","√3/2"] },
    { q: "cos 0° ka maan? / Value of cos 0°?",   a: "1", w: ["0","1/2","√3/2"] },
  ];
  const f = trig[randInt(0, trig.length-1)];
  const opts = shuffleWithCorrect(f.a, f.w);
  return mkQ(f.q, opts.options, opts.correct, `Sahi: ${f.a}`, "Trigonometry");
};
mathGenerators["Mensuration 2D"] = () => {
  const r = [7, 14, 21][randInt(0,2)];
  const area = Math.round(22/7 * r * r);
  const opts = shuffleWithCorrect(area, [area+50, area-50, 2*22/7*r|0]);
  return mkQ(`Ek vrut ki trijya ${r} cm hai. Kshetrafal? (π=22/7) / Circle radius ${r} cm. Area? (π=22/7)`,
    opts.options, opts.correct, `π r² = 22/7 × ${r}² = ${area} cm²`, "Mensuration 2D");
};
mathGenerators["Mensuration 3D"] = () => {
  const s = [3,4,5,6][randInt(0,3)];
  const vol = s*s*s;
  const opts = shuffleWithCorrect(vol, [vol+s*s, vol-s, s*s]);
  return mkQ(`Ek ghan ki bhuuja ${s} cm hai. Aayatan? / Side of cube is ${s} cm. Volume?`,
    opts.options, opts.correct, `s³ = ${s}³ = ${vol} cm³`, "Mensuration 3D");
};
mathGenerators["Speed, Time and Distance"] = () => {
  const speed = [40,60,72,80,90,100][randInt(0,5)];
  const mps   = Math.round(speed * 1000 / 3600);
  const opts  = shuffleWithCorrect(mps, [mps+2, mps-2, mps*2]);
  return mkQ(`${speed} km/h ko m/s mein badlo? / Convert ${speed} km/h to m/s?`,
    opts.options, opts.correct, `km/h × 5/18 = ${speed} × 5/18 = ${mps} m/s`, "Speed, Time and Distance");
};
mathGenerators["Time and Work"] = () => {
  const a = [4,5,6,8,10,12,15,20][randInt(0,7)];
  const b = [6,8,10,12,15,20,24,30][randInt(0,7)];
  const together = (a*b)/(a+b);  // CORRECT: Time & Work formula
  const togetherRounded = Math.round(together * 10) / 10;
  const opts = shuffleWithCorrect(togetherRounded, [togetherRounded+2, Math.max(0.5, togetherRounded-2), a+b]);
  return mkQ(`A ek kaam ko ${a} din mein aur B ${b} din mein karta hai. Dono milkar kitne din mein? / A does work in ${a} days, B in ${b} days. Together?`,
    opts.options, opts.correct, `Together = AB/(A+B) = ${a}×${b}/(${a}+${b}) = ${togetherRounded.toFixed(1)} days`, "Time and Work");
};
mathGenerators["Ratio and Proportion"] = () => {
  const a = randInt(2,8), b = randInt(2,8), total = randInt(50,200);
  const shareA = Math.round(total * a / (a+b));
  const opts = shuffleWithCorrect(shareA, [shareA+5, shareA-5, total-shareA]);
  return mkQ(`A:B = ${a}:${b}. Rs.${total} mein A ka hissa? / A:B = ${a}:${b}. A's share of Rs.${total}?`,
    opts.options, opts.correct, `A = ${a}/(${a}+${b}) × ${total} = ${shareA}`, "Ratio and Proportion");
};
mathGenerators["Compound Interest"] = () => {
  const p = [1000, 2000, 5000][randInt(0,2)];
  const r = [10, 20][randInt(0,1)];
  const ci = Math.round(p * ((1 + r/100)**2 - 1));
  const si = p * r * 2 / 100;
  const opts = shuffleWithCorrect(ci, [si, ci+50, ci-50]);
  return mkQ(`Rs.${p} par ${r}% dar se 2 saal ka Chakravridhi Byaj? / CI on Rs.${p} at ${r}% for 2 years?`,
    opts.options, opts.correct, `CI = P[(1+r/100)²-1] = ${ci}`, "Compound Interest");
};
mathGenerators["Data Interpretation"] = () => {
  const data = [30, 25, 20, 15, 10];
  const labels = ["A","B","C","D","E"];
  const total = data.reduce((s,x)=>s+x,0);
  const idx = randInt(0,4);
  const pct = data[idx];
  const opts = shuffleWithCorrect(pct, [pct+5, pct-5, total-pct]);
  return mkQ(`Pie chart mein A=30%, B=25%, C=20%, D=15%, E=10% hai. ${labels[idx]} ka percentage kya hai? / In a pie chart A=30%, B=25%, C=20%, D=15%, E=10%. Percentage of ${labels[idx]}?`,
    opts.options, opts.correct, `${labels[idx]} = ${pct}%`, "Data Interpretation");
};

/* ── Additional Math Generators (missing chapters) ── */
mathGenerators["Indices & Surds"] = () => {
  const a = [2,3,4,5][randInt(0,3)];
  const b = [2,3,4][randInt(0,2)];
  const ans = Math.pow(a, b);
  const wrongs = [ans + a, Math.abs(ans - a), a * b + 1];
  const opts = shuffleWithCorrect(ans, wrongs);
  return mkQ(`${a}^${b} = ? / ${a}^${b} = ?`, opts.options, opts.correct, `${a}^${b} = ${ans}`, "Indices & Surds");
};
mathGenerators["Discount"] = () => {
  const mp = [200,500,800,1000,1200][randInt(0,4)];
  const d = [10,15,20,25][randInt(0,3)];
  const sp = Math.round(mp * (100 - d) / 100);
  const wrongs = [sp + 50, Math.max(10, sp - 50), mp];
  const opts = shuffleWithCorrect(sp, wrongs);
  return mkQ(`MP = Rs.${mp}, Discount = ${d}%. Selling price? / MP = Rs.${mp}, Discount = ${d}%. SP?`,
    opts.options, opts.correct, `SP = MP × (100-D)/100 = ${mp} × ${100-d}/100 = ${sp}`, "Discount");
};
mathGenerators["Partnership"] = () => {
  const a = [2,3,4,5][randInt(0,3)];
  const b = [3,4,5,6][randInt(0,3)];
  const profit = [1000,2000,3000,5000][randInt(0,3)];
  const total = a + b;
  const shareA = Math.round(profit * a / total);
  const wrongs = [shareA + 100, Math.max(100, shareA - 100), profit];
  const opts = shuffleWithCorrect(shareA, wrongs);
  return mkQ(`A:B = ${a}:${b}. Total profit = Rs.${profit}. A ka hissa? / A:B = ${a}:${b}. Profit = Rs.${profit}. A's share?`,
    opts.options, opts.correct, `A = ${a}/(${a}+${b}) × ${profit} = ${shareA}`, "Partnership");
};
mathGenerators["Alligation"] = () => {
  const c1 = [20,30,40][randInt(0,2)];
  const c2 = [50,60,70][randInt(0,2)];
  const ratio = c2 - c1;
  const wrongs = [ratio + 5, Math.max(5, ratio - 5), c1 + c2];
  const opts = shuffleWithCorrect(ratio, wrongs);
  return mkQ(`Type1 = ${c1}/kg, Type2 = ${c2}/kg. Alligation mein antar? / Type1 = ${c1}/kg, Type2 = ${c2}/kg. Difference?`,
    opts.options, opts.correct, `Difference = ${c2} - ${c1} = ${ratio}`, "Alligation");
};
mathGenerators["Pipes and Cisterns"] = () => {
  const a = [4,6,8,10,12][randInt(0,4)];
  const b = [6,8,10,12,15][randInt(0,4)];
  const together = (a*b)/(a+b);
  const tr = Math.round(together * 10) / 10;
  const wrongs = [tr + 2, Math.max(0.5, tr - 2), a + b];
  const opts = shuffleWithCorrect(tr, wrongs);
  return mkQ(`Pipe A ${a} min mein, Pipe B ${b} min mein bhar sakta hai. Saath mein? / Pipe A fills in ${a} min, Pipe B in ${b} min. Together?`,
    opts.options, opts.correct, `Together = ${a}×${b}/(${a}+${b}) = ${tr.toFixed(1)} min`, "Pipes and Cisterns");
};
mathGenerators["Problems Related to Train"] = () => {
  const l = [100,150,200,300][randInt(0,3)];
  const s = [36,54,72,90][randInt(0,3)];
  const t = Math.round(l / (s * 5 / 18));
  const wrongs = [t + 5, Math.max(1, t - 5), t * 2];
  const opts = shuffleWithCorrect(t, wrongs);
  return mkQ(`Train length = ${l}m, speed = ${s} km/h. Pole cross karne mein time (sec)? / Train length = ${l}m, speed = ${s} km/h. Time to cross pole (sec)?`,
    opts.options, opts.correct, `Time = ${l} / (${s}×5/18) ≈ ${t} sec`, "Problems Related to Train");
};
mathGenerators["Boat and Stream"] = () => {
  const b = [5,6,8,10][randInt(0,3)];
  const s = [2,3,4][randInt(0,2)];
  const up = b - s;
  const wrongs = [up + s + 1, Math.max(1, up - 1), b + s];
  const opts = shuffleWithCorrect(up, wrongs);
  return mkQ(`Boat speed = ${b} km/h, Stream = ${s} km/h. Upstream speed? / Boat = ${b} km/h, Stream = ${s} km/h. Upstream?`,
    opts.options, opts.correct, `Upstream = ${b} - ${s} = ${up} km/h`, "Boat and Stream");
};
mathGenerators["Age Problems"] = () => {
  const present = randInt(20,40);
  const years = randInt(5,15);
  const future = present + years;
  const wrongs = [future + 5, Math.max(5, future - 5), present];
  const opts = shuffleWithCorrect(future, wrongs);
  return mkQ(`Aaj ki umr = ${present} saal. ${years} saal baad? / Present age = ${present}. After ${years} years?`,
    opts.options, opts.correct, `Future age = ${present} + ${years} = ${future}`, "Age Problems");
};
mathGenerators["Co-ordinate Geometry"] = () => {
  const x = [1,2,3,4][randInt(0,3)];
  const y = [2,3,4,5][randInt(0,3)];
  const ans = `(${x},${y})`;
  const wrongs = [`(${x+1},${y})`, `(${x},${y+1})`, `(${x-1},${y})`];
  const opts = shuffleWithCorrect(ans, wrongs);
  const quad = x > 0 && y > 0 ? 'I' : x < 0 && y > 0 ? 'II' : x < 0 && y < 0 ? 'III' : 'IV';
  return mkQ(`Point (${x},${y}) kis quadrant mein hai? / Point (${x},${y}) lies in which quadrant?`,
    opts.options, opts.correct, `(${x},${y}) → ${quad} Quadrant`, "Co-ordinate Geometry");
};
mathGenerators["Statistics"] = () => {
  const nums = [2,3,4,5,6];
  const mean = nums.reduce((a,b) => a + b, 0) / nums.length;
  const wrongs = [mean + 1, mean - 1, nums.length + 2];
  const opts = shuffleWithCorrect(mean, wrongs);
  return mkQ(`Data: ${nums.join(', ')}. Mean? / Data: ${nums.join(', ')}. Mean?`,
    opts.options, opts.correct, `Mean = ${nums.reduce((a,b)=>a+b,0)}/${nums.length} = ${mean}`, "Statistics");
};
mathGenerators["Decimal and Fraction"] = () => {
  const num = randInt(1,9);
  const den = [2,4,5,8][randInt(0,3)];
  const dec = (num / den).toFixed(2);
  const wrongs = [(num/den + 0.1).toFixed(2), (num/den - 0.1).toFixed(2), (num/den + 0.25).toFixed(2)];
  const opts = shuffleWithCorrect(dec, wrongs);
  return mkQ(`${num}/${den} = ? (Decimal) / ${num}/${den} = ? (Decimal)`,
    opts.options, opts.correct, `${num}/${den} = ${dec}`, "Decimal and Fraction");
};
mathGenerators["Height and Distance"] = () => {
  const h = [30, 45, 60][randInt(0,2)];
  const d = Math.round(h * 1.732);
  const wrongs = [d + 15, Math.max(10, d - 15), h * 2];
  const opts = shuffleWithCorrect(d, wrongs);
  return mkQ(`Minar ki height = ${h}m. 30° angle se dekhne par, minar se kitna door? / Tower height = ${h}m. Viewed at 30°. Distance from base?`,
    opts.options, opts.correct, `Distance = ${h} × √3 ≈ ${d}m`, "Height and Distance");
};

/* ── Helper Functions ── */
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function shuffleWithCorrect(correct, wrongs) {
  const all = [String(correct), ...wrongs.map(String)];
  const unique = [...new Set(all)].slice(0,4);
  while(unique.length < 4) unique.push(String(Number(correct) + unique.length * 3));
  for(let i = unique.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return { options: unique, correct: unique.indexOf(String(correct)) };
}
function mkQ(text, options, answer, explanation, chapter) {
  return {
    text, textEN: text, textHI: text,
    options, optionsEN: options, optionsHI: options,
    answer, explanation, explanationEN: explanation, explanationHI: explanation,
    subject: "Mathematics", chapter
  };
}
function generateQuestionsForChapters(chapters, count) {
  const generated = [];
  const perChap = Math.ceil(count / chapters.length);
  chapters.forEach(ch => {
    if (!mathGenerators[ch]) return;
    for (let i = 0; i < perChap; i++) {
      try { generated.push(mathGenerators[ch]()); } catch(e) {}
    }
  });
  return shuffleArray(generated).slice(0, count);
}

/* ── State ── */
const defaultTests = {
  foundation: {
    title: "Foundation Practice Test",
    minutes: 15,
    marksPerQuestion: 2,
    negativeEnabled: false,
    negativeMarks: 0,
    questions: [
      { textEN: "2 + 2 = ?", textHI: "2 + 2 = ?", text: "2 + 2 = ?",
        options: ["1","2","3","4"], optionsEN: ["1","2","3","4"], optionsHI: ["1","2","3","4"],
        answer: 3, subject: "Mathematics", chapter: "Number System",
        explanationEN: "2 + 2 = 4", explanationHI: "2 + 2 = 4" }
    ]
  }
};

let tests = { ...defaultTests };
let remoteTests = {};
let deletedTestIds = new Set();
let deletedQuestions = []; // Recycle Bin
let selectedTrashIds = new Set(); // Recycle Bin: selective restore selection
let draftQuestions = [];
let questionBank = [];
window.questionBank = questionBank;
let editingTestId = null;
let editingBankId = null;
let approvingAppScriptDraftId = null;
let editingDraftIndex = null;
let testSections = [{ id: "sec-1", title: "Section A", marksPerQuestion: null }];
let activeSectionId = "sec-1";
let pdfDraftQuestions = [];
let appScriptDraftQuestions = [];
let studentTestMode = "saved";
let records = [];
let currentDetails = []; // stores last test result details
let currentSolIndex = 0;
let currentSolLang = "hi";

let current = {
  testId: "",
  test: null,
  index: 0,
  answers: [],
  marked: [],
  visited: [],
  timerId: null,
  remaining: 0,
  student: {},
  startedAt: null,
  lang: "hi"
};

const $ = sel => document.querySelector(sel);

/* ── DOM Ready ── */
document.addEventListener("DOMContentLoaded", init);

function bindEvent(sel, evt, fn) { const el = document.querySelector(sel); if(el) el[evt] = fn; }

function init() {
  // Dark mode removed
  document.body.classList.remove("dark-mode");
  localStorage.removeItem("savya_dark_mode");
  // Tabs
  bindEvent("#student-tab", 'onclick', () => showMode("student"));
  bindEvent("#leaderboard-tab", 'onclick', () => showMode("leaderboard"));
  bindEvent("#admin-tab", 'onclick', () => showMode("admin"));
  bindEvent("#tests-tab", 'onclick', () => showAdminTab("tests"));
  bindEvent("#bank-tab", 'onclick', () => { showAdminTab("bank"); renderBank(); });
  bindEvent("#records-tab", 'onclick', () => {
    // Refresh from localStorage before showing
    try {
      const local = JSON.parse(localStorage.getItem("savya_records") || "[]");
      const db = getDB();
      if (!db && local.length > 0) { records = local; }
      else if (!db) { records = []; }
    } catch(e) {}
    showAdminTab("records");
    renderRecords();
  });
  bindEvent("#generator-tab", 'onclick', () => showAdminTab("generator"));
  bindEvent("#bulk-upload-tab", 'onclick', () => showAdminTab("bulk-upload"));
  bindEvent("#doubts-tab", 'onclick', () => showAdminTab("doubts"));
  bindEvent("#omr-tab", 'onclick', () => showAdminTab("omr"));
  bindEvent("#grade-tab", 'onclick', () => showAdminTab("grade"));
  bindEvent("#add-test-section", 'onclick', addTestSection);
  bindEvent("#save-draft-btn", 'onclick', saveAsDraft);
  const params = new URLSearchParams(window.location.search);
  let adminAutoShown = false;
  if (params.get("admin") === "1" && sessionStorage.getItem("admin_logged_in") === "true") {
    adminAutoShown = true;
    showMode("admin");
    $("#admin-login-form").classList.add("hidden");
    $("#admin-panel").classList.remove("hidden");
    startAdminSyncs();
    const tab = params.get("tab") || "tests";
    showAdminTab(tab);
    if (tab === "bank") renderBank();
    // Scroll past the Firebase seed banner straight to the relevant admin
    // section, so "Back" from the generator lands where the user expects
    // instead of at the very top of the admin panel.
    setTimeout(() => {
      const target = document.getElementById(`${tab}-area`) || document.getElementById(`${tab}-box`);
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 10;
        window.scrollTo({ top, left: 0, behavior: "instant" });
      }
    }, 50);
  }

  // Forms
  bindEvent("#admin-login-form", 'onsubmit', loginAdmin);
  bindEvent("#student-form", 'onsubmit', startTest);
  bindEvent("#student-login-form", 'onsubmit', loginStudent);
  bindEvent("#student-register-form", 'onsubmit', registerStudent);
  bindEvent("#student-forgot-form", 'onsubmit', resetStudentPassword);
  bindEvent("#student-login-mode-btn", 'onclick', () => showStudentAuthPanel("login"));
  bindEvent("#student-register-mode-btn", 'onclick', () => showStudentAuthPanel("register"));
  bindEvent("#student-forgot-link", 'onclick', () => showStudentAuthPanel("forgot"));
  bindEvent("#student-forgot-back-link", 'onclick', () => showStudentAuthPanel("login"));
  bindEvent("#student-logout-btn", 'onclick', logoutStudent);
  bindEvent("#test-form", 'onsubmit', saveTest);
  bindEvent("#bank-form", 'onsubmit', saveBankQuestion);
  bindEvent("#bank-modal-close-x", 'onclick', cancelBankEdit);
  bindEvent("#bank-edit-modal", 'onclick', (e) => { if (e.target.id === 'bank-edit-modal') cancelBankEdit(); });
  bindEvent("#bank-subject-filter", 'onchange', () => {
    const chap = $("#bank-chapter-filter");
    if (chap) chap.value = "all";
    bankIdFilterQuery = "";
    const idInput = $("#bank-id-search-input");
    if (idInput) idInput.value = "";
    renderBank();
  });
  bindEvent("#bank-chapter-filter", 'onchange', () => {
    bankIdFilterQuery = "";
    const idInput = $("#bank-id-search-input");
    if (idInput) idInput.value = "";
    renderBank();
  });
  bindEvent("#test-bank-subject-filter", 'onchange', () => {
    const chap = $("#test-bank-chapter-filter");
    if (chap) chap.value = "all";
    renderTestBankPicker();
  });
  bindEvent("#test-bank-chapter-filter", 'onchange', renderTestBankPicker);
  bindEvent("#test-negative-enabled", 'onchange', toggleNegativeField);
  // Buttons
  bindEvent("#add-question", 'onclick', addDraftQuestion);
  bindEvent("#cancel-bank-edit", 'onclick', cancelBankEdit);
  bindEvent("#prev-question", 'onclick', () => moveQuestion(-1));
  bindEvent("#next-question", 'onclick', () => moveQuestion(1));
  bindEvent("#clear-response", 'onclick', clearResponse);
  bindEvent("#mark-review", 'onclick', markForReview);
  bindEvent("#exam-back", 'onclick', backHome);
  bindEvent("#submit-test", 'onclick', confirmSubmit);
  bindEvent("#back-home", 'onclick', backHome);
  bindEvent("#clear-records", 'onclick', clearRecords);
  bindEvent("#result-test-select", 'onchange', renderStudentResultSheet);
  bindEvent("#view-solution", 'onclick', initSolutionReview);
  bindEvent("#solution-back", 'onclick', showResultFromSolution);
  const seedBtn = $("#seed-questions-btn");
  if (seedBtn) seedBtn.onclick = seedAllQuestions;
  bindEvent("#change-admin-password-btn", "onclick", changeAdminPassword);
  bindEvent("#set-recovery-btn", "onclick", setRecoveryQuestion);
  bindEvent("#forgot-password-link", "onclick", forgotPassword);
  bindEvent("#admin-reset-student-btn", "onclick", adminResetStudentPassword);

  // Exam language toggle
  ["en","hi","both"].forEach(l => {
    bindEvent(`#lang-${l}`, "onclick", () => setExamLang(l));
  });
  // Solution language toggle
  ["en","hi","both"].forEach(l => {
    bindEvent(`#sol-lang-${l}`, "onclick", () => setSolLang(l));
  });
  // Solution nav
  bindEvent("#sol-prev", 'onclick', () => moveSolQuestion(-1));
  bindEvent("#sol-next", 'onclick', () => moveSolQuestion(1));

  // Start sync
  // NOTE: syncBank/syncTrashBin/syncPdfDrafts/syncAppScriptDrafts yahan
  // se hata diye — ye sirf ADMIN panel ke liye zaroori data hain
  // (poora questionBank, recycle bin, PDF drafts, AppScript drafts), aur
  // pehle har student ke page load par bhi ye 4 live Firestore listeners
  // chalu ho jaate the, jo unnecessary data download karke question
  // reload/page load ko dheema kar rahe the. Ab ye sirf startAdminSyncs()
  // se, admin panel khulne par hi start hote hain (neeche enterAdminPanel
  // aur auto-admin-login path dono jagah call kiya gaya hai).
  syncTests();
  syncDeletedTests();
  syncRecords();
  renderTestSections();

  // ── "Stay logged in" fix ────────────────────────────────────────
  // Student session pehle se localStorage mein save hoti thi (browser
  // band karke dobara kholne par bhi wahan rehti hai), lekin page load
  // hote hi app kisi bhi tab/mode ko default select hi nahi karta tha —
  // isliye har baar khaali/login screen dikh jaata tha chahe session
  // valid ho. Ab (jab tak admin auto-login active na ho) hum seedha
  // "Student" mode default dikhate hain, jo khud getStudentSession()
  // check karke — agar login already hai — seedha "Start Your Test"
  // screen dikha deta hai, warna login form.
  if (!adminAutoShown) showMode("student");

  // Recover any draft that was saved on page close/refresh
  recoverEmergencyDraft();
}

async function seedAllQuestions() {
  const btn = $("#seed-questions-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Seeding... Please wait"; }
  try {
    let msg = "";
    if (typeof window.seedMathematicsQuestionBank === "function") {
      await window.seedMathematicsQuestionBank();
      msg += "Mathematics, ";
    }
    if (typeof window.seedHistoryQuestionBank === "function") {
      await window.seedHistoryQuestionBank();
      msg += "History (Europe), ";
    }
    if (typeof window.seedHistoryIndiaQuestionBank === "function") {
      await window.seedHistoryIndiaQuestionBank();
      msg += "History (India), ";
    }
    if (typeof window.seedIndochinaQuestionBank === "function") {
      await window.seedIndochinaQuestionBank();
      msg += "History (Indochina), ";
    }
    if (typeof window.seedSocialismQuestionBank === "function") {
      await window.seedSocialismQuestionBank();
      msg += "History (Socialism), ";
    }
    alert("🎉 " + msg + "questions seeded to Firebase! Refresh kar lo.");
  } catch (err) {
    console.error(err);
    alert("❌ Seed failed: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🌱 Seed Math Questions to Firebase"; }
  }
}

/* ══════════════════════════════════════════
   MODE SWITCHING
══════════════════════════════════════════ */
function showMode(mode) {
  // Auto-save draft when admin switches to student mode
  if (mode === "student") {
    const wasOnTests = !$("#tests-area")?.classList.contains("hidden");
    if (wasOnTests) autoSaveDraftSilently();
  }

  ["student","admin","leaderboard"].forEach(m => {
    const tab = $(`#${m}-tab`);
    if (tab) tab.classList.toggle("active", m === mode);
  });

  if (mode === "student") {
    const session = getStudentSession();
    if (session) {
      $("#student-auth-screen")?.classList.add("hidden");
      $("#student-form")?.classList.remove("hidden");
      populateStudentFormFromSession(session);
    } else {
      $("#student-auth-screen")?.classList.remove("hidden");
      $("#student-form")?.classList.add("hidden");
      showStudentAuthPanel("login");
    }
  } else {
    $("#student-auth-screen")?.classList.add("hidden");
    $("#student-form")?.classList.add("hidden");
  }

  const adminLoginShown = !$("#admin-panel").classList.contains("hidden");
  $("#admin-login-form").classList.toggle("hidden", mode !== "admin" || adminLoginShown);
  if (mode !== "admin") $("#admin-panel").classList.add("hidden");
  const lbSection = $("#leaderboard-section");
  if (lbSection) {
    lbSection.classList.toggle("hidden", mode !== "leaderboard");
    if (mode === "leaderboard") initLeaderboard();
  }
}

/* ══════════════════════════════════════════
   STUDENT ACCOUNTS (Register / Login / Forgot)
   Stored in Firestore "students" collection, keyed by 10-digit mobile.
══════════════════════════════════════════ */
const STUDENT_SESSION_KEY = "savya_student_session";
const STUDENTS_COLLECTION = "students";
// Password/PIN hashes ab yahan nahi, ek alag locked-down collection mein rehte
// hain jise koi bhi client seedha padh nahi sakta (sirf admin). Dekhein neeche
// loginStudent/resetStudentPassword mein "proof write" wala tareeka.
const STUDENT_SECRETS_COLLECTION = "studentSecrets";

function normalizeMobile(m) { return (m || "").replace(/\D/g, "").slice(-10); }

function getStudentSession() {
  try { return JSON.parse(localStorage.getItem(STUDENT_SESSION_KEY) || "null"); }
  catch (e) { return null; }
}
function setStudentSession(data) { localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(data)); }
function clearStudentSession() { localStorage.removeItem(STUDENT_SESSION_KEY); }

function populateStudentFormFromSession(session) {
  const nameEl = $("#student-name");
  const mobileEl = $("#student-mobile");
  if (nameEl) nameEl.value = session.name;
  if (mobileEl) mobileEl.value = session.mobile;
  const welcomeName = $("#student-welcome-name");
  if (welcomeName) welcomeName.textContent = session.name;
}

function showStudentAuthPanel(which) {
  $("#student-login-form")?.classList.toggle("hidden", which !== "login");
  $("#student-register-form")?.classList.toggle("hidden", which !== "register");
  $("#student-forgot-form")?.classList.toggle("hidden", which !== "forgot");
  $("#student-login-mode-btn")?.classList.toggle("active", which === "login");
  $("#student-register-mode-btn")?.classList.toggle("active", which === "register");
}

async function registerStudent(e) {
  e.preventDefault();
  const name = $("#register-name").value.trim();
  const mobile = normalizeMobile($("#register-mobile").value);
  const pass = $("#register-password").value;
  const confirmPass = $("#register-password-confirm").value;
  const pin = $("#register-pin").value.trim();

  if (!name || name.length < 2) { alert("⚠️ Kripya apna naam likhein (kam se kam 2 akshar)."); return; }
  if (!/^\d{10}$/.test(mobile)) { alert("⚠️ Kripya sahi 10-digit mobile number likhein."); return; }
  if (!pass || pass.length < 4) { alert("⚠️ Password kam se kam 4 characters ka hona chahiye."); return; }
  if (pass !== confirmPass) { alert("⚠️ Password match nahi hua."); return; }
  if (!/^\d{4}$/.test(pin)) { alert("⚠️ Security PIN theek 4 digit ka hona chahiye — ye password bhool jaane par kaam aayega, isliye yaad rakhein."); return; }

  const db = getDB();
  if (!db) { alert("⚠️ Internet/Firebase connection nahi hai. Thodi der baad try karein."); return; }
  try {
    const ref = db.collection(STUDENTS_COLLECTION).doc(mobile);
    const snap = await ref.get();
    if (snap.exists) {
      alert("Ye mobile number pehle se register hai. Kripya Login karein.");
      showStudentAuthPanel("login");
      return;
    }
    const hash = await sha256(pass);
    const pinHash = await sha256(pin);
    // ── SECURITY: hash/pinHash ab "studentSecrets" collection mein jaate hain,
    // jise koi bhi client (student ho ya attacker) seedha kabhi padh nahi sakta —
    // sirf admin. "students" doc mein sirf naam/mobile/hasPin flag rehta hai.
    await db.collection(STUDENT_SECRETS_COLLECTION).doc(mobile).set({
      hash, pinHash, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await ref.set({ name, mobile, hasPin: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    setStudentSession({ name, mobile });
    showMode("student");
  } catch (err) {
    console.error(err);
    alert("Registration fail hua. Firestore rules/connection check karein.");
  }
}

async function loginStudent(e) {
  e.preventDefault();
  const mobile = normalizeMobile($("#login-mobile").value);
  const pass = $("#login-password").value;
  if (!/^\d{10}$/.test(mobile)) { alert("⚠️ Kripya sahi 10-digit mobile number likhein."); return; }
  if (!pass) { alert("⚠️ Password likhein."); return; }

  const db = getDB();
  if (!db) { alert("⚠️ Internet/Firebase connection nahi hai. Thodi der baad try karein."); return; }
  try {
    const ref = db.collection(STUDENTS_COLLECTION).doc(mobile);
    const snap = await ref.get();
    if (!snap.exists) { alert("Ye mobile number register nahi hai. Pehle Register karein."); showStudentAuthPanel("register"); return; }
    const data = snap.data();
    const hash = await sha256(pass);

    if (data.hash) {
      // ── LEGACY account: purane system mein hash/pinHash abhi bhi seedha
      // "students" doc mein hai (naye secure system se pehle ka data). Isse
      // ek baar compare karke, turant naye locked "studentSecrets" collection
      // mein migrate kar dete hain aur purane doc se hash/pinHash hata dete
      // hain — taaki agli baar se ye account bhi fully secure ho jaaye.
      if (hash !== data.hash) { alert("Galat password."); return; }
      try {
        await db.collection(STUDENT_SECRETS_COLLECTION).doc(mobile).set({
          hash: data.hash,
          pinHash: data.pinHash || null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await ref.set({
          hasPin: !!data.pinHash,
          hash: firebase.firestore.FieldValue.delete(),
          pinHash: firebase.firestore.FieldValue.delete()
        }, { merge: true });
      } catch (migErr) {
        console.error("Legacy secret migration failed:", migErr);
      }
      setStudentSession({ name: data.name, mobile });
      showMode("student");
      if (!data.pinHash) setTimeout(() => promptSetSecurityPin(mobile), 400);
      return;
    }

    // ── Naya/migrated account: hash kabhi client se seedha padha nahi jaata.
    // Iski jagah hum ek "proof" write try karte hain (sha256(entered password)),
    // jise Firestore Rules khud, server-side, stored hash se compare karti hain.
    // Galat password = ye write "permission-denied" ke saath fail ho jaata hai.
    try {
      await db.collection(STUDENT_SECRETS_COLLECTION).doc(mobile).set({
        lastLoginProof: hash,
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (proofErr) {
      alert("Galat password.");
      return;
    }

    setStudentSession({ name: data.name, mobile });
    showMode("student");
    // Purane accounts jinme Security PIN set nahi hai — ab jab pass sahi pata
    // hai (matlab ye account ka asli malik hai), to ek PIN set karwa lete hain
    // taaki aage "forgot password" surakshit ho sake.
    if (!data.hasPin) {
      setTimeout(() => promptSetSecurityPin(mobile), 400);
    }
  } catch (err) {
    console.error(err);
    alert("Login fail hua. Firestore rules/connection check karein.");
  }
}

async function promptSetSecurityPin(mobile) {
  const pin = prompt("🔒 Aapke account mein abhi Security PIN set nahi hai.\n\nYe PIN password bhool jaane par account verify karne ke kaam aayega — ise ab set kar lein (4 digit number):");
  if (!pin) return;
  if (!/^\d{4}$/.test(pin)) { alert("PIN theek 4 digit ka hona chahiye. Baad mein dobara try kar sakte hain."); return; }
  try {
    const db = getDB();
    const pinHash = await sha256(pin);
    // Rule: pinHash sirf pehli baar hi set ho sakta hai (jab tak abhi set na
    // ho) — koi baad mein ise seedha overwrite nahi kar sakta bina purana
    // PIN proof diye. hasPin flag "students" doc mein hai taaki app bina
    // secret padhe bhi check kar sake ki PIN set hai ya nahi.
    await db.collection(STUDENT_SECRETS_COLLECTION).doc(mobile).set({ pinHash }, { merge: true });
    await db.collection(STUDENTS_COLLECTION).doc(mobile).set({ hasPin: true }, { merge: true });
    alert("✅ Security PIN set ho gaya. Ise yaad rakhein.");
  } catch (err) {
    console.error(err);
    alert("PIN set nahi ho paaya. Baad mein dobara try karein.");
  }
}

async function resetStudentPassword(e) {
  e.preventDefault();
  const mobile = normalizeMobile($("#forgot-mobile").value);
  const pin = $("#forgot-pin").value.trim();
  const pass = $("#forgot-new-password").value;
  const confirmPass = $("#forgot-new-password-confirm").value;
  if (!/^\d{10}$/.test(mobile)) { alert("⚠️ Kripya sahi 10-digit mobile number likhein."); return; }
  if (!/^\d{4}$/.test(pin)) { alert("⚠️ Security PIN theek 4 digit ka hona chahiye."); return; }
  if (!pass || pass.length < 4) { alert("⚠️ Password kam se kam 4 characters ka hona chahiye."); return; }
  if (pass !== confirmPass) { alert("⚠️ Password match nahi hua."); return; }

  const db = getDB();
  if (!db) { alert("⚠️ Internet/Firebase connection nahi hai."); return; }
  try {
    const ref = db.collection(STUDENTS_COLLECTION).doc(mobile);
    const snap = await ref.get();
    if (!snap.exists) { alert("Ye mobile number register nahi hai. Pehle Register karein."); showStudentAuthPanel("register"); return; }
    const data = snap.data();
    const pinHash = await sha256(pin);
    const hash = await sha256(pass);

    if (data.pinHash) {
      // ── LEGACY account: pinHash abhi bhi seedha "students" doc mein hai.
      // Ek baar compare karke naye locked system mein migrate kar dete hain.
      if (pinHash !== data.pinHash) { alert("Galat Security PIN. Password reset nahi kiya ja sakta."); return; }
      await db.collection(STUDENT_SECRETS_COLLECTION).doc(mobile).set({
        hash, pinHash: data.pinHash, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await ref.set({
        hasPin: true,
        hash: firebase.firestore.FieldValue.delete(),
        pinHash: firebase.firestore.FieldValue.delete()
      }, { merge: true });
      alert("✅ Password reset ho gaya. Ab naye password se login karein.");
      showStudentAuthPanel("login");
      return;
    }

    if (!data.hasPin) {
      alert("⚠️ Is account mein Security PIN set nahi hai (purana account).\n\nKripya pehle apne asli password se normal LOGIN karein — login karte hi app aapse PIN set karwa dega, uske baad 'Password bhool gaye' kaam karega.\n\nAgar password bhi yaad nahi hai, to apne Admin/Teacher se sampark karein — wo aapka password reset kar sakte hain.");
      return;
    }

    // ── PIN yahan bhi kabhi client se seedha padha nahi jaata. Hum naya
    // password set karne ki koshish karte hain aur saath mein sha256(entered
    // PIN) bhejte hain "pinProof" ke roop mein — Firestore Rules khud,
    // server-side, ise stored pinHash se compare karti hain. Galat PIN =
    // ye write "permission-denied" ke saath fail ho jaata hai, koi secret
    // client tak kabhi nahi pahunchta.
    try {
      await db.collection(STUDENT_SECRETS_COLLECTION).doc(mobile).set({
        hash, pinProof: pinHash
      }, { merge: true });
    } catch (proofErr) {
      alert("Galat Security PIN. Password reset nahi kiya ja sakta.");
      return;
    }
    alert("✅ Password reset ho gaya. Ab naye password se login karein.");
    showStudentAuthPanel("login");
  } catch (err) {
    console.error(err);
    alert("Password reset nahi hua. Firestore rules/connection check karein.");
  }
}

// ── Admin-only: force-reset a student's password ──────────────────
// Emergency escape hatch for students who forgot both their password
// AND their security PIN, or old accounts with no PIN at all.
// Sirf admin (isAdmin() rule ke bharose) ye kar sakta hai — student
// ki identity WhatsApp/class mein confirm karke hi use karein.
async function adminResetStudentPassword() {
  if (sessionStorage.getItem("admin_logged_in") !== "true") {
    alert("Pehle admin login karein.");
    return;
  }
  const mobile = normalizeMobile($("#admin-reset-student-mobile").value);
  const pass = $("#admin-reset-student-pass").value;
  if (!/^\d{10}$/.test(mobile)) { alert("⚠️ Sahi 10-digit student mobile number likhein."); return; }
  if (!pass || pass.length < 4) { alert("⚠️ Naya password kam se kam 4 characters ka hona chahiye."); return; }
  if (!confirm(`Student ki mobile ${mobile} ka password reset karein? Pehle unki identity confirm kar chuke hain?`)) return;

  const db = getDB();
  if (!db) { alert("⚠️ Internet/Firebase connection nahi hai."); return; }
  try {
    // Admin ke paas studentSecrets collection ka full read/write hai (isAdmin()
    // rule), isliye admin seedha hash update kar sakta hai — students ke liye
    // ye collection hamesha locked rehti hai.
    const secRef = db.collection(STUDENT_SECRETS_COLLECTION).doc(mobile);
    const secSnap = await secRef.get();
    const studentSnap = await db.collection(STUDENTS_COLLECTION).doc(mobile).get();
    if (!secSnap.exists && !studentSnap.exists) { alert("Ye mobile number kisi student ke record mein nahi mila."); return; }
    const hash = await sha256(pass);
    await secRef.set({ hash }, { merge: true });
    // Agar ye ek purana (legacy, abhi tak login na kiya hua) account hai jiska
    // hash abhi bhi seedha "students" doc mein pada hai, use bhi hata dete hain.
    if (studentSnap.exists && studentSnap.data().hash) {
      await db.collection(STUDENTS_COLLECTION).doc(mobile).set({
        hasPin: !!studentSnap.data().pinHash,
        hash: firebase.firestore.FieldValue.delete()
      }, { merge: true });
    }
    alert("✅ Student ka password reset ho gaya. Unhe naya password bata dein.");
    $("#admin-reset-student-mobile").value = "";
    $("#admin-reset-student-pass").value = "";
  } catch (err) {
    console.error(err);
    alert("Reset nahi hua: " + (err.message || err));
  }
}

function logoutStudent() {
  clearStudentSession();
  showMode("student");
}

function showAdminTab(tab) {
  // Auto-save draft when navigating away from tests tab
  const wasOnTests = !$("#tests-area").classList.contains("hidden");
  if (wasOnTests && tab !== "tests") {
    autoSaveDraftSilently();
  }

  ["tests","bank","bulk-upload","records","generator","trash","doubts","omr","grade"].forEach(t => {
    $(`#${t}-tab`)?.classList.toggle("active", t === tab);
  });
  $("#tests-area").classList.toggle("hidden", tab !== "tests");
  $("#bank-box").classList.toggle("hidden", tab !== "bank");
  $("#bulk-upload-box").classList.toggle("hidden", tab !== "bulk-upload");
  $("#records-box").classList.toggle("hidden", tab !== "records");
  $("#generator-box").classList.toggle("hidden", tab !== "generator");
  $("#trash-box").classList.toggle("hidden", tab !== "trash");
  $("#doubts-box")?.classList.toggle("hidden", tab !== "doubts");
  $("#omr-box")?.classList.toggle("hidden", tab !== "omr");
  $("#grade-box")?.classList.toggle("hidden", tab !== "grade");
  document.querySelector(".main-wrap")?.classList.toggle("wide-mode", tab === "generator");
  if (tab === "bank") renderBank();
  if (tab === "doubts" && window.SavyaExtras) window.SavyaExtras.renderAdminDoubts();
  if (tab === "tests") renderTestSections();
  if (tab === "trash") renderTrashBin();
  if (tab === "records" && !allStudentsCache.length) loadStudentsDirectory();
  if (tab === "grade") renderGradeTestSelect();
}

// ── Secure admin login (real Firebase Authentication) ──────────────
// PEHLE: admin password sirf ek custom SHA-256 hash tha jo Firestore
// mein khule (open) rules ke bharose store hota tha — koi bhi jo
// Firestore access kar sakta tha wo hash chura/badal sakta tha.
//
// AB: asli Firebase Authentication (email + password) use hoti hai.
// Password Google/Firebase ke secure servers par hash hokar store
// hota hai, aur firestore.rules mein sirf allow-listed admin email
// hi likh/delete kar sakta hai (function isAdmin() dekhein).
//
// Purane users ke liye smooth migration: agar legacy default
// ID+password ("thevishnusharma" / "@admin") se login kiya jaaye,
// to ek baar real email+password poochh kar naya secure Firebase
// Auth account bana diya jaata hai — DATA ya login flow kuch tootta
// nahi hai.
const DEFAULT_ADMIN_ID = "thevishnusharma";
const DEFAULT_ADMIN_LEGACY_PASSWORD = "@admin";
const ADMIN_EMAIL_LOCAL_KEY = "savya_admin_email"; // sirf UI convenience ke liye, security yahan se nahi aati

// Student registration/login abhi bhi is simple hash se chalte hain
// (custom mobile+password system, Firebase Auth se alag).
function sha256(str) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join(""));
}

function isEmailLike(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}
function validateAdminPassword(pass) {
  if (!pass || pass.length < 8) return "Password kam se kam 8 characters ka hona chahiye.";
  if (!/[A-Za-z]/.test(pass) || !/[0-9]/.test(pass)) return "Password mein letters aur numbers dono hone chahiye.";
  return "";
}
function getAuth() {
  return window.vishnuFirebase && window.vishnuFirebase.auth ? window.vishnuFirebase.auth : null;
}
function rememberAdminEmail(email) {
  try { localStorage.setItem(ADMIN_EMAIL_LOCAL_KEY, email); } catch (e) {}
}
function getRememberedAdminEmail() {
  try { return localStorage.getItem(ADMIN_EMAIL_LOCAL_KEY) || ""; } catch (e) { return ""; }
}

let _adminSyncsStarted = false;
function startAdminSyncs() {
  if (_adminSyncsStarted) return; // dobara panel kholne par dobara subscribe na ho
  _adminSyncsStarted = true;
  syncBank();
  syncTrashBin();
  syncPdfDrafts();
  syncAppScriptDrafts();
}

function enterAdminPanel() {
  $("#admin-login-form").classList.add("hidden");
  $("#admin-panel").classList.remove("hidden");
  sessionStorage.setItem("admin_logged_in", "true");
  startAdminSyncs();
  showAdminTab("tests");
}

async function loginAdmin(e) {
  e.preventDefault();
  const auth = getAuth();
  if (!auth) { alert("⚠️ Firebase Auth load nahi hua. Page reload karke dobara try karein."); return; }

  const enteredId = $("#admin-id").value.trim();
  const enteredPass = $("#admin-password").value;

  // Admin ID field mein ya to real email daal sakte hain, ya (purane
  // users ke liye) legacy username "thevishnusharma".
  const candidateEmail = isEmailLike(enteredId) ? enteredId : getRememberedAdminEmail();

  if (candidateEmail) {
    try {
      await auth.signInWithEmailAndPassword(candidateEmail, enteredPass);
      rememberAdminEmail(candidateEmail);
      enterAdminPanel();
      return;
    } catch (err) {
      console.warn("[admin] Firebase sign-in failed", err.code);
      // Neeche legacy/migration path try karenge
    }
  }

  // ── Legacy migration path: sirf tab jab default legacy credentials
  //    match karein (purana system) ──
  const legacyOk = (enteredId === DEFAULT_ADMIN_ID && enteredPass === DEFAULT_ADMIN_LEGACY_PASSWORD);
  if (!legacyOk) {
    alert("Galat Admin ID ya Password.");
    return;
  }

  alert("⚠️ Security Alert: Purana default password detect hua!\n\nAb ek secure Firebase login set karte hain. Apna asli email address istemal karein — isi se aage login aur 'password bhool gaye' dono kaam karenge.");
  const email = prompt("Apna real email address likhein:");
  if (!email || !isEmailLike(email)) { alert("Sahi email address zaroori hai."); return; }
  const newPass = prompt("Ab ek naya strong password likhein:\nMinimum 8 characters, letters + numbers");
  const error = validateAdminPassword(newPass || "");
  if (error) { alert(error + "\n\nAdmin login ke liye strong password banana zaroori hai."); return; }
  const confirmPass = prompt("Naya password dobara likhein:");
  if (newPass !== confirmPass) { alert("Password match nahi hua."); return; }

  try {
    await auth.createUserWithEmailAndPassword(email.trim(), newPass);
  } catch (err) {
    console.error(err);
    alert("Account create nahi hua: " + (err.message || err));
    return;
  }
  rememberAdminEmail(email.trim());
  alert("✅ Secure admin account ban gaya (" + email.trim() + ").\n\n⚠️ ZAROORI STEP: Firebase Console mein firestore.rules file open karke ADMIN_EMAILS list mein ye email add karein aur publish karein — tabhi ye account admin ki tarah likh/delete kar payega. Details ke liye FIREBASE_SECURITY_SETUP.md dekhein.");
  enterAdminPanel();
}

async function changeAdminPassword() {
  const auth = getAuth();
  const user = auth && auth.currentUser;
  if (sessionStorage.getItem("admin_logged_in") !== "true" || !user) {
    alert("Pehle admin login karein.");
    return;
  }
  const currentPass = prompt("Current admin password likhein (confirm karne ke liye):");
  if (currentPass === null) return;
  const newPass = prompt("Naya strong password likhein:\nMinimum 8 characters, letters + numbers");
  const error = validateAdminPassword(newPass || "");
  if (error) { alert(error); return; }
  const confirmPass = prompt("Naya password dobara likhein:");
  if (newPass !== confirmPass) { alert("Password match nahi hua."); return; }

  try {
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPass);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newPass);
    alert("✅ Admin password change ho gaya.");
  } catch (err) {
    console.error(err);
    alert("Password change nahi hua: Current password galat hai ya connection issue hai.");
  }
}

// ── "Recovery question" button ab sirf info dikhata hai — asli
//    reset Firebase ke real email link se hota hai (forgotPassword). ──
function setRecoveryQuestion() {
  const auth = getAuth();
  const user = auth && auth.currentUser;
  if (sessionStorage.getItem("admin_logged_in") !== "true" || !user) {
    alert("Pehle admin login karein.");
    return;
  }
  alert("ℹ️ Ab password reset 'Password bhool gaye?' link se, aapke registered email (" + user.email + ") par bheje gaye Firebase link se hota hai — koi alag security sawaal set karne ki zaroorat nahi hai.");
}

// ── Forgot Password flow (from login screen) — real email se ──────
async function forgotPassword() {
  const auth = getAuth();
  if (!auth) { alert("⚠️ Firebase Auth load nahi hua. Page reload karein."); return; }
  const email = prompt("Apna admin email address likhein — usi par password reset link bhejenge:", getRememberedAdminEmail());
  if (!email) return;
  if (!isEmailLike(email)) { alert("Sahi email address likhein."); return; }
  try {
    await auth.sendPasswordResetEmail(email.trim());
    alert("✅ Agar ye email admin account se registered hai, to reset link bhej diya gaya hai. Apna inbox (aur spam folder) check karein.");
  } catch (err) {
    console.error(err);
    alert("Reset email bhejne mein dikkat hui: " + (err.message || err));
  }
}

/* ══════════════════════════════════════════
   ANALYSIS
══════════════════════════════════════════ */
function renderAnalysis() {
  const total = sscChaptersData.reduce((s, c) => s + c.count, 0);
  let html = `
    <div class="analysis-table-wrap">
    <table class="analysis-table">
      <thead><tr>
        <th>#</th><th>Chapter / Adhyay</th>
        <th>SSC PDF Analysis (Questions)</th>
        <th>Bank Questions (Actual)</th>
        <th>% Share</th>
      </tr></thead><tbody>`;
  sscChaptersData.forEach((ch, i) => {
    const bankCount = questionBank.filter(q => q.chapter === ch.name && isValidQ(q)).length;
    html += `<tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(ch.name)}</strong></td>
      <td>${ch.count}</td>
      <td style="color:${bankCount>0?'#16a34a':'#dc2626'};font-weight:700">${bankCount > 0 ? bankCount : '❌ 0 — Upload needed'}</td>
      <td><span class="pct-pill">${ch.pct}%</span></td>
    </tr>`;
  });
  html += `</tbody><tfoot><tr>
    <td colspan="2"><strong>Total</strong></td>
    <td><strong>${total}</strong></td>
    <td><strong style="color:#16a34a">${questionBank.filter(isValidQ).length}</strong></td>
    <td><strong>100%</strong></td>
  </tr></tfoot></table></div>
  <p style="margin-top:14px;font-size:.82rem;color:var(--muted);">
    📊 SSC PDF = Past exam paper analysis count &nbsp;|&nbsp; Bank = Firebase mein actual uploaded questions
  </p>`;
  $("#analysis-content").innerHTML = html;
}

function toggleNegativeField() {
  const en = $("#test-negative-enabled").value === "yes";
  $("#negative-marks-field").classList.toggle("hidden", !en);
  if (!en) $("#test-negative").value = 0;
}

/* ══════════════════════════════════════════
   CHAPTER LIST FOR CUSTOM TEST
══════════════════════════════════════════ */
function renderCustomChapters() {
  const subject = syncCustomSubjectFilter();
  syncCustomChapterFilter(subject);
}

function getSelectedChapters() {
  const subject = $("#custom-subject-filter")?.value || "all";
  const chapter = $("#custom-chapter-filter")?.value || "all";
  if (chapter !== "all") return [chapter];
  return [...new Set(questionBank
    .filter(q => isValidQ(q) && (subject === "all" || getQuestionSubject(q) === subject))
    .map(q => q.chapter)
    .filter(Boolean)
  )].sort();
}

function getQuestionSubject(q) {
  if (window.SubjectResolver) {
    return window.SubjectResolver.resolveQuestionSubject(q, q?.id);
  }
  return q?.subject || "General";
}

function getCustomSubjectOptions() {
  const pool = questionBank.filter(isValidQ);
  if (window.SubjectResolver) {
    return window.SubjectResolver.getSubjectFilterOptions(pool, getQuestionSubject);
  }
  return [...new Set(pool.map(getQuestionSubject).filter(Boolean))].sort();
}

function getBankSubjectFilterOptions() {
  // Sirf wahi subjects dikhao jisme kam se kam 1 question ho
  const activeSubjects = [...new Set(questionBank.map(getQuestionSubject).filter(Boolean))];
  if (window.SubjectResolver) {
    const standard = window.SubjectResolver.STANDARD_SUBJECTS;
    return [...new Set([...standard.filter(s => activeSubjects.includes(s)), ...activeSubjects])]
      .filter(s => activeSubjects.includes(s))
      .sort((a, b) => {
        const ai = standard.indexOf(a), bi = standard.indexOf(b);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1; if (bi >= 0) return 1;
        return a.localeCompare(b);
      });
  }
  return activeSubjects.sort();
}

function syncCustomSubjectFilter() {
  const sel = $("#custom-subject-filter");
  if (!sel) return "all";
  const subjects = getCustomSubjectOptions();
  const cur = sel.value || "all";
  fillFilter(sel, subjects, cur, "— None (All subjects) —");
  return sel.value;
}

function getCustomChapterOptions(subject) {
  return [...new Set(questionBank
    .filter(q => isValidQ(q) && (subject === "all" || getQuestionSubject(q) === subject))
    .map(q => q.chapter)
    .filter(Boolean)
  )].sort();
}

function syncCustomChapterFilter(subject) {
  const sel = $("#custom-chapter-filter");
  if (!sel) return "all";
  const chapters = getCustomChapterOptions(subject);
  const cur = sel.value || "all";
  fillFilter(sel, chapters, cur, "— None (All chapters) —");
  return sel.value;
}

/* ══════════════════════════════════════════
   START TEST
══════════════════════════════════════════ */
function validateStudentForm() {
  const name   = $("#student-name").value.trim();
  const mobile = $("#student-mobile").value.trim();

  if (!name || name.length < 2) {
    alert("⚠️ Kripya apna naam likhein (kam se kam 2 akshar).");
    return false;
  }
  if (!/^\d{10}$/.test(mobile)) {
    alert("⚠️ Kripya sahi 10-digit mobile number likhein.");
    return false;
  }
  return true;
}

function startTest(e) {
  e.preventDefault();
  if (!validateStudentForm()) return;
  current.student = {
    name:   $("#student-name").value.trim(),
    mobile: $("#student-mobile").value.trim(),
    email:  ""
  };
  if (studentTestMode === "custom") { alert("Custom Test option remove ho gaya hai — Practice Mode use karein."); return; }
  current.testId = $("#test-select").value;
  current.test   = tests[current.testId];
  if (!current.test) { alert("Koi test nahi mila."); return; }
  const sched = checkTestSchedule(current.test);
  if (!sched.ok) { alert(sched.msg); return; }
  beginExam();
}

function confirmSubmit() {
  if (confirm("Test submit karna chahte hain?")) showResult();
}

/* ══════════════════════════════════════════
   EXAM ENGINE
══════════════════════════════════════════ */
function beginExam() {
  const total = current.test.questions.length;
  if (!total) { alert("Is test mein koi question nahi hai."); return; }
  current.index     = 0;
  current.answers   = Array(total).fill(null);
  current.marked    = Array(total).fill(false);
  current.visited   = Array(total).fill(false);
  current.remaining = (current.test.minutes || 30) * 60;
  current.startedAt = new Date();
  current.lang      = "hi";

  $("#home-screen").classList.add("hidden");
  $("#result-screen").classList.add("hidden");
  $("#solution-screen").classList.add("hidden");
  $("#exam-screen").classList.remove("hidden");
  $("#exam-title").textContent = current.test.title;
  const marks = getMarks(current.test);
  const neg   = getNeg(current.test);
  const secTitles = getTestSectionTitles(current.test);
  const secInfo = secTitles.length > 1 ? ` · ${secTitles.length} sections` : "";
  $("#exam-meta").textContent = `${total} questions · ${current.test.minutes}min · ${marks} marks each${neg > 0 ? ` · Negative ${neg}` : ""}${secInfo}`;
  $("#total-questions").textContent = `Total: ${total} Questions`;
  setExamLang("hi");
  renderQuestion();
  startTimer();
}

function setExamLang(lang) {
  current.lang = lang;
  ["en","hi","both"].forEach(l => document.getElementById(`lang-${l}`).classList.toggle("active", l === lang));
  renderQuestion();
}

function renderQuestion() {
  const q = current.test.questions[current.index];
  current.visited[current.index] = true;

  const banner = $("#exam-section-banner");
  const secTitle = q.section || "";
  const prevSec = current.index > 0 ? (current.test.questions[current.index - 1].section || "") : "";
  if (banner) {
    if (secTitle && (current.index === 0 || secTitle !== prevSec)) {
      // New section started — show banner with section details
      const secDef = (current.test.sections || []).find(s => s.title === secTitle);
      const secMarks = secDef && secDef.marksPerQuestion ? ` · ${secDef.marksPerQuestion} marks/Q` : "";
      const secQCount = current.test.questions.filter(qq => qq.section === secTitle).length;
      banner.innerHTML = `📂 ${escHtml(secTitle)} <small style="opacity:.8;font-size:.85em;">(${secQCount} questions${secMarks})</small>`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  $("#question-count").textContent = `Question ${current.index + 1} of ${current.test.questions.length}`;
  const qMarks = getQuestionMarks(current.test, q);
  $("#question-marks").textContent = `Marks: +${qMarks}${getNeg(current.test) > 0 ? ` / -${getNeg(current.test)}` : ""}`;
  const progressFill = $("#exam-progress-fill");
  if (progressFill) progressFill.style.width = `${((current.index + 1) / current.test.questions.length) * 100}%`;

  const lang = current.lang;
  const tEN = q.textEN || q.text || "";
  const tHI = q.textHI || q.text || "";

  let qText = "";
  if (lang === "en")       qText = tEN || tHI;
  else if (lang === "hi")  qText = tHI || tEN;
  else {
    if (tEN && tHI && tEN !== tHI)
      qText = `<div class="lang-hi">${tHI}</div><div class="lang-en" style="font-size:.9em;color:#555;margin-top:6px;">${tEN}</div>`;
    else qText = tHI || tEN;
  }
  $("#exam-question").innerHTML = stripInlineColors(qText);
  $("#mark-review").textContent = current.marked[current.index] ? "🔖 Unmark Review" : "🔖 Mark For Review";
  $("#exam-options").innerHTML = "";

  if (q.qType === "subjective") {
    const box = document.createElement("div");
    box.className = "subjective-answer-box";
    box.innerHTML = `<textarea id="subjective-answer-input" rows="8" placeholder="Yahan apna jawab likhein..." style="width:100%;font-size:1rem;padding:10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;"></textarea><small style="color:#6b7280;font-size:.78rem;display:block;margin-top:4px;">✏️ Ye subjective question hai — teacher aapka jawab baad mein manually check karke marks denge.</small>`;
    $("#exam-options").appendChild(box);
    const ta = $("#subjective-answer-input");
    ta.value = typeof current.answers[current.index] === "string" ? current.answers[current.index] : "";
    ta.oninput = () => { current.answers[current.index] = ta.value; };
  } else {
    const optsEN = q.optionsEN || q.options || [];
    const optsHI = q.optionsHI || q.options || [];
    const labels = ["A","B","C","D"];

    const mcqLimit = getMcqAttemptLimit();
    const alreadyAnswered = current.answers[current.index] !== null;
    const limitReached = mcqLimit && !alreadyAnswered && countMcqAttempted() >= mcqLimit;

    for (let i = 0; i < 4; i++) {
      const oEN = optsEN[i] || "";
      const oHI = optsHI[i] || "";
      let oText = "";
      if (lang === "en")      oText = oEN || oHI;
      else if (lang === "hi") oText = oHI || oEN;
      else oText = (oHI && oEN && oHI !== oEN) ? `${oHI} / ${oEN}` : oHI || oEN;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = current.answers[current.index] === i ? "selected" : "";
      if (limitReached) {
        btn.classList.add("limit-locked");
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
      }
      btn.innerHTML = `<span class="radio-dot"></span><span><strong>${labels[i]}.</strong> ${escHtml(oText)}</span>`;
      btn.onclick = () => {
        if (mcqLimit && current.answers[current.index] === null && countMcqAttempted() >= mcqLimit) {
          alert(`⚠️ Attempt limit poora ho gaya hai! Aap sirf ${mcqLimit} MCQ questions attempt kar sakte hain. Naya answer dene se pehle kisi answered question ko "Clear Response" karke slot khaali karein.`);
          return;
        }
        current.answers[current.index] = i;
        renderQuestion();
      };
      $("#exam-options").appendChild(btn);
    }

    if (limitReached) {
      const warn = document.createElement("div");
      warn.style.cssText = "margin-top:10px;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;font-size:.85rem;";
      warn.textContent = `⚠️ Attempt limit (${mcqLimit}) poora ho gaya hai. Is question ka answer dene ke liye pehle kisi aur answered question ko "Clear Response" se khaali karein.`;
      $("#exam-options").appendChild(warn);
    }
  }
  renderQuestionNav();
  renderExamStats();
  if (window.renderMathIn) {
    window.renderMathIn($("#exam-question"));
    window.renderMathIn($("#exam-options"));
  }
}

function renderQuestionNav() {
  const nav = $("#question-nav");
  nav.innerHTML = "";
  let lastSec = null;
  current.test.questions.forEach((q, i) => {
    const sec = q.section || "";
    if (sec && sec !== lastSec) {
      // Section label in nav
      const lbl = document.createElement("div");
      lbl.style.cssText = "width:100%;font-size:.7rem;font-weight:700;color:#7c3aed;padding:4px 2px 2px;letter-spacing:.04em;text-transform:uppercase;";
      lbl.textContent = sec;
      nav.appendChild(lbl);
      lastSec = sec;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = i + 1;
    btn.className = getQStatus(i) + (i === current.index ? " active" : "");
    btn.onclick = () => { current.index = i; renderQuestion(); };
    nav.appendChild(btn);
  });
}

function getQStatus(i) {
  if (current.marked[i]) return "review";
  if (current.answers[i] !== null) return "answered";
  if (current.visited[i]) return "not-answered";
  return "not-visited";
}

function renderExamStats() {
  const answered = current.answers.filter(a => a !== null).length;
  const review   = current.marked.filter(Boolean).length;
  const total    = current.test.questions.length;
  const attemptLimit = Number(current.test.attemptLimit) > 0 ? Number(current.test.attemptLimit) : null;
  const mcqAnswered = countMcqAttempted();
  $("#answered-count").textContent  = attemptLimit
    ? `✅ Answered ${answered} (MCQ: ${mcqAnswered} / Limit ${attemptLimit})`
    : `✅ Answered ${answered}`;
  $("#answered-count").style.color = (attemptLimit && mcqAnswered >= attemptLimit) ? "#b91c1c" : "";
  $("#unanswered-count").textContent= `❌ Unanswered ${total - answered}`;
  $("#review-count").textContent    = `🔖 Review ${review}`;
}

function getMcqAttemptLimit() {
  const lim = Number(current.test.attemptLimit) > 0 ? Number(current.test.attemptLimit) : null;
  return lim;
}

function countMcqAttempted() {
  return current.test.questions.reduce((n, q, i) => {
    if (q.qType !== "subjective" && current.answers[i] !== null) n++;
    return n;
  }, 0);
}

function clearResponse()  { current.answers[current.index] = null; renderQuestion(); }
function markForReview()  { current.marked[current.index] = !current.marked[current.index]; renderQuestion(); }
function moveQuestion(step) {
  current.index = Math.max(0, Math.min(current.test.questions.length - 1, current.index + step));
  renderQuestion();
}

function startTimer() {
  clearInterval(current.timerId);
  updateTimer();
  current.timerId = setInterval(() => {
    current.remaining -= 1;
    updateTimer();
    if (current.remaining <= 0) showResult();
  }, 1000);
}
function updateTimer() {
  const m = Math.max(0, Math.floor(current.remaining / 60));
  const s = Math.max(0, current.remaining % 60);
  $("#timer").textContent = `${pad2(m)}:${pad2(s)}`;
  $("#timer").classList.toggle("low-time", current.remaining < 60);
}

/* ══════════════════════════════════════════
   RESULT
══════════════════════════════════════════ */
function checkTestSchedule(test) {
  if (!test.startTime && !test.endTime) return { ok: true };
  const now = new Date();
  if (test.startTime) {
    const start = new Date(test.startTime);
    if (now < start) {
      const diff = start - now;
      const hrs = Math.floor(diff/3600000), mins = Math.floor((diff%3600000)/60000);
      return { ok: false, msg: `⏱️ Ye test ${hrs}h ${mins}m baad open hoga.\nStart time: ${start.toLocaleString("en-IN")}` };
    }
  }
  if (test.endTime) {
    const end = new Date(test.endTime);
    if (now > end) {
      return { ok: false, msg: `🔒 Is test ki time limit khatam ho gayi.\nEnd time: ${end.toLocaleString("en-IN")}` };
    }
  }
  return { ok: true };
}

async function showResult() {
  clearInterval(current.timerId);
  const total   = current.test.questions.length;
  const neg     = getNeg(current.test);
  const negEn   = neg > 0;
  const attemptLimit = Number(current.test.attemptLimit) > 0 ? Number(current.test.attemptLimit) : null;
  let correct = 0, wrong = 0, attemptedSoFar = 0, extraCount = 0, pendingSubjective = 0;

  currentDetails = current.test.questions.map((q, i) => {
    const sel   = current.answers[i];
    const isSubjective = q.qType === "subjective";
    const blank = isSubjective ? (sel === null || sel === undefined || String(sel).trim() === "") : sel === null;
    const right = !isSubjective && sel === q.answer;
    let counted = true;
    if (!blank) {
      attemptedSoFar++;
      if (attemptLimit && attemptedSoFar > attemptLimit) {
        counted = false;
        extraCount++;
      }
    }
    const qM  = getQuestionMarks(current.test, q);  // section-wise marks
    let status, ma;
    if (isSubjective) {
      status = blank ? "Not answered" : !counted ? "Extra (Not Counted)" : "Pending Review";
      ma = 0; // subjective marks await manual grading — added to score later by teacher
      if (!blank && counted) pendingSubjective++;
    } else {
      status = blank ? "Not answered" : !counted ? "Extra (Not Counted)" : right ? "Correct" : "Wrong";
      ma  = (blank || !counted) ? 0 : right ? qM : negEn ? -neg : 0;
    }
    if (counted && !isSubjective) {
      if (right) correct++;
      else if (!blank) wrong++;
    }

    const opEN = q.optionsEN || q.options || [];
    const opHI = q.optionsHI || q.options || [];
    return {
      questionNo: i + 1,
      subject: q.subject || "Mathematics",
      chapter: q.chapter || "",
      section: q.section || "",
      questionEN: q.textEN || q.text || "",
      questionHI: q.textHI || q.text || "",
      optionsEN: opEN, optionsHI: opHI,
      correctAnswer: q.answer,
      studentAnswer: sel,
      qType: isSubjective ? "subjective" : "mcq",
      subjectiveGraded: false,
      status, marksAwarded: ma,
      marksPerQuestion: qM,
      counted,
      explanationEN: q.explanationEN || q.explanation || "",
      explanationHI: q.explanationHI || q.explanation || "",
      reviewed: Boolean(current.marked[i])
    };
  });

  const unattempted = total - correct - wrong - extraCount;
  const attempted   = correct + wrong + extraCount;
  const score       = currentDetails.reduce((s, d) => s + d.marksAwarded, 0);
  const maxScore    = getTestMaxMarks(current.test);
  const pct         = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const accuracy    = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
  const submittedAt = new Date();
  const durSec      = current.startedAt
    ? Math.max(0, Math.round((submittedAt - current.startedAt) / 1000)) : 0;

  // Rank & percentile from records
  const testRecs = [...records.filter(r => r.testId === current.testId), { score }];
  testRecs.sort((a, b) => b.score - a.score);
  const rank  = testRecs.findIndex(r => r.score === score) + 1;
  const total2 = testRecs.length;
  let percentile = 99;
  if (total2 > 1) {
    percentile = Math.round((testRecs.filter(r => r.score < score).length / (total2 - 1)) * 100);
  } else {
    percentile = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }
  percentile = Math.max(0, Math.min(100, percentile));

  // Show screens
  $("#exam-screen").classList.add("hidden");
  $("#result-screen").classList.remove("hidden");

  const pendingRecord = {
    ...current.student,
    testId: current.testId,
    testTitle: current.test.title,
    score,
    maxScore,
    percentage: pct,
    submittedAt: submittedAt.toLocaleString("en-IN"),
    submittedIso: submittedAt.toISOString()
  };
  const rankedRows = getRankedResultsForTest(current.testId, pendingRecord);
  renderBoardResultSheet($("#board-result-sheet"), {
    testTitle: current.test.title,
    maxScore,
    date: submittedAt.toISOString(),
    rows: rankedRows,
    highlightName: current.student.name || ""
  });

  // Feedback
  $("#result-greeting").textContent = `Dear ${current.student.name || "Student"}, your result is ready!`;
  if (accuracy >= 80 && pct >= 70)
    $("#result-feedback").textContent = "🌟 Excellent! Bahut achha kiya! Keep it up!";
  else if (accuracy >= 50 || pct >= 50)
    $("#result-feedback").textContent = "👍 Achha attempt! Weak topics revise karo aur aur practice karo.";
  else
    $("#result-feedback").textContent = "💪 Practice karo aur weak topics par dhyan do. Mehnat rang layegi!";
  if (pendingSubjective > 0) {
    $("#result-feedback").textContent += ` ⏳ Aapke ${pendingSubjective} subjective answer(s) teacher check karenge — unke marks aane ke baad aapka final score/rank update ho sakta hai.`;
  }

  // Performance cards
  setPerf("rank", `${rank}/${total2}`, maxScore > 0 ? ((total2 - rank + 1) / total2) * 100 : 50);
  setPerf("score", `${fmtNum(score)}/${fmtNum(maxScore)}`, maxScore > 0 ? (score / maxScore) * 100 : 0);
  setPerf("accuracy", `${accuracy}%`, accuracy);
  setPerf("percentile", `${percentile}%`, percentile);
  setPerf("attempted", `${attempted}/${total}`, total > 0 ? (attempted / total) * 100 : 0);
  const timeLim = (current.test.minutes || 30) * 60;
  setPerf("time", `${pad2(Math.floor(durSec/60))}:${pad2(durSec%60)} / ${pad2(Math.floor(timeLim/60))}:${pad2(timeLim%60)}`,
    Math.min(100, (durSec / timeLim) * 100));

  // Section-wise performance (use section title if available, else subject)
  const secMap = {};
  currentDetails.forEach(d => {
    const key = d.section || d.subject || "General";
    if (!secMap[key]) secMap[key] = { correct: 0, attempted: 0, total: 0, score: 0, max: 0 };
    secMap[key].total++;
    secMap[key].max += d.marksPerQuestion;
    secMap[key].score += d.marksAwarded;
    if (d.status === "Correct")    secMap[key].correct++;
    if (d.studentAnswer !== null)  secMap[key].attempted++;
  });
  const secList = $("#section-perf-list");
  secList.innerHTML = "";
  Object.entries(secMap).forEach(([subj, data]) => {
    const p = data.max > 0 ? Math.max(0, (data.score / data.max) * 100) : 0;
    const row = document.createElement("div");
    row.className = "section-perf-row";
    row.innerHTML = `
      <div class="section-perf-labels">
        <span>${escHtml(subj)}</span>
        <span>${fmtNum(data.score)}/${fmtNum(data.max)} (${Math.round(p)}%)</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill green" style="width:0%"></div>
      </div>`;
    secList.appendChild(row);
    requestAnimationFrame(() => setTimeout(() => {
      row.querySelector(".progress-bar-fill").style.width = `${p}%`;
    }, 200));
  });

  // Answer summary
  $("#answer-summary-counts").innerHTML = `
    <span class="ans-chip correct">✅ Correct: ${correct}</span>
    <span class="ans-chip wrong">❌ Wrong: ${wrong}</span>
    <span class="ans-chip skip">⬜ Skipped: ${unattempted}</span>
    ${extraCount > 0 ? `<span class="ans-chip" style="background:#f3f4f6;color:#6b7280;">➕ Extra (Not Counted): ${extraCount} (Limit: ${attemptLimit})</span>` : ""}`;

  // ── Chapter-wise weak area report ──
  const chapMap = {};
  currentDetails.forEach(d => {
    const ch = d.chapter || d.subject || "Unknown";
    if (!chapMap[ch]) chapMap[ch] = { correct: 0, wrong: 0, total: 0 };
    chapMap[ch].total++;
    if (d.status === "Correct") chapMap[ch].correct++;
    else if (d.status === "Wrong") chapMap[ch].wrong++;
  });
  const chapReport = $("#chapterwise-report-list");
  if (chapReport) {
    chapReport.innerHTML = "";
    const sorted = Object.entries(chapMap).sort((a,b) => (a[1].correct/a[1].total) - (b[1].correct/b[1].total));
    sorted.forEach(([ch, data]) => {
      const pct = data.total > 0 ? Math.round((data.correct/data.total)*100) : 0;
      const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
      const label = pct >= 70 ? "✅ Strong" : pct >= 40 ? "⚠️ Average" : "❌ Weak";
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom:10px;";
      row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:.85rem;font-weight:600;">
        <span>${escHtml(ch)}</span>
        <span style="color:${color};">${label} — ${pct}% (${data.correct}/${data.total})</span>
      </div>
      <div style="background:#e5e7eb;border-radius:20px;height:8px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:20px;transition:width .5s;"></div>
      </div>`;
      chapReport.appendChild(row);
    });
  }

  // ── WhatsApp share (general) ──
  const whatsBtn = $("#whatsapp-share-btn");
  if (whatsBtn) {
    whatsBtn.onclick = () => {
      const msg = `🎯 *${current.test.title}* — Result\n👤 ${current.student.name || "Student"}\n📊 Score: ${fmtNum(score)}/${fmtNum(maxScore)} (${Math.round(pct)}%)\n✅ Correct: ${correct} | ❌ Wrong: ${wrong}\n🏅 Rank: ${rank}/${total2}\n\nTest karein: Savyasachi Coaching Platform`;
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    };
  }

  // ── Student ke number pe result bhejein ──
  const parentWABtn = $("#whatsapp-parent-btn");
  if (parentWABtn) {
    parentWABtn.onclick = () => {
      const phone = (current.student.mobile || "").replace(/\D/g, "");
      if (!phone || phone.length < 10) {
        alert("WhatsApp number nahi mila. Kripya sahi number ke saath dobara test shuru karein.");
        return;
      }
      const fullPhone = phone.startsWith("91") ? phone : "91" + phone;
      const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : "D";
      const passed = pct >= 33;
      const msg = `🏫 *Savyasachi Coaching*\n\nNamaste! 🙏\n\nAapke bachche *${current.student.name || "Student"}* ka test result:\n\n📝 *Test:* ${current.test.title}\n🎯 *Score:* ${fmtNum(score)} / ${fmtNum(maxScore)}\n📊 *Pratishat:* ${Math.round(pct)}%\n🏅 *Grade:* ${grade}\n✅ *Sahi:* ${correct} | ❌ *Galat:* ${wrong}\n🥇 *Rank:* ${rank} / ${total2}\n\n${passed ? "Bahut achcha kiya! 👏🎉" : "Aur mehnat karein, agli baar zaroor achcha karenge! 💪"}\n\n— Savyasachi Coaching Team`;
      const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    };
  }

  // ── Re-attempt wrong questions ──
  const reBtn = $("#reattempt-wrong-btn");
  if (reBtn) {
    const wrongQs = currentDetails.filter(d => d.status === "Wrong");
    reBtn.style.display = wrongQs.length > 0 ? "inline-block" : "none";
    reBtn.onclick = () => {
      if (!wrongQs.length) { alert("Koi galat jawab nahi hai!"); return; }
      if (!confirm(`${wrongQs.length} galat questions ka mini-test shuru karein?`)) return;
      const miniTest = {
        title: "Re-attempt: " + current.test.title,
        minutes: Math.ceil(wrongQs.length * 1.5),
        marksPerQuestion: getMarks(current.test),
        negativeEnabled: false, negativeMarks: 0,
        questions: wrongQs.map(d => current.test.questions.find((_,i) => currentDetails[i] === d) || {
          textEN: d.questionEN, textHI: d.questionHI,
          optionsEN: d.optionsEN, optionsHI: d.optionsHI,
          answer: d.correctAnswer, subject: d.subject, chapter: d.chapter,
          explanationEN: d.explanationEN, explanationHI: d.explanationHI
        }).filter(Boolean),
        custom: true
      };
      current.test = miniTest;
      current.testId = "reattempt-" + Date.now();
      current.answers = new Array(miniTest.questions.length).fill(null);
      current.marked = {};
      current.startedAt = new Date();
      $("#result-screen").classList.add("hidden");
      beginExam();
    };
  }

  // Save record (practice-mode attempts don't count towards leaderboard/records)
  if (!current.test.isPractice) {
    try {
      await saveRecordOnline({
        ...current.student,
        testId: current.testId, testTitle: current.test.title,
        testMode: current.test.custom ? "Custom" : "Saved",
        chapters: current.test.chapters || [],
        totalQuestions: total, attempted, negativeEnabled: negEn,
        negativeMarks: neg, maxScore, score, percentage: pct,
        correct, wrong, unattempted, extraNotCounted: extraCount, attemptLimit,
        pendingSubjective,
        details: currentDetails,
        durationSeconds: durSec,
        submittedAt: submittedAt.toLocaleString("en-IN"),
        submittedIso: submittedAt.toISOString()
      });
    } catch (err) { console.warn("Record save failed", err); }
  }

  // ── New features hook (Mistake Bank + Study Streak) — see student-features.js ──
  try {
    if (window.SavyaExtras) {
      window.SavyaExtras.onTestSubmitted({
        student: current.student,
        testTitle: current.test.title,
        details: currentDetails,
        isPractice: !!current.test.isPractice
      });
    }
  } catch (e) { console.warn("SavyaExtras hook failed", e); }

  // Practice attempts: hide the leaderboard-oriented WhatsApp share buttons
  if (whatsBtn)     whatsBtn.style.display     = current.test.isPractice ? "none" : "inline-block";
  if (parentWABtn)  parentWABtn.style.display  = current.test.isPractice ? "none" : "inline-block";
}

function setPerf(key, text, pctVal) {
  $(`#perf-${key}`).textContent = text;
  $(`#perf-${key}-progress`).style.width = "0%";
  requestAnimationFrame(() => setTimeout(() => {
    $(`#perf-${key}-progress`).style.width = `${Math.max(0, Math.min(100, pctVal))}%`;
  }, 150));
}

/* ══════════════════════════════════════════
   SOLUTION REVIEW
══════════════════════════════════════════ */
function initSolutionReview() {
  if (!currentDetails.length) return;
  currentSolIndex = 0;
  currentSolLang  = "hi";
  setSolLang("hi");
  $("#result-screen").classList.add("hidden");
  $("#solution-screen").classList.remove("hidden");
  renderSolQuestion();
  renderSolNav();
}

function showResultFromSolution() {
  $("#solution-screen").classList.add("hidden");
  $("#result-screen").classList.remove("hidden");
}

function setSolLang(lang) {
  currentSolLang = lang;
  ["en","hi","both"].forEach(l => $(`#sol-lang-${l}`).classList.toggle("active", l === lang));
  renderSolQuestion();
}

function moveSolQuestion(step) {
  currentSolIndex = Math.max(0, Math.min(currentDetails.length - 1, currentSolIndex + step));
  renderSolQuestion();
  renderSolNav();
}

function renderSolQuestion() {
  const d    = currentDetails[currentSolIndex];
  if (!d) return;
  const lang = currentSolLang;
  const total = currentDetails.length;
  $("#sol-progress-text").textContent = `${currentSolIndex + 1} / ${total}`;

  const qEN = d.questionEN || "";
  const qHI = d.questionHI || "";
  let qText  = "";
  if (lang === "en")       qText = qEN || qHI;
  else if (lang === "hi")  qText = qHI || qEN;
  else qText = (qHI && qEN && qHI !== qEN)
    ? `<div class="lang-hi">${qHI}</div><div class="lang-en" style="font-size:.9em;color:#555;margin-top:6px;">${qEN}</div>`
    : qHI || qEN;

  const statusMap = { Correct: "correct", Wrong: "wrong", "Not answered": "skipped" };
  const sc   = statusMap[d.status] || "skipped";
  const labels = ["A","B","C","D"];

  let optHTML = "";
  for (let i = 0; i < 4; i++) {
    const oEN = (d.optionsEN || [])[i] || "";
    const oHI = (d.optionsHI || [])[i] || "";
    let oText = "";
    if (lang === "en")      oText = oEN || oHI;
    else if (lang === "hi") oText = oHI || oEN;
    else oText = (oHI && oEN && oHI !== oEN) ? `${oHI} / ${oEN}` : oHI || oEN;

    const isCorrect  = i === d.correctAnswer;
    const isSelected = i === d.studentAnswer;
    let cls = "";
    if (isCorrect)            cls = "correct-opt";
    else if (isSelected)      cls = "wrong-opt";
    const icon = isCorrect ? "✅" : (isSelected ? "❌" : "");
    optHTML += `<div class="sol-option ${cls}"><span class="opt-label">${labels[i]}.</span><span>${escHtml(oText)}</span>${icon ? `<span style="margin-left:auto">${icon}</span>` : ""}</div>`;
  }

  const exEN = d.explanationEN || "";
  const exHI = d.explanationHI || "";
  let exText = "";
  if (lang === "en")       exText = exEN || exHI;
  else if (lang === "hi")  exText = exHI || exEN;
  else exText = (exHI && exEN && exHI !== exEN) ? `${exHI}<br><em style="font-size:.9em;color:#a16207">${exEN}</em>` : exHI || exEN;

  const area = $("#solution-question-area");
  area.innerHTML = `
    <div class="sol-q-card">
      <div class="sol-q-header">
        <span class="sol-q-number">Q${d.questionNo} · ${escHtml(d.chapter)}</span>
        <span class="sol-status-badge ${sc}">${d.status}</span>
      </div>
      <div class="sol-question-text">${stripInlineColors(qText)}</div>
      <div class="sol-options">${optHTML}</div>
      ${exText ? `<div class="sol-explanation"><strong>💡 Explanation:</strong>${stripInlineColors(exText)}</div>` : ""}
    </div>`;
  if (window.renderMathIn) requestAnimationFrame(() => window.renderMathIn(area));
}

function renderSolNav() {
  const nav = $("#sol-q-nav");
  nav.innerHTML = "";
  currentDetails.forEach((d, i) => {
    const sc = { Correct: "answered", Wrong: "not-answered", "Not answered": "review" }[d.status] || "not-visited";
    const btn = document.createElement("button");
    btn.textContent = i + 1;
    btn.className = sc + (i === currentSolIndex ? " active" : "");
    btn.onclick = () => { currentSolIndex = i; renderSolQuestion(); renderSolNav(); };
    nav.appendChild(btn);
  });
}

/* ══════════════════════════════════════════
   BACK HOME
══════════════════════════════════════════ */
function backHome() {
  clearInterval(current.timerId);
  ["exam-screen","result-screen","solution-screen"].forEach(id => $("#"+id).classList.add("hidden"));
  $("#home-screen").classList.remove("hidden");
  showMode("student");
}

/* ══════════════════════════════════════════
   TEST ADMIN – READ / RENDER
══════════════════════════════════════════ */
function rebuildTests() {
  tests = { ...defaultTests, ...remoteTests };
  deletedTestIds.forEach(id => delete tests[id]);
}

function renderTests(selId) {
  rebuildTests();
  const sel = $("#test-select");
  sel.innerHTML = "";
  Object.entries(tests).forEach(([id, t]) => {
    if (t.isDraft) return; // Hide drafts from students
    const op = document.createElement("option");
    op.value = id;
    const attemptNote = t.attemptLimit ? `, attempt any ${t.attemptLimit} MCQs` : "";
    op.textContent = `${t.title} (${t.questions.length}Q, ${t.minutes}min${attemptNote})`;
    sel.appendChild(op);
  });
  if (selId && tests[selId] && !tests[selId].isDraft) sel.value = selId;
  renderTestList();
}

function renderTestList() {
  $("#test-list").innerHTML = "";
  Object.entries(tests).forEach(([id, t]) => {
    const item = document.createElement("div");
    item.className = "item";
    const draftBadge = t.isDraft ? '<span class="draft-badge">DRAFT</span>' : '';
    const secCount = t.sections?.length || [...new Set((t.questions || []).map(q => q.section).filter(Boolean))].length;
    const secLabel = secCount > 1 ? ` · ${secCount} sections` : "";
    const attemptLabel = t.attemptLimit ? ` · attempt any ${t.attemptLimit} MCQs` : "";
    const subMarks = getTestSubjectiveMarks(t);
    const marksLabel = subMarks
      ? `MCQ: ${fmtNum(getTestMaxMarks(t))} + Subjective: ${fmtNum(subMarks)} = Total: ${fmtNum(getTestGrandTotalMarks(t))} marks`
      : `Max: ${fmtNum(getTestMaxMarks(t))} marks`;
    item.innerHTML = `<span><strong>${draftBadge}${escHtml(t.title)}</strong><small>${t.questions.length} questions${secLabel} · ${t.minutes}min · ${marksLabel}${attemptLabel}</small></span>`;
    const acts = document.createElement("div");
    
    if (t.isDraft) {
      const pubBtn = mkBtn("🚀 Publish", "primary", () => publishTest(id));
      acts.append(pubBtn);
    }
    
    const edit = mkBtn("Edit", "secondary", () => editTest(id));
    const copy = mkBtn("📋 Copy", "secondary", () => duplicateTest(id));
    const poll = mkBtn("📊 Poll", "secondary", () => openWhatsAppPollModal(id));
    const del  = mkBtn("Delete", "danger",   () => deleteTest(id));
    if (!t.isDraft) { acts.append(poll); }
    acts.append(edit, copy, del);
    item.appendChild(acts);
    $("#test-list").appendChild(item);
  });
}

async function publishTest(id) {
  if (!confirm("Is Draft test ko live students ke liye Publish karna chahte hain?")) return;
  const t = tests[id];
  if (!t) return;
  t.isDraft = false;
  try {
    await saveTestOnline(id, t);
    alert("🚀 Test published successfully! Ab students is test ko dekh sakte hain.");
  } catch(err) {
    alert("Publish failed. Error: " + err.message);
  }
}

function editTest(id) {
  const t = tests[id];
  if (!t) return;
  editingTestId = id;
  $("#test-title").value = t.title;
  $("#test-minutes").value = t.minutes || 30;
  $("#test-marks").value = getMarks(t);
  if ($("#test-attempt-limit")) $("#test-attempt-limit").value = t.attemptLimit || "";
  if ($("#test-subjective-marks")) $("#test-subjective-marks").value = (t.subjectiveMarks !== undefined && t.subjectiveMarks !== null) ? t.subjectiveMarks : "";
  if ($("#test-start-time")) $("#test-start-time").value = t.startTime ? t.startTime.replace(" ","T").slice(0,16) : "";
  if ($("#test-end-time")) $("#test-end-time").value = t.endTime ? t.endTime.replace(" ","T").slice(0,16) : "";
  const neg = getNeg(t);
  $("#test-negative-enabled").value = neg > 0 ? "yes" : "no";
  $("#test-negative").value = neg;
  toggleNegativeField();
  testSections = (t.sections && t.sections.length) ? t.sections.map(s => ({ ...s })) : buildSectionsFromQuestions(t.questions);
  activeSectionId = testSections[0]?.id || "sec-1";
  draftQuestions = (t.questions || []).map(cloneQ);
  clearQForm(false);
  renderTestSections();
  renderDrafts();
}

async function deleteTest(id) {
  if (!confirm(`"${tests[id].title}" delete karein?`)) return;
  delete remoteTests[id];
  deletedTestIds.add(id);
  await deleteTestOnline(id);
  await saveDeletedTestOnline(id);
  renderTests();
}

async function duplicateTest(id) {
  const t = tests[id];
  if (!t) return;
  const newTitle = prompt("Copied test ka title kya rakhein?", "Copy of " + t.title);
  if (!newTitle) return;
  const newId = "test-" + Date.now();
  const newTest = JSON.parse(JSON.stringify(t));
  newTest.title = newTitle.trim();
  newTest.isDraft = true;
  try {
    remoteTests[newId] = newTest;
    await saveTestOnline(newId, newTest);
    renderTests(newId);
    alert("✅ Test copy ho gaya! Draft mein save hai. Edit karke Publish karo.");
  } catch(err) { alert("Copy failed: " + err.message); }
}

/* ── Draft questions ── */
function readQForm(optional = false) {
  const qType = ($("#question-type") && $("#question-type").value === "subjective") ? "subjective" : "mcq";
  const q = {
    subject: $("#question-subject").value,
    textHI: $("#question-text-hi").value.trim(),
    qType,
    explanationHI: $("#explanation-text-hi").value.trim()
  };
  if (qType === "subjective") {
    q.optionsHI = ["", "", "", ""];
    q.answer = 0;
    const m = $("#question-marks") ? $("#question-marks").value : "";
    q.marks = (m !== "" && m !== null) ? Number(m) : null;
  } else {
    q.optionsHI = [0,1,2,3].map(i => $(`#option-${i}-hi`).value.trim());
    q.answer = Number($("#answer-index").value);
    q.marks = null;
  }
  q.textEN = q.textHI;
  q.optionsEN = q.optionsHI;
  q.explanationEN = q.explanationHI;
  q.text = q.textHI;
  q.options = q.optionsHI;
  q.explanation = q.explanationHI;
  const hasAny = q.textHI || q.optionsHI.some(Boolean);
  if (optional && !hasAny) return null;
  if (!q.textHI) { alert("Question likho."); return false; }
  if (qType === "mcq" && q.optionsHI.some(o => !o)) {
    alert("Question aur options fill karo."); return false;
  }
  return q;
}

function onQuestionTypeChange() {
  const isSub = $("#question-type").value === "subjective";
  const mcqBox = $("#question-mcq-fields");
  const subBox = $("#question-subjective-fields");
  if (mcqBox) mcqBox.classList.toggle("hidden", isSub);
  if (subBox) subBox.classList.toggle("hidden", !isSub);
}

function clearQForm(focus = true) {
  ["question-text-hi","explanation-text-hi"].forEach(id => $(("#"+id)).value = "");
  [0,1,2,3].forEach(i => { $(`#option-${i}-hi`).value = ""; });
  $("#answer-index").value = "0";
  if ($("#question-type")) $("#question-type").value = "mcq";
  if ($("#question-marks")) $("#question-marks").value = "";
  onQuestionTypeChange();
  editingDraftIndex = null;
  $("#add-question").textContent = "Add Question to Test";
  if (focus) $("#question-text-hi").focus();
}

function getActiveSectionTitle() {
  const sec = testSections.find(s => s.id === activeSectionId);
  return sec?.title || testSections[0]?.title || "Section A";
}

function ensureSectionExists(title) {
  if (!title) return;
  if (!testSections.some(s => s.title === title)) {
    const id = `sec-${Date.now()}`;
    testSections.push({ id, title, marksPerQuestion: null });
    activeSectionId = id;
    renderTestSections();
  }
}

function addTestSection() {
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const n = testSections.length;
  const letter = labels[n] || String(n + 1);
  const id = `sec-${Date.now()}`;
  testSections.push({ id, title: `Section ${letter}`, marksPerQuestion: null });
  activeSectionId = id;
  renderTestSections();
}

function renderTestSections() {
  const list = $("#test-sections-list");
  const sel = $("#active-section-select");
  if (!list || !sel) return;
  list.innerHTML = "";
  testSections.forEach(sec => {
    const row = document.createElement("div");
    row.className = "section-row";
    const titleInp = document.createElement("input");
    titleInp.type = "text";
    titleInp.className = "section-title-input";
    titleInp.value = sec.title;
    titleInp.dataset.id = sec.id;
    titleInp.placeholder = "Section name";
    const marksInp = document.createElement("input");
    marksInp.type = "number";
    marksInp.className = "section-marks-input";
    marksInp.value = sec.marksPerQuestion ?? "";
    marksInp.dataset.id = sec.id;
    marksInp.placeholder = "Marks/Q";
    marksInp.step = "0.25";
    marksInp.min = "0.25";
    const count = document.createElement("span");
    count.className = "section-q-count";
    count.textContent = `${draftQuestions.filter(q => (q.section || "Section A") === sec.title).length} Q`;
    row.append(titleInp, marksInp, count);
    const del = mkBtn("✕", "danger", () => {
      if (testSections.length <= 1) { alert("Kam se kam ek section chahiye."); return; }
      draftQuestions.forEach(q => { if (q.section === sec.title) q.section = testSections[0].title; });
      testSections = testSections.filter(s => s.id !== sec.id);
      activeSectionId = testSections[0].id;
      renderTestSections();
      renderDrafts();
    });
    del.style.padding = "4px 8px";
    row.appendChild(del);
    list.appendChild(row);
  });
  list.querySelectorAll(".section-title-input").forEach(inp => {
    inp.onchange = () => {
      const sec = testSections.find(s => s.id === inp.dataset.id);
      if (!sec) return;
      const old = sec.title;
      sec.title = inp.value.trim() || sec.title;
      draftQuestions.forEach(q => { if (q.section === old) q.section = sec.title; });
      renderTestSections();
      renderDrafts();
    };
  });
  list.querySelectorAll(".section-marks-input").forEach(inp => {
    inp.onchange = () => {
      const sec = testSections.find(s => s.id === inp.dataset.id);
      if (sec) sec.marksPerQuestion = inp.value ? Number(inp.value) : null;
    };
  });
  sel.innerHTML = "";
  testSections.forEach(sec => {
    const op = document.createElement("option");
    op.value = sec.id;
    op.textContent = sec.title;
    sel.appendChild(op);
  });
  sel.value = activeSectionId;
  sel.onchange = () => { activeSectionId = sel.value; };
}

function buildSectionsFromQuestions(questions) {
  const sections = [];
  (questions || []).forEach(q => {
    const title = q.section || "Section A";
    if (!sections.some(s => s.title === title)) {
      sections.push({ id: `sec-${sections.length + 1}`, title, marksPerQuestion: null });
    }
  });
  return sections.length ? sections : [{ id: "sec-1", title: "Section A", marksPerQuestion: null }];
}

function addDraftQuestion() {
  const q = readQForm();
  if (!q) return;
  if (editingDraftIndex !== null) {
    // Updating an existing question: keep its original section, don't move it to the active tab
    q.section = draftQuestions[editingDraftIndex].section || getActiveSectionTitle();
  } else {
    // New question: assign to whichever section tab is currently active
    q.section = getActiveSectionTitle();
  }

  if (window._editingPdfDraftId) {
    const pid = window._editingPdfDraftId;
    const updated = { ...cloneQ(q), status: "pending", section: q.section };
    const db = getDB();
    if (db) savePdfDraftOnline(pid, updated).catch(console.warn);
    const idx = pdfDraftQuestions.findIndex(d => d.id === pid);
    if (idx >= 0) pdfDraftQuestions[idx] = { ...pdfDraftQuestions[idx], ...updated };
    window._editingPdfDraftId = null;
    draftQuestions.push(cloneQ(q));
    clearQForm();
    renderPdfDrafts();
    renderDrafts();
    renderTestSections();
    return;
  }

  if (editingDraftIndex !== null) draftQuestions[editingDraftIndex] = cloneQ(q);
  else draftQuestions.push(cloneQ(q));
  clearQForm();
  renderDrafts();
  renderTestSections();
}

function renderDrafts() {
  const c = draftQuestions.length;
  $("#draft-count").textContent = `${c} question${c === 1 ? "" : "s"} added`;
  $("#draft-list").innerHTML = "";
  draftQuestions.forEach((q, i) => {
    const item = document.createElement("div");
    item.className = "item";
    const sec = q.section ? `<small style="color:#7c3aed;font-weight:700;">[${escHtml(q.section)}]</small> ` : "";
    const expl = (q.explanationHI || q.explanationEN || q.explanation || "").substring(0, 60);
    const ansLabel = q.qType === "subjective" ? `📝 Subjective${q.marks ? " · " + q.marks + " marks" : ""}` : `Ans: ${["A","B","C","D"][q.answer]}`;
    item.innerHTML = `<span>${sec}<strong>Q${i+1}.</strong> ${escHtml(q.text || q.textHI || q.textEN)}<small>${ansLabel}${expl ? " · " + escHtml(expl) + "…" : ""}</small></span>`;
    const acts = document.createElement("div");
    acts.append(
      mkBtn("Edit",   "secondary", () => { editingDraftIndex = i; populateQForm(draftQuestions[i]); $("#add-question").textContent = "Update Question"; }),
      mkBtn("Delete", "danger",    () => { draftQuestions.splice(i,1); renderDrafts(); })
    );
    item.appendChild(acts);
    $("#draft-list").appendChild(item);
  });
}

function populateQForm(q) {
  $("#question-subject").value = q.subject || "Mathematics";
  $("#question-text-hi").value = q.textHI || q.text || q.textEN || "";
  [0,1,2,3].forEach(i => {
    $(`#option-${i}-hi`).value = q.optionsHI?.[i] || q.options?.[i] || q.optionsEN?.[i] || "";
  });
  $("#explanation-text-hi").value = q.explanationHI || q.explanation || q.explanationEN || "";
  $("#answer-index").value = String(q.answer || 0);
  if ($("#question-type")) $("#question-type").value = q.qType === "subjective" ? "subjective" : "mcq";
  if ($("#question-marks")) $("#question-marks").value = (q.marks !== undefined && q.marks !== null) ? q.marks : "";
  onQuestionTypeChange();
}

async function saveTest(e) {
  e.preventDefault();
  const pending = readQForm(true);
  if (pending === false) return;
  if (pending) { draftQuestions.push(cloneQ(pending)); clearQForm(false); }
  if (!draftQuestions.length) { alert("Question add karo pehle."); return; }
  const title = $("#test-title").value.trim();
  const min   = Number($("#test-minutes").value || 30);
  const marks = Number($("#test-marks").value || 2);
  const negEn = $("#test-negative-enabled").value === "yes";
  const neg   = negEn ? Number($("#test-negative").value || 0) : 0;
  const attemptLimitRaw = Number($("#test-attempt-limit")?.value || 0);
  const attemptLimit = attemptLimitRaw > 0 ? attemptLimitRaw : null;
  const subjectiveMarksRaw = Number($("#test-subjective-marks")?.value || 0);
  const subjectiveMarks = subjectiveMarksRaw > 0 ? subjectiveMarksRaw : null;
  if (!title) { alert("Test title required hai."); return; }
  const id = editingTestId || `test-${Date.now()}`;
  const startTime = $("#test-start-time")?.value || "";
  const endTime   = $("#test-end-time")?.value || "";
  const t  = {
    title, minutes: min || 30, marksPerQuestion: marks, negativeEnabled: negEn, negativeMarks: neg,
    attemptLimit,
    subjectiveMarks,
    startTime: startTime || null, endTime: endTime || null,
    sections: testSections.map(s => ({ id: s.id, title: s.title, marksPerQuestion: s.marksPerQuestion ?? null })),
    questions: draftQuestions.map(cloneQ)
  };
  try {
    remoteTests[id] = t;
    deletedTestIds.delete(id);
    await saveTestOnline(id, t);
    editingTestId = null;
    draftQuestions = [];
    testSections = [{ id: "sec-1", title: "Section A", marksPerQuestion: null }];
    activeSectionId = "sec-1";
    $("#test-form").reset();
    toggleNegativeField();
    renderTestSections();
    renderDrafts();
    renderTests(id);
    alert("Test saved online! ✅");
  } catch(err) {
    console.warn(err);
    if (String(err.message||"").includes("longer than") || String(err.message||"").includes("exceeds")) {
      alert("Test save nahi hua: Test bahut bada hai (Firestore ki 1MB document limit cross ho gayi). Questions kam karo ya chhote sections mein test banao.\n\nError: " + err.message);
    } else {
      alert("Test save nahi hua. Error: " + (err.message || err) + "\n\nFirestore rules check karo.");
    }
  }
}

/* ══════════════════════════════════════════
   BANK ADMIN
══════════════════════════════════════════ */
function getBankFilterPool(subjectVal) {
  return subjectVal === "all"
    ? questionBank
    : questionBank.filter(q => getQuestionSubject(q) === subjectVal);
}

// ── "Valid only" versions ──────────────────────────────────────────
// Test banate waqt (Test Bank Picker) sirf wahi Subject/Chapter dikhne
// chahiye jinme kam se kam 1 *usable* (isValidQ) question ho — taaki
// admin galti se aisa chapter na chun le jisme koi bhi complete question
// na ho. (Broken/draft questions Question Bank admin-edit screen mein
// dikhte rehte hain, taaki unhe fix kiya ja sake — wahan ye filter nahi
// lagta, sirf test-building flow mein lagta hai.)
function getValidBankSubjectFilterOptions() {
  const validPool = questionBank.filter(isValidQ);
  const activeSubjects = [...new Set(validPool.map(getQuestionSubject).filter(Boolean))];
  if (window.SubjectResolver) {
    const standard = window.SubjectResolver.STANDARD_SUBJECTS;
    return [...new Set([...standard.filter(s => activeSubjects.includes(s)), ...activeSubjects])]
      .filter(s => activeSubjects.includes(s))
      .sort((a, b) => {
        const ai = standard.indexOf(a), bi = standard.indexOf(b);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1; if (bi >= 0) return 1;
        return a.localeCompare(b);
      });
  }
  return activeSubjects.sort();
}

function getValidBankFilterPool(subjectVal) {
  const validPool = questionBank.filter(isValidQ);
  return subjectVal === "all"
    ? validPool
    : validPool.filter(q => getQuestionSubject(q) === subjectVal);
}

function getFilteredBankQuestions(subjectVal, chapterVal) {
  let visible = getBankFilterPool(subjectVal);
  if (chapterVal !== "all") visible = visible.filter(q => q.chapter === chapterVal);
  return visible;
}

let bankCurrentPage = 0;
const BANK_PAGE_SIZE = 50;

// ── Find Question by ID ──
// User apni question ki exact ID (jaise "bulk-1782918350273-42-700") daal kar
// seedhe wahi question dhoondh sakta hai, chahe wo kisi bhi subject/chapter/page mein ho.
let bankIdFilterQuery = "";

function findQuestionById() {
  const input = $("#bank-id-search-input");
  const val = (input?.value || "").trim();
  if (!val) { alert("Pehle question ki ID likhein ya paste karein (jaise bulk-1782918350273-42-700)."); return; }
  bankIdFilterQuery = val;
  renderBank(0);
}

function clearBankIdFilter() {
  bankIdFilterQuery = "";
  const input = $("#bank-id-search-input");
  if (input) input.value = "";
  renderBank(0);
}

// Normal keyword-search box use hote hi ID-filter clear kar do, warna lagega
// ki subject/chapter/search kaam nahi kar raha (kyunki ID-filter sab override kar deta).
function onBankSearchInput() {
  bankIdFilterQuery = "";
  renderBank();
}

window.findQuestionById = findQuestionById;
window.clearBankIdFilter = clearBankIdFilter;
window.onBankSearchInput = onBankSearchInput;

// Question ID ko ek click mein clipboard par copy karta hai (button par temporary "✅ Copied!" dikhata hai).
function copyQuestionIdToClipboard(id, btnEl) {
  const showResult = (ok) => {
    if (!btnEl) return;
    const original = "📋 Copy ID";
    btnEl.textContent = ok ? "✅ Copied!" : "❌ Copy fail";
    setTimeout(() => { btnEl.textContent = original; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id).then(() => showResult(true)).catch(() => showResult(false));
  } else {
    // Purane browsers / non-HTTPS ke liye fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = id;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showResult(true);
    } catch (e) {
      showResult(false);
    }
  }
}
window.copyQuestionIdToClipboard = copyQuestionIdToClipboard;

function renderBank(page) {
  const subjFilter = $("#bank-subject-filter");
  const chapFilter = $("#bank-chapter-filter");
  const curSubj = subjFilter?.value || "all";
  const curChap = chapFilter?.value || "all";

  fillFilter(subjFilter, getBankSubjectFilterOptions(), curSubj, "— None (All subjects) —");

  const pool = getBankFilterPool(subjFilter.value);
  const chaps = [...new Set(pool.map(q => q.chapter).filter(Boolean))].sort();
  fillFilter(chapFilter, chaps, curChap, "— None (All chapters) —");

  const allVisible0 = getFilteredBankQuestions(subjFilter.value, chapFilter.value);
  const searchVal = ($("#bank-search-input")?.value || "").trim().toLowerCase();
  let allVisible = searchVal
    ? allVisible0.filter(q => ((q.text || q.textHI || "") + " " + (q.textEN || "")).toLowerCase().includes(searchVal))
    : allVisible0;
  const list = $("#bank-list");

  // ── ID-filter: agar active hai to subject/chapter/keyword filters ko ignore karke
  // sirf us exact (ya matching) ID wale question(s) dikhao — kisi bhi page/chapter mein ho.
  let idNoteHtml = "";
  if (bankIdFilterQuery) {
    const idQuery = bankIdFilterQuery;
    let idMatches = questionBank.filter(q => String(q.id) === idQuery);
    if (!idMatches.length) idMatches = questionBank.filter(q => String(q.id).toLowerCase() === idQuery.toLowerCase());
    if (!idMatches.length) idMatches = questionBank.filter(q => String(q.id).toLowerCase().includes(idQuery.toLowerCase()));
    allVisible = idMatches;
    idNoteHtml = idMatches.length
      ? `<div style="background:#dbeafe;border:1.5px solid #93c5fd;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:.84rem;color:#1e40af;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"><span>🔎 ID se dhoondha: <code>${escHtml(idQuery)}</code> — ${idMatches.length} question mila.</span><button type="button" onclick="clearBankIdFilter()" style="background:#1e40af;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:.78rem;cursor:pointer;font-weight:700;">✕ Sabhi dikhao</button></div>`
      : `<div style="background:#fee2e2;border:1.5px solid #fca5a5;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:.84rem;color:#991b1b;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"><span>❌ ID <code>${escHtml(idQuery)}</code> se koi bhi question nahi mila.</span><button type="button" onclick="clearBankIdFilter()" style="background:#991b1b;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:.78rem;cursor:pointer;font-weight:700;">✕ Sabhi dikhao</button></div>`;
  }

  // Update count badge
  const countBadge = $("#bank-question-count");
  if (countBadge) countBadge.textContent = questionBank.length + " questions";

  // Reset page if filters changed or page not specified
  if (page === undefined) { bankCurrentPage = 0; page = 0; }
  bankCurrentPage = page;

  list.innerHTML = idNoteHtml;
  if (!allVisible.length) {
    list.innerHTML += bankIdFilterQuery ? "" : (questionBank.length === 0
      ? '<p class="empty-state">⏳ Firebase se questions load ho rahi hain... Ya "🔄 Refresh from Firebase" button dabao.</p>'
      : '<p class="empty-state">Is chapter mein koi question nahi hai.</p>');
    renderTestBankPicker(); renderCustomChapters(); return;
  }

  // Pagination
  const totalPages = Math.ceil(allVisible.length / BANK_PAGE_SIZE);
  const start = page * BANK_PAGE_SIZE;
  const visible = allVisible.slice(start, start + BANK_PAGE_SIZE);

  // Reset select-all checkbox state
  const selectAllCb = $("#bank-select-all");
  if (selectAllCb) selectAllCb.checked = false;
  updateBankSelectionUI();

  visible.forEach(q => {
    const item = document.createElement("div");
    item.className = "item";
    item.style.cssText = "display:flex;align-items:flex-start;gap:10px;";

    // Checkbox
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "bank-q-checkbox";
    cb.dataset.id = q.id;
    cb.style.cssText = "width:17px;height:17px;margin-top:4px;flex-shrink:0;cursor:pointer;accent-color:#dc2626;";
    cb.addEventListener("change", updateBankSelectionUI);

    const info = document.createElement("span");
    info.style.flex = "1";
    const diffBadge = q.difficulty ? ` <span class="diff-badge diff-${q.difficulty}">${q.difficulty==="easy"?"🟢 Easy":q.difficulty==="hard"?"🔴 Hard":"🟡 Med"}</span>` : "";
    const imgThumb = q.image ? `<img src="${escHtml(q.image)}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;margin-right:6px;vertical-align:middle;" />` : "";
    info.innerHTML = `<strong>${imgThumb}${escHtml(getQuestionSubject(q))} / ${escHtml(q.chapter || "Chapter")}${diffBadge}</strong><small>${escHtml(q.text || q.textHI || q.textEN)}</small>`;

    // ID row: har question ki ID yahan dikhti hai + ek-click copy button,
    // taaki "🆔 Find by ID" box mein paste karke use dhoonda ja sake.
    const idRow = document.createElement("div");
    idRow.style.cssText = "margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;";
    const idBadge = document.createElement("span");
    idBadge.textContent = "ID: " + q.id;
    idBadge.title = "Ye question ki unique ID hai — 'Find by ID' box mein use karein.";
    idBadge.style.cssText = "font-family:monospace;font-size:.72rem;background:#f1f5f9;color:#475569;border-radius:4px;padding:2px 7px;word-break:break-all;";
    const copyIdBtn = document.createElement("button");
    copyIdBtn.type = "button";
    copyIdBtn.textContent = "📋 Copy ID";
    copyIdBtn.style.cssText = "font-size:.7rem;padding:1px 8px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer;font-weight:600;flex-shrink:0;";
    copyIdBtn.onclick = () => copyQuestionIdToClipboard(String(q.id), copyIdBtn);
    idRow.append(idBadge, copyIdBtn);
    info.appendChild(idRow);

    const acts = document.createElement("div");
    acts.style.cssText = "display:flex;gap:6px;flex-shrink:0;align-items:flex-start;";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.style.cssText = "padding:5px 12px;border-radius:7px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;transition:all .2s;white-space:nowrap;";

    const isAdded = () => draftQuestions.some(dq =>
      (dq.textHI || dq.text) === (q.textHI || q.text) ||
      (dq.textEN || dq.text) === (q.textEN || q.text)
    );

    const cancelBankBtn = document.createElement("button");
    cancelBankBtn.type = "button";
    cancelBankBtn.textContent = "✕";
    cancelBankBtn.title = "Remove from test";
    cancelBankBtn.style.cssText = "padding:5px 9px;border-radius:7px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;background:#fee2e2;color:#dc2626;display:none;transition:all .2s;";

    function removeFromDraftBank() {
      const qText = q.textHI || q.text || q.textEN;
      const qTextEN = q.textEN || q.text;
      const idx = draftQuestions.findIndex(dq =>
        (dq.textHI || dq.text) === qText || (dq.textEN || dq.text) === qTextEN
      );
      if (idx !== -1) { draftQuestions.splice(idx, 1); renderDrafts(); renderTestSections(); }
      refreshBankAddBtn();
    }

    function refreshBankAddBtn() {
      if (isAdded()) {
        addBtn.textContent = "✅ Added";
        addBtn.style.background = "#dcfce7";
        addBtn.style.color = "#15803d";
        cancelBankBtn.style.display = "inline-block";
      } else {
        addBtn.textContent = "Add to Test";
        addBtn.style.background = "#e0e7ff";
        addBtn.style.color = "#3730a3";
        cancelBankBtn.style.display = "none";
      }
    }
    refreshBankAddBtn();

    cancelBankBtn.onclick = () => { removeFromDraftBank(); };

    addBtn.onclick = () => {
      if (isAdded()) return;
      const cq = cloneQ(q);
      cq.section = getActiveSectionTitle();
      draftQuestions.push(cq);
      renderDrafts();
      renderTestSections();
      refreshBankAddBtn();
      showAdminTab("tests");
    };

    acts.append(
      addBtn,
      cancelBankBtn,
      mkBtn("Edit",   "secondary", () => editBank(q.id)),
      mkBtn("Delete", "danger",    () => deleteBankQuestion(q.id))
    );

    item.append(cb, info, acts);
    list.appendChild(item);
  });
  renderTestBankPicker();
  renderCustomChapters();

  // Pagination controls
  const existingPag = document.getElementById('bank-pagination');
  if (existingPag) existingPag.remove();
  if (totalPages > 1) {
    const pag = document.createElement('div');
    pag.id = 'bank-pagination';
    pag.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap;';
    const info = document.createElement('span');
    info.style.cssText = 'font-size:.82rem;color:#6b7280;';
    info.textContent = `${start+1}–${Math.min(start+BANK_PAGE_SIZE, allVisible.length)} of ${allVisible.length}`;
    const prev = document.createElement('button');
    prev.type = 'button'; prev.textContent = '◀ Prev';
    prev.disabled = page === 0;
    prev.style.cssText = 'padding:4px 12px;border-radius:6px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:.82rem;font-weight:600;' + (page===0?'opacity:.4;':'');
    prev.onclick = () => renderBank(page - 1);
    const next = document.createElement('button');
    next.type = 'button'; next.textContent = 'Next ▶';
    next.disabled = page >= totalPages - 1;
    next.style.cssText = 'padding:4px 12px;border-radius:6px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:.82rem;font-weight:600;' + (page>=totalPages-1?'opacity:.4;':'');
    next.onclick = () => renderBank(page + 1);
    pag.append(prev, info, next);
    list.parentNode.insertBefore(pag, list.nextSibling);
  }

  // Render KaTeX math after DOM paint for speed
  if (window.renderMathIn) requestAnimationFrame(() => window.renderMathIn(list));
}


function renderTestBankPicker() {
  const subjFilter = $("#test-bank-subject-filter");
  const chapFilter = $("#test-bank-chapter-filter");
  const chapRow    = $("#test-bank-chapter-row");
  const curSubj = subjFilter?.value || "all";
  const curChap = chapFilter?.value || "all";

  fillFilter(subjFilter, getValidBankSubjectFilterOptions(), curSubj, "— Pehle Subject chunein —");

  const subjectSelected = subjFilter.value && subjFilter.value !== "all";

  // Hide chapter row and list until a subject is chosen
  if (chapRow) chapRow.style.display = subjectSelected ? "" : "none";

  const list = $("#test-bank-list");
  if (!subjectSelected) {
    list.innerHTML = '<p class="empty-state" style="color:#94a3b8;">⬆️ Pehle Subject select karein, phir chapter aur questions dikhenge.</p>';
    const delBtn = $("#delete-chapter-btn");
    if (delBtn) delBtn.style.display = "none";
    return;
  }

  const pool = getValidBankFilterPool(subjFilter.value);
  const chaps = [...new Set(pool.map(q => q.chapter).filter(Boolean))].sort();
  fillFilter(chapFilter, chaps, curChap, "— None (All chapters) —");

  // Show/hide Delete Chapter button
  const delBtn = $("#delete-chapter-btn");
  if (delBtn) delBtn.style.display = (chapFilter.value && chapFilter.value !== "all") ? "inline-block" : "none";

  list.innerHTML = "";
  const visible = chapFilter.value === "all" ? pool : pool.filter(q => q.chapter === chapFilter.value);
  if (!visible.length) { list.innerHTML = '<p class="empty-state">Koi question nahi hai.</p>'; return; }
  visible.forEach(q => {
    const item = document.createElement("div");
    item.className = "item compact-item";
    item.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;";
    const info = document.createElement("span");
    info.style.flex = "1";
    info.innerHTML = `<strong>${escHtml(q.text || q.textHI || q.textEN)}</strong><small>${escHtml(getQuestionSubject(q))} / ${escHtml(q.chapter || "")}</small>`;

    // Check if already added (match by text)
    const isAdded = () => draftQuestions.some(dq =>
      (dq.textHI || dq.text) === (q.textHI || q.text) ||
      (dq.textEN || dq.text) === (q.textEN || q.text)
    );

    const btnWrap = document.createElement("div");
    btnWrap.style.cssText = "display:flex;gap:5px;align-items:center;flex-shrink:0;";

    const add = document.createElement("button");
    add.type = "button";
    add.style.cssText = "padding:5px 14px;border-radius:7px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;transition:all .2s;white-space:nowrap;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "✕";
    cancelBtn.title = "Remove from test";
    cancelBtn.style.cssText = "padding:5px 9px;border-radius:7px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;background:#fee2e2;color:#dc2626;display:none;transition:all .2s;";

    function removeFromDraft() {
      const qText = q.textHI || q.text || q.textEN;
      const qTextEN = q.textEN || q.text;
      const idx = draftQuestions.findIndex(dq =>
        (dq.textHI || dq.text) === qText || (dq.textEN || dq.text) === qTextEN
      );
      if (idx !== -1) { draftQuestions.splice(idx, 1); renderDrafts(); renderTestSections(); }
      refreshAddBtn();
    }

    function refreshAddBtn() {
      if (isAdded()) {
        add.textContent = "✅ Added";
        add.style.background = "#dcfce7";
        add.style.color = "#15803d";
        add.style.cursor = "default";
        cancelBtn.style.display = "inline-block";
      } else {
        add.textContent = "Add";
        add.style.background = "#e0e7ff";
        add.style.color = "#3730a3";
        add.style.cursor = "pointer";
        cancelBtn.style.display = "none";
      }
    }
    refreshAddBtn();

    cancelBtn.onclick = () => { removeFromDraft(); };

    add.onclick = () => {
      if (isAdded()) return;
      const cq = cloneQ(q);
      cq.section = getActiveSectionTitle();
      draftQuestions.push(cq);
      renderDrafts();
      renderTestSections();
      refreshAddBtn();
    };

    btnWrap.append(add, cancelBtn);
    item.append(info, btnWrap);
    list.appendChild(item);
  });
}

async function deleteSelectedChapter() {
  const filter = $("#test-bank-chapter-filter");
  const chapterName = filter?.value;
  if (!chapterName || chapterName === "all") { alert("Pehle ek specific chapter select karo."); return; }
  const questionsInChapter = questionBank.filter(q => q.chapter === chapterName);
  if (!questionsInChapter.length) { alert("Is chapter mein koi question nahi hai."); return; }
  if (!confirm('"' + chapterName + '" chapter ke saare ' + questionsInChapter.length + ' questions Recycle Bin mein move honge.\n\nWahan se restore ya permanently delete kar sakte ho.\n\nContinue karein?')) return;

  const db = getDB();
  if (!db) { alert("Firebase connected nahi hai. Refresh karo aur dobara try karo."); return; }

  try {
    const ids = questionsInChapter.map(q => q.id);
    const CHUNK = 490;
    // Move to deletedQuestions first
    for (let i = 0; i < questionsInChapter.length; i += CHUNK) {
      const batch = db.batch();
      questionsInChapter.slice(i, i + CHUNK).forEach(q => {
        const data = { ...q, _originalId: q.id, _deletedAt: firebase.firestore.FieldValue.serverTimestamp(), _deletedFrom: "questionBank" };
        delete data.id;
        batch.set(db.collection("deletedQuestions").doc(q.id), data);
        // Permanent seed-exclusion — "Delete Forever" karne par bhi ye wapas nahi aayega.
        batch.set(db.collection("seedExclusions").doc(q.id), { excludedAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
    }
    // Then delete from questionBank
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = db.batch();
      ids.slice(i, i + CHUNK).forEach(id => {
        batch.delete(db.collection("questionBank").doc(id));
      });
      await batch.commit();
    }
    alert('"'+ chapterName + '" chapter ke saare ' + questionsInChapter.length + ' questions Recycle Bin mein move ho gaye! 🗑️\nAdmin > Recycle Bin se restore kar sakte ho.');
  } catch(err) {
    console.error("Chapter delete failed:", err);
    alert("Delete nahi hua! Error: " + (err.message || err) + "\n\nFirestore rules check karo.");
  }
}

function fillFilter(sel, items, cur, noneLabel = "— None —") {
  if (!sel) return;
  sel.innerHTML = `<option value="all">${noneLabel}</option>`;
  items.forEach(c => {
    const op = document.createElement("option");
    op.value = c;
    op.textContent = c;
    sel.appendChild(op);
  });
  sel.value = items.includes(cur) ? cur : "all";
}

function showBankModal(title) {
  const modal = $("#bank-edit-modal");
  if (modal) modal.classList.remove("hidden");
  if (title) { const t = $("#bank-form-title"); if (t) t.textContent = title; }
}
function hideBankModal() {
  const modal = $("#bank-edit-modal");
  if (modal) modal.classList.add("hidden");
}

function editBank(id) {
  const q = questionBank.find(q => q.id === id);
  if (!q) return;
  editingBankId = id;
  approvingAppScriptDraftId = null;
  populateBankForm(q);
  $("#save-bank-question").textContent = "Update Question";
  showBankModal("Edit Question");
}

function populateBankForm(q) {
  // Set subject: dropdown + text input
  window.setBankSubject(q.subject || "Mathematics");
  $("#bank-chapter").value = q.chapter || "";
  $("#bank-question-hi").value = q.textHI || q.text || q.textEN || "";
  [0,1,2,3].forEach(i => {
    $(`#bank-option-${i}-hi`).value = q.optionsHI?.[i] || q.options?.[i] || q.optionsEN?.[i] || "";
  });
  $("#bank-explanation-hi").value = q.explanationHI || q.explanation || q.explanationEN || "";
  $("#bank-answer").value = String(q.answer || 0);
  if ($("#bank-qtype")) $("#bank-qtype").value = q.qType === "subjective" ? "subjective" : "mcq";
  if ($("#bank-marks")) $("#bank-marks").value = (q.marks !== undefined && q.marks !== null) ? q.marks : "";
  onBankQTypeChange();
  if ($("#bank-difficulty")) $("#bank-difficulty").value = q.difficulty || "";
  if ($("#bank-manual-latex")) $("#bank-manual-latex").checked = !!q.mathManual;
  if (window.updateMathPreview) window.updateMathPreview();
}

function readBankForm() {
  const qType = ($("#bank-qtype") && $("#bank-qtype").value === "subjective") ? "subjective" : "mcq";
  const q = {
    subject: ($("#bank-subject").value || "").trim(),
    chapter: ($("#bank-chapter").value || "").trim(),
    textHI:  $("#bank-question-hi").value.trim(),
    qType,
    difficulty: $("#bank-difficulty") ? $("#bank-difficulty").value : "",
    explanationHI: $("#bank-explanation-hi").value.trim(),
    mathManual: !!($("#bank-manual-latex") && $("#bank-manual-latex").checked)
  };
  if (qType === "subjective") {
    q.optionsHI = ["", "", "", ""];
    q.answer = 0;
    const m = $("#bank-marks") ? $("#bank-marks").value : "";
    q.marks = (m !== "" && m !== null) ? Number(m) : null;
  } else {
    q.optionsHI = [0,1,2,3].map(i => $(`#bank-option-${i}-hi`).value.trim());
    q.answer = Number($("#bank-answer").value);
    q.marks = null;
  }
  q.textEN = q.textHI;
  q.optionsEN = q.optionsHI;
  q.explanationEN = q.explanationHI;
  q.text = q.textHI;
  q.options = q.optionsHI;
  q.explanation = q.explanationHI;
  if (!q.subject || !q.chapter || !q.textHI) {
    alert("Question, subject aur chapter fill karo."); return null;
  }
  if (qType === "mcq" && q.optionsHI.some(o=>!o)) {
    alert("Options fill karo."); return null;
  }
  if (window.autoFormatMathFields) window.autoFormatMathFields(q);
  return q;
}

function onBankQTypeChange() {
  const isSub = $("#bank-qtype") && $("#bank-qtype").value === "subjective";
  const mcqBox = $("#bank-mcq-fields");
  const subBox = $("#bank-subjective-fields");
  if (mcqBox) mcqBox.classList.toggle("hidden", isSub);
  if (subBox) subBox.classList.toggle("hidden", !isSub);
}

function clearBankForm() {
  $("#bank-form").reset();
  window.setBankSubject("Mathematics");
  [0,1,2,3].forEach(i => { $(`#bank-option-${i}-hi`).value = ""; });
  $("#bank-explanation-hi").value = "";
  $("#bank-answer").value = "0";
  if ($("#bank-qtype")) $("#bank-qtype").value = "mcq";
  if ($("#bank-marks")) $("#bank-marks").value = "";
  onBankQTypeChange();
  if ($("#bank-manual-latex")) $("#bank-manual-latex").checked = false;
  if (window.updateMathPreview) window.updateMathPreview();
  editingBankId = null;
  approvingAppScriptDraftId = null;
  hideBankModal();
}
function cancelBankEdit() { clearBankForm(); }

async function saveBankQuestion(e) {
  e.preventDefault();
  if (!editingBankId && !approvingAppScriptDraftId) {
    // Ab manual "naya question add karo" ka koi rasta nahi hai — ye form
    // sirf Edit (existing bank question) ya AppScript draft Approve ke
    // liye khulta hai. Agar dono context missing hain, kuch galat hua hai.
    alert("Kuch galat ho gaya — is form se sirf existing question edit ya draft approve kiya ja sakta hai.");
    return;
  }
  const q = readBankForm();
  if (!q) return;
  const sourceDraftId = approvingAppScriptDraftId;
  const id = editingBankId || makeBankIdFromDraftId(sourceDraftId);
  try {
    await saveBankOnline(id, q);
    if (sourceDraftId) {
      await updateAppScriptDraftStatus(sourceDraftId, "approved", { ...q, bankId: id });
    }
    clearBankForm();
    alert(sourceDraftId ? "Draft approve hokar Question Bank mein save ho gaya! ✅" : "Question update ho gaya! ✅");
  } catch(err) { console.warn(err); alert("Question save nahi hua. Firestore rules check karo."); }
}

async function deleteBankQuestion(id, skipConfirm) {
  if (!skipConfirm && !confirm("Ye question Recycle Bin mein move hoga. Wahan se restore ya permanently delete kar sakte ho.\n\nContinue karein?")) return;
  const db = getDB();
  if (!db) { alert("Firebase connected nahi hai. Page refresh karo."); return; }
  try {
    const doc = await db.collection("questionBank").doc(id).get();
    if (!doc.exists) { alert("Question mil nahi raha."); return; }
    const data = { ...doc.data(), _originalId: id, _deletedAt: firebase.firestore.FieldValue.serverTimestamp(), _deletedFrom: "questionBank" };
    await db.collection("deletedQuestions").doc(id).set(data);
    // Permanent record ki ye question kabhi dobara seed na ho (chahe Recycle Bin se
    // "Delete Forever" bhi kar diya jaaye) — restore karne par hi ye hatega.
    await db.collection("seedExclusions").doc(id).set({ excludedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection("questionBank").doc(id).delete();
    questionBank = questionBank.filter(q => q.id !== id);
    window.questionBank = questionBank;
    console.log("[TRASH] Moved to Recycle Bin:", id);
  } catch(err) {
    console.error("[DELETE] Error:", err);
    if (err.code === "permission-denied") {
      alert("❌ Permission Denied!\n\nFirestore Rules delete allow nahi kar rahi.\n\nFirebase Console > Firestore Database > Rules mein:\nallow delete: if true;\nAdd karo phir publish karo.");
    } else {
      alert("Delete nahi hua! Error: " + (err.message || err));
    }
  }
}

async function mergeDuplicateGroup(keepId, removeIds) {
  let ok = 0, fail = 0;
  for (const id of removeIds) {
    if (id === keepId) continue;
    try { await deleteBankQuestion(id, true); ok++; }
    catch (e) { fail++; }
  }
  return { ok, fail };
}
window.mergeDuplicateGroup = mergeDuplicateGroup;
window.deleteBankQuestion = deleteBankQuestion;


function toggleSelectAllBank(checked) {
  document.querySelectorAll(".bank-q-checkbox").forEach(cb => cb.checked = checked);
  updateBankSelectionUI();
}

function updateBankSelectionUI() {
  const all = document.querySelectorAll(".bank-q-checkbox");
  const selected = document.querySelectorAll(".bank-q-checkbox:checked");
  const count = selected.length;

  const countEl = $("#bank-selected-count");
  const deleteBtn = $("#bank-delete-selected-btn");
  const selectAllCb = $("#bank-select-all");

  if (countEl) {
    if (count > 0) {
      countEl.textContent = `${count} selected`;
      countEl.style.display = "inline";
    } else {
      countEl.style.display = "none";
    }
  }
  if (deleteBtn) deleteBtn.style.display = count > 0 ? "inline-block" : "none";
  const moveBtn = $("#bank-move-selected-btn");
  if (moveBtn) moveBtn.style.display = count > 0 ? "inline-block" : "none";
  if (selectAllCb && all.length > 0) {
    selectAllCb.indeterminate = count > 0 && count < all.length;
    if (count === all.length) selectAllCb.checked = true;
    else if (count === 0) selectAllCb.checked = false;
  }
}

function openMoveChapterModal() {
  const selected = [...document.querySelectorAll(".bank-q-checkbox:checked")];
  if (!selected.length) return;

  const modal = $("#move-chapter-modal");
  const countEl = $("#move-modal-count");
  const subjSel = $("#move-target-subject");
  const newChapInp = $("#move-target-new-chapter");

  if (countEl) countEl.textContent = selected.length + " questions select hain — inhe kahan move karna hai?";
  if (newChapInp) newChapInp.value = "";

  // Fill subjects
  const subjects = [...new Set(questionBank.map(q => getQuestionSubject(q)).filter(Boolean))].sort();
  if (subjSel) {
    subjSel.innerHTML = subjects.map(s => `<option value="${s}">${s}</option>`).join("");
    subjSel.value = subjects[0] || "";
  }
  populateMoveChapterList();

  if (modal) { modal.style.display = "flex"; }
}

function populateMoveChapterList() {
  const subjSel = $("#move-target-subject");
  const chapSel = $("#move-target-chapter");
  if (!subjSel || !chapSel) return;
  const subj = subjSel.value;
  const chapters = [...new Set(questionBank.filter(q => getQuestionSubject(q) === subj).map(q => q.chapter).filter(Boolean))].sort();
  chapSel.innerHTML = chapters.map(c => `<option value="${c}">${c}</option>`).join("");
}

function closeMoveChapterModal() {
  const modal = $("#move-chapter-modal");
  if (modal) modal.style.display = "none";
}

async function confirmMoveToChapter() {
  const selected = [...document.querySelectorAll(".bank-q-checkbox:checked")];
  if (!selected.length) { closeMoveChapterModal(); return; }

  const subjSel = $("#move-target-subject");
  const chapSel = $("#move-target-chapter");
  const newChapInp = $("#move-target-new-chapter");

  const targetSubject = subjSel?.value || "";
  const targetChapter = (newChapInp?.value?.trim()) || chapSel?.value || "";

  if (!targetChapter) { alert("Koi chapter select ya type karo."); return; }

  const ids = selected.map(cb => cb.dataset.id);
  const db = getDB();
  if (!db) { alert("Firebase connected nahi. Refresh karo."); return; }

  if (!confirm(`${ids.length} questions ko "${targetChapter}" (${targetSubject}) mein move karein?`)) return;

  closeMoveChapterModal();

  try {
    const CHUNK = 490;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = db.batch();
      ids.slice(i, i + CHUNK).forEach(id => {
        batch.update(db.collection("questionBank").doc(id), {
          chapter: targetChapter,
          subject: targetSubject,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
    }
    alert("✅ " + ids.length + " questions \"" + targetChapter + "\" chapter mein move ho gaye!");
  } catch(err) {
    console.error("Move failed:", err);
    alert("Move nahi hua. Error: " + (err.message || err));
  }
}

async function deleteSelectedBankQuestions() {
  const selected = [...document.querySelectorAll(".bank-q-checkbox:checked")];
  if (!selected.length) return;
  if (!confirm(selected.length + " questions Recycle Bin mein move honge. Wahan se restore ya permanently delete kar sakte ho.\n\nContinue karein?")) return;
  const ids = selected.map(cb => cb.dataset.id);

  const db = getDB();
  if (!db) { alert("Firebase connected nahi hai. Refresh karo aur dobara try karo."); return; }

  try {
    // First fetch all docs to backup
    const fetchBatch = ids.map(id => db.collection("questionBank").doc(id).get());
    const docs = await Promise.all(fetchBatch);

    const CHUNK = 490;
    // Move to deletedQuestions
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = db.batch();
      docs.slice(i, i + CHUNK).forEach(doc => {
        if (doc.exists) {
          const data = { ...doc.data(), _originalId: doc.id, _deletedAt: firebase.firestore.FieldValue.serverTimestamp(), _deletedFrom: "questionBank" };
          batch.set(db.collection("deletedQuestions").doc(doc.id), data);
          // Permanent seed-exclusion — "Delete Forever" karne par bhi ye wapas nahi aayega.
          batch.set(db.collection("seedExclusions").doc(doc.id), { excludedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
      });
      await batch.commit();
    }
    // Now delete from questionBank
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = db.batch();
      ids.slice(i, i + CHUNK).forEach(id => {
        batch.delete(db.collection("questionBank").doc(id));
      });
      await batch.commit();
    }
    alert(ids.length + " questions Recycle Bin mein move ho gaye! 🗑️\nAdmin > Recycle Bin se restore kar sakte ho.");
  } catch(err) {
    console.error("Batch delete failed:", err);
    alert("Delete nahi hua! Error: " + (err.message || err) + "\n\nFirestore rules check karo.");
  }
}

/* ══════════════════════════════════════════
   PDF IMPORT & DRAFT VERIFY
══════════════════════════════════════════ */
async function handlePdfUpload() {
  const input = $("#pdf-upload");
  const status = $("#pdf-parse-status");
  const file = input?.files?.[0];
  if (!file) { alert("Pehle PDF file select karein."); return; }
  if (!window.PdfImport) { alert("PDF import module load nahi hua."); return; }

  const btn = $("#pdf-parse-btn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Parsing PDF..."; }
  if (status) { status.style.display = "block"; status.textContent = "PDF read ho rahi hai..."; }

  try {
    const { questions, fileName } = await window.PdfImport.importQuestionsFromPdf(file);
    if (!questions.length) {
      alert("PDF se koi question nahi mila.\n\nFormat check karein:\n1. Question text\n(A) option (B) option\nAnswer: B\nExplanation: ...\n\nSection: Section A: Title");
      return;
    }
    const db = getDB();
    if (!db) {
      questions.forEach((q, i) => {
        pdfDraftQuestions.unshift({ id: `local-pdf-${Date.now()}-${i}`, ...cloneQ(q), status: "pending", sourcePdf: fileName, importedAt: new Date().toISOString() });
      });
    } else {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const id = `pdf-draft-${Date.now()}-${i}`;
        await savePdfDraftOnline(id, { ...cloneQ(q), status: "pending", sourcePdf: fileName });
      }
    }
    if (status) status.textContent = `✅ ${questions.length} questions draft mein save ho gaye — verify karein.`;
    renderPdfDrafts();
    showAdminTab("pdf");
    alert(`✅ ${questions.length} questions PDF se nikale aur Draft mein save ho gaye!\nAb verify karke Bank ya Test mein add karein.`);
  } catch (err) {
    console.error(err);
    alert("PDF parse fail: " + err.message);
    if (status) status.textContent = "❌ Error: " + err.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🔍 PDF se Questions Nikalein"; }
  }
}

function renderPdfDrafts() {
  const list = $("#pdf-draft-list");
  if (!list) return;
  const filter = $("#pdf-draft-filter")?.value || "pending";
  let items = [...pdfDraftQuestions];
  if (filter === "pending") items = items.filter(d => d.status === "pending");
  else if (filter === "verified") items = items.filter(d => d.status === "verified");

  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = '<p class="empty-state">Koi PDF draft question nahi hai.</p>';
    return;
  }

  items.forEach(d => {
    const item = document.createElement("div");
    item.className = "item pdf-draft-item";
    const expl = d.explanationHI || d.explanationEN || d.explanation || "";
    const opts = (d.optionsHI || d.options || []).map((o, i) => `(${["A","B","C","D"][i]}) ${o}`).join(" · ");
    item.innerHTML = `
      <div class="pdf-draft-body">
        <div><span class="pdf-badge ${d.status}">${d.status}</span> <strong>${escHtml(d.section || "Section A")}</strong> · ${escHtml(d.sourcePdf || "PDF")}</div>
        <div class="pdf-q-text"><strong>Q.</strong> ${escHtml(d.textHI || d.text || d.textEN)}</div>
        <div class="pdf-q-opts">${escHtml(opts)}</div>
        <div class="pdf-q-ans"><strong>Answer:</strong> ${["A","B","C","D"][d.answer] || "A"}</div>
        ${expl ? `<div class="pdf-q-expl"><strong>Explanation:</strong> ${escHtml(expl)}</div>` : ""}
      </div>`;
    const acts = document.createElement("div");
    acts.className = "pdf-draft-actions";
    acts.append(
      mkBtn("✏️ Edit", "secondary", () => editPdfDraft(d.id)),
      mkBtn("🏦 Bank", "primary", () => verifyPdfDraftToBank(d.id)),
      mkBtn("➕ Test", "secondary", () => addPdfDraftToTest(d.id)),
      mkBtn("🗑️", "danger", () => deletePdfDraft(d.id))
    );
    item.appendChild(acts);
    list.appendChild(item);
  });
  if (window.renderMathIn) requestAnimationFrame(() => window.renderMathIn(list));
}

function editPdfDraft(id) {
  const d = pdfDraftQuestions.find(x => x.id === id);
  if (!d) return;
  populateQForm(d);
  if (d.section) ensureSectionExists(d.section);
  showAdminTab("tests");
  $("#add-question").textContent = "Update & Add to Test";
  editingDraftIndex = null;
  window._editingPdfDraftId = id;
  alert("Form mein edit karein, phir 'Add Question to Test' dabayein — PDF draft update ho jayega.");
}

async function verifyPdfDraftToBank(id) {
  const d = pdfDraftQuestions.find(x => x.id === id);
  if (!d) return;
  const bankId = `pdf-bank-${Date.now()}`;
  try {
    const q = cloneQ(d);
    if (window.autoFormatMathFields) window.autoFormatMathFields(q);
    await saveBankOnline(bankId, q);
    await updatePdfDraftStatus(id, "verified");
    alert("✅ Question Bank mein add ho gaya!");
    renderPdfDrafts();
    renderBank();
  } catch (err) {
    alert("Bank mein save fail: " + err.message);
  }
}

async function addPdfDraftToTest(id) {
  const d = pdfDraftQuestions.find(x => x.id === id);
  if (!d) return;
  const q = cloneQ(d);
  q.section = d.section || getActiveSectionTitle();
  ensureSectionExists(q.section);
  draftQuestions.push(q);
  await updatePdfDraftStatus(id, "verified");
  renderDrafts();
  renderTestSections();
  showAdminTab("tests");
  alert("✅ Test ke draft mein add ho gaya!");
}

async function deletePdfDraft(id) {
  if (!confirm("Is PDF draft question ko delete karein?")) return;
  const db = getDB();
  if (db) {
    try { await db.collection("pdfDrafts").doc(id).delete(); } catch (e) { console.warn(e); }
  }
  pdfDraftQuestions = pdfDraftQuestions.filter(d => d.id !== id);
  renderPdfDrafts();
}

async function updatePdfDraftStatus(id, status) {
  const d = pdfDraftQuestions.find(x => x.id === id);
  if (d) d.status = status;
  const db = getDB();
  if (db) {
    try {
      await db.collection("pdfDrafts").doc(id).set({ status, verifiedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) { console.warn(e); }
  }
  renderPdfDrafts();
}

async function savePdfDraftOnline(id, data) {
  const db = getDB();
  if (!db) return;
  await db.collection("pdfDrafts").doc(id).set({
    ...data,
    importedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function syncPdfDrafts() {
  const db = getDB();
  if (!db) { renderPdfDrafts(); return; }
  db.collection("pdfDrafts").onSnapshot(snap => {
    pdfDraftQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pdfDraftQuestions.sort((a, b) => String(b.importedAt || "").localeCompare(String(a.importedAt || "")));
    renderPdfDrafts();
  }, () => renderPdfDrafts());
}

/* ══════════════════════════════════════════
   APP SCRIPT DRAFT QUESTIONS
══════════════════════════════════════════ */
function renderAppScriptDrafts() {
  const list = $("#app-drafts-list");
  if (!list) return;

  const filter = $("#app-drafts-filter")?.value || "pending";
  let items = [...appScriptDraftQuestions];
  if (filter !== "all") items = items.filter(d => getAppScriptDraftStatus(d) === filter);

  const countEl = $("#app-drafts-count");
  if (countEl) {
    const pending = appScriptDraftQuestions.filter(d => getAppScriptDraftStatus(d) === "pending").length;
    countEl.textContent = `${pending} pending / ${appScriptDraftQuestions.length} total drafts`;
  }

  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = '<p class="empty-state">Koi App Script draft question nahi hai.</p>';
    return;
  }

  items.forEach(d => {
    const status = getAppScriptDraftStatus(d);
    const item = document.createElement("div");
    item.className = "item pdf-draft-item";
    const q = normalizeAppScriptDraft(d);
    const expl = q.explanationHI || q.explanationEN || q.explanation || "";
    const opts = (q.optionsHI || q.options || []).map((o, i) => `(${["A","B","C","D"][i]}) ${o}`).join(" · ");
    const source = d.sourceDocId || d.source || "AppsScript";
    item.innerHTML = `
      <div class="pdf-draft-body">
        <div><span class="pdf-badge ${status}">${status}</span> <strong>${escHtml(q.subject || "General")}</strong> · ${escHtml(q.chapter || "No chapter")}</div>
        <div class="pdf-q-text"><strong>Q.</strong> ${escHtml(q.textHI || q.text || q.textEN)}</div>
        <div class="pdf-q-opts">${escHtml(opts)}</div>
        <div class="pdf-q-ans"><strong>Answer:</strong> ${["A","B","C","D"][q.answer] || "A"} · <span style="color:#64748b;font-weight:600;">${escHtml(source)}</span></div>
        ${expl ? `<div class="pdf-q-expl"><strong>Explanation:</strong> ${escHtml(expl)}</div>` : ""}
      </div>`;

    const acts = document.createElement("div");
    acts.className = "pdf-draft-actions";
    acts.append(
      mkBtn("Approve", "primary", () => approveAppScriptDraftToBank(d.id)),
      mkBtn("Edit", "secondary", () => editAppScriptDraft(d.id)),
      mkBtn("Reject", "secondary", () => rejectAppScriptDraft(d.id)),
      mkBtn("Delete", "danger", () => deleteAppScriptDraft(d.id))
    );
    item.appendChild(acts);
    list.appendChild(item);
  });
}

function normalizeAppScriptDraft(d) {
  const q = cloneQ(d);
  q.chapter = q.chapter || "Apps Script Drafts";
  return q;
}

function getAppScriptDraftStatus(d) {
  return d?.status || "pending";
}

async function approveAppScriptDraftToBank(id) {
  const d = appScriptDraftQuestions.find(x => x.id === id);
  if (!d) return;
  const q = normalizeAppScriptDraft(d);
  if (!isValidQ(q)) {
    alert("Question incomplete hai. Pehle Edit karke text/options/answer complete karein.");
    return;
  }

  const bankId = makeBankIdFromDraftId(id);
  try {
    await saveBankOnline(bankId, q);
    await updateAppScriptDraftStatus(id, "approved", { ...q, bankId });
    renderBank();
    alert("Draft approve hokar Question Bank mein save ho gaya! ✅");
  } catch (err) {
    console.error(err);
    alert("Approve fail hua: " + (err.message || err));
  }
}

function editAppScriptDraft(id) {
  const d = appScriptDraftQuestions.find(x => x.id === id);
  if (!d) return;
  editingBankId = null;
  approvingAppScriptDraftId = id;
  populateBankForm(normalizeAppScriptDraft(d));
  $("#save-bank-question").textContent = "Approve & Save to Bank";
  showAdminTab("bank");
  showBankModal("Approve Draft Question");
}

async function rejectAppScriptDraft(id) {
  if (!confirm("Is draft ko rejected mark karein?")) return;
  await updateAppScriptDraftStatus(id, "rejected");
}

async function deleteAppScriptDraft(id) {
  if (!confirm("Is App Script draft ko delete karein?")) return;
  const db = getDB();
  if (db) {
    try { await db.collection("draftQuestions").doc(id).delete(); } catch (e) { console.warn(e); }
  }
  appScriptDraftQuestions = appScriptDraftQuestions.filter(d => d.id !== id);
  renderAppScriptDrafts();
}

async function updateAppScriptDraftStatus(id, status, extra = {}) {
  const idx = appScriptDraftQuestions.findIndex(x => x.id === id);
  if (idx >= 0) appScriptDraftQuestions[idx] = { ...appScriptDraftQuestions[idx], ...extra, status };

  const db = getDB();
  if (db) {
    const stampField = status === "approved" ? "approvedAt" : status === "rejected" ? "rejectedAt" : "updatedAt";
    try {
      await db.collection("draftQuestions").doc(id).set({
        ...extra,
        status,
        [stampField]: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) { console.warn(e); }
  }
  renderAppScriptDrafts();
}

async function loadAppScriptDraftsOnce() {
  const db = getDB();
  if (!db) { renderAppScriptDrafts(); return; }
  try {
    const snap = await db.collection("draftQuestions").get();
    appScriptDraftQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    sortAppScriptDrafts();
    renderAppScriptDrafts();
  } catch (err) {
    console.warn(err);
    alert("Drafts load nahi hue. Firestore rules check karein.");
  }
}

function syncAppScriptDrafts() {
  const db = getDB();
  if (!db) { renderAppScriptDrafts(); return; }
  db.collection("draftQuestions").onSnapshot(snap => {
    appScriptDraftQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    sortAppScriptDrafts();
    renderAppScriptDrafts();
  }, () => renderAppScriptDrafts());
}

function sortAppScriptDrafts() {
  appScriptDraftQuestions.sort((a, b) => getDraftTime(b) - getDraftTime(a) || a.id.localeCompare(b.id));
}

function getDraftTime(d) {
  const v = d?.importedAt || d?.createdAt || d?.updatedAt || d?.approvedAt || d?.rejectedAt;
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const parsed = Date.parse(String(v));
  return Number.isFinite(parsed) ? parsed : 0;
}

function makeBankIdFromDraftId(id) {
  const safe = String(id || Date.now()).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `appscript-bank-${safe || Date.now()}`;
}

/* ══════════════════════════════════════════
   BOARD RESULT SHEET
══════════════════════════════════════════ */
function formatResultDate(dateStr) {
  if (!dateStr) {
    return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getRankedResultsForTest(testId, extraRecord = null) {
  let recs = records.filter(r => r.testId === testId);
  if (extraRecord) recs = [...recs, extraRecord];
  recs.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return String(a.submittedIso || a.submittedAt || "").localeCompare(String(b.submittedIso || b.submittedAt || ""));
  });
  return recs.map((r, i) => ({
    rank: i + 1,
    name: r.name || "Student",
    score: r.score || 0,
    maxScore: r.maxScore || 0,
    percentage: r.percentage ?? (r.maxScore > 0 ? ((r.score || 0) / r.maxScore) * 100 : 0),
    submittedAt: r.submittedAt,
    submittedIso: r.submittedIso
  }));
}

function buildBoardResultSheetHTML({ testTitle, maxScore, date, rows, highlightName }) {
  const totalStudents = rows.length;
  const top3 = rows.slice(0, 3);
  const medalEmoji = ["🥇", "🥈", "🥉"];
  const medalClass = ["gold", "silver", "bronze"];
  const rankLabel = ["1st", "2nd", "3rd"];

  const bodyRows = rows.length
    ? rows.map(row => {
        const isMe = highlightName && row.name.trim().toLowerCase() === highlightName.trim().toLowerCase();
        const rankCell = row.rank <= 3
          ? `<span class="rs-medal">${medalEmoji[row.rank - 1]}</span>`
          : row.rank;
        return `<tr class="${isMe ? "rs-highlight" : ""}">
          <td class="rs-rank">${rankCell}</td>
          <td class="rs-name">${escHtml(row.name)}</td>
          <td class="rs-marks">${fmtNum(row.score)}</td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="3" class="rs-empty">Abhi tak koi result nahi hai</td></tr>';

  const top3HTML = top3.length
    ? top3.map((row, i) => `
      <div class="rs-top3-card rs-top3-${medalClass[i]}">
        <div class="rs-top3-medal">${medalEmoji[i]}</div>
        <div class="rs-top3-rank-tag">${rankLabel[i]}</div>
        <div class="rs-top3-name">${escHtml(row.name)}</div>
        <div class="rs-top3-score">${fmtNum(row.score)}</div>
      </div>`).join("")
    : '<div class="rs-empty" style="padding:16px 0;">Abhi tak koi result nahi hai</div>';

  return `
    <div class="board-result-sheet">
      <div class="rs-topbar">
        <div class="rs-brand">
          <img src="savyasachi-coaching-logo.png" alt="Savyasachi Coaching" class="rs-logo-circle" />
          <div class="rs-brand-text">
            <div class="rs-brand-hindi">सव्यसाची</div>
            <div class="rs-brand-sub">COACHING संस्थान</div>
            <div class="rs-brand-tagline">✦ हमारा लक्ष्य, आपकी सफलता ✦</div>
          </div>
        </div>
        <div class="rs-trophy-icon">🏆</div>
      </div>

      <div class="rs-title-ribbon"><span>⭐ RESULT SHEET ⭐</span></div>

      <div class="rs-meta-row">
        <div class="rs-meta-chip">
          <div class="rs-meta-chip-label">📅 दिनांक</div>
          <div class="rs-meta-chip-value">${escHtml(formatResultDate(date))}</div>
        </div>
        <div class="rs-meta-center">⭐ ${testTitle ? escHtml(testTitle) : "परीक्षा परिणाम"} ⭐</div>
        <div class="rs-meta-chip">
          <div class="rs-meta-chip-label">👥 कुल विद्यार्थी</div>
          <div class="rs-meta-chip-value">${totalStudents}</div>
        </div>
      </div>

      <div class="rs-body">
        <div class="rs-table-col">
          <table class="rs-table">
            <thead>
              <tr>
                <th>रैंक</th>
                <th>विद्यार्थी का नाम</th>
                <th>प्राप्तांक${maxScore ? ` / ${fmtNum(maxScore)}` : ""}</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
        <div class="rs-top3-col">
          <div class="rs-top3-title">⭐ TOP PERFORMERS ⭐</div>
          ${top3HTML}
          <div class="rs-quote-box">🎓 मेहनत आज की,<br>सफलता कल की ✒️</div>
        </div>
      </div>

      <div class="rs-footer-bar">
        <div class="rs-footer-item">🏆 <strong>शाबाश!</strong> आपने बेहतरीन प्रदर्शन किया है!</div>
        <div class="rs-footer-item">🎯 लगातार मेहनत करते रहिए, सफलता निश्चित है!</div>
        <div class="rs-footer-item">शिक्षक के हस्ताक्षर ✍️</div>
      </div>
    </div>`;
}

function renderBoardResultSheet(container, opts) {
  if (!container) return;
  container.innerHTML = buildBoardResultSheetHTML(opts);
}

function getTestsWithResults() {
  const map = new Map();
  records.forEach(r => {
    if (!r.testId) return;
    if (!map.has(r.testId)) {
      map.set(r.testId, {
        testId: r.testId,
        testTitle: r.testTitle || r.testId,
        maxScore: r.maxScore || 0,
        latestDate: r.submittedIso || r.submittedAt || ""
      });
    } else {
      const cur = map.get(r.testId);
      if ((r.maxScore || 0) > cur.maxScore) cur.maxScore = r.maxScore;
      const d = r.submittedIso || r.submittedAt || "";
      if (d > cur.latestDate) cur.latestDate = d;
    }
  });
  return [...map.values()].sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)));
}

function renderStudentResultPicker() {
  const sel = $("#result-test-select");
  if (!sel) return;
  const cur = sel.value;
  const tests = getTestsWithResults();
  sel.innerHTML = '<option value="">— Test chunein —</option>';
  tests.forEach(t => {
    const op = document.createElement("option");
    op.value = t.testId;
    op.textContent = `${t.testTitle} (${getRankedResultsForTest(t.testId).length} students)`;
    sel.appendChild(op);
  });
  if (cur && tests.some(t => t.testId === cur)) sel.value = cur;
}

function renderStudentResultSheet() {
  const sel = $("#result-test-select");
  const wrap = $("#student-result-sheet");
  if (!sel || !wrap) return;
  const testId = sel.value;
  if (!testId) {
    wrap.innerHTML = '<p class="empty-state">Upar se test select karein.</p>';
    return;
  }
  const sample = records.find(r => r.testId === testId);
  const rows = getRankedResultsForTest(testId);
  const studentName = $("#student-name")?.value?.trim() || "";
  renderBoardResultSheet(wrap, {
    testTitle: sample?.testTitle || testId,
    maxScore: sample?.maxScore || rows[0]?.maxScore || 0,
    date: sample?.submittedIso || sample?.submittedAt,
    rows,
    highlightName: studentName
  });
}

/* ══════════════════════════════════════════
   RECORDS
══════════════════════════════════════════ */
function printSingleResultSheet(wrapId) {
  document.querySelectorAll(".board-result-sheet-wrap").forEach(el => {
    el.classList.toggle("rs-print-active", el.id === wrapId);
  });
  document.body.classList.add("rs-printing-single");
  window.print();
}
window.addEventListener("afterprint", () => {
  document.body.classList.remove("rs-printing-single");
  document.querySelectorAll(".board-result-sheet-wrap").forEach(el => el.classList.remove("rs-print-active"));
});

// ── Grade Subjective Answers (admin) ─────────────────────────────
// Do tareeke se subjective marks yahan aate hain:
//   1. "Embedded" — jab test ke andar hi Question Type = Subjective
//      wala asli question tha aur student ne online type karke jawab diya.
//   2. "Manual" — jab test ke Subjective Marks (optional) field mein
//      total marks set hai (Word/offline wale subjective paper ke liye),
//      aur admin sirf ek total number deta hai us student ke liye.
function renderGradeTestSelect() {
  const sel = $("#grade-test-select");
  if (!sel) return;
  const curVal = sel.value;
  const pendingTestIds = new Set(records.filter(r => Number(r.pendingSubjective) > 0).map(r => r.testId));
  const manualTestIds = new Set(
    Object.keys(tests).filter(id => getTestSubjectiveMarks(tests[id]) > 0 && records.some(r => r.testId === id))
  );
  const testIds = [...new Set([...pendingTestIds, ...manualTestIds])];
  sel.innerHTML = '<option value="">— Test chunein —</option>';
  testIds.forEach(id => {
    const t = tests[id];
    const title = t ? t.title : (records.find(r => r.testId === id)?.testTitle || id);
    const pendingCount = records.filter(r => r.testId === id && Number(r.pendingSubjective) > 0).length;
    const label = pendingCount ? `${title} (${pendingCount} pending)` : `${title} (Subjective marks dena baaki)`;
    const op = document.createElement("option");
    op.value = id;
    op.textContent = label;
    sel.appendChild(op);
  });
  if (curVal && testIds.includes(curVal)) sel.value = curVal;
  sel.onchange = renderGradeStudentsList;
  renderGradeStudentsList();
}

function renderGradeStudentsList() {
  const sel = $("#grade-test-select");
  const list = $("#grade-students-list");
  const detail = $("#grade-detail-box");
  if (!list) return;
  list.innerHTML = "";
  if (detail) { detail.classList.add("hidden"); detail.innerHTML = ""; }
  const testId = sel ? sel.value : "";
  if (!testId) { list.innerHTML = '<p class="empty-state">Upar se test chunein.</p>'; return; }

  const test = tests[testId];
  const manualMax = getTestSubjectiveMarks(test);
  const pendingEmbedded = records.filter(r => r.testId === testId && Number(r.pendingSubjective) > 0);

  // Combined list: embedded-pending students first, then (agar is test ka
  // Subjective Marks field bhara hai) baaki sab students bhi — taaki unhe
  // manually total subjective marks diya ja sake.
  const seen = new Set();
  const rows = [];
  pendingEmbedded.forEach(r => { rows.push({ r, mode: "embedded" }); seen.add(r.id || r._localId); });
  if (manualMax > 0) {
    records.filter(r => r.testId === testId).forEach(r => {
      const key = r.id || r._localId;
      if (seen.has(key)) return;
      rows.push({ r, mode: "manual" });
      seen.add(key);
    });
  }

  if (!rows.length) { list.innerHTML = '<p class="empty-state">Is test mein koi subjective grading pending nahi hai.</p>'; return; }

  rows.forEach(({ r, mode }) => {
    const item = document.createElement("div");
    item.className = "item";
    let statusLabel;
    if (mode === "embedded") {
      statusLabel = `${r.pendingSubjective} subjective answer(s) pending`;
    } else {
      const given = r.externalSubjectiveAwarded !== undefined && r.externalSubjectiveAwarded !== null;
      statusLabel = given
        ? `Subjective diya: ${fmtNum(r.externalSubjectiveAwarded)}/${fmtNum(manualMax)}`
        : `Subjective marks abhi nahi diya (max ${fmtNum(manualMax)})`;
    }
    item.innerHTML = `<span><strong>${escHtml(r.name || "Student")}</strong> · ${escHtml(r.mobile || "")}<small>${statusLabel} · Score so far: ${fmtNum(r.score)}/${fmtNum(r.maxScore)}</small></span>`;
    const acts = document.createElement("div");
    if (mode === "embedded") {
      acts.appendChild(mkBtn("Grade Karein", "secondary", () => renderGradeDetail(r.id)));
    } else {
      acts.appendChild(mkBtn("Subjective Marks Dein", "secondary", () => renderManualSubjectiveDetail(r.id, testId)));
    }
    item.appendChild(acts);
    list.appendChild(item);
  });
}

// Manual subjective-marks entry (test.subjectiveMarks field wale tests ke liye) —
// student ki Word/offline copy check karke admin sirf ek total number deta hai.
function renderManualSubjectiveDetail(recordId, testId) {
  const r = records.find(rec => rec.id === recordId);
  const box = $("#grade-detail-box");
  if (!r || !box) return;
  box.classList.remove("hidden");
  box.innerHTML = "";
  const test = tests[testId];
  const maxMarks = getTestSubjectiveMarks(test);

  const h = document.createElement("h3");
  h.className = "section-title";
  h.textContent = `📝 ${r.name || "Student"} — Subjective Marks (Word/Offline)`;
  box.appendChild(h);

  const note = document.createElement("p");
  note.className = "muted-text";
  note.textContent = "Is test ka subjective portion system mein nahi hai (Word mein alag se hai) — student ki copy check karke yahan total marks daalein. Ye seedha uske total score/rank mein jud jayega.";
  box.appendChild(note);

  const totalRow = document.createElement("div");
  totalRow.className = "field-row";
  totalRow.style.cssText = "margin-top:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;";
  const label = document.createElement("label");
  label.textContent = `Subjective Marks (max ${fmtNum(maxMarks)})`;
  label.style.fontWeight = "700";
  const input = document.createElement("input");
  input.type = "number";
  input.id = "manual-subjective-input";
  input.min = "0";
  input.max = String(maxMarks);
  input.step = "0.5";
  input.value = (r.externalSubjectiveAwarded !== undefined && r.externalSubjectiveAwarded !== null) ? r.externalSubjectiveAwarded : "";
  input.style.maxWidth = "160px";
  totalRow.appendChild(label);
  totalRow.appendChild(input);
  box.appendChild(totalRow);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "💾 Marks Save Karein";
  saveBtn.onclick = () => saveManualSubjectiveMarks(r.id, input, maxMarks);
  box.appendChild(saveBtn);
}

// Idempotent: pehli baar MCQ-only score/maxScore snapshot le leta hai, taaki
// baad mein value edit karne par subjective marks double-count na ho.
async function saveManualSubjectiveMarks(recordId, totalInput, maxMarks) {
  const r = records.find(rec => rec.id === recordId);
  if (!r) return;
  if (totalInput.value === "") { alert("Subjective marks bharein."); return; }
  let awarded = Number(totalInput.value);
  if (isNaN(awarded)) { alert("Sahi number daalein."); return; }
  if (awarded < 0) awarded = 0;
  if (awarded > maxMarks) awarded = maxMarks;

  const baseScore = (r.mcqOnlyScore !== undefined && r.mcqOnlyScore !== null) ? r.mcqOnlyScore : r.score;
  const baseMax   = (r.mcqOnlyMaxScore !== undefined && r.mcqOnlyMaxScore !== null) ? r.mcqOnlyMaxScore : r.maxScore;

  const newScore = baseScore + awarded;
  const newMaxScore = baseMax + maxMarks;
  const newPct = newMaxScore > 0 ? (newScore / newMaxScore) * 100 : 0;

  const update = {
    mcqOnlyScore: baseScore,
    mcqOnlyMaxScore: baseMax,
    externalSubjectiveAwarded: awarded,
    externalSubjectiveMax: maxMarks,
    score: newScore,
    maxScore: newMaxScore,
    percentage: newPct
  };

  try {
    const db = getDB();
    if (db) await db.collection("studentRecords").doc(recordId).update(update);
    Object.assign(r, update);
    renderGradeStudentsList();
    renderRecords();
    alert("✅ Subjective marks save ho gaye! Student ka total score/rank update ho gaya.");
  } catch(err) {
    console.warn(err);
    alert("Marks save nahi hue. Error: " + (err.message || err));
  }
}

function renderGradeDetail(recordId) {
  const r = records.find(rec => rec.id === recordId);
  const box = $("#grade-detail-box");
  if (!r || !box) return;
  box.classList.remove("hidden");
  box.innerHTML = "";
  const h = document.createElement("h3");
  h.className = "section-title";
  h.textContent = `📝 ${r.name || "Student"} — Subjective Answers`;
  box.appendChild(h);

  const subjectiveQs = (r.details || [])
    .map((d, i) => ({ ...d, idx: i }))
    .filter(d => d.qType === "subjective" && d.status !== "Not answered");

  if (!subjectiveQs.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "Koi answered subjective question nahi mila.";
    box.appendChild(p);
    return;
  }

  const isOfflineMode = r.testMode === "OMR Offline" || r.testMode === "Manual Entry";
  subjectiveQs.forEach(d => {
    const card = document.createElement("div");
    card.style.cssText = "background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:10px;";
    const answerBoxText = d.studentAnswer
      ? escHtml(d.studentAnswer)
      : (isOfflineMode
          ? "📄 Yeh answer physical answer-sheet par likha hai (digitize nahi hua) — student ki copy dekh kar marks daalein."
          : "(khaali)");
    card.innerHTML =
      `<div style="font-weight:700;margin-bottom:6px;">Q${d.questionNo}. ${escHtml(d.questionHI || d.questionEN || "")} <span style="font-weight:400;color:#92400e;font-size:.82rem;">(max ${fmtNum(d.marksPerQuestion)})</span></div>` +
      `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;white-space:pre-wrap;font-size:.92rem;color:#374151;">${answerBoxText}</div>`;
    box.appendChild(card);
  });

  const maxTotal = subjectiveQs.reduce((s, d) => s + (Number(d.marksPerQuestion) || 0), 0);
  const alreadyGraded = subjectiveQs.every(d => d.subjectiveGraded);
  const prevTotal = alreadyGraded ? subjectiveQs.reduce((s, d) => s + (Number(d.marksAwarded) || 0), 0) : "";

  const totalRow = document.createElement("div");
  totalRow.className = "field-row";
  totalRow.style.cssText = "margin-top:4px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;";
  const totalLabel = document.createElement("label");
  totalLabel.textContent = `Kul Subjective Marks (max ${fmtNum(maxTotal)})`;
  totalLabel.style.fontWeight = "700";
  const totalInput = document.createElement("input");
  totalInput.type = "number";
  totalInput.id = "grade-total-marks-input";
  totalInput.min = "0";
  totalInput.max = String(maxTotal);
  totalInput.step = "0.5";
  totalInput.value = prevTotal;
  totalInput.style.maxWidth = "160px";
  totalRow.appendChild(totalLabel);
  totalRow.appendChild(totalInput);
  box.appendChild(totalRow);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "💾 Marks Save Karein";
  saveBtn.onclick = () => saveSubjectiveGrades(r.id, subjectiveQs.map(d => d.idx), totalInput, maxTotal);
  box.appendChild(saveBtn);
}

async function saveSubjectiveGrades(recordId, idxList, totalInput, maxTotal) {
  const r = records.find(rec => rec.id === recordId);
  if (!r) return;
  const details = (r.details || []).map(d => ({ ...d }));

  if (totalInput.value === "") { alert("Kul subjective marks bharein."); return; }
  let total = Number(totalInput.value);
  if (isNaN(total)) { alert("Sahi number daalein."); return; }
  if (total < 0) total = 0;
  if (total > maxTotal) total = maxTotal;

  // Teacher gives ONE total for the whole subjective portion rather than
  // grading question-by-question — so the entire total is recorded on
  // the first pending subjective question and the rest zeroed out. This
  // only affects internal bookkeeping; the student's overall score
  // (score = sum of all marksAwarded) comes out the same either way.
  idxList.forEach((idx, i) => {
    details[idx].marksAwarded = i === 0 ? total : 0;
    details[idx].subjectiveGraded = true;
    details[idx].status = "Graded";
  });

  const newScore = details.reduce((s, d) => s + (Number(d.marksAwarded) || 0), 0);
  const newPct = r.maxScore > 0 ? (newScore / r.maxScore) * 100 : 0;
  try {
    const db = getDB();
    if (db) {
      await db.collection("studentRecords").doc(recordId).update({
        details, score: newScore, percentage: newPct, pendingSubjective: 0
      });
    }
    r.details = details; r.score = newScore; r.percentage = newPct; r.pendingSubjective = 0;
    alert("Marks save ho gaye! ✅ Student ka total score update ho gaya hai.");
    renderGradeStudentsList();
  } catch (err) {
    console.warn(err);
    alert("Marks save nahi hue. Firestore rules check karo.");
  }
}

function renderRecords() {
  const list = $("#records-list");
  list.innerHTML = "";
  if (!records.length) {
    list.innerHTML = '<p class="empty-state">Abhi tak koi record nahi hai.</p>';
    return;
  }
  let tests = getTestsWithResults();

  // populate / sync the admin "Select Test" dropdown
  const adminSel = $("#admin-result-test-select");
  if (adminSel) {
    const curVal = adminSel.value;
    adminSel.innerHTML = '<option value="">— Sabhi Tests (ya neeche se ek test chunein) —</option>';
    tests.forEach(t => {
      const op = document.createElement("option");
      op.value = t.testId;
      op.textContent = `${t.testTitle} (${getRankedResultsForTest(t.testId).length} students)`;
      adminSel.appendChild(op);
    });
    if (curVal && tests.some(t => t.testId === curVal)) adminSel.value = curVal;
    if (adminSel.value) tests = tests.filter(t => t.testId === adminSel.value);
  }

  tests.forEach(t => {
    // Result sheet
    const wrap = document.createElement("div");
    wrap.className = "board-result-sheet-wrap";
    wrap.id = "rs-wrap-" + t.testId;
    const rows = getRankedResultsForTest(t.testId);
    renderBoardResultSheet(wrap, {
      testTitle: t.testTitle,
      maxScore: t.maxScore || rows[0]?.maxScore || 0,
      date: t.latestDate,
      rows
    });
    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "btn-secondary rs-print-btn rs-individual-print-btn";
    printBtn.textContent = "🖨️ Sirf Yeh Result Print Karein";
    printBtn.onclick = () => printSingleResultSheet(wrap.id);
    wrap.appendChild(printBtn);
    list.appendChild(wrap);

    // WhatsApp send panel for this test
    const testRecs = records.filter(r => r.testId === t.testId);
    const waPanel = document.createElement("div");
    waPanel.className = "card";
    waPanel.style.cssText = "margin: 8px 0 24px; border: 1.5px solid #25d366;";
    const rows2 = getRankedResultsForTest(t.testId);

    let tableRows = testRecs.map(r => {
      const phone = (r.mobile || r.parentPhone || "").replace(/\D/g, "");
      const fullPhone = phone ? (phone.startsWith("91") ? phone : "91" + phone) : "";
      const pct = r.percentage ? Math.round(r.percentage) : (r.maxScore > 0 ? Math.round((r.score/r.maxScore)*100) : 0);
      const grade = pct>=90?"A+":pct>=80?"A":pct>=70?"B+":pct>=60?"B":pct>=50?"C":"D";
      const passed = pct >= 33;
      const rankObj = rows2.find(row => row.name === (r.name||"Student"));
      const rank = rankObj ? rankObj.rank : "-";
      const msg = `🏫 *Savyasachi Coaching*\n\nNamaste! 🙏\n\n*${escHtml(r.name||"Student")}* ka result:\n\n📝 *Test:* ${escHtml(t.testTitle)}\n🎯 *Score:* ${fmtNum(r.score)} / ${fmtNum(r.maxScore)}\n📊 *Pratishat:* ${pct}%\n🏅 *Grade:* ${grade}\n🥇 *Rank:* ${rank} / ${testRecs.length}\n\n${passed?"Bahut achcha kiya! 👏🎉":"Mehnat karte rahein! 💪"}\n\n— Savyasachi Coaching Team`;
      const waUrl = fullPhone ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg.replace(/\\n/g,"\n"))}` : "";
      return `<tr>
        <td style="padding:7px 10px">${escHtml(r.name||"-")}</td>
        <td style="padding:7px 10px">${fmtNum(r.score)}/${fmtNum(r.maxScore)} (${pct}%)</td>
        <td style="padding:7px 10px">${rank}</td>
        <td style="padding:7px 10px">${phone ? phone : '<span style="color:#ef4444">Number nahi</span>'}</td>
        <td style="padding:7px 10px">
          ${waUrl
            ? `<a href="${waUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;background:#25d366;color:#fff;padding:4px 12px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">📱 Bhejein</a>`
            : `<span style="color:#94a3b8;font-size:12px">N/A</span>`
          }
        </td>
        <td style="padding:7px 10px">
          <button onclick="deleteRecord('${escHtml(r.id || r._localId || '')}','${escHtml(r.name||'')}','${escHtml(r.submittedIso||'')}')" style="background:#ef4444;color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">🗑️ Delete</button>
        </td>
      </tr>`;
    }).join("");

    waPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h4 style="margin:0;font-size:14px;color:#15803d">📱 WhatsApp — ${escHtml(t.testTitle)}</h4>
        <span style="font-size:12px;color:#64748b">${testRecs.filter(r=>(r.mobile||r.parentPhone||"").replace(/\D/g,"").length>=10).length} / ${testRecs.length} numbers available</span>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f0fdf4">
              <th style="padding:7px 10px;text-align:left;color:#166534">Naam</th>
              <th style="padding:7px 10px;text-align:left;color:#166534">Score</th>
              <th style="padding:7px 10px;text-align:left;color:#166534">Rank</th>
              <th style="padding:7px 10px;text-align:left;color:#166534">Number</th>
              <th style="padding:7px 10px;text-align:left;color:#166534">WhatsApp</th>
              <th style="padding:7px 10px;text-align:left;color:#166534">Delete</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
    list.appendChild(waPanel);
  });
  renderStudentResultPicker();
}

function renderAdminRecordsForSelectedTest() {
  renderRecords();
}
window.renderAdminRecordsForSelectedTest = renderAdminRecordsForSelectedTest;

/* ══════════════════════════════════════════
   ADMIN — STUDENTS DIRECTORY
   Every registered student (name, mobile/ID, PIN status) + a per-student
   view of ALL their saved records (online test, OMR-scan, Manual Entry —
   all use the same saveRecordOnline() shape) with full MCQ answer detail
   (question-wise: student's answer vs correct answer vs status).
   Password itself is never shown — only sha256 hashes are stored, which
   cannot be reversed to the original password. Use the existing "Student
   Password Reset" panel above (now one click away via the 🔑 button here).
══════════════════════════════════════════ */
let allStudentsCache = [];

let studentRecordCountByMobile = {};

async function loadStudentsDirectory() {
  const db = getDB();
  const listEl = $("#students-directory-list");
  if (!listEl) return;
  if (!db) { listEl.innerHTML = '<p class="empty-state">Internet/Firebase connection nahi hai.</p>'; return; }
  listEl.innerHTML = '<p class="muted-text">Loading...</p>';
  try {
    const snap = await db.collection(STUDENTS_COLLECTION).get();
    allStudentsCache = snap.docs.map(d => ({ mobile: d.id, ...d.data() }));
    allStudentsCache.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // NOTE: the live `records` array (synced elsewhere) only keeps the
    // most-recent 200 studentRecords SITE-WIDE for performance, so
    // filtering it per-student under-counts (often to 0) once the site
    // has more than 200 total submissions — that's why a student could
    // show "no data" here until you opened their individual "📄 Answers"
    // view, which correctly queries just that student's own records
    // with no limit. Do the same here: one accurate, unlimited pass over
    // studentRecords (only when this tab is actually opened) so every
    // student's real count shows up immediately.
    try {
      const recSnap = await db.collection("studentRecords").get();
      const counts = {};
      recSnap.docs.forEach(d => {
        const m = normalizeMobile(d.data().mobile || "");
        if (!m) return;
        counts[m] = (counts[m] || 0) + 1;
      });
      studentRecordCountByMobile = counts;
    } catch (e) {
      console.warn("[StudentsDirectory] Full record count failed, falling back to cached records:", e);
      studentRecordCountByMobile = {};
    }

    renderStudentsDirectory();
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<p class="empty-state">Students load nahi hue: ' + escHtml(err.message || "") + "</p>";
  }
}

function renderStudentsDirectory() {
  const listEl = $("#students-directory-list");
  if (!listEl) return;
  const q = ($("#students-directory-search")?.value || "").trim().toLowerCase();
  let list = allStudentsCache;
  if (q) list = list.filter(s => (s.name || "").toLowerCase().includes(q) || (s.mobile || "").includes(q));

  if (!allStudentsCache.length) { listEl.innerHTML = '<p class="empty-state">Abhi tak koi student register nahi hua.</p>'; return; }
  if (!list.length) { listEl.innerHTML = '<p class="empty-state">Koi student nahi mila.</p>'; return; }

  listEl.innerHTML = `
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f1f5f9">
        <th style="padding:7px 10px;text-align:left">Naam</th>
        <th style="padding:7px 10px;text-align:left">Mobile (ID)</th>
        <th style="padding:7px 10px;text-align:left">Security PIN</th>
        <th style="padding:7px 10px;text-align:left">Registered</th>
        <th style="padding:7px 10px;text-align:left">Tests Diye</th>
        <th style="padding:7px 10px;text-align:left">Action</th>
      </tr></thead>
      <tbody>
        ${list.map(s => {
          const recCount = studentRecordCountByMobile[s.mobile] != null
            ? studentRecordCountByMobile[s.mobile]
            : (records || []).filter(r => normalizeMobile(r.mobile) === s.mobile).length;
          const regDate = (s.createdAt && s.createdAt.toDate) ? s.createdAt.toDate().toLocaleDateString("en-IN") : "-";
          return `<tr style="border-top:1px solid #e2e8f0">
            <td style="padding:7px 10px">${escHtml(s.name || "-")}</td>
            <td style="padding:7px 10px">${escHtml(s.mobile || "-")}</td>
            <td style="padding:7px 10px">${s.hasPin ? "✅ Set" : "⚠️ Nahi"}</td>
            <td style="padding:7px 10px">${regDate}</td>
            <td style="padding:7px 10px">${recCount}${recCount ? "" : " (ya offline OMR/Manual bhi ho sakte hain — neeche check karein)"}</td>
            <td style="padding:7px 10px;white-space:nowrap;">
              <button type="button" onclick="viewStudentAnswers('${s.mobile}')" style="background:#2563eb;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;margin-right:6px;">📄 Answers</button>
              <button type="button" onclick="prefillAdminResetMobile('${s.mobile}')" style="background:#dc2626;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;">🔑 Reset</button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    </div>`;
}

function prefillAdminResetMobile(mobile) {
  const input = $("#admin-reset-student-mobile");
  if (input) { input.value = mobile; input.scrollIntoView({ behavior: "smooth", block: "center" }); input.focus(); }
}

// Also allow looking up a student who ISN'T registered (pure OMR/Manual
// Entry records saved with just name+mobile, no login account) by typing
// any mobile number directly.
async function viewStudentAnswersByInput() {
  const mobile = normalizeMobile($("#students-directory-lookup-mobile")?.value || "");
  if (!/^\d{10}$/.test(mobile)) { alert("Sahi 10-digit mobile number likhein."); return; }
  viewStudentAnswers(mobile);
}

async function viewStudentAnswers(mobile) {
  const area = $("#student-answers-detail-area");
  if (!area) return;
  area.innerHTML = '<div class="card" style="margin-top:12px;"><p class="muted-text">Loading...</p></div>';
  area.scrollIntoView({ behavior: "smooth", block: "center" });

  const db = getDB();
  let myRecs = [];
  try {
    if (db) {
      const snap = await db.collection("studentRecords").where("mobile", "==", mobile).get();
      myRecs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      myRecs = (records || []).filter(r => normalizeMobile(r.mobile) === mobile);
    }
  } catch (err) {
    console.warn("Firestore query fail hui, local records se try kar rahe hain:", err);
    myRecs = (records || []).filter(r => normalizeMobile(r.mobile) === mobile);
  }
  myRecs.sort((a, b) => (b.submittedIso || "").localeCompare(a.submittedIso || ""));

  const student = allStudentsCache.find(s => s.mobile === mobile);
  const displayName = student?.name || myRecs[0]?.name || "Student";

  if (!myRecs.length) {
    area.innerHTML = `<div class="card" style="margin-top:12px;"><p class="empty-state">${escHtml(displayName)} (${mobile}) ka koi result nahi mila.</p></div>`;
    return;
  }

  window._currentStudentAnswerRecs = myRecs;
  area.innerHTML = `
    <div class="card" style="margin-top:12px;">
      <h4 style="margin-bottom:8px;">📄 ${escHtml(displayName)} (${mobile}) — Sabhi Attempts</h4>
      ${myRecs.map((r, idx) => {
        const pct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
        const hasDetails = Array.isArray(r.details) && r.details.length > 0;
        const dateTxt = (typeof formatResultDate === "function") ? formatResultDate(r.submittedIso) : "";
        return `
        <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f8fafc;flex-wrap:wrap;gap:8px;">
            <div>
              <strong>${escHtml(r.testTitle || r.testId || "Test")}</strong>
              <div style="font-size:.78rem;color:#64748b;">${dateTxt ? dateTxt + " · " : ""}${escHtml(r.testMode || "Online")} · Score: ${r.score}/${r.maxScore} (${pct}%)</div>
            </div>
            ${hasDetails
              ? `<button type="button" onclick="toggleStudentAnswerDetail(${idx})" style="background:#0891b2;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer;">MCQ Answers Dekhein</button>`
              : `<span style="color:#94a3b8;font-size:12px;">Detail unavailable</span>`}
          </div>
          <div id="student-answer-detail-${idx}" class="hidden" style="padding:8px 12px;max-height:360px;overflow-y:auto;"></div>
        </div>`;
      }).join("")}
    </div>`;
}

function toggleStudentAnswerDetail(idx) {
  const el = $(`#student-answer-detail-${idx}`);
  if (!el) return;
  if (el.classList.contains("hidden") && !el.dataset.built) {
    const rec = (window._currentStudentAnswerRecs || [])[idx];
    const details = rec?.details || [];
    const letters = ["A", "B", "C", "D"];
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:5px 8px;text-align:left">Q</th>
          <th style="padding:5px 8px;text-align:left">Student Ka Answer</th>
          <th style="padding:5px 8px;text-align:left">Sahi Answer</th>
          <th style="padding:5px 8px;text-align:left">Status</th>
        </tr></thead>
        <tbody>
          ${details.map(d => {
            const sAns = (d.studentAnswer === null || d.studentAnswer === undefined) ? "— Blank —" : (letters[d.studentAnswer] || "-");
            const cAns = letters[d.correctAnswer] || "-";
            const color = d.status === "Correct" ? "#16a34a" : d.status === "Wrong" ? "#dc2626" : "#94a3b8";
            return `<tr style="border-top:1px solid #f1f5f9">
              <td style="padding:5px 8px">Q${d.questionNo}</td>
              <td style="padding:5px 8px">${escHtml(sAns)}</td>
              <td style="padding:5px 8px">${escHtml(cAns)}</td>
              <td style="padding:5px 8px;color:${color};font-weight:600">${escHtml(d.status || "")}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
    el.dataset.built = "1";
  }
  el.classList.toggle("hidden");
}
window.viewStudentAnswers = viewStudentAnswers;
window.viewStudentAnswersByInput = viewStudentAnswersByInput;
window.toggleStudentAnswerDetail = toggleStudentAnswerDetail;
window.prefillAdminResetMobile = prefillAdminResetMobile;
window.renderStudentsDirectory = renderStudentsDirectory;

async function deleteRecord(id, name, submittedIso) {
  if (!confirm(`${name || "Student"} ka result delete karein?`)) return;
  const db = getDB();

  // Remove from Firebase if it has a real doc id (not a local_ id)
  if (db && id && !id.startsWith("local_")) {
    try { await db.collection("studentRecords").doc(id).delete(); }
    catch(e) { console.warn("Firebase delete failed", e); }
  }

  // Remove from localStorage
  try {
    let local = JSON.parse(localStorage.getItem("savya_records") || "[]");
    local = local.filter(r => !((r._localId === id) || (r.id === id) || (r.name === name && r.submittedIso === submittedIso)));
    localStorage.setItem("savya_records", JSON.stringify(local));
  } catch(e) {}

  // Remove from in-memory records
  records = records.filter(r => !((r._localId === id) || (r.id === id) || (r.name === name && r.submittedIso === submittedIso)));
  renderRecords();
  renderStudentResultPicker();
}

async function clearRecords() {
  if (!confirm("Saare records delete karein?")) return;
  const db = getDB();
  if (!db) { records = []; renderRecords(); return; }
  try {
    const snap = await db.collection("studentRecords").get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    records = [];
    renderRecords();
  } catch(err) { console.warn(err); alert("Records delete nahi hue."); }
}

/* ══════════════════════════════════════════
   FIREBASE SYNC HELPERS
══════════════════════════════════════════ */
function getDB() { return window.vishnuFirebase?.enabled ? window.vishnuFirebase.db : null; }

async function testFirebaseDelete() {
  const db = getDB();
  if (!db) { alert("❌ Firebase connected nahi hai!"); return; }
  
  // Create a test document then delete it
  const testId = "delete-test-" + Date.now();
  try {
    // Step 1: Write
    await db.collection("questionBank").doc(testId).set({ _test: true, chapter: "_test" });
    
    // Step 2: Delete
    await db.collection("questionBank").doc(testId).delete();
    
    // Step 3: Verify
    const check = await db.collection("questionBank").doc(testId).get();
    if (check.exists) {
      alert("❌ DELETE NAHI HO RAHA!\n\nFirestore Rules mein delete permission nahi hai.\n\nFirebase Console > Firestore > Rules mein ye rules set karo:\n\nallow read, write, delete: if true;\n\nPhir Publish karo.");
    } else {
      alert("✅ Firebase delete sahi kaam kar raha hai!\n\nAgar question delete karke refresh pe wapas aa raha hai toh:\n- Browser console (F12) mein error dekho\n- Ya chapter name exact match check karo");
    }
  } catch(err) {
    if (err.code === "permission-denied") {
      alert("❌ PERMISSION DENIED!\n\nFirestore Security Rules delete allow nahi kar rahi.\n\nFix:\n1. Firebase Console kholo\n2. Firestore Database > Rules tab\n3. Ye add karo: allow delete: if true;\n4. Publish karo");
    } else {
      alert("❌ Firebase Error: " + err.message);
    }
  }
}

let testQuestionsCache = {}; // testId -> cached questions array, snapshot re-fires ke beech reuse hota hai

function syncTests() {
  const db = getDB();
  if (!db) { renderTests(); return; }
  db.collection("tests").onSnapshot(async snap => {
    const newRemote = {};
    snap.forEach(d => { newRemote[d.id] = d.data(); });

    // Sirf naye ya actually badle hue tests ke chunks hi dobara fetch karo.
    // Pehle yahan HAR snapshot event par (jo ek hi write ke liye 2 baar tak
    // fire ho sakta hai — pehle local-cache se, phir server-confirm se, aur
    // waise bhi kisi bhi test mein change hone par sabko fire hota hai)
    // saare tests ke saare question-chunks phir se load ho rahe the, chahe
    // wo test badla ho ya nahi — matlab har connected user ke liye lagatar
    // bahut saare unnecessary Firestore reads ho rahe the, jo poori site
    // ko hamesha thoda slow bana rahe the. Ab sirf docChanges() mein aaye
    // (naye/modified) test IDs ke liye hi fresh fetch hota hai; baaki
    // cache se turant mil jaate hain.
    const changedIds = new Set(snap.docChanges().map(c => c.doc.id));

    await Promise.all(Object.entries(newRemote).map(async ([id, t]) => {
      if (Array.isArray(t.questions)) return; // old-format doc, questions already inline
      const needsFreshFetch = changedIds.has(id) || !testQuestionsCache[id];
      if (!needsFreshFetch) {
        t.questions = testQuestionsCache[id];
        return;
      }
      try {
        t.questions = await loadTestQuestions(db, id, t.chunkCount || 0);
        testQuestionsCache[id] = t.questions;
      } catch(e) {
        console.warn("[syncTests] chunk load failed for", id, e);
        t.questions = testQuestionsCache[id] || [];
      }
    }));
    remoteTests = newRemote;
    Object.keys(testQuestionsCache).forEach(id => { if (!(id in newRemote)) delete testQuestionsCache[id]; });
    rebuildTests();
    renderTests($("#test-select")?.value);
  }, () => renderTests());
}

function syncDeletedTests() {
  const db = getDB();
  if (!db) return;
  db.collection("deletedTests").onSnapshot(snap => {
    deletedTestIds = new Set(snap.docs.map(d => d.id));
    renderTests($("#test-select")?.value);
  });
}

let _bankSyncStarted = false;
function syncBank() {
  if (_bankSyncStarted) return; // already subscribed (admin panel or student practice mode)
  const db = getDB();
  if (!db) { renderBank(); return; }
  _bankSyncStarted = true;
  db.collection("questionBank").onSnapshot(snap => {
    questionBank = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Auto-format math equations for Math subject questions (book-style LaTeX)
    if (window.autoFormatMathFields) {
      questionBank = questionBank.map(q => window.autoFormatMathFields(Object.assign({}, q)) || q);
      window.questionBank = questionBank;
    }
    questionBank.sort((a, b) => a.id.localeCompare(b.id));
    window.questionBank = questionBank;
    console.log("[syncBank] Loaded", questionBank.length, "questions from Firebase");
    renderBank();
    // Bank aur Bulk Upload tab ke "existing subject/chapter" select dropdowns
    // ko bhi refresh karo, taaki abhi-abhi Firestore se aaye naye subjects/
    // chapters turant dikhne lagein (pehle sirf localStorage/builtin dikhte the).
    if (typeof refreshExistingSubjectChapterDropdowns === "function") refreshExistingSubjectChapterDropdowns();
    if (window.scheduleAutoDuplicateCheck) window.scheduleAutoDuplicateCheck();
    if (window.SavyaExtras && window.SavyaExtras.syncPracticeFilters) window.SavyaExtras.syncPracticeFilters();
  }, (err) => {
    console.warn("[syncBank] Firestore error:", err);
    // Retry once after 3 seconds
    setTimeout(() => {
      db.collection("questionBank").get().then(snap => {
        questionBank = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (window.autoFormatMathFields) {
          questionBank = questionBank.map(q => window.autoFormatMathFields(Object.assign({}, q)) || q);
        }
        questionBank.sort((a, b) => a.id.localeCompare(b.id));
        window.questionBank = questionBank;
        console.log("[syncBank] Retry loaded", questionBank.length, "questions");
        renderBank();
        if (window.scheduleAutoDuplicateCheck) window.scheduleAutoDuplicateCheck();
        if (window.SavyaExtras && window.SavyaExtras.syncPracticeFilters) window.SavyaExtras.syncPracticeFilters();
      }).catch(e => { console.warn("[syncBank] Retry failed:", e); renderBank(); });
    }, 3000);
  });
}


function syncTrashBin() {
  const db = getDB();
  if (!db) return;
  db.collection("deletedQuestions").orderBy("_deletedAt", "desc").onSnapshot(snap => {
    deletedQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Update trash tab badge
    const trashTab = document.querySelector("#trash-tab");
    if (trashTab) {
      const count = deletedQuestions.length;
      trashTab.textContent = "🗑️ Recycle Bin" + (count > 0 ? ` (${count})` : "");
    }
    if (!document.querySelector("#trash-box")?.classList.contains("hidden")) renderTrashBin();
  }, err => {
    console.warn("[syncTrashBin] error:", err);
  });
}

function renderTrashBin() {
  const box = document.querySelector("#trash-box");
  if (!box) return;

  // Purani (ab deleted) IDs ko selection set se hata do taaki stale selection na rahe
  const liveIds = new Set(deletedQuestions.map(q => q.id));
  selectedTrashIds.forEach(id => { if (!liveIds.has(id)) selectedTrashIds.delete(id); });

  if (deletedQuestions.length === 0) {
    box.innerHTML = `<div class="card" style="text-align:center;padding:40px;">
      <div style="font-size:3rem;margin-bottom:12px;">🗑️</div>
      <h3 style="color:#6b7280;">Recycle Bin khali hai</h3>
      <p style="color:#9ca3af;font-size:.9rem;">Koi bhi deleted question yahan nahi hai.</p>
    </div>`;
    return;
  }

  // Group by chapter
  const byChapter = {};
  deletedQuestions.forEach(q => {
    const ch = q.chapter || "Unknown";
    if (!byChapter[ch]) byChapter[ch] = [];
    byChapter[ch].push(q);
  });

  const searchVal = (document.querySelector("#trash-search")?.value || "").toLowerCase();

  // Kaunse questions abhi visible (search-filtered) hain — "Select All" isi list par kaam karega
  const visibleIds = [];
  Object.entries(byChapter).forEach(([chapter, qs]) => {
    const filtered = searchVal ? qs.filter(q =>
      (q.questionEn || q.question_en || "").toLowerCase().includes(searchVal) ||
      (q.questionHi || q.question_hi || "").toLowerCase().includes(searchVal) ||
      chapter.toLowerCase().includes(searchVal) ||
      (q.subject || "").toLowerCase().includes(searchVal)
    ) : qs;
    filtered.forEach(q => visibleIds.push(q.id));
  });
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedTrashIds.has(id));
  const selectedCount = selectedTrashIds.size;

  let html = `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
      <h3 class="section-title" style="margin:0;">🗑️ Recycle Bin — ${deletedQuestions.length} Questions</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input type="text" id="trash-search" placeholder="🔍 Search deleted questions..." style="padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:.85rem;min-width:200px;" oninput="renderTrashBin()" />
        <button onclick="restoreAllQuestions()" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:.8rem;cursor:pointer;font-weight:600;">♻️ Restore All</button>
        <button onclick="emptyTrashBin()" style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:.8rem;cursor:pointer;font-weight:600;">🔥 Permanently Delete All</button>
      </div>
    </div>
    <p style="color:#6b7280;font-size:.85rem;margin-bottom:10px;">⚠️ Yahan se questions restore kar sakte ho wapis Question Bank mein. "Permanently Delete" se question hamesha ke liye chala jayega.</p>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:#374151;cursor:pointer;">
        <input type="checkbox" id="trash-select-all" ${allVisibleSelected ? "checked" : ""} onchange="toggleSelectAllTrash(this.checked)" />
        Select All ${searchVal ? "(visible)" : ""}
      </label>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:.8rem;color:#6b7280;">${selectedCount} selected</span>
        <button onclick="restoreSelectedQuestions()" ${selectedCount === 0 ? "disabled" : ""} style="background:${selectedCount === 0 ? "#9ca3af" : "#2563eb"};color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:.78rem;cursor:${selectedCount === 0 ? "not-allowed" : "pointer"};font-weight:600;">♻️ Restore Selected</button>
      </div>
    </div>`;

  Object.entries(byChapter).forEach(([chapter, qs]) => {
    const filtered = searchVal ? qs.filter(q =>
      (q.questionEn || q.question_en || "").toLowerCase().includes(searchVal) ||
      (q.questionHi || q.question_hi || "").toLowerCase().includes(searchVal) ||
      chapter.toLowerCase().includes(searchVal) ||
      (q.subject || "").toLowerCase().includes(searchVal)
    ) : qs;
    if (!filtered.length) return;

    html += `<div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;background:#fef3c7;border-radius:8px;padding:8px 14px;margin-bottom:8px;">
        <strong style="color:#92400e;">📂 ${chapter}</strong>
        <span style="color:#78350f;font-size:.8rem;">${filtered.length} questions</span>
      </div>`;

    filtered.forEach(q => {
      const qText = q.questionEn || q.question_en || q.questionHi || q.question_hi || "(No text)";
      const deletedAt = q._deletedAt?.toDate ? q._deletedAt.toDate().toLocaleString("en-IN") : "Unknown time";
      const isChecked = selectedTrashIds.has(q.id);
      html += `<div style="border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:8px;background:${isChecked ? "#dbeafe" : "#fffbeb"};display:flex;gap:10px;align-items:flex-start;">
        <input type="checkbox" ${isChecked ? "checked" : ""} onchange="toggleTrashSelect('${q.id}', this.checked)" style="margin-top:4px;flex-shrink:0;cursor:pointer;" />
        <div style="flex:1;min-width:0;">
          <div style="font-size:.85rem;color:#374151;margin-bottom:6px;line-height:1.4;">${qText.substring(0, 120)}${qText.length > 120 ? "..." : ""}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
            <span style="font-size:.75rem;color:#9ca3af;">🕐 Deleted: ${deletedAt} · Subject: ${q.subject || "N/A"}</span>
            <div style="display:flex;gap:6px;">
              <button onclick="restoreQuestion('${q.id}')" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:.78rem;cursor:pointer;font-weight:600;">♻️ Restore</button>
              <button onclick="permanentlyDeleteQuestion('${q.id}')" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:.78rem;cursor:pointer;font-weight:600;">🗑️ Delete Forever</button>
            </div>
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  box.innerHTML = html;
}

function toggleTrashSelect(id, checked) {
  if (checked) selectedTrashIds.add(id); else selectedTrashIds.delete(id);
  renderTrashBin();
}

function toggleSelectAllTrash(checked) {
  const searchVal = (document.querySelector("#trash-search")?.value || "").toLowerCase();
  const visible = searchVal ? deletedQuestions.filter(q =>
    (q.questionEn || q.question_en || "").toLowerCase().includes(searchVal) ||
    (q.questionHi || q.question_hi || "").toLowerCase().includes(searchVal) ||
    (q.chapter || "Unknown").toLowerCase().includes(searchVal) ||
    (q.subject || "").toLowerCase().includes(searchVal)
  ) : deletedQuestions;
  if (checked) visible.forEach(q => selectedTrashIds.add(q.id));
  else visible.forEach(q => selectedTrashIds.delete(q.id));
  renderTrashBin();
}

// Ek deleted question document ko wapas questionBank mein daalne ke liye data taiyaar karta hai
function _prepRestoreData(rawData, fallbackId) {
  const data = { ...rawData };
  const origId = data._originalId || fallbackId;
  delete data._originalId; delete data._deletedAt; delete data._deletedFrom; delete data.id;
  return { origId, data };
}

async function restoreAllQuestions() {
  if (!deletedQuestions.length) { alert("Recycle Bin pehle se khali hai!"); return; }
  if (!confirm(`Sabhi ${deletedQuestions.length} questions Question Bank mein restore karein?`)) return;
  const db = getDB();
  if (!db) { alert("Firebase connected nahi."); return; }
  try {
    const items = deletedQuestions.slice();
    const CHUNK = 240; // har item ke 2 batch ops (set + delete) hote hain, 500 op limit ke andar
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = db.batch();
      items.slice(i, i + CHUNK).forEach(q => {
        const { origId, data } = _prepRestoreData(q, q.id);
        batch.set(db.collection("questionBank").doc(origId), data);
        batch.delete(db.collection("deletedQuestions").doc(q.id));
        batch.delete(db.collection("seedExclusions").doc(q.id));
      });
      await batch.commit();
    }
    selectedTrashIds.clear();
    alert("✅ Sabhi questions Question Bank mein restore ho gaye!");
  } catch(err) {
    alert("Restore All nahi hua. Error: " + (err.message || err));
  }
}

async function restoreSelectedQuestions() {
  if (!selectedTrashIds.size) { alert("Pehle kuch questions select karein!"); return; }
  if (!confirm(`${selectedTrashIds.size} selected questions Question Bank mein restore karein?`)) return;
  const db = getDB();
  if (!db) { alert("Firebase connected nahi."); return; }
  try {
    const qMap = new Map(deletedQuestions.map(q => [q.id, q]));
    const ids = [...selectedTrashIds].filter(id => qMap.has(id));
    const CHUNK = 240;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = db.batch();
      ids.slice(i, i + CHUNK).forEach(id => {
        const q = qMap.get(id);
        const { origId, data } = _prepRestoreData(q, id);
        batch.set(db.collection("questionBank").doc(origId), data);
        batch.delete(db.collection("deletedQuestions").doc(id));
        batch.delete(db.collection("seedExclusions").doc(id));
      });
      await batch.commit();
    }
    selectedTrashIds.clear();
    alert("✅ Selected questions Question Bank mein restore ho gaye!");
  } catch(err) {
    alert("Restore Selected nahi hua. Error: " + (err.message || err));
  }
}

async function restoreQuestion(id) {
  if (!confirm("Is question ko Question Bank mein restore karein?")) return;
  const db = getDB();
  if (!db) { alert("Firebase connected nahi."); return; }
  try {
    const doc = await db.collection("deletedQuestions").doc(id).get();
    if (!doc.exists) { alert("Question Recycle Bin mein nahi mila."); return; }
    const data = { ...doc.data() };
    const origId = data._originalId || id;
    delete data._originalId; delete data._deletedAt; delete data._deletedFrom; delete data.id;
    await db.collection("questionBank").doc(origId).set(data);
    await db.collection("deletedQuestions").doc(id).delete();
    await db.collection("seedExclusions").doc(id).delete();
    selectedTrashIds.delete(id);
    alert("✅ Question wapis Question Bank mein restore ho gaya!");
  } catch(err) {
    alert("Restore nahi hua. Error: " + (err.message || err));
  }
}

async function permanentlyDeleteQuestion(id) {
  if (!confirm("⚠️ PERMANENT DELETE!\n\nYe question hamesha ke liye delete ho jayega. Ye undo nahi ho sakta!\n\nPakka karein?")) return;
  const db = getDB();
  if (!db) { alert("Firebase connected nahi."); return; }
  try {
    await db.collection("deletedQuestions").doc(id).delete();
    alert("Question permanently delete ho gaya.");
  } catch(err) {
    alert("Delete nahi hua. Error: " + (err.message || err));
  }
}

async function emptyTrashBin() {
  if (!deletedQuestions.length) { alert("Recycle Bin pehle se khali hai!"); return; }
  if (!confirm("⚠️ SABHI " + deletedQuestions.length + " QUESTIONS PERMANENTLY DELETE HONGE!\n\nYe undo nahi ho sakta!\n\nPakka karein?")) return;
  const db = getDB();
  if (!db) { alert("Firebase connected nahi."); return; }
  try {
    const ids = deletedQuestions.map(q => q.id);
    const CHUNK = 490;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = db.batch();
      ids.slice(i, i + CHUNK).forEach(id => batch.delete(db.collection("deletedQuestions").doc(id)));
      await batch.commit();
    }
    alert("✅ Recycle Bin khali ho gaya. Saare questions permanently delete ho gaye.");
  } catch(err) {
    alert("Empty nahi hua. Error: " + (err.message || err));
  }
}

function syncRecords() {
  const db = getDB();
  if (!db) {
    // Firebase nahi hai — localStorage se load karo
    try {
      records = JSON.parse(localStorage.getItem("savya_records") || "[]");
    } catch(e) { records = []; }
    renderRecords();
    renderStudentResultPicker();
    return;
  }
  db.collection("studentRecords").orderBy("submittedIso","desc").limit(200).onSnapshot(snap => {
    const firebaseRecs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Merge localStorage records not yet in Firebase
    let localRecs = [];
    try { localRecs = JSON.parse(localStorage.getItem("savya_records") || "[]"); } catch(e) {}
    const fbNames = new Set(firebaseRecs.map(r => r.name + r.submittedIso));
    const onlyLocal = localRecs.filter(r => !fbNames.has(r.name + r.submittedIso));
    records = [...firebaseRecs, ...onlyLocal].sort((a,b) => (b.submittedIso||"").localeCompare(a.submittedIso||""));
    renderRecords();
    renderStudentResultPicker();
    if ($("#result-test-select")?.value) renderStudentResultSheet();
  }, () => {
    // Firebase error — fallback to localStorage
    try { records = JSON.parse(localStorage.getItem("savya_records") || "[]"); } catch(e) { records = []; }
    renderRecords();
    renderStudentResultPicker();
  });
}

const TEST_CHUNK_SIZE = 20;

// Scan an object/array for any "undefined" values and report their location.
// Returns an array of human-readable path strings, e.g. ["Question 47 (Q47).optionD"]
function findUndefinedFields(testData) {
  const problems = [];

  function scan(obj, path) {
    if (obj === null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => scan(item, `${path}[${i}]`));
      return;
    }
    for (const key in obj) {
      const value = obj[key];
      const currentPath = `${path}.${key}`;
      if (value === undefined) {
        problems.push(currentPath);
      } else if (typeof value === "object") {
        scan(value, currentPath);
      }
    }
  }

  const meta = { ...testData };
  const questions = meta.questions || [];
  delete meta.questions;

  scan(meta, "Test Info");

  questions.forEach((q, index) => {
    const label = `Question ${index + 1}${q && q.qNo ? " (Q" + q.qNo + ")" : ""}`;
    scan(q, label);
  });

  return problems;
}

// Removes any "undefined" values from an object so Firestore doesn't reject it
// (JSON round-trip drops undefined keys automatically, keeps null/""/0/false intact)
function sanitizeForFirestore(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function saveTestOnline(id, data) {
  const db = getDB(); if (!db) return;

  // --- Undefined-field check: tell the user exactly which question/field is bad ---
  const problems = findUndefinedFields(data);
  if (problems.length > 0) {
    alert(
      "⚠️ Ye fields 'undefined' hain, isliye save fail ho raha tha:\n\n" +
      problems.join("\n") +
      "\n\nIn fields ko edit karke value bharo (ya khali \"\" rakho), phir dobara save karo."
    );
    throw new Error("Save aborted: undefined fields found -> " + problems.join(", "));
  }

  data = sanitizeForFirestore(data);

  const questions = data.questions || [];
  const chunks = [];
  for (let i = 0; i < questions.length; i += TEST_CHUNK_SIZE) {
    chunks.push(questions.slice(i, i + TEST_CHUNK_SIZE));
  }

  // IMPORTANT: Save question chunks FIRST, then the main "tests" doc LAST.
  // Reason: the home screen listens to the "tests" collection via onSnapshot,
  // and as soon as the main doc (which carries chunkCount) is written, it
  // immediately tries to read the qchunks subcollection. If the main doc is
  // written before the chunks finish saving, the listener finds chunkCount > 0
  // but no chunk documents yet -> reads 0 questions ("0Q"), and since writing
  // a subcollection doc doesn't re-trigger the "tests" listener, it stays
  // stuck at 0 until some unrelated change happens to refresh it.
  const batch = db.batch();
  chunks.forEach((chunk, i) => {
    batch.set(db.collection("tests").doc(id).collection("qchunks").doc("c" + i), { questions: chunk });
  });
  await batch.commit();

  // Remove any leftover old chunks beyond the new chunk count (before updating
  // the main doc, so stale extra chunks never linger past the refresh point).
  try {
    const old = await db.collection("tests").doc(id).collection("qchunks").get();
    const delBatch = db.batch();
    let needsDelete = false;
    old.docs.forEach(d => {
      const idx = Number(d.id.replace("c", ""));
      if (idx >= chunks.length) { delBatch.delete(d.ref); needsDelete = true; }
    });
    if (needsDelete) await delBatch.commit();
  } catch(e) { console.warn("[saveTestOnline] old chunk cleanup failed", e); }

  // Save main doc WITHOUT the questions array (avoids 1MB doc limit on big tests).
  // Written LAST, after the chunks are confirmed saved.
  const meta = { ...data };
  delete meta.questions;
  meta.questionCount = questions.length;
  meta.chunkCount = chunks.length;
  await db.collection("tests").doc(id).set({ ...meta, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

async function loadTestQuestions(db, id, chunkCount) {
  if (!chunkCount) return [];
  const snaps = await Promise.all(
    Array.from({ length: chunkCount }, (_, i) => db.collection("tests").doc(id).collection("qchunks").doc("c" + i).get())
  );
  let questions = [];
  snaps.forEach(s => { if (s.exists) questions = questions.concat(s.data().questions || []); });
  return questions;
}

async function deleteTestOnline(id) {
  const db = getDB(); if (!db) return;
  try {
    const chunks = await db.collection("tests").doc(id).collection("qchunks").get();
    const batch = db.batch();
    chunks.docs.forEach(d => batch.delete(d.ref));
    if (!chunks.empty) await batch.commit();
  } catch(e) { console.warn("[deleteTestOnline] chunk cleanup failed", e); }
  await db.collection("tests").doc(id).delete();
}
async function saveDeletedTestOnline(id) {
  const db = getDB(); if (!db) return;
  await db.collection("deletedTests").doc(id).set({ deletedAt: firebase.firestore.FieldValue.serverTimestamp() });
}
async function restoreDeletedTestOnline(id) {
  const db = getDB(); if (!db) return;
  await db.collection("deletedTests").doc(id).delete().catch(() => {});
}
async function saveBankOnline(id, data) {
  // Auto-convert math equations before saving
  if (window.autoFormatMathFields && data) data = window.autoFormatMathFields(Object.assign({}, data)) || data;
  const db = getDB(); if (!db) return;
  await db.collection("questionBank").doc(id).set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
}
async function deleteBankOnline(id) {
  const db = getDB(); if (!db) return;
  await db.collection("questionBank").doc(id).delete();
}
async function saveRecordOnline(data) {
  const newRec = { ...data, _localId: "local_" + Date.now() };

  // 1. Save to localStorage
  try {
    const local = JSON.parse(localStorage.getItem("savya_records") || "[]");
    local.unshift(newRec);
    localStorage.setItem("savya_records", JSON.stringify(local.slice(0, 500)));
  } catch(e) {}

  // 2. Update in-memory records array immediately so admin can see without refresh
  records.unshift(newRec);
  renderRecords();
  renderStudentResultPicker();

  // 3. Also try Firebase
  const db = getDB(); if (!db) return;
  try {
    await db.collection("studentRecords").add({ ...data, savedAt: firebase.firestore.FieldValue.serverTimestamp() });
  } catch(e) { console.warn("Firebase save failed, record in localStorage", e); }
}

/* ══════════════════════════════════════════
   UTILITY
══════════════════════════════════════════ */
function escHtml(s) {
  if (typeof s !== "string") return String(s || "");
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Strips inline color/background styling (often left over from pasting content
// from Word/PDF/AI-import) so questions always use the app's own theme colors.
// Keeps other formatting like bold, italic, sub/sup, tables, line breaks intact.
function stripInlineColors(html) {
  if (typeof html !== "string" || !html) return html;
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.querySelectorAll("[style]").forEach(el => {
      el.style.removeProperty("color");
      el.style.removeProperty("background");
      el.style.removeProperty("background-color");
      el.style.removeProperty("opacity");
      if (!el.getAttribute("style")) el.removeAttribute("style");
    });
    tmp.querySelectorAll("font[color]").forEach(el => el.removeAttribute("color"));
    return tmp.innerHTML;
  } catch (e) {
    return html;
  }
}
function fmtNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/,"")) : "0";
}
function pad2(n) { return String(Math.max(0, Math.floor(n))).padStart(2, "0"); }
function getMarks(t) { const v = Number(t?.marksPerQuestion || 2); return (Number.isFinite(v) && v > 0) ? v : 2; }

// Returns marks for a specific question, considering section-wise marks override
function getQuestionMarks(test, q) {
  if (!q || !test) return getMarks(test);
  if (q.marks !== undefined && q.marks !== null && q.marks !== "" && Number(q.marks) > 0) {
    return Number(q.marks);
  }
  const secTitle = q.section || "";
  if (secTitle && test.sections && test.sections.length) {
    const sec = test.sections.find(s => s.title === secTitle);
    if (sec && sec.marksPerQuestion && Number(sec.marksPerQuestion) > 0) {
      return Number(sec.marksPerQuestion);
    }
  }
  return getMarks(test);
}

// Ek test ke "maximum marks" (achievable score) nikaalne ka SINGLE, saanjha
// tareeka — taaki result screen, leaderboard, aur admin test list — sab
// jagah SAME number dikhe. Pehle har jagah apna alag calculation tha:
//   - Result screen: attemptLimit set hone par sahi tareeke se
//     "attemptLimit × marks/question" use karta tha (jo sahi hai, kyunki
//     attempt limit se zyada attempt karne par extra answers count hi
//     nahi hote).
//   - Leaderboard: attemptLimit ko IGNORE karke hamesha
//     "total questions × marks/question" use karta tha — isse attempt-limit
//     wale tests ke liye leaderboard % aur "X/Y" wrong/inconsistent dikhta
//     tha result screen ke comparison mein.
//   - Admin test list: sirf "marks/question" (jaise "2 marks") dikhata
//     tha, jo total/maximum marks nahi hai — confusing label.
// Ab teeno jagah isi function ka result use karte hain.
function getTestMaxMarks(test) {
  if (!test) return 0;
  const attemptLimit = Number(test.attemptLimit) > 0 ? Number(test.attemptLimit) : null;
  if (attemptLimit) return attemptLimit * getMarks(test);
  if (Array.isArray(test.questions) && test.questions.length) {
    return test.questions.reduce((s, q) => s + getQuestionMarks(test, q), 0);
  }
  return 0;
}

// Admin-only bookkeeping total: MCQ (online, auto-graded) marks + the
// Subjective marks the admin manually notes per test (those questions
// live in a separate MS Word paper, never in this system). Never used
// for student-facing scoring/leaderboard — only for the admin Test List
// so Vishnu can see the full paper's total marks at a glance.
function getTestSubjectiveMarks(test) {
  const v = Number(test?.subjectiveMarks || 0);
  return (Number.isFinite(v) && v > 0) ? v : 0;
}
function getTestGrandTotalMarks(test) {
  return getTestMaxMarks(test) + getTestSubjectiveMarks(test);
}

// Returns all section titles in order they appear
function getTestSectionTitles(test) {
  const seen = [];
  (test.questions || []).forEach(q => {
    const s = q.section || "";
    if (s && !seen.includes(s)) seen.push(s);
  });
  return seen;
}
function getNeg(t)   { const v = Number(t?.negativeMarks || 0); return (t?.negativeEnabled && Number.isFinite(v) && v > 0) ? v : 0; }
function isValidQ(q) {
  const hasText = q?.text || q?.textEN || q?.textHI;
  if (q?.qType === "subjective") return Boolean(hasText);
  const opts    = q?.options || q?.optionsEN || q?.optionsHI;
  return Boolean(hasText && Array.isArray(opts) && opts.length >= 4 && opts.slice(0,4).every(Boolean) && Number.isFinite(Number(q.answer)));
}
function cloneQ(q) {
  return {
    id: q.id || q.firestoreId || null,
    text: q.text || q.textHI || q.textEN || "",
    textEN: q.textEN || q.text || "",
    textHI: q.textHI || q.text || "",
    options: [...(q.options || q.optionsHI || q.optionsEN || [])],
    optionsEN: [...(q.optionsEN || q.options || [])],
    optionsHI: [...(q.optionsHI || q.options || [])],
    answer: Number(q.answer || 0),
    explanation: q.explanation || q.explanationHI || q.explanationEN || "",
    explanationEN: q.explanationEN || q.explanation || "",
    explanationHI: q.explanationHI || q.explanation || "",
    subject: q.subject || "Mathematics",
    chapter: q.chapter || "",
    section: q.section || "",
    qType: q.qType === "subjective" ? "subjective" : "mcq",
    marks: (q.marks !== undefined && q.marks !== null && q.marks !== "") ? Number(q.marks) : null
  };
}
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function mkBtn(text, cls, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn-${cls}`;
  btn.style.padding = "6px 12px";
  btn.style.fontSize = ".82rem";
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

/* ══════════════════════════════════════════
   SAVE AS DRAFT
══════════════════════════════════════════ */
async function saveAsDraft() {
  const pending = readQForm(true);
  if (pending === false) return;
  if (pending) { draftQuestions.push(cloneQ(pending)); clearQForm(false); }
  if (!draftQuestions.length) { alert("Question add karo pehle."); return; }
  const title = $("#test-title").value.trim();
  const min   = Number($("#test-minutes").value || 30);
  const marks = Number($("#test-marks").value || 2);
  const negEn = $("#test-negative-enabled").value === "yes";
  const neg   = negEn ? Number($("#test-negative").value || 0) : 0;
  const attemptLimitRaw = Number($("#test-attempt-limit")?.value || 0);
  const attemptLimit = attemptLimitRaw > 0 ? attemptLimitRaw : null;
  const subjectiveMarksRaw = Number($("#test-subjective-marks")?.value || 0);
  const subjectiveMarks = subjectiveMarksRaw > 0 ? subjectiveMarksRaw : null;
  if (!title) { alert("Test title required hai."); return; }
  const id = editingTestId || `test-${Date.now()}`;
  const t  = {
    title, minutes: min || 30, marksPerQuestion: marks,
    negativeEnabled: negEn, negativeMarks: neg,
    attemptLimit,
    subjectiveMarks,
    isDraft: true,
    sections: testSections.map(s => ({ id: s.id, title: s.title, marksPerQuestion: s.marksPerQuestion ?? null })),
    questions: draftQuestions.map(cloneQ)
  };
  const statusEl = $("#draft-save-status");
  try {
    remoteTests[id] = t;
    deletedTestIds.delete(id);
    await saveTestOnline(id, t);
    editingTestId = null;
    draftQuestions = [];
    testSections = [{ id: "sec-1", title: "Section A", marksPerQuestion: null }];
    activeSectionId = "sec-1";
    $("#test-form").reset();
    toggleNegativeField();
    renderTestSections();
    renderDrafts();
    renderTests(id);
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.style.background = "#fef9c3";
      statusEl.style.color = "#b45309";
      statusEl.style.border = "1px solid #f59e0b";
      statusEl.textContent = "📝 Draft saved! 'All Tests' mein DRAFT badge ke saath dikh raha hai. Publish karne ke liye 🚀 Publish button dabao.";
      setTimeout(() => { if (statusEl) statusEl.style.display = "none"; }, 6000);
    }
  } catch(err) {
    console.warn(err);
    alert("Draft save nahi hua. Firestore rules check karo.");
  }
}

/* ══════════════════════════════════════════
   AUTO-SAVE DRAFT (Silent — no alert)
   Triggered when: tab switch, mode switch, page unload
══════════════════════════════════════════ */
let _autoSaveDraftId = null; // tracks the current auto-draft Firebase id

async function autoSaveDraftSilently() {
  // Need at least some questions OR a title to be worth saving
  const title = $("#test-title")?.value.trim();
  const hasQuestions = draftQuestions.length > 0;
  if (!hasQuestions && !title) return; // nothing to save

  const id = _autoSaveDraftId || editingTestId || `autodraft-${Date.now()}`;
  _autoSaveDraftId = id;

  const min   = Number($("#test-minutes")?.value || 30);
  const marks = Number($("#test-marks")?.value || 2);
  const negEn = $("#test-negative-enabled")?.value === "yes";
  const neg   = negEn ? Number($("#test-negative")?.value || 0) : 0;
  const attemptLimitRaw = Number($("#test-attempt-limit")?.value || 0);
  const attemptLimit = attemptLimitRaw > 0 ? attemptLimitRaw : null;
  const subjectiveMarksRaw = Number($("#test-subjective-marks")?.value || 0);
  const subjectiveMarks = subjectiveMarksRaw > 0 ? subjectiveMarksRaw : null;

  const t = {
    title: title || `Auto-Draft ${new Date().toLocaleTimeString("en-IN")}`,
    minutes: min || 30,
    marksPerQuestion: marks,
    negativeEnabled: negEn,
    negativeMarks: neg,
    attemptLimit,
    subjectiveMarks,
    isDraft: true,
    autoSaved: true,
    autoSavedAt: new Date().toISOString(),
    sections: testSections.map(s => ({ id: s.id, title: s.title, marksPerQuestion: s.marksPerQuestion ?? null })),
    questions: draftQuestions.map(cloneQ)
  };

  try {
    remoteTests[id] = t;
    deletedTestIds.delete(id);
    await saveTestOnline(id, t);
    // Show a small toast — no blocking alert
    showAutoSaveToast(`📝 Auto-saved draft: "${t.title}" (${draftQuestions.length} questions)`);
    renderTests();
  } catch(err) {
    console.warn("[AutoSave] Failed:", err);
  }
}

function showAutoSaveToast(msg) {
  let toast = $("#autosave-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "autosave-toast";
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:9999;
      background:#1e293b;color:#f1f5f9;
      padding:12px 18px;border-radius:10px;
      font-size:.84rem;font-weight:600;
      box-shadow:0 4px 20px rgba(0,0,0,.3);
      display:flex;align-items:center;gap:10px;
      opacity:0;transition:opacity .3s;
      max-width:360px;line-height:1.4;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.opacity = "0"; }, 4000);
}

// Auto-save on page unload / refresh / close
// ── beforeunload: synchronous localStorage save ──
window.addEventListener("beforeunload", () => {
  const title = $("#test-title")?.value.trim();
  const hasContent = draftQuestions.length > 0 || title;
  if (!hasContent) return;

  const payload = {
    id: _autoSaveDraftId || editingTestId || ("autodraft-" + Date.now()),
    title: title || ("Auto-Draft " + new Date().toLocaleTimeString("en-IN")),
    minutes: Number($("#test-minutes")?.value || 30),
    marksPerQuestion: Number($("#test-marks")?.value || 2),
    negativeEnabled: $("#test-negative-enabled")?.value === "yes",
    negativeMarks: Number($("#test-negative")?.value || 0),
    attemptLimit: (Number($("#test-attempt-limit")?.value || 0) > 0) ? Number($("#test-attempt-limit").value) : null,
    subjectiveMarks: (Number($("#test-subjective-marks")?.value || 0) > 0) ? Number($("#test-subjective-marks").value) : null,
    isDraft: true,
    autoSaved: true,
    autoSavedAt: new Date().toISOString(),
    sections: testSections.map(s => ({ id: s.id, title: s.title, marksPerQuestion: s.marksPerQuestion ?? null })),
    questions: draftQuestions.map(cloneQ)
  };

  try {
    // Synchronous — always works even when page is closing
    localStorage.setItem("savyasachi_emergency_draft", JSON.stringify(payload));
    _autoSaveDraftId = payload.id;
  } catch(e) { console.warn("[beforeunload] localStorage save failed", e); }
});

// ── Recovery called from init() after Firebase is ready ──
let _recoveryRetryCount = 0;
const MAX_RECOVERY_RETRIES = 5;

function recoverEmergencyDraft() {
  try {
    const raw = localStorage.getItem("savyasachi_emergency_draft");
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || !saved.id) return;
    if (!saved.questions?.length && !saved.title) return;

    const db = getDB();
    if (!db) {
      _recoveryRetryCount++;
      if (_recoveryRetryCount > MAX_RECOVERY_RETRIES) {
        console.warn("[Recovery] Max retries reached. Skipping emergency draft recovery.");
        return;
      }
      // Firebase not ready yet — retry after 1s with exponential backoff
      setTimeout(recoverEmergencyDraft, 1000 * _recoveryRetryCount);
      return;
    }

    saveTestOnline(saved.id, { ...saved, isDraft: true, recoveredAt: firebase.firestore.FieldValue.serverTimestamp() }).then(() => {
      localStorage.removeItem("savyasachi_emergency_draft");
      _recoveryRetryCount = 0;
      showAutoSaveToast(
        "♻️ Recovered: \"" + saved.title + "\" (" +
        (saved.questions?.length || 0) +
        " questions) — All Tests mein DRAFT badge ke saath dekho"
      );
      renderTests();
    }).catch(e => {
      _recoveryRetryCount++;
      if (_recoveryRetryCount > MAX_RECOVERY_RETRIES) {
        console.warn("[Recovery] Max retries reached. Emergency draft saved in localStorage only.");
        return;
      }
      console.warn("[Recovery] Firebase save failed, will retry:", e);
      setTimeout(recoverEmergencyDraft, 2000 * _recoveryRetryCount);
    });

  } catch(e) {
    console.warn("[Recovery] Parse failed:", e);
    localStorage.removeItem("savyasachi_emergency_draft");
  }
}


/* ══════════════════════════════════════════
   LEADERBOARD
══════════════════════════════════════════ */
function initLeaderboard() {
  const sel = $("#leaderboard-test-select");
  if (!sel) return;
  sel.innerHTML = '<option value="">— Test chunein —</option>';
  Object.entries(tests).forEach(([id, t]) => {
    if (t.isDraft) return;
    const op = document.createElement("option");
    op.value = id; op.textContent = t.title;
    sel.appendChild(op);
  });
  sel.onchange = renderLeaderboard;
}

function renderLeaderboard() {
  const sel = $("#leaderboard-test-select");
  const list = $("#leaderboard-list");
  if (!sel || !list) return;
  const testId = sel.value;
  if (!testId) { list.innerHTML = '<p class="empty-state">Test chunein leaderboard dekhne ke liye.</p>'; return; }
  const testRecs = records.filter(r => r.testId === testId);
  if (!testRecs.length) { list.innerHTML = '<p class="empty-state">Is test ka koi result nahi mila abhi tak.</p>'; return; }
  const seen = {};
  const best = testRecs.reduce((acc, r) => {
    const name = (r.name || "").trim().toLowerCase();
    if (!seen[name] || r.score > seen[name].score) { seen[name] = r; }
    return seen;
  }, {});
  const sorted = Object.values(seen).sort((a,b) => b.score - a.score).slice(0, 20);
  const t = tests[testId];
  const maxScore = t ? getTestGrandTotalMarks(t) : null;
  let html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.88rem;">';
  html += '<thead><tr style="background:linear-gradient(135deg,#1e1b4b,#3730a3);color:#fff;">';
  html += '<th style="padding:10px 12px;text-align:left;">#</th><th style="padding:10px 12px;text-align:left;">Student</th>';
  html += '<th style="padding:10px 12px;text-align:right;">Score</th><th style="padding:10px 12px;text-align:right;">%</th>';
  html += '<th style="padding:10px 12px;text-align:right;">Date</th></tr></thead><tbody>';
  sorted.forEach((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
    const pct = maxScore ? Math.round((r.score/maxScore)*100) : Math.round(r.percentage || 0);
    const rowBg = i % 2 === 0 ? "#f8fafc" : "#fff";
    html += `<tr style="background:${rowBg};border-bottom:1px solid #e5e7eb;">`;
    html += `<td style="padding:10px 12px;font-weight:700;font-size:1.1rem;">${medal}</td>`;
    html += `<td style="padding:10px 12px;font-weight:600;">${escHtml(r.name || "Anonymous")}</td>`;
    html += `<td style="padding:10px 12px;text-align:right;font-weight:700;color:#2563eb;">${fmtNum(r.score)}${maxScore?"/"+fmtNum(maxScore):""}</td>`;
    html += `<td style="padding:10px 12px;text-align:right;color:${pct>=70?"#16a34a":pct>=40?"#d97706":"#dc2626"};font-weight:600;">${pct}%</td>`;
    html += `<td style="padding:10px 12px;text-align:right;color:#6b7280;font-size:.78rem;">${r.submittedAt||""}</td>`;
    html += "</tr>";
  });
  html += '</tbody></table></div>';
  list.innerHTML = html;
}

/* Dark mode removed */
