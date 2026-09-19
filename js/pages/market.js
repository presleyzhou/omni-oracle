/* ---------- single-market detail: history, depth, trading ---------- */
const id = Math.min(OO.markets.length - 1, Math.max(0, +(new URLSearchParams(location.search).get("id") || 0)));
const m = OO.markets[id];
const S = { price: m.yes, side: "yes", shares: 50 };
let PORT = [];
try { PORT = JSON.parse(localStorage.getItem("oo-portfolio")) || []; } catch (e) { PORT = []; }

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let histChart = null, depthChart = null;

function priceSeries(days) {
  const rnd = mulberry(id * 7 + 3);
  const pts = []; let p = S.price;
  for (let k = 0; k < days; k++) {
    pts.unshift(p);
    p = Math.min(0.95, Math.max(0.05, p + (rnd() - 0.5) * 0.05));
  }
  return pts;
}

function depthLevels() {
  const rnd = mulberry(id * 13 + 5);
  const b = LMSR.b, p = S.price;
  const mk = (dir) => {
    const lv = []; let cum = 0;
    for (let k = 1; k <= 14; k++) {
      const price = p + dir * k * 0.01;
      if (price <= 0.01 || price >= 0.99) break;
      const size = Math.round(b * 0.01 / (price * (1 - price)) * (0.7 + rnd() * 0.9) * (1 + k * 0.18));
      cum += size;
      lv.push({ price, size, cum });
    }
    return lv;
  };
  return { bids: mk(-1), asks: mk(+1) };
}

let liveSpot = null, liveSeries = null;

function render() {
  document.getElementById("mq").textContent = m.q;
  document.getElementById("mp").textContent = Math.round(S.price * 100) + "¢";
  document.getElementById("mmeta").innerHTML =
    `<span class="tag">${OO_T("cat." + m.cat)}</span>
     <span>${OO_T("mk.vol")} $${m.vol}</span>
     <span>${OO_T("mk.closes")} ${m.close}</span>
     <span>${OO_T("mk.res")}: ${m.res}</span>` +
    (liveSpot != null ? `<span class="tag green">● ${m.sym} $${liveSpot.toLocaleString("en-US")} · LIVE</span>` : "");

  /* price history */
  if (histChart) histChart.destroy();
  const pts = priceSeries(90);
  histChart = new Chart(document.getElementById("histChart"), {
    type: "line",
    data: {
      labels: pts.map((_, k) => "D-" + (90 - k)),
      datasets: [{
        label: "YES ¢", data: pts.map(v => Math.round(v * 100)),
        borderColor: OO_COLORS.accent, backgroundColor: "rgba(79,140,255,0.12)",
        fill: true, tension: 0.25, pointRadius: 0,
      }],
    },
    options: {
      maintainAspectRatio: false, plugins: { legend: { display: !!liveSeries } },
      scales: { y: { min: 0, max: 100 }, x: { ticks: { maxTicksLimit: 7 } } },
    },
  });
  if (liveSeries) {
    const n = pts.length;
    const series = Array.from({ length: n }, (_, k) =>
      liveSeries[Math.floor(k * (liveSeries.length - 1) / (n - 1))]);
    histChart.data.datasets.push({
      label: `${m.sym} spot · LIVE`, data: series,
      borderColor: "#f59e0b", pointRadius: 0, tension: 0.25, yAxisID: "y2",
    });
    histChart.options.scales.y2 = { position: "right", grid: { drawOnChartArea: false } };
    histChart.update();
  }

  /* depth */
  const { bids, asks } = depthLevels();
  if (depthChart) depthChart.destroy();
  const labels = [...bids.map(l => l.price).reverse(), ...asks.map(l => l.price)].map(v => Math.round(v * 100) + "¢");
  depthChart = new Chart(document.getElementById("depthChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: OO_T("mkd.bids"), data: [...bids.map(l => l.cum).reverse(), ...asks.map(() => null)],
          borderColor: OO_COLORS.green, backgroundColor: "rgba(34,197,94,0.15)", fill: true, stepped: true, pointRadius: 0 },
        { label: OO_T("mkd.asks"), data: [...bids.map(() => null), ...asks.map(l => l.cum)],
          borderColor: OO_COLORS.red, backgroundColor: "rgba(239,68,68,0.15)", fill: true, stepped: true, pointRadius: 0 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: OO_T("mkd.cum") } } },
    },
  });

  /* top of book */
  document.querySelector("#bookTable tbody").innerHTML = Array.from({ length: 8 }, (_, k) => `
    <tr>
      <td class="num-cell">${bids[k] ? bids[k].size : ""}</td>
      <td class="num-cell pos">${bids[k] ? Math.round(bids[k].price * 100) + "¢" : ""}</td>
      <td class="num-cell neg">${asks[k] ? Math.round(asks[k].price * 100) + "¢" : ""}</td>
      <td class="num-cell">${asks[k] ? asks[k].size : ""}</td>
    </tr>`).join("");

  renderTrade();

  /* related links */
  const toks = q => new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3));
  const a = toks(m.q);
  const rel = OO.markets.map((n, j) => {
    if (j === id) return { j, s: -1 };
    let s = 0; toks(n.q).forEach(w => { if (a.has(w)) s++; });
    if (n.cat === m.cat) s += 1.5;
    return { j, s };
  }).sort((x, y) => y.s - x.s).slice(0, 3);
  document.getElementById("relRow").innerHTML = `<span>${OO_T("mk.rel")}:</span> ` +
    rel.map(r => `<a href="market.html?id=${r.j}">${OO.markets[r.j].q.slice(0, 46)}${OO.markets[r.j].q.length > 46 ? "…" : ""}</a>`).join(" ");
}

