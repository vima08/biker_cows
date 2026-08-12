param(
  [string]$IterationDirectory = '.gauntlet\iteration-15',
  [string]$VinnieSource = '.gauntlet\iteration-15\vinnie-portrait-chroma.png'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies 'System.Drawing.dll' -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class CharacterArtPixels {
  public static Rectangle RemoveMagentaAndBounds(Bitmap bitmap) {
    Rectangle whole = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
    BitmapData data = bitmap.LockBits(whole, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    try {
      int bytes = Math.Abs(data.Stride) * bitmap.Height;
      byte[] pixels = new byte[bytes];
      Marshal.Copy(data.Scan0, pixels, 0, bytes);
      int left = bitmap.Width, top = bitmap.Height, right = -1, bottom = -1;
      for (int y = 0; y < bitmap.Height; y++) {
        int row = y * data.Stride;
        for (int x = 0; x < bitmap.Width; x++) {
          int index = row + x * 4;
          int b = pixels[index], g = pixels[index + 1], r = pixels[index + 2];
          bool key = r > 120 && b > 120 && g < 110 && r - g > 45 && b - g > 45;
          if (key) {
            pixels[index + 3] = 0;
          } else {
            if (x < left) left = x; if (x > right) right = x;
            if (y < top) top = y; if (y > bottom) bottom = y;
          }
        }
      }
      Marshal.Copy(pixels, 0, data.Scan0, bytes);
      return right < left || bottom < top ? Rectangle.Empty : Rectangle.FromLTRB(left, top, right + 1, bottom + 1);
    } finally {
      bitmap.UnlockBits(data);
    }
  }
}
'@

$assetDirectory = 'public\assets\sprites'
$portraitPath = 'public\assets\ui\hero-portraits-sheet.png'
New-Item -ItemType Directory -Force -Path $IterationDirectory | Out-Null

function Backup-Once([string]$path, [string]$name) {
  $backup = Join-Path $IterationDirectory $name
  if (-not (Test-Path -LiteralPath $backup)) {
    Copy-Item -LiteralPath $path -Destination $backup
  }
  return $backup
}

function Paint-CorrectModoEye(
  [System.Drawing.Bitmap]$image,
  [int]$cellColumn,
  [int]$cellRow,
  [int]$frontEyeX,
  [int]$eyeY
) {
  $originX = $cellColumn * 256
  $originY = $cellRow * 192
  $eyeX = $originX + $frontEyeX
  $y = $originY + $eyeY
  $patchX = $eyeX - 11

  # Replace the erroneous mask over the front eye with nearby native fur
  # pixels first. Sampling the cheek keeps each pose's existing shade ramp and
  # avoids a synthetic grey bezel around the restored eye.
  $sampledFur = [System.Collections.Generic.List[object]]::new()
  for ($offsetY = -4; $offsetY -le 4; $offsetY++) {
    for ($offsetX = -7; $offsetX -le 7; $offsetX++) {
      $sampleX = [Math]::Max(0, [Math]::Min($image.Width - 1, $eyeX + $offsetX))
      $sampleY = [Math]::Max(0, [Math]::Min($image.Height - 1, $y + 7 + [int][Math]::Floor($offsetY / 2)))
      $destinationX = [int]$eyeX + [int]$offsetX
      $destinationY = [int]$y + [int]$offsetY
      $sampledFur.Add(@($destinationX, $destinationY, $image.GetPixel($sampleX, $sampleY)))
    }
  }
  foreach ($sample in $sampledFur) { $image.SetPixel($sample[0], $sample[1], $sample[2]) }

  $graphics = [System.Drawing.Graphics]::FromImage($image)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy

    # Restore fur where a generated black blob previously covered the front eye.
    $outline = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 10, 12, 16))
    $sclera = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 226, 220, 194))
    $iris = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 134, 31, 24))
    $pupil = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 18, 16, 17))
    $patch = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 13, 15, 19))
    $patchLight = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 43, 47, 51))
    $strapPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 12, 14, 18), 1)
    try {
      # The visible front eye faces right. Its bright sclera and pupil keep it
      # readable at the game's native sprite scale.
      $graphics.FillRectangle($outline, $eyeX - 3, $y - 1, 5, 2)
      $image.SetPixel($eyeX - 1, $y, [System.Drawing.Color]::FromArgb(255, 226, 220, 194))
      $image.SetPixel($eyeX, $y, [System.Drawing.Color]::FromArgb(255, 170, 43, 28))

      # Modo's anatomical right/rear eye is always viewer-left in these
      # right-facing poses. Keep one compact patch there, never on the bridge.
      $graphics.DrawLine($strapPen, $patchX - 2, $y - 2, $patchX - 10, $y - 7)
      $graphics.FillEllipse($outline, $patchX - 5, $y - 4, 10, 8)
      $graphics.FillEllipse($patch, $patchX - 4, $y - 3, 8, 6)
      $graphics.FillRectangle($patchLight, $patchX - 2, $y - 2, 4, 1)
    } finally {
      $outline.Dispose()
      $sclera.Dispose(); $iris.Dispose(); $pupil.Dispose(); $patch.Dispose(); $patchLight.Dispose(); $strapPen.Dispose()
    }
  } finally {
    $graphics.Dispose()
  }

  return [System.Drawing.Rectangle]::new($patchX - 11, $originY + $eyeY - 9, 30, 18)
}

