$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\runtime.ps1"
    # Request graceful server shutdown so configured lights are sent off.
    $pidFile = Join-Path $runtime 'server.pid'
    if (Test-Path $pidFile) {
        $serverPid = [int](Get-Content $pidFile -Raw)
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid"
        if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.Contains((Join-Path $root 'server\index.mjs'))) {
            $response = Invoke-RestMethod 'http://127.0.0.1:6273/health' -TimeoutSec 2
            if ($response.instance -ne $instance) { throw 'The running F server belongs to another installation.' }
            # A local stop-file is scoped to this installation, never a public HTTP shutdown endpoint.
            Set-Content (Join-Path $runtime 'stop-request') $instance -Encoding ASCII
            for ($i=0; $i -lt 40; $i++) {
                if (-not (Get-Process -Id $serverPid -ErrorAction SilentlyContinue)) { break }
                Start-Sleep -Milliseconds 250
            }
            if (Get-Process -Id $serverPid -ErrorAction SilentlyContinue) { throw 'Graceful stop timed out; check server log and light state.' }
        }
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
    foreach ($role in @('table','wall','graph')) {
        $profile = Join-Path $runtime ('browser-' + $role)
        Get-CimInstance Win32_Process | Where-Object {
            $_.Name -in @('msedge.exe','chrome.exe') -and $_.CommandLine -and $_.CommandLine.Contains($profile) -and $_.CommandLine -notmatch '--type='
        } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    }
    Write-Host 'F Zone stopped. Browser calibration and reader mappings were preserved.'
} catch {
    Write-Host "F Zone: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
