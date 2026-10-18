#requires -Version 7.0
param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$serverFile = Join-Path $PSScriptRoot 'server\server.mjs'
$nodeCandidates = @(
    (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
    (Join-Path $env:ProgramFiles 'nodejs\node.exe')
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
)
$nodeExecutable = $null
foreach ($candidate in $nodeCandidates) {
    if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) { continue }
    $version = & $candidate --version
    if ($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22) {
        $nodeExecutable = $candidate
        break
    }
}
if (-not $nodeExecutable) { throw 'Node.js 22 이상 실행 파일을 찾을 수 없습니다.' }
$normalizedRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\', '/').ToLowerInvariant()
$instanceId = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($normalizedRoot))).ToLowerInvariant()
$revision = ((@('server\game.mjs', 'server\server.mjs', 'server\world.mjs') | ForEach-Object {
    (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $_) -Algorithm SHA256).Hash.ToLowerInvariant()
}) -join '')
$candidatePorts = if ($env:PORT) { @([int]$env:PORT) } else { @(3000..3020) }
if ($candidatePorts[0] -lt 1 -or $candidatePorts[-1] -gt 65535) { throw '서버 포트는 1~65535여야 합니다.' }
$playerUrl = $null
$availablePort = $null
foreach ($candidatePort in $candidatePorts) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidatePort)
    try {
        $listener.Start()
        if ($null -eq $availablePort) { $availablePort = $candidatePort }
        continue
    } catch {
    } finally { $listener.Stop() }
    $candidateUrl = "http://127.0.0.1:$candidatePort"
    $health = $null
    try { $health = Invoke-RestMethod -Uri "$candidateUrl/api/health" -TimeoutSec 1 } catch {}
    if ($health.app -ne 'Spawner' -or $health.instanceId -ne $instanceId) { continue }
    if ($health.revision -ne $revision) { throw '이 프로젝트의 이전 서버가 실행 중입니다. 기존 서버를 종료한 뒤 다시 실행해 주세요.' }
    $playerUrl = $candidateUrl
    break
}
if (-not $playerUrl) {
    if ($null -eq $availablePort) { throw '사용 가능한 서버 포트를 찾을 수 없습니다.' }
    $playerUrl = "http://127.0.0.1:$availablePort"
    $dataDirectory = if ($env:SPAWNER_DATA_DIR) { [IO.Path]::GetFullPath($env:SPAWNER_DATA_DIR) } else { Join-Path $PSScriptRoot '.data' }
    [IO.Directory]::CreateDirectory($dataDirectory) | Out-Null
    $previousPort = $env:PORT
    $previousHost = $env:HOST
    $previousDataDirectory = $env:SPAWNER_DATA_DIR
    try {
        $env:PORT = [string]$availablePort
        $env:HOST = '127.0.0.1'
        $env:SPAWNER_DATA_DIR = $dataDirectory
    $process = Start-Process -FilePath $nodeExecutable -ArgumentList ('"' + $serverFile + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $dataDirectory 'server.stdout.log') -RedirectStandardError (Join-Path $dataDirectory 'server.stderr.log')
    } finally {
        $env:PORT = $previousPort
        $env:HOST = $previousHost
        $env:SPAWNER_DATA_DIR = $previousDataDirectory
    }
    $ready = $false
    for ($attempt = 0; $attempt -lt 24; $attempt++) {
        Start-Sleep -Milliseconds 250
        if ($process.HasExited) { break }
        try {
            $health = Invoke-RestMethod -Uri "$playerUrl/api/health" -TimeoutSec 1
            $ready = $health.app -eq 'Spawner' -and $health.instanceId -eq $instanceId -and $health.revision -eq $revision
        } catch {}
        if ($ready) { break }
    }
    if (-not $ready) {
        if (-not $process.HasExited) { $process.Kill() }
        throw "서버를 시작하지 못했습니다. 오류 파일: $dataDirectory\server.stderr.log"
    }
    [IO.File]::WriteAllText((Join-Path $dataDirectory 'server.pid'), [string]$process.Id, [Text.UTF8Encoding]::new($false))
}
if (-not $NoOpen) { Start-Process $playerUrl }
$playerUrl
