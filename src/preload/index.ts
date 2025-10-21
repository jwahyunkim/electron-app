import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// ───────── types ─────────
type PasscardPrintOptions = {
  deviceName?: string;
  preview?: boolean;
  previewCountAsPrint?: boolean;
  widthMicrons?: number;
  heightMicrons?: number;
  batchId?: string;
  [k: string]: unknown;
};

type AnyObj = Record<string, any>;
type PasscardLogMsg = { tag: string; payload: any; level: "info" | "warn" | "error"; ts: string };

/* ───────── utils ───────── */
const toBool = (v: any) => {
  const s = String(v ?? "").trim().toUpperCase();
  return ["Y", "YES", "TRUE", "T", "1"].includes(s);
};
const asNum = (v: any, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const deepMerge = (a: AnyObj = {}, b: AnyObj = {}): AnyObj => {
  const out: AnyObj = Array.isArray(a) ? [...a] : { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v as AnyObj);
    } else {
      out[k] = v;
    }
  }
  return out;
};

/* ───────── config normalize ───────── */
function normalizeConfig(raw: AnyObj | null | undefined): AnyObj {
  const r: AnyObj = raw ?? {};
  const SETTING: AnyObj =
    r.SETTING ?? r.setting ?? {
      Common: r.Common ?? r.common ?? (typeof r.input !== "undefined" ? { INPUT: r.input } : {}),
      PRINT: r.PRINT ?? r.Print ?? r.print ?? {},
      DBSQL:
        r.DBSQL ?? r.dbsql ??
        (r.db ? { USR: r.db.user, PWD: r.db.password, DATA_SOURCE: r.db.host, DB_NAME: r.db.database } : {}),
    };

  const Common = SETTING.Common ?? {};
  const PRINT = SETTING.PRINT ?? {};
  const PASSCARD = PRINT.PASSCARD ?? PRINT.Passcard ?? r.PASSCARD ?? {};

  return {
    ...r,
    SETTING,
    Common,
    PRINT: { ...PRINT, PASSCARD },
    input: typeof r.input !== "undefined" ? r.input : Common.INPUT,
    DBSQL: SETTING.DBSQL ?? r.DBSQL ?? {},
  };
}

/* ───────── merge: main(xml) 우선 ───────── */
async function fetchMergedConfig(): Promise<{ cfg: AnyObj; source: string }> {
  let client: AnyObj | null = null;
  let main: AnyObj | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import("../renderer/utils/loadConfigClient");
    const cfgClient = await (mod as any).loadConfigClient();
    client = normalizeConfig(cfgClient as AnyObj);
  } catch {
    client = null;
  }

  // 메인(XML) IPC 우선
  let mainRaw: AnyObj | null = null;
  try { mainRaw = (await ipcRenderer.invoke("print:config-info"))?.cfg ?? null; } catch {}
  if (!mainRaw) {
    try { mainRaw = await ipcRenderer.invoke("config:get"); } catch {}
  }
  main = normalizeConfig(mainRaw as AnyObj);

  const cfg = deepMerge(client ?? {}, main ?? {});
  const source = (mainRaw ? "main(xml)" : "") + (client ? (mainRaw ? "+client" : "client") : "") || "none";
  return { cfg, source };
}

/* ───────── PASSCARD options ───────── */
let previewOverride: boolean | undefined;
let previewCountAsPrintOverride: boolean | undefined;

async function getPasscardOptions(): Promise<PasscardPrintOptions> {
  const { cfg, source } = await fetchMergedConfig();

  const pass =
    cfg?.SETTING?.PRINT?.PASSCARD ??
    cfg?.PRINT?.PASSCARD ?? cfg?.Print?.PASSCARD ?? cfg?.PRINT?.Passcard ??
    cfg?.Passcard ?? cfg?.PASSCARD ?? {};

  const rawPreview =
    pass.PREVIEW ?? pass.preview ??
    cfg?.SETTING?.PRINT?.PREVIEW ?? cfg?.PRINT?.PREVIEW ?? cfg?.preview ?? "";

  const rawCount =
    pass.PREVIEW_COUNT_AS_PRINT ?? pass.preview_count_as_print ?? pass.previewCountAsPrint ??
    cfg?.previewCountAsPrint ?? cfg?.PREVIEW_COUNT_AS_PRINT ?? "";

  const deviceNameRaw = pass.DEVICE_NAME ?? pass.deviceName ?? cfg?.deviceName;
  const deviceName =
    deviceNameRaw != null && String(deviceNameRaw).trim() !== "" ? String(deviceNameRaw).trim() : undefined;

  const widthMm = asNum(pass.WIDTH_MM ?? pass.width_mm ?? pass.widthMm ?? cfg?.widthMM ?? cfg?.WIDTH_MM, 79);
  const heightMm = asNum(pass.HEIGHT_MM ?? pass.height_mm ?? pass.heightMm ?? cfg?.heightMM ?? cfg?.HEIGHT_MM, 54);

  const preview = typeof previewOverride === "boolean" ? previewOverride : toBool(rawPreview);
  const previewCountAsPrint =
    typeof previewCountAsPrintOverride === "boolean" ? previewCountAsPrintOverride : toBool(rawCount);

  const out: PasscardPrintOptions = {
    deviceName,
    preview,
    widthMicrons: Math.round(widthMm * 1000),
    heightMicrons: Math.round(heightMm * 1000),
    previewCountAsPrint,
  };

  console.log("[PASSCARD] config source =", source);
  console.log("[PASSCARD] options =", out);
  return out;
}

