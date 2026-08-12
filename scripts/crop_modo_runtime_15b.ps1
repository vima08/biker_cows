param([string]$IterationDirectory = '.gauntlet\iteration-15')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$names = @(
  'modo-15b-runtime-base',
  'modo-15b-runtime-sustain-0',
  'modo-15b-runtime-sustain-1',
  'modo-15b-runtime-sustain-2',
  'modo-15b-runtime-sustain-3',
  'modo-15b-runtime-release-0',
  'modo-15b-runtime-release-1',
  'modo-15b-runtime-release-2'
)
$crop = [System.Drawing.Rectangle]::new(55, 300, 180, 125)
$scale = 3
$tileWidth = $crop.Width * $scale
$tileHeight = $crop.Height * $scale
$contact = [System.Drawing.Bitmap]::new($tileWidth * 4, $tileHeight * 2, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
try {
  $graphics = [System.Drawing.Graphics]::FromImage($contact)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(18, 18, 24))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    for ($index = 0; $index -lt $names.Count; $index++) {
      $source = [System.Drawing.Bitmap]::new((Resolve-Path (Join-Path $IterationDirectory ($names[$index] + '.png'))).Path)
      try {
        $destination = [System.Drawing.Rectangle]::new(($index % 4) * $tileWidth, [int][Math]::Floor($index / 4) * $tileHeight, $tileWidth, $tileHeight)
        $graphics.DrawImage($source, $destination, $crop, [System.Drawing.GraphicsUnit]::Pixel)
      } finally {
        $source.Dispose()
      }
    }
  } finally {
    $graphics.Dispose()
  }
  $contact.Save((Join-Path $IterationDirectory 'modo-15b-runtime-contact.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $contact.Dispose()
}
