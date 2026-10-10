# PoE 2 Casual Price Check Design

## Goal

When someone asks jjb for the price or value of a Path of Exile 2 item during normal conversation, jjb should answer with a current poe.ninja estimate instead of guessing. Price checks do not roll loot or modify a player's loot inventory.

## Scope

- Support item names found in all currently documented public PoE 2 poe.ninja economy overview categories: exchange (`Currency`, `Fragments`, `Abyss`, `UncutGems`, `LineageSupportGems`, `Essences`, `SoulCores`, `Idols`, `Runes`, `Ritual`, `Expedition`, `Delirium`, `Breach`, `Verisium`) and stash items (`UniqueWeapons`, `UniqueArmours`, `UniqueAccessories`, `UniqueFlasks`, `UniqueCharms`, `UniqueJewels`, `UniqueSanctumRelics`, `UniqueTablets`, `PrecursorTablets`).
- Recognize explicit price questions such as “what’s a Mageblood worth?” or “mageblood price”. Do not intercept general conversation that lacks a clear price intent and a matched item.
- Normalize case, punctuation, and common plural forms for item-name matching. Match complete item names, preferring the longest exact match when the prompt contains more than one candidate.
- If multiple listed variants match the same name, report a poe.ninja price range instead of silently picking one. Do not present the estimate as an executable trade quote.

## League selection

Resolve a league in this order:

1. A league explicitly named in the question, matched case-insensitively to a poe.ninja league name or id.
2. `POE_LOOT_LEAGUE`, when configured.
3. The current challenge league (first entry from the poe.ninja leagues endpoint).

Name the resolved league in the answer. If an explicitly requested league is unavailable, report that and do not silently substitute another league.

## Data flow

Add a focused price-check module that owns league resolution, category queries, item matching, and response formatting. The conversation handler should call it before the casual model response only after detecting a clear price intent; existing loot roll, inventory, and leaderboard routing remains higher priority.

On the first price check for a league, fetch its documented exchange and stash-item overview categories with bounded concurrency. Cache results by league, route, and category for one hour, send conditional ETag requests, reuse cached response bodies on HTTP 304, and honor `Retry-After`. Cache the normalized item index so later checks do not refetch every category. Keep the existing identifying User-Agent. A failed category is unavailable data, not a zero price.

Read item names and `primaryValue` from each overview using that route's documented response shape. Resolve the displayed estimate into Divine Orbs or Exalted Orbs using the same league's Currency exchange prices: show values below one Divine in Exalted Orbs, and values of at least one Divine in Divine Orbs. Apply normal rounding to the displayed amount. If an exchange rate needed for conversion is missing, preserve the reported primary amount and currency unit, and state that conversion is unavailable.

## Conversation response and failures

Keep the answer short and casual, for example: “Mageblood is around 12 Divine Orbs in [League], according to poe.ninja.” Include the league and make clear it is an estimate. For multiple variants, show a low-to-high range with the same unit when possible. If the item is not found, ask the user to check its name; if a category or poe.ninja is unavailable, say that the current price could not be loaded. Do not fabricate a price or silently use stale data as current; cached data may be labeled with its retrieval time if used after a refresh failure.

## Validation

- Add focused tests for price-intent detection, normalized item matching and variant ranges, league precedence and unavailable explicit leagues, and currency conversion/rounding.
- Run the bot TypeScript check.
- Validate parsers against one small read-only response from the documented poe.ninja API, without repeatedly downloading full categories.

## API reference

Use the public economy overview endpoints and schemas documented at [poe.ninja API reference](https://poe.ninja/docs/api). The API is best-effort and has no stability guarantee; parsing must handle missing fields and unknown schema changes explicitly.
