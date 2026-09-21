$ErrorActionPreference = "Stop"

$deployEnvPath = Join-Path $PSScriptRoot ".env.deploy.local"
if (-not (Test-Path -LiteralPath $deployEnvPath)) {
  throw "Crie o arquivo .env.deploy.local usando .env.deploy.example como modelo."
}

Get-Content -LiteralPath $deployEnvPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
    $parts = $line.Split("=", 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name -and $value) {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

# Evita publicar em um projeto diferente do usado pelo aplicativo: se o campo
# estiver vazio, extrai automaticamente o Reference ID da VITE_SUPABASE_URL.
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_PROJECT_REF)) {
  $appEnvPath = Join-Path $PSScriptRoot ".env.local"
  if (Test-Path -LiteralPath $appEnvPath) {
    $urlLine = Get-Content -LiteralPath $appEnvPath | Where-Object { $_ -match '^VITE_SUPABASE_URL=' } | Select-Object -First 1
    if ($urlLine) {
      $url = $urlLine.Split("=", 2)[1].Trim().Trim('"').Trim("'")
      if ($url -match '^https://([a-z0-9]+)\.supabase\.co') {
        [Environment]::SetEnvironmentVariable("SUPABASE_PROJECT_REF", $matches[1], "Process")
      }
    }
  }
}

$required = @(
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET"
)

$missing = @($required | Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) })
if ($missing.Count -gt 0) {
  throw "Preencha estes campos no arquivo .env.deploy.local: $($missing -join ', ')"
}

$projectRef = $env:SUPABASE_PROJECT_REF.Trim()
$functionBase = "https://$projectRef.supabase.co/functions/v1"

Write-Host "Vinculando o projeto Supabase do Simplifica Oficina..."
npx.cmd --yes supabase@latest link --project-ref $projectRef --password $env:SUPABASE_DB_PASSWORD
if ($LASTEXITCODE -ne 0) { throw "Falha ao vincular o projeto Supabase." }

Write-Host "Aplicando migrations de banco e segurança..."
npx.cmd --yes supabase@latest db push --password $env:SUPABASE_DB_PASSWORD
if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar as migrations. As funções não serão publicadas." }

Write-Host "Configurando segredos das cobranças..."
npx.cmd --yes supabase@latest secrets set `
  "MP_ACCESS_TOKEN=$env:MP_ACCESS_TOKEN" `
  "MP_WEBHOOK_SECRET=$env:MP_WEBHOOK_SECRET" `
  "MP_WEBHOOK_URL=$functionBase/mercadopago-webhook" `
  "MP_BACK_URL=$functionBase/checkout-return" `
  --project-ref $projectRef
if ($LASTEXITCODE -ne 0) { throw "Falha ao configurar os segredos das Edge Functions." }

Write-Host "Publicando Edge Functions..."
@("create-checkout", "manage-store-users", "mercadopago-webhook", "checkout-return") | ForEach-Object {
  npx.cmd --yes supabase@latest functions deploy $_ --project-ref $projectRef
  if ($LASTEXITCODE -ne 0) { throw "Falha ao publicar a Edge Function $_." }
}

Write-Host "Supabase do Simplifica Oficina publicado com sucesso."
