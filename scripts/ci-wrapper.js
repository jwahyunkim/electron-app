// C:\Changshin\test\electron-app_final\scripts\ci-wrapper.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(cmd) {
  console.log("> " + cmd);
  execSync(cmd, { stdio: "inherit", shell: true });
}
function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); console.log(`removed: ${p}`); }
  catch (_) {}
}
function exists(p) { try { return fs.existsSync(p); } catch { return false; } }

try {
  console.log("Working dir:", process.cwd());

  // 1) 깨끗이 비우기
  if (exists("node_modules")) { console.log("Removing node_modules..."); rmrf("node_modules"); }
  else { console.log("node_modules 없음"); }

  const hasLock = exists("package-lock.json");
  if (!hasLock) console.log("package-lock.json 없음");

  // 2) 캐시 정리
  const npmCache = path.join(process.env.APPDATA || "", "npm-cache");
  if (npmCache && exists(npmCache)) { console.log("Clearing npm cache..."); rmrf(npmCache); }
  else { console.log("npm-cache 없음 (건너뜀)"); }

  const ebCache = path.join(process.env.LOCALAPPDATA || "", "electron-builder", "cache");
  if (ebCache && exists(ebCache)) { console.log("Clearing electron-builder cache..."); rmrf(ebCache); }
  else { console.log("electron-builder cache 없음 (건너뜀)"); }

  // 3) lock이 없으면, 스크립트 무시하고 lock만 생성
  if (!hasLock) {
    console.log("Generating package-lock.json with --ignore-scripts...");
    run("npm install --package-lock-only --ignore-scripts --no-audit --no-fund");
  }

  // 4) 깨끗한 설치
  run("npm ci --no-audit --no-fund");

  // 5) postinstall 단계: 패키지 설치 후에 npx로 안전 실행
  const pkgJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  const hasPostinstall = pkgJson.scripts && pkgJson.scripts.postinstall;
  if (hasPostinstall) {
    // postinstall에 electron-builder가 있더라도 npx 경로 보장
    try { run("npm run postinstall"); }
    catch {
      console.log("npm run postinstall 실패 → npx electron-builder install-app-deps 시도");
      run("npx electron-builder install-app-deps");
    }
  } else {
    console.log("postinstall 스크립트 없음 → npx electron-builder install-app-deps 실행");
    run("npx electron-builder install-app-deps");
  }

  // 6) 네이티브 모듈 강제 재빌드
  run("npx electron-rebuild -f -w serialport,usb");

  console.log("=== 완료 ===");
  process.exit(0);
} catch (e) {
  console.error("오류 발생:", e);
  process.exit(1);
}
