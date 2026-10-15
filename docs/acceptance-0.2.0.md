# Verification record — 0.2.0

Executed on Windows on 2026-10-15. Raw game samples, local reports and screenshots remain ignored and are not included in source or release archives.

## Automated checks

| Check | Result and scope |
|---|---|
| TypeScript and production build | Passed; four variants, five scenarios, 564 sites, 7,620 unit records across scenarios; approximately 126 MB of bundled resources |
| Core logic | Thirty tests passed, including ambiguous BR, relative teams, mark parsing, exclusion groups, missing airfields, and explicit destruction across every runway |
| Browser integration | Four tests passed in Edge: static tools/routes, 390px layout, live fixtures/settings/manual BR/manual nuclear/airfields, marks/exclusions and rejection of unrelated-map overlay data |
| Rust unit tests | Four passed for bridge authorization/origins and telemetry error handling/wire format |
| Bridge integration | Eight security assertions passed; actual local snapshot returned without endpoint errors |
| Datamine updater | Six import-boundary tests and six upstream extraction tests passed; candidate schema validated 564 sites and 8,600 total components |
| Real datamine check-only run | Generated and validated candidate changes against revision `53c949137a919ce76097d174940df9436e519177`; four City JSON files and provenance lock differed; app data remained unchanged |
| Native production smoke | Bundled `http://tauri.localhost` frontend, map images, component action and native telemetry passed. Hidden companion window received synthetic frames and painted a group. Native properties confirmed always-on-top and no decorations. Overlay telemetry/configuration calls were denied. Main-window click-through, hide/reopen and recovery commands succeeded. |

The native smoke completed in approximately 2.2 seconds in the initial 0.2.0 run and read 259 actual game objects without endpoint errors. Startup timing varies with the machine and cache. The overlay part used synthetic contacts so its expected group count was deterministic.

## Live evidence

A user-confirmed Archipelago match was BR 13.3–14.3, USSR on the lower-left side. Its sample contained 331 objects and a red point of interest. Standard-layout matching found 176 units across 56 sites, but both modern presets tied. The app therefore cannot honestly infer the exact BR from that sample. Entering maximum BR 14.3 selects `rank-40-50`; sides can still be checked independently.

The API's default colours in the sample matched red enemies, blue friendlies and green squad contacts. This does not verify custom in-game colour configurations. A later active sample again exposed POI but no separate yellow aiming-point records, despite the user having set both marks. The parser and renderer support explicit aiming-point/waypoint inputs; their actual availability in that match is not established.

The live schema did not provide nuclear-payload flags or airfield health/destruction flags. Generic Fighter/Bomber markers are never automatically labelled nuclear. A manual nuclear label stays visibly manual. Missing airfield markers remain missing, with manual destruction available.

## Performance evidence

One replayed live frame with 310 tracks used 464 spatial comparisons and approximately 1.9 ms of main frame processing. This is a sample, not a guaranteed frame rate or a measurement of total game performance. Canvas paths, bounded trails, a 30 fps interpolation ceiling and concurrent fixed-endpoint polling reduce avoidable work. Users can lower update frequency and trail length.

## Remaining physical checks

The hidden native test verifies window configuration and command paths, not visual stacking over an exclusive-fullscreen game, mouse routing during actual play, manual native border resizing or game-specific completeness of reported marks. Use windowed/borderless mode. No unreported game objects are reconstructed.

GitHub Actions and the public website are verified separately after publication. Use the latest main-commit checks instead of historical failed runs. The four core website checks are web validation, Rust validation, Pages build and Pages deployment.
