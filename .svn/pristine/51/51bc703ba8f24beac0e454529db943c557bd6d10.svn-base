// scripts/cleanup-unpacked.js
// 목적:
// - dist/<현재버전>/win-unpacked 폴더만 안전 삭제
// - EBUSY/EPERM/권한 이슈 대비: 속성 해제 + 소유권/ACL 부여 + 재시도 + PowerShell 폴백

const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
const pkg = require("../package.json");

const version = String(pkg.version).trim();
const unpackedDir = path.join(__dirname, "..", "dist", version, "win-unpacked");

/* 유틸 */
function sleepMs(ms){ try{ Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}catch{ const end=Date.now()+ms; while(Date.now()<end){} } }
function exists(p){ try{ fs.accessSync(p); return true; }catch{ return false; } }
function unlockAttrsWin(p){ try{ execFileSync("attrib", ["-R","-S","-H", p,"/S","/D"], { stdio:"ignore" }); }catch{} }
function takeOwnershipWin(p){
  try{ execSync(`takeown /F "${p}" /R /D Y`, { stdio:"ignore" }); }catch{}
  try{ execSync(`icacls "${p}" /grant *S-1-5-32-544:F /T /C /Q`, { stdio:"ignore" }); }catch{}
}
function rmNodeForce(p){ try{ fs.rmSync(p, { recursive:true, force:true, maxRetries:0 }); return true; }catch{ return false; } }
function rmPowerShell(p){ try{ const e=p.replace(/'/g,"''"); execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command Remove-Item -LiteralPath '${e}' -Recurse -Force -ErrorAction SilentlyContinue`, { stdio:"ignore" }); return true; }catch{ return false; } }
function rmManual(p){
  try{
    const st=fs.lstatSync(p);
    if(st.isDirectory()){ for(const f of fs.readdirSync(p)) rmManual(path.join(p,f)); fs.rmdirSync(p); }
    else { try{ fs.chmodSync(p,0o644);}catch{} fs.unlinkSync(p); }
    return true;
  }catch{ return false; }
}

/* 실행 */
if (!exists(unpackedDir)) {
  console.log("ℹ️ No unpacked folder found:", unpackedDir);
  process.exit(0);
}

try {
  unlockAttrsWin(unpackedDir);
  takeOwnershipWin(unpackedDir);

  const RETRIES = 4;
  let ok = false;
  for (let i=0;i<RETRIES;i++){
    if (rmNodeForce(unpackedDir)) { ok = true; break; }
    sleepMs(150*(i+1));
  }
  if (!ok) ok = rmPowerShell(unpackedDir);
  if (!ok) ok = rmManual(unpackedDir);

  if (ok) console.log("🗑️ Deleted old unpacked folder:", unpackedDir);
  else    console.error("❌ Failed to delete:", unpackedDir, "(locked or permission issue)");
} catch (e) {
  console.error("❌ Failed to delete:", unpackedDir, e.message);
}
