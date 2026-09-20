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
/* crisis early-warning state (module further down; declared here because buildCharts() runs first) */
const CW = { curve: null, vix: null, credit: null, src: [] };
let cwChart = null;

const BLS = "https://api.bls.gov/publicAPI/v1/timeseries/data/";
const monthLabel = (y, p) => y + "-" + p.slice(1);

/* BLS index series -> year-over-year % change */
function toYoY(points) {
  const byKey = {};
  points.forEach(d => { if (Number.isFinite(+d.value)) byKey[d.year + d.period] = +d.value; });
  const out = [];
  points.slice().reverse().forEach(d => {
    const prev = byKey[(+d.year - 1) + d.period];
    if (prev && Number.isFinite(+d.value) && d.period !== "M13") out.push({ t: monthLabel(d.year, d.period), v: +(100 * (+d.value / prev - 1)).toFixed(2) });
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
  if (typeof renderCrisis === "function") renderCrisis();

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
  /* BLS marks missing months (e.g. the Oct-2025 shutdown) with "-": drop them */
  if (rows) R.unemp = rows.slice().reverse().map(x => ({ t: monthLabel(x.year, x.period), v: +x.value }))
    .filter(x => Number.isFinite(x.v)).slice(-24);
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

/* ---- Financial-crisis early warning ----------------------------------------
   Composite of documented indicators, every one computed from real data:
   · yield-curve slope 10Y−3M (Estrella & Mishkin 1998) and the NY Fed probit
     recession probability it implies (Estrella & Trubin 2006);
   · Sahm rule on the BLS unemployment series already loaded above (Sahm 2019);
   · Moody's Baa − 10Y credit spread (Gilchrist & Zakrajšek 2012 family) — FRED,
     optional: only when the snapshot workflow has a FRED_API_KEY;
   · CBOE VIX; latest real GDP growth; core CPI as a policy constraint.
   Each indicator scores 0 / 50 / 100 against its published thresholds; the
   composite is the mean of the available scores. Yields and VIX come from the
   daily snapshot (Treasury / CBOE have no CORS); Fed H.15 via DBnomics is the
   live fallback for the curve. */

/* standard normal CDF (Abramowitz & Stegun 7.1.26) */
function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), x = Math.abs(z) / Math.SQRT2;
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -y : y));
}
/* three-level scoring: alert → 100, watch → 50, else 0 (dir = +1 high is bad, −1 low is bad) */
const score3 = (v, warn, alert, dir) => dir > 0 ? (v > alert ? 100 : v > warn ? 50 : 0) : (v < alert ? 100 : v < warn ? 50 : 0);

/* Sahm indicator: 3-month average unemployment minus its minimum over the prior 12 months */
function sahmSeries(unemp) {
  if (!unemp || unemp.length < 15) return null;
  const avg3 = unemp.map((_, i) => i < 2 ? null : (unemp[i].v + unemp[i - 1].v + unemp[i - 2].v) / 3);
  return unemp.map((d, i) => {
    if (i < 14) return null;
    const prior = avg3.slice(i - 12, i).filter(x => x != null);
    return prior.length ? { t: d.t, v: +(avg3[i] - Math.min(...prior)).toFixed(2) } : null;
  }).filter(Boolean);
}

