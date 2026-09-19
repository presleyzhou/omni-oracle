#!/usr/bin/env bash
# Turn the roadmap in RESEARCH-UPDATES.md into GitHub issues (one per row of the
# priority table) so the plan is visible and trackable. Idempotent-ish: skips an
# item whose title already exists as an open issue. Requires `gh auth login`.
set -euo pipefail
REPO=${REPO:-presleyzhou/omni-oracle}

gh label create roadmap --repo "$REPO" --color 8b5cf6 --description "From RESEARCH-UPDATES.md" 2>/dev/null || true
for l in M1 M2 M3 P C1 C3 C5; do
  gh label create "module:$l" --repo "$REPO" --color 4f8cff 2>/dev/null || true
done

mk() { # title | labels | body
  local title=$1 labels=$2 body=$3
  if gh issue list --repo "$REPO" --state open --search "in:title \"$title\"" --json title -q '.[].title' | grep -Fxq "$title"; then
    echo "skip (exists): $title"; return
  fi
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --body "$body"
}

mk "AI forecaster bench: humans vs LLMs vs ensemble on the leaderboard" "roadmap,module:C1" \
"**From RESEARCH-UPDATES.md §1 (priority #1, impact ★★★★★).**

Frontier models score Brier ≈ 0.101 vs human superforecasters ≈ 0.081 (arXiv 2507.04562); diverse LLM crowds sometimes match human aggregates.

- [ ] Panel of BYOK LLM forecasters answering the same tournament questions
- [ ] Brier per model on the leaderboard next to humans (the demo table in \`tournament.html\` is the seed)
- [ ] Ensemble (C2) combining humans + models + markets with out-of-sample weights
- [ ] Public chart of platform-level Brier over time: humans vs AI vs ensemble
- [ ] Optional 'commandments coach' shown before a human submits (+23–43% in the literature)"

mk "TSFM (Chronos-2) layer in the nowcast ensemble with attribution" "roadmap,module:M1" \
"**From RESEARCH-UPDATES.md §4 (priority #2, impact ★★★★).**

Zero-shot time-series foundation models beat central-bank benchmarks on GDP nowcasting (RBNZ comparison), but finance-specific non-stationarity argues for ensembling rather than replacing.

- [ ] Add Chronos-2 zero-shot as a third model family beside DFM + random forest
- [ ] Publish each layer's real-time track record in the ensemble-attribution chart
- [ ] Covariate mode: release-calendar dummies and EPU-style text indices"

mk "AI trader sandbox vs LMSR markets (BYOK, paper money)" "roadmap,module:P,module:C5" \
"**From RESEARCH-UPDATES.md §3 (priority #3, impact ★★★★).**

Six frontier LLMs traded Kalshi/Polymarket autonomously for 57 days and all lost money on Kalshi — short-horizon PnL is provisional. The existing 🤖 AI trader on \`markets.html\` is the seed.

- [ ] Persist the bot's positions separately and show PnL + calibration vs the human user
- [ ] Alpha-Score style scoring against the market mid at commit time
- [ ] Surface model knowledge cutoff wherever LLM output is displayed"

mk "M3: interaction topology + historical-seed validation harness" "roadmap,module:M3" \
"**From RESEARCH-UPDATES.md §2 (priority #4, impact ★★★★).**

Static sandboxes are inadequate; network structure drives dynamics (arXiv 2604.18011); observed sociality can be 'form without function' — verify, don't assume.

- [ ] Replace well-mixed random interactions with a small-world / scale-free network per faction
- [ ] Expose 'network density' as a god-view dial
- [ ] Replay a historical seed and score the run against what actually happened (extend the backtest suite)
- [ ] Document the production path (AgentSociety/OASIS-style engine behind the browser demo)"

mk "Related-markets semantic clustering on market cards" "roadmap,module:P" \
"**From RESEARCH-UPDATES.md §3 (priority #5, impact ★★★).**

Current 'related' links use token overlap + same-category bonus (\`js/pages/markets.js\`). Upgrade to question-text embeddings computed offline (e.g. in the snapshot workflow) and ship a JSON of nearest neighbours — first step toward relative-value analytics."

mk "Text-tone column in M2 scorecards with point-in-time discipline" "roadmap,module:M2" \
"**From RESEARCH-UPDATES.md §5 (priority #6, impact ★★★).**

LLM news embeddings improve cross-sectional return predictability; look-ahead bias is the #1 trap.

- [ ] LLM-derived news/filings tone score beside innovation and trend exposure (the \`tone\` field is currently mock)
- [ ] Only text published before the score date
- [ ] Institutional tier: agentic factor search with strict OOS protocol (CrossAlpha-style)"

mk "Contamination-safe scoring rules for all AI participants" "roadmap,module:C3" \
"**From RESEARCH-UPDATES.md §3 (priority #7, credibility).**

- [ ] Score AI forecasters/traders only on questions created after the model's knowledge cutoff
- [ ] Show the cutoff badge in the UI (tournament AI bench already carries a \`cutoff\` field)
- [ ] Document the rule on \`methodology.html\`"
echo "done"
