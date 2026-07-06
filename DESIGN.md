# Omni Oracle — All-in-One Forecasting & Prediction Platform
## Design Document v0.2 (research-grounded)

Serving three user segments: **individual forecasters**, **institutional clients**, and **prediction-market participants**.

---

# Part I. Theoretical Foundation (学术理论支撑)

The platform is grounded in five bodies of academic literature. Every module below cites the specific papers whose methods it operationalizes.

## 1. Forecasting Science & Judgmental Forecasting

| Finding | Key literature | Design implication |
|---|---|---|
| Trained generalists ("superforecasters") beat domain experts and intelligence analysts; skill is persistent, teachable, and identifiable | Tetlock & Gardner, *Superforecasting* (2015); Mellers et al., *Psychological Science* (2014); the IARPA ACE / Good Judgment Project papers | Build a forecaster-tournament layer with training, tracked Brier scores, and talent identification |
| ~50% of superforecaster edge is **noise reduction**, ~25% information, ~25% bias reduction | GJP decomposition studies | Structured elicitation UI: reference classes, base rates, granular probability input, update prompts |
| Aggregated crowd forecasts + **extremizing** transformations improve accuracy; teams of top forecasters need little extremizing | Satopää et al. (2014); Baron et al. (2014) | Recalibration layer on top of crowd aggregates, with parameters fit per-domain |
| Combining forecasts almost always beats individual forecasts; simple averages are hard to beat but weighted/robust pools help | Timmermann, "Forecast Combinations," *Handbook of Economic Forecasting* (2006); Ranjan & Gneiting, *JRSS-B* (2010) | An **ensemble engine** that combines model forecasts, crowd forecasts, and market prices |
| Proper scoring rules (Brier, log) and the calibration/sharpness framework are the correct evaluation targets | Brier (1950); Gneiting & Raftery, *JASA* (2007); Gneiting et al., "Calibration and Sharpness," *JRSS-B* (2007) | Everything on the platform — users, models, markets — is scored with proper scoring rules and calibration curves |

## 2. Prediction Markets: Accuracy & Information Aggregation

- **Wolfers & Zitzewitz, "Prediction Markets," *JEP* (2004)** and **NBER w12083 "Prediction Markets in Theory and Practice"** — the canonical surveys: market prices outperform moderately sophisticated benchmarks across politics, macro data, and box-office domains. Their 2006 result: under log utility, price = budget-weighted average of trader beliefs → prices can be read as probabilities.
- **Berg, Nelson & Rietz (Iowa Electronic Markets), "Prediction Market Accuracy in the Long Run"** — >100 days before elections, market error (2.65 pp) roughly halves poll error (4.49 pp).
- **Arrow et al., "The Promise of Prediction Markets," *Science* (2008)** — the case for policy legitimacy.
- Recent arXiv work (2025–26): "How Manipulable Are Prediction Markets?" (2503.03312); "Unravelling the Probabilistic Forest: Arbitrage in Prediction Markets" (2508.03474); Polymarket order-book microstructure (2604.24366); Polymarket-v1 open database (2606.04217).

## 3. Market Mechanism Design (市场机制设计)

- **Hanson, "Logarithmic Market Scoring Rules" (2003, 2007)** — LMSR: infinite liquidity, bounded subsidizer loss (b·log n), prices behave as a consistent probability distribution. The default AMM for thin/long-tail markets.
- **Chen & Pennock**; **Othman et al. (liquidity-sensitive LMSR)** — practical AMM variants.
- **Chen et al., "Complexity of Combinatorial Market Makers"** and "Designing AMMs for Combinatorial Securities: A Geometric Viewpoint" (arXiv 2411.08972) — foundations for conditional/combinatorial markets ("If X wins, will Y happen?").
- **Polymarket's production architecture** (empirically documented): hybrid-decentralized **CLOB** — off-chain matching, on-chain settlement via EIP-712 signed orders; **Gnosis Conditional Token Framework** (ERC-1155) with the invariant 1 YES + 1 NO = $1 USDC; mint/merge/direct-match mechanics; unified mirrored order book per event.
- **Resolution/oracle design**: UMA-style optimistic oracle (propose → bond → dispute window → token-holder vote), plus documented failure modes (the 2025–26 governance-attack incidents) and emerging research on **multi-agent AI oracles** for resolution (arXiv 2605.30802). Manipulation and insider-trading analyses: arXiv 2605.10486.

## 4. Macroeconomic & Financial Forecasting

