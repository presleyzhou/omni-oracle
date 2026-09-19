/* ---------------------------------------------------------------
   Macroeconomics (M1): every series is official statistics.
   GDP: BEA (NIPA table 1.1.1, line 1) via the DBnomics open API.
   CPI / core CPI / unemployment: BLS public API v1.
   Cross-country actuals: World Bank open API.
   All of them are read from the daily snapshot first (data/live.json,
   refreshed by GitHub Actions) — the BLS v1 endpoint allows only 25
   unregistered calls per IP per day, so browsers must not hit it on
   every page load. Live calls are made only when the snapshot lacks a field.
   --------------------------------------------------------------- */
const R = { gdp: null, cpi: null, core: null, unemp: null };
let charts = [];

const BLS = "https://api.bls.gov/publicAPI/v1/timeseries/data/";
const monthLabel = (y, p) => y + "-" + p.slice(1);

/* BLS index series -> year-over-year % change */
function toYoY(points) {
  const byKey = {};
  points.forEach(d => { byKey[d.year + d.period] = +d.value; });
  const out = [];
  points.slice().reverse().forEach(d => {
    const prev = byKey[(+d.year - 1) + d.period];
    if (prev) out.push({ t: monthLabel(d.year, d.period), v: +(100 * (+d.value / prev - 1)).toFixed(2) });
  });
  return out.slice(-18);
}

/* snapshot stores the bare row array; the live API wraps it */
function fetchBls(series) {
  return ooSnap("bls." + series, BLS + series, { ttl: 21600 }).then(({ data: d, source }) => ({
    rows: Array.isArray(d) ? d : d && d.status === "REQUEST_SUCCEEDED" ? d.Results.series[0].data : null,
    source,
  }));
}

/* naive AR(1) on the real actuals — a transparent baseline, not a product */
function ar1Next(vals) {
  const n = vals.length;
  if (n < 4) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 1; i < n; i++) { num += (vals[i] - mean) * (vals[i - 1] - mean); den += Math.pow(vals[i - 1] - mean, 2); }
  const phi = den ? Math.max(-0.95, Math.min(0.95, num / den)) : 0;
  return +(mean + phi * (vals[n - 1] - mean)).toFixed(2);
}

let loading = 4;
function renderStats() {
  const cells = [];
  const stat = (num, lblKey, period, cls) => cells.push(
    `<div class="stat"><div class="num ${cls || ""}">${num}</div>
     <div class="lbl">${OO_T(lblKey).replace("{p}", period)}</div></div>`);
  if (R.gdp && R.gdp.length) {
    const last = R.gdp[R.gdp.length - 1];
    stat(last.v + "%", "mac.stat.gdp", last.t, last.v >= 2 ? "up" : last.v < 0 ? "down" : "");
  }
  if (R.cpi && R.cpi.length) {
    const last = R.cpi[R.cpi.length - 1];
    stat(last.v + "%", "mac.stat.cpi", last.t, "");
  }
  if (R.core && R.core.length) {
    const last = R.core[R.core.length - 1];
    stat(last.v + "%", "mac.stat.core", last.t, "");
  }
  if (R.unemp && R.unemp.length) {
    const last = R.unemp[R.unemp.length - 1];
    stat(last.v + "%", "mac.stat.unemp", last.t, last.v >= 4.5 ? "down" : "");
  }
  document.getElementById("statsBar").innerHTML = cells.join("") ||
    `<div class="stat"><div class="num">${loading > 0 ? "…" : "—"}</div><div class="lbl">${OO_T(loading > 0 ? "mac.loading" : "ds.unavailable")}</div></div>`;
}

