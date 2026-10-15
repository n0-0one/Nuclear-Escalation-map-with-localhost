param([string]$Executable = './target/release/ntl-desktop.exe')
$ErrorActionPreference = 'Stop'
$started = [DateTime]::UtcNow
$timer = [Diagnostics.Stopwatch]::StartNew()
$application = Start-Process -FilePath (Resolve-Path -LiteralPath $Executable) -ArgumentList '--smoke-test' -WindowStyle Hidden -PassThru
# Wait for this application, not an entire WebView2 process tree. Shared browser
# helper processes can outlive the Tauri window and make Start-Process -Wait hang.
if (-not $application.WaitForExit(60000)) {
    Stop-Process -Id $application.Id -ErrorAction SilentlyContinue
    throw 'Native smoke process exceeded 60 seconds'
}
$timer.Stop()
if ($application.ExitCode -ne 0) { throw "Native smoke exited with code $($application.ExitCode)" }
$reportFile = Get-Item -LiteralPath 'docs/verification/native-smoke.json'
if ($reportFile.LastWriteTimeUtc -lt $started.AddSeconds(-1)) { throw 'Native smoke report is stale' }
$report = Get-Content -LiteralPath $reportFile.FullName -Raw | ConvertFrom-Json
if (-not $report.success -or $report.origin -ne 'http://tauri.localhost' -or -not $report.loadedImage) { throw 'Bundled native frontend validation failed' }
if (-not $report.overlay.success -or -not $report.overlayWindow.alwaysOnTop -or $report.overlayWindow.decorated -or -not $report.overlayRecoveryCommands) { throw 'Native overlay validation failed' }
$summary = [ordered]@{
    success = $true
    processToCompletedChecksMs = $timer.ElapsedMilliseconds
    origin = $report.origin
    loadedImage = $report.loadedImage
    componentAction = $report.componentAction
    telemetryObjects = $report.nativeTelemetry.objects
    telemetryErrors = $report.nativeTelemetry.errors
    overlay = $report.overlay
    overlayWindow = $report.overlayWindow
    overlayRecoveryCommands = $report.overlayRecoveryCommands
}
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath 'docs/verification/native-summary.json' -Encoding utf8
$summary | ConvertTo-Json -Depth 5
