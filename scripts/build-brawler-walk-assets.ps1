param(
  [string]$SourceDir = '.gauntlet/iteration-27/gait-sources',
  [string]$OutputDir = 'public/assets/brawler'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class WalkAtlasBuilder {
  private static bool IsKey(Color c, bool green) {
    if (green) return c.G > 155 && c.G > c.R * 1.32 && c.G > c.B * 1.32;
    return c.R > 155 && c.B > 120 && c.R > c.G * 1.28 && c.B > c.G * 1.18;
  }

  private static Bitmap ExtractRange(Bitmap source, int left, int right, bool green) {
    Bitmap keyed = new Bitmap(right - left, source.Height, PixelFormat.Format32bppArgb);
    int minX = keyed.Width, minY = keyed.Height, maxX = -1, maxY = -1;
    for (int y = 0; y < keyed.Height; y++) {
      for (int x = 0; x < keyed.Width; x++) {
        Color c = source.GetPixel(left + x, y);
        if (IsKey(c, green)) {
          keyed.SetPixel(x, y, Color.Transparent);
        } else {
          keyed.SetPixel(x, y, c);
          minX = Math.Min(minX, x); minY = Math.Min(minY, y);
          maxX = Math.Max(maxX, x); maxY = Math.Max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) throw new InvalidOperationException("No sprite pixels in requested region");
    Bitmap trimmed = new Bitmap(maxX - minX + 1, maxY - minY + 1, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(trimmed)) {
      g.CompositingMode = CompositingMode.SourceCopy;
      g.DrawImage(keyed, new Rectangle(0, 0, trimmed.Width, trimmed.Height),
        new Rectangle(minX, minY, trimmed.Width, trimmed.Height), GraphicsUnit.Pixel);
    }
    keyed.Dispose();
    return trimmed;
  }

  private static Bitmap Extract(Bitmap source, int index, bool green) {
    return ExtractRange(source, index * source.Width / 4, (index + 1) * source.Width / 4, green);
  }

  private static Bitmap ExtractSingle(Bitmap source, bool green) {
    return ExtractRange(source, 0, source.Width, green);
  }

  public static void Build(string input, string contactBInput, string output, bool green, int targetHeight) {
    using (Bitmap source = new Bitmap(input))
    using (Bitmap contactBSource = new Bitmap(contactBInput)) {
      Bitmap[] raw = new Bitmap[4];
      for (int i = 0; i < 4; i++) raw[i] = Extract(source, i, green);
      // Generate the anatomically opposite planted contact separately. A
      // four-character request repeatedly collapsed both contacts onto the
      // same leading leg even when supplied with a skeleton guide.
      raw[2].Dispose();
      raw[2] = ExtractSingle(contactBSource, green);
      Bitmap[] frames = new Bitmap[4];
      for (int i = 0; i < 4; i++) {
        frames[i] = new Bitmap(256, 192, PixelFormat.Format32bppArgb);
        // ImageGen may return a single-pose reference at a different canvas
        // zoom than a four-cel strip. Normalize every authored pose to the
        // same on-screen body height and baseline; never scale the whole
        // actor procedurally at runtime.
        double scale = Math.Min(226.0 / raw[i].Width, targetHeight / (double)raw[i].Height);
        int width = Math.Max(1, (int)Math.Round(raw[i].Width * scale));
        int height = Math.Max(1, (int)Math.Round(raw[i].Height * scale));
        int x = (256 - width) / 2;
        int y = 188 - height;
        using (Graphics g = Graphics.FromImage(frames[i])) {
          g.CompositingMode = CompositingMode.SourceCopy;
          g.InterpolationMode = InterpolationMode.NearestNeighbor;
          g.PixelOffsetMode = PixelOffsetMode.Half;
          g.DrawImage(raw[i], new Rectangle(x, y, width, height), new Rectangle(0, 0, raw[i].Width, raw[i].Height), GraphicsUnit.Pixel);
        }
      }

      using (Bitmap atlas = new Bitmap(1024, 192, PixelFormat.Format32bppArgb))
      using (Graphics g = Graphics.FromImage(atlas)) {
        g.CompositingMode = CompositingMode.SourceCopy;
        for (int i = 0; i < 4; i++) g.DrawImageUnscaled(frames[i], i * 256, 0);
        atlas.Save(output, ImageFormat.Png);
      }
      foreach (Bitmap frame in frames) frame.Dispose();
      foreach (Bitmap frame in raw) frame.Dispose();
    }
  }
}
'@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
[WalkAtlasBuilder]::Build((Resolve-Path "$SourceDir/cassia-green.png"), (Resolve-Path "$SourceDir/cassia-contact-left-green.png"), (Join-Path $OutputDir 'cassia-brawler-walk-v2.png'), $true, 178)
[WalkAtlasBuilder]::Build((Resolve-Path "$SourceDir/bruna-magenta.png"), (Resolve-Path "$SourceDir/bruna-contact-left-magenta.png"), (Join-Path $OutputDir 'bruna-brawler-walk-v2.png'), $false, 180)
[WalkAtlasBuilder]::Build((Resolve-Path "$SourceDir/nova-green.png"), (Resolve-Path "$SourceDir/nova-contact-left-green.png"), (Join-Path $OutputDir 'nova-brawler-walk-v2.png'), $true, 174)

Get-ChildItem -LiteralPath $OutputDir -Filter '*-brawler-walk-v2.png' |
  Select-Object Name, Length
