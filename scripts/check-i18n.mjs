#!/usr/bin/env node
/* i18n consistency check (runs in CI).
   1. every language JSON has exactly the keys of the inline English dictionary;
   2. every data-i18n="…" in HTML and every literal OO_T("…") in JS exists in English. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/* extract the inline English dictionary without running the DOM-bound engine */
const src = rd("js/i18n.js");
const lit = src.slice(src.indexOf("const I18N = {"), src.indexOf("const OO_LANGS"));
const ctx = vm.createContext({});
vm.runInContext(lit + "; this.I18N = I18N;", ctx);
const en = ctx.I18N.en;
const enKeys = new Set(Object.keys(en));

let problems = 0;
const fail = (msg) => { problems++; console.error("✗ " + msg); };

for (const f of fs.readdirSync(path.join(ROOT, "i18n")).filter(f => f.endsWith(".json"))) {
  const dict = JSON.parse(rd("i18n/" + f));
  const keys = new Set(Object.keys(dict));
  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !enKeys.has(k));
  const empty = [...keys].filter(k => !String(dict[k]).trim());
  if (missing.length) fail(`${f}: missing ${missing.length} key(s): ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`);
  if (extra.length) fail(`${f}: ${extra.length} key(s) not in English: ${extra.slice(0, 8).join(", ")}`);
  if (empty.length) fail(`${f}: empty value for ${empty.join(", ")}`);
  if (!missing.length && !extra.length && !empty.length) console.log(`✓ ${f}: ${keys.size} keys`);
}

/* keys referenced from markup and page scripts */
const used = new Map();
const note = (k, where) => { if (!used.has(k)) used.set(k, where); };
for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith(".html"))) {
  for (const m of rd(f).matchAll(/data-i18n="([^"]+)"/g)) note(m[1], f);
}
const jsFiles = ["js/app.js", ...fs.readdirSync(path.join(ROOT, "js/pages")).map(f => "js/pages/" + f)];
for (const f of jsFiles) {
  for (const m of rd(f).matchAll(/OO_T\("([^"]+)"\)/g)) note(m[1], f);
}
/* dynamic prefixes built at runtime, e.g. OO_T("cat." + id) */
const DYNAMIC = ["cat.", "sort.", "ds.", "src."];
for (const [k, where] of used) {
  if (!enKeys.has(k) && !DYNAMIC.some(p => k.startsWith(p))) fail(`${where}: key "${k}" not in English dictionary`);
}
console.log(`✓ ${used.size} referenced keys checked against ${enKeys.size} English keys`);

if (problems) { console.error(`\n${problems} problem(s)`); process.exit(1); }
console.log("\ni18n OK");
