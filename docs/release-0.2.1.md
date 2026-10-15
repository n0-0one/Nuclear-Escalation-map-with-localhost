# Nuclear Thunder Live 0.2.1

Installed Windows apps can now automatically download validated War Thunder mission-data updates. This release also fixes automatic SAM state tracking and improves BR/layout detection for both Windows and the website. The map and extraction tools originate from [majorlier's Nuclear Thunder Interactive Map](https://github.com/majorlier/nuclear-thunder-interactive-map).

- Install **Nuclear-Thunder-Live-Setup.exe**, or extract **Nuclear-Thunder-Live-0.2.1-Windows.zip** and start the application. This one-time upgrade adds the data updater; future compatible JSON updates do not require a new installer.
- The app checks the validated data feed at startup and every four hours. Downloaded data loads on the next launch, preserving the current battle. Settings shows the loaded revision and offers **Check data now**. Invalid or unavailable downloads leave the current data usable.
- SAM/ground-unit matching is enabled by default and stays enabled across map and bracket changes. Explicit destruction is respected. A fresh HUD kill can identify one recently missing component; this positional association remains labelled inferred. Disappearance alone is shown as possibly destroyed.
- Automatic BR detection now uses exact static-unit names from the HUD alongside mission geometry. This can distinguish otherwise identical high-tier radar signatures. Selecting a BR manually no longer disables side-layout detection. Choose **My faction** if mirrored layouts remain indistinguishable from telemetry.
- **Mark whole site destroyed** records your confirmation for every component. A partially destroyed site stays damaged.

The public website is [Nuclear Thunder Live](https://n0-0one.github.io/Nuclear-Escalation-map-with-localhost/). Browser telemetry needs local-network access or the included optional bridge. Windows releases are unsigned and require WebView2.

See the [data-update behavior](https://github.com/n0-0one/Nuclear-Escalation-map-with-localhost/blob/main/docs/datamine.md) and [verification record](https://github.com/n0-0one/Nuclear-Escalation-map-with-localhost/blob/main/docs/acceptance-0.2.1.md). [Feature suggestions](https://github.com/n0-0one/Nuclear-Escalation-map-with-localhost/blob/main/docs/suggestions.md) are documented only and have not been implemented.
