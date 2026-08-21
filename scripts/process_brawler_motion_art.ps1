param(
  [string]$SourceDirectory = ".gauntlet\iteration-23\raw",
  [string]$WorkingDirectory = ".gauntlet\iteration-23\processed",
  [string]$OutputDirectory = "public\assets\brawler"
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $WorkingDirectory, $OutputDirectory | Out-Null

& (Join-Path $PSScriptRoot 'process_sprite_sheets.ps1') -SourceDirectory $SourceDirectory -OutputDirectory $WorkingDirectory

Add-Type -AssemblyName System.Drawing

function Write-PatchedHeroAtlas {
  param(
    [string]$BaseName,
    [string]$OutputName,
    [array]$Patches
  )

  $base = [System.Drawing.Bitmap]::new((Resolve-Path (Join-Path $WorkingDirectory $BaseName)).Path)
  try {
    $atlas = [System.Drawing.Bitmap]::new(1024, 768, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($atlas)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
        $graphics.DrawImageUnscaled($base, 0, 0)
        $clearBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::Transparent)
        try {
          foreach ($patch in $Patches) {
            $source = [System.Drawing.Bitmap]::new((Resolve-Path (Join-Path $WorkingDirectory $patch.Source)).Path)
            try {
              $destination = [System.Drawing.Rectangle]::new($patch.DestColumn * 256, $patch.DestRow * 192, 256, 192)
              $sourceRect = [System.Drawing.Rectangle]::new($patch.SourceColumn * 256, $patch.SourceRow * 192, 256, 192)
              $graphics.FillRectangle($clearBrush, $destination)
              $graphics.DrawImage($source, $destination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
            } finally { $source.Dispose() }
          }
        } finally { $clearBrush.Dispose() }
      } finally { $graphics.Dispose() }
      $atlas.Save((Join-Path $OutputDirectory $OutputName), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $atlas.Dispose() }
  } finally { $base.Dispose() }
}

Write-PatchedHeroAtlas 'cassia-brawler-directional-sheet.png' 'cassia-brawler-sheet.png' @(
  @{ Source = 'cassia-opposite-right-sheet.png'; SourceColumn = 0; SourceRow = 0; DestColumn = 2; DestRow = 0 },
  @{ Source = 'cassia-opposite-left-sheet.png'; SourceColumn = 0; SourceRow = 0; DestColumn = 2; DestRow = 2 }
)
Write-PatchedHeroAtlas 'bruna-brawler-directional-sheet.png' 'bruna-brawler-sheet.png' @(
  @{ Source = 'bruna-opposite-right-sheet.png'; SourceColumn = 0; SourceRow = 0; DestColumn = 2; DestRow = 0 },
  @{ Source = 'bruna-opposite-left-sheet.png'; SourceColumn = 0; SourceRow = 0; DestColumn = 2; DestRow = 2 },
  @{ Source = 'bruna-pose-correction-sheet.png'; SourceColumn = 2; SourceRow = 0; DestColumn = 0; DestRow = 1 },
  @{ Source = 'bruna-pose-correction-sheet.png'; SourceColumn = 2; SourceRow = 1; DestColumn = 1; DestRow = 3 }
)
Write-PatchedHeroAtlas 'nova-brawler-directional-sheet.png' 'nova-brawler-sheet.png' @(
  @{ Source = 'nova-opposite-right-sheet.png'; SourceColumn = 0; SourceRow = 0; DestColumn = 2; DestRow = 0 },
  @{ Source = 'nova-opposite-left-sheet.png'; SourceColumn = 0; SourceRow = 0; DestColumn = 2; DestRow = 2 }
)

$gang = [System.Drawing.Bitmap]::new(1024, 1152, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
try {
  $graphics = [System.Drawing.Graphics]::FromImage($gang)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    # The original roster is an authoritative screen-left atlas. Build the
    # screen-right rows only by mirroring those exact cells so enemies can
    # never inherit an ambiguous/redrawn direction from generated sheets.
    $source = [System.Drawing.Bitmap]::new((Resolve-Path (Join-Path $WorkingDirectory 'enemy-roster-sheet.png')).Path)
    try {
      for ($enemyRow = 0; $enemyRow -lt 3; $enemyRow++) {
        for ($column = 0; $column -lt 4; $column++) {
          $sourceRect = [System.Drawing.Rectangle]::new($column * 256, $enemyRow * 192, 256, 192)

          # Left-facing production row: preserve the authored source exactly.
          $leftDestination = [System.Drawing.Rectangle]::new($column * 256, ($enemyRow * 2 + 1) * 192, 256, 192)
          $graphics.DrawImage($source, $leftDestination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)

          # Right-facing production row: deterministic horizontal mirror.
          $rightFrame = $source.Clone($sourceRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
          try {
            $rightFrame.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX)
            $graphics.DrawImageUnscaled($rightFrame, $column * 256, $enemyRow * 384)
          } finally { $rightFrame.Dispose() }
        }
      }
    } finally {
      $source.Dispose()
    }
  } finally { $graphics.Dispose() }
  $gang.Save((Join-Path $OutputDirectory 'venus-gang-sheet.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $gang.Dispose() }

Write-Output "Directional brawler art ready in $OutputDirectory"
