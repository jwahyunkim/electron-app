// src/main/utils/loadConfig.ts
import { app } from "electron";
import * as path from "path";
import fs from "fs";
import { XMLParser } from "fast-xml-parser";

export type LoadResult = {
  path: string; // 최종 사용된 실제 경로
  cfg: any;     // 레거시 호환 구조(SETTING/Common 등 그대로 접근 가능)
};

/** OneDrive 회피: LocalAppData(Win) 또는 userData(기타) */
function getBaseLocal() {
  return process.platform === "win32"
    ? (process.env.LOCALAPPDATA || path.resolve(app.getPath("appData"), "..", "Local"))
    : app.getPath("userData");
}

/** 최초 실행 시 resources/public/Config.xml → LocalAppData 미러(있을 때만 복사) */
export function ensureLocalMirror() {
  try {
    const resPath = (process as any).resourcesPath || path.dirname(app.getPath("exe"));
    const src = path.join(resPath, "public", "Config.xml");
    const dstDir = path.join(getBaseLocal(), "__DUMMY_CONFIG__");
    const dst = path.join(dstDir, "Config.xml");
    if (fs.existsSync(src)) {
      fs.mkdirSync(dstDir, { recursive: true });
      if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    }
  } catch (e) {
    console.warn("[Config] ensureLocalMirror 실패:", e);
  }
}

/** 탐색 후보 경로 (우선순위 순) */
function resolveCandidates(): string[] {
  const exeDir = path.dirname(app.getPath("exe"));
  const resources = (process as any).resourcesPath || path.join(exeDir, "resources");
  const baseLocal = getBaseLocal();
  const userData = app.getPath("userData");
  const cwd = process.cwd();

  // 환경변수 오버라이드(있으면 최우선)
  const envOverride = String(process.env.CONFIG_XML || "").trim();

  // Config_Db.xml도 후보에 포함
  const names = ["Config.xml", "Config_Db.xml"];

  const prodCandidates = [
    path.join(resources, "public"),
    resources,
    path.join(baseLocal, "__DUMMY_CONFIG__"),
    userData,
  ];

  const devCandidates = [
    path.resolve(__dirname, "../../public"),
    path.resolve(__dirname, "../../"),
    path.resolve(cwd, "public"),
    path.resolve(cwd),
  ];

  const list: string[] = [];
  if (envOverride) list.push(envOverride);
  for (const dir of [...prodCandidates, ...devCandidates]) {
    for (const nm of names) list.push(path.join(dir, nm));
  }
  // 중복 제거
  return Array.from(new Set(list.filter(Boolean)));
}

/** UTF-8 BOM 안전 처리 */
function readUtf8Safe(file: string) {
  const buf = fs.readFileSync(file);
  return buf.toString("utf8").replace(/^\uFEFF/, "");
}

/** SETTING 트리 → 레거시 호환 형태로 래핑 */
function wrapLegacy(settingNode: any) {
  const SETTING = settingNode || {};
  return {
    SETTING,
    ...SETTING,
    Common: SETTING.Common || SETTING.COMMON,
    PRINT: SETTING.PRINT,
    DBSQL: SETTING.DBSQL,
  };
}

/** 외부 모듈이 공통 경로만 필요할 때 사용 */
export function getBestConfigPath(): string {
  // 배포시 로컬 미러 1회 보장(있을 때만 복사)
  ensureLocalMirror();

  const tried: string[] = [];
  for (const p of resolveCandidates()) {
    try {
      fs.accessSync(p, fs.constants.R_OK);
      return p;
    } catch {
      tried.push(p);
    }
  }
  throw new Error(
    "[Config] Config.xml/Config_Db.xml을 찾지 못했습니다.\nTried:\n" + tried.join("\n")
  );
}

/** 안전 로더: 여러 후보를 순회하며 최초 성공본을 반환 */
export async function loadXmlConfig(): Promise<LoadResult | null> {
  const errors: string[] = [];
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

  try {
    const p = getBestConfigPath();
    const xml = readUtf8Safe(p);
    const parsed = parser.parse(xml);
    const setting = parsed?.SETTING || parsed?.setting;
    if (!setting) {
      errors.push(`${p} → 'SETTING' 노드 없음`);
    } else {
      const cfg = wrapLegacy(setting);
      console.info(`[Config] OK: ${p}`);
      return { path: p, cfg };
    }
  } catch (e: any) {
    errors.push(e?.message || String(e));
  }

  console.error(["[Config] 로드 실패", ...errors].join("\n"));
  return null;
}
