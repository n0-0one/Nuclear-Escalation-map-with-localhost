# Verification record — 0.2.1

Verification began on Windows on 2026-10-15 and continued on 2026-10-16. Raw game and HUD captures remain ignored and are excluded from source and release archives.

| Evidence | Result |
| --- | --- |
| TypeScript logic tests | 38 passed, including exact HUD-name BR discrimination, false-positive rejection, partial SAM destruction, missing contacts, fresh kill correlation, manual precedence and network gaps |
| Browser regressions | 5 passed, including automatic high-tier BR selection, swapped sides with a known faction, automatic state tracking across context changes and whole-site manual confirmation |
| Python data tests | 15 passed: six reviewed extraction regressions, six import boundaries and three feed/localization checks |
| Native Rust tests | 9 passed; the production-feed network test is an explicit separate integration check |
| Production web build | TypeScript and asset checks passed for both maps, four variants and five scenarios |
| Recorded current-match telemetry | 100 static placements across 42 sites plus an exact BUK-M3 HUD name selected `rank-40-50`; USSR selected the standard layout |
| Pinned localization | Exact short English HUD names were obtained for 80 unit models; the CSV Git blob matched the pinned provenance |
| Public website | Production checks passed on the GitHub Pages URL for both maps, ten scenario selections, four variants, terrain and assets; no browser errors or failed resources |
| Published battle replay | Captured game data replayed against the deployed 0.2.1 website selected `rank-40-50` and standard USSR layout, matched 100 static components from 268 objects and 159 HUD records, and produced no browser errors |
| Native production EXE | Hidden smoke passed with the actual published data pack: the map engine loaded the verified downloaded revision before initialization; component actions, native telemetry and overlay controls passed |
| Native capability restrictions | Overlay access to telemetry, configuration, data checks and cache bootstrap was denied as expected |
| HTTPS updater integration | The native updater downloaded the public pack, verified it, installed it, and loaded it after restarting the updater without another network request |
| Optional bridge | Eight authentication/origin/method checks passed; native loopback requests had no errors. The game had no active map objects during this final check |

The first complete feed workflow [38814785652](https://github.com/n0-0one/Nuclear-Escalation-map-with-localhost/actions/runs/38814785652) successfully generated, tested and published datamine revision `637d98be1a4d34366e6ffc40bae1d5e953dce7a6` and refreshed the draft source proposal. Its immutable data pack contains 3,317,448 bytes, with SHA-256 `332e36dd7ad5d129edbbf2d5e7704ce6e28e24b57b375f0b021c20bed46f3956`. The updater integration test is additional to the nine offline Rust tests above.

The native production check completed in approximately 1.7 seconds on this machine with the downloaded cache. Hosted map initialization measured approximately 1.1 seconds. These are individual smoke measurements, not performance guarantees. Native overlay contacts were synthetic; the BR evidence used a recorded actual battle.

Native updater tests include hash corruption, invalid paths/formats, markup rejection, scenario/variant validation, atomic cache replacement on Windows, fallback to the previous pack and bundled data, and prevention of partial installation. The frontend only overlays the twelve allowlisted local JSON requests; code and images remain bundled.

The recorded live sample demonstrates BR discrimination using actual game data. It does not prove that every game mode/language supplies the same information. Side layout still requires a faction selection when the observations are symmetric. The game did not expose reliable per-object death IDs in that sample. A HUD kill plus a uniquely missing matching component is labelled inferred; a missing marker alone is labelled possibly destroyed. Previously destroyed units that were never seen by the app require manual confirmation. The user's reported location near x=-278, z=22752 had no nearby contacts in the sampled frame; that absence alone does not identify which components were destroyed.

The proposed features in [suggestions.md](suggestions.md) were only documented.
