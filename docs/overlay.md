# Desktop companion minimap

The companion minimap is an ordinary native window above other desktop windows. It uses the same bundled frontend as the main application at `index.html?overlay=1`. Its initial size is 400 × 400 logical pixels, its minimum size is 280 × 280, and its frame is resizable without operating-system decorations. It opens without taking keyboard focus and does not add a separate taskbar entry.

Use windowed or borderless War Thunder. Exclusive fullscreen can cover ordinary always-on-top windows. The project does not inject into the game's graphics pipeline, read process memory, hook input, or modify anti-cheat behavior.

## Native commands

| Command | Allowed caller | Effect |
|---|---|---|
| `open_overlay` | Main window | Create or show the single `overlay` window; reset click-through so a reopened window can be moved |
| `close_overlay` | Main or overlay | Hide the companion window |
| `configure_overlay({ clickThrough })` | Main window | Turn native mouse click-through on or off for the existing companion window |

The frontend handles its display opacity. This changes the overlay's content, not the game window. There is no native whole-window opacity command because a portable implementation is not available through the pinned Tauri API.

The main window remains the telemetry owner. An overlay is not granted `telemetry_snapshot`, export or window-creation permission. Its frontend receives `ntl:overlay-frame` events from the main application and can announce readiness with `ntl:overlay-request-ready`. It can listen to events, send events, drag its own window and hide itself. No filesystem, shell or arbitrary HTTP capability is granted.

The nearby view highlights explicitly identified or manually marked nuclear aircraft and groups of enemy ground contacts within the chosen radius. Group alerts exclude contacts within the configured distance of the player's aiming points or point of interest. Those exclusion areas apply only to marks actually received from the game. A browser can display the same nearby view within its page, without native always-on-top or click-through behavior.

Closing the main window closes the overlay and exits the application. The overlay has no operating-system owner relationship, so minimizing the main window does not hide it. Reopening the overlay resets click-through to allow recovery without global keyboard shortcuts.

## Verification boundary

The 0.2.0 hidden native production smoke passed window creation, synthetic frame delivery and Canvas rendering, restricted telemetry/configuration access, click-through/hide/reopen/recovery commands, and bundled map loading. Native properties confirmed an undecorated always-on-top window. See [the verification record](acceptance-0.2.0.md).

These checks do not prove visual stacking or mouse routing over a running game. Exclusive fullscreen remains outside the guarantees of an ordinary companion window. Manual border resizing and in-game pointer interaction still need a physical check.
