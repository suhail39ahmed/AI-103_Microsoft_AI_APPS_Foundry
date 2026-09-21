const state = {
  catalog: null,
  examMeta: null,
  exam: null,
  examPath: "",
  queue: [],
  index: 0,
  answers: {},
  flags: {},
  timerId: null,
  remaining: 0,
  phase: "dashboard",
  reviewMode: false,
  showCase: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const app = () => document.getElementById("app");

const kindLabel = {
  single: "Single choice",
  multi: "Multiple choice",
  matching: "Matching",
  sequence: "Put steps in order",
  yesno: "Yes / No",
};

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function qid(q) {
  return q.id;
}

function sameSet(a, b) {
  const A = [...(a || [])].map(String).sort();
  const B = [...(b || [])].map(String).sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
}

function scoreQuestion(q) {
  const ans = state.answers[qid(q)];
  if (q.type === "single" || q.type === "multi") {
    return sameSet(ans, q.answer) ? q.points || 1 : 0;
  }
  if (q.type === "yesno") {
    let pts = 0;
    for (const item of q.items) {
      if (ans && ans[item.id] === item.answer) pts += 1;
    }
    return pts;
  }
  if (q.type === "matching" || q.type === "sequence") {
    let pts = 0;
    for (const slot of q.slots) {
      if (ans && ans[slot.id] === slot.answer) pts += 1;
    }
    return pts;
  }
  return 0;
}

function maxPoints(qs) {
  return qs.reduce((s, q) => s + (q.points || 1), 0);
}

function fmtTime(sec) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function examSets(questions, meta) {
  const setSize = meta.setSize || 30;
  const seniorFrom = meta.seniorFromId;
  const caseFrom = meta.caseStudyFromId;
  const sets = [];

  const numbered = [...questions].sort((a, b) => a.id - b.id);
  const regular = seniorFrom ? numbered.filter((q) => q.id < seniorFrom) : numbered;
  for (let i = 0; i < regular.length; i += setSize) {
    const items = regular.slice(i, i + setSize);
    sets.push({
      label: `Q${items[0].id}–${items[items.length - 1].id}`,
      hint: `${items.length} questions`,
      items,
      kind: "set",
    });
  }

  if (seniorFrom && caseFrom) {
    const senior = numbered.filter((q) => q.id >= seniorFrom && q.id < caseFrom);
    const casestudy = numbered.filter((q) => q.id >= caseFrom);
    if (senior.length) {
      sets.push({
        label: `Senior skills Q${senior[0].id}–${senior[senior.length - 1].id}`,
        hint: `${senior.length} questions · cleaned Yes/No and sequences`,
        items: senior,
        kind: "senior",
      });
    }
    if (casestudy.length) {
      sets.push({
        label: `Contoso case study Q${casestudy[0].id}–${casestudy[casestudy.length - 1].id}`,
        hint: `${casestudy.length} questions · scenario on every item`,
        items: casestudy,
        kind: "case",
      });
    }
  } else if (seniorFrom) {
    const senior = numbered.filter((q) => q.id >= seniorFrom);
    if (senior.length) {
      sets.push({
        label: `Senior set Q${senior[0].id}–${senior[senior.length - 1].id}`,
        hint: `${senior.length} questions`,
        items: senior,
        kind: "senior",
      });
    }
  }
  return sets;
}

function startExam(mode, range = null) {
  const all = state.exam.questions;
  if (mode === "practice") {
    const n = Math.min(20, all.length);
    state.queue = shuffle(all).slice(0, n);
    state.remaining = n * 90;
  } else if (mode === "range" && range) {
    state.queue = [...range.items];
    state.remaining = Math.max(30, range.items.length * 90);
  } else {
    state.queue = [...all];
    state.remaining = Math.min(180 * 60, all.length * 60);
  }
  state.index = 0;
  state.answers = {};
  state.flags = {};
  state.phase = "exam";
  state.reviewMode = false;
  state.showCase = false;
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.remaining -= 1;
    const el = document.getElementById("clock");
    if (el) el.textContent = fmtTime(state.remaining);
    if (state.remaining <= 0) submitExam(true);
  }, 1000);
  render();
}

function currentQ() {
  return state.queue[state.index];
}

