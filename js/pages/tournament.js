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

/* ----- AI forecaster bench (demo table + live BYOK mini-bench) ----- */
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

document.getElementById("aiRunBtn").addEventListener("click", async () => {
  const st = document.getElementById("aiRunStatus");
  if (!OO_LLM.key) { st.textContent = "⚪ " + OO_T("tour.ai.nokey"); return; }
  const qs = [6, 7, 8].map(i => OO.markets[i]); // live econ questions
  st.textContent = "🤖 " + OO_T("tour.ai.running");
  try {
    const sys = "You are a careful probabilistic forecaster. Reply ONLY with a JSON array of 3 probabilities in [0,1], one per question, no other text.";
    const raw = await OO_LLM.ask(sys, qs.map((m, k) => `${k + 1}. ${m.q}`).join("\n"));
    const probs = JSON.parse(raw.match(/\[[^\]]*\]/)[0]).map(Number);
    if (probs.length !== 3 || probs.some(p => !(p >= 0 && p <= 1))) throw new Error("bad output");
    let mse = 0;
    const rows = qs.map((m, k) => {
      const gap = probs[k] - m.yes; mse += gap * gap / 3;
      return `<tr><td style="max-width:340px;">${m.q}</td>
        <td class="num-cell">${Math.round(probs[k] * 100)}%</td>
        <td class="num-cell">${Math.round(m.yes * 100)}%</td>
        <td class="num-cell ${Math.abs(gap) < 0.1 ? "pos" : "neg"}">${(gap >= 0 ? "+" : "") + Math.round(gap * 100)}pp</td></tr>`;
    }).join("");
    const live = document.getElementById("aiLive");
    live.classList.remove("hide");
    live.innerHTML = `<table><thead><tr><th scope="col">${OO_T("tour.ai.q")}</th><th scope="col">LLM</th><th scope="col">${OO_T("tour.ai.mkt") === "tour.ai.mkt" ? "Market" : OO_T("tour.ai.mkt")}</th><th scope="col">Δ</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:10px; font-size:0.85rem; color:var(--cyan);">${OO_T("tour.ai.alpha")}: <strong class="num-cell">${mse.toFixed(4)}</strong> · ${OO_LLM.model}</p>`;
    st.textContent = "✓";
  } catch (err) {
    st.textContent = "⚠️ " + OO_T("sw.llm.err") + err.message;
  }
});

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

document.addEventListener("oo:lang", () => { buildCharts(); renderAiBench(); renderMy(); });
