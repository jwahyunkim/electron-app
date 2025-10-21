// scripts/gen-manifest.js  (최종본)
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const { XMLParser } = require("fast-xml-parser");
const pkg = require("../package.json");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const CONFIG_XML = path.join(ROOT, "public", "Config.xml");
const ASSETS_SRC = path.join(ROOT, "deploy", "assets"); // (옵션)
const OUT_PATH = path.join(DIST, "manifest.json");

// ✅ 이번 빌드 버전 폴더를 대표 후보 1순위로 강제
const RES_VER_DIR = path.join(DIST, (pkg.version || ""), "win-unpacked", "resources");

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function sha256Of(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(file);
    s.on("error", reject);
    s.on("data", (d) => h.update(d));
    s.on("end", () => resolve(h.digest("hex")));
  });
}

async function walk(dir) {
  const out = [];
  const ents = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function safeReaddir(dir) { try { return fs.readdirSync(dir); } catch { return []; } }

// dist/**/win-unpacked/resources 후보 탐색 (중복 제거 + 현재버전 우선)
function findResourcesDirs() {
  const out = [];
  const seen = new Set();

  const tryPush = (p) => {
    const key = path.resolve(p);
    if (!seen.has(key) && exists(path.join(p, "app.asar"))) {
      out.push(p);
      seen.add(key);
    }
  };

  if (exists(RES_VER_DIR) && exists(path.join(RES_VER_DIR, "app.asar"))) {
    tryPush(RES_VER_DIR); // ① 현재 버전 최우선
  }

  // ② 그 외 호환 경로들
  tryPush(path.join(DIST, "win-unpacked", "resources"));
  for (const a of safeReaddir(DIST)) {
    tryPush(path.join(DIST, a, "win-unpacked", "resources"));
    const base = path.join(DIST, a);
    for (const b of safeReaddir(base)) {
      tryPush(path.join(DIST, a, b, "win-unpacked", "resources"));
    }
  }
  return out;
}

function getDistRoots() {
  const roots = [];
  if (!exists(DIST)) return roots;
  for (const a of safeReaddir(DIST)) {
    const p = path.join(DIST, a);
    try { if (fs.statSync(p).isDirectory()) roots.push(p); } catch {}
  }
  roots.push(DIST);
  roots.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return roots;
}

function walkFiles(dir, out = []) {
  if (!exists(dir)) return out;
  for (const n of fs.readdirSync(dir)) {
    const full = path.join(dir, n);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else out.push({ full, base: n, mtime: st.mtimeMs });
  }
  return out;
}

// 설치 exe 두 개 찾기 (가장 최근 1개씩)
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

// 파일명용 안전 베이스 (업로드 스크립트와 동일 규칙)
function lastSegmentSafe(nameOrPath) {
  const s = String(nameOrPath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const base = s.split("/").filter(Boolean).pop() || s || "QM_Defect";
  return base.replace(/[^\w.-]+/g, "_");
}

/** 설치파일 prefix는 FTP.APPNAME 우선, 없으면 FTP.APPDIR 마지막 세그먼트 → 기본 QM_Defect */
function readInstallerBaseFromXml() {
  try {
    if (!exists(CONFIG_XML)) return "QM_Defect";
    const xml = fs.readFileSync(CONFIG_XML, "utf-8");
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
    const S = parsed?.SETTING || {};
    const raw = (S?.FTP?.APPNAME ?? S?.FTP?.APPDIR ?? "QM_Defect");
    return lastSegmentSafe(raw);
  } catch {
    return "QM_Defect";
  }
}

async function buildManifest(resourcesDirs) {
  if (resourcesDirs.length === 0) {
    throw new Error(
      "app.asar을 찾지 못했습니다. 확인:\n" +
      " - electron-builder --dir 로 win-unpacked/resources 생성 여부\n" +
      " - dist/<버전>/win-unpacked/resources 경로 존재 여부\n" +
      " - electron-builder.yml 의 win.target 에 'dir' 포함 여부"
    );
  }

  // 대표 app.asar: RES_VER_DIR가 있으면 그걸, 없으면 mtime 최신
  const scored = await Promise.all(resourcesDirs.map(async (d) => {
    const asar = path.join(d, "app.asar");
    const st = await fsp.stat(asar);
    return { dir: d, asar, mtimeMs: st.mtimeMs, size: st.size };
  }));
  const preferred = scored.find(x => path.resolve(x.dir) === path.resolve(RES_VER_DIR));
  const rep = preferred || scored.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

  const files = [
    { path: "app.asar", size: rep.size, sha256: await sha256Of(rep.asar) }
  ];

  // 설치 exe들 (있을 때만)
  const APPBASE = readInstallerBaseFromXml();
  const { x64, ia32 } = findInstallerExes();

  if (x64 && exists(x64)) {
    const st = await fsp.stat(x64);
    files.push({ path: `Setup_${APPBASE}_x64.exe`, size: st.size, sha256: await sha256Of(x64) });
  } else {
    console.warn("[gen-manifest] x64 설치 exe를 찾지 못했습니다.");
  }
  if (ia32 && exists(ia32)) {
    const st = await fsp.stat(ia32);
    files.push({ path: `Setup_${APPBASE}_ia32.exe`, size: st.size, sha256: await sha256Of(ia32) });
  } else {
    console.warn("[gen-manifest] ia32 설치 exe를 찾지 못했습니다.");
  }

  // (옵션) deploy/assets/**
  if (exists(ASSETS_SRC)) {
    const list = await walk(ASSETS_SRC);
    for (const full of list) {
      const rel = path.relative(ASSETS_SRC, full).replace(/\\/g, "/");
      const st = await fsp.stat(full);
      files.push({ path: `assets/${rel}`, size: st.size, sha256: await sha256Of(full) });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { version: pkg.version, builtAt: new Date().toISOString(), files };
}

async function main() {
  const resourcesDirs = findResourcesDirs();
  if (resourcesDirs.length === 0) {
    throw new Error("resources 후보를 찾지 못했습니다. (예: dist/<버전>/win-unpacked/resources 또는 호환 경로)");
  }

  const manifest = await buildManifest(resourcesDirs);

  await fsp.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fsp.writeFile(OUT_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`[gen-manifest] wrote ${OUT_PATH} (files=${manifest.files.length})`);

  // 편의: 찾은 모든 resources에 복사
  for (const d of resourcesDirs) {
    const p = path.join(d, "manifest.json");
    await fsp.writeFile(p, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`[gen-manifest] wrote ${p}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
