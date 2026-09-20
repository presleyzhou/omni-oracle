#!/usr/bin/env node
/* Guards data/live.json: it must parse and expose every field js/pages/*.js reads. */
import fs from "node:fs";
const snap = JSON.parse(fs.readFileSync(new URL("../data/live.json", import.meta.url), "utf8"));
const need = ["generated", "bea_gdp.series.docs.0.period", "bls.CUUR0000SA0.0.value", "bls.CUUR0000SA0L1E.0.value",
  "bls.LNS14000000.0.value", "worldbank.USA.gdp.1", "worldbank.CHN.cpi.1", "fx.rates.EUR", "treasury.data.0.avg_interest_rate_amt",
  "quotes.NVDA.data.p", "quotes.IONQ.data.p", "coingecko.bitcoin.usd", "polymarket.0.question",
  "treasury_curve.0.y10", "treasury_curve.0.m3", "vix.0.c"];
const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const missing = need.filter(p => get(snap, p) == null);
if (missing.length) { console.error("✗ snapshot missing: " + missing.join(", ")); process.exit(1); }
const age = (Date.now() - Date.parse(snap.generated)) / 864e5;
console.log(`✓ data/live.json OK (${need.length} fields, generated ${snap.generated}, ${age.toFixed(1)} days old)`);
