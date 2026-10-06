$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\display.ps1"
    . "$PSScriptRoot\runtime.ps1"
    Set-Location $root
    Write-Host 'F Zone - Windows x64 offline setup (Wall / Table / Graph)'
    & $node -e "require('nfc-pcsc');require('ws');console.log('Bundled Windows NFC module OK')"
    if ($LASTEXITCODE -ne 0) { throw 'Bundled native module failed. Use the Windows x64 package and verify prerequisites.' }
    if (-not (Test-Path (Join-Path $root 'public\graph\index.html'))) { throw 'Missing Graph assets.' }
    if (-not (Test-Path (Join-Path $root 'server\led-settings.json'))) {
        Copy-Item (Join-Path $root 'server\led-settings.example.json') (Join-Path $root 'server\led-settings.json')
    }
    $displays = Get-FDisplays
    if ($displays.Count -lt 3) { throw 'Connect three displays and choose Extend in Windows Display Settings.' }
    for ($i=0; $i -lt $displays.Count; $i++) {
        $d=$displays[$i]
        Write-Host "$i : $($d.DeviceName) / $($d.Bounds.Width)x$($d.Bounds.Height) / X=$($d.Bounds.X), Y=$($d.Bounds.Y) / Primary=$($d.Primary)"
    }
    # These are the list indexes above, not Windows Settings monitor numbers.
    $tableIndex = [int](Read-Host 'Table display index from the list above')
    $wallIndex = [int](Read-Host 'Wall display index from the list above')
    $graphIndex = [int](Read-Host 'Graph display index from the list above')
    $indexes = @($tableIndex,$wallIndex,$graphIndex)
    if (($indexes | Where-Object { $_ -lt 0 -or $_ -ge $displays.Count }).Count -gt 0 -or ($indexes | Select-Object -Unique).Count -ne 3) {
        throw 'Select three different display indexes from the list.'
    }
    $mode = Read-Host 'Mode: live = NFC hardware, sim = rehearsal (Enter = live)'
    if (-not $mode) { $mode = 'live' }
    if ($mode -notin @('live','sim')) { throw 'Mode must be live or sim.' }
    @{ tableDisplay=$displays[$tableIndex].DeviceName; wallDisplay=$displays[$wallIndex].DeviceName; graphDisplay=$displays[$graphIndex].DeviceName; mode=$mode } |
        ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'settings.json') -Encoding UTF8
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'F Zone.lnk'))
    $shortcut.TargetPath = Join-Path $root 'Start-F.cmd'
    $shortcut.WorkingDirectory = $root
    $shortcut.Description = 'Start F Zone Wall, Table and Graph'
    $shortcut.Save()
    $stop = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Stop F Zone.lnk'))
    $stop.TargetPath = Join-Path $root 'Stop-F.cmd'
    $stop.WorkingDirectory = $root
    $stop.Save()
    Write-Host 'Setup complete. Double-click F Zone on the desktop.' -ForegroundColor Green
    Write-Host 'Allow Node.js on the Private network if Windows Firewall prompts. See the Windows guide for iPad access.'
    Read-Host 'Press Enter to close'
} catch {
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
