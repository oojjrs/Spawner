param([int]$Count)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$references = @('System.Drawing.Common.dll','System.Drawing.Primitives.dll','System.Private.Windows.GdiPlus.dll','System.Runtime.dll','System.Runtime.InteropServices.dll','System.Collections.dll','System.Text.Json.dll','System.Memory.dll')
$references += @(Get-ChildItem -LiteralPath $PSHOME -Filter 'System.Private.Windows.*.dll' | ForEach-Object FullName)
$references = @($references | Select-Object -Unique)
Add-Type -Path (Join-Path $PSScriptRoot 'Renderer.cs') -ReferencedAssemblies $references
[SpringNestWaterRenderer]::Run($PSScriptRoot,$Count)

