# Omni Oracle 🔮

**All-in-one forecasting & prediction platform — research-grounded design prototype.**

Live site: **https://presleyzhou.github.io/omni-oracle/**

Omni Oracle combines three sources of foresight — machine-learning nowcasts, superforecaster
crowds, and prediction-market prices — into one calibrated view of the future, serving
individual users, institutional clients, and prediction-market participants.

## Pages

| Page | Module | What it shows |
|---|---|---|
| [index.html](index.html) | — | Platform overview and module map |
| [macro.html](macro.html) | M1 | GDP/CPI nowcasts, news decomposition, Fed decision tree (model vs. market), ensemble attribution |
| [trends.html](trends.html) | M2 | Emerging-theme explorer and company scorecards (innovation, trend exposure, ML decile ranks) |
| [markets.html](markets.html) | P1–P8 | Prediction markets across 8 categories with a working Hanson LMSR trade simulator |
| [tournament.html](tournament.html) | C1/C3 | Brier-scored leaderboard, calibration curves, forecast-source comparison |
| [methodology.html](methodology.html) | — | Academic foundation, market-infrastructure design, data sources, roadmap |

## Design document

The full research-grounded design (with the complete academic reading list) is in
[DESIGN.md](DESIGN.md): theoretical foundations from forecasting science (Tetlock, Satopää,
Timmermann, Gneiting), prediction markets (Wolfers–Zitzewitz, Hanson LMSR, Polymarket
CLOB/oracle architecture), macro nowcasting (Giannone–Reichlin–Small DFM, ML horseraces),
and asset pricing / innovation (Gu–Kelly–Xiu, Kogan et al.).

## Running locally

Pure static site — no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Disclaimer

This is a design prototype. All prices, forecasts, scores and markets are illustrative
mock data. Nothing here is investment advice; play-money only.
