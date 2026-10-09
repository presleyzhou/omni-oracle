#!/usr/bin/env node
/* Unit tests for the ledger rules (run by CI). */
import assert from "node:assert/strict";
import { LADDERS, family, FAMILY_CAP, topicOf, SPORTS, TAG_EXCLUDE, topicFromTags, EVENT_CAP } from "./ledger-rules.mjs";

let n = 0; const t = (name, fn) => { fn(); n++; };

t("sports lines are excluded, including 'vs.' and dated match questions", () => {
  for (const q of ["Lightning vs. Avalanche: O/U 7.5", "Will France win on 2026-09-28?", "Will China PR vs. Turkmenistan end in a draw?", "NBA Finals MVP"])
    assert.ok(SPORTS.test(q), q);
  for (const q of ["US x Iran ceasefire continues through October 31?", "Fed cuts rates at the December 2026 FOMC?"])
    assert.ok(!SPORTS.test(q), q);
});
t("temperature and tweet ladders are excluded", () => {
  assert.ok(LADDERS.test("Highest temperature in Panama City on October 12: 31°C?"));
  assert.ok(LADDERS.test("Will Elon Musk post 180-199 tweets from October 3 to October 10?"));
  assert.ok(!LADDERS.test("Will Bitcoin reach $120,000 in October?"));
});
t("slug families collapse strike prices and dates", () => {
  assert.equal(family("will-bitcoin-reach-120000-in-october-2026"), family("will-bitcoin-reach-110000-in-october-2026"));
  assert.equal(family("will-bitcoin-dip-to-82pt5k-in-september-2026"), family("will-bitcoin-dip-to-80k-in-september-2026"));
  assert.notEqual(family("us-x-iran-ceasefire-continues-through-october-31"), family("will-bitcoin-reach-120000-in-october-2026"));
  assert.ok(FAMILY_CAP >= 1 && EVENT_CAP >= 1);
});
t("keyword topics", () => {
  assert.equal(topicOf("Will Bitcoin reach $120,000 in October?"), "crypto");
  assert.equal(topicOf("US x Iran ceasefire continues through October 31?"), "geo");
  assert.equal(topicOf("Fed cuts rates at the December 2026 FOMC?"), "economy");
  assert.equal(topicOf("Will the Mets sign a new catcher?"), "other");
});
t("tag topics: politics beats the generic World tag; sports/recurring/weather tags excluded", () => {
  assert.equal(topicFromTags(["World", "Brazil", "Politics", "Elections"]), "politics");
  assert.equal(topicFromTags(["Yemen", "Houthis", "Military", "Geopolitics"]), "geo");
  assert.equal(topicFromTags(["Bitcoin", "Hit Price", "Crypto"]), "crypto");
  assert.equal(topicFromTags(["Culture"]), null);
  for (const tag of ["Sports", "Up or Down", "Recurring", "Hide From New", "Weather", "Daily Temperature", "Tweet Markets", "Soccer"])
    assert.ok(TAG_EXCLUDE.test(tag), tag);
  for (const tag of ["Politics", "Crypto", "Geopolitics", "Economy"]) assert.ok(!TAG_EXCLUDE.test(tag), tag);
});
console.log(`✓ ledger rules: ${n} test groups passed`);
