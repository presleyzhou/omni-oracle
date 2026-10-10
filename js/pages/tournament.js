document.querySelector("#lb tbody").innerHTML = OO.leaderboard.map(r => `
  <tr>
    <td class="num-cell">${r.rank}</td>
    <td><strong>${r.user}</strong></td>
    <td class="num-cell">${r.forecasts}</td>
    <td class="num-cell pos">${r.brier.toFixed(3)}</td>
    <td class="num-cell">${(100 * r.cal).toFixed(0)}%</td>
    <td><span class="tag ${r.streak === "Superforecaster" ? "green" : r.streak === "Top 1%" ? "purple" : ""}">${r.streak}</span></td>
  </tr>
`).join("");

/* shared state for the AI bench, my forecasts and the real calibration overlay —
   declared up front because buildCharts() runs before those sections */
let LEDGER = null;
const AIF_KEY = "oo-ai-forecasts";
let AIF = [];
try { AIF = JSON.parse(localStorage.getItem(AIF_KEY)) || []; } catch (e) { AIF = []; }
const saveAif = () => localStorage.setItem(AIF_KEY, JSON.stringify(AIF.slice(-400)));
const brier = (p, y) => (p - y) * (p - y);
let MYF = [];
try { MYF = JSON.parse(localStorage.getItem("oo-myforecasts")) || []; } catch (e) { MYF = []; }
MYF = MYF.filter(f => f.slug || OO.markets[f.i]);

const TOPIC_RULES = [
  ["crypto", /\b(bitcoin|btc|ethereum|eth|solana|sol|xrp|dogecoin|crypto|token|etf)\b/i],
  ["geo", /\b(ceasefire|war|iran|israel|russia|ukraine|china|taiwan|nato|hormuz|strike|missile|troops|military|gaza|sanction)\b/i],
  ["politics", /\b(trump|president|congress|senate|house|election|governor|vote|bill|executive order|supreme court|cabinet|attorney general|impeach|shutdown)\b/i],
  ["economy", /\b(fed|fomc|rate (hike|cut)|inflation|cpi|gdp|unemployment|recession|tariff|oil|opec|treasury|dollar|yield)\b/i],
  ["tech", /\b(ai|openai|anthropic|google|apple|nvidia|tesla|spacex|launch|model|gpt|chip|iphone)\b/i],
];
const topicOf = (q) => q.topic || (TOPIC_RULES.find(([, re]) => re.test(q.question)) || ["other"])[0];
const C = OO.calibration;
let charts = [];

function buildCharts() {
  if (!window.Chart) { ooChart(buildCharts, "buildCharts"); return; }
  charts.forEach(c => c.destroy());
  charts = [];

  charts.push(new Chart(document.getElementById("calChart"), {
    type: "line",
    data: {
      labels: C.bins.map(b => (100*b) + "%"),
      datasets: [
        { label: OO_T("ch.perfect"), data: C.bins, borderColor: "rgba(147,160,184,0.5)", borderDash: [5,5], pointRadius: 0 },
        { label: OO_T("ch.crowd"), data: C.crowd, borderColor: OO_COLORS.amber, backgroundColor: OO_COLORS.amber, tension: 0.2 },
        { label: OO_T("ch.supers"), data: C.supers, borderColor: OO_COLORS.green, backgroundColor: OO_COLORS.green, tension: 0.2 },
        ...(typeof marketCalibration === "function" && marketCalibration() ? [{ label: OO_T("ch.realmkt"), data: marketCalibration(), borderColor: OO_COLORS.purple, backgroundColor: OO_COLORS.purple, pointRadius: 5, pointStyle: "circle", showLine: false, spanGaps: false }] : []),
        ...(typeof realCalibration === "function" && realCalibration() ? [{ label: OO_T("ch.real"), data: realCalibration(), borderColor: "#22d3ee", backgroundColor: "#22d3ee", pointRadius: 5, pointStyle: "rectRot", showLine: false, spanGaps: false }] : []),
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 1, ticks: { callback: v => (100*v) + "%" }, title: { display: true, text: OO_T("ch.obs") } },
        x: { title: { display: true, text: OO_T("ch.prob") } },
      },
    },
  }));

  const srcKeys = ["src.supers", "src.ens", "src.mkt", "src.llmcrowd", "src.crowd", "src.llm", "src.naive"];
  charts.push(new Chart(document.getElementById("srcChart"), {
    type: "bar",
    data: {
      labels: srcKeys.map(k => OO_T(k)),
      datasets: [{
        label: OO_T("ch.brier"),
        data: OO.brierBySource.map(s => s.brier),
        backgroundColor: [OO_COLORS.green, OO_COLORS.accent, OO_COLORS.purple, "#22d3ee", OO_COLORS.amber, "#94a3b8", OO_COLORS.red].map(c => c + "c0"),
      }],
    },
    options: { maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 0.25 } } },
  }));
}

