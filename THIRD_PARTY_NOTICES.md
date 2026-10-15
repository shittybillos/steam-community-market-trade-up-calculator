# Third-party notices

The project license covers original project code. Third-party data and dependency code retain their own licenses.

## CS2 item and case catalog

- Source: https://github.com/ByMykel/CSGO-API
- Files: `skins.json`, `crates.json`, and derived `dist/catalog.json`.
- Snapshot: October 14, 2026.
- License: MIT; full upstream notice is retained in `catalog-LICENSE.txt` and included in extension builds as `CATALOG-LICENSE.txt`.

## Bundled runtime dependencies

The CSFloat inspect serializer (`@csfloat/cs2-inspect-serializer` 1.1.6) is sourced from https://github.com/csfloat/cs-inspect-serializer and is MIT licensed. Its runtime dependencies include `@protobuf-ts/runtime`, `buffer`, `crc-32`, `base64-js` and `ieee754`. Their full notices are copied into `dist/licenses/` when building, alongside legal comments in the generated JavaScript bundles.

## Development dependencies

The dependency lockfile records the exact build/test dependencies, including esbuild and jsdom. Those packages are installed from npm for development and are not shipped as standalone packages inside the extension ZIP.

Valve, Steam, Counter-Strike and CSFloat names identify compatibility and data sources; this project does not claim endorsement or ownership of their trademarks.