- **Nowcasting**: Giannone, Reichlin & Small, *JME* (2008) — dynamic factor models (DFM) handling mixed frequencies and ragged edges; used at the NY Fed. IMF WP/22/52 scales DFM + ML + novel data.
- **ML for macro**: Kant, Pick & Winter (2024, *AStA*) and IMF WP/2025/252 — random forests typically best for now/forecasts, DFM best for backcasts; Medeiros et al. (2021, *JBES*) — RF beats benchmarks for inflation in data-rich settings.
- **BVAR**: Bańbura, Giannone & Reichlin (2010) — large Bayesian VARs for scenario/conditional forecasting.
- **Text as data**: nowcasting with newspaper text (Barbaglia et al., *IJF* 2023-class work); Baker–Bloom–Davis EPU index.
- **Survey benchmarks**: SPF/Blue Chip literature — surveys are strong benchmarks; combine, don't discard.

## 5. Asset Pricing & Identifying Future-Trend Companies

- **Gu, Kelly & Xiu, "Empirical Asset Pricing via Machine Learning," *RFS* (2020)** — trees and neural nets roughly double regression-based strategy performance; dominant signals: momentum, liquidity, volatility; gains come from nonlinear interactions. The blueprint for the stock-ranking engine.
- **Fama & French (1993, 2015)**; **Hou, Xue & Zhang (q-factor, 2015)** — factor benchmarks every ML signal must be tested against.
- **Kogan, Papanikolaou, Seru & Stoffman, "Technological Innovation, Resource Allocation, and Growth," *QJE* (2017)** — patent economic value measured via stock-market reaction; predicts firm growth better than citation counts. Core of the trend-company module.
- **Kelly, Papanikolaou, Seru & Taddy (2021)** — text-based measure of patent **disruptiveness** (backward/forward textual similarity).
- **Zheng (2025, *CAR*)** and "Predictive Patentomics" (ChatGPT-based patent valuation) — markets **underreact** to patent text → exploitable signal.
- **Welch & Goyal (2008)** vs. **Campbell & Thompson (2008)** — honest out-of-sample discipline; economic constraints improve OOS predictability.

---

# Part II. Module Architecture (模块架构)

```
┌────────────────────────────────────────────────────────────────────┐
│                        OMNI ORACLE PLATFORM                        │
├──────────────────────────┬─────────────────────────────────────────┤
│  FLAGSHIP ANALYTICS      │  PREDICTION MARKET MODULES              │
│                          │  (Polymarket-informed hot categories)   │
│  M1 Macro & Finance      │  P1 Politics & Elections                │
│  M2 Future-Trend         │  P2 Crypto Prices                       │
│     Companies & Stocks   │  P3 Econ Data Releases (Fed/CPI/NFP)    │
│                          │  P4 Geopolitics                         │
│  CROSS-CUTTING           │  P5 Sports                              │
│  C1 Forecaster Tournament│  P6 Awards & Entertainment              │
│  C2 Ensemble Engine      │  P7 Tech & AI Milestones                │
│  C3 Scoring & Calibration│  P8 Current Events / Pop Culture        │
│  C4 Data Platform        │                                         │
│  C5 Market Infrastructure (CLOB + LMSR AMM + Oracle)               │
└────────────────────────────────────────────────────────────────────┘
```

## M1. Macroeconomics & Finance Module (旗舰模块一)

**Purpose**: institutional-grade now/forecasts for GDP, inflation, employment, rates, FX, recession probability.

**Methodology stack** (each layer benchmarked against the last):
1. **Nowcasting core** — DFM à la Giannone-Reichlin-Small on a FRED-MD-style panel; updates within minutes of each data release; publishes "news decomposition" (which release moved the nowcast and by how much).
2. **ML layer** — random forest / gradient boosting / elastic net on the same panel plus alternative data; RF as headline per the nowcasting-horserace literature.
3. **Structural layer** — large BVAR (Bańbura et al.) for conditional scenarios ("path of CPI if Fed holds"), fan charts, and impulse responses.
4. **Text layer** — LLM-extracted signals from Fed communication, earnings calls, news (EPU-style indices).
5. **Crowd + market layer** — internal forecaster tournament (C1) and internal/external market prices (P3) on the same variables.
6. **Ensemble** (C2) — combined per Timmermann/Ranjan-Gneiting, with full attribution: model vs. crowd vs. market contribution shown to the user.

