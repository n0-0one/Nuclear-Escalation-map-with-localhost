# Known limitations of v0.1

This is a working field build, not a production-certified release.

- Automatic mission/scenario/BR, player REDFOR/BLUFOR and side layout are unavailable from the observed API. Manual controls remain necessary.
- Individual kill, damage and repair events cannot be reliably tied to source components. Manual correction is provided; no disappearance-based destruction exists.
- Static positional matching is conservative and inferred. It is opt-in after scenario/layout selection and excludes approximate/relocated positions. Same-position objects and different eras can be ambiguous.
- Convoy routes and source/destination data are real mission predictions. Generic observed ground tracks are shown separately. No automatic convoy identity or delivery completion is claimed. Convoy composition reference remains in the original legend; there is no verified live convoy component model.
- The additional planner is an approximate air route with threat penalties. It does not guarantee safety or apply terrain masking/road constraints. Use original LOS/threat cover for separate terrain inspection. Source ranges omit game effects described by upstream.
- Mission restoration timers are conditional estimates, not observed respawns. Unavailable rules display unknown. Completed timers never mark active.
- `map_generation` is not a guaranteed match ID. Same-map transitions during telemetry outages may require manual battle reset.
- Player heading is optional; unknown is displayed in the tooltip. Anonymous track identities can break at crossings or gaps and are explicitly inferred.
- Simulation tests the common position/connection/lifecycle path, with explicitly simulated SAM/radar state changes. It does not reproduce all mission mechanics or guarantee identical API behavior across game modes.
- Most upstream tools are preserved rather than reimplemented; exhaustive verification of every popup, radar type and weapon scenario is still needed. Heavy original coverage computation can block the UI at extreme settings.
- No signed Windows certificate, auto-updater, account backend, overlay or cloud telemetry storage. WebView2 must be installed for desktop; Windows 11 normally supplies it. Installer can provision the runtime on first installation, which may need internet. Subsequent launches use bundled map assets.
- Browser security may still block HTTPS-to-loopback requests despite authenticated CORS. Use native desktop when the optional bridge cannot be reached. Do not disable browser protections.
- Browser-local manual settings persist, but battle records are export-only and are not auto-restored. Native geometry persistence is limited to web map/UI settings; OS window position is not restored in this build.
- GitHub Pages publication requires the destination repository and Pages configuration. Build artifacts and workflow files alone are not proof of a deployed public URL.

See `docs/verification` and `docs/acceptance.md` for actual validation results, including remaining gameplay checks.
