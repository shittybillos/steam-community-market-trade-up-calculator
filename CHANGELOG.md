# Changelog

## 0.6.0

- Move Clear basket and Export to a toolbar at the top of the bench.
- Add a "Load Steam prices" button: shows highest buy order and average market price for every outcome (Steam Community Market only, rate-limited, cached 30 min).
- Add outcome sorting (chance, value, buy order, name) and a value basis switch.
- Add ROI after Steam's 15% sale fee, chance of profit, and a color-keyed six-tier value pie chart.

## 0.5.0

- Add a compact/75%-screen size toggle to the trade-up bench; the large view shows inputs and outcomes side by side and remembers your choice.
- Show item images for every input (from its Steam listing) and every output, including individual Doppler/Gamma Doppler gems and phases.

## 0.4.1

- Refresh the trade-up bench with clearer visual hierarchy, smoother controls and a responsive small-screen layout.
- Improve keyboard focus visibility and polish the add-to-trade-up controls on Steam listings.

## 0.4.0

- Show each eligible Doppler/Gamma Doppler gem and phase as an individual output with predicted float and wear.
- Preserve case-specific variant IDs so unrelated or unavailable gems do not appear.
- Label the finish probability as combined, without assuming equal phase/gem probabilities.
- Link variant rows to Steam's shared finish listings.

## 0.3.1

- Enforce a blanket exclusion of StatTrak Coverts from glove collections in selection, restored baskets and calculations.
- Cover all 16 mapped skins across eight glove collections with eligibility tests.
- Public repository packaging, MIT license, privacy policy and build/release workflows.

## 0.3.0

- Five-Covert gold contracts with case-specific knife/glove pools.
- Mixed/shared pool probabilities, normalized floats and StatTrak knife output links.
- Group Doppler phases/gems under finish-family odds; vanilla outputs have no exterior prediction.

## 0.2.0

- Steam Market Beta adapter for grid cards and list rows.
- Native listing floats, inspect property substitution, card reuse and click isolation.

## 0.1.1

- Remove recurring scans of Steam's accumulated listing cache.
- Bound scanning, prune departed rows, cache decoding and ignore unrelated mutations.
- Steam search form, name filtering, float-range validation and sort controls.

## 0.1.0

- Initial classic-market prototype, standard trade-up calculation and persistent basket.
