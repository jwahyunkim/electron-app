// src/main/index.ts
// ──────────────────────────────────────────────────────────────
// [1] 메인 프로세스 글로벌 예외 가드 (다른 import 이전!)
// ──────────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("💥 [MAIN] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("💥 [MAIN] unhandledRejection:", reason);
});

// ──────────────────────────────────────────────────────────────
// [2] 일반 import (epcardPrint는 절대 여기서 import 하지 않음)
// ──────────────────────────────────────────────────────────────
import { app, shell, BrowserWindow, nativeImage, ipcMain, Menu } from "electron";
import { join, dirname } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { loadXmlConfig } from "@main/utils/loadConfig";
import fs from "fs";
import { ensureLocalApiServer } from "./server";

import axios from "axios";

import { warmupOnce } from "./warmup";
import { registerWarmupIpc, setWarmupBaseUrl } from "./ipc-warmup";

import path from "node:path";
import { pathToFileURL } from "node:url";


// ─────────────── 인쇄/백그라운드 최적화 스위치 ───────────────
app.commandLine.appendSwitch("disable-print-preview");
app.commandLine.appendSwitch("kiosk-printing");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

/* ───────────────── Language 메뉴 ───────────────── */
type LangCode = "en" | "ko-KR" | "vi" | "zh-Hans" | "id";

function applyAppMenu() {
  const LANGS: Array<{ code: LangCode; label: string }> = [
    { code: "ko-KR", label: "한국어" },
    { code: "en", label: "English" },
    { code: "vi", label: "Tiếng Việt" },
    { code: "zh-Hans", label: "简体中文" },
    { code: "id", label: "Bahasa Indonesia" },
  ];
  const current = (loadSavedLang() ?? "en") as LangCode;

  const languageSubmenu: Electron.MenuItemConstructorOptions[] = LANGS.map((l) => ({
    label: l.label,
    type: "radio",
    checked: current === l.code,
    click: () => {
      saveLang(l.code);
      process.env.APP_LANG = l.code;
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) win.webContents.send("lang:changed", l.code);
      applyAppMenu();
    },
  }));

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: "File", submenu: [{ role: "quit", label: "Exit" }] },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "close" }] },
    { label: "Language", submenu: languageSubmenu },
    { label: "Help", submenu: [{ role: "about", label: "About" }] },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ───────────────── settings.json ───────────────── */
const settingsPath = () => join(app.getPath("userData"), "settings.json");
const readJsonSafe = (p: string) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
};
const writeJsonSafe = (p: string, obj: any) => {
  try {
    fs.mkdirSync(dirname(p), { recursive: true });
  } catch {}
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
};

function readLangFromArgsEnv(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--lang="))?.slice("--lang=".length);
  return (arg as string) || process.env.APP_LANG || null;
}
function loadSavedLang(): string | null {
  try {
    if (!fs.existsSync(settingsPath())) return null;
    const j = JSON.parse(fs.readFileSync(settingsPath(), "utf-8"));
    return typeof j.lang === "string" ? j.lang : null;
  } catch {
    return null;
  }
}
function saveLang(lang: string) {
  let j: any = {};
  try {
    if (fs.existsSync(settingsPath())) j = JSON.parse(fs.readFileSync(settingsPath(), "utf-8"));
  } catch {}
  j.lang = lang;
  writeJsonSafe(settingsPath(), j);
}
function initLanguageAtBoot(): LangCode {
  const incoming = readLangFromArgsEnv();
  const saved = loadSavedLang();
  const lang = (incoming || saved || "en") as LangCode;
  if (incoming && incoming !== saved) saveLang(lang);
  process.env.APP_LANG = lang;
  return lang;
}

/* ─────────────── i18n 로더 ─────────────── */
function listFiles(dir: string) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}
function readAllJsonInDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    if (!fs.existsSync(dir)) return out;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of list) {
      if (!ent.isFile()) continue;
      const file = join(dir, ent.name);
      try {
        const txt = fs.readFileSync(file, "utf-8").trim();
        if (!txt) continue;
        const obj = JSON.parse(txt);
        if (obj && typeof obj === "object") Object.assign(out, obj);
      } catch { /* ignore invalid */ }
    }
  } catch {}
  return out;
}
function rowMatrixToDict(raw: any, lang: LangCode): Record<string, string> {
  if (!Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const row of raw) {
    const k = typeof row?.Key === "string" ? row.Key.trim() : "";
    if (!k) continue;
    const v = (row?.[lang] ?? row?.en ?? "").toString();
    if (v) out[k] = v;
  }
  return out;
}

