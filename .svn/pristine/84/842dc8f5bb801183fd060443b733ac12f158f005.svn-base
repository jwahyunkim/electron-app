//src\preload\config.ts
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

export type AppConfig = {
  SETTING: {
    Common?: { INPUT?: string };
    PRINT?: {
      PASSCARD?: {
        DEVICE_NAME?: string;
        PREVIEW?: string;    // 'Y' | 'N'
        WIDTH_MM?: string | number;
        HEIGHT_MM?: string | number;
      };
    };
    DBSQL?: { USR?: string; PWD?: string; DATA_SOURCE?: string; DB_NAME?: string };
    HOST?: { HOST?: string; PORT?: string | number; HOST1?: string; PORT1?: string | number };
    Comm?: {
      SETTINGS?: string; COMMPORT?: string | number;
      SETTINGS1?: string; COMMPORT1?: string | number;
      SETTINGS2?: string; COMMPORT2?: string | number;
    };
    MQTT?: { BROKER?: string; TOPIC?: string };
    FTP?: { HOST?: string; PORT?: string | number; USER?: string; PASSWORD?: string; APPNAME?: string };
    PASSWORD?: { PASS?: string };
  };
};

function findConfigPath(): string {
  // 우선순위: ENV > 실행폴더 public > resources/public > __dirname 기준 상위
  const candidates = [
    process.env.CONFIG_XML_PATH,
    path.join(process.cwd(), "public", "Config.xml"),
    path.join(process.resourcesPath || "", "public", "Config.xml"),
    path.join(__dirname, "../../public/Config.xml"),
  ].filter(Boolean) as string[];

    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p; } catch {}
    }
    // 마지막으로 실행 폴더 최상위에서 검색
    const guess = path.join(process.cwd(), "Config.xml");
    return guess;
}

function normalize(cfg: AppConfig): AppConfig {
  const p = cfg.SETTING?.PRINT?.PASSCARD ?? {};
  const device = p.DEVICE_NAME?.toString().trim() || "BIXOLON SRP-330II";
  const preview = (p.PREVIEW?.toString().trim().toUpperCase() || "N") as "Y"|"N";
  const width = Number(p.WIDTH_MM ?? 79);
  const height = Number(p.HEIGHT_MM ?? 60);

  return {
    ...cfg,
    SETTING: {
      ...cfg.SETTING,
      PRINT: {
        PASSCARD: {
          DEVICE_NAME: device,
          PREVIEW: preview,
          WIDTH_MM: width,
          HEIGHT_MM: height,
        },
      },
    },
  };
}

export function loadAppConfig(): AppConfig {
  const xmlPath = findConfigPath();
  let xml = "";
  try {
    xml = fs.readFileSync(xmlPath, "utf-8");
  } catch {
    // 파일이 없어도 빈 구조 + 기본값 반환
    return normalize({ SETTING: {} } as AppConfig);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
  });
  const raw = parser.parse(xml) as AppConfig;
  return normalize(raw || ({ SETTING: {} } as AppConfig));
}