buildCharts();

/* ----- AI forecaster bench -----------------------------------------------------
   Contamination-safe by construction: questions come from data/questions.json, a
   ledger of real Polymarket markets that the daily snapshot appends on the day they
   are created; the model only sees questions created AFTER its knowledge cutoff
   (set in the 🔑 dialog). Forecasts are stored locally with the market price at
   commit time; once the ledger shows a resolution they are graded — Brier for the
   model vs Brier for the market at the same moment (Alpha-Score style,
   arXiv 2605.00420). Evaluation discipline follows ForecastBench (2409.19839),
   Agentic Time Machine (2606.21013) and WC2026-Agents (2607.17765). */
function renderAiBench() {
  document.querySelector("#aiBench tbody").innerHTML = OO.aiBench.map(r => `
    <tr>
      <td><strong>${r.model}</strong></td>
      <td><span class="tag amber">${r.cutoff}</span></td>
      <td class="num-cell">${r.forecasts}</td>
      <td class="num-cell pos">${r.brier.toFixed(3)}</td>
    </tr>`).join("");
}
renderAiBench();


/* eligible = open, created after the cutoff, not yet forecast by the current model set */
function eligibleQuestions() {
  if (!LEDGER) return [];
  const cut = OO_LLM.cutoff ? Date.parse(OO_LLM.cutoff.length === 7 ? OO_LLM.cutoff + "-01" : OO_LLM.cutoff) : null;
  const done = new Set(AIF.filter(f => f.model === OO_LLM.ensemble.join("+")).map(f => f.slug));
  return LEDGER.questions.filter(q => !q.closed && !done.has(q.slug) && (cut == null || Date.parse(q.createdAt) > cut));
}

