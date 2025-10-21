// scripts/cleanup-old-dist.js
// 목적:
// - 기본: dist/<현재버전>만 남기고 나머지 삭제 (보존 모드)
// - CLEAN_ALL=1: dist 안을 **전부** 비움(폴더 자체는 유지)
// - Windows 잠금 대응: 속성 해제 + 소유권/ACL + 재시도 + PowerShell/수동 폴백
// - 최후 폴백: 리네임→빈폴더 미러링(robocopy /MIR)→삭제 + app.asar 선제 제거
// - dist/manifest.* 는 보존 모드에서만 보존, CLEAN_ALL=1 이면 제거
// - ★ 공용화: Config.xml(SETTING/FTP)에서 APPNAME/APPDIR 읽어 프로세스 패턴 동적 구성

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execSync, execFileSync } = require("child_process");
let XMLParser;
try { ({ XMLParser } = require("fast-xml-parser")); } catch {}

const pkg = require("../package.json");
const keepVersion = String(pkg.version).trim();
const distDir = path.join(__dirname, "..", "dist");
const keepDir = path.join(distDir, keepVersion);
const CLEAN_ALL = String(process.env.CLEAN_ALL || "").trim() === "1";

/* ========== 공용: Config.xml에서 앱 베이스명 읽기 ========== */
const CONFIG_XML = path.join(__dirname, "..", "public", "Config.xml");

function lastSegmentSafe(nameOrPath) {
  const s = String(nameOrPath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const base = s.split("/").filter(Boolean).pop() || s || "APP";
  return base.replace(/[^\w.-]+/g, "_");
}

function readAppBaseFromXml() {
  try {
    if (!fs.existsSync(CONFIG_XML)) return "APP";
    const xml = fs.readFileSync(CONFIG_XML, "utf-8");
    if (XMLParser) {
      const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
      const S = parsed?.SETTING || {};
      const raw = (S?.FTP?.APPNAME ?? S?.FTP?.APPDIR ?? "APP");
      return lastSegmentSafe(raw);
    }
    // 파서 미설치 시 매우 단순 폴백(정규식)
    const mName = xml.match(/<APPNAME>\s*([^<]+)\s*<\/APPNAME>/i);
    const mDir  = xml.match(/<APPDIR>\s*([^<]+)\s*<\/APPDIR>/i);
    const raw = (mName?.[1] || mDir?.[1] || "APP");
    return lastSegmentSafe(raw);
  } catch {
    return "APP";
  }
}

const APPBASE_SAFE = readAppBaseFromXml();

/* ========== 유틸 공통 ========== */
function sleepMs(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms); }
  catch { const end=Date.now()+ms; while(Date.now()<end){} }
}
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }

