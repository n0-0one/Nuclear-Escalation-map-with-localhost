$ErrorActionPreference = 'Stop'

# Microsoft documents these Evergreen Runtime detection keys at:
# https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution
function Get-WebViewRuntimeVersion {
    $client = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    foreach ($key in @(
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$client",
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$client",
        "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$client"
    )) {
        $version = (Get-ItemProperty -LiteralPath $key -Name pv -ErrorAction SilentlyContinue).pv
        if ($version -and $version -ne '0.0.0.0') { return $version }
    }
    return $null
}

$runtimeVersion = Get-WebViewRuntimeVersion
if ($runtimeVersion) {
    Write-Output "WebView2 Runtime is available: $runtimeVersion"
    return
}
if ($env:GITHUB_ACTIONS -ne 'true') {
    throw 'WebView2 Runtime is missing. Install the application using its Windows installer before running the native smoke test.'
}

Write-Output 'WebView2 Runtime is missing on this CI runner; installing the Microsoft Evergreen Runtime.'
$bootstrapper = Join-Path $env:RUNNER_TEMP 'NuclearThunder-WebView2Setup.exe'
Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrapper
$signature = Get-AuthenticodeSignature -LiteralPath $bootstrapper
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    throw 'The WebView2 bootstrapper does not have a valid Microsoft signature.'
}
$installer = Start-Process -FilePath $bootstrapper -ArgumentList '/silent', '/install' -WindowStyle Hidden -PassThru
if (-not $installer.WaitForExit(120000)) {
    Stop-Process -Id $installer.Id -ErrorAction SilentlyContinue
    throw 'WebView2 Runtime installation exceeded 120 seconds.'
}
$runtimeVersion = Get-WebViewRuntimeVersion
if (-not $runtimeVersion) { throw "WebView2 Runtime is unavailable after installation (exit $($installer.ExitCode))." }
Write-Output "WebView2 Runtime is ready: $runtimeVersion"
