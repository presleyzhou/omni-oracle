/* Omni Oracle — shared UI helpers */

/* PWA: register service worker (offline support) */
if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* Highlight active nav link */
(function () {
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    if (a.getAttribute("href") === page) a.classList.add("active");
  });
})();

/* Chart.js global defaults (only if Chart is loaded on this page) */
if (typeof Chart !== "undefined") {
  Chart.defaults.color = "#93a0b8";
  Chart.defaults.borderColor = "rgba(36,48,74,0.6)";
  Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.boxHeight = 12;
}

const OO_COLORS = {
  accent: "#4f8cff",
  purple: "#8b5cf6",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  dim: "#93a0b8",
};

/* LMSR (Hanson 2003): cost C(q) = b * ln(e^{q_yes/b} + e^{q_no/b}).
   Price of YES = e^{q_yes/b} / (e^{q_yes/b} + e^{q_no/b}).
   Given a current price p and liquidity b, buying `n` YES shares costs
   the integral of price along the way — computed in closed form. */
const LMSR = {
  b: 400,
  // shares of the chosen side needed to reach implied quantities from price p
  cost(p, side, n) {
    const b = this.b;
    // Represent state via q_yes - q_no = b * ln(p/(1-p))
    const d0 = b * Math.log(p / (1 - p));
    const qY0 = d0 / 2, qN0 = -d0 / 2;
    const C = (qy, qn) => b * Math.log(Math.exp(qy / b) + Math.exp(qn / b));
    const qY1 = side === "yes" ? qY0 + n : qY0;
    const qN1 = side === "no" ? qN0 + n : qN0;
    return C(qY1, qN1) - C(qY0, qN0);
  },
  newPrice(p, side, n) {
    const b = this.b;
    const d0 = b * Math.log(p / (1 - p));
    const d1 = side === "yes" ? d0 + n : d0 - n;
    return 1 / (1 + Math.exp(-d1 / b));
  },
};

/* Count-up animation for .stat .num values (respects reduced motion) */
window.addEventListener("load", () => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll(".stat .num").forEach((el) => {
    const m = el.textContent.match(/^(-?)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    const target = parseFloat(m[2].replace(/,/g, ""));
    if (!isFinite(target) || target === 0) return;
    const dec = (m[2].split(".")[1] || "").length;
    const grouped = m[2].includes(",");
    const sign = m[1], suffix = m[3];
    const fmt = (v) => grouped ? Math.round(v).toLocaleString("en-US") : v.toFixed(dec);
    const t0 = performance.now(), dur = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = sign + fmt(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
});

/* ---------- Resilient fetch: timeout + session cache + stale fallback ----------
   OO_FETCH(url, {ttl, timeout}) resolves to parsed JSON or null — it never throws.
   Fresh responses are kept in sessionStorage for `ttl` seconds so repeated page
   loads don't hammer rate-limited public APIs (CoinGecko, BLS…). When the network
   fails, the last cached copy is served even if stale.
   OO_FETCH.source(url) tells how the last call was satisfied: "live" | "cached" | null. */
const OO_FETCH = Object.assign(async function (url, { ttl = 300, timeout = 8000, init } = {}) {
  const k = "oo-fetch:" + url;
  let hit = null;
  try { hit = JSON.parse(sessionStorage.getItem(k)); } catch (e) {}
  if (hit && Date.now() - hit.t < ttl * 1000) { OO_FETCH._src[url] = "live"; return hit.d; }
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
    OO_FETCH._src[url] = "live";
    return d;
  } catch (e) {
    if (hit) { OO_FETCH._src[url] = "cached"; return hit.d; }
    OO_FETCH._src[url] = null;
    return null;
  }
}, { _src: {}, source(url) { return this._src[url] || null; } });

/* ---------- Daily snapshot (data/live.json, written by .github/workflows/snapshot.yml) ----------
   The GitHub Action fetches every upstream API once a day and commits the raw
   responses, so the site keeps working when a public API is rate-limited, down,
   or closes its CORS policy. Slow-moving official series (BEA, BLS, World Bank)
   are read from the snapshot first; prices are fetched live with the snapshot
   as fallback. */
const OO_SNAPSHOT = {
  _p: null,
  load() {
    return this._p || (this._p = fetch("data/live.json", { signal: AbortSignal.timeout(6000) })
      .then(r => r.ok ? r.json() : null).catch(() => null));
  },
  async get(path) {
    const snap = await this.load();
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), snap);
  },
  async date() {
    const snap = await this.load();
    return snap && snap.generated ? snap.generated.slice(0, 10) : "";
  },
};

