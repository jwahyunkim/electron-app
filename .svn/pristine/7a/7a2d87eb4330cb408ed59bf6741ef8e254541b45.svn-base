# scripts\fix-install.ps1
# 사용법: PowerShell을 관리자 권한(또는 일반 권한)으로 열고 이 파일 위치에서:
#   ./scripts/fix-install.ps1
# 또는 전체 경로로 실행

Write-Host "=== 안전 확인: 프로젝트 루트에서 실행 중인지 확인하세요 ==="
Write-Host "Working dir: $(Get-Location)"
Write-Host "계속하려면 Enter, 취소하려면 Ctrl+C"
Read-Host

# 1) node_modules 제거
if (Test-Path -Path ".\node_modules") {
  Write-Host "Removing node_modules..."
  rd /s /q .\node_modules
} else {
  Write-Host "node_modules 없음"
}

# 2) package-lock.json 제거
if (Test-Path -Path ".\package-lock.json") {
  Write-Host "Removing package-lock.json..."
  del /f /q .\package-lock.json
} else {
  Write-Host "package-lock.json 없음"
}

# 3) npm cache 제거 (사용자 AppData)
Write-Host "Clearing npm cache in %APPDATA%..."
try {
  rd /s /q "$env:APPDATA\npm-cache"
} catch {
  Write-Host "npm-cache 삭제 실패 또는 없음 (무시)"
}

# 4) electron-builder cache 제거
Write-Host "Clearing electron-builder cache in %LOCALAPPDATA%..."
try {
  rd /s /q "$env:LOCALAPPDATA\electron-builder\cache"
} catch {
  Write-Host "electron-builder cache 삭제 실패 또는 없음 (무시)"
}

# 5) npm ci
Write-Host "Running npm ci..."
npm ci

# 6) postinstall (선택) - electron-builder install-app-deps 등
Write-Host "Running npm run postinstall (if present)..."
npm run postinstall --if-present

# 7) 강제 네이티브 재빌드
Write-Host "Running electron native rebuild (serialport, usb)..."
npx @electron/rebuild -f -w serialport -w usb

Write-Host "=== 완료 ==="
