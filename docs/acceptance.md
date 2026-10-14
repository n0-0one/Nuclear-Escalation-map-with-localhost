# Verification record — 0.1.0

Verified on Windows 11 on 2026-10-14. This is a working field build, with the remaining limits listed below. A passing build is not evidence of every gameplay mechanic working.

## Executed checks

| Check | Result | Evidence and scope |
|---|---|---|
| TypeScript unit tests | 18 passed | Coordinates, validation, lifecycle, matching, state precedence, undo, conditional timers, bounded history, routing and poll cancellation/non-overlap |
| Rust tests | 4 passed | Telemetry wire format, stale-data removal, bearer authentication and exact origins |
| Edge browser tests | 2 passed | Maps/variants/scenarios, manual component state/undo, route creation, convoy predictions, simulation and 390×844 mobile controls |
| Production static site | Passed | `/ntl-test/` subpath, 2 maps, 10 map/scenario combinations, 4 variants and 3 icon families; no JavaScript errors, missing resources or external HTTP requests |
| Terrain and original tools | Basic checks passed | Both terrain datasets return finite heights; Measure, LOS and Flight brush UI entry points work. Numerical LOS fidelity and every tool combination were not exhaustively tested |
| Bridge integration | 8 security assertions passed | Missing/wrong bearer, wrong origin, invalid Host, method restriction and preflight. Loopback snapshot returned 249 actual game objects without endpoint errors |
| Browser with actual game | Passed, short sample | 20 updates, moving player marker, Archipelago inferred from 10 matching runway geometries, no JavaScript errors |
| Windows production build | Passed | Tauri custom-protocol EXE with bundled assets and NSIS x64 installer generated locally |
| Native launch | Passed | New EXE visually opened; final binary independently passed hidden production smoke with Vite stopped, `http://tauri.localhost`, loaded map image, map switching, component state/undo and native telemetry |
| Dependency audit | Passed at verification time | npm audit returned zero known vulnerabilities after dependency updates; this is not a general security audit |
| GitHub CI and Pages | Prepared, not deployed | Workflows are included. Remote workflow execution and a public URL require successful push and supported Pages configuration |

The final native smoke read 222 actual game objects with no endpoint errors. The current battle in that run did not match one of the two bundled maps; the frontend correctly reported unknown live map identity instead of placing the player on an unrelated map. The earlier browser/game check used Archipelago and verified the moving player marker there.

## Measurements

These are local samples on one computer, not cross-machine benchmarks or a long-duration leak test.

| Measurement | Observed |
|---|---|
| Production browser navigation to initialized map | 784 ms in the final run (475 ms in an earlier warm run) |
| Browser JS heap after scenario/tool checks | 74,839,819 bytes, about 71.4 MiB |
| Native process launch through completed smoke checks | 1,327 ms; includes telemetry invocation and map/control checks |
| Live frontend processing | Mean 7.6 ms, maximum 9.9 ms over 20 samples |
| Bridge snapshot | 32 ms in one live sample |
| Connected desktop CPU | 2.5% of one logical CPU, approximately 0.21% of the 12-thread machine over 5.01 s |
| Connected desktop memory, including WebView2 descendants | 328.15 MiB summed private memory; 625.25 MiB summed working set. Shared pages may be counted more than once |

The CPU/memory sample used the first production build open in the user's session; final smoke used the final binary with the latest component-ID fixes. The static build contains about 126 MB of local resources, 564 sites and 7,620 unit records across variants and scenarios. These are source reference counts, not live detected units.

## Acceptance boundaries

- Core map: assets are local, both maps and every preset/variant switch were exercised. Original ranges, layers, icons, roads, terrain and tools are preserved. Full numerical verification of every original tool remains pending.
- Battle integration: actual local telemetry, failure handling, optional player heading, manual selection and map inference work. Reconnection, cancellation and session-change rules have automated coverage; repeated complete live matches and ambiguous same-map outages still need gameplay testing.
- Unit tracking: separate radar/launcher/MBT/SPAA/building controls, stable source-derived keys, manual precedence and incremental marker updates are implemented. Observed positional matches are inferred and require opt-in. The API does not provide verified per-component kill identities.
- Tools: mission convoy predictions, anonymous observed tracks, flight route estimates, focus/return view, timeline/export and conditional restoration estimates are implemented. Convoy identity/delivery completion, terrain-aware optimal routing and confirmed automatic restoration are not available.
- Windows: production EXE and installer are built; the EXE was launched and tested. Installer installation/uninstallation on a clean machine, native export through the Downloads dialog flow, and long-duration shutdown/resource behavior remain manual checks. Window geometry persistence is not implemented.
- Website: production assets work under a repository subpath and offline/manual mode works without game telemetry. Browser-to-loopback policy varies; native desktop remains the reliable fallback. Public Pages deployment has not been confirmed.
- Quality: the observed test runs had no critical frontend errors. Polling is serialized, object histories and event logs are bounded, and small telemetry updates do not rebuild the base map. This does not establish absence of long-duration leaks.

## Reproduction and evidence handling

Commands are in the README. For the native check run `./tests/integration/native-smoke.ps1`; pass `-Executable` for an alternate build path. The check starts a hidden instance and waits for that process to exit. It does not close an existing user window.

Local JSON reports and screenshots are in `docs/verification/`. They are intentionally excluded from Git and source archives because live reports can contain player positions and battle details. The captured API response is also excluded. Checked-in tests use a synthetic fixture generated from public map geometry; no game login, pairing secret or live telemetry is needed to run the unit tests. The numeric results above contain no player identifiers or live coordinates.

See [limitations.md](limitations.md) for the full feature boundaries and [telemetry.md](telemetry.md) for confidence semantics.
