/* Omni Oracle — mock data layer.
   All numbers are illustrative demo data; in production these come from the
   nowcasting engine, signal pipeline, and market backend APIs. */

const OO = {};

/* ---------- Macro module (M1) ---------- */
OO.macro = {
  quarters: ["2024Q3","2024Q4","2025Q1","2025Q2","2025Q3","2025Q4","2026Q1","2026Q2"],
  gdpNowcast: [2.8, 2.4, 1.6, 2.1, 2.5, 2.2, 1.9, 2.3],
  gdpSPF:     [2.5, 2.2, 1.9, 2.0, 2.3, 2.1, 2.0, 2.1],
  gdpActual:  [3.1, 2.4, 1.4, 2.2, 2.6, 2.0, 1.8, null],
  gdpTSFM:    [2.6, 2.3, 1.7, 2.0, 2.4, 2.1, 2.0, 2.2],

  months: ["Jul 25","Aug 25","Sep 25","Oct 25","Nov 25","Dec 25","Jan 26","Feb 26","Mar 26","Apr 26","May 26","Jun 26"],
  cpiYoY:   [2.9, 2.8, 2.6, 2.7, 2.5, 2.4, 2.6, 2.5, 2.3, 2.4, 2.2, 2.3],
  coreYoY:  [3.2, 3.1, 3.0, 3.0, 2.9, 2.8, 2.9, 2.8, 2.7, 2.6, 2.6, 2.5],

  recessionProb12m: 0.23,

  fedMeeting: "July 29, 2026 FOMC",
  fedProbs: [
    { move: "-50 bps", model: 0.04, market: 0.06 },
    { move: "-25 bps", model: 0.38, market: 0.44 },
    { move: "Hold",    model: 0.55, market: 0.47 },
    { move: "+25 bps", model: 0.03, market: 0.03 },
  ],

  newsDecomp: [
    { release: "Nonfarm Payrolls (Jun)", impact: +0.18 },
    { release: "ISM Manufacturing (Jun)", impact: -0.07 },
    { release: "Retail Sales (May)", impact: +0.11 },
    { release: "CPI (May)", impact: -0.04 },
    { release: "Housing Starts (May)", impact: -0.09 },
    { release: "Industrial Production (May)", impact: +0.05 },
  ],

  ensemble: [
    { source: "DFM nowcast", weight: 0.30 },
    { source: "Random forest", weight: 0.24 },
    { source: "TSFM (Chronos-2)", weight: 0.10 },
    { source: "BVAR scenario", weight: 0.12 },
    { source: "Crowd (tournament)", weight: 0.13 },
    { source: "Market prices (P3)", weight: 0.11 },
  ],
};

/* ---------- Trend companies module (M2) ---------- */
OO.themes = [
  { name: "AI Infrastructure", maturity: 72, firms: 48, ret12m: "+41%", desc: "Datacenter compute, networking, power and cooling for frontier-model training and inference." },
  { name: "GLP-1 & Metabolic Health", maturity: 64, firms: 22, ret12m: "+18%", desc: "Obesity and metabolic drugs, delivery platforms, and second-order consumer effects." },
  { name: "Humanoid & Industrial Robotics", maturity: 38, firms: 31, ret12m: "+27%", desc: "Actuators, perception stacks, and integrators bringing robots to logistics and manufacturing." },
  { name: "Grid & Energy Storage", maturity: 55, firms: 40, ret12m: "+22%", desc: "Transmission buildout, long-duration storage, and grid software driven by electrification and AI load." },
  { name: "Space Economy", maturity: 33, firms: 18, ret12m: "+15%", desc: "Launch, earth observation, and satellite communications constellations." },
  { name: "Quantum Computing", maturity: 21, firms: 12, ret12m: "-8%", desc: "Error-corrected qubit platforms, quantum networking, and enabling cryogenics." },
  { name: "Next-Gen Nuclear & Fusion", maturity: 26, firms: 15, ret12m: "+33%", desc: "SMRs, fuel supply chains, and private fusion approaching engineering milestones." },
  { name: "Autonomous Driving", maturity: 58, firms: 26, ret12m: "+19%", desc: "Robotaxi operations, sensor suites, and simulation/validation toolchains." },
];

