$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$imagesPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'plugin\images'
New-Item -ItemType Directory -Force -Path $imagesPath | Out-Null
$states = @{
    connected = '#35D69A'; disconnected = '#8C98A8'; busy = '#F2BB54';
    error = '#F36D76'; unknown = '#91A5C9'; unavailable = '#68778D'; category = '#35D69A'
}
foreach ($state in $states.Keys) {
    $bitmap = New-Object System.Drawing.Bitmap 144,144
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#101821'))
    $color = [System.Drawing.ColorTranslator]::FromHtml($states[$state])
    $pen = New-Object System.Drawing.Pen $color,5
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(25,$color))
    $shield = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shield.AddLines([System.Drawing.PointF[]]@([System.Drawing.PointF]::new(72,17),[System.Drawing.PointF]::new(107,30),[System.Drawing.PointF]::new(104,66)))
    $shield.AddBezier(104,66,101,85,87,96,72,102)
    $shield.AddBezier(72,102,57,96,43,85,40,66)
    $shield.AddLine(40,66,37,30)
    $shield.CloseFigure()
    $graphics.FillPath($brush,$shield)
    $graphics.DrawPath($pen,$shield)
    switch ($state) {
        { $_ -in 'connected','category' } { $graphics.DrawLines($pen,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(55,57),[System.Drawing.PointF]::new(68,70),[System.Drawing.PointF]::new(90,44))) }
        'disconnected' { $graphics.DrawLine($pen,56,59,88,59) }
        'busy' { $graphics.DrawArc($pen,53,41,38,38,15,270) }
        'error' { $graphics.DrawLine($pen,72,40,72,63); $graphics.FillEllipse((New-Object System.Drawing.SolidBrush $color),69,73,6,6) }
        'unavailable' { $graphics.DrawLine($pen,58,45,86,73); $graphics.DrawLine($pen,86,45,58,73) }
        'unknown' {
            $font = New-Object System.Drawing.Font 'Segoe UI',32,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
            $textBrush = New-Object System.Drawing.SolidBrush $color
            $graphics.DrawString('?', $font, $textBrush, 61, 35)
            $font.Dispose(); $textBrush.Dispose()
        }
    }
    $bitmap.Save((Join-Path $imagesPath "$state.png"),[System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose(); $pen.Dispose(); $brush.Dispose(); $shield.Dispose()
}
