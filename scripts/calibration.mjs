#!/usr/bin/env node
/* Market calibration study on the question ledger → data/calibration.json.
   Motivated by the 2026 Polymarket calibration literature, which disagrees on whether a
   favorite–longshot bias exists (Cardozo & Rivero-Wildemauwe, arXiv 2609.12878: yes in
   aggregate, strongest in crypto and politics; Reichenbach & Walther, SSRN 7552098: no
   general bias, precision differs by category) and warns that treating correlated markets
   as independent manufactures significance (Gruener, SSRN 6863546) and that pooling domains
   hides differences (arXiv 2602.19520). So this study
     · fits a Platt recalibration  P(YES) = σ(a + b·logit(price))  — b > 1 means prices are
       under-confident (favorites under-priced, the favorite–longshot pattern), b < 1 over-confident;
     · tests it honestly, walk-forward: each question is recalibrated with a fit that only
       uses questions resolved before it was captured;
     · reports every interval with an event-clustered bootstrap (markets of one event move together);
     · adds the Murphy (1973) decomposition and per-topic slopes.
   Run standalone (`node scripts/calibration.mjs`) or from scripts/snapshot.mjs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { family } from "./ledger-rules.mjs";

const clip = (p) => Math.min(0.99, Math.max(0.01, p));
const logit = (p) => Math.log(p / (1 - p));
const sig = (z) => 1 / (1 + Math.exp(-z));
const brier = (p, y) => (p - y) * (p - y);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export const clusterOf = (q) => q.event || family(q.slug);

/* ridge-penalised logistic regression of outcome on logit(price), shrunk toward the identity
   map (a = 0, b = 1) so a handful of questions cannot produce a wild slope */
export function fitPlatt(xs, ys, lambda = 1) {
  let a = 0, b = 1;
  for (let it = 0; it < 50; it++) {
    let g0 = -lambda * a, g1 = -lambda * (b - 1), h00 = lambda, h01 = 0, h11 = lambda;
    for (let i = 0; i < xs.length; i++) {
      const p = sig(a + b * xs[i]), w = p * (1 - p);
      g0 += ys[i] - p; g1 += (ys[i] - p) * xs[i];
      h00 += w; h01 += w * xs[i]; h11 += w * xs[i] * xs[i];
    }
    const det = h00 * h11 - h01 * h01;
    if (!(det > 1e-12)) break;
    const da = (h11 * g0 - h01 * g1) / det, db = (h00 * g1 - h01 * g0) / det;
    a += da; b += db;
    if (Math.abs(da) + Math.abs(db) < 1e-9) break;
  }
  return { a, b };
}

/* 95% interval of a mean, resampling whole clusters; deterministic seed */
export function clusterBoot(values, keys, B = 1000) {
  const groups = new Map();
  values.forEach((v, i) => { const g = groups.get(keys[i]) || { s: 0, n: 0 }; g.s += v; g.n++; groups.set(keys[i], g); });
  const gs = [...groups.values()];
  if (gs.length < 10) return null;
  let seed = 987654321 + values.length;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out = [];
  for (let b = 0; b < B; b++) {
    let s = 0, n = 0;
    for (let j = 0; j < gs.length; j++) { const g = gs[(rnd() * gs.length) | 0]; s += g.s; n += g.n; }
    out.push(s / n);
  }
  out.sort((x, y) => x - y);
  return [out[Math.floor(0.025 * B)], out[Math.ceil(0.975 * B) - 1]];
}

export function calibrationStudy(ledger, { minTrain = 30 } = {}) {
  const res = ledger.questions.filter(q => q.resolved != null && q.resolvedAt)
    .sort((x, y) => Date.parse(x.resolvedAt) - Date.parse(y.resolvedAt));
  if (res.length < 40) return null;
  const x = res.map(q => logit(clip(q.priceAtCapture))), y = res.map(q => q.resolved);
  const keys = res.map(clusterOf);
  const r4 = (v) => +v.toFixed(4);

  /* Murphy decomposition over ten equal-width price bins */
  const ybar = mean(y); let rel = 0, resol = 0;
  for (let k = 0; k < 10; k++) {
    const idx = res.map((q, i) => i).filter(i => Math.min(9, Math.floor(res[i].priceAtCapture * 10)) === k);
    if (!idx.length) continue;
    const pk = mean(idx.map(i => res[i].priceAtCapture)), ok = mean(idx.map(i => y[i]));
    rel += idx.length * (pk - ok) ** 2 / res.length; resol += idx.length * (ok - ybar) ** 2 / res.length;
  }
  const errs = res.map((q, i) => brier(q.priceAtCapture, y[i]));

  /* in-sample fit, overall and per topic */
  const fit = fitPlatt(x, y);
  const byTopic = {};
  for (const t of new Set(res.map(q => q.topic || "other"))) {
    const idx = res.map((q, i) => i).filter(i => (res[i].topic || "other") === t);
    if (idx.length < 20) continue;
    const f = fitPlatt(idx.map(i => x[i]), idx.map(i => y[i]));
    byTopic[t] = { n: idx.length, a: r4(f.a), b: r4(f.b), brier: r4(mean(idx.map(i => errs[i]))) };
  }

  /* walk-forward: recalibrate question i with a fit on questions resolved before it was captured */
  const raw = [], rec = [], wkeys = [];
  res.forEach((q, i) => {
    const cap = Date.parse(q.capturedAt);
    const train = res.map((r, j) => j).filter(j => Date.parse(res[j].resolvedAt) < cap);
    if (train.length < minTrain) return;
    const f = fitPlatt(train.map(j => x[j]), train.map(j => y[j]));
    raw.push(errs[i]); rec.push(brier(sig(f.a + f.b * x[i]), y[i])); wkeys.push(keys[i]);
  });
  const diff = rec.map((v, i) => v - raw[i]);
  const walk = raw.length >= 20
    ? { n: raw.length, minTrain, raw: r4(mean(raw)), recal: r4(mean(rec)), diff: r4(mean(diff)), ci: (clusterBoot(diff, wkeys) || []).map(r4) }
    : { n: raw.length, minTrain };

  return {
    generated: new Date().toISOString(), n: res.length, clusters: new Set(keys).size,
    market: { brier: r4(mean(errs)), ci: (clusterBoot(errs, keys) || []).map(r4) },
    murphy: { reliability: r4(rel), resolution: r4(resol), uncertainty: r4(ybar * (1 - ybar)) },
    fit: { a: r4(fit.a), b: r4(fit.b) }, byTopic, walk,
  };
}

/* standalone */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const out = calibrationStudy(JSON.parse(fs.readFileSync(path.join(ROOT, "data", "questions.json"), "utf8")));
  if (!out) { console.log("not enough resolved questions for a calibration study"); process.exit(0); }
  fs.writeFileSync(path.join(ROOT, "data", "calibration.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
