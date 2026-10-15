# Telemetry contract and evidence

Observed on this computer, 2026-10-14: `/map_info.json`, `/map_obj.json`, `/state`, `/indicators` returned JSON while War Thunder was in a battle. The captured fixture stays local and is excluded from Git. The committed regression fixture uses the observed schema with public mission runway geometry and a synthetic player; it contains no recorded player telemetry. No process memory access, game injection or anti-cheat interaction is used. The desktop companion minimap is a separate native window receiving the main application's frames.

`map_info`: `valid`, `map_min`, `map_max`, `grid_size`, `grid_zero`, `grid_steps`, `hud_type`, `map_generation`. `map_obj`: `type`, `icon`, `color`, `color[]`, `blink`, normalized `x/y`, optional `dx/dy`; runways instead use `sx/sy/ex/ey`. The Player icon supplies position and direction. No stable unit IDs, mission IDs, scenario ranks or destruction flags were present in that response.

`/hudmsg` without query returned HTTP 400. `/hudmsg?lastEvt=0&lastDmg=0` returned `events` and `damage` arrays. These human-readable messages may contain names and lack a verified link to each extracted static component. They are not polled, exported or turned into destruction confirmations in v0.1.

## Coordinates and identification

Telemetry is normalized from top-left: x increases east/right and y increases down. Upstream Leaflet uses `[latitude, longitude]` where latitude grows up. World conversion is `x = minX + xNorm * spanX`, `z = maxZ - yNorm * spanZ`. Archipelago spans ±131072m and City ±65536m, mapped to a 4096-unit image.

At least three unique runway centres within 350m, plus matching boundaries, establish an **inferred** map. Bounds alone never identify a map. A manual map override suppresses automatic switching; the marker is withheld when supported-map geometry is unavailable unless the user deliberately selects a compatible map.

Static unit signatures can also suggest a scenario and side layout. Matching requires at least eight compatible placements across three sites and a clear score lead; near-equal candidates remain ambiguous. The known player faction helps distinguish mirrored layouts. Runway geometry plus relative friendly/enemy colours can infer the player faction, but geometry alone cannot distinguish layouts that use the same runway positions. The user's explicit faction and BR choices take precedence.

The 2026-10-15 live comparison showed identical visible static placements for two modern BR presets, despite a known battle bracket. No BR field was available to resolve that ambiguity. The application therefore offers manual match maximum BR rather than substituting the player's own aircraft BR. Aircraft model does not establish scenario or match BR.

Live red contacts are classified as enemies, blue/green contacts as friendly, and unsupported colours remain unknown. This uses the observed default relative map-colour convention; user-customized game colours can invalidate that interpretation. Faction names do not by themselves determine hostility. Static map colours use the chosen or inferred player faction, so either NATO or USSR can be the red enemy side.

## Objectives, player marks and nuclear aircraft

The application can render explicit aiming-point records as yellow crosshairs and point-of-interest records as a red diamond. The 2026-10-15 live sample contained a point of interest but did not expose yellow aiming-point records. Synthetic fixture coverage verifies parsing and rendering inputs, not their availability in every live game mode.

An aircraft receives an automatic nuclear label only when its telemetry explicitly identifies that role. Generic aircraft icons or a potentially nuclear-capable model are insufficient. Users may label a selected aircraft manually; that source is visible in the interface. A manual label follows an estimated track and can lose identity at crossings, gaps or despawns.

Airfield and other objective state can use an explicit `destroyed`, `alive`, `health` or recognized status field if a future or supported response supplies it. The observed live schema did not establish reliable destruction fields for every airfield. Manual status remains available and mere disappearance must never become confirmed destruction. A mission/objective update is useful only when it can be matched to the correct objective without guessing.

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

The fixed native client also requests `mission.json` when available, at a slower cadence. A missing endpoint is reported as an endpoint error; it does not block unrelated object data or justify inventing a mission identifier. Independent fixed endpoints are fetched concurrently inside each serialized refresh cycle, so one unavailable endpoint does not multiply the cycle timeout.

References used for schema cross-check: [WarThunder mapinfo client source](https://github.com/PowerBroker2/WarThunder/blob/master/WarThunder/mapinfo.py), [community localhost documentation source](https://github.com/lucasvmx/WarThunder-localhost-documentation). The live local response is the authority for supported fields; this is not a guaranteed official game API contract.