function getLauncherLocalesFallback(): string | null {
  const baseLocal = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Programs")
    : join(app.getPath("home"), "AppData", "Local", "Programs");

  try {
    const dirs = fs.readdirSync(baseLocal, { withFileTypes: true });
    for (const ent of dirs) {
      if (!ent.isDirectory()) continue;
      const name = ent.name.toLowerCase();
      if (!name.endsWith("_electron-launcher")) continue;

      const cand = join(baseLocal, ent.name, "resources", "public", "locales");
      if (fs.existsSync(cand)) {
        console.log(`[MAIN i18n] launcher fallback hit: ${cand}`);
        return cand;
      }
    }
  } catch (e) {
    console.warn("[MAIN i18n] fallback scan failed:", (e as any)?.message || e);
  }
  return null;
}

function getLocalesRoot(): { root: string; reason: string } {
  const candidates: Array<{ p: string; why: string }> = [
    { p: join(app.getPath("userData"), "locales"), why: "userData/locales" },
    { p: app.isPackaged ? join(process.resourcesPath, "public", "locales") : join(__dirname, "../../public/locales"), why: app.isPackaged ? "resources/public/locales" : "dev public/locales" },
  ];
  const launcher = getLauncherLocalesFallback();
  if (launcher) candidates.push({ p: launcher, why: "LAUNCHER resources/public/locales (fallback)" });

  for (const c of candidates) {
    if (fs.existsSync(c.p)) {
      console.log(`[MAIN i18n] try root = ${c.p} (${c.why})`);
      return { root: c.p, reason: c.why };
    }
  }
  const last = candidates[candidates.length - 1];
  console.warn(`[MAIN i18n] none found, fallback to last: ${last.p} (${last.why})`);
  return { root: last.p, reason: "last fallback" };
}

function loadBundle(lang: LangCode): Record<string, string> {
  const { root } = getLocalesRoot();

  const matrixCommon = join(root, "translations.json");
  const matrixLang = join(root, lang, "translations.json");
  if (fs.existsSync(matrixCommon)) {
    const raw = readJsonSafe(matrixCommon);
    const dict = rowMatrixToDict(raw, lang);
    console.log(`[MAIN i18n] used matrixCommon, keys=${Object.keys(dict).length}`);
    if (Object.keys(dict).length) return dict;
  }
  if (fs.existsSync(matrixLang)) {
    const raw = readJsonSafe(matrixLang);
    const dict = rowMatrixToDict(raw, lang);
    console.log(`[MAIN i18n] used matrixLang, keys=${Object.keys(dict).length}`);
    if (Object.keys(dict).length) return dict;
  }

  const baseDir = join(root, "en");
  const langDir = join(root, lang);
  console.log(`[MAIN i18n] merge dirs base=${baseDir} files=${listFiles(baseDir).join(",")}`);
  console.log(`[MAIN i18n] merge dirs lang=${langDir} files=${listFiles(langDir).join(",")}`);
  const base = readAllJsonInDir(baseDir);
  const over = lang === "en" ? {} : readAllJsonInDir(langDir);
  const dict = { ...base, ...over };
  console.log(`[MAIN i18n] merged keys=${Object.keys(dict).length}`);
  return dict;
}

/* ─────────────── IPC (Config / Lang / Port) ─────────────── */
ipcMain.handle("config:get", async () => {
  try {
    return await loadXmlConfig();
  } catch {
    return null;
  }
});
ipcMain.handle("config:getXml", async () => {
  try {
    const xmlPath = !app.isPackaged ? join(__dirname, "../../public/Config.xml") : join(process.resourcesPath, "public", "Config.xml");
    return fs.readFileSync(xmlPath, "utf-8");
  } catch {
    return "";
  }
});
ipcMain.handle("settings:getLang", () => loadSavedLang() ?? "en");
ipcMain.handle("settings:setLang", (_evt, lang: LangCode) => {
  saveLang(lang);
  process.env.APP_LANG = lang;
  return true;
});
ipcMain.handle("i18n:getBundle", () => loadBundle((loadSavedLang() ?? "en") as LangCode));