function renderAiLedger() {
  const box = document.getElementById("aiLedger");
  if (!LEDGER) { box.innerHTML = `<p class="dim-note">${OO_T("tour.ai.ledger.none")}</p>`; return; }
  const bySlug = {}; LEDGER.questions.forEach(q => { bySlug[q.slug] = q; });
  /* grade stored forecasts against resolutions */
  const graded = AIF.map(f => { const q = bySlug[f.slug]; return q && q.resolved != null ? { ...f, y: q.resolved } : null; }).filter(Boolean);
  const pending = AIF.filter(f => { const q = bySlug[f.slug]; return q && q.resolved == null; });
  let html = `<p class="dim-note">${T2("tour.ai.ledger.stats", { n: LEDGER.questions.length, open: LEDGER.questions.filter(q => !q.closed).length, res: LEDGER.questions.filter(q => q.resolved != null).length, upd: (LEDGER.updated || "").slice(0, 10) })}</p>`;
  /* real scoreboard, no key needed: baselines computed from the ledger itself (market price at
     capture, uniform 50%), then your graded forecasts, then each model's. Every row is scored
     only on questions it actually forecast, so n differs by row — the market baseline covers
     all resolved questions and is the number any participant has to beat. */
  const resolved = LEDGER.questions.filter(q => q.resolved != null);
  if (resolved.length) {
    const byTopic = {};
    resolved.forEach(q => { const t = topicOf(q); (byTopic[t] = byTopic[t] || []).push(brier(q.priceAtCapture, q.resolved)); });
    /* horizon at capture: short questions are easy for markets, long ones are where skill shows */
    const byH = { "≤7d": [], "8–30d": [], ">30d": [] };
    resolved.forEach(q => { const d = (Date.parse(q.endDate) - Date.parse(q.capturedAt)) / 864e5; (d <= 7 ? byH["≤7d"] : d <= 30 ? byH["8–30d"] : byH[">30d"]).push(brier(q.priceAtCapture, q.resolved)); });
    const horizonLine = Object.entries(byH).filter(([, arr]) => arr.length).map(([h, arr]) => `${h} ${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)} (${arr.length})`).join(" · ");
    const topicLine = Object.entries(byTopic).sort((a, b) => b[1].length - a[1].length)
      .map(([t, arr]) => `${OO_T("lb.topic." + t)} ${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)} (${arr.length})`).join(" · ");
    const rows = [];
    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    rows.push({ name: OO_T("tour.real.market"), n: resolved.length, b: mean(resolved.map(q => brier(q.priceAtCapture, q.resolved))), real: true });
    rows.push({ name: OO_T("tour.real.uniform"), n: resolved.length, b: 0.25, real: true });
    const gh = gradedHuman(bySlug);
    if (gh.length) rows.push({ name: OO_T("tour.real.you"), n: gh.length, b: mean(gh.map(x => brier(x.p, x.y))), mb: mean(gh.map(x => brier(x.mp, x.y))) });
    const byModel = {};
    graded.forEach(f => { const m = byModel[f.model] = byModel[f.model] || { b: [], mb: [] }; m.b.push(brier(f.p, f.y)); m.mb.push(brier(f.marketP, f.y)); });
    Object.entries(byModel).forEach(([m, v]) => rows.push({ name: m, n: v.b.length, b: mean(v.b), mb: mean(v.mb) }));
    rows.sort((a, b) => a.b - b.b);
    html += `<h4 class="real-h">${OO_T("tour.real.title")}</h4>
      <table style="margin-top:6px;"><thead><tr><th scope="col">${OO_T("tour.real.who")}</th><th scope="col">${OO_T("tour.ai.graded")}</th><th scope="col">${OO_T("tour.th.brier")}</th><th scope="col">${OO_T("tour.real.vsmkt")}</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td>${r.real ? "" : "<strong>"}${r.name}${r.real ? "" : "</strong>"}</td><td class="num-cell">${r.n}</td><td class="num-cell">${r.b.toFixed(3)}</td><td class="num-cell ${r.mb == null ? "" : r.b <= r.mb ? "pos" : "neg"}">${r.mb == null ? "—" : (r.b - r.mb >= 0 ? "+" : "") + (r.b - r.mb).toFixed(3)}</td></tr>`).join("") +
      `</tbody></table><p class="dim-note" style="margin-top:6px;">${OO_T("tour.real.bytopic")}: ${topicLine}</p><p class="dim-note">${OO_T("tour.real.byhorizon")}: ${horizonLine}</p><p class="dim-note">${OO_T("tour.real.note")}</p>`;
  }
  if (pending.length) {
    html += `<p class="dim-note" style="margin-top:10px;">${T2("tour.ai.pending", { n: pending.length })}</p><ul class="pending-list">` +
      pending.slice(-8).reverse().map(f => `<li><span>${f.question.slice(0, 70)}${f.question.length > 70 ? "…" : ""}</span><span class="num-cell">${Math.round(f.p * 100)}% · ${OO_T("tour.ai.mkt")} ${Math.round(f.marketP * 100)}%</span></li>`).join("") + `</ul>`;
  }
  box.innerHTML = html;
}
function T2(key, params) { let s = OO_T(key); for (const k in params) s = s.replaceAll("{" + k + "}", params[k]); return s; }

