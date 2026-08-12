param(
  [string]$SourceDirectory = ".gauntlet\iteration-5",
  [string]$OutputDirectory = "public\assets\sprites"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies 'System.Drawing.dll' -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;

public static class RedlineSpriteTools {
  private static bool IsKey(Color c) {
    bool flatKey = c.R > 155 && c.B > 155 && c.R - c.G > 90 && c.B - c.G > 90;
    bool darkKeyFringe = c.R > 120 && c.B > 120 && c.G < 85
      && c.R - c.G > 65 && c.B - c.G > 65 && Math.Abs(c.R - c.B) < 70;
    return flatKey || darkKeyFringe;
  }

  public static Rectangle ContentBounds(Bitmap image, Rectangle cell) {
    int left = cell.Right, top = cell.Bottom, right = cell.Left, bottom = cell.Top;
    for (int y = cell.Top; y < cell.Bottom; y++) {
      for (int x = cell.Left; x < cell.Right; x++) {
        if (!IsKey(image.GetPixel(x, y))) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (right < left || bottom < top) return new Rectangle(cell.X, cell.Y, 1, 1);
    return Rectangle.FromLTRB(left, top, right + 1, bottom + 1);
  }

  public static void RemoveMagentaMatte(Bitmap image) {
    for (int y = 0; y < image.Height; y++) {
      for (int x = 0; x < image.Width; x++) {
        Color c = image.GetPixel(x, y);
        double dr = 255 - c.R;
        double dg = c.G;
        double db = 255 - c.B;
        double distance = Math.Sqrt(dr * dr + dg * dg + db * db);
        bool magentaDominant = c.R > 155 && c.B > 155 && c.R - c.G > 65 && c.B - c.G > 65;
        bool darkKeyFringe = c.R > 120 && c.B > 120 && c.G < 85
          && c.R - c.G > 65 && c.B - c.G > 65 && Math.Abs(c.R - c.B) < 70;
        if (distance <= 12 || (magentaDominant && distance < 40) || darkKeyFringe) {
          image.SetPixel(x, y, Color.Transparent);
          continue;
        }
        if (!magentaDominant || distance >= 220) continue;

        double alpha = Math.Max(0.06, Math.Min(1.0, (distance - 12) / 208.0));
        int r = Clamp((int)Math.Round((c.R - (1 - alpha) * 255) / alpha));
        int g = Clamp((int)Math.Round(c.G / alpha));
        int b = Clamp((int)Math.Round((c.B - (1 - alpha) * 255) / alpha));
        image.SetPixel(x, y, Color.FromArgb(Clamp((int)Math.Round(alpha * 255)), r, g, b));
      }
    }
  }

  public static void KeepLargestComponent(Bitmap image, Rectangle cell) {
    int width = cell.Width, height = cell.Height;
    bool[] visited = new bool[width * height];
    List<List<Point>> components = new List<List<Point>>();
    int[] dx = {-1, 0, 1, -1, 1, -1, 0, 1};
    int[] dy = {-1, -1, -1, 0, 0, 1, 1, 1};

    for (int localY = 0; localY < height; localY++) {
      for (int localX = 0; localX < width; localX++) {
        int start = localY * width + localX;
        if (visited[start]) continue;
        visited[start] = true;
        if (image.GetPixel(cell.X + localX, cell.Y + localY).A <= 24) continue;

        List<Point> component = new List<Point>();
        Queue<Point> queue = new Queue<Point>();
        queue.Enqueue(new Point(localX, localY));
        while (queue.Count > 0) {
          Point point = queue.Dequeue();
          component.Add(point);
          for (int direction = 0; direction < 8; direction++) {
            int nx = point.X + dx[direction], ny = point.Y + dy[direction];
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            int next = ny * width + nx;
            if (visited[next]) continue;
            visited[next] = true;
            if (image.GetPixel(cell.X + nx, cell.Y + ny).A > 24) queue.Enqueue(new Point(nx, ny));
          }
        }
        components.Add(component);
      }
    }

    List<Point> largest = null;
    foreach (List<Point> component in components) {
      if (largest == null || component.Count > largest.Count) largest = component;
    }
    foreach (List<Point> component in components) {
      if (Object.ReferenceEquals(component, largest)) continue;
      foreach (Point point in component) image.SetPixel(cell.X + point.X, cell.Y + point.Y, Color.Transparent);
    }
  }

  private static int Clamp(int value) { return Math.Max(0, Math.Min(255, value)); }
}
'@

$definitions = @(
  @{ Name = 'throttle'; Source = 'throttle-chroma.png'; Output = 'throttle-sheet.png'; Columns = 4; Rows = 2; SingleComponent = $true },
  @{ Name = 'modo'; Source = 'modo-chroma.png'; Output = 'modo-sheet.png'; Columns = 4; Rows = 2; SingleComponent = $true },
  @{ Name = 'vinnie'; Source = 'vinnie-chroma.png'; Output = 'vinnie-sheet.png'; Columns = 4; Rows = 2; SingleComponent = $true },
  @{ Name = 'sustainedFire'; Source = 'sustained-fire-chroma.png'; Output = 'sustained-fire-sheet.png'; Columns = 4; Rows = 3; SingleComponent = $true },
  @{ Name = 'fireRelease'; Source = 'fire-release-chroma.png'; Output = 'fire-release-sheet.png'; Columns = 3; Rows = 3; SingleComponent = $true },
  @{ Name = 'heroPortraits'; Source = 'hero-portraits-chroma.png'; Output = 'hero-portraits-sheet.png'; Columns = 3; Rows = 1; Centered = $true },
  @{ Name = 'rider'; Source = 'rider-chroma.png'; Output = 'rider-sheet.png'; Columns = 3; Rows = 2 },
  @{ Name = 'riderImpact'; Source = 'rider-impact-chroma.png'; Output = 'rider-impact-sheet.png'; Columns = 4; Rows = 3 },
  @{ Name = 'impactMaterial'; Source = 'impact-material-chroma.png'; Output = 'impact-material-sheet.png'; Columns = 4; Rows = 2; Centered = $true },
  @{ Name = 'bossCore'; Source = 'boss-core-chroma.png'; Output = 'boss-core-sheet.png'; Columns = 3; Rows = 2 },
  @{ Name = 'bossBody'; Source = 'boss-body-chroma.png'; Output = 'boss-body-sheet.png'; Columns = 3; Rows = 2 },
  @{ Name = 'roadRipper'; Source = 'road-ripper-chroma.png'; Output = 'road-ripper-sheet.png'; Columns = 3; Rows = 2 },
  @{ Name = 'aerials'; Source = 'aerials-chroma.png'; Output = 'aerials-sheet.png'; Columns = 4; Rows = 2 }
)

$frameWidth = 256
$frameHeight = 192
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

foreach ($definition in $definitions) {
  $candidate = Join-Path $SourceDirectory $definition.Source
  if (-not (Test-Path -LiteralPath $candidate)) {
    Write-Output ("{0}: skipped; source not present in {1}" -f $definition.Name, $SourceDirectory)
    continue
  }
  $sourcePath = Resolve-Path $candidate
  $source = [System.Drawing.Bitmap]::new($sourcePath.Path)
  try {
    $cellWidth = [int][Math]::Floor($source.Width / $definition.Columns)
    $cellHeight = [int][Math]::Floor($source.Height / $definition.Rows)
    $bounds = [System.Collections.Generic.List[System.Drawing.Rectangle]]::new()
    $maxWidth = 1
    $maxHeight = 1

    for ($row = 0; $row -lt $definition.Rows; $row++) {
      for ($column = 0; $column -lt $definition.Columns; $column++) {
        $cell = [System.Drawing.Rectangle]::new($column * $cellWidth, $row * $cellHeight, $cellWidth, $cellHeight)
        $content = [RedlineSpriteTools]::ContentBounds($source, $cell)
        $bounds.Add($content)
        $maxWidth = [Math]::Max($maxWidth, $content.Width)
        $maxHeight = [Math]::Max($maxHeight, $content.Height)
      }
    }

    $scale = [Math]::Min(($frameWidth - 8) / $maxWidth, ($frameHeight - 8) / $maxHeight)
    $atlas = [System.Drawing.Bitmap]::new($frameWidth * $definition.Columns, $frameHeight * $definition.Rows, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($atlas)
      try {
        $graphics.Clear([System.Drawing.Color]::Magenta)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

        for ($index = 0; $index -lt $bounds.Count; $index++) {
          $sourceBounds = $bounds[$index]
          $drawWidth = [Math]::Max(1, [int][Math]::Round($sourceBounds.Width * $scale))
          $drawHeight = [Math]::Max(1, [int][Math]::Round($sourceBounds.Height * $scale))
          $column = $index % $definition.Columns
          $row = [int][Math]::Floor($index / $definition.Columns)
          $drawX = $column * $frameWidth + [int][Math]::Round(($frameWidth - $drawWidth) / 2)
          $drawY = if ($definition.Centered) {
            $row * $frameHeight + [int][Math]::Round(($frameHeight - $drawHeight) / 2)
          } else {
            $row * $frameHeight + $frameHeight - 4 - $drawHeight
          }
          $destination = [System.Drawing.Rectangle]::new($drawX, $drawY, $drawWidth, $drawHeight)
          $graphics.DrawImage($source, $destination, $sourceBounds, [System.Drawing.GraphicsUnit]::Pixel)
        }
      } finally {
        $graphics.Dispose()
      }

      [RedlineSpriteTools]::RemoveMagentaMatte($atlas)
      if ($definition.SingleComponent) {
        for ($row = 0; $row -lt $definition.Rows; $row++) {
          for ($column = 0; $column -lt $definition.Columns; $column++) {
            $frame = [System.Drawing.Rectangle]::new($column * $frameWidth, $row * $frameHeight, $frameWidth, $frameHeight)
            [RedlineSpriteTools]::KeepLargestComponent($atlas, $frame)
          }
        }
      }
      $outputPath = Join-Path $OutputDirectory $definition.Output
      $atlas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output ("{0}: {1}x{2}, {3} frames, shared scale {4:N3} -> {5}" -f $definition.Name, $atlas.Width, $atlas.Height, $bounds.Count, $scale, $outputPath)
    } finally {
      $atlas.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}
