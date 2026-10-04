param([string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$out = Join-Path $ProjectRoot '.gauntlet\iteration-31\guides'
New-Item -ItemType Directory -Path $out -Force | Out-Null
function Draw-Guide([string]$direction) {
  $b=[Drawing.Bitmap]::new(256,192,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[Drawing.Graphics]::FromImage($b)
  try {
    $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $body=[Drawing.Pen]::new([Drawing.Color]::FromArgb(255,235,235,235),12)
    $leftNear=[Drawing.Pen]::new([Drawing.Color]::Cyan,18)
    $leftFar=[Drawing.Pen]::new([Drawing.Color]::Cyan,14)
    $rightNear=[Drawing.Pen]::new([Drawing.Color]::FromArgb(255,176,72,255),18)
    $rightFar=[Drawing.Pen]::new([Drawing.Color]::FromArgb(255,176,72,255),14)
    $joint=[Drawing.SolidBrush]::new([Drawing.Color]::White)
    try {
      $g.DrawLine($body,128,42,128,104); $g.FillEllipse($joint,116,24,24,24); $g.FillEllipse($joint,119,95,18,18)
      if($direction -eq 'right') {
        # Facing right exposes the anatomical RIGHT side to camera. LEFT is
        # far but leads: draw cyan first so the near purple thigh overlaps it.
        $g.DrawLine($leftFar,124,103,159,139); $g.DrawLine($leftFar,159,139,202,177)
        $g.DrawLine($rightNear,130,103,102,139); $g.DrawLine($rightNear,102,139,67,177)
        $g.DrawLine($body,126,56,99,91); $g.DrawLine($body,130,56,153,89)
      } else {
        # Facing left exposes anatomical LEFT. RIGHT is far/rear; draw it
        # first, then let the near cyan left thigh overlap and lead.
        $g.DrawLine($rightFar,130,103,155,139); $g.DrawLine($rightFar,155,139,191,177)
        $g.DrawLine($leftNear,124,103,96,139); $g.DrawLine($leftNear,96,139,53,177)
        $g.DrawLine($body,130,56,157,91); $g.DrawLine($body,126,56,103,89)
      }
    } finally {$body.Dispose();$leftNear.Dispose();$leftFar.Dispose();$rightNear.Dispose();$rightFar.Dispose();$joint.Dispose()}
  } finally {$g.Dispose()}
  $b.Save((Join-Path $out ('left-contact-skeleton-'+$direction+'.png')),[Drawing.Imaging.ImageFormat]::Png);$b.Dispose()
}
Draw-Guide 'right'; Draw-Guide 'left'
