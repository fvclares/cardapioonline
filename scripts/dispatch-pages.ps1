# Dispara o workflow Deploy to GitHub Pages (workflow_dispatch).
# Uso: ./scripts/dispatch-pages.ps1 -Phase complete [-Ref main]
# O token vem do credential helper do git; nunca é impresso.
param(
  [ValidateSet('admin-only', 'complete')]
  [string]$Phase = 'complete',
  [string]$Ref = 'main'
)
$ErrorActionPreference = 'Stop'
$sha = (git rev-parse "origin/$Ref").Trim()
$fillInput = "protocol=https`nhost=github.com`n"
$cred = $fillInput | git credential fill
$user = ($cred | Select-String '^username=(.*)$').Matches.Groups[1].Value
$pass = ($cred | Select-String '^password=(.*)$').Matches.Groups[1].Value
if (-not $pass) { Write-Output 'NO_CREDENTIAL'; exit 1 }
$pair = "$user`:$pass"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
# limpa da memória as variáveis com o segredo
$user = $null; $pass = $null; $pair = $null
$body = @{ ref = $Ref; inputs = @{ phase = $Phase; public_base_ref = $sha } } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Post `
    -Uri 'https://api.github.com/repos/54menu/cardapioonline/actions/workflows/pages.yml/dispatches' `
    -Headers @{ Authorization = "Basic $auth"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' } `
    -Body $body -ContentType 'application/json' | Out-Null
  Write-Output "DISPATCHED phase=$Phase ref=$Ref sha=$sha"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Output "HTTP_$code"
  exit 1
}