/* ─────────────── 로컬 API 포트 ─────────────── */
let LOCAL_API_PORT = 4000;
ipcMain.handle("getLocalApiPort", () => LOCAL_API_PORT);

/* ─────────────── 인쇄 모듈 지연 로드 상태 ─────────────── */
let PRINT_MODULE_READY = false;
ipcMain.handle("print:isReady", () => PRINT_MODULE_READY);

// ✅ 프리로드에서 사용하는 보조 IPC
ipcMain.handle("print:config-info", async () => {
  try {
    const cfg = await loadXmlConfig();
    return { cfg, src: getConfigPath() };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
});
ipcMain.handle("print:config-reload", async () => {
  try {
    const cfg = await loadXmlConfig();
    return { ok: true, cfg, src: getConfigPath() };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});

async function tryLoadPrintModule(): Promise<boolean> {
  if (process.env.DISABLE_PRINT === "1") {
    console.warn("[MAIN] print disabled by env");
    PRINT_MODULE_READY = false;
    return false;
  }

  try {
    const rel = app.isPackaged ? "./epcardPrint.js" : "./epcardPrint";
    const absPath = path.resolve(__dirname, rel);

    // 우선 CJS(require) 시도
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(absPath);
    } catch {
      // CJS 로드 실패(=ESM일 가능성) 시 dynamic import로 재시도
      await import(pathToFileURL(absPath).href);
    }

    PRINT_MODULE_READY = true;
    console.log("[MAIN] epcardPrint loaded:", absPath);
    return true;
  } catch (e) {
    PRINT_MODULE_READY = false;
    console.error("❌ [MAIN] epcardPrint load failed:", e);
    return false;
  }
}


/* ─────────────── 유틸: Config/포트 준비 ─────────────── */
function isDevMode(): boolean {
  return !app.isPackaged;
}
function getConfigPath(): string {
  return isDevMode() ? join(__dirname, "../../public/Config.xml") : join(process.resourcesPath, "public", "Config.xml");
}
function configExists(): boolean {
  const p = getConfigPath();
  const ok = fs.existsSync(p);
  if (!ok) console.warn(`❌ Config 파일 없음: ${p}`);
  return ok;
}
function readAppNameFromConfig(): string {
  const xml = fs.readFileSync(getConfigPath(), "utf-8");
  const m = xml.match(/<TITLE>\s*([^<]+)\s*<\/TITLE>/i);
  if (!m || !m[1]) throw new Error("❌ Config에 <TITLE> 없음");
  return m[1].trim();
}
function buildAppTitle(title: string): string {
  return `${title}${app.getVersion()}`;
}
async function waitForReady(): Promise<void> {
  // ensureLocalApiServer가 끝나 LOCAL_API_PORT가 세팅되고, Config가 읽힐 수 있는 상태까지 보장
  let tries = 30;
  while (tries-- > 0) {
    if (LOCAL_API_PORT && configExists()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("plant/port not ready");
}

/* ─────────────── Config에서 PLANT 읽기(탄탄) ─────────────── */
function readPlantFromConfig(cfg: any): string {
  const pickStr = (v: any): string => {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number") return String(v).trim();
    if (Array.isArray(v)) return pickStr(v[0]);
    if (typeof v === "object") {
      if ("_" in v) return pickStr((v as any)._);
      if ("#text" in v) return pickStr((v as any)["#text"]);
      const candKeys = ["PLANT_CD", "plant_cd", "PLANT", "plant", "plantCode", "Plant", "plantcode", "plantcd"];
      for (const k of candKeys) {
        if (k in v) return pickStr((v as any)[k]);
        const ku = k.toUpperCase();
        const kl = k.toLowerCase();
        if (ku in v) return pickStr((v as any)[ku]);
        if (kl in v) return pickStr((v as any)[kl]);
      }
    }
    return "";
  };

  const want = new Set(["plant_cd", "plant", "plantcode", "plantcd"]);
  const stack: any[] = [cfg];
  const seen = new Set<any>();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    for (const [k, val] of Object.entries(cur)) {
      const key = k.toLowerCase();
      if (want.has(key)) {
        const s = pickStr(val);
        if (s) return s.toUpperCase();
      }
      if (val && typeof val === "object") stack.push(val);
    }
  }

  // 디버깅 보조 로그
  try {
    const top = Object.keys(cfg || {});
    const set = (cfg as any)?.SETTING ?? (cfg as any)?.setting;
    const common = set?.Common ?? set?.COMMON ?? (cfg as any)?.Common ?? (cfg as any)?.common;
    console.warn("[TIME] PLANT not found in config (deep search). topKeys=", top, "has SETTING=", !!set, "has Common=", !!common);
  } catch {}
  return "";
}

/* ─────────────── 시간 컨텍스트 ─────────────── */
type TimeContext = {
  ok: boolean;
  source: "plant" | "local"; // 표시용
  isOnline: boolean;         // API 성공 여부 근사 표기(성공:true, 실패:false)
  plant: string | null;
  timeZone: string | null;
  serverEpochMs: number | null;
  workDate: string | null;
  raw?: any;
};
let TIME_CONTEXT: TimeContext = {
  ok: false,
  source: "local",
  isOnline: false,
  plant: null,
  timeZone: null,
  serverEpochMs: null,
  workDate: null,
};

/* ====== ★★★ 시간 계산 핵심 (최종) ★★★ ====== */
function ymdInTzFromEpoch(epochMs: number, tz: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs)); // e.g. 2025-10-02
}
function fullInTzFromEpoch(epochMs: number, tz: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(epochMs)); // e.g. 2025-10-02 08:21:00
}

