$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$drawingAssemblyPaths = @([System.Drawing.Bitmap].Assembly.Location, [System.Drawing.Graphics].Assembly.Location, [System.Drawing.Point].Assembly.Location)
$privateAssemblyPaths = @(Get-ChildItem -LiteralPath $PSHOME -Filter 'System.Private.Windows.*.dll' | ForEach-Object { $_.FullName })
$assemblyPaths = @($drawingAssemblyPaths + $privateAssemblyPaths) | Select-Object -Unique
Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'preview-renderer.cs') -Raw) -ReferencedAssemblies $assemblyPaths
$outputRoot = Split-Path -Parent $PSScriptRoot
$spec = Get-Content -LiteralPath (Join-Path $outputRoot 'rig.json') -Raw | ConvertFrom-Json
$bones = [RigBone[]]::new($spec.bones.Count)
for ($i = 0; $i -lt $spec.bones.Count; $i++) {
    $bone = [RigBone]::new()
    $bone.Parent = $spec.bones[$i].parent
    $bone.X = $spec.bones[$i].x
    $bone.Y = $spec.bones[$i].y
    $bones[$i] = $bone
}
$parts = [RigPart[]]::new($spec.parts.Count)
for ($i = 0; $i -lt $spec.parts.Count; $i++) {
    $sourcePart = $spec.parts[$i]
    $part = [RigPart]::new()
    $part.TexturePath = Join-Path $outputRoot $sourcePart.texture
    $part.Triangles = [int[]]$sourcePart.triangles
    $part.Vertices = [RigVertex[]]::new($sourcePart.vertices.Count)
    for ($v = 0; $v -lt $sourcePart.vertices.Count; $v++) {
        $sourceVertex = $sourcePart.vertices[$v]
        $vertex = [RigVertex]::new()
        $vertex.X = $sourceVertex.x
        $vertex.Y = $sourceVertex.y
        $vertex.Bones = [int[]]@($sourceVertex.weights | ForEach-Object { $_.bone })
        $vertex.Weights = [double[]]@($sourceVertex.weights | ForEach-Object { $_.weight })
        $part.Vertices[$v] = $vertex
    }
    $parts[$i] = $part
}
function Get-SmoothValue {
    param($value)
    $x = [math]::Clamp([double]$value,0.0,1.0)
    return $x*$x*$x*($x*($x*6-15)+10)
}
function Get-CurveValue {
    param($time, $keys)
    if ($time -le $keys[0][0]) { return [double]$keys[0][1] }
    for ($keyIndex=1; $keyIndex -lt $keys.Count; $keyIndex++) {
        if ($time -gt $keys[$keyIndex][0]) { continue }
        $a=$keys[$keyIndex-1]
        $b=$keys[$keyIndex]
        $mix=Get-SmoothValue (($time-$a[0])/($b[0]-$a[0]))
        return [double]($a[1]+($b[1]-$a[1])*$mix)
    }
    return [double]$keys[-1][1]
}
$bellowsKeys = @(@(0.0,0),@(0.45,0),@(1.35,-14),@(1.45,-14),@(1.70,14),@(2.10,-4),@(2.80,0),@(4.0,0))
$leverKeys = @(@(0.0,0),@(0.45,0),@(1.35,-6),@(1.45,-6),@(1.70,18),@(2.10,-3),@(2.80,0),@(4.0,0))
$capKeys = @(@(0.0,0),@(0.60,0),@(1.45,1),@(1.65,1),@(2.10,-1),@(2.75,0.22),@(3.45,0),@(4.0,0))
$neckKeys = @(@(0.0,0),@(0.65,0),@(1.45,-2),@(1.85,1),@(2.60,0),@(4.0,0))
$fps = 20
$frameCount = 80
$frameRoot = Join-Path $outputRoot 'Frames'
New-Item -ItemType Directory -Path $frameRoot -Force | Out-Null
$particlePath = Join-Path $outputRoot 'Particles/spore.png'
for ($frameIndex=0; $frameIndex -lt $frameCount; $frameIndex++) {
    $time=$frameIndex/[double]$fps
    $angles=[double[]]::new($bones.Count)
    $offsets=[double[]]::new($bones.Count)
    $left=Get-CurveValue $time $capKeys
    $right=Get-CurveValue ([math]::Max(0.0,$time-0.08)) $capKeys
    $angles[4]=1.8*$left
    $angles[5]=2.2*$left
    $angles[6]=-1.8*$right
    $angles[7]=-2.2*$right
    $angles[9]=Get-CurveValue $time $leverKeys
    $offsets[2]=Get-CurveValue $time $neckKeys
    $offsets[8]=Get-CurveValue $time $bellowsKeys
    $particles=[System.Collections.Generic.List[RigParticle]]::new()
    foreach ($side in @(-1,1)) {
        for ($particleIndex=0; $particleIndex -lt 6; $particleIndex++) {
            $birth = $(if ($side -eq -1) { 1.65 } else { 1.80 }) + $particleIndex*0.035
            $life = 0.82 + $particleIndex*0.055
            $age = $time-$birth
            if ($age -lt 0 -or $age -ge $life) { continue }
            $progress=$age/$life
            $particle=[RigParticle]::new()
            $particle.X=$(if ($side -eq -1) { 61 } else { 433 }) + $side*(24+$particleIndex*2.5)*$age
            $particle.Y=$(if ($side -eq -1) { 271 } else { 282 }) - (13+$particleIndex*2.6)*$age - 3*$age*$age
            $particle.Size=(4.5+0.2*($particleIndex%3))*(0.85+0.15*[math]::Sin([math]::PI*$progress))
            $particle.Opacity=0.8*[math]::Min(1.0,$age/0.05)*(1-(Get-SmoothValue (($progress-0.35)/0.65)))
            $particles.Add($particle)
        }
    }
    $framePath=Join-Path $frameRoot ('frame-{0:D3}.png' -f $frameIndex)
    [RigSourceRenderer]::RenderTransparentAnimationFrame($parts,$bones,$angles,$offsets,$particles.ToArray(),$particlePath,$framePath)
    if (($frameIndex+1)%20 -eq 0) { Write-Output ('Rendered {0}/{1} frames' -f ($frameIndex+1),$frameCount) }
}
$timeline=[ordered]@{
    frameSize=@(512,512)
    fps=$fps
    frameCount=$frameCount
    durationMs=4000
    loop=$true
    background=$null
    sourcePoseCount=1
    additionalFullPoseDrawings=0
    bellowsKeys=$bellowsKeys
    leverKeys=$leverKeys
    capKeys=$capKeys
    rightCapDelayMs=80
    neckKeys=$neckKeys
    particleEmitterTimesMs=@(1650,1800)
}
$timelineText=($timeline | ConvertTo-Json -Depth 20).Replace("`r`n","`n").Replace("`n","`r`n")
[System.IO.File]::WriteAllText((Join-Path $outputRoot 'animation.json'),$timelineText,[System.Text.UTF8Encoding]::new($false))
