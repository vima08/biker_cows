param([string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class GaitV9 {
  static Rectangle Bounds(Bitmap image, Rectangle cell) {
    int l=cell.Right,t=cell.Bottom,r=-1,b=-1;
    for(int y=cell.Top;y<cell.Bottom;y++) for(int x=cell.Left;x<cell.Right;x++) {
      if(image.GetPixel(x,y).A<=20) continue;
      l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);b=Math.Max(b,y);
    }
    if(r<l) throw new Exception("Empty contact sprite");
    return Rectangle.FromLTRB(l,t,r+1,b+1);
  }

  public static void Build(string originalPath,string correctionPath,string outputPath) {
    using(var original=new Bitmap(originalPath))
    using(var correction=new Bitmap(correctionPath))
    using(var output=new Bitmap(1024,384,PixelFormat.Format32bppArgb)) {
      if(original.Width!=1024||original.Height!=192) throw new Exception("Expected unmodified v2 strip");
      // Retain v2's three accepted cels pixel for pixel, including their pivots.
      for(int y=0;y<192;y++) for(int x=0;x<1024;x++) {
        if(x<512||x>=768) output.SetPixel(x,y,original.GetPixel(x,y));
      }
      var target=Bounds(original,new Rectangle(0,0,256,192));
      var source=Bounds(correction,new Rectangle(0,0,correction.Width,correction.Height));
      double scale=target.Height/(double)source.Height;
      int width=(int)Math.Round(source.Width*scale);
      if(width>232) throw new Exception("Corrected pose is too wide for the v2 cell");
      int center=(target.Left+target.Right)/2;
      using(var graphics=Graphics.FromImage(output)) {
        graphics.CompositingMode=CompositingMode.SourceCopy;
        graphics.InterpolationMode=InterpolationMode.NearestNeighbor;
        graphics.PixelOffsetMode=PixelOffsetMode.Half;
        graphics.SmoothingMode=SmoothingMode.None;
        graphics.DrawImage(correction,new Rectangle(512+center-width/2,target.Top,width,target.Height),source,GraphicsUnit.Pixel);
      }
      // Restore the left-facing row with per-cell reflection, preserving phase order.
      for(int frame=0;frame<4;frame++) for(int y=0;y<192;y++) for(int x=0;x<256;x++) {
        output.SetPixel(frame*256+x,192+y,output.GetPixel(frame*256+255-x,y));
      }
      output.Save(outputPath,ImageFormat.Png);
    }
  }
}
'@
foreach($hero in @('cassia','bruna','nova')) {
  [GaitV9]::Build(
    (Join-Path $ProjectRoot "public/assets/brawler/$hero-brawler-walk-v2.png"),
    (Join-Path $ProjectRoot ".gauntlet/gait-v9/raw/$hero-contact.png"),
    (Join-Path $ProjectRoot "public/assets/brawler/$hero-brawler-walk-v9.png")
  )
}
