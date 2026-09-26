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

const C = OO.calibration;
let charts = [];

function buildCharts() {
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

let LEDGER = null;
const AIF_KEY = "oo-ai-forecasts";
let AIF = [];
try { AIF = JSON.parse(localStorage.getItem(AIF_KEY)) || []; } catch (e) { AIF = []; }
const saveAif = () => localStorage.setItem(AIF_KEY, JSON.stringify(AIF.slice(-400)));
const brier = (p, y) => (p - y) * (p - y);

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
  if (graded.length) {
    const byModel = {};
    graded.forEach(f => { const m = byModel[f.model] = byModel[f.model] || { n: 0, b: 0, mb: 0 }; m.n++; m.b += brier(f.p, f.y); m.mb += brier(f.marketP, f.y); });
    html += `<table style="margin-top:8px;"><thead><tr><th scope="col">${OO_T("tour.ai.model")}</th><th scope="col">${OO_T("tour.ai.graded")}</th><th scope="col">${OO_T("tour.th.brier")}</th><th scope="col">${OO_T("tour.ai.mktbrier")}</th><th scope="col">Δ</th></tr></thead><tbody>` +
      Object.entries(byModel).map(([m, v]) => { const b = v.b / v.n, mb = v.mb / v.n; return `<tr><td><strong>${m}</strong></td><td class="num-cell">${v.n}</td><td class="num-cell">${b.toFixed(3)}</td><td class="num-cell">${mb.toFixed(3)}</td><td class="num-cell ${b <= mb ? "pos" : "neg"}">${(b - mb >= 0 ? "+" : "") + (b - mb).toFixed(3)}</td></tr>`; }).join("") + `</tbody></table>`;
  }
  if (pending.length) {
    html += `<p class="dim-note" style="margin-top:10px;">${T2("tour.ai.pending", { n: pending.length })}</p><ul class="pending-list">` +
      pending.slice(-8).reverse().map(f => `<li><span>${f.question.slice(0, 70)}${f.question.length > 70 ? "…" : ""}</span><span class="num-cell">${Math.round(f.p * 100)}% · ${OO_T("tour.ai.mkt")} ${Math.round(f.marketP * 100)}%</span></li>`).join("") + `</ul>`;
  }
  box.innerHTML = html;
}
function T2(key, params) { let s = OO_T(key); for (const k in params) s = s.replaceAll("{" + k + "}", params[k]); return s; }

OO_FETCH("data/questions.json", { ttl: 900 }).then(d => { LEDGER = d && d.questions ? d : null; renderAiLedger(); });

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
      AIF.push({ slug: q.slug, question: q.question, p, marketP: q.price, model: modelTag, at: now, spread: agg[k].spread });
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

/* ----- my forecasts: pick a market, submit a probability, compare vs market ----- */
let MYF = [];
try { MYF = JSON.parse(localStorage.getItem("oo-myforecasts")) || []; } catch (e) { MYF = []; }
MYF = MYF.filter(f => OO.markets[f.i]);
function renderMy() {
  const sel = document.getElementById("myMarket");
  const cur = sel.value;
  sel.innerHTML = OO.markets.map((m, i) => `<option value="${i}">${m.q}</option>`).join("");
  if (cur) sel.value = cur;
  const out = document.getElementById("myOut");
  if (!MYF.length) { out.classList.add("hide"); return; }
  out.classList.remove("hide");
  out.innerHTML = `<table><thead><tr>
      <th scope="col">${OO_T("pf.th.market")}</th><th scope="col">${OO_T("my.prob")}</th><th scope="col">${OO_T("tour.ai.mkt")}</th><th scope="col">${OO_T("my.delta")}</th><th scope="col"></th>
    </tr></thead><tbody>` + MYF.map((f, k) => {
    const mkt = OO.markets[f.i].yes;
    const d = f.p - mkt * 100;
    return `<tr>
      <td style="max-width:340px;">${OO.markets[f.i].q}</td>
      <td class="num-cell">${f.p}%</td>
      <td class="num-cell">${Math.round(mkt * 100)}%</td>
      <td class="num-cell ${Math.abs(d) <= 10 ? "pos" : "neg"}">${d >= 0 ? "+" : ""}${d.toFixed(0)}pp</td>
      <td><button class="btn btn-ghost my-del" data-k="${k}" style="padding:3px 10px; font-size:0.75rem;">✕</button></td>
    </tr>`;
  }).join("") + "</tbody></table>";
}
document.getElementById("myProb").addEventListener("input", (e) => {
  document.getElementById("myProbVal").textContent = e.target.value + "%";
});
document.getElementById("mySubmit").addEventListener("click", () => {
  const i = +document.getElementById("myMarket").value;
  const p = +document.getElementById("myProb").value;
  const ex = MYF.find(f => f.i === i);
  if (ex) ex.p = p; else MYF.push({ i, p });
  localStorage.setItem("oo-myforecasts", JSON.stringify(MYF));
  renderMy();
});
document.getElementById("myOut").addEventListener("click", (e) => {
  const b = e.target.closest(".my-del"); if (!b) return;
  MYF.splice(+b.dataset.k, 1);
  localStorage.setItem("oo-myforecasts", JSON.stringify(MYF));
  renderMy();
});
renderMy();

document.addEventListener("oo:lang", () => { buildCharts(); renderAiBench(); renderAiLedger(); renderMy(); });