/** 호출 옵션과 기본 옵션 병합 */
async function mergePasscardOptions(opts?: PasscardPrintOptions): Promise<PasscardPrintOptions> {
  const base = await getPasscardOptions();
  const merged: PasscardPrintOptions = { ...base, ...opts };

  if (typeof merged.deviceName === "string" && merged.deviceName.trim() === "") {
    delete merged.deviceName; // OS 기본 프린터
  }
  return merged;
}

/* ───────── runtime toggles ───────── */
function setPreviewOverride(v?: boolean) {
  previewOverride = v;
  console.log("[PASSCARD] preview override =", previewOverride);
}
function setPreviewCountAsPrintOverride(v?: boolean) {
  previewCountAsPrintOverride = v;
  console.log("[PASSCARD] previewCountAsPrint override =", previewCountAsPrintOverride);
}

/* ───────── existing APIs ───────── */
const api = {
  getConfig: async () => {
    try {
      const { cfg } = await fetchMergedConfig();
      return cfg;
    } catch (err) {
      console.error("❌ preload에서 config 로드 실패:", err);
      return null;
    }
  },
  getLocalApiPort: () => ipcRenderer.invoke("getLocalApiPort"),
};

/* ───────── i18n ───────── */
const i18n = {
  getLang: () => ipcRenderer.invoke("settings:getLang"),
  setLang: (lang: "en" | "ko-KR" | "vi" | "zh-Hans" | "id") => ipcRenderer.invoke("settings:setLang", lang),
  getBundle: () => ipcRenderer.invoke("i18n:getBundle"),
};

const langEvents = {
  onChanged: (cb: (code: string) => void) => {
    const handler = (_: unknown, code: string) => {
      try { cb(code); } catch (e) { console.warn("langEvents cb error:", e); }
    };
    ipcRenderer.on("lang:changed", handler);
    return () => ipcRenderer.removeListener("lang:changed", handler);
  },
};

/* ───────── print IPC ───────── */
const print = {
  passcards: async (jobs: any[], options?: PasscardPrintOptions) => {
    const merged = await mergePasscardOptions(options);
    const payload = { batchId: merged.batchId, jobs, options: merged };
    return ipcRenderer.invoke("print:passcards", payload);
  },
};

const printer = {
  printPasscard: async (opts: {
    deviceName?: string; pageSize?: { widthMM: number; heightMM: number }; url?: string; preview?: boolean;
  }) => {
    const merged = await mergePasscardOptions({
      deviceName: opts?.deviceName,
      preview: opts?.preview,
      widthMicrons: opts?.pageSize ? Math.round(opts.pageSize.widthMM * 1000) : undefined,
      heightMicrons: opts?.pageSize ? Math.round(opts.pageSize.heightMM * 1000) : undefined,
    });
    return ipcRenderer.invoke("epcard:print", {
      deviceName: merged.deviceName,
      preview: merged.preview,
      pageSize: (opts?.pageSize
        ? opts.pageSize
        : (merged.widthMicrons && merged.heightMicrons
          ? { widthMM: merged.widthMicrons / 1000, heightMM: merged.heightMicrons / 1000 }
          : undefined)
      ),
      url: opts?.url,
    });
  },
  list: () => ipcRenderer.invoke("print:list"),
};

/* ───────── main config helpers ───────── */
async function getMainConfigInfo() { return ipcRenderer.invoke("print:config-info"); }
async function reloadMainConfig() { return ipcRenderer.invoke("print:config-reload"); }