**Products**: real-time nowcast dashboard; recession-probability tracker; Fed-decision probability tree (cross-linked to P3 market odds); scenario builder (institutional tier); API.

**Data sources**: FRED/FRED-MD, BEA, BLS, Census; ECB SDW, OECD; ALFRED vintages for honest backtesting; SPF & Blue Chip; CME FedWatch; TIPS breakevens; newspaper/text corpora; optional alt-data (card spend, mobility, job postings).

## M2. Future-Trend Companies & Stocks Module (旗舰模块二)

**Purpose**: identify companies positioned to lead emerging trends, and rank stocks — with academically honest expectations (rankings and probabilities, not "sure winners").

**Pipeline**:
1. **Trend taxonomy** — dynamic ontology of emerging themes (AI infra, GLP-1, fusion, robotics, space, quantum, longevity…) mined from patents, arXiv, clinical trials, job postings, and earnings-call text; each theme gets a maturity score (hype-cycle position estimated from text + funding data).
2. **Company–trend mapping** — text similarity between theme definitions and firm disclosures (10-K item 1, earnings calls), à la Hoberg–Phillips text-based industries.
3. **Innovation scoring** — Kogan et al. (2017) market-reaction patent values + Kelly et al. (2021) disruptiveness + patent-text LLM valuation (Predictive Patentomics); exploits documented underreaction to patent text.
4. **Return-ranking engine** — Gu-Kelly-Xiu-style ML (GBT + NN ensemble) on ~100 characteristics + innovation/theme features; strict expanding-window OOS protocol (Welch-Goyal discipline); outputs decile ranks and expected-return distributions, always shown against Fama-French/q-factor benchmarks.
5. **Prediction-market cross-check** — company-milestone markets (P7: "Will X ship Y by Q3?", "FDA approval by 2027?") feed back as event probabilities on each company page.

**Products**: theme explorer; per-company "trend exposure + innovation + ML rank" scorecard; watchlists & alerts; institutional API with factor-neutralized signals; explicit uncertainty bands and backtest disclosures.

**Data sources**: USPTO PatentsView + Google Patents; arXiv/PubMed/ClinicalTrials.gov; SEC EDGAR full-text; earnings-call transcripts; CRSP/Compustat-class market data (or Polygon/EODHD tier for retail); job postings; VC funding (Crunchbase); GitHub activity for dev-tool trends.

## P1–P8. Prediction-Market Modules (Polymarket 热门方向)

Category mix is grounded in observed volume: **sports ≈ 39%, politics + crypto + sports ≈ 90%** of Polymarket volume since July 2024; politics spiked to 65% around the 2024 US election; combined Polymarket+Kalshi volume grew from <$5 B/mo (Sep 2025) to ~$24 B/mo (Apr 2026) (Pew, 2026).

| Module | Contract types | Resolution source | Notes |
|---|---|---|---|
| **P1 Politics & Elections** | Winner-take-all, vote-share buckets, conditional ("if nominee = X, wins?") | Official results, AP calls | Highest event-driven volume; IEM-accuracy literature applies |
| **P2 Crypto** | Price thresholds by date, ETF approvals, protocol milestones | Exchange price feeds (medianized) | Largest count of active markets (5,400 on Polymarket); easiest to resolve objectively |
| **P3 Econ Data Releases** | Fed decision buckets, CPI/NFP ranges, recession-by-date | BLS/BEA/Fed releases | **The bridge to M1**: market odds vs. model nowcast displayed side by side — the platform's signature view |
| **P4 Geopolitics** | Event-by-date binaries, conditional escalation ladders | Documented-event criteria + oracle | Careful resolution wording; ethics review (no death-market designs) |
| **P5 Sports** | Game/season outcomes, props | League feeds | Volume anchor; commodity odds — differentiate via calibration analytics |
| **P6 Awards & Entertainment** | Oscars/Grammys winners, box-office ranges | Official announcements | Wolfers-Zitzewitz box-office accuracy evidence |
| **P7 Tech & AI Milestones** | Model-release dates, benchmark thresholds, product launches, FDA approvals | Pre-specified verifiable criteria | **The bridge to M2**: milestone odds feed company scorecards |
| **P8 Current Events** | Misc. pop-culture/news binaries | Case-by-case, tightest wording standards | Long tail; LMSR-subsidized liquidity |

## C5. Market Infrastructure (从学术到工程)

