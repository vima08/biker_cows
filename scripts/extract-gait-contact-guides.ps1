param([string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$output = Join-Path $ProjectRoot '.gauntlet\iteration-31\guides'
New-Item -ItemType Directory -Path $output -Force | Out-Null
foreach($hero in @('cassia','bruna','nova')) {
  foreach($version in @('v3','v4')) {
    $path = Join-Path $ProjectRoot ('public\assets\brawler\'+$hero+'-brawler-walk-'+$version+'.png')
    $source = [Drawing.Bitmap]::FromFile($path)
    try {
      foreach($direction in @(@('right',0),@('left',1))) {
        $name = $direction[0]; $row = [int]$direction[1]
        $frame = [Drawing.Bitmap]::new(256,192,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
          $graphics = [Drawing.Graphics]::FromImage($frame)
          try {$graphics.DrawImage($source,[Drawing.Rectangle]::new(0,0,256,192),[Drawing.Rectangle]::new(512,$row*192,256,192),[Drawing.GraphicsUnit]::Pixel)} finally {$graphics.Dispose()}
          $frame.Save((Join-Path $output ($hero+'-'+$name+'-'+$version+'.png')),[Drawing.Imaging.ImageFormat]::Png)
        } finally {$frame.Dispose()}
      }
    } finally {$source.Dispose()}
  }
}