function crisisIndicators() {
  const rows = [];
  const add = (key, val, raw, sc) => rows.push({ key, val, raw, score: sc });
  const cv = CW.curve && CW.curve[CW.curve.length - 1];
  if (cv) {
    const bp = Math.round((cv.y10 - cv.m3) * 100);
    add("curve", `${bp} bp · ${cv.d}`, bp, score3(bp, 50, 0, -1));
    const p = normCdf(-0.5333 - 0.6330 * (cv.y10 - cv.m3));
    add("prob", `${Math.round(p * 100)}%`, p, score3(p, 0.15, 0.30, +1));
  } else { add("curve", null); add("prob", null); }
  const sahm = sahmSeries(R.unemp);
  if (sahm && sahm.length) { const s = sahm[sahm.length - 1]; add("sahm", `${s.v >= 0 ? "+" : ""}${s.v.toFixed(2)} pp · ${s.t}`, s.v, score3(s.v, 0.3, 0.5, +1)); }
  else add("sahm", null);
  const cr = CW.credit && CW.credit[CW.credit.length - 1];
  if (cr) add("credit", `${cr.v.toFixed(2)} pp · ${cr.d}`, cr.v, score3(cr.v, 2.0, 3.0, +1)); else add("credit", null);
  const vx = CW.vix && CW.vix[CW.vix.length - 1];
  if (vx) add("vix", `${vx.c.toFixed(1)} · ${vx.d}`, vx.c, score3(vx.c, 20, 30, +1)); else add("vix", null);
  if (R.gdp && R.gdp.length) { const g = R.gdp[R.gdp.length - 1]; add("growth", `${g.v}% · ${g.t}`, g.v, score3(g.v, 1, 0, -1)); }
  else add("growth", null);
  if (R.core && R.core.length) { const c = R.core[R.core.length - 1]; add("infl", `${c.v}% · ${c.t}`, c.v, score3(c.v, 3, 4, +1)); }
  else add("infl", null);
  return rows;
}

function renderCrisis() {
  const rows = crisisIndicators();
  const scored = rows.filter(r => r.val != null);
  const pill = (sc) => sc == null ? `<span class="cw-pill na">${OO_T("cw.na")}</span>`
    : `<span class="cw-pill ${sc >= 100 ? "alert" : sc >= 50 ? "warn" : "ok"}">${OO_T(sc >= 100 ? "cw.st.alert" : sc >= 50 ? "cw.st.warn" : "cw.st.ok")}</span>`;
  document.querySelector("#cwTable tbody").innerHTML = rows.map(r => `<tr>
      <td>${OO_T("cw.ind." + r.key)}</td>
      <td class="num-cell">${r.val == null ? "—" : r.val}</td>
      <td class="th">${OO_T("cw.th." + r.key)}</td>
      <td>${pill(r.val == null ? null : r.score)}</td>
    </tr>`).join("");

  const num = document.getElementById("cwScore"), reg = document.getElementById("cwRegime");
  if (scored.length < 3) {
    num.textContent = loading > 0 || !CW.curve ? "…" : "—"; num.className = "cw-num";
    reg.textContent = OO_T(loading > 0 || !CW.curve ? "cw.loading" : "ds.unavailable");
    return;
  }
  const composite = Math.round(scored.reduce((a, r) => a + r.score, 0) / scored.length);
  const regime = composite < 25 ? "calm" : composite < 50 ? "watch" : composite < 75 ? "elevated" : "crisis";
  num.textContent = String(composite); num.className = "cw-num " + regime;
  reg.textContent = OO_T("cw.regime." + regime) + ` · ${scored.length}/${rows.length}`;
  document.getElementById("cwMarker").style.left = composite + "%";
  renderCrisisChart();
}

function renderCrisisChart() {
  if (!CW.curve) return;
  if (cwChart) cwChart.destroy();
  const from = new Date(); from.setMonth(from.getMonth() - 24);
  const cut = from.toISOString().slice(0, 10);
  const curve = CW.curve.filter(x => x.d >= cut);
  const vixByDay = {}; (CW.vix || []).forEach(x => { vixByDay[x.d] = x.c; });
  const labels = curve.map(x => x.d);
  cwChart = new Chart(document.getElementById("cwChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: OO_T("ch.spread"), data: curve.map(x => Math.round((x.y10 - x.m3) * 100)), borderColor: OO_COLORS.accent,
          backgroundColor: "rgba(79,140,255,0.12)", fill: { target: { value: 0 }, above: "rgba(79,140,255,0.10)", below: "rgba(239,68,68,0.22)" },
          pointRadius: 0, tension: 0.2, yAxisID: "y" },
        ...(CW.vix ? [{ label: OO_T("ch.vix"), data: labels.map(d => vixByDay[d] ?? null), borderColor: OO_COLORS.amber,
          pointRadius: 0, tension: 0.2, spanGaps: true, yAxisID: "y2" }] : []),
      ],
    },
    options: {
      maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: 8, callback: (v, i) => labels[i] ? labels[i].slice(0, 7) : "" } },
        y: { title: { display: true, text: "bp" }, grid: { color: (c) => c.tick.value === 0 ? "rgba(239,68,68,0.6)" : "rgba(36,48,74,0.6)" } },
        y2: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "VIX" } },
      },
    },
  });
}