/** 바디 epoch 단위(초/ms/µs) 정규화 → ms */
function normalizeBodyEpochToMs(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return null;
  if (n >= 1e15 && n < 1e16) return Math.floor(n / 1000); // microseconds → ms
  if (n >= 1e12 && n < 1e13) return Math.floor(n);        // milliseconds
  if (n >= 1e9  && n < 1e10)  return Math.floor(n * 1000); // seconds → ms
  return null;
}

// ⬇️ 우선순위: upstream header → body epoch → local header
function computeFromHeaderAndTz(resp: any, data: any, tz: string) {
  // 0) 상류(Date) 보존 헤더
  const upstreamDateStr: string | undefined =
    (resp?.headers?.["x-upstream-date"] as any) ||
    data?.header?.upstreamDateGmt ||
    data?.header?.dateGmt ||
    undefined;

  // 1) 바디 기반 epoch (sec/ms/µs 모두 커버)
  const epochBodyMs = normalizeBodyEpochToMs(
    data?.header?.serverNowEpochMs ?? data?.serverNowEpochMs ?? data?.serverNow ?? null
  );

  // 2) 로컬 응답 헤더 Date (최후 수단)
  const localHeaderDateStr: string | undefined =
    (resp?.headers?.["date"] as any) || (resp?.headers as any)?.["Date"];

  const tryParse = (s?: string | null) => {
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t; // ms
  };

  const upstreamMs = tryParse(upstreamDateStr);
  const localHdrMs = tryParse(localHeaderDateStr);

  // 선택 우선순위
  const epoch: number | null =
    (upstreamMs ?? null) ??
    (epochBodyMs ?? null) ??
    (localHdrMs ?? null);

  if (!epoch || !tz) {
    return {
      epoch: null,
      workDate: null,
      localFull: null,
      headerDateStr: upstreamDateStr ?? localHeaderDateStr,
      _upstreamDateStr: upstreamDateStr,
      _localHeaderDateStr: localHeaderDateStr,
      _source: "none",
    };
  }

  const workDate = ymdInTzFromEpoch(epoch, tz);
  const localFull = fullInTzFromEpoch(epoch, tz);

  return {
    epoch,
    workDate,
    localFull,
    headerDateStr: upstreamDateStr ?? localHeaderDateStr,
    _upstreamDateStr: upstreamDateStr,
    _localHeaderDateStr: localHeaderDateStr,
    _source: upstreamMs != null ? "upstream-header" : epochBodyMs != null ? "body-epoch" : "local-header",
  };
}

