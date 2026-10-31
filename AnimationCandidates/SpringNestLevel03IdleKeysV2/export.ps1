$ErrorActionPreference = 'Stop'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Frames/frame-000.png') -Destination (Join-Path $PSScriptRoot 'keypose.png')
& magick (Join-Path $PSScriptRoot 'keypose.png') -crop 480x270+16+192 +repage -resize 960x540 -background '#152c32' -alpha remove -alpha off (Join-Path $PSScriptRoot 'keypose-preview.png')
$renderedFrames = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Frames') -Filter '*.png' | Sort-Object Name | Select-Object -First 80 | ForEach-Object FullName)
& magick -delay 5 @renderedFrames -crop 480x270+16+192 +repage -background '#152c32' -alpha remove -alpha off -define webp:lossless=true -quality 100 -loop 0 (Join-Path $PSScriptRoot 'rig-preview.webp')
& magick (Join-Path $PSScriptRoot 'rig-preview.webp') -coalesce -append -colors 128 -unique-colors (Join-Path $PSScriptRoot 'palette.png')
& magick (Join-Path $PSScriptRoot 'rig-preview.webp') -coalesce +dither -remap (Join-Path $PSScriptRoot 'palette.png') -layers Optimize -loop 0 (Join-Path $PSScriptRoot 'rig-preview.gif')
if ($LASTEXITCODE -ne 0) { throw 'Preview export failed.' }