/* Live-first with snapshot fallback → { data, source } */
async function ooLive(url, snapPath, opts) {
  const d = await OO_FETCH(url, opts);
  if (d != null) return { data: d, source: OO_FETCH.source(url) };
  const s = snapPath ? await OO_SNAPSHOT.get(snapPath) : null;
  return { data: s == null ? null : s, source: s == null ? null : "snapshot" };
}
/* Snapshot-first (official statistics), live only when the snapshot lacks the field */
async function ooSnap(snapPath, url, opts) {
  const s = await OO_SNAPSHOT.get(snapPath);
  if (s != null) return { data: s, source: "snapshot" };
  if (!url) return { data: null, source: null };
  const d = await OO_FETCH(url, opts);
  return { data: d, source: d == null ? null : OO_FETCH.source(url) };
}

/* Data-provenance badge (live / cached / snapshot / demo) on a card's heading */
async function ooMarkSource(hostId, source, when) {
  const host = document.getElementById(hostId);
  if (!host) return;
  if (source === "snapshot" && !when) when = await OO_SNAPSHOT.date();
  host.dataset.src = source || "demo";
  host.dataset.srcWhen = when || "";
  paintSourceBadge(host);
}
function paintSourceBadge(host) {
  const anchor = host.querySelector("[data-src-anchor], h3, h2") || host;
  let b = anchor.querySelector(":scope > .src-badge");
  if (!b) { b = document.createElement("span"); b.className = "src-badge"; anchor.appendChild(b); }
  const src = host.dataset.src || "demo";
  b.className = "src-badge src-" + src;
  b.textContent = OO_T("ds." + src) + (host.dataset.srcWhen ? " · " + host.dataset.srcWhen : "");
  b.title = OO_T("ds." + src + ".hint");
}
document.addEventListener("oo:lang", () => document.querySelectorAll("[data-src]").forEach(paintSourceBadge));

/* ---------- Model defaults for the BYOK LLM client ----------
   Override per browser via the 🔑 panel; the README lists these too. */
const OO_MODELS = {
  anthropic: { label: "Anthropic", model: "claude-sonnet-5", base: "https://api.anthropic.com" },
  openai:    { label: "OpenAI-compatible", model: "gpt-4o-mini", base: "https://api.openai.com/v1" },
};

