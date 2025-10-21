// scripts/upload-latest-json.js
const fs = require("fs");
const path = require("path");
const { Client } = require("basic-ftp");
const { XMLParser } = require("fast-xml-parser");
const pkg = require("../package.json"); // ← scripts/와 package.json 상대경로 확인

const ROOT = path.resolve(__dirname, "..");
const CONFIG_XML = path.join(ROOT, "public", "Config.xml");

function normalizeAppDir(raw, fallback) {
  const s = String(raw ?? fallback ?? "").replace(/\\/g, "/").trim();
  const cleaned = s.replace(/^\/+|\/+$/g, "");
  if (!cleaned) return String(fallback || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return cleaned;
}

function loadFtpConfig() {
  if (!fs.existsSync(CONFIG_XML)) throw new Error(`Config.xml 없음: ${CONFIG_XML}`);
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(
    fs.readFileSync(CONFIG_XML, "utf-8")
  );
  const S = parsed?.SETTING || {};

  // 새 스키마(권장): FTP.APPDIR 우선, 없으면 FTP.APPNAME
  const ftpNew = S.FTP && {
    host: String(S.FTP.HOST ?? ""),
    port: Number(S.FTP.PORT ?? 21),
    user: String(S.FTP.USER ?? ""),
    password: String(S.FTP.PASSWORD ?? ""),
    appName: String(S.FTP.APPNAME ?? ""),
    appDir: normalizeAppDir(S.FTP.APPDIR, S.FTP.APPNAME)
  };

  // 구 스키마(레거시 폴백)
  const ftpOld = {
    host: String(S.HOST?.HOST ?? ""),
    port: Number(S.HOST?.PORT ?? 21),
    user: String(S.DBSQL?.USR ?? ""),
    password: String(S.DBSQL?.PWD ?? ""),
    appName: String(S.PLANT_CD ?? ""),
    appDir: normalizeAppDir(S.PLANT_CD, S.PLANT_CD)
  };

  const cfg = ftpNew?.host ? ftpNew : ftpOld;
  if (!cfg.host || !cfg.appName) throw new Error("FTP 호스트 또는 APPNAME을 XML에서 읽을 수 없음");
  if (!cfg.appDir) cfg.appDir = normalizeAppDir(cfg.appName, cfg.appName);
  return cfg;
}

(async () => {
  try {
    const cfg = loadFtpConfig();
    const latest = { version: pkg.version };

    const out = path.join(ROOT, "dist", "latest.json");
    fs.writeFileSync(out, JSON.stringify(latest, null, 2));
    console.log(`✅ latest.json 생성: ${latest.version}`);

    const ftp = new Client();
    await ftp.access({
      host: cfg.host,
      port: cfg.port || 21,
      user: cfg.user,
      password: cfg.password,
      secure: false,
    });

    const remoteDir = `/${cfg.appDir}`.replace(/\\/g, "/");
    await ftp.ensureDir(remoteDir);
    await ftp.uploadFrom(out, `${remoteDir}/latest.json`);
    console.log(`🚀 FTP 업로드 완료 → ${remoteDir}/latest.json`);

    ftp.close();
  } catch (e) {
    console.error("❌ latest.json 업로드 실패:", e.message || e);
    process.exit(1);
  }
})();
