$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$rig = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'rig.json') -Raw | ConvertFrom-Json
$partsPath = Join-Path $PSScriptRoot 'Parts'
$framesPath = Join-Path $PSScriptRoot 'Frames'
$images = @{}
foreach ($name in @('stationary-underlayer','wheel-front','wheel-rear','paddle-front','paddle-back','water-ribbon-tiled','foam','ripple','upper-reflection','droplet','axle-foreground','moving-mask')) {
    $images[$name] = [Drawing.Bitmap]::new((Join-Path $partsPath ($name + '.png')))
}
$images['wheel-rear-rim'] = [Drawing.Bitmap]$images['wheel-rear'].Clone()
for ($y = 0; $y -lt 160; $y++) {
    for ($x = 0; $x -lt 160; $x++) {
        if (($x-80)*($x-80)+($y-80)*($y-80) -lt 61*61) {
            $images['wheel-rear-rim'].SetPixel($x,$y,[Drawing.Color]::Transparent)
        }
    }
}
$images['wheel-rear-rim'].Save((Join-Path $partsPath 'wheel-rear-rim.png'),[Drawing.Imaging.ImageFormat]::Png)
foreach ($name in @('ripple','upper-reflection')) {
    $texture = $images[$name]
    for ($y = 0; $y -lt $texture.Height; $y++) {
        for ($x = 0; $x -lt $texture.Width; $x++) {
            $pixel = $texture.GetPixel($x,$y)
            $strength = [math]::Clamp(($pixel.R - 65) / 145.0,0,1)
            $texture.SetPixel($x,$y,[Drawing.Color]::FromArgb([int]($pixel.A * $strength),$pixel.R,$pixel.G,$pixel.B))
        }
    }
    $texture.Save((Join-Path $partsPath ($name + '-filtered.png')),[Drawing.Imaging.ImageFormat]::Png)
}
$clip = [Drawing.Region]::new()
$clip.MakeEmpty()
for ($y = 0; $y -lt 512; $y++) {
    $start = -1
    for ($x = 0; $x -le 512; $x++) {
        $inside = $x -lt 512 -and $images['moving-mask'].GetPixel($x,$y).R -ge 128
        if ($inside -and $start -lt 0) { $start = $x }
        if (-not $inside -and $start -ge 0) {
            $clip.Union([Drawing.Rectangle]::new($start,$y,($x-$start),1))
            $start = -1
        }
    }
}
function Paint-Quad {
    param($Graphics,$Texture,[double[]]$Coordinates,[Drawing.RectangleF]$Source,[double]$Opacity,[double]$Shade)
    $points = [Drawing.PointF[]]@(
        [Drawing.PointF]::new($Coordinates[0],$Coordinates[1]),
        [Drawing.PointF]::new($Coordinates[2],$Coordinates[3]),
        [Drawing.PointF]::new($Coordinates[4],$Coordinates[5])
    )
    $attributes = [Drawing.Imaging.ImageAttributes]::new()
    $matrix = [Drawing.Imaging.ColorMatrix]::new()
    $matrix.Matrix00 = $Shade
    $matrix.Matrix11 = $Shade
    $matrix.Matrix22 = $Shade
    $matrix.Matrix33 = $Opacity
    $attributes.SetColorMatrix($matrix)
    $Graphics.DrawImage($Texture,$points,$Source,[Drawing.GraphicsUnit]::Pixel,$attributes)
    $attributes.Dispose()
}
function Paint-Sprite {
    param($Graphics,$Texture,[double]$X,[double]$Y,[double]$Width,[double]$Height,[double]$Opacity)
    $coordinates = [double[]]@(($X-$Width/2),($Y-$Height/2),($X+$Width/2),($Y-$Height/2),($X-$Width/2),($Y+$Height/2))
    Paint-Quad $Graphics $Texture $coordinates ([Drawing.RectangleF]::new(0,0,$Texture.Width,$Texture.Height)) $Opacity 1
}
function Project-Wheel {
    param([double]$U,[double]$V,[double]$Depth)
    return [double[]]@(($rig.wheel.frontCenter[0]+$rig.wheel.planeU[0]*$U+$rig.wheel.depth[0]*$Depth),($rig.wheel.frontCenter[1]+$rig.wheel.planeV[1]*$V+$rig.wheel.depth[1]*$Depth))
}
function Paint-Rim {
    param($Graphics,$Texture,[double]$Angle,[double]$Depth,[double]$Shade)
    $cs = [math]::Cos($Angle)
    $sn = [math]::Sin($Angle)
    $a = Project-Wheel (-$cs+$sn) (-$sn-$cs) $Depth
    $b = Project-Wheel ($cs+$sn) ($sn-$cs) $Depth
    $c = Project-Wheel (-$cs-$sn) (-$sn+$cs) $Depth
    $coordinates = [double[]]@($a[0],$a[1],$b[0],$b[1],$c[0],$c[1])
    Paint-Quad $Graphics $Texture $coordinates ([Drawing.RectangleF]::new(0,0,$Texture.Width,$Texture.Height)) 1 $Shade
}
function Paint-Flow {
    param($Graphics,$Texture,[double[]]$Path,[double]$Time,[double]$Phase)
    $width = ($Path[4]+$Path[5])/2
    $textureY = ((($Phase-$Time*2)%1+1)%1)*256
    $bend = [math]::Sin(($Time+$Phase)*2*[math]::PI)*0.5
    $coordinates = [double[]]@(($Path[0]-$width/2),$Path[1],($Path[0]+$width/2),$Path[1],($Path[2]-$width/2+$bend),$Path[3])
    Paint-Quad $Graphics $Texture $coordinates ([Drawing.RectangleF]::new(0,$textureY,128,256)) 0.95 1
}
$pi = [math]::PI
for ($frame = 0; $frame -le 80; $frame++) {
    $time = $frame/[double]$rig.fps
    $canvas = [Drawing.Bitmap]::new(512,512,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($canvas)
    $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImageUnscaled($images['stationary-underlayer'],0,0)
    $g.SetClip($clip,[Drawing.Drawing2D.CombineMode]::Replace)
    for ($ring = 0; $ring -lt 4; $ring++) {
        $age = (($time/2+$ring/4)%1)
        $width = 16+198*$age
        $height = 3+36*$age
        Paint-Sprite $g $images['ripple'] (278-15*$age) (337+26*$age) $width $height (0.72*[math]::Pow(1-$age,1.8))
    }
    $upperPhase = ($time/2)%1
    Paint-Sprite $g $images['upper-reflection'] 186 (239+$upperPhase*1.2) (84+$upperPhase*16) (15+$upperPhase*4) (0.52*(1-$upperPhase))
    $angle = $time/($rig.periodMs/1000)*2*$pi
    Paint-Rim $g $images['wheel-rear-rim'] $angle 1 0.91
    Paint-Flow $g $images['water-ribbon-tiled'] ([double[]]$rig.flows[0].path) $time $rig.flows[0].phase
    $paddles = for ($paddle = 0; $paddle -lt $rig.wheel.paddleCount; $paddle++) {
        $theta = $angle+$paddle*2*$pi/$rig.wheel.paddleCount
        [pscustomobject]@{Theta=$theta;Order=[math]::Cos($theta)}
    }
    foreach ($paddle in ($paddles | Sort-Object Order)) {
        $theta = $paddle.Theta
        $delta = $rig.wheel.paddleHalfAngle
        $a = Project-Wheel ([math]::Cos($theta-$delta)) ([math]::Sin($theta-$delta)) 0
        $b = Project-Wheel ([math]::Cos($theta-$delta)) ([math]::Sin($theta-$delta)) 1
        $c = Project-Wheel ([math]::Cos($theta+$delta)) ([math]::Sin($theta+$delta)) 0
        $texture = $images['paddle-front']
        if ($paddle.Order -lt 0) { $texture = $images['paddle-back'] }
        $coordinates = [double[]]@($a[0],$a[1],$b[0],$b[1],$c[0],$c[1])
        Paint-Quad $g $texture $coordinates ([Drawing.RectangleF]::new(0,0,$texture.Width,$texture.Height)) 1 (0.86+0.14*[math]::Max(0,-[math]::Sin($theta)))
        $a = Project-Wheel (0.94*[math]::Cos($theta)) (0.94*[math]::Sin($theta)) 0
        $b = Project-Wheel (0.94*[math]::Cos($theta)) (0.94*[math]::Sin($theta)) 1
        $c = Project-Wheel (1.06*[math]::Cos($theta)) (1.06*[math]::Sin($theta)) 0
        $coordinates = [double[]]@($a[0],$a[1],$b[0],$b[1],$c[0],$c[1])
        Paint-Quad $g $images['paddle-back'] $coordinates ([Drawing.RectangleF]::new(0,0,$texture.Width,$texture.Height)) 1 0.94
    }
    Paint-Rim $g $images['wheel-front'] $angle 0 1
    $g.DrawImageUnscaled($images['axle-foreground'],78,288)
    Paint-Flow $g $images['water-ribbon-tiled'] ([double[]]$rig.flows[1].path) $time $rig.flows[1].phase
    Paint-Flow $g $images['water-ribbon-tiled'] ([double[]]$rig.flows[2].path) $time $rig.flows[2].phase
    $impact = [math]::Pow([math]::Max(0,[math]::Sin($time*4*$pi)),3)
    Paint-Sprite $g $images['foam'] 175 (333-$impact*1.2) (26+$impact*4) (4+$impact*5) 0.8
    Paint-Sprite $g $images['foam'] 278 332 32 (3+$impact*2) 0.6
    for ($drop = 0; $drop -lt 3; $drop++) {
        $progress = (($time*2+$drop*0.22)%1)
        if ($progress -gt 0.8) { continue }
        $dt = $progress*0.55
        $x = 173+($drop*6+4)*$dt
        $y = 332-(21+$drop*3)*$dt+58*$dt*$dt
        $opacity = [math]::Min(1,(0.8-$progress)*5)
        Paint-Sprite $g $images['droplet'] $x $y (2.6-$drop*0.35) (3.9-$drop*0.4) $opacity
    }
    $g.Dispose()
    $canvas.Save((Join-Path $framesPath ('frame-'+$frame.ToString('000')+'.png')),[Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
}
foreach ($image in $images.Values) { $image.Dispose() }
$clip.Dispose()