OO_FETCH("data/questions.json", { ttl: 900 }).then(d => { LEDGER = d && d.questions ? d : null; renderAiLedger(); if (typeof renderMy === "function") { renderMy(); buildCharts(); } renderLedgerBrowser(); });

document.getElementById("aiRunBtn").addEventListener("click", async () => {
  const st = document.getElementById("aiRunStatus");
  if (!OO_LLM.key) { st.textContent = "⚪ " + OO_T("tour.ai.nokey"); return; }
  if (!OO_LLM.cutoff) { st.textContent = "⚠️ " + OO_T("tour.ai.nocutoff"); return; }
  const qs = eligibleQuestions().slice(0, 5);
  if (!qs.length) { st.textContent = "⚪ " + OO_T("tour.ai.noq"); return; }
  st.textContent = "🤖 " + T2("tour.ai.running", { n: qs.length, m: OO_LLM.ensemble.length });
  try {
    const { per, agg } = await OO_LLM.askEnsemble(qs.map(q => q.question));
    const modelTag = OO_LLM.ensemble.join("+");
    const now = new Date().toISOString();
    const rows = qs.map((q, k) => {
      const p = agg[k].p, gap = p - q.price;
      AIF.push({ slug: q.slug, question: q.question, p, marketP: q.price, model: modelTag, at: now, spread: agg[k].spread, cutoff: OO_LLM.cutoff });
      return `<tr><td style="max-width:340px;">${q.question}<br><span class="dim-note">${OO_T("tour.ai.created")} ${q.createdAt.slice(0, 10)} · ${OO_T("mk.closes")} ${q.endDate.slice(0, 10)}</span></td>
        <td class="num-cell">${Math.round(p * 100)}%${agg[k].n > 1 ? ` <span class="tag ${agg[k].spread > 0.25 ? "dispute" : "consensus"}">±${Math.round(agg[k].spread * 50)}</span>` : ""}</td>
        <td class="num-cell">${Math.round(q.price * 100)}%</td>
        <td class="num-cell ${Math.abs(gap) < 0.1 ? "pos" : "neg"}">${(gap >= 0 ? "+" : "") + Math.round(gap * 100)}pp</td></tr>`;
    }).join("");
    saveAif();
    const live = document.getElementById("aiLive");
    live.classList.remove("hide");
    live.innerHTML = `<table><thead><tr><th scope="col">${OO_T("tour.ai.q")}</th><th scope="col">LLM</th><th scope="col">${OO_T("tour.ai.mkt")}</th><th scope="col">Δ</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="dim-note" style="margin-top:8px;">${T2("tour.ai.saved", { m: modelTag, fail: per.filter(r => r.error).map(r => r.model).join(", ") || "—" })}</p>`;
    st.textContent = "✓";
    renderAiLedger();
  } catch (err) {
    st.textContent = "⚠️ " + OO_T("sw.llm.err") + err.message;
  }
});
document.getElementById("aiClearBtn").addEventListener("click", () => { AIF = []; saveAif(); renderAiLedger(); });
document.addEventListener("oo:llm", renderAiLedger);

/* ----- my forecasts: demo markets OR real ledger questions ----------------------------
   Human forecasts on ledger questions are stored with the market price at commit and
   graded on resolution exactly like the AI bench, so the same table compares you, the
   models and the market. Graded forecasts (≥10) also draw a real calibration curve. */
