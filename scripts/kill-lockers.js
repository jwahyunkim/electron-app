// scripts/cleanup-old-dist.js
// 모드:
// - 기본: dist/<현재버전>만 남기고 나머지 삭제
// - CLEAN_ALL=1: dist 내부 전체 비움 (폴더 유지)
// 잠금 대응: attrib → takeown/icacls → rmSync 재시도 → PowerShell → 수동

const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");

const pkg = require("../package.json");
const keepVersion = String(pkg.version).trim();
const distDir = path.join(__dirname, "..", "dist");
const keepDir = path.join(distDir, keepVersion);
const CLEAN_ALL = String(process.env.CLEAN_ALL || "").trim() === "1";

function log(...a){ console.log(...a); }
function warn(...a){ console.warn(...a); }

function sleepMs(ms){ try{ Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms); } catch{ const t=Date.now()+ms; while(Date.now()<t){} } }
function exists(p){ try{ fs.accessSync(p); return true; } catch{ return false; } }
function ensureDir(p){ try{ fs.mkdirSync(p,{recursive:true}); } catch{} }

function unlockAttrsWin(p){ try{ execFileSync("attrib", ["-R","-S","-H", p, "/S", "/D"], { stdio:"ignore" }); } catch{} }
function takeOwnershipWin(p){
  try{ execSync(`takeown /F "${p}" /R /D Y`, { stdio:"ignore" }); } catch{}
  try{ execSync(`icacls "${p}" /grant *S-1-5-32-544:F /T /C /Q`, { stdio:"ignore" }); } catch{}
}

function rmNodeForce(p){
  try{ fs.rmSync(p, { recursive:true, force:true, maxRetries:0 }); } catch{}
  return !exists(p);
}
function rmPowerShell(p){
  try{
    const e = p.replace(/'/g,"''");
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command Remove-Item -LiteralPath '${e}' -Recurse -Force -ErrorAction SilentlyContinue`, { stdio:"ignore" });
  } catch{}
  return !exists(p);
}
function rmManual(p){
  try{
    const st = fs.lstatSync(p);
    if (st.isDirectory()){
      for (const f of fs.readdirSync(p)) rmManual(path.join(p,f));
      fs.rmdirSync(p);
    } else {
      try{ fs.chmodSync(p, 0o644); } catch{}
      fs.unlinkSync(p);
    }
  } catch{}
  return !exists(p);
}

function rmrf(p, label=""){
  if (!exists(p)) return true;
  unlockAttrsWin(p);
  takeOwnershipWin(p);

  for (let i=0;i<4;i++){
    if (rmNodeForce(p)) return true;
    sleepMs(150*(i+1));
  }
  if (rmPowerShell(p)) return true;
  if (rmManual(p)) return true;

  warn(`⚠️ rmrf 실패: ${label || p}`);
  return false;
}

// 0) dist 없으면 종료
if (!exists(distDir)) {
  log("ℹ️ dist 폴더 없음. 건너뜀");
  process.exit(0);
}

// 1) 전체 비움 모드
if (CLEAN_ALL){
  log("🧹 모드: CLEAN_ALL=1 → dist 전체 비움");
  for (const name of fs.readdirSync(distDir)){
    const full = path.join(distDir, name);
    const ok = rmrf(full, `dist item: ${name}`);
    console[ok ? "log" : "warn"](ok ? `🗑️ Deleted: ${name}` : `⚠️ Still exists (locked?): ${name}`);
  }
  ensureDir(distDir);
  log("✅ cleanup done. (full wipe)");
  process.exit(0);
}

// 2) 보존 모드: 현재 버전만 유지
log(`keepVersion = ${keepVersion}`);

// 2-1) 이전 버전 폴더 제거 (manifest 폴더는 보존)
for (const name of fs.readdirSync(distDir)){
  if (name === keepVersion || name.toLowerCase() === "manifest") continue;
  const full = path.join(distDir, name);
  try{
    if (fs.lstatSync(full).isDirectory()){
      const ok = rmrf(full, `old version folder: ${name}`);
      console[ok ? "log" : "warn"](ok ? `🗑️ Deleted old version folder: ${name}` : `⚠️ Still exists (locked?): ${name}`);
    }
  }catch{}
}

// 2-2) dist 루트의 이전 산출물(.exe/.blockmap/.yml) 제거 (manifest.* 보존)
for (const name of fs.readdirSync(distDir)){
  const full = path.join(distDir, name);
  try{
    if (fs.lstatSync(full).isDirectory()) continue;
    if (/^manifest(\.|$)/i.test(name)) continue;
    const isOld = (/\.(exe|blockmap|yml)$/i.test(name)) && !name.includes(keepVersion);
    if (isOld){
      const ok = rmrf(full, `old artifact: ${name}`);
      console[ok ? "log" : "warn"](ok ? `🗑️ Deleted old artifact: ${name}` : `⚠️ Still exists (locked?): ${name}`);
    }
  }catch{}
}

// 2-3) 현재 버전 폴더 내부 초기화
ensureDir(keepDir);
for (const f of fs.readdirSync(keepDir)){
  const p = path.join(keepDir, f);
  const ok = rmrf(p, `keepDir item: ${f}`);
  if (!ok) warn(`⚠️ keepDir item not removed (locked?): ${f}`);
}
log(`♻️ Cleared current version folder: ${keepVersion}`);
log(`✅ cleanup done. keep version = ${keepVersion}`);