OO.companies = [
  { ticker: "NVDA", name: "NVIDIA",             theme: "AI Infrastructure",       innov: 94, trend: 91, mlDecile: 9, tone: 78,  milestone: { q: "Blackwell-next volume ship by Q4 2026?", p: 0.81 } },
  { ticker: "AVGO", name: "Broadcom",           theme: "AI Infrastructure",       innov: 86, trend: 84, mlDecile: 9, tone: 66,  milestone: { q: "Custom ASIC rev > $40B FY2026?", p: 0.64 } },
  { ticker: "VRT",  name: "Vertiv",             theme: "AI Infrastructure",       innov: 71, trend: 88, mlDecile: 8, tone: 61,  milestone: { q: "Liquid-cooling rev doubles by 2027?", p: 0.58 } },
  { ticker: "LLY",  name: "Eli Lilly",          theme: "GLP-1 & Metabolic",       innov: 90, trend: 86, mlDecile: 8, tone: 72,  milestone: { q: "Oral GLP-1 approval by 2027?", p: 0.72 } },
  { ticker: "NVO",  name: "Novo Nordisk",       theme: "GLP-1 & Metabolic",       innov: 84, trend: 78, mlDecile: 6, tone: 38,  milestone: { q: "Next-gen obesity data readout beats CagriSema?", p: 0.44 } },
  { ticker: "TSLA", name: "Tesla",              theme: "Humanoid Robotics",       innov: 82, trend: 75, mlDecile: 5, tone: 45,  milestone: { q: "Optimus commercial deployment by 2027?", p: 0.37 } },
  { ticker: "ISRG", name: "Intuitive Surgical", theme: "Humanoid Robotics",       innov: 79, trend: 72, mlDecile: 7, tone: 58,  milestone: { q: "da Vinci 6 clearance by 2027?", p: 0.61 } },
  { ticker: "GEV",  name: "GE Vernova",         theme: "Grid & Energy Storage",   innov: 68, trend: 83, mlDecile: 8, tone: 70,  milestone: { q: "Grid backlog > $50B by 2027?", p: 0.66 } },
  { ticker: "CEG",  name: "Constellation",      theme: "Next-Gen Nuclear",        innov: 55, trend: 80, mlDecile: 7, tone: 74,  milestone: { q: "New nuclear PPA with hyperscaler in 2026?", p: 0.69 } },
  { ticker: "RKLB", name: "Rocket Lab",         theme: "Space Economy",           innov: 74, trend: 77, mlDecile: 6, tone: 55,  milestone: { q: "Neutron first launch by mid-2027?", p: 0.52 } },
  { ticker: "IONQ", name: "IonQ",               theme: "Quantum Computing",       innov: 70, trend: 58, mlDecile: 3, tone: 33,  milestone: { q: "Logical-qubit milestone by 2027?", p: 0.31 } },
  { ticker: "GOOGL",name: "Alphabet",           theme: "Autonomous Driving",      innov: 92, trend: 79, mlDecile: 7, tone: 64,  milestone: { q: "Waymo > 10 US metros by end-2026?", p: 0.57 } },
];

/* ---------- Prediction markets (P1–P8) ---------- */
OO.categories = [
  { id: "all",     label: "All" },
  { id: "politics",label: "Politics & Elections" },
  { id: "crypto",  label: "Crypto" },
  { id: "econ",    label: "Econ Data & Fed" },
  { id: "geo",     label: "Geopolitics" },
  { id: "sports",  label: "Sports" },
  { id: "ent",     label: "Awards & Entertainment" },
  { id: "tech",    label: "Tech & AI Milestones" },
  { id: "news",    label: "Current Events" },
];