const saveMy = () => localStorage.setItem("oo-myforecasts", JSON.stringify(MYF));
let MYSRC = "demo";
function renderMy() {
  const sel = document.getElementById("myMarket");
  const cur = sel.value;
  if (MYSRC === "real" && LEDGER) {
    const done = new Set(MYF.filter(f => f.slug).map(f => f.slug));
    const open = LEDGER.questions.filter(q => !q.closed && !done.has(q.slug));
    sel.innerHTML = open.map(q => `<option value="${q.slug}">${q.question}</option>`).join("") || `<option value="">${OO_T("my.real.none")}</option>`;
  } else {
    sel.innerHTML = OO.markets.map((m, i) => `<option value="${i}">${m.q}</option>`).join("");
  }
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
  document.querySelectorAll("#mySrc .chip").forEach(c => c.classList.toggle("active", c.dataset.src === MYSRC));
  const out = document.getElementById("myOut");
  if (!MYF.length) { out.classList.add("hide"); return; }
  out.classList.remove("hide");
  const bySlug = {}; if (LEDGER) LEDGER.questions.forEach(q => { bySlug[q.slug] = q; });
  const row = (f, k) => {
    const real = !!f.slug, q = real ? bySlug[f.slug] : null;
    const label = real ? (q ? q.question : f.question) : OO.markets[f.i].q;
    const mkt = real ? (q ? q.price : f.marketP) : OO.markets[f.i].yes;
    const d = f.p - mkt * 100;
    const status = real ? (q && q.resolved != null ? `<span class="tag ${brier(f.p / 100, q.resolved) <= brier(f.marketP, q.resolved) ? "green" : "red"}">${q.resolved ? "YES" : "NO"} · Brier ${brier(f.p / 100, q.resolved).toFixed(3)} vs ${OO_T("tour.ai.mkt")} ${brier(f.marketP, q.resolved).toFixed(3)}</span>` : `<span class="tag">${OO_T("my.real.open")}</span>`) : `<span class="tag purple">${OO_T("my.demo")}</span>`;
    return `<tr>
      <td style="max-width:340px;">${label}</td>
      <td class="num-cell">${f.p}%</td>
      <td class="num-cell">${Math.round(mkt * 100)}%</td>
      <td class="num-cell ${Math.abs(d) <= 10 ? "pos" : "neg"}">${d >= 0 ? "+" : ""}${d.toFixed(0)}pp</td>
      <td>${status}</td>
      <td><button class="btn btn-ghost my-del" data-k="${k}" style="padding:3px 10px; font-size:0.75rem;">✕</button></td>
    </tr>`;
  };
  out.innerHTML = `<table><thead><tr>
      <th scope="col">${OO_T("pf.th.market")}</th><th scope="col">${OO_T("my.prob")}</th><th scope="col">${OO_T("tour.ai.mkt")}</th><th scope="col">${OO_T("my.delta")}</th><th scope="col">${OO_T("my.status")}</th><th scope="col"></th>
    </tr></thead><tbody>${MYF.map(row).join("")}</tbody></table>` + humanSummary(bySlug);
}
/* graded human forecasts → Brier vs market, and the real calibration points for the chart */
function gradedHuman(bySlug) {
  return MYF.filter(f => f.slug && bySlug[f.slug] && bySlug[f.slug].resolved != null).map(f => ({ p: f.p / 100, mp: f.marketP, y: bySlug[f.slug].resolved }));
}
function humanSummary(bySlug) {
  const g = gradedHuman(bySlug);
  if (!g.length) return "";
  const b = g.reduce((a, x) => a + brier(x.p, x.y), 0) / g.length, mb = g.reduce((a, x) => a + brier(x.mp, x.y), 0) / g.length;
  return `<p class="dim-note" style="margin-top:8px;">${T2("my.graded", { n: g.length, b: b.toFixed(3), mb: mb.toFixed(3) })}</p>`;
}
/* market's own calibration on resolved ledger questions: price at capture vs outcome, per bin */
function marketCalibration() {
  if (!LEDGER) return null;
  const res = LEDGER.questions.filter(q => q.resolved != null);
  if (res.length < 10) return null;
  return C.bins.map(b => { const pts = res.filter(q => Math.abs(q.priceAtCapture - b) <= 0.05); return pts.length ? pts.reduce((a, q) => a + q.resolved, 0) / pts.length : null; });
}
function realCalibration() {
  const bySlug = {}; if (LEDGER) LEDGER.questions.forEach(q => { bySlug[q.slug] = q; });
  const g = gradedHuman(bySlug).concat(AIF.map(f => { const q = bySlug[f.slug]; return q && q.resolved != null ? { p: f.p, y: q.resolved } : null; }).filter(Boolean));
  if (g.length < 10) return null;
  return C.bins.map(b => { const pts = g.filter(x => Math.abs(x.p - b) <= 0.05); return pts.length ? pts.reduce((a, x) => a + x.y, 0) / pts.length : null; });
}
document.getElementById("mySrc").addEventListener("click", (e) => {
  const c = e.target.closest(".chip"); if (!c) return;
  MYSRC = c.dataset.src; renderMy();
});
document.getElementById("myProb").addEventListener("input", (e) => {
  document.getElementById("myProbVal").textContent = e.target.value + "%";
});
document.getElementById("mySubmit").addEventListener("click", () => {
  const v = document.getElementById("myMarket").value;
  const p = +document.getElementById("myProb").value;
  if (MYSRC === "real") {
    const q = LEDGER && LEDGER.questions.find(x => x.slug === v); if (!q) return;
    MYF.push({ slug: q.slug, question: q.question, p, marketP: q.price, at: new Date().toISOString() });
  } else {
    const i = +v, ex = MYF.find(f => !f.slug && f.i === i);
    if (ex) ex.p = p; else MYF.push({ i, p });
  }
  saveMy(); renderMy(); buildCharts();
});
document.getElementById("myOut").addEventListener("click", (e) => {
  const b = e.target.closest(".my-del"); if (!b) return;
  MYF.splice(+b.dataset.k, 1); saveMy(); renderMy(); buildCharts();
});
/* export / import everything scored locally (human + AI forecasts) as one JSON file */
document.getElementById("fcExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), my: MYF, ai: AIF }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "omni-oracle-forecasts.json"; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById("fcImport").addEventListener("change", (e) => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(String(rd.result));
      const key = x => x.slug ? "s:" + x.slug + ":" + (x.model || "h") : "i:" + x.i;
      const merge = (cur, inc) => { const seen = new Set(cur.map(key)); (inc || []).forEach(x => { if (!seen.has(key(x))) cur.push(x); }); return cur; };
      MYF = merge(MYF, d.my); AIF = merge(AIF, d.ai); saveMy(); saveAif(); renderMy(); renderAiLedger(); buildCharts();
    } catch (err) { alert(OO_T("my.import.bad")); }
    e.target.value = "";
  };
  rd.readAsText(f);
});
renderMy();


