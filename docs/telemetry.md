# Telemetry contract and evidence

Observed on this computer, 2026-10-14: `/map_info.json`, `/map_obj.json`, `/state`, `/indicators` returned JSON while War Thunder was in a battle. The captured fixture stays local and is excluded from Git. The committed regression fixture uses the observed schema with public mission runway geometry and a synthetic player; it contains no recorded player telemetry. No process memory access, injection, in-game overlay or anti-cheat interaction is used.

`map_info`: `valid`, `map_min`, `map_max`, `grid_size`, `grid_zero`, `grid_steps`, `hud_type`, `map_generation`. `map_obj`: `type`, `icon`, `color`, `color[]`, `blink`, normalized `x/y`, optional `dx/dy`; runways instead use `sx/sy/ex/ey`. The Player icon supplies position and direction. No stable unit IDs, mission IDs, scenario ranks or destruction flags were present in that response.

`/hudmsg` without query returned HTTP 400. `/hudmsg?lastEvt=0&lastDmg=0` returned `events` and `damage` arrays. These human-readable messages may contain names and lack a verified link to each extracted static component. They are not polled, exported or turned into destruction confirmations in v0.1.

## Coordinates and identification

Telemetry is normalized from top-left: x increases east/right and y increases down. Upstream Leaflet uses `[latitude, longitude]` where latitude grows up. World conversion is `x = minX + xNorm * spanX`, `z = maxZ - yNorm * spanZ`. Archipelago spans ±131072m and City ±65536m, mapped to a 4096-unit image.

At least three unique runway centres within 350m, plus matching boundaries, establish an **inferred** map. Bounds alone never identify a map. Mirrored missions share runway geometry, so side layout remains manual. Colours are configurable and do not establish REDFOR/BLUFOR. Aircraft model does not establish scenario or BR. A manual map override suppresses automatic switching; the marker is withheld when supported-map geometry is unavailable unless the user deliberately selects a compatible map.

Active battle evidence requires a valid map and Player or valid vehicle state. Sustained explicitly invalid map AND vehicle state for 3 seconds ends a session; lack of telemetry does not. Three consistent changes to bounds/generation infer a new session. The API does not provide a reliable unique battle ID: consecutive same-map matches that keep the same generation and lack an observed inactive interval require **Start a new manual battle**.

## Evidence semantics

- Static layouts and ranges are mission references, never live states.
- Manual actions record source and timestamp, and positional inference cannot overwrite them.
- Presence at a unique compatible position is inferred reported activity, not guaranteed weapon readiness.
- Disappearance never confirms death. Old observations retain their last-seen time.
- Full site destruction requires every known component to be marked destroyed. Partial destruction yields degraded/damaged. Unknown components stay unknown.
- Timers derive from extracted mission/template rules; conditional depot/repair behavior is labelled. Reaching zero only means restoration is possible. No timer promotes a unit to confirmed active. Ending a match invalidates timers; a timeout does not fabricate a match end.

## Transport

Direct browser access depends on game CORS and browser local-network rules. Failure is explicit. Bridge: `127.0.0.1:8112`, fixed `/v1/snapshot`, exact Origin and Host checks, ephemeral 256-bit bearer code, no wildcard CORS. Pass `--origin https://USER.github.io` for your hosting origin (no repository path). Permissions for local-network access, if requested by the browser, are the user's decision. No cloud relay or remote access to visitors' localhost exists. Tauri invokes the native client directly without the bridge.

References used for schema cross-check: [WarThunder mapinfo client source](https://github.com/PowerBroker2/WarThunder/blob/master/WarThunder/mapinfo.py), [community localhost documentation source](https://github.com/lucasvmx/WarThunder-localhost-documentation). The live local response is the authority for supported fields; this is not a guaranteed official game API contract.
