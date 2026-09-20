#!/usr/bin/env node
/* Daily data snapshot for Omni Oracle.
   Fetches every upstream public API the site uses and writes data/live.json so
   the static site keeps working when an API is rate-limited, down, or closes
   its CORS policy. Run by .github/workflows/snapshot.yml (cron) or locally:
       node scripts/snapshot.mjs
   A field that fails to refresh keeps its previous value, so one upstream
   outage never blanks the site. Shapes mirror the live responses the front
   end already parses (see js/pages/*.js); BLS is stored as bare row arrays. */
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

dns.setDefaultResultOrder("ipv4first"); // some sandboxes have broken IPv6 egress
const execFileP = promisify(execFile);

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "live.json");
const UA = "omni-oracle-snapshot (+https://github.com/presleyzhou/omni-oracle)";

const TICKERS = ["NVDA", "MSFT", "AAPL", "GOOGL", "META", "MU",
  "AVGO", "VRT", "LLY", "NVO", "TSLA", "ISRG", "GEV", "CEG", "RKLB", "IONQ"];
const WB_ISO = ["USA", "CHN", "EUU", "JPN"];
const WB_IND = { gdp: "NY.GDP.MKTP.KD.ZG", cpi: "FP.CPI.TOTL.ZG" };
const WB_TO = new Date().getFullYear() - 1, WB_FROM = WB_TO - 4;

let prev = {};
try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) {}
const out = { generated: new Date().toISOString() };
const log = [];

/* fetch with retries; falls back to curl because a few hosts (notably BLS)
   reject Node's TLS/HTTP fingerprint with 403 while accepting curl */