/* ----- ledger browser: every real question, filterable, linking to Polymarket ----- */
const LB = { filter: "open", sort: "end", topic: "all" };
function renderLedgerBrowser() {
  const box = document.getElementById("ledgerBrowser");
  if (!box || !LEDGER) return;
  let qs = LEDGER.questions.slice();
  if (LB.filter === "open") qs = qs.filter(q => !q.closed);
  else if (LB.filter === "resolved") qs = qs.filter(q => q.resolved != null);
  if (LB.topic !== "all") qs = qs.filter(q => topicOf(q) === LB.topic);
  qs.sort((a, b) => LB.sort === "end" ? Date.parse(a.endDate) - Date.parse(b.endDate)
    : LB.sort === "new" ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
    : Math.abs(0.5 - b.price) - Math.abs(0.5 - a.price));
  document.querySelectorAll("#lbFilter .chip").forEach(c => c.classList.toggle("active", c.dataset.f === LB.filter));
  const tsel = document.getElementById("lbTopic");
  tsel.innerHTML = ["all", "crypto", "geo", "politics", "economy", "tech", "other"].map(t => `<option value="${t}">${OO_T(t === "all" ? "lb.all" : "lb.topic." + t)}</option>`).join(""); tsel.value = LB.topic;
  const sel = document.getElementById("lbSort");
  sel.innerHTML = ["end", "new", "close"].map(k => `<option value="${k}">${OO_T("lb.sort." + k)}</option>`).join(""); sel.value = LB.sort;
  document.getElementById("lbCount").textContent = qs.length + " / " + LEDGER.questions.length;
  document.querySelector("#lbTable tbody").innerHTML = qs.slice(0, 60).map(q => `<tr>
      <td style="max-width:360px;"><a href="https://polymarket.com/market/${q.slug}" target="_blank" rel="noopener" style="color:inherit;">${q.question}</a> <span class="tag" style="font-size:0.66rem;">${OO_T("lb.topic." + topicOf(q))}</span></td>
      <td class="num-cell">${q.createdAt.slice(0, 10)}</td>
      <td class="num-cell">${q.endDate.slice(0, 10)}</td>
      <td class="num-cell">${Math.round(q.priceAtCapture * 100)}¢</td>
      <td class="num-cell">${q.resolved != null ? `<span class="tag ${q.resolved ? "green" : "red"}">${q.resolved ? "YES" : "NO"}</span>` : Math.round(q.price * 100) + "¢"}</td>
      <td>${q.closed ? "" : `<button class="btn btn-ghost lb-go" data-slug="${q.slug}" style="padding:3px 10px; font-size:0.74rem;">${OO_T("lb.forecast")}</button>`}</td>
    </tr>`).join("");
}
document.getElementById("lbFilter").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; LB.filter = c.dataset.f; renderLedgerBrowser(); });
document.getElementById("lbSort").addEventListener("change", (e) => { LB.sort = e.target.value; renderLedgerBrowser(); });
document.getElementById("lbTopic").addEventListener("change", (e) => { LB.topic = e.target.value; renderLedgerBrowser(); });
document.getElementById("lbTable").addEventListener("click", (e) => {
  const b = e.target.closest(".lb-go"); if (!b) return;
  MYSRC = "real"; renderMy();
  const sel = document.getElementById("myMarket");
  if ([...sel.options].some(o => o.value === b.dataset.slug)) sel.value = b.dataset.slug;
  if (window.ooShowTab) window.ooShowTab("my");
  document.getElementById("myMarket").scrollIntoView({ behavior: "smooth", block: "center" });
});