function Apply-ModoSheetFix([string]$path, [string]$backupName, [array]$frames) {
  $backup = Backup-Once $path $backupName
  $before = [System.Drawing.Bitmap]::new((Resolve-Path $backup).Path)
  $after = [System.Drawing.Bitmap]::new((Resolve-Path $backup).Path)
  $allowed = [System.Collections.Generic.List[System.Drawing.Rectangle]]::new()
  try {
    foreach ($frame in $frames) {
      $allowed.Add((Paint-CorrectModoEye $after $frame.Column $frame.Row $frame.EyeX $frame.EyeY))
    }

    $outsideChanges = 0
    $insideChanges = 0
    for ($y = 0; $y -lt $before.Height; $y++) {
      for ($x = 0; $x -lt $before.Width; $x++) {
        if ($before.GetPixel($x, $y).ToArgb() -eq $after.GetPixel($x, $y).ToArgb()) { continue }
        $inside = $false
        foreach ($rectangle in $allowed) {
          if ($rectangle.Contains($x, $y)) { $inside = $true; break }
        }
        if ($inside) { $insideChanges++ } else { $outsideChanges++ }
      }
    }
    if ($outsideChanges -ne 0) { throw "$path changed $outsideChanges pixels outside the authorised face rectangles" }
    $after.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    [PSCustomObject]@{ Asset = $path; ChangedInsideFace = $insideChanges; ChangedOutsideFace = $outsideChanges }
  } finally {
    $before.Dispose(); $after.Dispose()
  }
}

$modoResults = @()
$modoResults += Apply-ModoSheetFix (Join-Path $assetDirectory 'modo-sheet.png') 'before-modo-sheet.png' @(
  @{ Column = 0; Row = 0; EyeX = 128; EyeY = 32 },
  @{ Column = 1; Row = 0; EyeX = 139; EyeY = 50 },
  @{ Column = 2; Row = 0; EyeX = 75; EyeY = 33 },
  @{ Column = 3; Row = 0; EyeX = 154; EyeY = 71 },
  @{ Column = 0; Row = 1; EyeX = 179; EyeY = 88 },
  @{ Column = 1; Row = 1; EyeX = 128; EyeY = 47 },
  @{ Column = 2; Row = 1; EyeX = 112; EyeY = 28 },
  @{ Column = 3; Row = 1; EyeX = 130; EyeY = 39 }
)
$modoResults += Apply-ModoSheetFix (Join-Path $assetDirectory 'sustained-fire-sheet.png') 'before-sustained-fire-sheet.png' @(
  @{ Column = 0; Row = 1; EyeX = 130; EyeY = 47 },
  @{ Column = 1; Row = 1; EyeX = 132; EyeY = 51 },
  @{ Column = 2; Row = 1; EyeX = 136; EyeY = 55 },
  @{ Column = 3; Row = 1; EyeX = 140; EyeY = 52 }
)
$modoResults += Apply-ModoSheetFix (Join-Path $assetDirectory 'fire-release-sheet.png') 'before-fire-release-sheet.png' @(
  @{ Column = 0; Row = 1; EyeX = 120; EyeY = 56 },
  @{ Column = 1; Row = 1; EyeX = 122; EyeY = 54 },
  @{ Column = 2; Row = 1; EyeX = 121; EyeY = 53 }
)

$portraitBackup = Backup-Once $portraitPath 'before-hero-portraits-sheet.png'
$portraitBefore = [System.Drawing.Bitmap]::new((Resolve-Path $portraitBackup).Path)
$portraitAfter = [System.Drawing.Bitmap]::new((Resolve-Path $portraitBackup).Path)
$vinnie = [System.Drawing.Bitmap]::new((Resolve-Path $VinnieSource).Path)
try {
  $sourceBounds = [CharacterArtPixels]::RemoveMagentaAndBounds($vinnie)
  if ($sourceBounds.IsEmpty) { throw 'Vinnie source has no opaque subject after chroma removal' }
  $scale = [Math]::Min(244.0 / $sourceBounds.Width, 186.0 / $sourceBounds.Height)
  $drawWidth = [Math]::Max(1, [int][Math]::Round($sourceBounds.Width * $scale))
  $drawHeight = [Math]::Max(1, [int][Math]::Round($sourceBounds.Height * $scale))
  $drawX = 512 + [int][Math]::Round((256 - $drawWidth) / 2)
  $drawY = 192 - $drawHeight

  $graphics = [System.Drawing.Graphics]::FromImage($portraitAfter)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.FillRectangle([System.Drawing.Brushes]::Transparent, 512, 0, 256, 192)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.DrawImage($vinnie, [System.Drawing.Rectangle]::new($drawX, $drawY, $drawWidth, $drawHeight), $sourceBounds, [System.Drawing.GraphicsUnit]::Pixel)
  } finally {
    $graphics.Dispose()
  }

  $preservedChanges = 0
  for ($y = 0; $y -lt 192; $y++) {
    for ($x = 0; $x -lt 512; $x++) {
      if ($portraitBefore.GetPixel($x, $y).ToArgb() -ne $portraitAfter.GetPixel($x, $y).ToArgb()) { $preservedChanges++ }
    }
  }
  if ($preservedChanges -ne 0) { throw "Portrait composite changed $preservedChanges pixels in preserved Throttle/Modo cells" }
  $portraitAfter.Save($portraitPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $portraitResult = [PSCustomObject]@{
    Asset = $portraitPath
    PreservedCellPixelChanges = $preservedChanges
    VinnieSourceBounds = "$($sourceBounds.X),$($sourceBounds.Y),$($sourceBounds.Width),$($sourceBounds.Height)"
    VinnieDestination = "$drawX,$drawY,$drawWidth,$drawHeight"
  }
} finally {
  $portraitBefore.Dispose(); $portraitAfter.Dispose(); $vinnie.Dispose()
}

$report = [PSCustomObject]@{ Modo = $modoResults; Portrait = $portraitResult }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $IterationDirectory 'character-art-report.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 5
