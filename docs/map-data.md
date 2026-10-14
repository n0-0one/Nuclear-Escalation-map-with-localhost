# Map content and import

Source: majorlier/nuclear-thunder-interactive-map, commit `d3b9854ed3fa065324840c2b8e7f1324837e86da`. Import keeps map images, both terrain sets, unit artwork/icons, all generated mission metadata, road splines, City navigation mesh, presets, unit specifications and display names. DDS source artwork and upstream automatic-update tooling are not shipped; PNG equivalents are bundled. The untouched upstream README and datamine lock retain provenance.

Actual variant IDs: `standard`, `mirror`, `city`, `city_mirror`. Presets are loaded from `presets.json`: `rank-0-26` (1970 Early), `rank-27-30` (1970 Late), `rank-31-36` (1980), `rank-37-39` (2018 1), `rank-40-50` (2018 2). Scenario labels and unit lists are never embedded in the new UI.

The original scenario BR labels are retained as static mission rank-derived reference values, not detected matchmaking values. Event minimum 8.7 and rank conversion are inherited upstream conventions; they are not a report of the current battle.

Stable component keys are `variant|scenario|site.name|unit-or-building|sourceId-or-arrayIndex`. Source IDs are preserved where present, including strategic missile systems. Most component records do not have a reliable ID, so their pinned array index is used. These keys separate identical units and namespace scenarios and variants. A future data import may change ordering; do not reuse old state across data revisions. Battle state is not automatically restored from exports.

Original functionality retained: maps, side swaps, five scenarios, NATO/WT/Pact icon families, site clustering and detailed units, runway/fleet geometry, SAM/weapon/radar rings, terrain/topography, road layers, City navmesh route reconstruction, convoy and armoured-column predictions, depots, compositions, reload/respawn reference, ruler, LOS, flight brush and threat coverage. New state opacity overlays annotate markers without replacing their symbols.

New route planner is a 96×96 flight grid with distance plus threat penalties, not a road navigation or terrain-optimal solver. Original mission convoy routes still use extracted roads/navmesh. Destroyed units are omitted from new planner penalties; unknown threats are included by default. Original reference range/coverage layers remain static and do not imply that all shown units are currently active.
