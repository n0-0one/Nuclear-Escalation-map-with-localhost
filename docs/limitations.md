# Known limitations

This is a working field build, not a production-certified release.

- Automatic scenario and side detection require distinct static-placement evidence; identical modern-era layouts leave BR ambiguous. The observed API has no reliable match maximum BR field. Manual BR/faction controls remain necessary, and the player's own aircraft BR is not used as a substitute.
- Relative live colours use the observed default game colour convention. Customized game colours may make friendly/enemy inference incorrect. A faction name alone never determines hostility.
- Individual kill, damage and repair events cannot be reliably tied to source components. Manual correction is provided; no disappearance-based destruction exists.
- Static positional matching is conservative and inferred. It is opt-in after scenario/layout selection and excludes approximate/relocated positions. Same-position objects and different eras can be ambiguous.
- Convoy routes and source/destination data are real mission predictions. Generic observed ground tracks are shown separately. No automatic convoy identity or delivery completion is claimed. Convoy composition reference remains in the original legend; there is no verified live convoy component model.
- The additional planner is an approximate air route with threat penalties. It does not guarantee safety or apply terrain masking/road constraints. Use original LOS/threat cover for separate terrain inspection. Source ranges omit game effects described by upstream.
- Mission restoration timers are conditional estimates, not observed respawns. Unavailable rules display unknown. Completed timers never mark active.
- `map_generation` is not a guaranteed match ID. Same-map transitions during telemetry outages may require manual battle reset.
- Player heading is optional; unknown is displayed in the tooltip. Anonymous track identities can break at crossings or gaps and are explicitly inferred.
- Aiming points and the point of interest can only appear when exposed by the local API. The latest observed sample supplied a point of interest but no yellow aiming-point records. Nuclear aircraft require an explicit identifier or a visibly manual user label; generic aircraft cannot be reliably classified as nuclear.
- Airfield disappearance is not destruction evidence. Explicit objective status can be applied only when it identifies the correct objective; unsupported airfield state remains unknown or manually recorded.
- Simulation tests the common position/connection/lifecycle path, with explicitly simulated SAM/radar state changes. It does not reproduce all mission mechanics or guarantee identical API behavior across game modes.
- Most upstream tools are preserved rather than reimplemented; exhaustive verification of every popup, radar type and weapon scenario is still needed. Heavy original coverage computation can block the UI at extreme settings.
- The desktop companion minimap is an ordinary always-on-top window. It requires windowed or borderless game mode for reliable visibility and cannot promise to appear over exclusive fullscreen. It has no game injection or global keyboard hooks. A static website cannot provide the native always-on-top behavior.
- No signed Windows certificate, automatic application installer updates, account backend or cloud telemetry storage. Data-update automation is separate from installing a new application version. WebView2 must be installed for desktop; Windows 11 normally supplies it. The installer can provision the runtime on first installation, which may need internet. Subsequent launches use bundled map assets.
- Browser security may still block HTTPS-to-loopback requests despite authenticated CORS. Use native desktop when the optional bridge cannot be reached. Do not disable browser protections.
- Browser-local manual settings persist, but battle records are export-only and are not auto-restored. Native geometry persistence is limited to web map/UI settings; OS window position is not restored in this build.
- GitHub Pages publication requires the destination repository and Pages configuration. Build artifacts and workflow files alone are not proof of a deployed public URL.

See `docs/verification` and `docs/acceptance.md` for actual validation results, including remaining gameplay checks.
