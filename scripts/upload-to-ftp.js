// scripts/upload-to-ftp.js
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("basic-ftp");
const { XMLParser } = require("fast-xml-parser");
const pkg = require("../package.json");

/* ============================ 상수/경로 ============================ */
const ROOT = path.resolve(__dirname, "..");
const CONFIG_XML = path.resolve(ROOT, "public", "Config.xml");
const DIST = path.join(ROOT, "dist");
const MANIFEST = path.join(DIST, "manifest.json");

/* ============================ ENV 옵션 ============================ */
const TIMEOUT_MS = (() => {
  const v = Number(process.env.FTP_TIMEOUT_MS);
  return Number.isFinite(v) && v >= 0 ? v : 120_000;
})();
const FORCE_PASV = !!process.env.FTP_FORCE_PASV;
const VERBOSE = !!process.env.FTP_VERBOSE;
const SECURE = process.env.FTP_SECURE === "1" || process.env.FTP_SECURE === "true";

/* ============================ 유틸 ============================ */
function normalizeAppDir(raw, fallback) {
  const s = String(raw ?? fallback ?? "").replace(/\\/g, "/").trim();
  const cleaned = s.replace(/^\/+|\/+$/g, "");
  return cleaned || String(fallback || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}
function lastSegmentSafe(nameOrPath) {
  const s = String(nameOrPath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const base = s.split("/").filter(Boolean).pop() || s || "APP";
  return base.replace(/[^\w.-]+/g, "_");
}
function firstExisting(...cands) { for (const p of cands) if (fs.existsSync(p)) return p; return null; }

function getDistRoots() {
  if (!fs.existsSync(DIST)) return [];
  const subs = fs.readdirSync(DIST, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(DIST, d.name));

  // 버전 폴더 우선, 그다음 최근순
  subs.sort((a, b) => {
    const as = path.basename(a), bs = path.basename(b);
    const isVer = (s) => (/\d+\.\d+\.\d+/.test(s) ? 1 : 0);
    if (isVer(as) !== isVer(bs)) return isVer(bs) - isVer(as);
    return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
  });
  return [...subs, DIST];
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir)) {
    const full = path.join(dir, n);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else out.push({ full, base: n, mtime: st.mtimeMs, size: st.size });
  }
  return out;
}

function findInstallerExes() {
  const roots = getDistRoots();
  const all = roots.flatMap((r) => walkFiles(r, []));
  const isX64 = /-x64\.exe$/i;
  const isIa32 = /-(ia32|x86)\.exe$/i;
  const pick = (arr) => arr.sort((a, b) => b.mtime - a.mtime)[0]?.full;
  return {
    x64: pick(all.filter((f) => isX64.test(f.base))) || null,
    ia32: pick(all.filter((f) => isIa32.test(f.base))) || null,
  };
}

function loadFtpConfig() {
  if (!fs.existsSync(CONFIG_XML)) throw new Error(`Config.xml 없음: ${CONFIG_XML}`);
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(fs.readFileSync(CONFIG_XML, "utf-8"));
  const S = parsed?.SETTING || {};

  const ftpNew = S.FTP && {
    host: String(S.FTP.HOST ?? ""),
    port: Number(S.FTP.PORT ?? 21),
    user: String(S.FTP.USER ?? ""),
    password: String(S.FTP.PASSWORD ?? ""),
    appName: String(S.FTP.APPNAME ?? ""),
    appDir: normalizeAppDir(S.FTP.APPDIR, S.FTP.APPNAME),
  };
  const ftpOld = {
    host: String(S.HOST?.HOST ?? ""),
    port: Number(S.HOST?.PORT ?? 21),
    user: String(S.DBSQL?.USR ?? ""),
    password: String(S.DBSQL?.PWD ?? ""),
    appName: String(S.PLANT_CD ?? ""),
    appDir: normalizeAppDir(S.PLANT_CD, S.PLANT_CD),
  };
  const cfg = ftpNew?.host ? ftpNew : ftpOld;

  if (!cfg.host) throw new Error("FTP HOST가 비어있습니다.");
  if (!cfg.user) throw new Error("FTP USER가 비어있습니다.");
  if (cfg.password == null) throw new Error("FTP PASSWORD가 비어있습니다.");
  if (!cfg.appName) throw new Error("APPNAME을 XML에서 읽지 못했습니다.");
  if (!cfg.appDir) cfg.appDir = normalizeAppDir(cfg.appName, cfg.appName);

  return cfg;
}

async function runStep(stepName, p) {
  try { return await p; }
  catch (err) { err.step = stepName; throw err; }
}

