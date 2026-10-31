$ErrorActionPreference = 'Stop'
$assetRoot = Split-Path -Parent $PSScriptRoot
& magick (Join-Path $assetRoot 'idle-sheet.png') -define webp:lossless=true -define webp:exact=true -define webp:method=4 (Join-Path $assetRoot 'idle-sheet.webp')
if ($LASTEXITCODE -ne 0) { throw 'Runtime WebP sheet export failed' }
$inputPattern = Join-Path $assetRoot 'Frames/frame-%03d.png'
$frames = @(Get-ChildItem -LiteralPath (Join-Path $assetRoot 'Frames') -Filter 'frame-*.png')
if ($frames.Count -ne 80) { throw 'Expected 80 rendered frames' }
& ffmpeg -y -loglevel error -framerate 20 -start_number 0 -i $inputPattern -frames:v 80 -c:v libwebp_anim -lossless 1 -quality 100 -loop 0 (Join-Path $assetRoot 'preview.webp')
if ($LASTEXITCODE -ne 0) { throw 'WebP export failed' }
& ffmpeg -y -loglevel error -framerate 20 -start_number 0 -i $inputPattern -frames:v 80 -filter_complex_threads 1 -filter_complex 'color=c=0x23282c:s=512x512:r=20:d=4[bg];[bg][0:v]overlay=shortest=1:format=auto,format=rgb24,split[a][b];[a]palettegen=reserve_transparent=0:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a' -gifflags -offsetting-transdiff -loop 0 (Join-Path $assetRoot 'preview.gif')
if ($LASTEXITCODE -ne 0) { throw 'GIF export failed' }
