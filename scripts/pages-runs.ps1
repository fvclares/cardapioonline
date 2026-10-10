# Consulta as execuções recentes do workflow Pages. Token via credential helper; nunca impresso.
$ErrorActionPreference = 'Stop'
$fillInput = "protocol=https`nhost=github.com`n"
$cred = $fillInput | git credential fill
$user = ($cred | Select-String '^username=(.*)$').Matches.Groups[1].Value
$pass = ($cred | Select-String '^password=(.*)$').Matches.Groups[1].Value
if (-not $pass) { Write-Output 'NO_CREDENTIAL'; exit 1 }
$pair = "$user`:$pass"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
$user = $null; $pass = $null; $pair = $null
$r = Invoke-RestMethod -Method Get `
  -Uri 'https://api.github.com/repos/54menu/cardapioonline/actions/workflows/pages.yml/runs?per_page=3' `
  -Headers @{ Authorization = "Basic $auth"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }
foreach ($run in $r.workflow_runs) {
  Write-Output ("id={0} status={1} conclusion={2} sha={3} url={4}" -f $run.id, $run.status, $run.conclusion, ($run.head_sha.Substring(0,7)), $run.html_url)
}
