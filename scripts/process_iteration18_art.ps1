param(
  [string]$SourceDirectory = ".gauntlet\iteration-18\raw",
  [string]$PreparedDirectory = ".gauntlet\iteration-18\prepared",
  [string]$ProcessedDirectory = ".gauntlet\iteration-18\processed"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies 'System.Drawing.dll' -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Iteration18ArtTools {
  private static bool IsNearWhite(byte b, byte g, byte r, byte a) {
    return a < 8 || (r > 230 && g > 230 && b > 230 && Math.Abs(r - g) < 18 && Math.Abs(r - b) < 24);
  }

  public static void FloodWhiteBackground(string sourcePath, string destinationPath) {
    using (Bitmap source = new Bitmap(sourcePath))
    using (Bitmap image = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb)) {
      using (Graphics graphics = Graphics.FromImage(image)) graphics.DrawImageUnscaled(source, 0, 0);
      Rectangle bounds = new Rectangle(0, 0, image.Width, image.Height);
      BitmapData data = image.LockBits(bounds, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int stride = data.Stride;
      byte[] pixels = new byte[Math.Abs(stride) * image.Height];
      Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
      bool[] visited = new bool[image.Width * image.Height];
      Queue<int> queue = new Queue<int>();

      Action<int,int> enqueue = (x, y) => {
        int index = y * image.Width + x;
        if (visited[index]) return;
        int offset = y * stride + x * 4;
        if (!IsNearWhite(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3])) return;
        visited[index] = true;
        queue.Enqueue(index);
      };

      for (int x = 0; x < image.Width; x++) { enqueue(x, 0); enqueue(x, image.Height - 1); }
      for (int y = 0; y < image.Height; y++) { enqueue(0, y); enqueue(image.Width - 1, y); }

      while (queue.Count > 0) {
        int index = queue.Dequeue();
        int x = index % image.Width;
        int y = index / image.Width;
        int offset = y * stride + x * 4;
        pixels[offset] = 255;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 255;
        pixels[offset + 3] = 255;
        if (x > 0) enqueue(x - 1, y);
        if (x + 1 < image.Width) enqueue(x + 1, y);
        if (y > 0) enqueue(x, y - 1);
        if (y + 1 < image.Height) enqueue(x, y + 1);
      }

      Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
      image.UnlockBits(data);
      image.Save(destinationPath, ImageFormat.Png);
    }
  }

  public static void CopyRegion(string targetPath, string sourcePath, Rectangle region) {
    using (Bitmap targetSource = new Bitmap(targetPath))
    using (Bitmap source = new Bitmap(sourcePath))
    using (Bitmap result = new Bitmap(targetSource.Width, targetSource.Height, PixelFormat.Format32bppArgb)) {
      using (Graphics graphics = Graphics.FromImage(result)) {
        graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
        graphics.DrawImageUnscaled(targetSource, 0, 0);
        graphics.DrawImage(source, region, region, GraphicsUnit.Pixel);
      }
      targetSource.Dispose();
      result.Save(targetPath, ImageFormat.Png);
    }
  }

  public static void CropShoulder(string sourcePath, string destinationPath) {
    using (Bitmap source = new Bitmap(sourcePath))
    using (Bitmap result = new Bitmap(1024, 128, PixelFormat.Format32bppArgb)) {
      int cropHeight = Math.Max(1, source.Width / 8);
      int sourceY = Math.Max(0, Math.Min(source.Height - cropHeight, (int)Math.Round(source.Height * .43)));
      Rectangle sourceRect = new Rectangle(0, sourceY, source.Width, cropHeight);
      using (Graphics graphics = Graphics.FromImage(result)) {
        graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
        graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;
        graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
        graphics.DrawImage(source, new Rectangle(0, 0, 1024, 128), sourceRect, GraphicsUnit.Pixel);
      }
      result.Save(destinationPath, ImageFormat.Png);
    }
  }
}
'@

New-Item -ItemType Directory -Path $PreparedDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $ProcessedDirectory -Force | Out-Null

[Iteration18ArtTools]::FloodWhiteBackground(
  (Resolve-Path (Join-Path $SourceDirectory 'bruna-base-white.png')).Path,
  (Join-Path (Resolve-Path $PreparedDirectory).Path 'bruna-base-chroma.png')
)
[Iteration18ArtTools]::FloodWhiteBackground(
  (Resolve-Path (Join-Path $SourceDirectory 'cow-sustained-fire-white.png')).Path,
  (Join-Path (Resolve-Path $PreparedDirectory).Path 'cow-sustained-fire-chroma.png')
)
[Iteration18ArtTools]::FloodWhiteBackground(
  (Resolve-Path (Join-Path $SourceDirectory 'nova-base-white.png')).Path,
  (Join-Path (Resolve-Path $PreparedDirectory).Path 'nova-base-chroma.png')
)
Copy-Item -LiteralPath (Join-Path $SourceDirectory 'cow-fire-release-chroma.png') -Destination (Join-Path $PreparedDirectory 'cow-fire-release-chroma.png') -Force

& (Join-Path $PSScriptRoot 'process_sprite_sheets.ps1') -SourceDirectory $PreparedDirectory -OutputDirectory $ProcessedDirectory

Copy-Item -LiteralPath (Join-Path $ProcessedDirectory 'bruna-sheet.png') -Destination 'public\assets\sprites\bruna-sheet.png' -Force
[Iteration18ArtTools]::CopyRegion('public\assets\sprites\cow-sustained-fire-sheet.png', (Resolve-Path (Join-Path $ProcessedDirectory 'cow-sustained-fire-sheet.png')).Path, [System.Drawing.Rectangle]::new(0, 192, 1024, 192))
[Iteration18ArtTools]::CopyRegion('public\assets\sprites\cow-fire-release-sheet.png', (Resolve-Path (Join-Path $ProcessedDirectory 'cow-fire-release-sheet.png')).Path, [System.Drawing.Rectangle]::new(0, 192, 768, 192))
[Iteration18ArtTools]::CopyRegion('public\assets\sprites\nova-sheet.png', (Resolve-Path (Join-Path $ProcessedDirectory 'nova-sheet.png')).Path, [System.Drawing.Rectangle]::new(0, 192, 256, 192))
[Iteration18ArtTools]::CropShoulder(
  (Resolve-Path (Join-Path $SourceDirectory 'venus-shoulder-source.png')).Path,
  (Join-Path (Resolve-Path 'public\assets\world').Path 'venus-shoulder-strip.png')
)

Write-Output 'Iteration 18 art processed: Bruna arms, Nova overlap, and Venus shoulder strip.'