async function ensureDirCompat(client, rawBase) {
  const baseClean = String(rawBase || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const variants = Array.from(new Set([`/${baseClean}`, baseClean]));
  let lastErr = null;
  for (const v of variants) {
    try {
      await client.ensureDir(v);
      await client.cd(v);
      return v.startsWith("/") ? v : `/${v}`;
    } catch (e) { lastErr = e; }
  }
  if (lastErr) lastErr.step = "ensureDirCompat";
  throw lastErr || new Error("ensureDirCompat 실패");
}

function trackProgressPretty(client, label) {
  let lastPrint = 0;
  client.trackProgress(info => {
    const now = Date.now();
    if (now - lastPrint < 1000) return;
    lastPrint = now;
    const cur = info.bytes || 0;
    const total = info.size || 0;
    if (total > 0) {
      const pct = Math.floor((cur / total) * 100);
      process.stdout.write(`[FTP] ${label} ${cur}/${total} (${pct}%)\r`);
    } else {
      process.stdout.write(`[FTP] ${label} ${cur} bytes\r`);
    }
  });
}

async function uploadReplace(client, localPath, remotePath) {
  const posix = path.posix;
  const remote = remotePath.replace(/\\/g, "/");
  const dir = posix.dirname(remote);
  const name = posix.basename(remote);
  const tmp  = posix.join(dir, `.uploading.${Date.now()}.${process.pid}.${name}`);

  await client.ensureDir(dir);
  await client.cd(dir);
  try { await client.send("TYPE I"); } catch {}

  try { await client.remove(tmp); } catch {}

  const sizeLocal = fs.statSync(localPath).size;
  console.log(`[FTP] upload ${localPath} -> ${remote} (${sizeLocal} bytes)`);

  trackProgressPretty(client, `uploading ${name}`);
  await client.uploadFrom(localPath, tmp);
  client.trackProgress(); // stop

  const sleeps = [0, 300, 1000, 2000, 4000];
  let renameErr = null;
  for (const ms of sleeps) {
    try {
      if (ms) await new Promise(r => setTimeout(r, ms));
      try { await client.remove(name); } catch {}
      await client.rename(path.posix.basename(tmp), name);
      renameErr = null; break;
    } catch (e) { renameErr = e; }
  }
  if (renameErr) {
    try { await client.remove(tmp); } catch {}
    const err = new Error(`rename 실패 (${tmp} → ${name}): ${renameErr?.message || renameErr}`);
    err.code = renameErr?.code;
    throw err;
  }

  // 사이즈 검증
  const sizeRemote = await client.size(name).catch(() => -1);
  if (typeof sizeRemote === "number" && sizeRemote >= 0 && sizeRemote !== sizeLocal) {
    throw new Error(`size mismatch: local=${sizeLocal}, remote=${sizeRemote}`);
  }
  console.log(`\n[OK] ${name} 업로드/검증 완료`);
}

function sha256Of(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(file);
    s.on("error", reject);
    s.on("data", d => h.update(d));
    s.on("end", () => resolve(h.digest("hex")));
  });
}

/* === ★ manifest와 일치하는 app.asar를 강제 탐색 (size/sha256 매칭) === */
function findAllAsarCandidates() {
  const roots = getDistRoots();
  const cands = [];
  for (const r of roots) {
    const p1 = path.join(r, "win-unpacked", "resources", "app.asar");
    const p2 = path.join(r, "win-ia32-unpacked", "resources", "app.asar");
    const p3 = path.join(r, "win-x64-unpacked", "resources", "app.asar");
    for (const p of [p1, p2, p3]) if (fs.existsSync(p)) cands.push(p);
    // 버전 폴더 우선
    const fixed = path.join(ROOT, "dist", (pkg.version || ""), "win-unpacked", "resources", "app.asar");
    if (fs.existsSync(fixed)) cands.unshift(fixed);
  }
  // dist 직하 리소스
  const flat = path.join(DIST, "win-unpacked", "resources", "app.asar");
  if (fs.existsSync(flat)) cands.push(flat);
  // 중복 제거
  return Array.from(new Set(cands));
}

async function resolveAsarByManifest(mAsar) {
  const wantedSize = Number(mAsar.size);
  const wantedSha  = String(mAsar.sha256 || "").toLowerCase();
  const cands = findAllAsarCandidates();

  // 1차: 사이즈 일치 후보만
  const sizeMatches = cands.filter(p => {
    try { return fs.statSync(p).size === wantedSize; } catch { return false; }
  });

  // 2차: sha256 일치
  for (const p of sizeMatches) {
    const sha = (await sha256Of(p)).toLowerCase();
    if (sha === wantedSha) return p;
  }

  // 못 찾았으면 힌트 제공
  const hint = sizeMatches.length
    ? `사이즈는 같은 후보 ${sizeMatches.length}개를 찾았지만 해시가 달랐습니다.\n${sizeMatches.map(p=>` - ${p}`).join("\n")}`
    : `dist 내부에서 후보 app.asar를 찾지 못했거나 사이즈가 모두 달랐습니다.`;

  const err = new Error(
    `manifest의 app.asar와 일치하는 파일을 dist에서 찾지 못했습니다.\n${hint}`
  );
  err.code = "ASAR_NOT_FOUND_BY_MANIFEST";
  throw err;
}