async function getJson(url, init = {}, attempt = 1) {
  try {
    const res = await fetch(url, { ...init, headers: { "user-agent": UA, accept: "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(20000) });
    if (res.status === 403) return curlJson(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (attempt < 3) { await new Promise(r => setTimeout(r, 1500 * attempt)); return getJson(url, init, attempt + 1); }
    return curlJson(url, init);
  }
}
async function curlJson(url, init = {}) {
  const args = ["-sS", "--fail", "--max-time", "30", "-A", UA, "-H", "accept: application/json"];
  if (init.method === "POST") args.push("-X", "POST", "-H", "content-type: application/json", "--data", init.body);
  args.push(url);
  const { stdout } = await execFileP("curl", args, { maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout);
}
/* run a fetcher; on failure fall back to the previous snapshot's value */
async function field(key, fn) {
  try {
    const v = await fn();
    if (v == null) throw new Error("empty");
    setPath(out, key, v); log.push(`✓ ${key}`);
  } catch (e) {
    const old = getPath(prev, key);
    if (old != null) { setPath(out, key, old); log.push(`↺ ${key} (kept previous: ${e.message})`); }
    else log.push(`✗ ${key} (${e.message})`);
  }
}
const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split("."); let cur = o;
  ks.slice(0, -1).forEach(k => { cur = cur[k] = cur[k] || {}; });
  cur[ks[ks.length - 1]] = v;
}


/* --- crisis-warning inputs --------------------------------------------------- */
const csvRows = (txt) => txt.trim().split(/\r?\n/).map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
const iso = (mdy) => { const [m, d, y] = mdy.split("/"); return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; };
async function getText(url) {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    const { stdout } = await execFileP("curl", ["-sSL", "--fail", "--max-time", "40", "-A", UA, url], { maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  }
}
/* US Treasury daily par yield curve, this year + last year → [{d, m3, y2, y10}] ascending */
async function treasuryCurve() {
  const y = new Date().getFullYear();
  const rows = [];
  for (const yr of [y - 1, y]) {
    const txt = await getText(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${yr}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${yr}&page&_format=csv`);
    const [head, ...body] = csvRows(txt);
    const ix = (name) => head.indexOf(name);
    const iD = ix("Date"), i3 = ix("3 Mo"), i2 = ix("2 Yr"), i10 = ix("10 Yr");
    if (iD < 0 || i3 < 0 || i10 < 0) throw new Error("unexpected Treasury CSV header");
    body.forEach(r => { if (r[iD] && r[i3] && r[i10]) rows.push({ d: iso(r[iD]), m3: +r[i3], y2: +r[i2], y10: +r[i10] }); });
  }
  rows.sort((a, b) => a.d < b.d ? -1 : 1);
  return rows.length > 100 ? rows.slice(-520) : null;
}
/* CBOE VIX daily history → [{d, c}] ascending (close) */
async function vixHistory() {
  const txt = await getText("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv");
  const [head, ...body] = csvRows(txt);
  const iD = head.findIndex(h => /date/i.test(h)), iC = head.findIndex(h => /close/i.test(h));
  if (iD < 0 || iC < 0) throw new Error("unexpected VIX CSV header");
  const rows = body.filter(r => r[iD] && r[iC]).map(r => ({ d: iso(r[iD]), c: +(+r[iC]).toFixed(2) }));
  return rows.length > 100 ? rows.slice(-520) : null;
}
/* Moody's Baa − 10Y Treasury spread (FRED BAA10Y, daily, pp) → [{d, v}].
   Needs a free FRED API key in FRED_API_KEY (repository secret); without it the
   credit-spread row on the macro page shows n/a and is excluded from the composite. */
async function baaSpread() {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set — credit spread skipped");
  const from = new Date(); from.setFullYear(from.getFullYear() - 2);
  const d = await getJson(`https://api.stlouisfed.org/fred/series/observations?series_id=BAA10Y&api_key=${key}&file_type=json&observation_start=${from.toISOString().slice(0, 10)}`);
  const rows = (d.observations || []).filter(o => o.value !== ".").map(o => ({ d: o.date, v: +o.value }));
  return rows.length ? rows.slice(-520) : null;
}

const TASKS = [
  /* BEA real GDP growth via DBnomics — trimmed to the two arrays the site reads */
  () => field("bea_gdp", async () => {
    const d = await getJson("https://api.db.nomics.world/v22/series/BEA/NIPA-T10101/A191RL-Q?observations=1");
    const doc = d?.series?.docs?.[0];
    return doc ? { series: { docs: [{ period: doc.period, value: doc.value }] } } : null;
  }),
  /* BLS — one POST for all three series (browsers can't: the endpoint has no CORS preflight) */
  () => field("bls", async () => {
    const d = await getJson("https://api.bls.gov/publicAPI/v1/timeseries/data/", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ seriesid: ["CUUR0000SA0", "CUUR0000SA0L1E", "LNS14000000"] }),
    });
    if (d.status !== "REQUEST_SUCCEEDED") throw new Error(d.message?.join("; ") || d.status);
    const o = {};
    d.Results.series.forEach(s => { o[s.seriesID] = s.data.map(({ year, period, periodName, value }) => ({ year, period, periodName, value })); });
    return Object.keys(o).length === 3 ? o : null;
  }),
  ...WB_ISO.flatMap(iso => Object.entries(WB_IND).map(([slot, ind]) =>
    () => field(`worldbank.${iso}.${slot}`, () =>
      getJson(`https://api.worldbank.org/v2/country/${iso}/indicator/${ind}?format=json&per_page=8&date=${WB_FROM}:${WB_TO}`)
        .then(d => Array.isArray(d) && d[1] ? [d[0], d[1].map(({ date, value }) => ({ date, value }))] : null)))),
  () => field("fx", () => getJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,CNY,JPY,GBP")),
  () => field("treasury", () => getJson("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?filter=security_desc:in:(Treasury%20Bills,Treasury%20Notes,Treasury%20Bonds)&sort=-record_date&page%5Bsize%5D=3")
    .then(d => d?.data ? { data: d.data } : null)),
  ...TICKERS.map(t => () => field(`quotes.${t}`, () => getJson("https://stockanalysis.com/api/quotes/s/" + t)
    .then(d => d?.data?.p != null ? { data: { p: d.data.p, cp: d.data.cp ?? 0 } } : null))),
  () => field("treasury_curve", treasuryCurve),
  () => field("vix", vixHistory),
  () => field("baa_spread", baaSpread),
  () => field("coingecko", () => getJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true")),
  () => field("polymarket", () => getJson("https://gamma-api.polymarket.com/markets?limit=6&active=true&closed=false&order=volume24hr&ascending=false")
    .then(d => Array.isArray(d) ? d.map(({ question, slug, volume24hr, outcomePrices, outcomes }) => ({ question, slug, volume24hr, outcomePrices, outcomes })) : null)),
];
for (let i = 0; i < TASKS.length; i += 4) await Promise.all(TASKS.slice(i, i + 4).map(t => t()));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(log.sort().join("\n"));
console.log(`\nwrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
if (log.every(l => l.startsWith("✗"))) process.exit(1);
