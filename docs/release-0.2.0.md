# Nuclear Thunder Live 0.2.0

This release improves live contact visibility, player-relative sides, battle controls and nearby awareness in both the website and the Windows application. The original map, mission resources and tools are by [majorlier](https://github.com/majorlier/nuclear-thunder-interactive-map).

## Downloads

- **Nuclear-Thunder-Live-Setup.exe** installs the Windows app and offers WebView2 installation when needed.
- **Nuclear-Thunder-Live-0.2.0-Windows.zip** includes the portable application, optional browser bridge and documentation. Extract it before starting the app.
- **Nuclear-Thunder-Live.exe** is the portable application with its map assets bundled.
- **ntl-bridge.exe** is optional for the browser version. The desktop app connects directly to War Thunder.
- Web and Source ZIPs contain the standalone static website and buildable source respectively.
- **SHA256SUMS.txt** and **manifest.json** record package hashes and sizes.

The public website is [Nuclear Thunder Live](https://n0-0one.github.io/Nuclear-Escalation-map-with-localhost/). Windows releases are unsigned and require Microsoft Edge WebView2.

## Changes

- Enemy contacts are red and friendly contacts are blue regardless of faction. Static sites use your selected or inferred side; live contacts use the game's relative colours.
- Moving vehicles use Canvas rendering, spatial track matching, bounded trails and optional smooth movement. Aircraft are larger; nuclear aircraft receive a ring and label when identified explicitly or marked manually.
- Battle settings can be inferred from distinct mission placements. The new maximum-BR field provides a quick fallback: enter **14.3** for a **13.3–14.3** match. Ambiguous presets remain explicit.
- Airfields show visible, missing or destroyed evidence. A missing marker alone never confirms destruction. Manual destruction and reset controls are available.
- Settings persist update speed, marker scale, trail length, smooth movement and mark visibility. Contacts and convoy routes have selection, focus and follow controls.
- Your red point of interest and supported yellow aiming-point records are rendered separately from vehicles.
- The nearby map shows discovered aircraft and enemy ground groups. Groups near your reported personal marks are excluded. Radius, group threshold, exclusion distance and opacity are adjustable.
- Windows adds a movable, resizable, transparent companion minimap with always-on-top and click-through controls. Reopen it from the main window to restore mouse controls. Use windowed or borderless game mode.
- Documentation is English and credits majorlier without claiming a private permission agreement.
- Daily datamine checks generate a validated draft update on `automation/datamine-update`, following majorlier's review workflow. Updates do not replace our interface or automatically merge into main.

## Evidence and limits

See [the 0.2.0 verification record](https://github.com/n0-0one/Nuclear-Escalation-map-with-localhost/blob/main/docs/acceptance-0.2.0.md). Live telemetry and recorded replay checks establish contact/POI handling, but the observed API did not expose a match BR, yellow aiming-point records, reliable aircraft nuclear roles or explicit airfield death flags. Manual controls and unknown states cover those gaps. Synthetic tests prove handling of supported fields, not that War Thunder always supplies them.

The browser nearby map stays inside its page. Native always-on-top and click-through require the Windows application. The overlay uses normal Windows window management; exclusive fullscreen and actual pointer routing over a running game are not certified by the hidden smoke test.
