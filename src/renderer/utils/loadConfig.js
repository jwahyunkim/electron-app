import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { parseStringPromise } from "xml2js";
import { app } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getConfigPath() {
  const isDev = !app.isPackaged;

  const configPath = isDev
    ? path.resolve(__dirname, "../../public/Config.xml")
    : path.join(process.resourcesPath, 'public', 'Config.xml');

  console.log("📂 읽는 Config 경로:", configPath);
  return configPath;
}

export const loadXmlConfig = async () => {
  const filePath = getConfigPath();

  if (!fs.existsSync(filePath)) {
    console.error("❌ Config.xml 파일이 존재하지 않습니다.");
    return null;
  }

  try {
    const xml = fs.readFileSync(filePath, "utf-8");
    const result = await parseStringPromise(xml, { explicitArray: false });

    if (!result || !result.SETTING || !result.SETTING.DBSQL) {
      console.error("❌ DBSQL 태그 누락됨:", result);
      return null;
    }

    return {
      db: {
        user: result.SETTING.DBSQL.USR,
        password: result.SETTING.DBSQL.PWD,
        host: result.SETTING.DBSQL.DATA_SOURCE,
        database: result.SETTING.DBSQL.DB_NAME,
      },
      plant_cd: result.SETTING.Common?.PLANT_CD || "",
      zone_cd: result.SETTING.Common?.ZONE_CD || "",
    };
  } catch (err) {
    console.error("❌ XML 파싱 중 오류:", err.message || err);
    return null;
  }
};
