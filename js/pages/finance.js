/* Financial Markets (M1b): Fed decision tree on demo probabilities + live FX,
   Treasury rates and tech mega-cap quotes (live-first, daily snapshot fallback). */
const M = OO.macro;
let fedChart = null;

function buildCharts() {
  if (fedChart) fedChart.destroy();
  document.getElementById("fedTitle").textContent = OO_T("mac.fed.prefix") + M.fedMeeting;
  fedChart = new Chart(document.getElementById("fedChart"), {
    type: "bar",
    data: {
      labels: M.fedProbs.map(d => d.move),
      datasets: [
        { label: OO_T("ch.model"), data: M.fedProbs.map(d => d.model), backgroundColor: "rgba(79,140,255,0.75)" },
        { label: OO_T("ch.marketOdds"), data: M.fedProbs.map(d => d.market), backgroundColor: "rgba(139,92,246,0.75)" },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: { y: { max: 0.7, ticks: { callback: v => (100*v) + "%" } } },
    },
  });
}
buildCharts();
ooMarkSource("fedCard", "demo");
document.addEventListener("oo:lang", buildCharts);

/* live FX + Treasury rates (cards hidden only when both live and snapshot fail) */
(function () {
  const grid = document.getElementById("liveGrid");
  const rank = { live: 0, cached: 1, snapshot: 2 };
  let worst = null;
  const show = (src) => {
    document.getElementById("liveCard").classList.remove("hide");
    if (src && (worst == null || rank[src] > rank[worst])) { worst = src; ooMarkSource("liveCard", worst); }
  };
  const stat = (num, lbl) =>
    `<div class="stat"><div class="num" style="font-size:1.15rem;">${num}</div><div class="lbl">${lbl}</div></div>`;
  ooLive("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,CNY,JPY,GBP", "fx", { ttl: 3600 })
    .then(({ data: d, source }) => {
      if (!d || !d.rates) return;
      show(source);
      grid.insertAdjacentHTML("beforeend",
        ["EUR", "CNY", "JPY", "GBP"].map(c => stat(d.rates[c], `USD/${c} · ${d.date}`)).join(""));
    });
  ooLive("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?filter=security_desc:in:(Treasury%20Bills,Treasury%20Notes,Treasury%20Bonds)&sort=-record_date&page%5Bsize%5D=3", "treasury", { ttl: 21600 })
    .then(({ data: d, source }) => {
      if (!d || !d.data || !d.data.length) return;
      show(source);
      grid.insertAdjacentHTML("beforeend",
        d.data.map(x => stat((+x.avg_interest_rate_amt).toFixed(2) + "%",
          `${x.security_desc.replace("Treasury ", "T-")} · ${x.record_date}`)).join(""));
    });

  /* tech mega-cap quotes (stockanalysis.com public API, CORS-open) */
  const TICKS = ["NVDA", "MSFT", "AAPL", "GOOGL", "META", "MU"];
  Promise.all(TICKS.map(t => ooLive("https://stockanalysis.com/api/quotes/s/" + t, "quotes." + t, { ttl: 120 })))
    .then(rs => {
      const rows = rs.map(({ data: d }, i) => d && d.data && d.data.p != null
        ? { t: TICKS[i], p: d.data.p, cp: d.data.cp || 0 } : null).filter(Boolean);
      if (!rows.length) return;
      const src = rs.filter(r => r.source).map(r => r.source).sort((a, b) => rank[b] - rank[a])[0];
      document.getElementById("stockCard").classList.remove("hide");
      ooMarkSource("stockCard", src);
      document.getElementById("stockGrid").innerHTML = rows.map(r => `
        <div class="stat">
          <div class="num ${r.cp >= 0 ? "up" : "down"}" style="font-size:1.15rem;">$${r.p.toLocaleString("en-US")}</div>
          <div class="lbl">${r.t} · ${r.cp >= 0 ? "+" : ""}${r.cp.toFixed(2)}%</div>
        </div>`).join("");
    });
})();