function makeLocalContext(plant: string | null, online: boolean): TimeContext {
  const epoch = Date.now();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    ok: true,
    source: "local",
    isOnline: online,
    plant,
    timeZone: tz,
    serverEpochMs: epoch,
    workDate: ymdInTzFromEpoch(epoch, tz),
  };
}
function withAliases(ctx: TimeContext) {
  return {
    ...ctx,
    timezone: ctx.timeZone,
    workday: ctx.workDate,
    tz: ctx.timeZone,
    currentWorkday: ctx.workDate,
  };
}

ipcMain.handle("time:getContext", () => withAliases(TIME_CONTEXT));
ipcMain.handle("time:getSource", () => TIME_CONTEXT.source);
ipcMain.handle("time:getWorkDate", () => TIME_CONTEXT.workDate);
ipcMain.handle("time:getPlantTime", () => withAliases(TIME_CONTEXT));

/* ─────────────── 수동 새로고침: API 시도 → 성공(plant) / 실패(local) ─────────────── */
ipcMain.handle("time:refreshPlantTime", async () => {
  try {
    await waitForReady();
    const cfg: any = await loadXmlConfig();
    const plant = readPlantFromConfig(cfg);
    const baseURL = `http://127.0.0.1:${LOCAL_API_PORT}`;

    if (!plant) {
      console.warn("[TIME/refresh] PLANT not found → local");
      TIME_CONTEXT = makeLocalContext(null, false);
      return { ok: false, fallback: withAliases(TIME_CONTEXT), error: "PLANT not found in config" };
    }

    try {
      const resp = await axios.get(`${baseURL}/api/sap/plant-timezone`, {
        params: { plant },
        timeout: 10000, // ↑ 10s
        validateStatus: () => true,
      });

      if (resp.status < 200 || resp.status >= 300) {
        console.warn("[TIME/refresh] API non-2xx:", { status: resp.status, data: resp.data });
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = resp.data;
      const tz: string | null = data?.timeZone ?? data?.etpTimezone ?? data?.tz ?? null;

      if (!tz) throw new Error("invalid payload: missing timeZone");
      const { epoch, workDate, localFull, headerDateStr, _upstreamDateStr, _localHeaderDateStr, _source } =
        computeFromHeaderAndTz(resp, data, tz);

      if (!epoch || !workDate) throw new Error(`invalid payload tz=${tz} epoch=${epoch} workDate=${workDate}`);

      TIME_CONTEXT = {
        ok: true,
        source: "plant",
        isOnline: true,
        plant,
        timeZone: tz,
        serverEpochMs: epoch,
        workDate,
        raw: {
          ...data,
          _headerDate: headerDateStr,
          _upstreamHeaderDate: _upstreamDateStr,
          _localHeaderDate: _localHeaderDateStr,
          _localFullInPlantTz: localFull,
          _source,
        },
      };
      console.log("[TIME/refresh] OK(header+tz):", {
        plant, tz, headerDateStr, epoch, workDate, localFull, _source
      });
      return { ok: true, data: withAliases(TIME_CONTEXT) };
    } catch (e: any) {
      const ax = e;
      if (ax?.response) {
        console.warn("[TIME/refresh] API error:", { status: ax.response.status, data: ax.response.data });
      } else {
        console.warn("[TIME/refresh] error:", ax?.message || String(ax));
      }
      const ctx = makeLocalContext(TIME_CONTEXT.plant ?? plant ?? null, false);
      TIME_CONTEXT = ctx;
      return { ok: false, fallback: withAliases(ctx), error: ax?.message || "API error" };
    }
  } catch (e: any) {
    console.warn("[TIME/refresh] failed early:", e?.message || String(e));
    const ctx = makeLocalContext(TIME_CONTEXT.plant ?? null, false);
    TIME_CONTEXT = ctx;
    return { ok: false, fallback: withAliases(ctx), error: e?.message || String(e) };
  }
});

/* ─────────────── 프린트 호스트 & 예열/유지(NEW) ─────────────── */
let PRINT_HOST: BrowserWindow | null = null;
let KEEPALIVE_TIMER: NodeJS.Timeout | null = null;

// Config.xml 경로: SETTING > PRINT > PASSCARD > DEVICE_NAME
function pickPrinterNameFromConfig(cfg: any): string | undefined {
  const dev =
    cfg?.SETTING?.PRINT?.PASSCARD?.DEVICE_NAME ??
    cfg?.PRINT?.PASSCARD?.DEVICE_NAME ??
    process.env.PRINTER_NAME ??
    undefined;
  const s = typeof dev === "string" ? dev.trim() : undefined;
  return s || undefined;
}

async function ensurePrintHost(deviceName?: string): Promise<BrowserWindow> {
  if (PRINT_HOST && !PRINT_HOST.isDestroyed()) return PRINT_HOST;

  PRINT_HOST = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: false },
  });

  await PRINT_HOST.loadURL("data:text/html,<html><body></body></html>");

  // 1px 더미 인쇄로 드라이버/스풀러 예열
  try {
    await new Promise<void>((resolve) => {
      PRINT_HOST!.webContents.print(
        {
          silent: true,
          printBackground: false,
          deviceName,
          pageSize: { width: 1, height: 1 } as any, // 극소 사이즈
        },
        () => resolve()
      );
    });
    console.log("[PRINT] warmup done", deviceName ? `(device=${deviceName})` : "");
  } catch (e) {
    console.warn("[PRINT] warmup failed (continue):", e);
  }

  PRINT_HOST.on("closed", () => {
    PRINT_HOST = null;
  });
  return PRINT_HOST;
}