/* ───────── logs from main ───────── */
function onPasscardLog(cb: (msg: PasscardLogMsg) => void) {
  const handler = (_: unknown, msg: PasscardLogMsg) => {
    try {
      const label = `[PASSCARD][MAIN→RDR][${msg.tag}]`;
      if (msg.level === "error") console.error(label, msg.payload);
      else if (msg.level === "warn") console.warn(label, msg.payload);
      else console.info(label, msg.payload);

      queueMicrotask(() => {
        try { cb?.(msg); } catch (e) { console.warn("onPasscardLog cb error(microtask):", e); }
      });
    } catch (e) { console.warn("onPasscardLog handler error:", e); }
  };
  ipcRenderer.on("passcard:log", handler);
  return () => ipcRenderer.removeListener("passcard:log", handler);
}

// ───────── time types/bridge ─────────
type TimeContext = {
  ok: boolean;
  source: "plant" | "local";
  isOnline: boolean;
  plant: string | null;
  timeZone: string | null;
  serverEpochMs: number | null;
  workDate: string | null;
  raw?: any;
};

const timeBridge = {
  getContext: (): Promise<TimeContext> => ipcRenderer.invoke("time:getContext"),
  getSource: (): Promise<"plant" | "local"> => ipcRenderer.invoke("time:getSource"),
  refresh: () => ipcRenderer.invoke("time:refreshPlantTime"),
  onReadyOnce: (cb: (data: TimeContext) => void) => {
    const handler = (_: unknown, data: TimeContext) => {
      try { cb(data); } catch (e) { console.warn("timeBridge.onReadyOnce cb error:", e); }
    };
    ipcRenderer.once("plant-time:ready", handler);
    return () => ipcRenderer.removeListener("plant-time:ready", handler);
  },
};

/* ───────── safe expose ───────── */
const EXPOSE_FLAG = Symbol.for("__preload_exposed__");
const g = globalThis as any;

const configBridge = {
  get: api.getConfig,
  getXml: () => ipcRenderer.invoke("config:getXml"),
  getPasscardOptions,
  setPreviewOverride,
  setPreviewCountAsPrintOverride,
  setPasscardPreviewOverride: (v: boolean) => setPreviewOverride(!!v),
  setPasscardPreviewCountAsPrintOverride: (v: boolean) => setPreviewCountAsPrintOverride(!!v),
  getMainConfigInfo,
  reloadMainConfig,
  listPrinters: () => ipcRenderer.invoke("print:list"),
};

const logsBridge = { onPasscardLog };
const electronBridge = { ...electronAPI, invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args) };

if (process.contextIsolated) {
  try {
    if (!g[EXPOSE_FLAG]) {
      contextBridge.exposeInMainWorld("electron", electronBridge);
      contextBridge.exposeInMainWorld("ipc", { invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args) });
      contextBridge.exposeInMainWorld("api", api);
      contextBridge.exposeInMainWorld("config", configBridge);
      contextBridge.exposeInMainWorld("i18n", i18n);
      contextBridge.exposeInMainWorld("langEvents", langEvents);
      contextBridge.exposeInMainWorld("printBridge", print);
      contextBridge.exposeInMainWorld("passcard", print);
      contextBridge.exposeInMainWorld("printer", printer);
      contextBridge.exposeInMainWorld("logs", logsBridge);
      contextBridge.exposeInMainWorld("time", timeBridge);
      contextBridge.exposeInMainWorld("__preloadReady", true);
      g[EXPOSE_FLAG] = true;
      console.log("[preload] exposed: electron.invoke / config.getXml / printBridge / printer / logs / time / __preloadReady=true");
    }
  } catch (e) {
    console.error("❌ contextBridge expose 실패:", e);
  }
} else {
  // non-isolated
  // @ts-ignore
  window.electron = electronBridge;
  // @ts-ignore
  window.ipc = { invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args) };
  // @ts-ignore
  window.api = api;
  // @ts-ignore
  window.config = configBridge;
  // @ts-ignore
  window.i18n = i18n;
  // @ts-ignore
  window.langEvents = langEvents;
  // @ts-ignore
  window.printBridge = print;
  // @ts-ignore
  window.passcard = print;
  // @ts-ignore
  window.printer = printer;
  // @ts-ignore
  window.logs = logsBridge;
  // @ts-ignore
  window.time = timeBridge;
  // @ts-ignore
  window.__preloadReady = true;

  console.log("[preload] exposed (non-isolated): electron.invoke / config.getXml / printBridge / printer / logs / time / __preloadReady=true");
}