function renderTrade() {
  const [yb, nb] = document.querySelectorAll("#sideTog button");
  yb.textContent = "YES " + Math.round(S.price * 100) + "¢";
  nb.textContent = "NO " + Math.round((1 - S.price) * 100) + "¢";
  yb.className = S.side === "yes" ? "sel-yes" : "";
  nb.className = S.side === "no" ? "sel-no" : "";
  document.getElementById("shLbl").textContent = `${S.shares} ${OO_T("mk.shares")}`;
  const cost = LMSR.cost(S.price, S.side, S.shares);
  const newP = LMSR.newPrice(S.price, S.side, S.shares);
  document.getElementById("quoteRow").innerHTML =
    `<span>${OO_T("mk.cost")} <strong class="mono" style="color:var(--text);">${fmtUSD(cost)}</strong></span>
     <span>${OO_T("mk.payout")} <strong class="mono" style="color:var(--green);">${fmtUSD(S.shares)}</strong></span>
     <span>${OO_T("mk.avg")} <strong class="mono" style="color:var(--text);">${Math.round(100 * cost / S.shares)}¢</strong></span>
     <span>${OO_T("mk.moves")} <strong class="mono" style="color:var(--accent);">${Math.round(newP * 100)}¢</strong></span>`;
  document.getElementById("execBtn").textContent = OO_T("mk.exec");
}

document.getElementById("sideTog").addEventListener("click", (e) => {
  const b = e.target.closest("[data-side]"); if (!b) return;
  S.side = b.dataset.side; renderTrade();
});
document.getElementById("shSlider").addEventListener("input", (e) => {
  S.shares = +e.target.value; renderTrade();
});
document.getElementById("execBtn").addEventListener("click", () => {
  const cost = LMSR.cost(S.price, S.side, S.shares);
  S.price = Math.min(0.99, Math.max(0.01, LMSR.newPrice(S.price, S.side, S.shares)));
  const pos = PORT.find(p => p.i === id && p.side === S.side && !p.bot);
  if (pos) { pos.shares += S.shares; pos.cost += cost; }
  else PORT.push({ i: id, side: S.side, shares: S.shares, cost });
  localStorage.setItem("oo-portfolio", JSON.stringify(PORT));
  render();
  document.getElementById("execMsg").textContent = OO_T("mk.filled");
});

/* live crypto data for this market (CoinGecko public API; spot falls back to the
   daily snapshot, the 90-day history is live-only and simply omitted when unavailable) */
if (m.coin) {
  ooLive("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true", "coingecko", { ttl: 120 })
    .then(({ data: d }) => { if (d && d[m.coin]) { liveSpot = d[m.coin].usd; render(); } });
  OO_FETCH(`https://api.coingecko.com/api/v3/coins/${m.coin}/market_chart?vs_currency=usd&days=90`, { ttl: 900 })
    .then(d => { if (d && d.prices && d.prices.length > 10) { liveSeries = d.prices.map(p => p[1]); render(); } });
}

document.addEventListener("oo:lang", render);
render();
