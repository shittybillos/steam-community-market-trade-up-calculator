# Steam Community Market Trade-up Calculator

A Chrome extension for building CS2 trade-up contracts directly on Steam Community Market. Add individual listings, keep a basket across pages and tabs, and compare possible outputs without leaving the market.

**Supports Steam Market Beta and the classic market.**

## Install

1. Download the extension ZIP from [Releases](https://github.com/williammccaig019-wq/steam-community-market-trade-up-calculator/releases/latest).
2. Extract it to a permanent folder.
3. Open `chrome://extensions` and enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Reload Steam market tabs. Open a CS2 skin item page and click **Add to trade-up** on an individual listing.

Open the green **Trade-up bench** button to view the basket. **Page listings** filters loaded items by float, name and collection, and sorts them by float or price. **Search Steam** opens CS2 market search.

To update, replace the files in the same extension folder, reload the extension in `chrome://extensions`, and refresh every Steam market tab. Keeping the same extension entry preserves your basket.

## Features

- Exact listing and asset identity, native Beta float values or locally decoded inspect payloads, and available paint seeds.
- Ten-input standard contracts with matching rarity and regular/StatTrak status.
- Five-Covert gold contracts: regular knives/gloves or StatTrak knives.
- Collection/case-based output probabilities, normalized float predictions, and output wear.
- Shared local basket across tabs, with serialized writes to prevent lost additions.
- Bounded scans of up to 200 rendered listings, cached decoding, and no recurring market polling.
- Duplicate, Souvenir, mixed-rarity and mixed-StatTrak input rejection.

**StatTrak Covert skins from glove collections cannot be used in any contract.** They are blocked at selection and basket validation. Lower-rarity StatTrak skins from those collections remain eligible for standard contracts.

## How the calculator works

Each input contributes an equal share of the contract's probability mass to its collection or case. That share splits across its eligible next-tier outputs. Shared outputs accumulate their chances across pools.

```text
adjusted input = (input float - input minimum) / (input maximum - input minimum)
output float = average adjusted input * (output maximum - output minimum) + output minimum
```

Incomplete contracts show a preview for the currently selected inputs; adding more inputs changes the results.

Gold outcomes group **Doppler and Gamma Doppler phases/gems by finish family**. Displayed odds combine those variants. Individual phase/gem probabilities and specific paint patterns are not estimated. Vanilla knives have no exterior prediction.

## Limits

- This is a calculator for candidate listings. It does not purchase skins, submit contracts, or confirm ownership.
- Only items already loaded by Steam are scanned; the extension does not crawl the whole market. Skin-group search results are not individual listings.
- Prices and availability are snapshots. Numeric input cost includes the listed Steam fee when available, but excludes location-dependent checkout tax. No output prices, profit or expected-value estimates are provided.
- Legacy inspect links require a float lookup service and cannot be decoded locally. Beta's native listing float can still be used when supplied.
- The catalog is a bundled snapshot dated October 14, 2026. Unmapped Covert pools and ambiguous skins are rejected.
- Beta support reads private rendered-card props/classes. Future Steam changes may require adapter updates.
- Automated tests cover both adapters and the calculator. Predicted game outcomes have not been exhaustively validated against in-game contracts. The formulas and odds are based on community-documented behavior.

## Build and test

Use Node.js **24.15 or newer in the 24.x line** (or another version supported by the dependencies).

```sh
npm ci
npm run build
npm test
```

Load `dist/` as an unpacked extension. Source is in `src/`; `catalog.mjs` generates the bundled item/pool catalog. `tests/` covers standard/gold math, eligibility, classic/Beta adapters, card reuse, filtering, click isolation, persistence, concurrency and idle-scan stability.

GitHub Actions builds and tests pushes and pull requests. Version tags matching the manifest (for example `v0.3.1`) create a downloadable release ZIP after tests pass.

To update the snapshot, download both [`skins.json`](https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json) and [`crates.json`](https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json), replace the source files, and rebuild. The build rejects missing rare-item references and ambiguous gold pools.

## Privacy and license

Basket data stays in Chrome local storage. There are no analytics, float API calls, or credential requests. See [PRIVACY.md](PRIVACY.md) for details.

Project code is [MIT licensed](LICENSE). Third-party catalog and bundled dependencies retain their original licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This independent project is not affiliated with Valve, Steam, Counter-Strike or CSFloat.

## Sources

- [ByMykel CS2 catalog](https://github.com/ByMykel/CSGO-API)
- [CSFloat inspect serializer](https://github.com/csfloat/cs-inspect-serializer)
- [Valve's five-Covert contract announcement](https://www.counter-strike.net/newsentry/516350567072661952)
- [Community float and odds guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3594575259)
- [Community calculator implementation](https://github.com/CS2Cap/cs2-tradeup-calculator)

Report issues with the extension version, classic/Beta mode, and affected item name. Do not include Steam credentials, session cookies or private account details.
