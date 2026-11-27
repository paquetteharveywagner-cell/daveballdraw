param(
  [int]$Port = 4173
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root "data"
$stateFile = Join-Path $dataDir "state.json"

$defaultTheme = @{
  preset        = "emerald"
  backgroundHex = "#0f3b2a"
  surfaceHex    = "#154634"
  accentHex     = "#f4c430"
}

if (-not (Test-Path $dataDir)) {
  New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}
if (-not (Test-Path $stateFile)) {
  @{ entries = @{}; theme = $defaultTheme } | ConvertTo-Json -Depth 5 | Set-Content -Path $stateFile -Encoding UTF8
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Serving '$root' at $prefix"

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".png"  = "image/png"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/jpeg"
  ".json" = "application/json; charset=utf-8"
}

$allowedPresets = @("emerald", "navy", "crimson", "charcoal", "purple", "emerald-silver", "custom")

function ConvertTo-Hashtable($obj) {
  if ($null -eq $obj) { return @{} }
  $ht = @{}
  foreach ($prop in $obj.PSObject.Properties) {
    $ht[$prop.Name] = $prop.Value
  }
  return $ht
}

function Read-DrawState {
  try {
    $raw = Get-Content -Path $stateFile -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return @{ entries = @{}; theme = $defaultTheme.Clone(); refreshVersion = 1; lastRefreshedAt = $null }
    }
    $parsed = $raw | ConvertFrom-Json
    $entries = if ($null -ne $parsed.entries) { ConvertTo-Hashtable $parsed.entries } else { @{} }
    $themeRaw = if ($null -ne $parsed.theme) { ConvertTo-Hashtable $parsed.theme } else { @{} }
    $theme = @{
      preset        = if ($themeRaw.ContainsKey("preset")) { [string]$themeRaw["preset"] } else { $defaultTheme.preset }
      backgroundHex = if ($themeRaw.ContainsKey("backgroundHex")) { [string]$themeRaw["backgroundHex"] } else { $defaultTheme.backgroundHex }
      surfaceHex    = if ($themeRaw.ContainsKey("surfaceHex")) { [string]$themeRaw["surfaceHex"] } else { $defaultTheme.surfaceHex }
      accentHex     = if ($themeRaw.ContainsKey("accentHex")) { [string]$themeRaw["accentHex"] } else { $defaultTheme.accentHex }
    }
    $rv = if ($null -ne $parsed.refreshVersion -and [int]$parsed.refreshVersion -ge 1) { [int]$parsed.refreshVersion } else { 1 }
    $lra = if ($null -ne $parsed.lastRefreshedAt) { [string]$parsed.lastRefreshedAt } else { $null }
    return @{ entries = $entries; theme = $theme; refreshVersion = $rv; lastRefreshedAt = $lra }
  } catch {
    return @{ entries = @{}; theme = $defaultTheme.Clone(); refreshVersion = 1; lastRefreshedAt = $null }
  }
}

function Write-DrawState([hashtable]$state) {
  $payload = @{
    entries         = $state.entries
    theme           = $state.theme
    refreshVersion  = if ($state.refreshVersion) { [int]$state.refreshVersion } else { 1 }
    lastRefreshedAt = $state.lastRefreshedAt
  }
  $json = $payload | ConvertTo-Json -Depth 6
  $json | Set-Content -Path $stateFile -Encoding UTF8
}

function Send-Json($response, [int]$statusCode, $payload) {
  $json = $payload | ConvertTo-Json -Depth 6 -Compress
  if ([string]::IsNullOrWhiteSpace($json)) { $json = "{}" }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $response.StatusCode = $statusCode
  $response.ContentType = "application/json; charset=utf-8"
  $response.Headers["Cache-Control"] = "no-store"
  $response.Headers["Access-Control-Allow-Origin"] = "*"
  $response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
  $response.Headers["Access-Control-Allow-Headers"] = "Content-Type, x-admin-pin"
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.Close()
}