/* inputs: snapshot-first (no CORS upstream); Fed H.15 via DBnomics as live fallback for the curve */
(async () => {
  let { data, source } = await ooSnap("treasury_curve", null);
  if (!data) {
    const H15 = (c) => OO_FETCH(`https://api.db.nomics.world/v22/series/FED/H15/${c}?observations=1`, { ttl: 21600 });
    const [y10, m3] = await Promise.all([H15("RIFLGFCY10_N.B"), H15("RIFLGFCM03_N.B")]);
    const doc = (d) => d && d.series && d.series.docs && d.series.docs[0];
    if (doc(y10) && doc(m3)) {
      const short = {}; doc(m3).period.forEach((p, i) => { if (typeof doc(m3).value[i] === "number") short[p] = doc(m3).value[i]; });
      data = doc(y10).period.map((p, i) => ({ d: p, y10: doc(y10).value[i], m3: short[p] }))
        .filter(x => typeof x.y10 === "number" && x.m3 != null).slice(-520);
      source = "live";
    }
  }
  CW.curve = data; if (source) CW.src.push(source);
  ooMarkSource("crisisCard", CW.src.includes("snapshot") ? "snapshot" : CW.src[0] || null);
  renderCrisis();
})();
ooSnap("vix", null).then(({ data, source }) => { CW.vix = data; if (source) CW.src.push(source); renderCrisis(); });
/* FRED BAA10Y, present only when the snapshot workflow has a FRED_API_KEY secret */
ooSnap("baa_spread", null).then(({ data, source }) => { CW.credit = data; if (source) CW.src.push(source); renderCrisis(); });
document.addEventListener("oo:lang", renderCrisis);

/* ---- AI macro analyst, fed only with the real series above ---- */
ooAnalyst("anRun", "anOut", "anStatus", () => {
  const s = (arr, n) => arr ? arr.slice(-n).map(d => d.t + ":" + d.v).join(", ") : "(unavailable)";
  const wbTxt = Object.entries(WB.gdp).map(([iso, v]) =>
    `${WB.countries[iso]} ${Object.entries(v).map(([y, x]) => y + ":" + x).join(",")}`).join(" | ");
  return {
    system: "You are the macro analyst of Omni Oracle. All numbers you receive are official statistics (BEA, BLS, World Bank). Write a concise, decision-oriented read (150-200 words): what the growth and inflation picture implies, what the labour market adds, how the crisis early-warning composite should be read, one thing to watch next, one risk. No preamble, no markdown headers. Reply strictly in this language code: " + OO_LANG + ".",
    user: `US real GDP growth (BEA, quarterly SAAR, %): ${s(R.gdp, 8)}. ` +
      `CPI YoY (BLS, %): ${s(R.cpi, 12)}. Core CPI YoY (BLS, %): ${s(R.core, 12)}. ` +
      `Unemployment rate (BLS, %): ${s(R.unemp, 12)}. ` +
      `World Bank annual GDP growth by economy: ${wbTxt || "(loading)"}. ` +
      `Financial-crisis early-warning indicators (published thresholds): ${crisisIndicators().filter(r => r.val != null)
        .map(r => `${r.key}=${r.val} (score ${r.score})`).join("; ") || "(unavailable)"}.`,
  };
});
