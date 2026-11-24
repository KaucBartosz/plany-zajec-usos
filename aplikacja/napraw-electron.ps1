# Naprawia brakujące binarium Electrona (bled: "Electron failed to install correctly").
# Uruchom z folderu aplikacja: .\napraw-electron.ps1
$ErrorActionPreference = 'Stop'

$version = (Get-Content node_modules\electron\package.json -Raw | ConvertFrom-Json).version
$cache = "$env:LOCALAPPDATA\electron\Cache"
$zipName = "electron-v$version-win32-x64.zip"
$zip = Get-ChildItem $cache -Recurse -Filter $zipName -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $zip) {
  Write-Host "Pobieranie $zipName..."
  node -e "require('@electron/get').downloadArtifact({version:process.argv[1],artifactName:'electron',platform:'win32',arch:'x64'}).then(p=>console.log(p))" $version
  $zip = Get-ChildItem $cache -Recurse -Filter $zipName | Select-Object -First 1
}

Remove-Item -Recurse -Force node_modules\electron\dist -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force node_modules\electron\dist | Out-Null
Expand-Archive -Path $zip.FullName -DestinationPath node_modules\electron\dist -Force
Set-Content -Path node_modules\electron\path.txt -Value 'electron.exe' -NoNewline
Set-Content -Path node_modules\electron\dist\version -Value "v$version" -NoNewline
Write-Host "Electron $version gotowy."
