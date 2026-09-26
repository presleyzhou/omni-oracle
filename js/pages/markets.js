const grid = document.getElementById("marketGrid");
const chipsEl = document.getElementById("chips");
let activeCat = new URLSearchParams(location.search).get("cat") || "all";
if (!OO.categories.some(c => c.id === activeCat)) activeCat = "all";

/* per-market UI state */
const state = OO.markets.map(m => ({ price: m.yes, side: "yes", shares: 50, open: false }));

/* my forecasts (submitted on the Tournament page) shown as 🎯 badges */
const MYMAP = {};
try { (JSON.parse(localStorage.getItem("oo-myforecasts")) || []).forEach(f => { MYMAP[f.i] = f.p; }); } catch (e) {}

/* live crypto spot prices (CoinGecko public API; daily snapshot as fallback) */
const SPOT = {};
ooLive("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true", "coingecko", { ttl: 120 })
  .then(({ data: d }) => {
    if (!d) return;
    for (const k in d) SPOT[k] = d[k].usd;
    render();
  });

/* live Polymarket odds (public Gamma API, CORS-open; card stays hidden on failure) */
let PMDATA = null;
function renderPmLive() {
  if (!PMDATA) return;
  document.getElementById("pmLive").classList.remove("hide");
  document.getElementById("pmRows").innerHTML = PMDATA.map(m => `
    <a href="https://polymarket.com/market/${m.slug}" target="_blank" rel="noopener"
       style="display:flex; align-items:center; gap:12px; text-decoration:none; color:inherit; padding:10px 12px; border:1px solid var(--border); border-radius:10px;">
      <span style="flex:1; font-size:0.9rem;">${m.q}</span>
      <span style="color:var(--text-dim); font-size:0.78rem; white-space:nowrap;">${OO_T("pm.live.vol24")} $${(m.vol / 1e6).toFixed(1)}M</span>
      <span class="price-pill yes" style="font-size:0.9rem;">${m.o0} ${m.p0 < 0.01 ? "&lt;1¢" : m.p0 > 0.99 ? "&gt;99¢" : Math.round(m.p0 * 100) + "¢"}</span>
    </a>`).join("");
}
ooLive("https://gamma-api.polymarket.com/markets?limit=6&active=true&closed=false&order=volume24hr&ascending=false", "polymarket", { ttl: 120 })
  .then(({ data: d, source }) => {
    if (!Array.isArray(d) || !d.length) return;
    PMDATA = d.map(m => {
      let p0 = 0.5, o0 = "Yes";
      try { p0 = +JSON.parse(m.outcomePrices)[0]; o0 = JSON.parse(m.outcomes)[0]; } catch (e) {}
      return { q: m.question, slug: m.slug, vol: +m.volume24hr || 0, p0, o0 };
    });
    ooMarkSource("pmLive", source);
    renderPmLive();
  });

/* related markets: token overlap + same-category bonus (semantic clustering, demo-grade) */
const REL = OO.markets.map((m, i) => {
  const toks = (q) => new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3));
  const a = toks(m.q);
  return OO.markets
    .map((n, j) => {
      if (i === j) return { j, s: -1 };
      let s = 0;
      toks(n.q).forEach(w => { if (a.has(w)) s++; });
      if (n.cat === m.cat) s += 1.5;
      return { j, s };
    })
    .sort((x, y) => y.s - x.s).slice(0, 2).map(x => x.j);
});

