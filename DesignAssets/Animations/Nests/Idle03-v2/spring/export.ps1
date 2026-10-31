$ErrorActionPreference = 'Stop'
& ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 0 -i (Join-Path $PSScriptRoot 'Frames/frame-%03d.png') -frames:v 120 -c:v libwebp_anim -lossless 1 -compression_level 4 -quality 100 -loop 0 (Join-Path $PSScriptRoot 'idle.webp')
if ($LASTEXITCODE -ne 0) { throw 'Transparent animation export failed.' }
& ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 0 -i (Join-Path $PSScriptRoot 'Frames/frame-%03d.png') -frames:v 120 -filter_complex '[0:v]crop=480:270:16:192[s];color=c=0x152c32:s=480x270:r=30,format=rgba[b];[b][s]overlay=shortest=1:format=rgb,format=rgba' -c:v libwebp_anim -lossless 1 -compression_level 4 -quality 100 -loop 0 (Join-Path $PSScriptRoot 'preview.webp')
if ($LASTEXITCODE -ne 0) { throw 'Lossless playback preview export failed.' }
& ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 0 -i (Join-Path $PSScriptRoot 'Frames/frame-%03d.png') -frames:v 120 -filter_complex '[0:v]crop=480:270:16:192[s];color=c=0x152c32:s=480x270:r=30,format=rgba[b];[b][s]overlay=shortest=1:format=rgb,split[a][z];[a]palettegen=stats_mode=full:reserve_transparent=0[p];[z][p]paletteuse=dither=none' -loop 0 (Join-Path $PSScriptRoot 'preview.gif')
if ($LASTEXITCODE -ne 0) { throw 'Playback preview export failed.' }
& ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 0 -i (Join-Path $PSScriptRoot 'Frames/frame-%03d.png') -frames:v 120 -filter_complex '[0:v]crop=480:270:16:192,scale=960:540:flags=lanczos[s];color=c=0x152c32:s=960x540:r=30[b];[b][s]overlay=shortest=1:format=auto' -c:v libx264 -crf 12 -pix_fmt yuv420p -movflags +faststart (Join-Path $PSScriptRoot 'preview.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Video preview export failed.' }
$frames = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Frames') -Filter '*.png' | Sort-Object Name | Select-Object -First 120 | ForEach-Object FullName)
& magick montage @frames -tile 12x10 -geometry 512x512+0+0 -background none -define webp:lossless=true -quality 100 (Join-Path $PSScriptRoot 'idle-sheet.webp')
if ($LASTEXITCODE -ne 0) { throw 'Sprite sheet export failed.' }
& magick (Join-Path $PSScriptRoot 'keypose.png') -crop 480x270+16+192 +repage -background '#152c32' -alpha remove -alpha off (Join-Path $PSScriptRoot 'poster.png')
& (Join-Path $PSScriptRoot 'finalize-timing.ps1')

