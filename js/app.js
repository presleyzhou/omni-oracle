/* Omni Oracle — shared UI helpers */

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

function fmtUSD(x) {
  return "$" + x.toFixed(2);
}
function fmtPct(x, dp = 0) {
  return (100 * x).toFixed(dp) + "%";
}
