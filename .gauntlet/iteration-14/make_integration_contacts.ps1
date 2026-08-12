Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root 'integration-review'
New-Item -ItemType Directory -Path $out -Force | Out-Null

function New-ContactSheet {
  param(
    [string]$Name,
    [string[]]$Files,
    [int]$Columns,
    [System.Drawing.Rectangle]$Crop,
    [int]$CellWidth,
    [int]$CellHeight
  )
  $labelHeight = 24
  $rows = [Math]::Ceiling($Files.Count / $Columns)
  $sheet = New-Object System.Drawing.Bitmap ($Columns * $CellWidth), ($rows * ($CellHeight + $labelHeight))
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  $graphics.Clear([System.Drawing.Color]::FromArgb(10, 8, 16))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $font = New-Object System.Drawing.Font 'Consolas', 10
  $brush = [System.Drawing.Brushes]::White
  try {
    for ($index = 0; $index -lt $Files.Count; $index++) {
      $path = Join-Path $root $Files[$index]
      $source = [System.Drawing.Image]::FromFile($path)
      try {
        $column = $index % $Columns
        $row = [Math]::Floor($index / $Columns)
        $destination = New-Object System.Drawing.Rectangle ($column * $CellWidth), ($row * ($CellHeight + $labelHeight)), $CellWidth, $CellHeight
        $graphics.DrawImage($source, $destination, $Crop, [System.Drawing.GraphicsUnit]::Pixel)
        $graphics.DrawString([IO.Path]::GetFileNameWithoutExtension($Files[$index]), $font, $brush, $destination.X + 4, $destination.Bottom + 3)
      } finally {
        $source.Dispose()
      }
    }
    $sheet.Save((Join-Path $out "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $font.Dispose()
    $graphics.Dispose()
    $sheet.Dispose()
  }
}

$heroCrop = New-Object System.Drawing.Rectangle 35, 275, 350, 245
$muzzleCrop = New-Object System.Drawing.Rectangle 120, 315, 230, 150
$fullCrop = New-Object System.Drawing.Rectangle 0, 0, 960, 540

foreach ($hero in @('throttle', 'modo', 'vinnie')) {
  $releaseFiles = Get-ChildItem -LiteralPath $root -Filter "release-$hero-??.png" | Sort-Object Name | ForEach-Object Name
  New-ContactSheet -Name "release-$hero" -Files $releaseFiles -Columns 6 -Crop $heroCrop -CellWidth 280 -CellHeight 196
}

$rapidRelease = Get-ChildItem -LiteralPath $root -Filter 'release-vinnie-rapid-??.png' | Sort-Object Name | ForEach-Object Name
New-ContactSheet -Name 'release-vinnie-rapid' -Files $rapidRelease -Columns 6 -Crop $heroCrop -CellWidth 280 -CellHeight 196

foreach ($hero in @('throttle', 'modo')) {
  $sustainFiles = Get-ChildItem -LiteralPath $root -Filter "sustain-$hero-??.png" | Sort-Object Name | ForEach-Object Name
  New-ContactSheet -Name "sustain-$hero" -Files $sustainFiles -Columns 6 -Crop $heroCrop -CellWidth 280 -CellHeight 196
}
$vinnieSustain = Get-ChildItem -LiteralPath $root -Filter 'sustain-vinnie-rapid-??.png' | Sort-Object Name | ForEach-Object Name
New-ContactSheet -Name 'sustain-vinnie-rapid' -Files $vinnieSustain -Columns 7 -Crop $heroCrop -CellWidth 245 -CellHeight 172

$muzzleFiles = foreach ($hero in @('throttle', 'modo', 'vinnie')) {
  foreach ($pose in @('sustained', 'release', 'jump')) { "muzzle-$hero-$pose.png" }
}
New-ContactSheet -Name 'muzzle-all' -Files $muzzleFiles -Columns 3 -Crop $muzzleCrop -CellWidth 368 -CellHeight 240

$routeFiles = @('menu.png', 'select.png', 'ride.png', 'combat.png', 'aerial-combat.png', 'boss.png', 'victory.png')
New-ContactSheet -Name 'route' -Files $routeFiles -Columns 4 -Crop $fullCrop -CellWidth 384 -CellHeight 216

$impactFiles = Get-ChildItem -LiteralPath $root -Filter 'impact-??-*.png' | Sort-Object Name | ForEach-Object Name
New-ContactSheet -Name 'impact' -Files $impactFiles -Columns 4 -Crop $fullCrop -CellWidth 384 -CellHeight 216

Get-ChildItem -LiteralPath $out | Select-Object Name, Length