OO.markets = [
  { cat: "politics", q: "Will the incumbent party keep the White House in 2028?", yes: 0.47, vol: "12.4M", close: "Nov 2028", res: "Official election results" },
  { cat: "politics", q: "Democrats win the House in the 2026 midterms?", yes: 0.58, vol: "8.9M", close: "Nov 2026", res: "AP race calls" },
  { cat: "politics", q: "UK general election held before 2028?", yes: 0.24, vol: "1.1M", close: "Dec 2027", res: "Official announcement" },
  { cat: "crypto",   q: "BTC above $150K on Dec 31, 2026?", yes: 0.36, vol: "22.7M", close: "Dec 2026", res: "Medianized exchange price feed" },
  { cat: "crypto",   q: "ETH above $6K at any point in 2026?", yes: 0.51, vol: "9.3M", close: "Dec 2026", res: "Medianized exchange price feed" },
  { cat: "crypto",   q: "Spot SOL ETF net inflows > $5B in first year?", yes: 0.42, vol: "3.8M", close: "Jul 2027", res: "Issuer flow reports" },
  { cat: "econ",     q: "Fed cuts rates at the July 2026 FOMC?", yes: 0.50, vol: "15.2M", close: "Jul 29 2026", res: "FOMC statement" },
  { cat: "econ",     q: "US CPI YoY below 2.5% for June 2026 print?", yes: 0.63, vol: "6.1M", close: "Jul 15 2026", res: "BLS release" },
  { cat: "econ",     q: "US recession (NBER-dated) beginning in 2026?", yes: 0.19, vol: "4.4M", close: "Dec 2026", res: "NBER dating committee" },
  { cat: "geo",      q: "New major-power ceasefire agreement signed in 2026?", yes: 0.33, vol: "5.6M", close: "Dec 2026", res: "Documented signed agreement" },
  { cat: "geo",      q: "OPEC+ announces production increase before Q4 2026?", yes: 0.46, vol: "2.2M", close: "Oct 2026", res: "Official OPEC communiqué" },
  { cat: "sports",   q: "Will the AFC team win Super Bowl LXI?", yes: 0.52, vol: "18.9M", close: "Feb 2027", res: "League result" },
  { cat: "sports",   q: "A European club wins the 2026 FIFA Club World Cup?", yes: 0.71, vol: "7.7M", close: "Jul 2026", res: "FIFA result" },
  { cat: "ent",      q: "A sequel tops the 2026 worldwide box office?", yes: 0.66, vol: "1.9M", close: "Jan 2027", res: "Box Office Mojo full-year chart" },
  { cat: "ent",      q: "Best Picture 2027 goes to a streaming-first film?", yes: 0.29, vol: "1.3M", close: "Mar 2027", res: "Academy announcement" },
  { cat: "tech",     q: "Frontier lab announces >90% on SWE-bench Verified by end-2026?", yes: 0.60, vol: "4.9M", close: "Dec 2026", res: "Official benchmark report" },
  { cat: "tech",     q: "Apple ships a foldable device by end of 2026?", yes: 0.41, vol: "3.5M", close: "Dec 2026", res: "Product availability" },
  { cat: "tech",     q: "FDA approves an AI-discovered drug (NME) by 2027?", yes: 0.34, vol: "2.0M", close: "Dec 2027", res: "FDA approval letter" },
  { cat: "news",     q: "A new all-time global temperature record set in 2026?", yes: 0.55, vol: "1.6M", close: "Jan 2027", res: "NASA GISS / NOAA datasets" },
  { cat: "news",     q: "Time Person of the Year 2026 is an AI-related figure?", yes: 0.27, vol: "0.8M", close: "Dec 2026", res: "TIME announcement" },
];

/* ---------- Tournament (C1) ---------- */
OO.leaderboard = [
  { rank: 1, user: "bayes_owl",     forecasts: 412, brier: 0.118, cal: 0.97, streak: "Superforecaster" },
  { rank: 2, user: "meanreversion", forecasts: 287, brier: 0.126, cal: 0.95, streak: "Superforecaster" },
  { rank: 3, user: "fedwatcher_88", forecasts: 356, brier: 0.131, cal: 0.94, streak: "Superforecaster" },
  { rank: 4, user: "kalman_gain",   forecasts: 198, brier: 0.139, cal: 0.93, streak: "Top 1%" },
  { rank: 5, user: "priorart",      forecasts: 243, brier: 0.142, cal: 0.91, streak: "Top 1%" },
  { rank: 6, user: "macro_menace",  forecasts: 175, brier: 0.148, cal: 0.92, streak: "Top 5%" },
  { rank: 7, user: "tail_hedger",   forecasts: 164, brier: 0.153, cal: 0.89, streak: "Top 5%" },
  { rank: 8, user: "signalnotnoise",forecasts: 221, brier: 0.157, cal: 0.90, streak: "Top 5%" },
];

OO.calibration = {
  bins: [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95],
  crowd:  [0.06, 0.14, 0.24, 0.33, 0.46, 0.57, 0.66, 0.77, 0.86, 0.94],
  supers: [0.05, 0.15, 0.25, 0.36, 0.45, 0.55, 0.64, 0.75, 0.85, 0.95],
};

OO.brierBySource = [
  { source: "Superforecasters (aggregated + extremized)", brier: 0.121 },
  { source: "Ensemble engine (models+crowd+markets)", brier: 0.124 },
  { source: "Market prices (internal CLOB)", brier: 0.133 },
  { source: "LLM crowd (5 models)", brier: 0.146 },
  { source: "All-crowd average", brier: 0.158 },
  { source: "Frontier LLM (single)", brier: 0.166 },
  { source: "Naive base-rate baseline", brier: 0.214 },
];

/* AI forecaster bench (demo data; literature anchor: best single LLM Brier
   ~0.101 vs human superforecasters ~0.081 on real geopolitical questions) */
OO.aiBench = [
  { model: "claude-sonnet-5",      cutoff: "2025-03", forecasts: 120, brier: 0.152 },
  { model: "gpt-4.5",              cutoff: "2024-10", forecasts: 120, brier: 0.166 },
  { model: "gemini-2.5-pro",       cutoff: "2025-01", forecasts: 120, brier: 0.171 },
  { model: "LLM crowd (5 models)", cutoff: "—",       forecasts: 120, brier: 0.146 },
];
