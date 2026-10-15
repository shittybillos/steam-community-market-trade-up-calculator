# Privacy policy

Effective date: October 14, 2026.

Steam Community Market Trade-up Calculator reads CS2 listing information from Steam Community Market pages you visit, solely to display listing details and calculate trade-up outcomes.

## Data read and stored

The extension reads listing IDs, asset IDs, skin names, floats, available paint seeds, collections, prices and currencies from rendered Steam market listings. Its catalog supplies skin ranges and eligible output pools. Listings selected for a contract are stored in **Chrome local storage** on your device, along with their market URLs and capture timestamps. They are shared between the extension's tabs in the same Chrome profile; they are not synchronized using `chrome.storage.sync`.

The extension does not request account credentials, read session cookies, or collect analytics. It does not send basket data to the developer or a float lookup service. Its runtime catalog fetch reads the file bundled with the extension. Only when you click **Load Steam prices**, the extension requests prices for the possible outcomes (price overview, listing page and order histogram) from steamcommunity.com using your browser's normal same-origin requests, one at a time and rate-limited, and caches the results in the page's local storage for 30 minutes. Nothing is sent anywhere else. Opening a Steam search or output link makes your browser's normal request to Steam under Steam's own policies.

## Deletion and export

Use **Clear basket** to delete saved selections, or remove individual entries. Uninstalling the extension removes its local storage. **Export JSON** downloads a copy only when you choose to export.

## Changes and questions

Future versions that change data handling will update this policy. Questions can be raised through this repository's issue tracker without posting sensitive information.