/* ----- market-baseline track record (data/scoreboard.json, one row per day) ----- */
let histChart = null;
function renderHistory(h) {
  if (!window.Chart) { if (h && h.rows && h.rows.length >= 2) ooChart(() => renderHistory(h), "renderHistory"); return; }
  const card = document.getElementById("histCard");
  if (!h || !h.rows || h.rows.length < 2) { if (card) card.classList.add("hide"); return; }
  card.classList.remove("hide");
  if (histChart) histChart.destroy();
  histChart = new Chart(document.getElementById("histChart"), {
    type: "line",
    data: { labels: h.rows.map(r => r.d), datasets: [
      { label: OO_T("tour.real.market"), data: h.rows.map(r => r.market), borderColor: OO_COLORS.purple, backgroundColor: OO_COLORS.purple, tension: 0.2, pointRadius: 2, yAxisID: "y" },
      { label: OO_T("tour.ai.graded"), data: h.rows.map(r => r.n), borderColor: OO_COLORS.dim, borderDash: [4, 4], pointRadius: 0, tension: 0.2, yAxisID: "y2" },
    ] },
    options: { maintainAspectRatio: false, scales: { y: { min: 0, max: 0.3, title: { display: true, text: "Brier" } }, y2: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "n" } }, x: { ticks: { maxTicksLimit: 8 } } } },
  });
}
let HIST = null;
OO_FETCH("data/scoreboard.json", { ttl: 900 }).then(h => { HIST = h; renderHistory(h); });
/* public records graded by the snapshot from data/ai-forecasts/*.json */
let PUB = null;
function renderPublic() {
  const box = document.getElementById("pubBox"); if (!box) return;
  const rows = PUB && PUB.rows ? PUB.rows : [];
  box.innerHTML = rows.length ? `<table style="margin-top:6px;"><thead><tr><th scope="col">${OO_T("tour.pub.file")}</th><th scope="col">${OO_T("tour.real.who")}</th><th scope="col">${OO_T("tour.ai.cutoff")}</th><th scope="col">${OO_T("tour.ai.graded")}</th><th scope="col">${OO_T("tour.th.brier")}</th><th scope="col">${OO_T("tour.real.vsmkt")}</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td><a href="https://github.com/presleyzhou/omni-oracle/blob/main/data/ai-forecasts/${r.file}.json" target="_blank" rel="noopener">${r.file}</a></td><td><strong>${r.who === "human" ? OO_T("tour.pub.human") : r.who}</strong></td><td>${r.cutoff ? `<span class="tag amber">${r.cutoff}</span>` : "—"}</td><td class="num-cell">${r.n}</td><td class="num-cell">${r.brier.toFixed(3)}</td><td class="num-cell ${r.brier <= r.market ? "pos" : "neg"}">${(r.brier - r.market >= 0 ? "+" : "") + (r.brier - r.market).toFixed(3)}</td></tr>`).join("") + `</tbody></table>`
    : `<p class="dim-note">${OO_T("tour.pub.none")}</p>`;
}
OO_FETCH("data/ai-scoreboard.json", { ttl: 900 }).then(d => { PUB = d; renderPublic(); });
/* CSV export of the ledger for researchers */
document.getElementById("lbCsv").addEventListener("click", () => {
  if (!LEDGER) return;
  const esc = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const cols = ["slug", "question", "topic", "createdAt", "capturedAt", "endDate", "priceAtCapture", "price", "closed", "resolved", "resolvedAt"];
  const csv = [cols.join(",")].concat(LEDGER.questions.map(q => cols.map(c => esc(q[c])).join(","))).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "omni-oracle-question-ledger.csv"; a.click(); URL.revokeObjectURL(a.href);
});


