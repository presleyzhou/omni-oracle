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

/* --- contamination-safe question ledger (data/questions.json) -------------------
   Every run appends newly created Polymarket binary markets (liquid, non-sports,
   resolving within ~120 days) and refreshes the status of open ledger entries.
   The tournament page scores AI forecasters only on questions created after the
   model's knowledge cutoff and grades them once the market resolves — the
   evaluation discipline of ForecastBench / Agentic Time Machine (arXiv 2606.21013). */
const LEDGER = path.join(ROOT, "data", "questions.json");
const SPORTS = /\b(nhl|nba|mlb|nfl|ncaa|ufc|mls|epl|la liga|serie a|bundesliga|atp|wta|f1|grand prix|o\/u|spread|moneyline|vs\.)\b/i;
async function questionLedger() {
  let ledger = { updated: null, questions: [] };
  try { ledger = JSON.parse(fs.readFileSync(LEDGER, "utf8")); } catch (e) {}
  const known = new Set(ledger.questions.map(q => q.slug));
  const today = new Date();
  /* 1. new candidates */
  /* the newest markets are mostly sports lines; take liquid ones by volume and
     liquidity and keep those created in the last 45 days */
  const lists = await Promise.all([
    getJson("https://gamma-api.polymarket.com/markets?limit=300&closed=false&active=true&order=volume24hr&ascending=false"),
    getJson("https://gamma-api.polymarket.com/markets?limit=300&closed=false&active=true&order=liquidity&ascending=false"),
  ]);
  const seen = new Set();
  const fresh = lists.flat().filter(m => m && !seen.has(m.slug) && seen.add(m.slug))
    .filter(m => (today - Date.parse(m.createdAt)) / 864e5 <= 60)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const added = [];
  for (const m of fresh) {
    let outcomes = [], prices = [];
    try { outcomes = JSON.parse(m.outcomes); prices = JSON.parse(m.outcomePrices).map(Number); } catch (e) { continue; }
    const binary = outcomes.length === 2 && /^yes$/i.test(outcomes[0]) && /^no$/i.test(outcomes[1]);
    const liquid = (+m.liquidity || 0) >= 500 || (+m.volume24hr || 0) >= 500;
    const informative = prices[0] > 0.03 && prices[0] < 0.97; // skip near-certain markets
    const days = (Date.parse(m.endDate) - today) / 864e5;
    if (!binary || !liquid || !informative || known.has(m.slug) || SPORTS.test(m.question + " " + m.slug) || !(days > 1 && days < 180)) continue;
    added.push({ slug: m.slug, id: m.id, question: m.question, createdAt: m.createdAt, endDate: m.endDate,
      capturedAt: today.toISOString(), priceAtCapture: prices[0], price: prices[0], closed: false, resolved: null });
    if (added.length >= 20) break;
  }
  /* 2. refresh open entries (price, closed, resolution) */
  const open = ledger.questions.filter(q => !q.closed);
  for (let i = 0; i < open.length; i += 4) {
    await Promise.all(open.slice(i, i + 4).map(async (q) => {
      try {
        const r = await getJson(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(q.slug)}`);
        const m = Array.isArray(r) ? r[0] : r;
        if (!m) return;
        const prices = JSON.parse(m.outcomePrices).map(Number);
        q.price = prices[0]; q.closed = !!m.closed;
        if (m.closed && (m.umaResolutionStatus === "resolved" || prices[0] === 1 || prices[0] === 0)) {
          q.resolved = prices[0] >= 0.5 ? 1 : 0; q.resolvedAt = m.closedTime || today.toISOString();
        }
      } catch (e) { /* keep previous state */ }
    }));
  }
  /* 3. bound the ledger: keep resolved entries ≤ 180 days, open entries ≤ 500 */
  const cutoff = Date.now() - 180 * 864e5;
  ledger.questions = ledger.questions.concat(added)
    .filter(q => !q.resolvedAt || Date.parse(q.resolvedAt) > cutoff).slice(-500);
  ledger.updated = today.toISOString();
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + "\n");
  log.push(`✓ questions ledger: +${added.length} new, ${ledger.questions.filter(q => q.resolved != null).length} resolved, ${ledger.questions.length} total`);
}

/* FRED "initial release only" vintages (output_type=4) vs latest — shows how much the
   first print differs from today's revised number (optional, needs FRED_API_KEY). */
async function fredVintage(series) {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set — vintages skipped");
  const from = new Date(); from.setFullYear(from.getFullYear() - 4);
  const base = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${key}&file_type=json&observation_start=${from.toISOString().slice(0, 10)}`;
  const [init, latest] = await Promise.all([getJson(base + "&output_type=4"), getJson(base)]);
  const rows = (d) => (d.observations || []).filter(o => o.value !== ".").map(o => ({ d: o.date, v: +o.value }));
  const out = { initial: rows(init), latest: rows(latest) };
  return out.initial.length && out.latest.length ? out : null;
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
    d.Results.series.forEach(s => { o[s.seriesID] = s.data.map(({ year, period, periodName, value, footnotes }) => {
      const notes = (footnotes || []).filter(f => f && f.text).map(f => f.text);
      return notes.length ? { year, period, periodName, value, notes } : { year, period, periodName, value };
    }); });
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
  () => field("vintage.gdp", () => fredVintage("A191RL1Q225SBEA")),
  () => field("vintage.unemp", () => fredVintage("UNRATE")),
  () => field("coingecko", () => getJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true")),
  () => field("polymarket", () => getJson("https://gamma-api.polymarket.com/markets?limit=6&active=true&closed=false&order=volume24hr&ascending=false")
    .then(d => Array.isArray(d) ? d.map(({ question, slug, volume24hr, outcomePrices, outcomes }) => ({ question, slug, volume24hr, outcomePrices, outcomes })) : null)),
];
for (let i = 0; i < TASKS.length; i += 4) await Promise.all(TASKS.slice(i, i + 4).map(t => t()));
try { await questionLedger(); } catch (e) { log.push(`✗ questions ledger (${e.message})`); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(log.sort().join("\n"));
console.log(`\nwrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
if (log.every(l => l.startsWith("✗"))) process.exit(1);
