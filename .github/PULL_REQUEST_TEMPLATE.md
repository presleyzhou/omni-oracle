## What this PR does

<!-- One or two sentences. -->

## If this adds a forecast record (`data/ai-forecasts/<handle>.json`)

- [ ] The file is the unmodified export from the tournament page (⬇ *Export forecasts (JSON)*)
- [ ] Forecasts on ledger questions were committed **before** those questions resolved
- [ ] AI forecasts carry the model id and the knowledge cutoff I declared in the 🔑 dialog
- [ ] I understand the record is graded by `scripts/snapshot.mjs` with the same code as the market baseline and shown publicly

CI runs `node scripts/check-records.mjs` on this PR.
