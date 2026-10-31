$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'Sources'
$parts = Join-Path $PSScriptRoot 'Parts'
[void][IO.Directory]::CreateDirectory($parts)
& magick (Join-Path $source 'wheel-underpainting.png') -resize 128x128! (Join-Path $parts 'wheel-underpainting.png')
& magick (Join-Path $source 'paddle-surfaces.png') -crop 1220x380+16+120 +repage -resize 384x120! (Join-Path $parts 'paddle-front.png')
& magick (Join-Path $source 'paddle-surfaces.png') -crop 1220x360+16+590 +repage -resize 384x120! (Join-Path $parts 'paddle-back.png')
& magick (Join-Path $source 'paddle-surfaces.png') -crop 1220x178+16+980 +repage -resize 384x50! (Join-Path $parts 'paddle-edge.png')
if ($LASTEXITCODE -ne 0) { throw 'Painted surface extraction failed.' }
Copy-Item -LiteralPath (Join-Path $source 'droplet.png') -Destination (Join-Path $parts 'droplet.png')