function buildCharts() {
  charts.forEach(c => c.destroy());
  charts = [];
  renderStats();

  if (R.gdp && R.gdp.length) {
    const vals = R.gdp.map(d => d.v);
    const est = ar1Next(vals);
    const labels = R.gdp.map(d => d.t).concat(est != null ? ["AR"] : []);
    charts.push(new Chart(document.getElementById("gdpChart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: OO_T("ch.gdpReal"), data: vals, borderColor: OO_COLORS.accent,
            backgroundColor: "rgba(79,140,255,0.12)", fill: true, tension: 0.25, pointRadius: 3 },
          ...(est != null ? [{
            label: OO_T("ch.arEst"),
            data: vals.map(() => null).slice(0, -1).concat([vals[vals.length - 1], est]),
            borderColor: "#22d3ee", borderDash: [4, 4], pointRadius: 4, pointStyle: "rectRot", tension: 0,
          }] : []),
        ],
      },
      options: { maintainAspectRatio: false, scales: { y: { title: { display: true, text: "% SAAR" } } } },
    }));
  }

  if (R.cpi && R.cpi.length) {
    charts.push(new Chart(document.getElementById("cpiChart"), {
      type: "line",
      data: {
        labels: R.cpi.map(d => d.t),
        datasets: [
          { label: OO_T("ch.cpi"), data: R.cpi.map(d => d.v), borderColor: OO_COLORS.amber,
            backgroundColor: OO_COLORS.amber, tension: 0.3, pointRadius: 2 },
          ...(R.core ? [{ label: OO_T("ch.core"), data: R.core.map(d => d.v), borderColor: OO_COLORS.red,
            backgroundColor: OO_COLORS.red, tension: 0.3, pointRadius: 2 }] : []),
        ],
      },
      options: { maintainAspectRatio: false, scales: { y: { title: { display: true, text: "% YoY" } }, x: { ticks: { maxTicksLimit: 9 } } } },
    }));
  }

  if (R.unemp && R.unemp.length) {
    charts.push(new Chart(document.getElementById("unempChart"), {
      type: "line",
      data: {
        labels: R.unemp.map(d => d.t),
        datasets: [{ label: OO_T("ch.unemp"), data: R.unemp.map(d => d.v), borderColor: OO_COLORS.green,
          backgroundColor: "rgba(34,197,94,0.12)", fill: true, tension: 0.3, pointRadius: 2 }],
      },
      options: { maintainAspectRatio: false, scales: { y: { title: { display: true, text: "%" } }, x: { ticks: { maxTicksLimit: 10 } } } },
    }));
  }
}
buildCharts();

/* ---- BEA quarterly real GDP growth (via DBnomics open API) ---- */
ooSnap("bea_gdp", "https://api.db.nomics.world/v22/series/BEA/NIPA-T10101/A191RL-Q?observations=1", { ttl: 21600 })
  .then(({ data: d, source }) => {
    loading--;
    const doc = d && d.series && d.series.docs && d.series.docs[0];
    if (!doc) { ooMarkSource("gdpCard", null); buildCharts(); return; }
    R.gdp = doc.period.map((t, i) => ({ t, v: doc.value[i] }))
      .filter(x => typeof x.v === "number").slice(-12);
    ooMarkSource("gdpCard", source);
    buildCharts();
  });

/* ---- BLS: headline CPI, core CPI, unemployment ---- */
const cpiSrc = [];
const cpiBadge = () => ooMarkSource("cpiCard", cpiSrc.length ? cpiSrc.sort()[cpiSrc.length - 1] : null);
fetchBls("CUUR0000SA0").then(({ rows, source }) => {
  loading--;
  if (rows) { R.cpi = toYoY(rows); cpiSrc.push(source); }
  cpiBadge(); buildCharts();
});
fetchBls("CUUR0000SA0L1E").then(({ rows, source }) => {
  loading--;
  if (rows) { R.core = toYoY(rows); cpiSrc.push(source); }
  cpiBadge(); buildCharts();
});
fetchBls("LNS14000000").then(({ rows, source }) => {
  loading--;
  if (rows) R.unemp = rows.slice().reverse().map(x => ({ t: monthLabel(x.year, x.period), v: +x.value })).slice(-24);
  ooMarkSource("unempCard", rows ? source : null);
  buildCharts();
});

