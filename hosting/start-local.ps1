#requires -Version 7.0
param([int]$Port, [switch]$NoOpen)

$ErrorActionPreference = 'Stop'
if (-not $PSBoundParameters.ContainsKey('Port')) { $Port = 4173 }
if ($Port -lt 1 -or $Port -gt 65535) { throw 'INVALID PORT' }
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$serverFile = Join-Path $PSScriptRoot 'serve.mjs'
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
}
if (-not [IO.File]::Exists($nodeExecutable)) { throw 'NODE.JS 22 OR LATER IS REQUIRED.' }
$version = & $nodeExecutable --version
if ($LASTEXITCODE -ne 0 -or [int]$version.TrimStart('v').Split('.')[0] -lt 22) { throw 'NODE.JS 22 OR LATER IS REQUIRED.' }
if (-not [IO.File]::Exists((Join-Path $root 'client/runtime.js')) -or
    -not [IO.File]::Exists((Join-Path $root 'client/local-assets.js'))) {
    & $nodeExecutable (Join-Path $root 'client/build.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'CLIENT BUILD FAILED.' }
}
$normalizedRoot = $root.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar).ToLowerInvariant()
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $instance = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($normalizedRoot))).Replace('-', '').ToLowerInvariant()
} finally { $sha.Dispose() }
$candidatePorts = if ($PSBoundParameters.ContainsKey('Port')) { @($Port) } else { @($Port..([Math]::Min(65535, $Port + 20))) }
$listeningPorts = @([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
    Select-Object -ExpandProperty Port -Unique)
$url = $null
foreach ($candidate in $candidatePorts) {
    if ($candidate -notin $listeningPorts) { continue }
    $candidateUrl = "http://127.0.0.1:$candidate/"
    try {
        $health = Invoke-RestMethod -Uri ($candidateUrl + 'api/health') -TimeoutSec 1
        if ($health.app -eq 'Spawner' -and $health.mode -eq 'static' -and $health.instance -eq $instance) {
            $url = $candidateUrl
            break
        }
    } catch {}
}
if (-not $url) {
    $available = @($candidatePorts | Where-Object { $_ -notin $listeningPorts })
    if ($available.Count -eq 0) { throw 'NO AVAILABLE SPAWNER PORT.' }
    $Port = $available[0]
    $url = "http://127.0.0.1:$Port/"
    $logs = Join-Path $root '$Trash/local-server'
    [void][IO.Directory]::CreateDirectory($logs)
    $savedPort = $env:PORT
    try {
        $env:PORT = [string]$Port
        $serverOptions = @{
            FilePath = $nodeExecutable
            ArgumentList = ('"' + $serverFile + '"')
            WorkingDirectory = $root
            WindowStyle = 'Hidden'
            PassThru = $true
            RedirectStandardOutput = (Join-Path $logs "$Port.out.log")
            RedirectStandardError = (Join-Path $logs "$Port.err.log")
        }
        $process = Start-Process @serverOptions
    } finally { $env:PORT = $savedPort }
    [IO.File]::WriteAllText((Join-Path $logs "$Port.pid"), [string]$process.Id, [Text.UTF8Encoding]::new($false))
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 200
        $process.Refresh()
        if ($process.HasExited) { break }
        try {
            $health = Invoke-RestMethod -Uri ($url + 'api/health') -TimeoutSec 1
            $ready = $health.app -eq 'Spawner' -and $health.mode -eq 'static' -and $health.instance -eq $instance
        } catch {}
        if ($ready) { break }
    }
    if (-not $ready) {
        if (-not $process.HasExited) { Stop-Process -Id $process.Id }
        throw "SPAWNER START FAILED : $logs"
    }
}
if (-not $NoOpen) { Start-Process $url }
$url
