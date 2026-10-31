$ErrorActionPreference = 'Stop'
$outputRoot = Split-Path -Parent $PSScriptRoot
$frames = @(Get-ChildItem -LiteralPath (Join-Path $outputRoot 'Frames') -Filter 'frame-*.png' | Sort-Object Name | ForEach-Object { $_.FullName })
if ($frames.Count -ne 80) { throw 'FRAME COUNT MUST BE 80' }
magick montage $frames -tile 10x8 -geometry 512x512+0+0 -background none -define webp:lossless=true -define webp:exact=true -define webp:method=6 (Join-Path $outputRoot 'idle-sheet.webp')
if ($LASTEXITCODE -ne 0) { throw 'SPRITE SHEET EXPORT FAILED' }
ffmpeg -y -loglevel error -framerate 20 -start_number 0 -i (Join-Path $outputRoot 'Frames/frame-%03d.png') -c:v libwebp_anim -lossless 1 -quality 100 -loop 0 (Join-Path $outputRoot 'preview.webp')
if ($LASTEXITCODE -ne 0) { throw 'PREVIEW EXPORT FAILED' }
Copy-Item -LiteralPath $frames[0] -Destination (Join-Path $outputRoot 'poster.png') -Force
$metadataPath = Join-Path $outputRoot 'animation.json'
$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$metadata | Add-Member -NotePropertyName name -NotePropertyValue 'nest-stage-03-idle' -Force
$metadata | Add-Member -NotePropertyName columns -NotePropertyValue 10 -Force
$metadata | Add-Member -NotePropertyName animation -NotePropertyValue 'idle-sheet.webp' -Force
$metadata | Add-Member -NotePropertyName preview -NotePropertyValue 'preview.webp' -Force
$metadata | Add-Member -NotePropertyName poster -NotePropertyValue 'poster.png' -Force
$metadata | Add-Member -NotePropertyName periodMs -NotePropertyValue 4000 -Force
$metadata | Add-Member -NotePropertyName durationsMs -NotePropertyValue @((0..79) | ForEach-Object { 50 }) -Force
$content = ($metadata | ConvertTo-Json -Depth 100).Replace("`r`n","`n").Replace("`n","`r`n")
[System.IO.File]::WriteAllText($metadataPath,$content,[System.Text.UTF8Encoding]::new($false))
