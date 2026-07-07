# Research Updates & Improvement Roadmap (2026-07)

Latest literature (2025–2026) relevant to each Omni Oracle module, and the concrete
improvements it suggests. Companion to [DESIGN.md](DESIGN.md).

---

## 1. LLM forecasting is approaching superforecaster level → C1/C2

**Findings**
- Best frontier models score Brier ≈ 0.101 vs. human superforecasters ≈ 0.081 on real
  geopolitical questions (arXiv 2507.04562); naive extrapolation puts parity before ~May 2027
  (ForecastBench tracking).
- *Crowds of LLMs* sometimes already match human superforecaster aggregates
  ("wisdom of the silicon crowd"); diverse-model ensembles beat single models
  (accuracy–correlation effect, Phil. Trans. R. Soc. B 2026).
- Human+LLM hybrids: superforecasting-principled LLM assistants improve human accuracy 23–43%.
- Specialized fine-tuning works: Mantic/Thinking Machines train LLMs specifically to predict
  world events with RL on resolved questions.

**Improvements**
- **C1+: add an "AI forecaster bench"** — a panel of LLM forecasters (different models/providers,
  BYOK) that answer the same tournament questions; show their Brier scores on the leaderboard
  next to humans. The ensemble engine (C2) then combines humans + models + markets with
  out-of-sample weights, exactly as the accuracy–correlation literature prescribes.
- **Forecast assistant**: in the tournament UI, an optional LLM "commandments coach"
  (base rates, reference classes, scope sensitivity) shown before a user submits — the
  documented +23–43% intervention.
- Track platform-level Brier of humans vs. AI vs. ensemble over time as a public chart
  (credibility flywheel).

## 2. Large-scale LLM agent societies → M3

**Findings**
- **AgentSociety** (arXiv 2502.08691): 10k+ LLM agents, 5M interactions, realistic urban/social
  environment — validated on polarization, information spread, policy experiments.
- **OASIS / GenSim / AgentScope**: platforms scaling to thousands–millions of agents.
- Critique lines to design against: *static sandboxes are inadequate* — societal realism needs
  open-ended co-evolution (arXiv 2510.13982); topology matters — network structure of agent
  interactions drives dynamics (arXiv 2604.18011); observed agent sociality can be "form
  without function" (arXiv 2604.13052) — verify emergent behavior, don't assume it.
- Group-size effects and collective misalignment in LLM multi-agent systems (arXiv 2510.22422).

**Improvements**
- **M3+: explicit interaction topology** — replace the current well-mixed random interactions
  with a small-world / scale-free network per faction; expose "network density" as a god-view
  dial. (Topology-aware simulation is the 2026 frontier.)
- **Validation harness**: before trusting an M3 run, replay a *historical* seed (e.g., a 2024
  news event) and score the simulation against what actually happened — the same
  backtest discipline the rest of the platform uses.
- **Production path**: adopt AgentSociety/OASIS-style engine for the real backend; keep the
  browser demo as the interactive front.

## 3. LLM agents trading real prediction markets → P1–P8/C5

**Findings**
- Six frontier LLMs traded Kalshi/Polymarket autonomously with real capital for 57 days —
  **all lost money on Kalshi** (agentic-trading literature, arXiv 2605.19337 line of work).
  Short-horizon PnL rankings are provisional at best.
- New benchmark designs use on-chain markets as *uncontaminated question sets*, scoring agents
  against the market mid-price at commit time ("Alpha Score", arXiv 2605.00420).
- Semantic trading: LLMs clustering related markets to find relative-value trades
  (arXiv 2512.02436).
- **Look-ahead bias** is the key evaluation trap for LLM finance agents
  (Look-Ahead-Bench, arXiv 2601.13770; Profit Mirage, arXiv 2510.07920).

**Improvements**
- **P+: "AI trader sandbox"** — let users pit a BYOK LLM agent against the LMSR demo markets
  (paper money), displaying its PnL and calibration vs. the human user. Educational and
  directly mirrors the 2026 benchmark literature.
- **C5: contamination-safe scoring** — for any AI forecaster/trader on the platform, score only
  on questions created *after* the model's knowledge cutoff; surface the cutoff in the UI.
- **Related-market view**: cluster markets by semantic similarity (embedding of question text)
  and show "related markets" on each card — the first step toward relative-value analytics.

## 4. Time-series foundation models → M1

**Findings**
- **Chronos-2** (Oct 2025), MOIRAI-2, TimesFM, TimeGPT: pretrained TS transformers with strong
  zero-shot accuracy; Chronos-2 adds multivariate + covariate support.
- Zero-shot TSFMs **beat central-bank benchmark models** on New Zealand GDP nowcasting
  (MDPI MAKE 7(4):135, RBNZ comparison) — a striking result for M1.
- Finance-specific caution: embedding-space non-stationarity (arXiv 2604.16428) and mixed
  results when revisiting TSFMs in finance (arXiv 2511.18578) — ensemble, don't replace.

**Improvements**
- **M1+: add a TSFM layer** to the nowcasting stack: DFM + random forest + **Chronos-2
  zero-shot** as a third model family; publish each layer's real-time track record in the
  ensemble-attribution chart. The literature says TSFM ≥ classical baselines at several
  horizons, but non-stationarity argues for keeping the ensemble.
- Covariate-informed mode: feed release-calendar dummies and text-derived indices (EPU) as
  Chronos-2 covariates.

## 5. LLM/text signals in asset pricing → M2

**Findings**
- LLM news embeddings substantially improve cross-sectional return predictability across
  global markets (arXiv 2310.05627 line, extended 2025–26).
- **LLM-generated formulaic alphas** + transformer forecasters (arXiv 2508.04975);
  autonomous factor-mining agent frameworks (arXiv 2603.14288) and cross-market annual-report
  factor benchmarks with LLM agents (CrossAlpha, arXiv 2605.29286).
- Caveats: ChatGPT-style models underperform even linear regression on *multivariate numeric*
  prediction; strength is in text → signal. Look-ahead bias remains the #1 methodological trap.

**Improvements**
- **M2+: text-signal column** in company scorecards — an LLM-derived "news/filings tone" score
  alongside innovation and trend exposure, with the point-in-time discipline the benchmarks
  demand (only text published before the score date).
- **Alpha-mining module (institutional tier)**: agentic factor search over filings with strict
  OOS protocol — position it as CrossAlpha-style research tooling, not signals-as-advice.

---

## Priority order (effort × impact)

| # | Improvement | Module | Effort | Impact |
|---|---|---|---|---|
| 1 | AI forecaster bench + human/AI/ensemble Brier comparison | C1/C2 | M | ★★★★★ |
| 2 | TSFM (Chronos-2) layer in nowcast ensemble + attribution | M1 | M | ★★★★ |
| 3 | AI trader sandbox vs. LMSR markets (BYOK, paper money) | P/C5 | M | ★★★★ |
| 4 | M3 interaction topology + historical-seed validation harness | M3 | M–L | ★★★★ |
| 5 | Related-markets semantic clustering on market cards | P | S | ★★★ |
| 6 | Text-tone column in M2 scorecards (point-in-time) | M2 | S–M | ★★★ |
| 7 | Contamination-safe scoring rules for all AI participants | C3 | S | ★★★ (credibility) |

**Demo-site quick wins (can ship now):** #1 as a demo panel (LLM answers tournament questions
via the existing BYOK plumbing), #5 via question-text embeddings computed offline, and a
"model knowledge cutoff" badge anywhere an LLM output is displayed.
