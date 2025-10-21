// src/renderer/utils/loadConfigClient.ts
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

/* ===================== 타입 ===================== */
export interface PasscardOptions {
  deviceName?: string;
  preview?: "Y" | "N";
  widthMM?: number;
  heightMM?: number;
}

export interface DbConfig {
  input: string;
  db: {
    user: string;
    password: string;
    dataSource: string;
    dbName: string;
  };
  host: {
    mainHost: string;
    mainPort: string;
    subHost: string;
    subPort: string;
  };
  comm: {
    portSettings: { settings: string; port: string }[];
  };
  password: string;
  print?: {
    passcard?: PasscardOptions;
  };
}

/* ===================== 유틸 ===================== */
function isDev(): boolean {
  // Vite dev 서버면 http, 프로덕션은 file://
  try {
    return typeof window !== "undefined" && window.location?.protocol === "http:";
  } catch {
    return false;
  }
}

function parseSettingFromXml(xmlText: string): any | null {
  const clean = (xmlText || "").replace(/^\uFEFF/, "").trim();
  if (!clean) return null;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    parseTagValue: true,
  });
  const parsed = parser.parse(clean);
  return parsed?.SETTING ?? parsed?.setting ?? null;
}

/** dev: /Config.xml HTTP로 읽기 */
async function readConfigXmlTextDev(): Promise<string> {
  const res = await axios.get<string>(`/Config.xml?t=${Date.now()}`, {
    responseType: "text",
  });
  return res.data;
}

/** prod: preload/IPC로 XML 텍스트(권장) 또는 파싱된 오브젝트 받기 */
async function readSettingProd(): Promise<any | null> {
  const w = window as any;

  // 1) 권장: XML 원문 제공 (preload에서 expose: window.config.getXml)
  try {
    const maybeGetXml = w?.config?.getXml;
    if (typeof maybeGetXml === "function") {
      const xmlText = await maybeGetXml();
      const setting = parseSettingFromXml(xmlText);
      if (setting) return setting;
    }
  } catch (e) {
    console.warn("[Config] preload window.config.getXml 실패:", e);
  }

  // 2) 대안: electron.invoke("config:getXml")
  try {
    const inv = w?.electron?.invoke;
    if (typeof inv === "function") {
      const xmlText = await inv("config:getXml");
      if (typeof xmlText === "string" && xmlText.length > 0) {
        const setting = parseSettingFromXml(xmlText);
        if (setting) return setting;
      }
    }
  } catch (e) {
    console.warn("[Config] electron.invoke('config:getXml') 실패:", e);
  }

  // 3) 최후: 파싱된 객체 자체를 주는 브리지 (window.config.get)
  try {
    const maybeGet = w?.config?.get;
    if (typeof maybeGet === "function") {
      const cfgObj = await maybeGet();
      const setting = cfgObj?.SETTING ?? cfgObj?.setting ?? cfgObj;
      if (setting) return setting;
    }
  } catch (e) {
    console.warn("[Config] preload window.config.get 실패:", e);
  }

  throw new Error("[Config] prod에서 Config.xml을 읽을 브리지가 없습니다.");
}

/** 공통: dev/prod에서 SETTING 오브젝트 획득 */
async function getSetting(): Promise<any | null> {
  if (isDev()) {
    const xmlText = await readConfigXmlTextDev();
    return parseSettingFromXml(xmlText);
  }
  return await readSettingProd();
}

/* ===================== 1) 타입 좋은 버전 ===================== */
export async function loadConfigClient(): Promise<DbConfig | null> {
  try {
    const setting = await getSetting();
    if (!setting) {
      console.warn("[Config] SETTING 노드 없음");
      return null;
    }

    const input = String(setting?.Common?.INPUT ?? "N").toUpperCase();

    const dbsql = setting.DBSQL ?? {};
    const host = setting.HOST ?? {};
    const commRoot = setting.Comm ?? setting.COMM ?? {};
    const passwordValue = setting.PASSWORD?.PASS ?? "";

    const commPorts = [
      { settings: String(commRoot.SETTINGS ?? ""), port: String(commRoot.COMMPORT ?? "") },
      { settings: String(commRoot.SETTINGS1 ?? ""), port: String(commRoot.COMMPORT1 ?? "") },
      { settings: String(commRoot.SETTINGS2 ?? ""), port: String(commRoot.COMMPORT2 ?? "") },
    ].filter(p => p.settings || p.port);

    const pass = setting?.PRINT?.PASSCARD ?? {};
    const previewYN: "Y" | "N" =
      String(pass?.PREVIEW ?? "N").toUpperCase() === "Y" ? "Y" : "N";

    const passcard: PasscardOptions = {
      deviceName: String(pass?.DEVICE_NAME ?? ""),
      preview: previewYN,
      widthMM: Number(pass?.WIDTH_MM ?? 79),
      heightMM: Number(pass?.HEIGHT_MM ?? 60),
    };

    const config: DbConfig = {
      input,
      db: {
        user: String(dbsql.USR ?? ""),
        password: String(dbsql.PWD ?? ""),
        dataSource: String(dbsql.DATA_SOURCE ?? ""),
        dbName: String(dbsql.DB_NAME ?? ""),
      },
      host: {
        mainHost: String(host.HOST ?? ""),
        mainPort: String(host.PORT ?? ""),
        subHost: String(host.HOST1 ?? ""),
        subPort: String(host.PORT1 ?? ""),
      },
      comm: { portSettings: commPorts },
      password: String(passwordValue),
      print: { passcard },
    };

    return config;
  } catch (err) {
    console.error("❌ Config.xml 로드 실패(렌더러/typed):", err);
    return null;
  }
}

/* ===================== 2) 레거시 호환 버전 ===================== */
export async function loadConfig_RawCompat(): Promise<any | null> {
  try {
    const setting = await getSetting();
    if (!setting) {
      console.warn("[Config] SETTING 노드 없음(rawCompat)");
      return null;
    }

    return {
      SETTING: setting,
      ...setting,
      Common: setting.Common ?? setting.COMMON,
      PRINT: setting.PRINT,
      DBSQL: setting.DBSQL,
    };
  } catch (err) {
    console.error("❌ Config.xml 로드 실패(렌더러/rawCompat):", err);
    return null;
  }
}
