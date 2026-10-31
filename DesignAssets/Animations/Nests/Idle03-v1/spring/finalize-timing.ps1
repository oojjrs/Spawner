$ErrorActionPreference = 'Stop'
function Set-WebPDuration {
    param([string]$Path,[int]$TargetMs)
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ([Text.Encoding]::ASCII.GetString($bytes,0,4) -ne 'RIFF' -or [Text.Encoding]::ASCII.GetString($bytes,8,4) -ne 'WEBP') { throw 'Unexpected image container.' }
    $cursor = 12
    $total = 0
    $last = -1
    $durations = [Collections.Generic.List[int]]::new()
    while ($cursor + 8 -le $bytes.Length) {
        $name = [Text.Encoding]::ASCII.GetString($bytes,$cursor,4)
        $size = [BitConverter]::ToUInt32($bytes,$cursor+4)
        if ($cursor+8+$size -gt $bytes.Length) { throw 'Truncated image chunk.' }
        if ($name -eq 'ANMF') {
            $last = $cursor+20
            $duration = [int]$bytes[$last]+([int]$bytes[$last+1] -shl 8)+([int]$bytes[$last+2] -shl 16)
            $total += $duration
            $durations.Add($duration)
        }
        $cursor += 8+$size+($size -band 1)
    }
    if ($last -lt 0 -or $durations.Count -ne 120) { throw 'Unexpected animation frame count.' }
    $duration = $durations[$durations.Count-1]+$TargetMs-$total
    if ($duration -le 0 -or $duration -gt 16777215) { throw 'Invalid final frame duration.' }
    $bytes[$last] = [byte]($duration -band 255)
    $bytes[$last+1] = [byte](($duration -shr 8) -band 255)
    $bytes[$last+2] = [byte](($duration -shr 16) -band 255)
    $durations[$durations.Count-1] = $duration
    [IO.File]::WriteAllBytes($Path,$bytes)
    return $durations.ToArray()
}
$durations = @(Set-WebPDuration (Join-Path $PSScriptRoot 'idle.webp') 4000)
[void](Set-WebPDuration (Join-Path $PSScriptRoot 'preview.webp') 4000)
$metadataPath = Join-Path $PSScriptRoot 'animation.json'
$metadata = [IO.File]::ReadAllText($metadataPath) | ConvertFrom-Json
$metadata.durationsMs = $durations
$content = $metadata | ConvertTo-Json -Depth 20
$content = [regex]::Replace($content,'\r\n|\r|\n',"`r`n")
[IO.File]::WriteAllText($metadataPath,$content,[Text.UTF8Encoding]::new($false))