/* ---------- Shared LLM client (uses the keys set via the nav 🔑 panel) ---------- */
const OO_LLM = {
  get key() { return localStorage.getItem("oo-llm-key") || ""; },
  get provider() { return OO_MODELS[localStorage.getItem("oo-llm-provider")] ? localStorage.getItem("oo-llm-provider") : "anthropic"; },
  get base() { return localStorage.getItem("oo-llm-base") || OO_MODELS.openai.base; },
  get model() { return localStorage.getItem("oo-llm-model") || OO_MODELS[this.provider].model; },
  async ask(system, user, maxTokens = 500) {
    if (this.provider === "openai") {
      const res = await fetch(this.base.replace(/\/+$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + this.key },
        body: JSON.stringify({
          model: this.model, max_tokens: maxTokens,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(res.status + " " + (await res.text()).slice(0, 120));
      return ((await res.json()).choices?.[0]?.message?.content || "").trim();
    }
    const res = await fetch(OO_MODELS.anthropic.base + "/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json", "x-api-key": this.key,
        "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.model, max_tokens: maxTokens, system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(res.status + " " + (await res.text()).slice(0, 120));
    return (await res.json()).content.map(b => b.text || "").join("").trim();
  },
};

/* Wire an "AI analyst" card: button + output box, guarded on key presence */
function ooAnalyst(btnId, outId, statusId, buildPrompt) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const out = document.getElementById(outId), st = document.getElementById(statusId);
    if (!OO_LLM.key) { st.textContent = "⚪ " + OO_T("tour.ai.nokey"); return; }
    st.textContent = "🤖 " + OO_T("ai.an.running");
    out.classList.remove("hide");
    out.textContent = "…";
    try {
      const { system, user } = buildPrompt();
      out.textContent = await OO_LLM.ask(system, user, 700);
      st.textContent = "✓ " + OO_LLM.model;
    } catch (err) {
      out.textContent = "⚠️ " + OO_T("sw.llm.err") + err.message;
      st.textContent = "";
    }
  });
}

/* ---------- Global LLM settings (🔑 in the nav, shared oo-llm-* storage) ----------
   Fires "oo:llm" on the document whenever the settings change, so pages can
   refresh their own status lines. ooOpenLlmSettings() opens the dialog. */
let ooOpenLlmSettings = () => {};
(function () {
  const nav = document.querySelector(".nav-inner");
  if (!nav || typeof OO_T === "undefined") return;
  const btn = document.createElement("button");
  btn.className = "llm-btn"; btn.id = "llmNavBtn";
  btn.setAttribute("aria-label", "LLM settings");
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  nav.appendChild(btn);
  const key = () => localStorage.getItem("oo-llm-key") || "";
  const paintBtn = () => { btn.innerHTML = "🔑" + (key() ? '<span class="dot"></span>' : ""); };
  paintBtn();
  const changed = () => { paintBtn(); document.dispatchEvent(new CustomEvent("oo:llm")); };

  let overlay = null;
  function close() {
    if (!overlay) return;
    overlay.remove(); overlay = null;
    btn.setAttribute("aria-expanded", "false");
    btn.focus();
  }
  function open() {
    close();
    overlay = document.createElement("div");
    overlay.className = "llm-overlay";
    overlay.innerHTML = `<div class="llm-modal" role="dialog" aria-modal="true" aria-labelledby="glTitle">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 id="glTitle" style="font-size:1.05rem; font-weight:700;">${OO_T("sw.llm.title")}</h3>
        <button class="btn btn-ghost" id="glClose" style="padding:4px 12px;" aria-label="Close">✕</button>
      </div>
      <p style="font-size:0.8rem; color:var(--text-dim); margin-bottom:12px;">${OO_T("sw.llm.hint")}</p>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <select class="oo-input" id="glProvider" style="max-width:190px;" aria-label="Provider">
          ${Object.entries(OO_MODELS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
        </select>
        <input class="oo-input" id="glModel" autocomplete="off" aria-label="Model" />
      </div>
      <input class="oo-input hide" id="glBase" placeholder="${OO_MODELS.openai.base}" autocomplete="off" style="margin-bottom:8px;" aria-label="API base URL" />
      <input class="oo-input" id="glKey" type="password" placeholder="sk-…" autocomplete="off" aria-label="API key" />
      <div style="display:flex; gap:8px; margin-top:12px; align-items:center; flex-wrap:wrap;">
        <button class="btn btn-primary" id="glSave" style="padding:7px 16px; font-size:0.85rem;">${OO_T("sw.llm.save")}</button>
        <button class="btn btn-ghost" id="glClear" style="padding:7px 16px; font-size:0.85rem;">${OO_T("sw.llm.clear")}</button>
        <span id="glStatus" style="font-size:0.8rem;" aria-live="polite"></span>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    btn.setAttribute("aria-expanded", "true");
    const $ = (id) => document.getElementById(id);
    const refresh = () => {
      const on = !!key(), prov = OO_LLM.provider;
      $("glStatus").textContent = (on ? "🟢 " : "⚪ ") + OO_T(on ? "sw.llm.on" : "sw.llm.off");
      $("glStatus").style.color = on ? "var(--green)" : "var(--text-dim)";
      $("glProvider").value = prov;
      $("glModel").value = localStorage.getItem("oo-llm-model") || "";
      $("glModel").placeholder = OO_MODELS[prov].model;
      $("glBase").value = localStorage.getItem("oo-llm-base") || "";
      $("glBase").classList.toggle("hide", prov !== "openai");
      $("glKey").value = key();
      paintBtn();
    };
    refresh();
    $("glKey").focus();
    $("glProvider").addEventListener("change", () => {
      localStorage.setItem("oo-llm-provider", $("glProvider").value); refresh(); changed();
    });
    $("glSave").addEventListener("click", () => {
      const k = $("glKey").value.trim();
      if (k) localStorage.setItem("oo-llm-key", k);
      const m = $("glModel").value.trim();
      if (m) localStorage.setItem("oo-llm-model", m); else localStorage.removeItem("oo-llm-model");
      const b = $("glBase").value.trim();
      if (b) localStorage.setItem("oo-llm-base", b); else localStorage.removeItem("oo-llm-base");
      localStorage.setItem("oo-llm-provider", $("glProvider").value);
      refresh(); changed();
    });
    $("glClear").addEventListener("click", () => { localStorage.removeItem("oo-llm-key"); refresh(); changed(); });
    $("glClose").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  }
  ooOpenLlmSettings = open;
  btn.addEventListener("click", open);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();

function fmtUSD(x) {
  return "$" + x.toFixed(2);
}
function fmtPct(x, dp = 0) {
  return (100 * x).toFixed(dp) + "%";
}