- **Matching**: hybrid CLOB (Polymarket-style) — off-chain matching for UX/speed, on-chain (or auditable-ledger) settlement; binary complementary tokens with the 1 YES + 1 NO = $1 invariant; mint/merge on crossed complementary orders.
- **Liquidity**: LMSR AMM (Hanson) seeds thin/long-tail markets with bounded loss b·log n; liquidity-sensitive variant (Othman et al.) as volume grows; CLOB takes over for liquid markets.
- **Combinatorial/conditional markets** (roadmap): per Chen et al., restricted structures (trees/paths) to keep pricing tractable.
- **Resolution**: three tiers — (a) automated for objective feeds (P2/P3/P5), (b) optimistic-oracle with bond + dispute window for the rest, (c) expert council + documented-criteria appeal for ambiguous cases. Design explicitly incorporates lessons from UMA governance-attack incidents: escalating bonds, vote-weight caps, resolution-criteria lock at market creation, and experimental multi-agent AI adjudication (arXiv 2605.30802) as a *dispute-triage* layer, not final authority.
- **Manipulation resistance**: position limits near resolution, anomaly detection on order flow (microstructure literature: arXiv 2604.24366), public post-mortems.
- **Compliance**: jurisdiction-gated real-money vs. play-money/points tournaments (CFTC event-contract landscape is shifting — Kalshi precedent); institutions get data products regardless of trading eligibility.

## C1–C4. Cross-Cutting Layers

- **C1 Forecaster Tournament** — GJP-style: training modules (base rates, scope sensitivity), team formation, Brier-score leaderboards, superforecaster identification track; top forecasters' aggregates sold as a premium signal (Mellers et al. talent-spotting result).
- **C2 Ensemble Engine** — per-question combination of {models, crowd, markets} with domain-fit extremizing (Satopää) and out-of-sample weights (Timmermann); publishes *which* source is winning per domain.
- **C3 Scoring & Calibration** — proper scoring rules everywhere; public calibration curves for the platform itself (credibility flywheel); sharpness-subject-to-calibration (Gneiting) as the stated objective.
- **C4 Data Platform** — vintage-aware time-series store (ALFRED-style, no look-ahead), streaming release ingestion, text/LLM feature pipeline, backtest sandbox for institutional clients.

---

# Part III. Segment-Product Fit & Roadmap

| Segment | Core products | Monetization |
|---|---|---|
| Individuals | Tournament, dashboards, watchlists, market trading (where legal) | Freemium + trading fees |
| Institutions | Nowcast/signal APIs, scenario builder, crowd-aggregate feeds, backtest sandbox | Subscription + seats |
| Market participants | CLOB/AMM markets, market-data API, resolution transparency | Fees + data licensing |

**Phase 1 (0–6 mo)**: M1 nowcasting core (DFM + RF on FRED-MD), C3 scoring, C1 play-money tournament on P3-style questions.
**Phase 2 (6–12 mo)**: M2 pipeline (patents + GKX ranking), P2/P3/P7 markets with LMSR, ensemble engine v1.
**Phase 3 (12–24 mo)**: full CLOB + oracle stack, P1/P4–P6/P8 categories, conditional markets, institutional API GA.

---

# Appendix: Core Reading List

**Forecasting science**: Tetlock & Gardner (2015); Mellers et al. (2014); Satopää et al. (2014); Timmermann (2006); Gneiting & Raftery (2007); Ranjan & Gneiting (2010).
**Prediction markets**: Wolfers & Zitzewitz (JEP 2004; NBER w12083); Berg-Nelson-Rietz (long-run accuracy); Arrow et al. (Science 2008); Hanson (2003, 2007) LMSR; Chen-Pennock; Othman et al.; arXiv 2503.03312, 2508.03474, 2604.24366, 2605.10486, 2605.30802, 2606.04217.
**Macro**: Giannone-Reichlin-Small (2008); Bańbura-Giannone-Reichlin (2010); Medeiros et al. (2021); Kant-Pick-Winter (2024); IMF WP/22/52, WP/2025/252; Baker-Bloom-Davis EPU.
**Asset pricing / innovation**: Gu-Kelly-Xiu (RFS 2020); Fama-French (1993, 2015); Hou-Xue-Zhang (2015); Kogan-Papanikolaou-Seru-Stoffman (QJE 2017); Kelly-Papanikolaou-Seru-Taddy (2021); Zheng (CAR 2025); Welch-Goyal (2008); Campbell-Thompson (2008); Hoberg-Phillips (text-based industries).
