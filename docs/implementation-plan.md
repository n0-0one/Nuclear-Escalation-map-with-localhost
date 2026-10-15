# Nuclear Thunder Live implementation plan

Workspace audited: empty on 2026-10-14. Source snapshot: majorlier/nuclear-thunder-interactive-map at d3b9854ed3fa065324840c2b8e7f1324837e86da.

1. Preserve the complete Leaflet map, split its embedded JS/CSS, vendor assets and Leaflet. Keep its working terrain, LOS, threat cover, roads, ranges, icons, mission routes and composition UI.
2. Add a small explicit adapter to that engine. Implement typed, independently tested battle state, coordinate conversion, conservative matching, timers, history and incremental marker updates.
3. Add direct, native and authenticated loopback bridge transports. Serial polling with per-endpoint cadence, bounded timeouts, partial failures and generation cancellation.
4. Add a collapsible live panel, manual component controls, deterministic simulation, diagnostics, timeline, target focus and route planning.
5. Bundle the same frontend with Tauri 2; share a Rust HTTP client with the optional bridge. Build on this Windows host.
6. Test the real available localhost schema, fixture regression, browser/mobile/subpath builds, bridge security and native builds. Record actual evidence and limits. Configure GitHub Actions for Pages and Windows releases.

The existing renderer remains JavaScript to reduce migration risk; new application logic is TypeScript. No React rewrite or iframe. Map state and simulation are separated. Real localhost is available during this implementation, but mission/scenario and precise per-component kill events are not present in the observed schema.

Website repository: n0-0one/Nuclear-Escalation-map-with-localhost. See the latest GitHub workflow run for deployment status and acceptance.md for executed checks. The original 0.1.0 verification record remains historical; new release claims require new evidence.

The next iteration adds clearer live contact rendering, player-relative hostility, better target/route navigation, settings, aiming-point and point-of-interest display where available, and a native companion minimap. It also adds a reviewed data-update branch based on majorlier's upstream automation. The game API's uncertainty remains explicit: unsupported BR, identity and destruction data must not be presented as confirmed.