$expectedPin = if ([string]::IsNullOrWhiteSpace($env:ADMIN_PIN)) { "raceys2026" } else { $env:ADMIN_PIN }

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
      $path = $request.Url.AbsolutePath

      if ($request.HttpMethod -eq "OPTIONS") {
        $response.StatusCode = 204
        $response.Headers["Access-Control-Allow-Origin"] = "*"
        $response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        $response.Headers["Access-Control-Allow-Headers"] = "Content-Type, x-admin-pin"
        $response.Close()
        continue
      }

      if ($path -eq "/api/state" -and $request.HttpMethod -eq "GET") {
        $state = Read-DrawState
        $publicEntries = @{}
        foreach ($key in $state.entries.Keys) {
          $item = $state.entries[$key]
          $publicEntries[$key] = @{
            firstName = $item.firstName
            claimedAt = $item.claimedAt
          }
        }
        Send-Json $response 200 @{
          entries         = $publicEntries
          theme           = $state.theme
          refreshVersion  = $state.refreshVersion
          lastRefreshedAt = $state.lastRefreshedAt
        }
        continue
      }

      if ($path -eq "/api/claim" -and $request.HttpMethod -eq "POST") {
        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
        $bodyRaw = $reader.ReadToEnd()
        $reader.Close()

        try {
          $body = $bodyRaw | ConvertFrom-Json
        } catch {
          Send-Json $response 400 @{ error = "Invalid request payload" }
          continue
        }

        $num = 0
        if (-not [int]::TryParse([string]$body.number, [ref]$num) -or $num -lt 1 -or $num -gt 45) {
          Send-Json $response 400 @{ error = "Number must be between 1 and 45" }
          continue
        }

        $name = (([string]$body.name).Trim() -replace '\s+', ' ')
        $mobile = ([string]$body.mobile).Trim()
        $digits = ($mobile -replace '\D', '').Length
        if ($name.Length -lt 2 -or $name.Length -gt 60) {
          Send-Json $response 400 @{ error = "Please enter your name" }
          continue
        }
        if ($mobile -notmatch '^\+?[0-9 \-]{7,20}$' -or $digits -lt 7 -or $digits -gt 15) {
          Send-Json $response 400 @{ error = "Enter a valid mobile number" }
          continue
        }

        $state = Read-DrawState
        $key = [string]$num
        if ($state.entries.ContainsKey($key)) {
          Send-Json $response 409 @{ reason = "taken"; error = "Number already taken" }
          continue
        }

        $firstName = ($name -split '\s+')[0]
        $entry = @{
          name      = $name
          firstName = $firstName
          mobile    = $mobile
          claimedAt = (Get-Date).ToUniversalTime().ToString("o")
        }
        $state.entries[$key] = $entry
        Write-DrawState $state

        Send-Json $response 200 @{
          number    = $num
          firstName = $firstName
          claimedAt = $entry.claimedAt
        }
        continue
      }

      if ($path -eq "/api/admin") {
        $providedPin = [string]$request.Headers["x-admin-pin"]
        if ([string]::IsNullOrEmpty($providedPin) -or $providedPin -ne $expectedPin) {
          Send-Json $response 401 @{ error = "Invalid admin PIN" }
          continue
        }

        $state = Read-DrawState

        if ($request.HttpMethod -eq "GET") {
          Send-Json $response 200 @{
            entries         = $state.entries
            theme           = $state.theme
            refreshVersion  = $state.refreshVersion
            lastRefreshedAt = $state.lastRefreshedAt
            storageMode     = "file"
          }
          continue
        }

        if ($request.HttpMethod -ne "POST") {
          Send-Json $response 405 @{ error = "Method not allowed" }
          continue
        }

        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
        $bodyRaw = $reader.ReadToEnd()
        $reader.Close()
        $body = $bodyRaw | ConvertFrom-Json

        if ($body.action -eq "refresh") {
          $state.entries = @{}
          $state.refreshVersion = ([int]$state.refreshVersion) + 1
          $state.lastRefreshedAt = (Get-Date).ToUniversalTime().ToString("o")
          Write-DrawState $state
          Send-Json $response 200 @{
            ok              = $true
            entries         = $state.entries
            theme           = $state.theme
            refreshVersion  = $state.refreshVersion
            lastRefreshedAt = $state.lastRefreshedAt
          }
          continue
        }

        if ($body.action -eq "release") {
          $num = 0
          if (-not [int]::TryParse([string]$body.number, [ref]$num) -or $num -lt 1 -or $num -gt 45) {
            Send-Json $response 400 @{ error = "Invalid ball number" }
            continue
          }
          $state.entries.Remove([string]$num) | Out-Null
          Write-DrawState $state
          Send-Json $response 200 @{
            ok              = $true
            entries         = $state.entries
            theme           = $state.theme
            refreshVersion  = $state.refreshVersion
            lastRefreshedAt = $state.lastRefreshedAt
          }
          continue
        }

        if ($body.action -eq "theme") {
          $inc = $body.theme
          $preset = if ([string]$inc.preset -match '^[a-z0-9-]{2,40}$') { ([string]$inc.preset).Trim() } else { "emerald" }
          $bg = if ([string]$inc.backgroundHex -match '^#[0-9a-fA-F]{6}$') { ([string]$inc.backgroundHex).Trim().ToLowerInvariant() } else { $defaultTheme.backgroundHex }
          $sf = if ([string]$inc.surfaceHex -match '^#[0-9a-fA-F]{6}$') { ([string]$inc.surfaceHex).Trim().ToLowerInvariant() } else { $defaultTheme.surfaceHex }
          $ac = if ([string]$inc.accentHex -match '^#[0-9a-fA-F]{6}$') { ([string]$inc.accentHex).Trim().ToLowerInvariant() } else { $defaultTheme.accentHex }

          $state.theme = @{
            preset        = $preset
            backgroundHex = $bg
            surfaceHex    = $sf
            accentHex     = $ac
          }
          Write-DrawState $state
          Send-Json $response 200 @{
            ok              = $true
            entries         = $state.entries
            theme           = $state.theme
            refreshVersion  = $state.refreshVersion
            lastRefreshedAt = $state.lastRefreshedAt
          }
          continue
        }

        Send-Json $response 400 @{ error = "Unknown action" }
        continue
      }

      $relPath = $path.TrimStart("/")
      if ([string]::IsNullOrWhiteSpace($relPath)) {
        $relPath = "index.html"
      } elseif ($relPath -eq "admin") {
        $relPath = "admin.html"
      } elseif ($relPath -eq "favicon.ico") {
        $relPath = "assets/logo.jpg"
      }

      $safePath = $relPath -replace "/", "\"
      $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $safePath))

      if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $fullPath -PathType Leaf)) {
        $response.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()
        continue
      }

      $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = $mimeTypes[$ext]
      if (-not $contentType) {
        $contentType = "application/octet-stream"
      }

      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
      $response.ContentType = $contentType
      $response.Headers["Cache-Control"] = "no-cache"
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      $response.Close()
    } catch {
      try { $response.Abort() } catch {}
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
