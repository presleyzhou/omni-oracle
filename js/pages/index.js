/* Home page: hero stats from official statistics + live market ticker.
   Official series come from the daily snapshot first (see OO_SNAPSHOT); prices
   are fetched live with the snapshot as fallback. */

/* hero stats: BEA GDP, BLS CPI / core CPI / unemployment, top Polymarket market */
(function () {
  const S = [];
  let pending = 5, worst = "live";
  const rank = { live: 0, cached: 1, snapshot: 2 };
  const note = (src) => { if (src && rank[src] > rank[worst]) worst = src; };
  const push = (order, num, lblKey, period, cls) => S.push({ order, num, lblKey, period, cls });
  const paint = () => {
    const host = document.getElementById("heroStats");
    if (!S.length) {
      host.innerHTML = `<div class="stat"><div class="num">—</div><div class="lbl">${OO_T("ds.unavailable")}</div></div>`;
      return;
    }
    host.innerHTML = S.sort((a, b) => a.order - b.order)
      .map(s => `<div class="stat"><div class="num ${s.cls || ""}">${s.num}</div>
        <div class="lbl">${OO_T(s.lblKey).replace("{p}", s.period || "")}</div></div>`).join("");
  };
  const done = () => {
    if (--pending > 0) return;
    paint();
    ooMarkSource("heroSection", S.length ? worst : null);
  };
  document.addEventListener("oo:lang", () => { if (pending <= 0) paint(); });

  ooSnap("bea_gdp", "https://api.db.nomics.world/v22/series/BEA/NIPA-T10101/A191RL-Q?observations=1", { ttl: 21600 })
    .then(({ data: d, source }) => {
      const doc = d && d.series && d.series.docs && d.series.docs[0];
      if (!doc) return;
      const idx = doc.value.map((v, i) => [v, i]).filter(([v]) => typeof v === "number").pop();
      if (idx) { note(source); push(1, idx[0] + "%", "mac.stat.gdp", doc.period[idx[1]], idx[0] >= 2 ? "up" : "down"); }
    }).finally(done);

  const bls = (series, order, lblKey, yoy, cls) =>
    ooSnap("bls." + series, "https://api.bls.gov/publicAPI/v1/timeseries/data/" + series, { ttl: 21600 })
      .then(({ data: d, source }) => {
        /* snapshot stores the bare rows; the live API wraps them */
        const rows = Array.isArray(d) ? d
          : d && d.status === "REQUEST_SUCCEEDED" ? d.Results.series[0].data : null;
        if (!rows || !rows.length) return;
        const latest = rows[0], period = latest.year + "-" + latest.period.slice(1);
        if (!yoy) { note(source); push(order, latest.value + "%", lblKey, period, cls); return; }
        const prev = rows.find(x => +x.year === +latest.year - 1 && x.period === latest.period);
        if (prev) { note(source); push(order, (100 * (+latest.value / +prev.value - 1)).toFixed(1) + "%", lblKey, period, cls); }
      }).finally(done);
  bls("CUUR0000SA0", 2, "mac.stat.cpi", true, "");
  bls("CUUR0000SA0L1E", 3, "mac.stat.core", true, "");
  bls("LNS14000000", 4, "mac.stat.unemp", false, "");

  ooLive("https://gamma-api.polymarket.com/markets?limit=6&active=true&closed=false&order=volume24hr&ascending=false", "polymarket", { ttl: 120 })
    .then(({ data: d, source }) => {
      if (Array.isArray(d) && d[0]) {
        let p = 0.5; try { p = +JSON.parse(d[0].outcomePrices)[0]; } catch (e) {}
        note(source);
        push(5, (p < 0.01 ? "<1" : Math.round(p * 100)) + "¢", "idx.stat.pm", "", "");
      }
    }).finally(done);
})();

/* live ticker: aggregates the site's real data sources; hidden if all fail */
(function () {
  const items = [];
  let pending = 4;
  const esc = s => String(s).replace(/[<>&]/g, "");
  const chg = c => `<b class="${c >= 0 ? "up2" : "dn2"}">${c >= 0 ? "+" : ""}${c.toFixed(2)}%</b>`;
  const fin = () => {
    if (--pending > 0 || !items.length) return;
    const html = items.map(t => `<span class="itm">${t}</span>`).join("");
    document.getElementById("tickerInner").innerHTML = html + html;
    document.getElementById("ticker").classList.remove("hide");
  };
  ooLive("https://stockanalysis.com/api/quotes/s/NVDA", "quotes.NVDA", { ttl: 120 }).then(({ data: d }) => {
    if (d && d.data && d.data.p != null) items.push(`NVDA $${d.data.p.toLocaleString("en-US")} ${chg(d.data.cp || 0)}`);
  }).finally(fin);
  ooLive("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true", "coingecko", { ttl: 120 }).then(({ data: d }) => {
    if (d && d.bitcoin) items.push(`BTC $${d.bitcoin.usd.toLocaleString("en-US")} ${chg(d.bitcoin.usd_24h_change || 0)}`);
  }).finally(fin);
  ooLive("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,CNY,JPY,GBP", "fx", { ttl: 3600 }).then(({ data: d }) => {
    if (d && d.rates) { items.push(`USD/CNY ${d.rates.CNY}`); items.push(`USD/EUR ${d.rates.EUR}`); }
  }).finally(fin);
  ooLive("https://gamma-api.polymarket.com/markets?limit=6&active=true&closed=false&order=volume24hr&ascending=false", "polymarket", { ttl: 120 }).then(({ data: d }) => {
    if (Array.isArray(d) && d[0]) {
      let p = 0.5, o = "Yes";
      try { p = +JSON.parse(d[0].outcomePrices)[0]; o = JSON.parse(d[0].outcomes)[0]; } catch (e) {}
      items.push(`🔴 ${esc(d[0].question.slice(0, 48))} — ${esc(o)} ${p < 0.01 ? "&lt;1¢" : Math.round(p * 100) + "¢"}`);
    }
  }).finally(fin);
})();