function unlockAttrsWin(p) {
  try { execFileSync("attrib", ["-R","-S","-H", p,"/S","/D"], { stdio: "ignore" }); } catch {}
}
function takeOwnershipWin(p) {
  try { execSync(`takeown /F "${p}" /R /D Y`, { stdio: "ignore" }); } catch {}
  try { execSync(`icacls "${p}" /grant *S-1-5-32-544:F /T /C /Q`, { stdio: "ignore" }); } catch {}
}
function rmNodeForce(p) {
  try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 0 }); } catch {}
  return !exists(p);
}
function rmPowerShell(p) {
  try {
    const e = p.replace(/'/g,"''");
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command Remove-Item -LiteralPath '${e}' -Recurse -Force -ErrorAction SilentlyContinue`, { stdio:"ignore" });
  } catch {}
  return !exists(p);
}
function rmManual(p) {
  try {
    const st = fs.lstatSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) rmManual(path.join(p, f));
      fs.rmdirSync(p);
    } else {
      try { fs.chmodSync(p, 0o644); } catch {}
      fs.unlinkSync(p);
    }
  } catch {}
  return !exists(p);
}

/* ========== app.asar 선제 제거 전용 ========== */
function clearAttrs(p) {
  try { execFileSync("attrib", ["-R","-S","-H", p], { stdio: "ignore" }); } catch {}
}
function takeOwnershipFile(p) {
  try { execSync(`takeown /F "${p}" /A /D Y`, { stdio: "ignore" }); } catch {}
  try { execSync(`icacls "${p}" /grant *S-1-5-32-544:F /C /Q`, { stdio: "ignore" }); } catch {}
}
// 재부팅 시 삭제 예약(MoveFileEx MOVEFILE_DELAY_UNTIL_REBOOT = 4)
function scheduleDeleteOnReboot(p) {
  try {
    const e = p.replace(/"/g, '""');
    const ps = `
Add-Type -Namespace Win32 -Name Native -MemberDefinition @"
  [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError=true, CharSet=System.Runtime.InteropServices.CharSet.Unicode)]
  public static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, int dwFlags);
"@
[Win32.Native]::MoveFileEx("${e}", $null, 4) | Out-Null
`;
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/\n/g,';')}"`, { stdio:"ignore" });
    console.warn(`🕓 삭제 예약(재부팅 후): ${p}`);
    return true;
  } catch { return false; }
}
function smashAsar(file) {
  if (!exists(file)) return true;
  clearAttrs(file);
  takeOwnershipFile(file);

  // 1) 즉시 삭제
  try { fs.rmSync(file, { force:true }); } catch {}
  if (!exists(file)) return true;

  // 2) 리네임→삭제→PS 폴백
  try {
    const tmp = file + ".__asar_del__" + Date.now();
    fs.renameSync(file, tmp);
    try { fs.rmSync(tmp, { force:true }); } catch {}
    if (!exists(tmp)) return true;

    try {
      const e = tmp.replace(/'/g,"''");
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command Remove-Item -LiteralPath '${e}' -Force -ErrorAction SilentlyContinue`, { stdio:"ignore" });
    } catch {}
    if (!exists(tmp)) return true;

    scheduleDeleteOnReboot(tmp);
    return false;
  } catch {
    scheduleDeleteOnReboot(file);
    return false;
  }
}
function nukeAsarsInDir(dir) {
  if (!exists(dir)) return;
  try {
    const candidates = [
      path.join(dir, "win-unpacked", "resources", "app.asar"),
      path.join(dir, "resources", "app.asar")
    ];
    for (const f of candidates) smashAsar(f);

    // 서브폴더 탐색(가벼운 범위)
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      try {
        const st = fs.lstatSync(full);
        if (st.isDirectory()) {
          const asar = path.join(full, "resources", "app.asar");
          if (exists(asar)) smashAsar(asar);
        }
      } catch {}
    }
  } catch {}
}

/* ========== 폴더 최후 폴백 ========== */
// 빈 폴더를 대상에 미러링(robocopy /MIR)하여 내부파일을 비움
function robocopyMirrorEmpty(targetDir) {
  try {
    const empty = path.join(os.tmpdir(), "empty_" + crypto.randomBytes(4).toString("hex"));
    fs.mkdirSync(empty, { recursive: true });
    execSync(`robocopy "${empty}" "${targetDir}" /MIR /NFL /NDL /NJH /NJS /NC /NS`, { stdio: "ignore" });
    try { fs.rmdirSync(empty); } catch {}
    return true;
  } catch { return false; }
}
// 폴더명 변경 → 미러 → 삭제
function renameThenDelete(p) {
  try {
    if (!exists(p)) return true;
    const base = path.dirname(p);
    const tmp  = path.join(base, path.basename(p) + ".__to_delete__" + Date.now());
    fs.renameSync(p, tmp);
    robocopyMirrorEmpty(tmp);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    if (exists(tmp)) {
      const e = tmp.replace(/'/g, "''");
      try {
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command Remove-Item -LiteralPath '${e}' -Recurse -Force -ErrorAction SilentlyContinue`, { stdio: "ignore" });
      } catch {}
    }
    return !exists(tmp);
  } catch {
    return false;
  }
}

/* ========== rmrf 본체 ========== */
function rmrf(p, label = "") {
  if (!exists(p)) return true;
  unlockAttrsWin(p);
  takeOwnershipWin(p);

  for (let i = 0; i < 4; i++) {
    if (rmNodeForce(p)) return true;
    sleepMs(150 * (i + 1));
  }
  if (rmPowerShell(p)) return true;
  if (rmManual(p)) return true;

  // 🔥 최후 폴백: 리네임→미러→삭제
  if (renameThenDelete(p)) return true;

  console.warn(`⚠️ rmrf 실패: ${label || p}`);
  return false;
}

/* ========== 0) dist 없으면 종료 ========== */
if (!exists(distDir)) {
  console.log("ℹ️ dist 폴더 없음. 건너뜀");
  process.exit(0);
}

