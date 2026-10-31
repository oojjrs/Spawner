$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'Sources'
$parts = Join-Path $PSScriptRoot 'Parts'
$work = Join-Path (Split-Path $PSScriptRoot -Parent) '$Trash/SpringNestLevel03RigV2'
[void][IO.Directory]::CreateDirectory($work)
$entries = @(
    @('wheel-front', '390x390+22+65', '160x160!'),
    @('wheel-rear', '390x390+425+65', '160x160!'),
    @('paddle-front', '370x165+850+187', '160x64!'),
    @('paddle-back', '370x165+25+615', '160x64!'),
    @('water-ribbon', '245x452+505+480', '128x256!'),
    @('foam', '390x185+833+675', '160x64!'),
    @('ripple', '510x180+10+984', '256x80!'),
    @('upper-reflection', '380x130+551+1020', '200x64!'),
    @('droplet', '142x200+1000+975', '64x96!')
)
foreach ($entry in $entries) {
    & magick (Join-Path $source 'bind-parts-generated.png') -crop $entry[1] +repage -resize $entry[2] (Join-Path $parts ($entry[0] + '.png'))
    if ($LASTEXITCODE -ne 0) { throw 'Part extraction failed.' }
}
& magick (Join-Path $parts 'water-ribbon.png') (Join-Path $parts 'water-ribbon.png') -append (Join-Path $parts 'water-ribbon-tiled.png')
$mask = Join-Path $parts 'moving-mask.png'
$drawing = 'ellipse 188,240 60,11 0,360 polygon 194,247 245,251 260,267 270,291 249,296 216,281 207,263 polygon 244,285 275,291 289,310 298,331 277,337 247,329 247,305 polygon 156,266 178,276 190,321 181,338 155,340 150,325 165,316 polygon 88,253 138,251 171,268 182,322 165,339 122,340 115,320 91,312 polygon 141,323 184,323 202,342 181,350 144,342 polygon 108,352 187,336 310,334 401,340 436,354 428,375 367,391 302,399 219,400 149,386 113,368'
& magick -size 512x512 xc:black -fill white -draw $drawing -alpha off -blur 0x0.6 $mask
& magick (Join-Path $source 'clean-underlayer-generated.png') -resize 512x512! -virtual-pixel transparent -define 'distort:viewport=512x512+0+0' -distort AffineProjection '1,0,0,1,-2,-4' +repage (Join-Path $work 'clean-registered.png')
& magick (Join-Path $work 'clean-registered.png') $mask -alpha off -compose CopyOpacity -composite (Join-Path $work 'clean-moving.png')
& magick (Join-Path $source 'reference.png') (Join-Path $work 'clean-moving.png') -compose Over -composite (Join-Path $parts 'stationary-underlayer.png')
& magick (Join-Path $source 'reference.png') -crop 28x35+78+288 +repage (Join-Path $parts 'axle-foreground.png')
if ($LASTEXITCODE -ne 0) { throw 'Underlayer preparation failed.' }