function saveChoice(q, value, checked) {
  const id = qid(q);
  if (q.type === "single") state.answers[id] = [value];
  else if (q.type === "multi") {
    const cur = new Set(state.answers[id] || []);
    if (checked) cur.add(value);
    else cur.delete(value);
    state.answers[id] = [...cur];
  }
}

function saveSlot(q, slotId, value) {
  const id = qid(q);
  state.answers[id] = { ...(state.answers[id] || {}), [slotId]: value };
}

function isAnswered(q) {
  const ans = state.answers[qid(q)];
  if (!ans) return false;
  if (Array.isArray(ans)) return ans.length > 0;
  return Object.values(ans).some(Boolean);
}

function submitExam(auto = false) {
  const unanswered = state.queue.filter((q) => !isAnswered(q)).length;
  if (!auto && unanswered && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return;
  if (state.timerId) clearInterval(state.timerId);
  state.phase = "results";
  render();
}

function renderCatalog() {
  const exams = state.catalog.exams || [];
  app().innerHTML = `
    <div class="app">
      <section class="hero">
        <div class="kicker">Practice exams</div>
        <h1>${esc(state.catalog.product || "Cert Exam Prep")}</h1>
        <p class="lede">Pick a bank, take a timed set, and get instant correct / incorrect feedback. Add more exams by dropping JSON into <code>data/exams</code>.</p>
        <div class="exam-grid">
          ${exams
            .map(
              (e) => `<button class="exam-card" data-exam="${esc(e.id)}">
                <div class="kicker">${esc(e.id)}</div>
                <h2>${esc(e.title)}</h2>
                <p>${esc(e.subtitle || "")}</p>
              </button>`
            )
            .join("")}
        </div>
      </section>
    </div>`;
  app().querySelectorAll("[data-exam]").forEach((btn) => {
    btn.onclick = () => openExam(btn.dataset.exam);
  });
}

function renderHome() {
  const n = state.exam.questions.length;
  const meta = state.examMeta;
  const sets = examSets(state.exam.questions, meta);
  const drill = Math.min(20, n);
  app().innerHTML = `
    <div class="app">
      <section class="hero">
        <button class="btn ghost" id="backCat">Back to lessons</button>
        <div class="kicker">${esc(meta.shortTitle || meta.id || "Exam")}</div>
        <h1>${esc(meta.title || state.exam.title)}</h1>
        <p class="lede">These are practice questions. You need to answer them. The mark appears as soon as you click. Wrong answers are the useful ones: read the note, then come back to that item tomorrow.</p>
        <div class="stats">
          <div class="stat"><b>${n}</b><span>Questions</span></div>
          <div class="stat"><b>${meta.passPercent || 70}%</b><span>Pass mark</span></div>
          <div class="stat"><b>${meta.setSize || 30}</b><span>Standard set size</span></div>
        </div>
        <div class="row">
          <button class="btn" id="full">Full exam (${n})</button>
          <button class="btn ghost" id="practice">Random drill (${drill})</button>
        </div>
        <h3 class="sets-title">Attend by set</h3>
        <div class="row" id="ranges">
          ${sets
            .map(
              (r, i) =>
                `<button class="btn ${r.kind === "case" ? "" : "ghost"} ${r.kind === "senior" ? "senior" : ""}" data-range="${i}">${esc(r.label)} <span class="count">(${esc(r.hint)})</span></button>`
            )
            .join("")}
        </div>
      </section>
    </div>`;
  $("#backCat").onclick = () => go("dashboard");
  $("#full").onclick = () => startExam("full");
  $("#practice").onclick = () => startExam("practice");
  app().querySelectorAll("[data-range]").forEach((btn) => {
    btn.onclick = () => startExam("range", sets[Number(btn.dataset.range)]);
  });
}

function showFeedback(q) {
  return state.reviewMode || isAnswered(q);
}

function verdict(q) {
  if (!isAnswered(q)) return null;
  const pts = scoreQuestion(q);
  const max = q.points || 1;
  if (pts === max) return "correct";
  if (pts > 0) return "partial";
  return "wrong";
}

function verdictBanner(q) {
  if (!showFeedback(q)) return "";
  const v = verdict(q);
  if (v === "correct") return `<div class="verdict ok">Correct</div>`;
  if (v === "partial") return `<div class="verdict mid">Partly correct</div>`;
  return `<div class="verdict no">Incorrect</div>`;
}

function optionClass(q, optId) {
  const selected = (state.answers[qid(q)] || []).map(String).includes(String(optId));
  if (!showFeedback(q)) return selected ? "opt selected" : "opt";
  const correct = (q.answer || []).map(String).includes(String(optId));
  if (correct) return "opt correct";
  if (selected && !correct) return "opt wrong";
  return "opt";
}

function renderOptions(q) {
  const multi = q.type === "multi";
  const name = `q-${q.id}`;
  return `<div class="options">${q.options
    .map((o) => {
      const id = String(o.id);
      const selected = (state.answers[qid(q)] || []).map(String).includes(id);
      const mark = showFeedback(q)
        ? (q.answer || []).map(String).includes(id)
          ? ` <em class="tag ok">Correct</em>`
          : selected
            ? ` <em class="tag no">Wrong</em>`
            : ""
        : "";
      return `<label class="${optionClass(q, id)}">
        <input type="${multi ? "checkbox" : "radio"}" name="${name}" value="${esc(id)}" ${selected ? "checked" : ""} ${state.reviewMode ? "disabled" : ""} />
        <span><b>${esc(id.length === 1 ? id + "." : "")}</b> ${esc(o.text)}${mark}</span>
      </label>`;
    })
    .join("")}</div>`;
}

function renderSlots(q) {
  const ans = state.answers[qid(q)] || {};
  const choices = q.choices || [];
  return q.slots
    .map((slot) => {
      const picked = ans[slot.id] || "";
      const revealed = Boolean(picked);
      const ok = revealed && picked === slot.answer;
      const bad = revealed && picked !== slot.answer;
      return `<div class="slot">
        <label>${esc(slot.label)}${revealed ? (ok ? ` <em class="tag ok">Correct</em>` : ` <em class="tag no">Wrong</em> — correct: <b>${esc(slot.answer)}</b>`) : ""}</label>
        <select data-slot="${esc(slot.id)}" ${state.reviewMode ? "disabled" : ""} style="${ok ? "border-color:#22c55e" : bad ? "border-color:#f43f5e" : ""}">
          <option value="">Select an answer…</option>
          ${choices.map((c) => `<option value="${esc(c)}" ${c === picked ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
      </div>`;
    })
    .join("");
}

function renderYesNo(q) {
  const ans = state.answers[qid(q)] || {};
  return q.items
    .map((item) => {
      const picked = ans[item.id] || "";
      const revealed = Boolean(picked);
      const ok = revealed && picked === item.answer;
      return `<div class="slot">
        <label>${esc(item.text)}${revealed ? (ok ? ` <em class="tag ok">Correct</em>` : ` <em class="tag no">Wrong</em> — correct: <b>${esc(item.answer)}</b>`) : ""}</label>
        <select data-yn="${esc(item.id)}" ${state.reviewMode ? "disabled" : ""} style="${ok ? "border-color:#22c55e" : revealed ? "border-color:#f43f5e" : ""}">
          <option value="">Select…</option>
          <option value="Yes" ${picked === "Yes" ? "selected" : ""}>Yes</option>
          <option value="No" ${picked === "No" ? "selected" : ""}>No</option>
        </select>
      </div>`;
    })
    .join("");
}

function imageSrc(rel) {
  if (!rel) return "";
  if (rel.startsWith("http") || rel.startsWith("data/")) return rel;
  return `${state.examPath}/${rel}`.replaceAll("//", "/");
}

function renderImages(q) {
  const src = imageSrc((q.images || [])[0]);
  if (!src) return "";
  return `<img class="qimg" src="${esc(src)}" alt="Question diagram" />`;
}

function renderCaseStudy(q) {
  const meta = state.examMeta || {};
  const needed = q.showCaseStudy || (meta.caseStudyFromId && q.id >= meta.caseStudyFromId);
  if (!needed || !meta.caseStudy) return "";
  const open = state.showCase ? "open" : "";
  return `<details class="scenario" ${open}>
    <summary>${esc(meta.caseStudyTitle || "Case study")}</summary>
    <div class="scenario-body">${esc(meta.caseStudy).replaceAll("\n", "<br/>")}</div>
  </details>`;
}

function renderExam() {
  const q = currentQ();
  const total = state.queue.length;
  const done = state.queue.filter(isAnswered).length;
  const pct = Math.round(((state.index + 1) / total) * 100);
  const short = (state.examMeta && state.examMeta.shortTitle) || "Exam";

  app().innerHTML = `
    <div class="app">
      <div class="topbar">
        <div>
          <div class="kicker">${esc(short)}${q.section ? " · " + esc(q.section) : ""}</div>
          <div class="meta">Question ${state.index + 1} of ${total} · Bank #${q.id} · Answered ${done} · Flagged ${Object.keys(state.flags).length}</div>
        </div>
        <div class="meta">Time left <b id="clock">${fmtTime(state.remaining)}</b></div>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="layout">
        <section class="qcard">
          ${renderCaseStudy(q)}
          <div class="kind">${kindLabel[q.type] || q.type}</div>
          <div class="stem">${esc(q.stem)}</div>
          ${renderImages(q)}
          ${q.options ? renderOptions(q) : ""}
          ${q.slots ? renderSlots(q) : ""}
          ${q.items ? renderYesNo(q) : ""}
          ${verdictBanner(q)}
          ${showFeedback(q) && q.explanation ? `<div class="expl">${esc(q.explanation)}</div>` : ""}
          <div class="row">
            <button class="btn ghost" id="prev" ${state.index === 0 ? "disabled" : ""}>Previous</button>
            <button class="btn ghost" id="next" ${state.index === total - 1 ? "disabled" : ""}>Next</button>
            <button class="btn ghost" id="flag">${state.flags[qid(q)] ? "Unflag" : "Flag for review"}</button>
            ${state.reviewMode ? `<button class="btn" id="backResults">Back to score</button>` : `<button class="btn warn" id="submit">Submit exam</button>`}
          </div>
        </section>
        <aside class="side">
          <h3>Navigator</h3>
          <div class="navgrid" id="nav"></div>
        </aside>
      </div>
    </div>`;

  const box = $("details.scenario");
  if (box) {
    box.addEventListener("toggle", () => {
      state.showCase = box.open;
    });
  }

  const nav = $("#nav");
  state.queue.forEach((item, i) => {
    const b = document.createElement("button");
    b.className = "navbtn";
    if (i === state.index) b.classList.add("current");
    if (state.flags[qid(item)]) b.classList.add("flagged");
    else if (isAnswered(item)) b.classList.add("answered");
    if (isAnswered(item)) {
      const earned = scoreQuestion(item);
      b.classList.add(earned === item.points ? "ok" : "no");
    }
    b.textContent = i + 1;
    b.onclick = () => {
      state.index = i;
      render();
    };
    nav.appendChild(b);
  });

  $("#prev").onclick = () => {
    state.index = Math.max(0, state.index - 1);
    render();
  };
  $("#next").onclick = () => {
    state.index = Math.min(total - 1, state.index + 1);
    render();
  };
  $("#flag").onclick = () => {
    const id = qid(q);
    if (state.flags[id]) delete state.flags[id];
    else state.flags[id] = true;
    render();
  };
  if ($("#submit")) $("#submit").onclick = () => submitExam(false);
  if ($("#backResults"))
    $("#backResults").onclick = () => {
      state.phase = "results";
      render();
    };

  app().querySelectorAll(".opt input").forEach((input) => {
    input.onchange = () => {
      saveChoice(q, input.value, input.checked);
      render();
    };
  });
  app().querySelectorAll("select[data-slot]").forEach((sel) => {
    sel.onchange = () => {
      saveSlot(q, sel.dataset.slot, sel.value);
      render();
    };
  });
  app().querySelectorAll("select[data-yn]").forEach((sel) => {
    sel.onchange = () => {
      saveSlot(q, sel.dataset.yn, sel.value);
      render();
    };
  });
}

function renderResults() {
  const qs = state.queue;
  let earned = 0;
  const rows = qs.map((q, i) => {
    const pts = scoreQuestion(q);
    earned += pts;
    return { q, i, pts, max: q.points || 1 };
  });
  const max = maxPoints(qs);
  const pct = max ? Math.round((earned / max) * 100) : 0;
  const passAt = (state.examMeta && state.examMeta.passPercent) || 70;
  const passed = pct >= passAt;

  app().innerHTML = `
    <div class="app">
      <section class="hero">
        <div class="kicker">Exam complete</div>
        <h1 class="${passed ? "pass" : "fail"}">${pct}%</h1>
        <p class="lede">You scored <b>${earned}</b> out of <b>${max}</b> points (${rows.filter((r) => r.pts === r.max).length} fully correct of ${qs.length}). ${passed ? `That meets the ${passAt}% pass mark.` : `Below the ${passAt}% pass mark — review the misses and try again.`}</p>
        <div class="row">
          <button class="btn" id="reviewMiss">Review incorrect</button>
          <button class="btn ghost" id="reviewAll">Review all</button>
          <button class="btn ghost" id="home">Back to this exam</button>
        </div>
        <div class="list">
          ${rows
            .map(
              (r) => `<div class="item">
              <div>Q${r.i + 1} · Bank #${r.q.id} · ${esc(kindLabel[r.q.type] || r.q.type)} · ${r.pts}/${r.max}</div>
              <button data-i="${r.i}">Open</button>
            </div>`
            )
            .join("")}
        </div>
      </section>
    </div>`;

  $("#home").onclick = () => {
    state.phase = "home";
    render();
  };
  $("#reviewAll").onclick = () => {
    state.reviewMode = true;
    state.phase = "exam";
    state.index = 0;
    render();
  };
  $("#reviewMiss").onclick = () => {
    const first = rows.findIndex((r) => r.pts < r.max);
    state.reviewMode = true;
    state.phase = "exam";
    state.index = first >= 0 ? first : 0;
    render();
  };
  app().querySelectorAll(".item button").forEach((b) => {
    b.onclick = () => {
      state.reviewMode = true;
      state.phase = "exam";
      state.index = Number(b.dataset.i);
      render();
    };
  });
}

function paintNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const items = [
    ["dashboard", "Dashboard"],
    ["guides", "Guides"],
    ["roadmap", "Roadmap"],
    ["practice", "Practice"]
  ];
  const active = state.phase === "home" || state.phase === "exam" || state.phase === "results" || state.phase === "catalog" ? "practice" : state.phase === "guide" ? "guides" : state.phase;
  nav.innerHTML = `<span class="brand">AI-103 Foundry</span>` + items.map(([id, label]) =>
    `<button type="button" data-nav="${id}" class="${active === id ? "on" : ""}">${label}</button>`
  ).join("");
  nav.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.onclick = () => go(btn.dataset.nav);
  });
}

function go(dest) {
  if (state.timerId && dest !== "practice") {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (dest === "practice") {
    openExam("ai-103-extra");
    return;
  }
  if (dest === "guides") {
    state.phase = "guides";
    state.guideId = null;
  } else {
    state.phase = dest;
  }
  render();
}

function renderDashboard() {
  const cards = window.LEARN.dashboard.map((c) => `
    <button class="docard" data-guide="${esc(c.id)}">
      <div class="week">${esc(c.week)} · ${esc(c.mins)}</div>
      <h2>${esc(c.title)}</h2>
      <p>${esc(c.blurb)}</p>
    </button>`).join("");
  const title = state.phase === "guides" ? "Guides" : "Learn the portal, then sit the practice";
  const lede = state.phase === "guides"
    ? "Open a card and do that job in Foundry before you move on. The practice tab is waiting, but it will not teach you the clicks."
    : "These cards are the lessons. Do them in order. The practice tab is a set of questions you are meant to finish, not a score to admire. When you miss one, go back to the lesson that covers that job.";
  app().innerHTML = `
    <div class="app">
      <div class="kicker">Study desk</div>
      <h1>${title}</h1>
      <p class="lede">${lede}</p>
      <div class="banner">Use the site here: <a href="https://suhail39ahmed.github.io/AI-103_Microsoft_AI_APPS_Foundry/">suhail39ahmed.github.io/AI-103_Microsoft_AI_APPS_Foundry</a>. If that page is down, run it on your own machine with <code>python -m http.server 8787</code> in this folder and open <code>http://localhost:8787</code>. The diagrams in each lesson are maps of the clicks, not screenshots. Foundry menus move. Official reference: <a href="https://learn.microsoft.com/azure/ai-foundry/">Microsoft Foundry documentation</a>.</div>
      <div class="cardgrid">${cards}</div>
      <div class="row">
        <button class="btn" id="toRoad">Open the four-week plan</button>
        <button class="btn ghost" id="toPrac">Go to practice questions</button>
      </div>
    </div>`;
  app().querySelectorAll("[data-guide]").forEach((btn) => {
    btn.onclick = () => openGuide(btn.dataset.guide);
  });
  $("#toRoad").onclick = () => go("roadmap");
  $("#toPrac").onclick = () => go("practice");
}

function openGuide(id) {
  state.phase = "guide";
  state.guideId = id;
  render();
}

function renderGuides() {
  renderDashboard();
  const h = app().querySelector("h1");
  if (h) h.textContent = "Guides";
}

function renderGuide() {
  const g = window.LEARN.guides[state.guideId];
  if (!g) {
    state.phase = "guides";
    renderDashboard();
    return;
  }
  const map = window.LEARN.maps[g.map] || "";
  app().innerHTML = `
    <div class="app guide">
      <button class="btn ghost" id="backGuides">All lessons</button>
      <div class="kicker">How to do this in Microsoft Foundry</div>
      <h1>${esc(g.title)}</h1>
      <p class="lede">${esc(g.why)}</p>
      ${map}
      <h2>What you should be able to point at</h2>
      <ul class="steps">${g.lookFor.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <h2>Do it in this order</h2>
      <ol class="steps">${g.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <div class="callout"><b>The mistake I see most.</b> ${esc(g.mistake)}</div>
      <h2>Before you leave the portal</h2>
      <ul class="steps">${g.check.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <p class="lede">Microsoft's own write-up, for when a label has moved: <a href="${esc(g.official)}">${esc(g.official)}</a></p>
    </div>`;
  $("#backGuides").onclick = () => go("guides");
}

function renderRoadmap() {
  const blocks = window.LEARN.roadmap.map((w) => `
    <section class="weekblock">
      <div class="week">${esc(w.week)}</div>
      <h2>${esc(w.title)}</h2>
      <ol class="steps">${w.do.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <p class="lede"><b>You are done with this week when:</b> ${esc(w.done)}</p>
    </section>`).join("");
  app().innerHTML = `
    <div class="app">
      <div class="kicker">Four weeks</div>
      <h1>How to learn this, without collecting tabs</h1>
      <p class="lede">One project. One deployment. One agent. Do not start a second hub because the first one feels messy. Messy and finished beats a clean diagram you never clicked.</p>
      ${blocks}
    </div>`;
}

function render() {
  paintNav();
  if (state.phase === "dashboard" || state.phase === "guides") renderDashboard();
  else if (state.phase === "guide") renderGuide();
  else if (state.phase === "roadmap") renderRoadmap();
  else if (state.phase === "catalog") renderCatalog();
  else if (state.phase === "home") renderHome();
  else if (state.phase === "exam") renderExam();
  else renderResults();
}

async function openExam(id) {
  const entry = (state.catalog.exams || []).find((e) => e.id === id);
  if (!entry) return;
  state.examPath = entry.path;
  const [metaRes, qRes] = await Promise.all([
    fetch(`${entry.path}/exam.json`),
    fetch(`${entry.path}/questions.json`),
  ]);
  if (!qRes.ok) {
    app().innerHTML = `<div class="app"><p>Could not load ${esc(entry.path)}/questions.json</p></div>`;
    return;
  }
  state.examMeta = metaRes.ok ? await metaRes.json() : { title: entry.title, passPercent: 70, setSize: entry.setSize || 30 };
  state.exam = await qRes.json();
  state.phase = "home";
  render();
}

async function boot() {
  app().innerHTML = `<div class="app"><p class="lede">Loading…</p></div>`;
  const res = await fetch("data/catalog.json");
  if (!res.ok) {
    app().innerHTML = `<div class="app"><p>Could not load data/catalog.json. Serve this folder with a local web server.</p></div>`;
    return;
  }
  state.catalog = await res.json();
  state.phase = "dashboard";
  render();
}

boot();