document.addEventListener("oo:lang", buildCharts);

/* ---- World Bank cross-country actuals ---- */
const WB = { countries: { USA: "US", CHN: "CN", EUU: "EU", JPN: "JP" }, gdp: {}, cpi: {}, years: [] };
let wbCharts = [];
function renderWb() {
  if (!Object.keys(WB.gdp).length) return;
  document.getElementById("wbCard").classList.remove("hide");
  wbCharts.forEach(c => c.destroy()); wbCharts = [];
  const years = WB.years;
  const cols = [OO_COLORS.accent, OO_COLORS.purple, OO_COLORS.green, OO_COLORS.amber];
  const mk = (canvas, store, title) => wbCharts.push(new Chart(document.getElementById(canvas), {
    type: "line",
    data: {
      labels: years,
      datasets: Object.entries(WB.countries).map(([iso, lbl], i) => ({
        label: lbl, data: years.map(y => store[iso]?.[y] ?? null),
        borderColor: cols[i], backgroundColor: cols[i], tension: 0.3, spanGaps: true, pointRadius: 3,
      })),
    },
    options: { maintainAspectRatio: false, scales: { y: { title: { display: true, text: title } } } },
  }));
  mk("wbGdpChart", WB.gdp, OO_T("mac.wb.gdp"));
  mk("wbCpiChart", WB.cpi, OO_T("mac.wb.cpi"));
}
/* last five calendar years that can already have annual data */
const WB_TO = new Date().getFullYear() - 1, WB_FROM = WB_TO - 4;
WB.years = Array.from({ length: 5 }, (_, i) => String(WB_FROM + i));
Promise.all(Object.keys(WB.countries).flatMap(iso => [
  ["NY.GDP.MKTP.KD.ZG", "gdp"], ["FP.CPI.TOTL.ZG", "cpi"],
].map(([ind, slot]) =>
  ooSnap(`worldbank.${iso}.${slot}`,
    `https://api.worldbank.org/v2/country/${iso}/indicator/${ind}?format=json&per_page=8&date=${WB_FROM}:${WB_TO}`, { ttl: 21600 })
    .then(({ data: d, source }) => {
      if (!Array.isArray(d) || !d[1]) return null;
      WB[slot][iso] = {};
      d[1].forEach(r => { if (r.value != null) WB[slot][iso][r.date] = +r.value.toFixed(2); });
      return source;
    })
))).then(srcs => {
  const s = srcs.filter(Boolean);
  if (s.length) ooMarkSource("wbCard", s.includes("snapshot") ? "snapshot" : s.includes("cached") ? "cached" : "live");
  renderWb();
});
document.addEventListener("oo:lang", renderWb);

/* ---- AI macro analyst, fed only with the real series above ---- */
ooAnalyst("anRun", "anOut", "anStatus", () => {
  const s = (arr, n) => arr ? arr.slice(-n).map(d => d.t + ":" + d.v).join(", ") : "(unavailable)";
  const wbTxt = Object.entries(WB.gdp).map(([iso, v]) =>
    `${WB.countries[iso]} ${Object.entries(v).map(([y, x]) => y + ":" + x).join(",")}`).join(" | ");
  return {
    system: "You are the macro analyst of Omni Oracle. All numbers you receive are official statistics (BEA, BLS, World Bank). Write a concise, decision-oriented read (150-200 words): what the growth and inflation picture implies, what the labour market adds, one thing to watch next, one risk. No preamble, no markdown headers. Reply strictly in this language code: " + OO_LANG + ".",
    user: `US real GDP growth (BEA, quarterly SAAR, %): ${s(R.gdp, 8)}. ` +
      `CPI YoY (BLS, %): ${s(R.cpi, 12)}. Core CPI YoY (BLS, %): ${s(R.core, 12)}. ` +
      `Unemployment rate (BLS, %): ${s(R.unemp, 12)}. ` +
      `World Bank annual GDP growth by economy: ${wbTxt || "(loading)"}.`,
  };
});
