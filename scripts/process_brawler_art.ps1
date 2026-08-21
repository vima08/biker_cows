param(
  [string]$SourceDirectory = ".gauntlet\iteration-19\raw",
  [string]$WorkingDirectory = ".gauntlet\iteration-19\processed",
  [string]$OutputDirectory = "public\assets\brawler"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $WorkingDirectory, $OutputDirectory | Out-Null

# Reuse the project's established magenta-matte, shared-scale and nearest-neighbour
# processor.  The raw file names intentionally match its semantic definitions.
& (Join-Path $PSScriptRoot 'process_sprite_sheets.ps1') -SourceDirectory $SourceDirectory -OutputDirectory $WorkingDirectory

$copies = @(
  @('cassia-sheet.png', 'cassia-brawler-sheet.png'),
  @('bruna-sheet.png', 'bruna-brawler-sheet.png'),
  @('nova-sheet.png', 'nova-brawler-sheet.png'),
  @('enemy-roster-sheet.png', 'venus-gang-sheet.png'),
  @('boss-body-sheet.png', 'forge-overseer-sheet.png')
)
foreach ($copy in $copies) {
  Copy-Item -LiteralPath (Join-Path $WorkingDirectory $copy[0]) -Destination (Join-Path $OutputDirectory $copy[1]) -Force
}

# Two independently authored 2:1 plates form a scrollable 4:1 panorama. Keeping
# them at native resolution avoids a soft resampling pass before Canvas crops it.
$left = [System.Drawing.Bitmap]::new((Resolve-Path (Join-Path $SourceDirectory 'furnace-district-panorama.png')).Path)
$right = [System.Drawing.Bitmap]::new((Resolve-Path (Join-Path $SourceDirectory 'furnace-district-extension.png')).Path)
try {
  $height = [Math]::Min($left.Height, $right.Height)
  $panorama = [System.Drawing.Bitmap]::new($left.Width + $right.Width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($panorama)
    try {
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
      $graphics.DrawImage($left, 0, 0, $left.Width, $height)
      $graphics.DrawImage($right, $left.Width, 0, $right.Width, $height)
    } finally { $graphics.Dispose() }
    $panorama.Save((Join-Path $OutputDirectory 'furnace-district-panorama.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $panorama.Dispose() }
} finally {
  $left.Dispose()
  $right.Dispose()
}

Copy-Item -LiteralPath (Join-Path $SourceDirectory 'furnace-floor.png') -Destination (Join-Path $OutputDirectory 'furnace-floor.png') -Force
Write-Output "Brawler art ready in $OutputDirectory"
