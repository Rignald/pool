# PowerShell Multi-Device HTTP Web Server for Pool & Biljart Scoreboard
$Port = 8080
$Root = $PSScriptRoot
if (-not $Root) { $Root = (Get-Location).Path }

# If run as Administrator, automatically ensure Windows Firewall allows port 8080
try {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        $existing = Get-NetFirewallRule -DisplayName "Pool Scoreboard (Poort $Port)" -ErrorAction SilentlyContinue
        if (-not $existing) {
            New-NetFirewallRule -DisplayName "Pool Scoreboard (Poort $Port)" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null
        }
    }
} catch {}

# Automatically detect local Wi-Fi / LAN IP address
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -match 'Wi-Fi|Ethernet' -and 
    $_.IPAddress -match '^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.' 
} | Select-Object -ExpandProperty IPAddress -First 1)

if (-not $localIP) { $localIP = "192.168.68.53" }

$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, $Port)
$listener = New-Object System.Net.Sockets.TcpListener($endpoint)
$listener.Server.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::ReuseAddress, $true)

try {
    $listener.Start()
} catch {
    Write-Host "Kan poort $Port niet openen. Mogelijk is de server al actief in een ander venster: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " [POOL & BILJART SCOREBOARD] Server is gestart en actief!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Op je laptop (deze pc):" -ForegroundColor White
Write-Host "    --> http://localhost:$Port/" -ForegroundColor Cyan
Write-Host ""
Write-Host " Op je mobiele telefoon (Android):" -ForegroundColor White
Write-Host "    --> http://$($localIP):$Port/" -ForegroundColor Yellow
Write-Host ""
Write-Host " [Verbindingstips voor mobiel]:" -ForegroundColor Gray
Write-Host "    1. Zorg dat je mobiel op hetzelfde Wi-Fi netwerk zit als deze pc." -ForegroundColor Gray
Write-Host "    2. Typ exact http://$($localIP):$Port/ in Chrome op je telefoon." -ForegroundColor Gray
Write-Host ""
Write-Host " Druk op Ctrl + C om de server af te sluiten." -ForegroundColor DarkGray
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""

# Open local browser once
try {
    Start-Process "http://localhost:$Port/"
} catch {}

# Crash-proof server loop
while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
    } catch {
        break
    }

    try {
        $stream = $client.GetStream()
        $stream.ReadTimeout = 10000
        $stream.WriteTimeout = 10000

        $buffer = New-Object byte[] 4096
        $bytesRead = $stream.Read($buffer, 0, $buffer.Length)
        if ($bytesRead -gt 0) {
            $requestText = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $bytesRead)
            $lines = $requestText.Split("`n")
            if ($lines.Length -gt 0) {
                $firstLine = $lines[0].Trim()
                $parts = $firstLine.Split(" ")
                if ($parts.Length -ge 2 -and ($parts[0] -eq "GET" -or $parts[0] -eq "HEAD")) {
                    $rawPath = $parts[1].Split("?")[0].TrimStart("/")
                    $decodedPath = [System.Uri]::UnescapeDataString($rawPath)
                    if ([string]::IsNullOrWhiteSpace($decodedPath)) {
                        $decodedPath = "index.html"
                    }

                    # Prevent directory traversal
                    $safeRelPath = $decodedPath.Replace("/", "\").TrimStart("\")
                    if ($safeRelPath.Contains("..")) {
                        $safeRelPath = "index.html"
                    }

                    $fullPath = Join-Path $Root $safeRelPath

                    if (Test-Path $fullPath -PathType Leaf) {
                        $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
                        $mime = "application/octet-stream"
                        if ($ext -eq ".html") { $mime = "text/html; charset=utf-8" }
                        elseif ($ext -eq ".css") { $mime = "text/css; charset=utf-8" }
                        elseif ($ext -eq ".js") { $mime = "application/javascript; charset=utf-8" }
                        elseif ($ext -eq ".json") { $mime = "application/json; charset=utf-8" }
                        elseif ($ext -eq ".png") { $mime = "image/png" }
                        elseif ($ext -eq ".svg") { $mime = "image/svg+xml" }
                        elseif ($ext -eq ".ico") { $mime = "image/x-icon" }

                        if ($fullPath.EndsWith("manifest.json")) {
                            $mime = "application/manifest+json; charset=utf-8"
                        }

                        $fileBytes = [System.IO.File]::ReadAllBytes($fullPath)
                        $headerStr = "HTTP/1.1 200 OK`r`n" +
                                     "Content-Type: $mime`r`n" +
                                     "Content-Length: $($fileBytes.Length)`r`n" +
                                     "Connection: close`r`n" +
                                     "Access-Control-Allow-Origin: *`r`n`r`n"
                        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerStr)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        if ($parts[0] -eq "GET") {
                            $stream.Write($fileBytes, 0, $fileBytes.Length)
                        }
                        $stream.Flush()
                        Write-Host " [200 OK] $decodedPath" -ForegroundColor DarkGray
                    } else {
                        $notFoundStr = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: 9`r`nConnection: close`r`n`r`nNot Found"
                        $notFoundBytes = [System.Text.Encoding]::ASCII.GetBytes($notFoundStr)
                        $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
                        $stream.Flush()
                        Write-Host " [404] $decodedPath" -ForegroundColor DarkYellow
                    }
                }
            }
        }
    } catch {
        # Client disconnect or timeout occurred - continue serving!
    } finally {
        try { $client.Close() } catch {}
    }
}
