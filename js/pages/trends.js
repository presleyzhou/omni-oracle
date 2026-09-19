/* Trend companies (M2): theme explorer + scorecards with live quotes. */
function renderThemes() {
  document.getElementById("themeGrid").innerHTML = OO.themes.map(t => `
    <div class="card">
      <h3>${t.name}</h3>
      <p>${t.desc}</p>
      <div class="maturity"><div class="fill" style="width:${t.maturity}%"></div></div>
      <div class="theme-stats">
        <span>${OO_T("tr.maturity")} ${t.maturity}/100</span>
        <span>${t.firms} ${OO_T("tr.firms")} · 12m ${t.ret12m}</span>
      </div>
    </div>
  `).join("");
}

function badge(v) {
  const cls = v >= 80 ? "hi" : v >= 60 ? "mid" : "lo";
  return `<span class="score-badge ${cls}">${v}</span>`;
}
function decileBadge(d) {
  const cls = d >= 8 ? "hi" : d >= 5 ? "mid" : "lo";
  return `<span class="score-badge ${cls}">D${d}</span>`;
}

function renderCompanies() {
  document.querySelector("#companyTable tbody").innerHTML = OO.companies.map(c => `
    <tr>
      <td class="num-cell"><strong>${c.ticker}</strong></td>
      <td>${c.name}</td>
      <td class="num-cell">${LIVEPX[c.ticker]
        ? `$${LIVEPX[c.ticker].p.toLocaleString("en-US")} <span class="${LIVEPX[c.ticker].cp >= 0 ? "pos" : "neg"}" style="font-size:0.78rem;">${LIVEPX[c.ticker].cp >= 0 ? "+" : ""}${LIVEPX[c.ticker].cp.toFixed(2)}%</span>`
        : "—"}</td>
      <td><span class="tag purple">${c.theme}</span></td>
      <td>${badge(c.innov)}</td>
      <td>${badge(c.trend)}</td>
      <td>${badge(c.tone)}</td>
      <td>${decileBadge(c.mlDecile)}</td>
      <td style="color:var(--text-dim); font-size:0.85rem;">${c.milestone.q}</td>
      <td class="num-cell ${c.milestone.p >= 0.5 ? "pos" : "neg"}">${Math.round(c.milestone.p * 100)}%</td>
    </tr>
  `).join("");
}

const LIVEPX = {};
function renderAll() { renderThemes(); renderCompanies(); }
renderAll();

/* live quotes for scorecard companies (live-first, snapshot fallback; em-dash when neither) */
Promise.all(OO.companies.map(c =>
  ooLive("https://stockanalysis.com/api/quotes/s/" + c.ticker, "quotes." + c.ticker, { ttl: 120 })
    .then(({ data: d, source }) => {
      if (d && d.data && d.data.p != null) LIVEPX[c.ticker] = { p: d.data.p, cp: d.data.cp || 0 };
      return source;
    })
)).then(srcs => {
  const rank = { live: 0, cached: 1, snapshot: 2 };
  const worst = srcs.filter(Boolean).sort((a, b) => rank[b] - rank[a])[0];
  ooMarkSource("scoreCard", worst || null);
  renderCompanies();
});
document.addEventListener("oo:lang", renderAll);

/* ---- AI equity analyst over the scorecard ---- */
ooAnalyst("anRun", "anOut", "anStatus", () => ({
  system: "You are the equity analyst of Omni Oracle's trend-company module. Given research signals and live quotes, write 150-200 words: which names look mispriced relative to their signals (say why), which signal disagreements matter, and one caveat about acting on model ranks. No preamble, no markdown headers, no investment advice framing. Reply strictly in this language code: " + OO_LANG + ".",
  user: OO.companies.map(c => {
    const px = LIVEPX[c.ticker];
    return `${c.ticker} (${c.name}, ${c.theme}): innovation ${c.innov}, trend exposure ${c.trend}, ` +
      `text tone ${c.tone}, ML decile ${c.mlDecile}, milestone "${c.milestone.q}" ${Math.round(c.milestone.p * 100)}%` +
      (px ? `, live $${px.p} (${px.cp >= 0 ? "+" : ""}${px.cp.toFixed(2)}% today)` : "");
  }).join("\n"),
}));
