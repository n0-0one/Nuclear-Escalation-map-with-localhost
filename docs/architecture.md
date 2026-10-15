# Architecture

The original 6,000-line Leaflet implementation is retained as `apps/web/public/legacy.js`, with the original CSS split into `legacy.css`. Static assets live beside it with unchanged relative names. All CDN and encyclopedia fallback requests have been removed. This avoids rewriting terrain, coverage, navigation and popup behavior while shipping a self-contained application.

`scripts/import-upstream.py` imports the pinned source and injects a small, explicit map adapter from `scripts/map-adapter.js`. Re-importing intentionally replaces legacy files; review the diff. The automation branch stages data updates for review, as described in [datamine.md](datamine.md). `upstream/` is an ignored source audit checkout, not a submodule or runtime requirement.

`packages/core` holds pure TypeScript coordinate, normalization, lifecycle, matching, state, polling and route logic. `apps/web/src` owns UI, providers, map adaptation and the route worker. No React or duplicated map renderer.

`crates/war-thunder-telemetry` exposes a fixed, read-only HTTP client. Tauri and `apps/bridge` both use it. Native requests run asynchronously behind a shared client mutex with a 250ms cache. The Rust backend cannot proxy arbitrary URLs. Desktop exports are restricted to timestamped battle/diagnostic JSON files in Downloads, using create-new semantics.

## Update and resource bounds

- Map object requests use the selected update interval after the previous cycle finishes; the balanced default is 400ms. Metadata: 2s. Vehicle state: 1s. Indicators and optional mission data: 3s. No overlapping cycles; bounded timeout and exponential backoff up to 8s. Native fixed-endpoint requests run concurrently within a cycle.
- Each mode switch invalidates the previous generation and cancels browser requests. Late native results are ignored. Rust HTTP responses have a 2MiB cap.
- Player uses one marker updated with `setLatLng`. Observed tracks retain bounded recent histories, expire after six seconds and never affect destruction state. Track continuity is inferred and not a game ID.
- The timeline is limited to 500 records, diagnostics 100, manual undo 100, map object input 5,000 and rendered observations 700 per update / 900 retained tracks.
- Static component matching is disabled until the player acknowledges the scenario/layout. Matching requires a compatible radar icon, static position within 65m and 25m separation from the second candidate. Unplaced/relocated units are excluded. Even a match is only `REPORTED_ACTIVE / INFERRED`.
- Heavy new flight routing runs in a Web Worker, only on user request. Original terrain/threat tools retain upstream behavior; long operations there have not been rewritten into workers.
- UI preferences use localStorage. Battle state is memory-only and reset on new session; exports preserve a record. Pairing codes remain in memory and never enter settings or diagnostics.

## Builds

Vite builds the web frontend to `dist` with relative asset URLs. Tauri uses that directory and its production custom-protocol feature to embed assets. Release code must not point to `devUrl`. The bridge is a separate optional executable. GitHub Actions deploys only static files and does not receive live telemetry.

## Desktop companion

The native `overlay` webview loads `index.html?overlay=1` with a separate frontend bootstrap. The main window passes its existing frames over `ntl:overlay-frame`; the companion does not start a telemetry poller or load another full Leaflet map. It is an ordinary always-on-top desktop window with optional native click-through and frontend opacity, not a modification to the game renderer.

Tauri capabilities separate main-window actions from companion actions. Only the main window may poll telemetry, export files or create/configure the overlay. The overlay may receive and announce events, drag itself and hide itself. Destroying the main window closes the companion and exits the process. See [overlay.md](overlay.md) for the interface contract and verification boundary.
