# Automatic War Thunder data updates

The map and mission-data extraction originate from [majorlier's Nuclear Thunder Interactive Map](https://github.com/majorlier/nuclear-thunder-interactive-map). This project's scheduled updater follows majorlier's [automation/datamine-update workflow](https://github.com/majorlier/nuclear-thunder-interactive-map/tree/automation/datamine-update): generate a candidate, validate it, then open a draft update proposal on a separate branch.

## What runs automatically

The **Check War Thunder datamine** workflow runs daily at **05:23 UTC** and can also be started from GitHub Actions. GitHub may delay scheduled jobs. It runs only on the `main` branch of `n0-0one/Nuclear-Escalation-map-with-localhost`; the Windows distribution repository does not open duplicate proposals.

1. Resolve the current `master` commit of [gszabi99/War-Thunder-Datamine](https://github.com/gszabi99/War-Thunder-Datamine). A manual run can specify a full commit SHA instead.
2. Download the mission, template, runtime-rule, localization and unit-specification inputs needed by the reviewed extractor. Every run uses one pinned datamine revision.
3. Generate all four map variants, scenario presets, mission rules and unit details in a temporary directory.
4. Validate all candidate JSON before copying any file into the app. Verify finite coordinates, known map variants, scenario coverage, unique site names, component lifecycle values, unit model names and source provenance.
5. Run the application tests, production build and browser tests. A changed datamine commit alone does not create a data update.
6. Publish the validated data patch to `automation/datamine-update` and create or update a **draft pull request**. The generation report appears in the workflow summary.

7. Publish a validated JSON pack and SHA-256 manifest on `codex/windows-data-v1`. Installed Windows applications from version 0.2.1 check this feed automatically. Publication happens only after the generation job and its tests succeed; it does not wait for the source PR to merge.

The workflow does **not** merge its own proposal. Review the changed scenarios and map preview, mark the proposal ready, then merge it. This matches majorlier's draft-review process. A normal merge into `main` runs the web/Rust checks and publishes the new website. Windows apps use the separately validated data feed described below. Changes to executable code, supported map formats or bundled artwork still require a new release.

## Automatic updates in Windows

Install version **0.2.1 or later once**. Older executables do not contain the updater. The app loads its verified cache before starting the map, checks for new data shortly after launch and repeats the check every four hours while running. **Settings → Automatic mission data → Check data now** starts a manual check and shows the loaded revision and result.

Updates become active on the **next app launch**. The current battle, map and notes are not reset by a background download. An app that is closed checks again when opened. Offline startup uses the last valid cache or the bundled map.

The fixed feed is hosted in this project's web repository on `codex/windows-data-v1`. The native updater accepts HTTPS from the fixed GitHub raw-content path, refuses redirects, limits response size, verifies the exact SHA-256 hash and validates the supported JSON schema. It accepts exactly twelve data files. It cannot download an EXE, script, installer, terrain image or an arbitrary user-supplied URL.

Data is stored under `%LOCALAPPDATA%\io.nuclearthunder.live\datamine-v1`. Downloads are validated before installation and committed through atomic file replacement. The app keeps the previous verified pack as a fallback; an invalid cache falls back to it or the bundled resources. No game data, HUD text or pairing code is sent with update requests. The overlay cannot invoke the updater or read its cache. SHA-256 checks integrity against the manifest delivered over HTTPS; it is not a separate publisher signature.

## Data-only import boundary

Exactly twelve JSON files in `apps/web/public` may change automatically:

- `map_data.json`, `map_data_mirror.json`, `map_data_city.json`, `map_data_city_mirror.json`
- `mission_logic.json`, `mission_logic_mirror.json`, `mission_logic_city.json`, `mission_logic_city_mirror.json`
- `presets.json`, `unit_specs.json`, `unit_display_names.json`, `datamine-lock.json`

The live renderer, adapter hooks, application interface, desktop integration, workflows, local terrain and artwork are preserved. Automatic terrain extraction or artwork conversion is outside this updater: those assets need their dedicated extraction tools and visual review. A newly introduced map variant fails validation until the app explicitly supports it.

The extractor source is vendored under `scripts/datamine/tools`, unchanged from majorlier commit `d3b9854ed3fa065324840c2b8e7f1324837e86da`. The referenced automation branch was inspected at `7ae7a517bc3e883b2f3e3989d864f93804c7fac8`; its differences were generated data, not new executable tooling. `scripts/datamine/provenance.json` records the source and SHA-256 hashes of the reviewed files. Hashing normalizes Windows line endings. Future extractor changes require a source review and a refreshed manifest; a scheduled run never downloads or executes updated scripts from a moving branch.

After upstream extraction, our `hud_names.py` attaches exact English short names from the same pinned localization file to `unit_specs.json`. It verifies the source Git blob hash from the datamine lock before reading the CSV. These aliases support HUD kill correlation and BR detection and update with the normal data feed.

The generation job has read-only repository permissions. The separate proposal job receives `contents: write` and `pull-requests: write`; the separate Windows feed publication job receives only `contents: write`, after validation succeeds. No personal access token is required. GitHub suppresses ordinary workflow runs caused by its own `GITHUB_TOKEN`, so the generation job runs the candidate's tests itself before opening the proposal. Do not treat the absence of additional PR-triggered checks as additional test evidence.

## Repository setup

In the web repository, enable **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**. This setting permits PR creation; the workflow does not approve its own PR. Keep the default token permission read-only: each job requests only what it needs. An organization policy may restrict this setting.

The named automation branch is retained after a merge (`delete-branch: false`). It can initially point to `main`; the first successful update refreshes it. Run the workflow manually once after setup and inspect its result. Scheduled workflows in public repositories can be disabled by GitHub after prolonged inactivity; re-enable the workflow if GitHub displays that status.

For the web repository, **Settings → Pages → Source** must be **GitHub Actions**. The four core checks remain `web`, `rust`, Pages `build` and Pages `deploy`. Page publication is deliberately skipped in `Nuclear-Escalation-map-with-localhost-app`, where only the desktop distribution is hosted.

The earlier Pages failure on `98ae04f` was a `configure-pages` 404 while Pages was not enabled. The subsequent run completed both `build` and `deploy` successfully, while `web` and `rust` also passed. Old failed runs stay in GitHub history; use the latest completed job for each check on the current commit.

## Local verification

From the project root, using Python 3.12+:

```sh
python scripts/datamine/tools/test_mission_extraction.py
python scripts/datamine/test_update.py
python scripts/datamine/update.py --validate-only
python scripts/datamine/update.py --check
```

`--check` performs real download and regeneration without modifying application data. The review report is written to ignored `.local/datamine-update-report.md`. Run without `--check` to import a candidate locally, then run `npm test`, `npm run build` and `npm run test:browser` before publishing it. `--commit FULL_SHA` makes a run reproducible. GitHub Actions supplies an ephemeral token for API rate limits; a local run can use a `GITHUB_TOKEN` environment variable without writing it to a file or log.

The six updater regression tests verify renderer preservation, check-only behavior, rejection before any partial import, duplicate site/scenario errors, unknown map rejection and no-op commit changes. The six upstream extraction regressions cover mission templates, carrier imports, ship placement and rank-bound MLRS spawns.
