#!/usr/bin/env node
/* Validates public forecast records in data/ai-forecasts/*.json (run by CI on every push/PR).
   A record is the unmodified export of the tournament page: { exported, my, ai }.
   Checks: parseable, ≤ 2 MB, arrays of objects with sane fields, no forecast dated in the
   future, probabilities in range, and — when the ledger knows the question — no forecast
   committed after resolution (those would never be graded, but a file full of them is a
   sign of tampering worth rejecting in review). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "data", "ai-forecasts");
let problems = 0, files = 0, forecasts = 0;
const fail = (m) => { problems++; console.error("✗ " + m); };
let bySlug = {};
try { JSON.parse(fs.readFileSync(path.join(ROOT, "data", "questions.json"), "utf8")).questions.forEach(q => { bySlug[q.slug] = q; }); } catch (e) {}
const now = Date.now() + 36e5;
for (const f of fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(x => x.endsWith(".json")) : []) {
  files++;
  const p = path.join(DIR, f);
  if (!/^[a-z0-9._-]+\.json$/i.test(f)) fail(`${f}: file name must be <handle>.json (letters, digits, . _ -)`);
  if (fs.statSync(p).size > 2 * 1024 * 1024) fail(`${f}: larger than 2 MB`);
  let rec; try { rec = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { fail(`${f}: not valid JSON`); continue; }
  if (!rec || typeof rec !== "object" || !Array.isArray(rec.my) || !Array.isArray(rec.ai)) { fail(`${f}: expected { exported, my: [], ai: [] }`); continue; }
  let late = 0;
  const check = (x, kind, i) => {
    forecasts++;
    if (!x || typeof x !== "object") return fail(`${f}: ${kind}[${i}] is not an object`);
    if (!x.slug) return; // demo-market entries are allowed and ignored by the grader
    const p = kind === "my" ? x.p / 100 : x.p;
    if (!(p >= 0 && p <= 1)) fail(`${f}: ${kind}[${i}] probability out of range`);
    if (!(x.marketP >= 0 && x.marketP <= 1)) fail(`${f}: ${kind}[${i}] marketP out of range`);
    if (!x.at || !Number.isFinite(Date.parse(x.at))) return fail(`${f}: ${kind}[${i}] missing timestamp`);
    if (Date.parse(x.at) > now) fail(`${f}: ${kind}[${i}] is dated in the future (${x.at})`);
    const q = bySlug[x.slug];
    if (q && q.resolvedAt && Date.parse(x.at) >= Date.parse(q.resolvedAt)) late++;
    if (kind === "ai" && !x.model) fail(`${f}: ai[${i}] has no model id`);
  };
  rec.my.forEach((x, i) => check(x, "my", i)); rec.ai.forEach((x, i) => check(x, "ai", i));
  if (late) console.warn(`⚠ ${f}: ${late} forecast(s) committed after resolution (ignored by the grader)`);
}
console.log(`✓ public records: ${files} file(s), ${forecasts} forecast(s) checked`);
if (problems) { console.error(`${problems} problem(s)`); process.exit(1); }
