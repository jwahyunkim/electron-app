// src/shared/mssql2.js
import sql from "mssql";
import path from "path";
import fs from "fs";
import { parseStringPromise } from "xml2js";

/** 파일 존재 체크 */
function fileExists(p) {
  if (!p) return false;
  try { return fs.existsSync(p); } catch { return false; }
}

/** Config.xml 경로 탐색 (ENV > cwd/public > resources/public > src/public > cwd) */
function getConfigPath() {
  const candidates = [
    process.env.CONFIG_XML_PATH,
    path.resolve(process.cwd(), "public/Config.xml"),
    process.resourcesPath ? path.join(process.resourcesPath, "public", "Config.xml") : null,
    path.resolve(__dirname, "../../public/Config.xml"),
    path.resolve(process.cwd(), "Config.xml"),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fileExists(p)) return p;
  }
  return null;
}

/** XML 로드 → { db:{user,password,host,database}, plant_cd, zone_cd } */
async function loadXmlConfig() {
  const filePath = getConfigPath();
  if (!filePath) return null;

  try {
    const xml = fs.readFileSync(filePath, "utf-8");
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const SETTING = parsed && parsed.SETTING;
    const DBSQL = SETTING && SETTING.DBSQL ? SETTING.DBSQL : {};

    return {
      db: {
        user: DBSQL.USR,
        password: DBSQL.PWD,
        host: DBSQL.DATA_SOURCE,
        database: DBSQL.DB_NAME,
      },
      plant_cd: SETTING && SETTING.Common ? SETTING.Common.PLANT_CD : undefined,
      zone_cd: SETTING && SETTING.Common ? SETTING.Common.ZONE_CD : undefined,
    };
  } catch (e) {
    console.error("❌ Config.xml 파싱 실패:", e);
    return null;
  }
}

/** ENV 우선 → XML → 실패 시 예외 */
async function resolveDbConfig() {
  const envUser = process.env.DB_USER;
  const envPass = process.env.DB_PASS;
  const envHost = process.env.DB_HOST;
  const envName = process.env.DB_NAME;

  if (envUser && envPass && envHost && envName) {
    return { user: envUser, password: envPass, server: envHost, database: envName };
  }

  const xml = await loadXmlConfig();
  if (xml && xml.db && xml.db.user && xml.db.password && xml.db.host && xml.db.database) {
    return {
      user: xml.db.user,
      password: xml.db.password,
      server: xml.db.host,
      database: xml.db.database,
    };
  }

  throw new Error("DB 설정을 찾을 수 없습니다. (ENV 또는 Config.xml 확인)");
}

/** mssql 접속 설정 공통 */
function makeSqlConfig(base) {
  return {
    user: base.user,
    password: base.password,
    server: base.server,
    database: base.database,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      requestTimeout: 300000, // 5분
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

/** 단발 연결(필요 시) */
export const connectDb = async () => {
  const base = await resolveDbConfig();
  const cfg = makeSqlConfig(base);
  return sql.connect(cfg);
};

/** 싱글턴 풀 + 자동 재생성 */
let _poolPromise = null;

function createPool() {
  return (async () => {
    const base = await resolveDbConfig();
    const cfg = makeSqlConfig(base);
    const pool = await new sql.ConnectionPool(cfg).connect();
    console.log("✅ MSSQL 연결 성공 (poolPromise)");

    pool.on("error", (err) => {
      console.error("⚠️ MSSQL 풀 에러:", err);
      _poolPromise = null; // 다음 호출 시 재생성
    });

    return pool;
  })();
}

/** 최초 생성된 풀 약속(공용) */
export const poolPromise = (() => {
  _poolPromise = createPool();
  return _poolPromise;
})();

/** 안전하게 풀 획득(끊겼으면 재연결/재생성) */
export async function getPool() {
  if (!_poolPromise) _poolPromise = createPool();
  let pool = await _poolPromise;
  if (!pool.connected) {
    try {
      pool = await pool.connect();
    } catch {
      _poolPromise = createPool();
      pool = await _poolPromise;
    }
  }
  return pool;
}

export { sql };
export default { sql, poolPromise, getPool, connectDb };
