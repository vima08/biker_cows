param(
  [ValidateRange(1, 100)]
  [int]$Quality = 88
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '../public/assets'
$sources = @(
  'venus-title-key-art.png',
  'intro/venus-beach-01-rest.png',
  'intro/venus-beach-02-blast.png',
  'intro/venus-beach-03-jackets.png',
  'intro/venus-beach-04-ride.png',
  'outro/venus-victory-01-parade.png',
  'outro/venus-victory-02-fireworks.png',
  'world/venus-highway-panorama.png',
  'brawler/furnace-district-panorama.png',
  'road-rash/venus-badlands-panorama-v2-open-road.png'
)
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object MimeType -eq 'image/jpeg'
$parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
  [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality
)
[long]$before = 0
[long]$after = 0
try {
  foreach ($source in $sources) {
    $inputPath = (Resolve-Path -LiteralPath (Join-Path $assetDirectory $source)).Path
    $outputPath = [System.IO.Path]::ChangeExtension($inputPath, '.jpg')
    $image = [System.Drawing.Bitmap]::new($inputPath)
    try {
      # Preserve native dimensions; only opaque scene artwork belongs in this list.
      $image.Save($outputPath, $encoder, $parameters)
      $originalBytes = (Get-Item -LiteralPath $inputPath).Length
      $jpegBytes = (Get-Item -LiteralPath $outputPath).Length
      $before += $originalBytes
      $after += $jpegBytes
      Write-Output "$source ($($image.Width)x$($image.Height)): $originalBytes -> $jpegBytes bytes"
    } finally { $image.Dispose() }
  }
} finally { $parameters.Dispose() }
Write-Output "Total: $before -> $after bytes ($([Math]::Round(100 * (1 - $after / $before), 1))% smaller)"
