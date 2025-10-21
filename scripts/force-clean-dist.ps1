Param(
  [string]$DistPath = "$(Resolve-Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'))"
)

$ErrorActionPreference = 'SilentlyContinue'
Write-Host "🔧 Force clean target: $DistPath"

function Ensure-Handle {
  $toolDir = Join-Path $env:TEMP "sysinternals_tools"
  $exe = Join-Path $toolDir "handle64.exe"
  if (Test-Path $exe) { return $exe }
  New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
  $zip = Join-Path $toolDir "handle.zip"
  Write-Host "⬇️  Downloading Sysinternals Handle..."
  Invoke-WebRequest -UseBasicParsing -Uri "https://download.sysinternals.com/files/Handle.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $toolDir -Force
  $exe
}

function Close-Explorer-On($Path) {
  # explorer가 해당 경로를 열고 있으면 잠김 → 잠시 내렸다가 다시 올림
  $lower = $Path.ToLower()
  $procs = Get-Process explorer -ErrorAction SilentlyContinue
  if (-not $procs) { return }
  # 간단히 내려도 충분 (특정 핸들만 닫는 건 복잡)
  taskkill /f /im explorer.exe | Out-Null
  Start-Sleep -Milliseconds 500
}

function Reopen-Explorer { Start-Process explorer.exe | Out-Null }

function Clear-Attrs($Path) {
  cmd /c "attrib -R -S -H `"$Path\*`" /S /D" | Out-Null
}

function Take-Ownership($Path) {
  cmd /c "takeown /F `"$Path`" /R /D Y" | Out-Null
  cmd /c "icacls `"$Path`" /grant *S-1-5-32-544:F /T /C /Q" | Out-Null
}

function Mirror-Empty($Path) {
  $empty = Join-Path $env:TEMP ("empty_" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $empty | Out-Null
  robocopy "$empty" "$Path" /MIR /NFL /NDL /NJH /NJS /NC /NS | Out-Null
  Remove-Item $empty -Recurse -Force -ErrorAction SilentlyContinue
}

function Remove-PS($Path) {
  Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
  return -not (Test-Path $Path)
}

function Rename-Then-Delete($Path) {
  if (-not (Test-Path $Path)) { return $true }
  $tmp = "$Path.__to_delete__$(Get-Date -Format yyyyMMddHHmmss)"
  try {
    Rename-Item -LiteralPath $Path -NewName (Split-Path $tmp -Leaf) -ErrorAction Stop
    Mirror-Empty $tmp
    Remove-PS $tmp | Out-Null
    if (Test-Path $tmp) {
      # 마지막 폴백
      $e = $tmp.Replace("'", "''")
      powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath '$e' -Recurse -Force -ErrorAction SilentlyContinue" | Out-Null
    }
    return -not (Test-Path $tmp)
  } catch { return $false }
}

function Schedule-Delete-OnReboot($Path) {
@"
Add-Type -Namespace Win32 -Name Native -MemberDefinition @"
  [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError=true, CharSet=System.Runtime.InteropServices.CharSet.Unicode)]
  public static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, int dwFlags);
"@
[Win32.Native]::MoveFileEx("$($Path.Replace('"','""'))", $null, 4) | Out-Null
"@ | powershell -NoProfile -ExecutionPolicy Bypass -Command -  | Out-Null
  Write-Warning "🕓 재부팅 시 삭제 예약: $Path"
}

if (-not (Test-Path $DistPath)) {
  Write-Host "ℹ️ 대상 폴더 없음: $DistPath"
  exit 0
}

Close-Explorer-On $DistPath

# 1) 열린 파일 핸들 강제 닫기
$handle = Ensure-Handle
Write-Host "🔍 Finding handles under: $DistPath"
$raw = & $handle -nobanner -accepteula $DistPath 2>$null
if ($raw) {
  $lines = $raw | Select-String -Pattern 'pid:\s*(\d+).*type:\s*File.*' -AllMatches
  foreach ($l in $lines) {
    $t = $l.ToString()
    if ($t -match 'pid:\s*(\d+).*?\s([0-9A-F]+):\s') {
      $pid = $Matches[1]; $h = $Matches[2]
      & $handle -nobanner -accepteula -c $h -p $pid -y 2>$null
    }
  }
  Start-Sleep -Milliseconds 300
}

# 2) 속성/권한 정리 → 내용 비우기 → 삭제
Clear-Attrs $DistPath
Take-Ownership $DistPath
Mirror-Empty $DistPath

cmd /c "rmdir /s /q `"$DistPath`"" | Out-Null
if (Test-Path $DistPath) {
  # 3) 그래도 남으면 리네임 후 삭제 재시도
  if (-not (Rename-Then-Delete $DistPath)) {
    Schedule-Delete-OnReboot $DistPath
  }
}

Reopen-Explorer

if (-not (Test-Path $DistPath)) {
  Write-Host "✅ dist deleted."
  exit 0
} else {
  Write-Warning "⚠️ dist still exists (locked deeply). Reboot will finish deletion if scheduled."
  exit 0
}
