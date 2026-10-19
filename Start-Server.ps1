#requires -Version 7.0
param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$serverFile = Join-Path $PSScriptRoot 'hosting\static-server.mjs'
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
$revision = (Get-FileHash -LiteralPath $serverFile -Algorithm SHA256).Hash.ToLowerInvariant()
$candidatePorts = if ($env:PORT) { @([int]$env:PORT) } else { @(3000..3020) }
if ($candidatePorts[0] -lt 1 -or $candidatePorts[-1] -gt 65535) { throw '서버 포트는 1~65535여야 합니다.' }
$playerUrl = $null
$availablePort = $null
$listeningPorts = @(Get-NetTCPConnection -State Listen | Select-Object -ExpandProperty LocalPort -Unique)
foreach ($candidatePort in $candidatePorts) {
    if ($candidatePort -notin $listeningPorts) {
        if ($null -eq $availablePort) { $availablePort = $candidatePort }
        continue
    }
    $candidateUrl = "http://127.0.0.1:$candidatePort"
    $health = $null
    try { $health = Invoke-RestMethod -Uri "$candidateUrl/api/health" -TimeoutSec 1 } catch {}
    if ($health.app -ne 'SpawnerClient' -or $health.instanceId -ne $instanceId) { continue }
    if ($health.revision -ne $revision) {
        $owners = @(Get-NetTCPConnection -LocalPort $candidatePort -State Listen | Select-Object -ExpandProperty OwningProcess -Unique)
        if ($owners.Count -ne 1) { throw '이전 서버의 프로세스를 확인할 수 없습니다.' }
        $serverProcess = Get-Process -Id $owners[0]
        $null = $serverProcess.Handle
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($serverProcess.Id)"
        $serverArgument = '(?i)(?:^|\s)"?' + [regex]::Escape($serverFile) + '"?(?:\s|$)'
        if ($processInfo.Name -ne 'node.exe' -or $processInfo.CommandLine -notmatch $serverArgument) {
            throw '이전 서버의 실행 경로가 현재 프로젝트와 일치하지 않습니다.'
        }
        if ($health.shutdownProtocol -ne 'pipe-v1') {
            throw '실행 중인 구버전 서버는 저장 후 종료 요청을 지원하지 않습니다. 서버를 강제 종료하지 않았습니다.'
        }
        $pipe = [IO.Pipes.NamedPipeClientStream]::new('.', "Spawner-$instanceId-$candidatePort", [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
        try {
            $pipe.Connect(5000)
            $command = [Text.Encoding]::UTF8.GetBytes("stop`n")
            $pipe.Write($command, 0, $command.Length)
            $pipe.Flush()
            $reader = [IO.StreamReader]::new($pipe)
            $reply = $reader.ReadLineAsync()
            if (-not $reply.Wait(30000) -or $reply.Result -ne 'saved') {
                throw '서버 저장 완료를 확인하지 못했습니다. 강제 종료 및 재시작을 중단했습니다.'
            }
        } finally { $pipe.Dispose() }
        if (-not $serverProcess.WaitForExit(30000)) { throw '저장은 완료했지만 서버 종료가 지연되어 재시작을 중단했습니다.' }
        if ($serverProcess.ExitCode -ne 0) { throw '이전 서버가 비정상 종료되어 재시작을 중단했습니다.' }
        $availablePort = $candidatePort
        break
    }
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
            $ready = $health.app -eq 'SpawnerClient' -and $health.instanceId -eq $instanceId -and $health.revision -eq $revision
        } catch {}
        if ($ready) { break }
    }
    if (-not $ready) {
        throw "서버를 시작하지 못했습니다. 오류 파일: $dataDirectory\server.stderr.log"
    }
    [IO.File]::WriteAllText((Join-Path $dataDirectory 'server.pid'), [string]$process.Id, [Text.UTF8Encoding]::new($false))
}
if (-not $NoOpen) { Start-Process $playerUrl }
$playerUrl
