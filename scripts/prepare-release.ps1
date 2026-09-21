param(
  [string]$Notes = "Atualizacoes e melhorias do Simplifica Oficina.",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$tauriConfigPath = Join-Path $projectRoot "src-tauri\tauri.conf.json"
$tauriConfig = Get-Content -Raw -Encoding UTF8 $tauriConfigPath | ConvertFrom-Json
$version = [string]$tauriConfig.version

if (-not $version) {
  throw "Nao foi possivel ler a versao em src-tauri/tauri.conf.json."
}

if (-not $SkipBuild) {
  Push-Location $projectRoot
  try {
    & bun run tauri build
    if ($LASTEXITCODE -ne 0) {
      throw "O build do Tauri falhou com codigo $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

$nsisDirectory = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis"
$installer = Get-ChildItem -Path $nsisDirectory -Filter "*-setup.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $installer) {
  throw "Instalador NSIS nao encontrado em $nsisDirectory. Execute o build sem -SkipBuild."
}

$signaturePath = "$($installer.FullName).sig"
if (-not (Test-Path -LiteralPath $signaturePath)) {
  throw "Assinatura nao encontrada: $signaturePath. Confira TAURI_SIGNING_PRIVATE_KEY_PATH e TAURI_SIGNING_PRIVATE_KEY_PASSWORD no .env.local."
}

$releaseDirectory = Join-Path $projectRoot "release\v$version"
New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null

$releaseInstallerName = "Simplifica.Oficina_${version}_x64-setup.exe"
$releaseInstallerPath = Join-Path $releaseDirectory $releaseInstallerName
$releaseSignaturePath = "$releaseInstallerPath.sig"
Copy-Item -LiteralPath $installer.FullName -Destination $releaseInstallerPath -Force
Copy-Item -LiteralPath $signaturePath -Destination $releaseSignaturePath -Force

$signature = (Get-Content -Raw -Encoding UTF8 $signaturePath).Trim()
$downloadUrl = "https://github.com/gbtrajano/simplificaoficina.json/releases/download/v$version/$releaseInstallerName"
$latest = [ordered]@{
  version = $version
  notes = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url = $downloadUrl
    }
  }
}

$latestJsonPath = Join-Path $releaseDirectory "latest.json"
$latest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $latestJsonPath

Write-Host ""
Write-Host "Release v$version preparada em: $releaseDirectory" -ForegroundColor Green
Write-Host "1. Crie a release v$version em https://github.com/gbtrajano/simplificaoficina.json/releases/new"
Write-Host "2. Envie $releaseInstallerName e $releaseInstallerName.sig como assets."
Write-Host "3. Coloque o latest.json gerado na raiz da branch main desse repositorio."