/* play-money portfolio, persisted in localStorage */
let PORT = [];
try { PORT = JSON.parse(localStorage.getItem("oo-portfolio")) || []; } catch (e) { PORT = []; }
PORT = PORT.filter(p => OO.markets[p.i]);
let REALIZED = +(localStorage.getItem("oo-realized") || 0);
function savePort() {
  localStorage.setItem("oo-portfolio", JSON.stringify(PORT));
  localStorage.setItem("oo-realized", String(REALIZED));
}
function fmtPnl(x) { return (x >= 0 ? "+$" : "-$") + Math.abs(x).toFixed(2); }
function renderPortfolio() {
  const card = document.getElementById("pfCard");
  if (!PORT.length) { card.classList.add("hide"); return; }
  card.classList.remove("hide");
  let totCost = 0, totVal = 0;
  const rows = PORT.map(p => {
    const price = state[p.i].price;
    const cur = p.side === "yes" ? price : 1 - price;
    const val = p.shares * cur, pnl = val - p.cost;
    totCost += p.cost; totVal += val;
    return `<tr>
      <td style="max-width:340px;">${OO.markets[p.i].q}</td>
      <td>${p.bot ? "🤖 " : ""}<span class="tag ${p.side === "yes" ? "green" : "red"}">${p.side.toUpperCase()}</span></td>
      <td class="num-cell">${p.shares}</td>
      <td class="num-cell">${fmtUSD(p.cost)}</td>
      <td class="num-cell">${Math.round(cur * 100)}¢</td>
      <td class="num-cell">${fmtUSD(val)}</td>
      <td class="num-cell ${pnl >= 0 ? "pos" : "neg"}">${fmtPnl(pnl)}</td>
      <td><button class="btn btn-ghost pf-close" data-k="${PORT.indexOf(p)}" style="padding:4px 12px; font-size:0.75rem;">${OO_T("pf.close")}</button></td>
    </tr>`;
  }).join("");
  const totPnl = totVal - totCost;
  document.querySelector("#pfTable tbody").innerHTML = rows + `<tr style="font-weight:700;">
    <td>${OO_T("pf.total")}</td><td></td>
    <td class="num-cell">${PORT.reduce((a, p) => a + p.shares, 0)}</td>
    <td class="num-cell">${fmtUSD(totCost)}</td><td></td>
    <td class="num-cell">${fmtUSD(totVal)}</td>
    <td class="num-cell ${totPnl >= 0 ? "pos" : "neg"}">${fmtPnl(totPnl)}</td>
    <td></td>
  </tr>` + (REALIZED !== 0 ? `<tr><td colspan="8" style="color:var(--cyan); font-size:0.85rem;">
    ${OO_T("pf.realized")}: <strong class="num-cell ${REALIZED >= 0 ? "pos" : "neg"}">${fmtPnl(REALIZED)}</strong></td></tr>` : "");
}
document.getElementById("pfTable").addEventListener("click", (e) => {
  const b = e.target.closest(".pf-close"); if (!b) return;
  const p = PORT[+b.dataset.k]; if (!p) return;
  const price = state[p.i].price;
  const proceeds = -LMSR.cost(price, p.side, -p.shares);
  state[p.i].price = Math.min(0.99, Math.max(0.01, LMSR.newPrice(price, p.side, -p.shares)));
  REALIZED += proceeds - p.cost;
  PORT.splice(+b.dataset.k, 1);
  savePort();
  render();
});
document.getElementById("pfClear").addEventListener("click", () => {
  PORT = []; savePort(); renderPortfolio();
});

function renderChips() {
  chipsEl.innerHTML = OO.categories.map(c =>
    `<button class="chip ${c.id === activeCat ? "active" : ""}" data-cat="${c.id}">${OO_T("cat." + c.id)}</button>`
  ).join("");
}

/* search + sort */
let SEARCH = "", SORTMODE = "def";
const volNum = v => parseFloat(v) * (String(v).includes("M") ? 1e6 : String(v).includes("K") ? 1e3 : 1);
function renderControls() {
  document.getElementById("mkSearch").placeholder = OO_T("mk.search");
  const sel = document.getElementById("mkSort");
  sel.innerHTML = ["def", "pd", "pa", "vd"].map(k =>
    `<option value="${k}">${OO_T("sort." + k)}</option>`).join("");
  sel.value = SORTMODE;
}
document.getElementById("mkSearch").addEventListener("input", (e) => { SEARCH = e.target.value.toLowerCase(); render(); });
document.getElementById("mkSort").addEventListener("change", (e) => { SORTMODE = e.target.value; render(); });

