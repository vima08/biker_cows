param([string]$Output = ".gauntlet\iteration-15\modo-face-map.png")

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sources = @(
  @{ Path = 'public\assets\sprites\modo-sheet.png'; Columns = 4; Rows = 2; Frames = 8; SourceRow = -1 },
  @{ Path = 'public\assets\sprites\sustained-fire-sheet.png'; Columns = 4; Rows = 3; Frames = 4; SourceRow = 1 },
  @{ Path = 'public\assets\sprites\fire-release-sheet.png'; Columns = 3; Rows = 3; Frames = 3; SourceRow = 1 }
)

$crop = [System.Drawing.Rectangle]::new(56, 0, 112, 112)
$scale = 3
$tileWidth = $crop.Width * $scale
$tileHeight = $crop.Height * $scale
$outputImage = [System.Drawing.Bitmap]::new($tileWidth * 5, $tileHeight * 3, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
try {
  $graphics = [System.Drawing.Graphics]::FromImage($outputImage)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(24, 24, 28))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $outputIndex = 0
    foreach ($sourceDefinition in $sources) {
      $source = [System.Drawing.Bitmap]::new((Resolve-Path $sourceDefinition.Path).Path)
      try {
        for ($frame = 0; $frame -lt $sourceDefinition.Frames; $frame++) {
          $sourceColumn = $frame % $sourceDefinition.Columns
          $sourceRow = if ($sourceDefinition.SourceRow -ge 0) { $sourceDefinition.SourceRow } else { [int][Math]::Floor($frame / $sourceDefinition.Columns) }
          $sourceRect = [System.Drawing.Rectangle]::new($sourceColumn * 256 + $crop.X, $sourceRow * 192 + $crop.Y, $crop.Width, $crop.Height)
          $destination = [System.Drawing.Rectangle]::new(($outputIndex % 5) * $tileWidth, [int][Math]::Floor($outputIndex / 5) * $tileHeight, $tileWidth, $tileHeight)
          $graphics.DrawImage($source, $destination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
          $outputIndex++
        }
      } finally {
        $source.Dispose()
      }
    }
  } finally {
    $graphics.Dispose()
  }
  $directory = Split-Path -Parent $Output
  if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
  $outputImage.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $outputImage.Dispose()
}
