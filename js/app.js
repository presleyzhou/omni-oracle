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

/* ---------- Global LLM settings (🔑 in the nav, shared oo-llm-* storage) ---------- */
(function () {
  const nav = document.querySelector(".nav-inner");
  if (!nav || typeof OO_T === "undefined") return;
  const btn = document.createElement("button");
  btn.className = "llm-btn"; btn.id = "llmNavBtn"; btn.setAttribute("aria-label", "LLM settings");
  nav.appendChild(btn);
  const key = () => localStorage.getItem("oo-llm-key") || "";
  const provider = () => localStorage.getItem("oo-llm-provider") || "anthropic";
  const paintBtn = () => { btn.innerHTML = "🔑" + (key() ? '<span class="dot"></span>' : ""); };
  paintBtn();

  let overlay = null;
  function close() { if (overlay) { overlay.remove(); overlay = null; } }
  function open() {
    close();
    overlay = document.createElement("div");
    overlay.className = "llm-overlay";
    overlay.innerHTML = `<div class="llm-modal">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="font-size:1.05rem; font-weight:700;">${OO_T("sw.llm.title")}</h3>
        <button class="btn btn-ghost" id="glClose" style="padding:4px 12px;">✕</button>
      </div>
      <p style="font-size:0.8rem; color:var(--text-dim); margin-bottom:12px;">${OO_T("sw.llm.hint")}</p>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <select class="oo-input" id="glProvider" style="max-width:190px;">
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI-compatible</option>
        </select>
        <input class="oo-input" id="glModel" autocomplete="off" />
      </div>
      <input class="oo-input hide" id="glBase" placeholder="https://api.openai.com/v1" autocomplete="off" style="margin-bottom:8px;" />
      <input class="oo-input" id="glKey" type="password" placeholder="sk-…" autocomplete="off" />
      <div style="display:flex; gap:8px; margin-top:12px; align-items:center; flex-wrap:wrap;">
        <button class="btn btn-primary" id="glSave" style="padding:7px 16px; font-size:0.85rem;">${OO_T("sw.llm.save")}</button>
        <button class="btn btn-ghost" id="glClear" style="padding:7px 16px; font-size:0.85rem;">${OO_T("sw.llm.clear")}</button>
        <span id="glStatus" style="font-size:0.8rem;"></span>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const $ = (id) => document.getElementById(id);
    const refresh = () => {
      const on = !!key();
      $("glStatus").textContent = (on ? "🟢 " : "⚪ ") + OO_T(on ? "sw.llm.on" : "sw.llm.off");
      $("glStatus").style.color = on ? "var(--green)" : "var(--text-dim)";
      $("glProvider").value = provider();
      $("glModel").value = localStorage.getItem("oo-llm-model") || "";
      $("glModel").placeholder = provider() === "openai" ? "gpt-4o-mini" : "claude-sonnet-5";
      $("glBase").value = localStorage.getItem("oo-llm-base") || "";
      $("glBase").classList.toggle("hide", provider() !== "openai");
      $("glKey").value = key();
      paintBtn();
    };
    refresh();
    $("glProvider").addEventListener("change", () => {
      localStorage.setItem("oo-llm-provider", $("glProvider").value); refresh();
    });
    $("glSave").addEventListener("click", () => {
      const k = $("glKey").value.trim();
      if (k) localStorage.setItem("oo-llm-key", k);
      const m = $("glModel").value.trim();
      if (m) localStorage.setItem("oo-llm-model", m); else localStorage.removeItem("oo-llm-model");
      const b = $("glBase").value.trim();
      if (b) localStorage.setItem("oo-llm-base", b); else localStorage.removeItem("oo-llm-base");
      localStorage.setItem("oo-llm-provider", $("glProvider").value);
      refresh();
    });
    $("glClear").addEventListener("click", () => { localStorage.removeItem("oo-llm-key"); refresh(); });
    $("glClose").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  }
  btn.addEventListener("click", open);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();

function fmtUSD(x) {
  return "$" + x.toFixed(2);
}
function fmtPct(x, dp = 0) {
  return (100 * x).toFixed(dp) + "%";
}