function startPrintKeepAlive(deviceName?: string, intervalMs = 60000) {
  if (KEEPALIVE_TIMER) return;
  KEEPALIVE_TIMER = setInterval(async () => {
    try {
      const host = await ensurePrintHost(deviceName);
      host.webContents.print(
        { silent: true, deviceName, printBackground: false, pageSize: { width: 1, height: 1 } as any },
        () => {}
      );
    } catch {
      /* noop */
    }
  }, intervalMs);
}
function stopPrintKeepAlive() {
  if (KEEPALIVE_TIMER) {
    clearInterval(KEEPALIVE_TIMER);
    KEEPALIVE_TIMER = null;
  }
}

// 런타임 제어 IPC (옵션)
ipcMain.handle("print:start-keepalive", async (_e, ms?: number) => {
  const cfg = await loadXmlConfig().catch(() => null);
  const device = pickPrinterNameFromConfig(cfg);
  const interval = typeof ms === "number" && ms > 0 ? ms : Number(process.env.PRINT_KEEPALIVE_MS || 0) || 60000;
  startPrintKeepAlive(device, interval);
  return { ok: true, device, interval };
});
ipcMain.handle("print:stop-keepalive", async () => {
  stopPrintKeepAlive();
  return { ok: true };
});

/* ─────────────── 윈도우 생성 ─────────────── */
function createWindow(appName: string): BrowserWindow {
  const iconPath = is.dev ? join(app.getAppPath(), "src/renderer/resources/icon.png") : join(process.resourcesPath, "icon.png");
  const iconImage = nativeImage.createFromPath(iconPath);
  const fixedTitle = buildAppTitle(appName);

  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: fixedTitle,
    show: false,
    autoHideMenuBar: true,
    icon: iconImage,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.on("page-title-updated", (e) => {
    e.preventDefault();
    mainWindow.setTitle(fixedTitle);
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.setTitle(fixedTitle);
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  const rendererURL = process.env["ELECTRON_RENDERER_URL"];
  if (is.dev && rendererURL) mainWindow.loadURL(rendererURL);
  else mainWindow.loadFile(join(__dirname, "../renderer/index.html"));

  return mainWindow;
}

/* ─────────────── 부팅 플로우 ─────────────── */
let BOOT_BROADCAST_DONE = false;

console.log("[MAIN] boot…");
app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.electron");
  app.on("browser-window-created", (_, window) => optimizer.watchWindowShortcuts(window));

  const currentLang = initLanguageAtBoot();
  console.log("[MAIN] language =", currentLang);
  applyAppMenu();

  if (!configExists()) {
    app.quit();
    return;
  }

  // 인쇄 모듈 로드는 비동기 병렬
  const loadPrintPromise = tryLoadPrintModule().catch(() => false);

  // 로컬 API 서버 확보 (이미 떠 있으면 재사용)
  const { port } = await ensureLocalApiServer(4000, "127.0.0.1");
  LOCAL_API_PORT = port;

  // 워밍업 IPC/URL
  registerWarmupIpc();
  const baseURL = `http://127.0.0.1:${LOCAL_API_PORT}`;
  setWarmupBaseUrl(baseURL);

  // 앱 창 먼저 생성
  let title = "E-Scan";
  try {
    title = readAppNameFromConfig();
  } catch (e) {
    console.warn("[MAIN] TITLE fallback:", e);
  }
  const mainWindow = createWindow(title);

  // === 시간 컨텍스트 한 번만 생성 === (API 먼저 시도 → 성공 plant / 실패 local)
  try {
    await waitForReady(); // port + config
    const cfg: any = await loadXmlConfig();
    const plant = readPlantFromConfig(cfg);
    const baseURL2 = `http://127.0.0.1:${LOCAL_API_PORT}`;

    if (plant) {
      try {
        const resp = await axios.get(`${baseURL2}/api/sap/plant-timezone`, {
          params: { plant },
          timeout: 10000,
          validateStatus: () => true,
        });

        if (resp.status < 200 || resp.status >= 300) {
          console.warn("[TIME/init] API non-2xx:", { status: resp.status, data: resp.data });
          throw new Error(`HTTP ${resp.status}`);
        }

        const data = resp.data;
        const tz: string | null = data?.timeZone ?? data?.etpTimezone ?? data?.tz ?? null;

        if (tz) {
          const { epoch, workDate, localFull, headerDateStr, _upstreamDateStr, _localHeaderDateStr, _source } =
            computeFromHeaderAndTz(resp, data, tz);

          if (epoch && workDate) {
            TIME_CONTEXT = {
              ok: true,
              source: "plant",
              isOnline: true,
              plant,
              timeZone: tz,
              serverEpochMs: epoch,
              workDate,
              raw: {
                ...data,
                _headerDate: headerDateStr,
                _upstreamHeaderDate: _upstreamDateStr,
                _localHeaderDate: _localHeaderDateStr,
                _localFullInPlantTz: localFull,
                _source,
              },
            };
            console.log("[TIME/init] OK(header+tz):", { plant, tz, headerDateStr, epoch, workDate, localFull, _source });
          } else {
            console.warn("[TIME/init] payload insufficient → local fallback", { tz, epoch, workDate });
            TIME_CONTEXT = makeLocalContext(plant, false);
          }
        } else {
          console.warn("[TIME/init] missing tz → local fallback");
          TIME_CONTEXT = makeLocalContext(plant, false);
        }
      } catch (e: any) {
        const ax = e;
        if (ax?.response) {
          console.warn("[TIME/init] API error:", { status: ax.response.status, data: ax.response.data });
        } else {
          console.warn("[TIME/init] error:", ax?.message || String(ax));
        }
        TIME_CONTEXT = makeLocalContext(plant, false);
      }
    } else {
      console.warn("[TIME/init] PLANT not found → local fallback");
      TIME_CONTEXT = makeLocalContext(null, false);
    }

    // ★ 프린터 예열 (Config에서 프린터명 읽어 적용)
    try {
      const device = pickPrinterNameFromConfig(cfg);
      await ensurePrintHost(device);

      // (옵션) keep-alive: 환경변수 PRINT_KEEPALIVE_MS > 0 이면 활성화
      const ka = Number(process.env.PRINT_KEEPALIVE_MS || 0);
      if (ka > 0) {
        startPrintKeepAlive(device, ka);
        console.log(`[PRINT] keep-alive started (interval=${ka}ms)`);
      }
    } catch (e) {
      console.warn("[PRINT] warmup setup skipped:", (e as any)?.message || e);
    }
  } catch (e) {
    console.warn("⚠️ TIME_CONTEXT init failed, fallback local:", e);
    TIME_CONTEXT = makeLocalContext(null, false);
  }

  // === 최초 1회만 브로드캐스트 ===
  mainWindow.webContents.once("did-finish-load", () => {
    if (!BOOT_BROADCAST_DONE) {
      mainWindow.webContents.send("plant-time:ready", withAliases(TIME_CONTEXT));
      BOOT_BROADCAST_DONE = true;
    }
  });

  // 비블로킹 워밍업
  warmupOnce(baseURL).catch(() => {});

  // 인쇄 모듈 로드 결과 알림(옵션)
  loadPrintPromise.then((ok) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("print:module-ready", { ok });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
