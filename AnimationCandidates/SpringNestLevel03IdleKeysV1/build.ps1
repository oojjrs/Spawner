$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$workDirectory = Join-Path $projectRoot '$Trash/SpringNestLevel03IdleKeysV1'
$sourceDirectory = Join-Path $PSScriptRoot 'Sources'
$keyDirectory = Join-Path $PSScriptRoot 'Keys'
[void][IO.Directory]::CreateDirectory($workDirectory)
[void][IO.Directory]::CreateDirectory($sourceDirectory)
[void][IO.Directory]::CreateDirectory($keyDirectory)
$reference = Join-Path $sourceDirectory 'reference.png'
$mask = Join-Path $workDirectory 'moving-mask.png'
$maskDrawing = 'ellipse 188,240 60,11 0,360 polygon 197,248 244,252 259,267 269,290 249,294 217,281 209,264 polygon 248,286 274,291 288,310 296,329 277,336 249,328 249,306 polygon 160,266 178,279 188,320 181,336 159,339 153,327 168,318 polygon 90,255 123,255 142,265 163,268 174,317 162,337 124,337 115,315 94,309 polygon 145,325 180,324 199,341 182,348 148,341 polygon 108,352 187,337 310,335 401,340 436,354 428,375 367,391 302,398 219,399 149,386 113,368'
& magick -size 512x512 xc:black -fill white -draw $maskDrawing -fill black -draw 'ellipse 91,303 12,15 0,360' -blur 0x0.6 $mask
if ($LASTEXITCODE -ne 0) { throw 'Mask construction failed.' }
$sheets = @('generated-keys-01-04.png', 'generated-keys-05-08.png')
$hubs = @(@(102,429), @(98,429), @(102,370), @(98,366), @(104,426), @(100,425), @(104,357), @(100,358))
$registered = @()
$keys = @()
for ($keyIndex = 0; $keyIndex -lt 8; $keyIndex++) {
    $sheet = Join-Path $sourceDirectory $sheets[[int][math]::Floor($keyIndex / 4)]
    $cell = $keyIndex % 4
    $cropX = ($cell % 2) * 627
    $cropY = [int][math]::Floor($cell / 2) * 627
    $number = ($keyIndex + 1).ToString('00')
    $drawing = Join-Path $sourceDirectory ('drawn-key-' + $number + '.png')
    $aligned = Join-Path $workDirectory ('registered-' + $number + '.png')
    $moving = Join-Path $workDirectory ('moving-' + $number + '.png')
    $output = Join-Path $keyDirectory ('key-' + $number + '.png')
    & magick $sheet -crop ('627x627+' + $cropX + '+' + $cropY) +repage $drawing
    if ($LASTEXITCODE -ne 0) { throw 'Source crop failed.' }
    $translationX = 94 - 0.72 * $hubs[$keyIndex][0]
    $translationY = 304 - 0.72 * $hubs[$keyIndex][1]
    $matrix = '0.72,0,0,0.72,' + $translationX.ToString([Globalization.CultureInfo]::InvariantCulture) + ',' + $translationY.ToString([Globalization.CultureInfo]::InvariantCulture)
    & magick $drawing -virtual-pixel transparent -define 'distort:viewport=512x512+0+0' -distort AffineProjection $matrix +repage $aligned
    if ($LASTEXITCODE -ne 0) { throw 'Registration failed.' }
    & magick $aligned $mask -alpha off -compose CopyOpacity -composite $moving
    if ($LASTEXITCODE -ne 0) { throw 'Moving-region extraction failed.' }
    & magick $reference $moving -compose Over -composite $output
    if ($LASTEXITCODE -ne 0) { throw 'Key composition failed.' }
    $registered += $aligned
    $keys += $output
}
& magick montage @keys -tile 4x2 -geometry 512x512+0+0 -background none (Join-Path $PSScriptRoot 'keyposes-sheet.png')
if ($LASTEXITCODE -ne 0) { throw 'Sprite sheet construction failed.' }
$cards = @()
for ($keyIndex = 0; $keyIndex -lt 8; $keyIndex++) {
    $number = ($keyIndex + 1).ToString('00')
    $card = Join-Path $workDirectory ('card-' + $number + '.png')
    & magick $keys[$keyIndex] -crop 480x270+16+192 +repage -background '#152c32' -alpha remove -alpha off $card
    if ($LASTEXITCODE -ne 0) { throw 'Contact card construction failed.' }
    $cards += $card
}
& magick montage @cards -tile 4x2 -geometry 480x270+8+8 -background '#152c32' (Join-Path $PSScriptRoot 'keyposes-contact.png')
if ($LASTEXITCODE -ne 0) { throw 'Contact sheet construction failed.' }
& magick montage @registered -tile 4x2 -geometry 512x512+0+0 -background '#152c32' (Join-Path $workDirectory 'registered-contact.png')
if ($LASTEXITCODE -ne 0) { throw 'Registered source sheet construction failed.' }