/* ----- page tabs: real scoreboard / my forecasts / demo leaderboard ----- */
(function () {
  const bar = document.getElementById("tourTabs"); if (!bar) return;
  const panes = [...document.querySelectorAll(".tabpane")];
  function show(name, push) {
    bar.querySelectorAll(".tab").forEach(b => { const on = b.dataset.tab === name; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    panes.forEach(p => p.classList.toggle("hide", p.dataset.pane !== name));
    try { localStorage.setItem("oo-tour-tab", name); } catch (e) {}
    if (push) history.replaceState(null, "", "tournament.html" + (name === "real" ? "" : "?tab=" + name));
    /* charts drawn inside a hidden pane have zero size — resize once visible */
    if (window.Chart) requestAnimationFrame(() => { charts.forEach(c => c.resize()); if (histChart) histChart.resize(); });
  }
  bar.addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) show(b.dataset.tab, true); });
  bar.addEventListener("keydown", (e) => {
    const tabs = [...bar.querySelectorAll(".tab")], i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const j = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault(); tabs[j].focus(); show(tabs[j].dataset.tab, true);
  });
  window.ooShowTab = (name) => show(name, true);
  const want = new URLSearchParams(location.search).get("tab") || localStorage.getItem("oo-tour-tab") || "real";
  show(["real", "my", "demo"].includes(want) ? want : "real", false);
})();

document.addEventListener("oo:lang", () => { buildCharts(); renderAiBench(); renderAiLedger(); renderMy(); renderLedgerBrowser(); renderHistory(HIST); renderPublic(); });