function render() {
  renderChips();
  renderControls();
  let order = OO.markets.map((_, i) => i);
  if (SORTMODE === "pd") order.sort((a, b) => state[b].price - state[a].price);
  else if (SORTMODE === "pa") order.sort((a, b) => state[a].price - state[b].price);
  else if (SORTMODE === "vd") order.sort((a, b) => volNum(OO.markets[b].vol) - volNum(OO.markets[a].vol));
  grid.innerHTML = order.map(i => {
    const m = OO.markets[i];
    if (activeCat !== "all" && m.cat !== activeCat) return "";
    if (SEARCH && !m.q.toLowerCase().includes(SEARCH)) return "";
    const s = state[i];
    const yes = s.price;
    const cost = LMSR.cost(yes, s.side, s.shares);
    const newP = LMSR.newPrice(yes, s.side, s.shares);
    const payout = s.shares; // $1 per share if correct
    return `
    <div class="card market-card" data-i="${i}">
      <div class="market-head">
        <h3><a href="market.html?id=${i}" style="color:inherit; text-decoration:none;">${m.q}</a></h3>
        <div class="price-pill yes">${Math.round(yes * 100)}¢</div>
      </div>
      <div class="prob-bar"><div class="fill" style="width:${yes * 100}%"></div></div>
      <canvas class="spark" width="600" height="56" aria-hidden="true"></canvas>
      <div class="market-meta">
        <span class="tag">${OO_T("cat." + m.cat)}</span>
        <span>${OO_T("mk.vol")} $${m.vol}</span>
        <span>${OO_T("mk.closes")} ${m.close}</span>
        <span>${OO_T("mk.res")}: ${m.res}</span>
        ${m.coin && SPOT[m.coin] ? `<span class="tag green">● ${m.sym} $${SPOT[m.coin].toLocaleString("en-US")} · LIVE</span>` : ""}
        ${MYMAP[i] != null ? `<span class="tag" style="background:rgba(34,211,238,0.14); color:var(--cyan);" title="${OO_T("my.prob")}">🎯 ${MYMAP[i]}%</span>` : ""}
      </div>
      <div class="market-meta" style="font-size:0.76rem;">
        <span>${OO_T("mk.rel")}:</span>
        ${REL[i].map(j => `<a href="#" class="rel-link" data-j="${j}">${OO.markets[j].q.slice(0, 42)}${OO.markets[j].q.length > 42 ? "…" : ""}</a>`).join(" ")}
      </div>
      <div>
        <button class="btn btn-ghost btn-trade" style="padding:7px 16px; font-size:0.83rem;">
          ${s.open ? OO_T("mk.hide") : OO_T("mk.trade")}
        </button>
      </div>
      <div class="trade-panel ${s.open ? "open" : ""}">
        <div class="trade-row">
          <div class="side-toggle">
            <button class="${s.side === "yes" ? "sel-yes" : ""}" data-side="yes">YES ${Math.round(yes*100)}¢</button>
            <button class="${s.side === "no" ? "sel-no" : ""}" data-side="no">NO ${Math.round((1-yes)*100)}¢</button>
          </div>
          <span class="mono shares-label">${s.shares} ${OO_T("mk.shares")}</span>
          <input type="range" min="10" max="500" step="10" value="${s.shares}" class="shares-slider" />
        </div>
        <div class="trade-row" style="color:var(--text-dim);">
          <span>${OO_T("mk.cost")} <strong class="mono" style="color:var(--text);">${fmtUSD(cost)}</strong></span>
          <span>${OO_T("mk.payout")} <strong class="mono" style="color:var(--green);">${fmtUSD(payout)}</strong></span>
          <span>${OO_T("mk.avg")} <strong class="mono" style="color:var(--text);">${Math.round(100 * cost / s.shares)}¢</strong></span>
          <span>${OO_T("mk.moves")} <strong class="mono" style="color:var(--accent);">${Math.round(newP * 100)}¢</strong></span>
        </div>
        <div class="trade-row">
          <button class="btn btn-primary btn-exec" style="padding:7px 16px; font-size:0.83rem;">${OO_T("mk.exec")}</button>
          <span class="exec-msg" aria-live="polite" style="color:var(--green); font-size:0.8rem;"></span>
        </div>
      </div>
    </div>`;
  }).join("");
  drawSparks();
  renderPortfolio();
  renderPmLive();
}