/* ============================ 메인 ============================ */
(async () => {
  try {
    if (!fs.existsSync(MANIFEST)) {
      throw new Error(`manifest.json 없음: ${MANIFEST} (먼저 gen-manifest 실행 필요)`);
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    const mAsar = manifest.files.find(f => f.path.replace(/\\/g, "/") === "app.asar");
    if (!mAsar) throw new Error("manifest.json에 app.asar 항목이 없습니다.");

    const cfg = loadFtpConfig();
    console.log(`[CFG] host=${cfg.host} port=${cfg.port} secure=${SECURE} appDir=${cfg.appDir} appName=${cfg.appName}`);
    console.log(`[OPT] timeoutMs=${TIMEOUT_MS} useEPSV=${!FORCE_PASV} verbose=${VERBOSE}`);

    // ✅ manifest와 동일한 app.asar 강제 선택
    const asar = await resolveAsarByManifest(mAsar);
    const st = fs.statSync(asar);
    const sha = (await sha256Of(asar)).toLowerCase();

    // 마지막 방어 — 혹시라도 불일치면 중단
    if (Number(mAsar.size) !== st.size || String(mAsar.sha256).toLowerCase() !== sha) {
      throw new Error(
        `로컬 asar ↔ manifest 불일치\n` +
        ` - local:     size=${st.size}, sha256=${sha}\n` +
        ` - manifest:  size=${mAsar.size}, sha256=${mAsar.sha256}\n` +
        `※ 빌드 산출물과 manifest가 다른 폴더를 가리키는지 확인하고 'npm run gen:manifest' 후 다시 시도하세요.`
      );
    }

    const { x64, ia32 } = findInstallerExes();
    if (!x64 && !ia32) console.warn("⚠ 설치 exe(x64/ia32)를 dist에서 찾지 못했습니다. (asar/manifest만 업로드)");

    const ftp = new Client();
    ftp.ftp.verbose = VERBOSE;
    ftp.ftp.useEPSV = !FORCE_PASV;
    ftp.ftp.socketTimeout = TIMEOUT_MS;
    ftp.ftp.timeout = TIMEOUT_MS;

    console.log("[FTP] connect...");
    await runStep("connect", Promise.race([
      ftp.access({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        secure: SECURE ? "explicit" : false,
      }),
      (async () => {
        if (TIMEOUT_MS > 0) {
          await new Promise((r) => setTimeout(r, TIMEOUT_MS));
          const e = new Error(`connect timeout after ${TIMEOUT_MS}ms`);
          e.code = "ETIMEDOUT";
          throw e;
        }
      })(),
    ]));
    await runStep("binary", ftp.send("TYPE I"));
    const remoteBase = await runStep("ensureDir", ensureDirCompat(ftp, cfg.appDir));
    console.log(`[FTP] remoteBase=${remoteBase}`);

    // 1) app.asar
    await runStep("upload-asar", uploadReplace(ftp, asar, `${remoteBase}/app.asar`));

    // 2) 설치 exe (있을 때만)
    const baseName = lastSegmentSafe(cfg.appName);
    if (x64) await runStep("upload-x64", uploadReplace(ftp, x64, `${remoteBase}/Setup_${baseName}_x64.exe`));
    else console.warn("⚠ x64 설치 exe 없음");
    if (ia32) await runStep("upload-ia32", uploadReplace(ftp, ia32, `${remoteBase}/Setup_${baseName}_ia32.exe`));
    else console.warn("⚠ ia32 설치 exe 없음");

    // 3) manifest.json (항상 마지막)
    await runStep("upload-manifest", uploadReplace(ftp, MANIFEST, `${remoteBase}/manifest.json`));
    console.log(`🚀 manifest.json 업로드 완료 → ${remoteBase}/manifest.json`);

    ftp.close();
  } catch (e) {
    const step = e?.step || "(unknown-step)";
    const code = e?.code || "";
    const msg  = e?.message || String(e);

    const hints = [];
    if (code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
      hints.push("서버/포트 접근 불가 (방화벽/포트/주소 확인)");
    }
    if (code === "ETIMEDOUT") {
      hints.push("타임아웃 (해외망·방화벽이 PASV 데이터 포트 차단했을 가능성)");
    }
    if (/^530\b/.test(msg)) hints.push("로그인 실패 (USER/PASSWORD 확인)");
    if (/^550\b/.test(msg)) hints.push("경로/권한 문제 (APPDIR, 쓰기 권한, 디렉터리 존재 여부)");
    if (/^425\b/.test(msg)) hints.push("데이터 채널 문제 (서버 PASV 포트 범위 방화벽 개방 필요)");

    console.error(`\n❌ FTP 업로드 실패 @${step} [${code}] ${msg}`);
    if (hints.length) console.error("↳ HINT:", hints.join(" | "));
    console.error(" - FTP_VERBOSE=1 환경변수로 상세 프로토콜 로그를 볼 수 있습니다.");
    console.error(" - FTP_FORCE_PASV=1 로 EPSV 대신 PASV(IPv4) 강제 가능합니다.");
    console.error(" - FTP_TIMEOUT_MS=<ms> 로 접속/전송 타임아웃을 조정하세요 (0=무한대).");
    process.exit(1);
  }
})();
