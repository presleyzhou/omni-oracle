# Contributing

## Code

Pure static site — no build. Run locally with `python3 -m http.server 8000`, then:

```bash
node scripts/check-i18n.mjs          # every language has every key; every referenced key exists
node scripts/test-ledger-rules.mjs   # ledger filter / topic rules
node scripts/check-snapshot.mjs      # data files parse and carry the fields the pages read
node scripts/check-records.mjs       # public forecast records are well-formed
npx html-validate "*.html"
scripts/bump.sh                      # after changing css/js: bumps ?v= and the service-worker cache name
```

CI runs the same checks. Keep every number shown as *Live*, *Snapshot* or ledger-derived real;
anything illustrative must stay labelled *Demo data*.

## Forecast records

Export your forecasts from the tournament page and add the file as
`data/ai-forecasts/<handle>.json` in a pull request — the rules are in that folder's README and
the PR template. The daily snapshot grades the record against `data/questions.json`.

## Research roadmap

The prioritised roadmap lives in `RESEARCH-UPDATES.md` and as GitHub issues labelled `roadmap`.
Open an issue before large changes to M1–M3 so the methodology page can be updated alongside.
