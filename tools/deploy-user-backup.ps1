param(
  [string]$EnvironmentId = 'cloud1-d2gqjtnis5f2da698',
  [string]$CliPath = 'D:\微信web开发者工具\cli.bat',
  [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$projectConfig = Get-Content -LiteralPath (Join-Path $projectDirectory 'project.config.json') -Raw | ConvertFrom-Json
$applicationId = [string]$projectConfig.appid
if ($applicationId -notmatch '^wx[0-9a-f]{16}$') { throw '项目缺少有效 AppID，不能部署云函数。' }
if (-not (Test-Path -LiteralPath $CliPath)) { throw '微信开发者工具 CLI 不存在，请传入 -CliPath。' }
$functionDirectory = (Resolve-Path -LiteralPath (Join-Path $projectDirectory 'cloudfunctions/userBackup')).Path
if (-not $VerifyOnly) {
  for ($attempt = 0; $attempt -lt 4; $attempt++) {
    # Supplying --project alone lost AppID in this IDE's cloud signer.
    # Explicit --appid + --paths succeeded against the same environment.
    $deploymentOutput = (& $CliPath cloud functions deploy --env $EnvironmentId --paths $functionDirectory --appid $applicationId --remote-npm-install 2>&1 | Out-String)
    Write-Output $deploymentOutput
    if ($deploymentOutput -match 'Creating' -and $attempt -lt 3) { Start-Sleep -Seconds 5; continue }
    # The CLI can exit 0 even when deployment failed.
    if ($deploymentOutput -match 'fail to deploy|\[error\]|userBackup\s*│\s*false' -or $deploymentOutput -notmatch 'userBackup\s*│\s*true') { throw 'userBackup 部署失败；以上日志为准，不能把退出码 0 当作成功。' }
    break
  }
}
$listing = (& $CliPath cloud functions list --env $EnvironmentId --appid $applicationId 2>&1 | Out-String)
Write-Output $listing
if ($listing -notmatch '(?m)^\s*\*\s+userBackup\s*$') { throw '云函数列表未确认 userBackup，请检查云开发控制台。' }
$details = (& $CliPath cloud functions info --env $EnvironmentId --names userBackup --appid $applicationId 2>&1 | Out-String)
Write-Output $details
if ($details -notmatch 'Active') { throw 'userBackup 尚未处于 Active 状态，请稍后检查。' }
Write-Output 'userBackup 已确认 Active；实际备份/恢复是否可用，仍以小程序调用结果为准。'
