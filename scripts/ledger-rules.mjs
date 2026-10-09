/* Question-ledger rules shared by scripts/snapshot.mjs and scripts/test-ledger-rules.mjs.
   Keeping them in one module means a rule change is unit-tested before the daily job
   runs it against Polymarket. */

/* low-information ladders (daily temperature, tweet counts) are excluded outright; price
   ladders ("Bitcoin reach $X in October") are capped per family so one asset's strike
   grid cannot dominate the market baseline */
export const LADDERS = /\b(highest|lowest) temperature\b|\btweets?\b|\bof tweets\b/i;
export const family = (slug) => slug.replace(/\d+(pt\d+)?k?/g, "#");
export const FAMILY_CAP = 2;
/* coarse topic tags used by the tournament page's per-topic baselines */
export const TOPICS = [
  ["crypto", /\b(bitcoin|btc|ethereum|eth|solana|sol|xrp|dogecoin|crypto|token|etf)\b/i],
  ["geo", /\b(ceasefire|war|iran|israel|russia|ukraine|china|taiwan|nato|hormuz|strike|missile|troops|military|gaza|sanction)\b/i],
  ["politics", /\b(trump|president|congress|senate|house|election|governor|vote|bill|executive order|supreme court|cabinet|attorney general|impeach|shutdown)\b/i],
  ["economy", /\b(fed|fomc|rate (hike|cut)|inflation|cpi|gdp|unemployment|recession|tariff|oil|opec|treasury|dollar|yield)\b/i],
  ["tech", /\b(ai|openai|anthropic|google|apple|nvidia|tesla|spacex|launch|model|gpt|chip|iphone)\b/i],
];
export const topicOf = (q) => (TOPICS.find(([, re]) => re.test(q)) || ["other"])[0];
export const SPORTS = /\b(nhl|nba|mlb|nfl|ncaa|ufc|mls|epl|la liga|serie a|bundesliga|premier league|champions league|atp|wta|f1|grand prix|o\/u|spread|moneyline|end in a draw|win on \d{4}-\d{2}-\d{2}|match|game \d)\b|\bvs\.?\s/i;

export const TAG_EXCLUDE = /^(sports|games|esports|soccer|tennis|basketball|baseball|hockey|football|cfb.*|nfl|nba|mlb|nhl|mma|ufc|golf|f1|recurring|up or down|hide from new|weather|daily temperature|highest temperature|lowest temperature|tweet markets|5m|15m|hourly)$/i;
export const TAG_TOPIC = [
  ["crypto", /^(crypto|bitcoin|ethereum|solana|xrp|crypto prices|hit price|stablecoins?|defi)$/i],
  ["geo", /^(geopolitics|military|military strikes|iran|israel|middle east|strait of hormuz|russia|ukraine|china|taiwan|nato|war|ceasefire|houthis|yemen)$/i],
  ["politics", /^(politics|elections|us election|global elections|world elections|main election|trump|midterms|congress|senate|house|supreme court|cabinet|.* election)$/i],
  ["economy", /^(economy|fed|oil|business|finance|macro|inflation|tariffs?|trade|rates|gdp|jobs|treasury)$/i],
  ["tech", /^(tech|ai|science|space|openai|anthropic|spacex|nvidia|apple|google|tesla)$/i],
];
export const topicFromTags = (tags) => { for (const [t, re] of TAG_TOPIC) if (tags.some(l => re.test(l))) return t; return null; };
export const EVENT_CAP = 3;