/* ========== 1) dist에서 기동된 락커만 안전 종료(PS 폴백 포함) ========== */
(function safeKillLockers(){
  try {
    let out = "";
    try {
      out = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command (Get-CimInstance Win32_Process | Select-Object Name,ExecutablePath,CommandLine,ProcessId) | ConvertTo-Json -Depth 3`,
        { stdio:["ignore","pipe","ignore"] }
      ).toString("utf8");
    } catch {
      out = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command (Get-Process | Select-Object Name,Path,CommandLine,Id) | ConvertTo-Json -Depth 3`,
        { stdio:["ignore","pipe","ignore"] }
      ).toString("utf8");
    }

    const list = JSON.parse(out);
    const procs = Array.isArray(list) ? list : [list];
    const lowerDist = distDir.toLowerCase().replace(/\\/g,"/");

    // 동적 이름 패턴 구성 (대소문자 무시)
    const app = String(APPBASE_SAFE || "APP");
    // 예: APP_electron-launcher.exe, APP_Launcher.exe, APP_app.exe, Uninstall_APP_app.exe ...
    const dynNameRegexes = [
      new RegExp(`^${app}.*launcher.*\\.exe$`, "i"),
      new RegExp(`^${app}.*app.*\\.exe$`, "i"),
      new RegExp(`^uninstall[_-]?${app}.*\\.exe$`, "i"),
      new RegExp(`^unins.*\\.exe$`, "i"),           // NSIS 기본 언인스톨러
    ];

    // 범용 빌드/런타임 도구 이름(공용)
    const genericNameRegexes = [
      /^electron.*\.exe$/i,
      /^nsis.*\.exe$/i,
      /^app-builder.*\.exe$/i,
      /^makensis.*\.exe$/i,
    ];

    const targets = procs.filter(p => {
      const name = String(p.Name || "").toLowerCase();
      const exePath = String(p.ExecutablePath || p.Path || "").toLowerCase().replace(/\\/g,"/");
      const cmd = String(p.CommandLine || "").toLowerCase();
      const inDist = exePath.includes(lowerDist) || cmd.includes(lowerDist);

      const nameHit =
        dynNameRegexes.some(re => re.test(name)) ||
        genericNameRegexes.some(re => re.test(name));

      return inDist && nameHit;
    });

    if (targets.length === 0) {
      console.log("✅ 잠금 의심 프로세스 없음(dist 기준)");
      return;
    }

    for (const t of targets) {
      const pid = t.ProcessId || t.Id;
      if (!pid) continue;
      try {
        execSync(`taskkill /F /PID ${pid} /T`, { stdio:"ignore" });
        console.log(`🛑 Killed PID ${pid} (${t.Name || "unknown.exe"})`);
      } catch {
        console.log(`⚠️ Kill 실패: PID ${pid} (${t.Name || "unknown.exe"}) (무시)`);
      }
    }
  } catch (e) {
    console.log("⚠️ 프로세스 스캔 실패(무시):", e.message || e);
  }
})();

/* ========== 2) 삭제 로직 ========== */
if (CLEAN_ALL) {
  console.log("🧹 모드: CLEAN_ALL=1 → dist 전체 비움");
  for (const name of fs.readdirSync(distDir)) {
    const full = path.join(distDir, name);
    // app.asar 선제 제거
    try { if (fs.lstatSync(full).isDirectory()) nukeAsarsInDir(full); } catch {}
    const ok = rmrf(full, `dist item: ${name}`);
    console[ok ? "log" : "warn"](ok ? `🗑️ Deleted: ${name}` : `⚠️ Still exists (locked?): ${name}`);
  }
  ensureDir(distDir);
  console.log("✅ cleanup done. (full wipe)");
  process.exit(0);
}

// --- 보존 모드: 현재 버전만 유지 ---
console.log(`keepVersion = ${keepVersion}`);

// 2-1) 이전 버전 폴더 제거 (manifest 보존) — app.asar 선제 제거
for (const name of fs.readdirSync(distDir)) {
  if (name === keepVersion || name.toLowerCase() === "manifest") continue;
  const full = path.join(distDir, name);
  try {
    if (fs.lstatSync(full).isDirectory()) {
      nukeAsarsInDir(full); // ★ 추가
      const ok = rmrf(full, `old version folder: ${name}`);
      console[ok ? "log" : "warn"](ok ? `🗑️ Deleted old version folder: ${name}` : `⚠️ Still exists (locked?): ${name}`);
    }
  } catch {}
}

// 2-2) dist 루트의 이전 산출물(.exe/.blockmap/.yml) 제거
for (const name of fs.readdirSync(distDir)) {
  const full = path.join(distDir, name);
  try {
    if (fs.lstatSync(full).isDirectory()) continue;
    if (/^manifest(\.|$)/i.test(name)) continue; // 보존
    const isOld = (/\.(exe|blockmap|yml)$/i.test(name)) && !name.includes(keepVersion);
    if (isOld) {
      const ok = rmrf(full, `old artifact: ${name}`);
      console[ok ? "log" : "warn"](ok ? `🗑️ Deleted old artifact: ${name}` : `⚠️ Still exists (locked?): ${name}`);
    }
  } catch {}
}

// 2-3) 현재 버전 폴더 내부 초기화 — app.asar 선제 제거
ensureDir(keepDir);
nukeAsarsInDir(keepDir); // ★ 추가
for (const f of fs.readdirSync(keepDir)) {
  const p = path.join(keepDir, f);
  const ok = rmrf(p, `keepDir item: ${f}`);
  if (!ok) console.warn(`⚠️ keepDir item not removed (locked?): ${f}`);
}
console.log(`♻️ Cleared current version folder: ${keepVersion}`);

console.log(`✅ cleanup done. keep version = ${keepVersion}`);