/* Mini price-history sparklines (deterministic per market, ending at current price) */
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function drawSparks() {
  document.querySelectorAll("#marketGrid .spark").forEach((cv) => {
    const i = +cv.closest(".market-card").dataset.i;
    const rnd = mulberry(i * 7 + 3);
    const pts = []; let p = state[i].price;
    for (let k = 0; k < 30; k++) {
      pts.unshift(p);
      p = Math.min(0.95, Math.max(0.05, p + (rnd() - 0.5) * 0.06));
    }
    const W = 600, H = 56;
    const c = cv.getContext("2d");
    c.clearRect(0, 0, W, H);
    const min = Math.min(...pts), max = Math.max(...pts), rng = (max - min) || 0.01;
    const up = pts[pts.length - 1] >= pts[0];
    const col = up ? "34,197,94" : "239,68,68";
    const xy = (v, k) => [k * (W / 29), H - 8 - ((v - min) / rng) * (H - 16)];
    // area fill
    c.beginPath();
    pts.forEach((v, k) => { const [x, y] = xy(v, k); k ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.lineTo(W, H); c.lineTo(0, H); c.closePath();
    c.fillStyle = `rgba(${col},0.10)`; c.fill();
    // line
    c.beginPath();
    pts.forEach((v, k) => { const [x, y] = xy(v, k); k ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.strokeStyle = `rgb(${col})`; c.lineWidth = 2; c.stroke();
  });
}

/* Event delegation */
chipsEl.addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  activeCat = b.dataset.cat;
  history.replaceState(null, "", activeCat === "all" ? "markets.html" : `markets.html?cat=${activeCat}`);
  render();
});

grid.addEventListener("click", (e) => {
  const rel = e.target.closest(".rel-link");
  if (rel) {
    e.preventDefault();
    const j = +rel.dataset.j;
    if (activeCat !== "all" && OO.markets[j].cat !== activeCat) { activeCat = "all"; render(); }
    document.querySelector(`.market-card[data-i="${j}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const cardEl = e.target.closest(".market-card"); if (!cardEl) return;
  const i = +cardEl.dataset.i; const s = state[i];
  if (e.target.closest(".btn-trade")) { s.open = !s.open; render(); }
  else if (e.target.closest("[data-side]")) { s.side = e.target.closest("[data-side]").dataset.side; render(); }
  else if (e.target.closest(".btn-exec")) {
    const cost = LMSR.cost(s.price, s.side, s.shares);
    const newP = LMSR.newPrice(s.price, s.side, s.shares);
    s.price = Math.min(0.99, Math.max(0.01, newP));
    const pos = PORT.find(p => p.i === i && p.side === s.side);
    if (pos) { pos.shares += s.shares; pos.cost += cost; }
    else PORT.push({ i, side: s.side, shares: s.shares, cost });
    savePort();
    render();
    const msg = document.querySelector(`.market-card[data-i="${i}"] .exec-msg`);
    if (msg) msg.textContent = OO_T("mk.filled");
  }
});

grid.addEventListener("input", (e) => {
  if (!e.target.classList.contains("shares-slider")) return;
  const cardEl = e.target.closest(".market-card");
  const i = +cardEl.dataset.i; const s = state[i];
  s.shares = +e.target.value;
  const yes = s.price;
  const cost = LMSR.cost(yes, s.side, s.shares);
  const newP = LMSR.newPrice(yes, s.side, s.shares);
  const rows = cardEl.querySelectorAll(".trade-row");
  cardEl.querySelector(".shares-label").textContent = `${s.shares} ${OO_T("mk.shares")}`;
  const dim = rows[1].querySelectorAll("strong");
  dim[0].textContent = fmtUSD(cost);
  dim[1].textContent = fmtUSD(s.shares);
  dim[2].textContent = Math.round(100 * cost / s.shares) + "¢";
  dim[3].textContent = Math.round(newP * 100) + "¢";
});

/* ----- AI trader: independent multi-model estimates vs LMSR prices ----------------
   Each configured model answers alone; estimates are combined by confidence-weighted
   voting (arXiv 2605.30802 — debate-style consensus made things worse). A market
   where the models disagree by more than 25pp is flagged "disputed" and NOT traded:
   the disagreement is the information. Paper money only — six frontier models
   trading real markets for 57 days all lost money (Prediction Arena, 2604.07355),
   and none of four agents beat the bookmaker on 104 World Cup matches (2607.17765). */
const AI_PICKS = [0, 3, 6, 9, 15, 18];
const DISPUTE = 0.25;
document.getElementById("aiRun").addEventListener("click", async () => {
  const st = document.getElementById("aiStatus");
  if (!OO_LLM.key) { st.textContent = "⚪ " + OO_T("ai.nokey"); return; }
  st.textContent = "🤖 " + OO_T("ai.running") + (OO_LLM.ensemble.length > 1 ? ` (${OO_LLM.ensemble.length} ${OO_T("ai.models")})` : "");
  try {
    const qs = AI_PICKS.map(i => OO.markets[i]);
    const { per, agg } = await OO_LLM.askEnsemble(qs.map(m => m.q));
    const ok = per.filter(r => r.est);
    const rows = AI_PICKS.map((i, k) => {
      const price = state[i].price;
      const p = agg[k].p, edge = p - price, disputed = ok.length > 1 && agg[k].spread > DISPUTE;
      let action = "—";
      if (disputed) action = `<span class="tag dispute">${OO_T("ai.disputed")}</span>`;
      else if (Math.abs(edge) > 0.08) {
        const side = edge > 0 ? "yes" : "no";
        const cost = LMSR.cost(price, side, 50);
        state[i].price = Math.min(0.99, Math.max(0.01, LMSR.newPrice(price, side, 50)));
        const pos = PORT.find(p => p.i === i && p.side === side && p.bot);
        if (pos) { pos.shares += 50; pos.cost += cost; }
        else PORT.push({ i, side, shares: 50, cost, bot: true });
        action = `<span class="tag ${side === "yes" ? "green" : "red"}">${OO_T("ai.buy")} ${side.toUpperCase()}</span>`;
      }
      const perModel = ok.length > 1 ? `<br><span class="dim-note">${ok.map(r => `${r.model.split("-").slice(0, 2).join("-")} ${Math.round(r.est[k].p * 100)}%`).join(" · ")}</span>` : "";
      return `<tr><td style="max-width:320px;">${OO.markets[i].q}</td>
        <td class="num-cell">${Math.round(p * 100)}%${ok.length > 1 ? ` <span class="tag ${disputed ? "dispute" : "consensus"}">±${Math.round(agg[k].spread * 50)}</span>` : ""}${perModel}</td>
        <td class="num-cell">${Math.round(price * 100)}¢</td>
        <td class="num-cell ${edge >= 0 ? "pos" : "neg"}">${(edge >= 0 ? "+" : "") + Math.round(edge * 100)}¢</td>
        <td>${action}</td></tr>`;
    }).join("");
    savePort();
    const out = document.getElementById("aiOut");
    out.classList.remove("hide");
    out.innerHTML = `<table><thead><tr><th scope="col">${OO_T("tour.ai.q")}</th><th scope="col">${OO_T("ai.est")}</th><th scope="col">${OO_T("tour.ai.mkt")}</th><th scope="col">${OO_T("ai.edge")}</th><th scope="col">${OO_T("ai.action")}</th></tr></thead><tbody>${rows}</tbody></table>` +
      (per.some(r => r.error) ? `<p class="dim-note" style="margin-top:6px;">⚠ ${per.filter(r => r.error).map(r => r.model + ": " + r.error).join("; ")}</p>` : "");
    st.textContent = `✓ ${ok.map(r => r.model).join(" + ")}`;
    render();
  } catch (err) {
    st.textContent = "⚠️ " + OO_T("sw.llm.err") + err.message;
  }
});

/* ----- Resolution desk: AI pre-settlement with disagreement routing ---------------
   Hybrid design from arXiv 2605.30802: auto-resolve only when every model agrees with
   high confidence (97.9% accuracy on the 47% of cases that qualify), route the rest to
   a human. Here it only *proposes* a resolution for demo markets that close within
   90 days; positions are never settled automatically. */
function renderResDesk() {
  const sel = document.getElementById("resMarket");
  const cur = sel.value;
  const soon = OO.markets.map((m, i) => ({ m, i })).filter(({ m }) => {
    const t = Date.parse(m.close.replace(/^(\w{3}) (\d{4})$/, "$1 1 $2"));
    return isFinite(t) ? (t - Date.now()) / 864e5 < 120 : true;
  });
  sel.innerHTML = soon.map(({ m, i }) => `<option value="${i}">${m.q}</option>`).join("");
  if (cur) sel.value = cur;
}
renderResDesk();
document.getElementById("resRun").addEventListener("click", async () => {
  const st = document.getElementById("resStatus"), out = document.getElementById("resOut");
  if (!OO_LLM.key) { st.textContent = "⚪ " + OO_T("ai.nokey"); return; }
  const m = OO.markets[+document.getElementById("resMarket").value];
  st.textContent = "🤖 " + OO_T("res.running");
  try {
    const sys = `You are a prediction-market resolution oracle. Decide whether the market has resolved YES, resolved NO, or is UNRESOLVED as of today (${new Date().toISOString().slice(0, 10)}). Use only facts you are confident are true; if the event date has not passed or you are unsure, answer UNRESOLVED. Reply ONLY with JSON {"verdict":"YES"|"NO"|"UNRESOLVED","confidence":number in [0,1],"basis":"one sentence"}.`;
    const user = `Market: ${m.q}\nResolution source: ${m.res}\nCloses: ${m.close}`;
    const per = await Promise.all(OO_LLM.ensemble.map(async (model) => {
      try { const raw = await OO_LLM.ask(sys, user, 200, model); const j = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]); return { model, v: String(j.verdict).toUpperCase(), c: Math.min(1, Math.max(0, +j.confidence || 0)), basis: String(j.basis || "").slice(0, 160) }; }
      catch (err) { return { model, error: err.message }; }
    }));
    const ok = per.filter(r => r.v);
    if (!ok.length) throw new Error(per.map(r => r.error).join("; "));
    const verdicts = new Set(ok.map(r => r.v));
    const unanimous = verdicts.size === 1, minC = Math.min(...ok.map(r => r.c));
    const v = ok[0].v;
    const route = unanimous && v !== "UNRESOLVED" && minC >= 0.8 ? "auto" : unanimous && v === "UNRESOLVED" ? "open" : "human";
    out.classList.remove("hide");
    out.innerHTML = `<div class="res-verdict ${route}"><strong>${OO_T("res.route." + route)}</strong> — ${OO_T("res.verdict")}: ${unanimous ? v : [...verdicts].join(" / ")} · ${OO_T("res.minconf")} ${Math.round(minC * 100)}%</div>
      <ul class="pending-list">${ok.map(r => `<li><span><strong>${r.model}</strong> · ${r.v} (${Math.round(r.c * 100)}%)</span><span style="text-align:right; max-width:60%;">${r.basis}</span></li>`).join("")}</ul>
      <p class="dim-note" style="margin-top:6px;">${OO_T("res.note")}</p>`;
    st.textContent = "✓";
  } catch (err) {
    st.textContent = "⚠️ " + OO_T("sw.llm.err") + err.message;
  }
});

render();
document.addEventListener("oo:lang", () => { render(); renderResDesk(); });
