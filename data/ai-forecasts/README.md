# Public forecast records

Drop an export from the tournament page (⬇ *Export forecasts (JSON)*) in this folder and open a
pull request. The daily snapshot grades every record against the question ledger and publishes
the result in `data/ai-scoreboard.json`, which the tournament page shows under **Public records**.

Rules (enforced by `scripts/snapshot.mjs`):

- One file per contributor: `<handle>.json`, the unmodified export (`{ exported, my, ai }`).
- Only forecasts on ledger questions (`slug` present) are graded; demo-market entries are ignored.
- A forecast counts only if it was committed **before** the question resolved (`at` < `resolvedAt`)
  and, for AI entries, if the record carries a `cutoff` later than nothing — the knowledge cutoff
  declared in the 🔑 dialog is saved with each AI forecast.
- Rows are published per file and per model: `n` graded, Brier, market Brier at commit, Δ.

Nothing here is verified beyond those rules — a public record is a claim by its author, scored
by the same code that scores the market baseline. Review the file in the pull request.
