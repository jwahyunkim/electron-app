// epcardPrint.ts — FAST PATH (스풀/프리플라이트 완전 제거)
// - 전송 즉시 성공 처리 (검증 대기 0초)
// - 디자인/레이아웃 변경 없음
// - 기본 옵션 자동 병합, batchId 패스스루, 로그 브릿지 안전화
// - deviceName 기본값 강제 미설정(시스템 기본 프린터 허용)

import { BrowserWindow, ipcMain, webContents } from "electron";
import fs from "fs";
import path from "path";

/* ===================== 유틸/타입 ===================== */
type PageSizeMM = { widthMM: number; heightMM: number };
type PrintArgs = { deviceName?: string; pageSize?: PageSizeMM; url?: string; preview?: boolean; };

const mmToMicrons = (mm: number) => Math.round(mm * 1000);
const umToMm = (v?: number) => (typeof v === "number" ? v / 1000 : undefined);

const CHANNEL_JOB  = "passcard:job-result";
const CHANNEL_DONE = "passcard:batch-done";

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const HOLD = new Set<Electron.BrowserWindow>();
const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));

type PrintOptions = any;

/* ===================== 컨피그 ===================== */
type VerifyMode = "usb" | "spool" | "none"; // 과거 XML 호환용 (미사용)

type PasscardCfg = {
  deviceName?: string;              // 기본값 강제 X (undefined면 시스템 기본)
  preview?: boolean;
  previewCountAsPrint?: boolean;
  widthMM: number;
  heightMM: number;
  previewZoom?: number;

  padLeftCM?: number;
  padRightCM?: number;
  rightInsetCM?: number;
  lineWCm?: number;
  feedCompMM?: number;
  qrMargin?: number;
  qrScale?: number;
  qrEcLevel?: "L" | "M" | "Q" | "H";

  topPadDeltaCM?: number;
  topShiftCM?: number;

  verifyMode?: VerifyMode;     // 미사용
  preflightStrict?: boolean;   // 미사용

  apiBase?: string;

  anyOnDevice?: boolean;       // 미사용
  presentTooLongOkMs?: number; // 미사용
};

const DEFAULT_CFG: PasscardCfg = {
  deviceName: undefined,              // ★ 시스템 기본 허용
  preview: false,
  previewCountAsPrint: true,
  widthMM: 79,
  heightMM: 54,
  previewZoom: 1.0,
  padLeftCM: 0.20,
  padRightCM: 0.20,
  rightInsetCM: 0.15,
  lineWCm: 0.03,
  feedCompMM: 0,
  qrMargin: 2,
  qrScale: 10,
  qrEcLevel: "M",
  topPadDeltaCM: 0,
  topShiftCM: 0,
  verifyMode: "none",
  preflightStrict: false,
  anyOnDevice: false,
  presentTooLongOkMs: 0,
};

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
function resolveCfgCandidates() {
  const cwd = process.cwd();
  const resPub = process.resourcesPath ? path.join(process.resourcesPath, "public") : "";
  const herePub = path.resolve(__dirname, "../../public");
  return uniq([
    path.resolve(cwd, "Config.xml"),
    path.resolve(cwd, "SETTING.xml"),
    path.resolve(cwd, "setting.xml"),
    path.resolve(cwd, "epcard-print.config.xml"),
    resPub && path.join(resPub, "Config.xml"),
    path.join(herePub, "Config.xml"),
  ]);
}

/* ====== 인쇄 전용 창 재사용 (첫 장 속도 최적화) ====== */
let PRINT_WIN: Electron.BrowserWindow | null = null;
async function getPrintWin(): Promise<Electron.BrowserWindow> {
  if (PRINT_WIN && !PRINT_WIN.isDestroyed()) return PRINT_WIN;
  PRINT_WIN = new BrowserWindow({
    width: 520, height: 420, show: false,
    alwaysOnTop: false, focusable: false, skipTaskbar: true, autoHideMenuBar: true,
    webPreferences: {
      sandbox: false,
      backgroundThrottling: false,
      webgl: false,
      images: true,                 // QR DataURL 사용할 때만 이미지 필요
      javascript: true,
      spellcheck: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  try { PRINT_WIN.webContents.setVisualZoomLevelLimits(1, 1); } catch {}
  HOLD.add(PRINT_WIN);
  PRINT_WIN.on("closed", () => { HOLD.delete(PRINT_WIN!); PRINT_WIN = null; });
  await PRINT_WIN.loadURL("about:blank");
  return PRINT_WIN;
}

let CURRENT_CFG: PasscardCfg = { ...DEFAULT_CFG };
let CONFIG_SRC: string | null = null;

/* ===================== 로그 브릿지 (안전화) ===================== */
function relayPasscardLog(tag: string, payload: any, level: "info"|"warn"|"error" = "info") {
  const msg = { tag, payload, level, ts: new Date().toISOString() };
  try { (console as any)[level]?.(`[PASSCARD][MAIN][${tag}]`, payload); } catch {}
  for (const wc of webContents.getAllWebContents()) {
    try {
      // 렌더러 UI 이벤트 루프와 충돌 줄이기
      queueMicrotask(() => {
        try { wc.send("passcard:log", msg); } catch {}
      });
    } catch {}
  }
}

function parseBoolLike(v: string | undefined, def = false) {
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "y" || s === "yes";
}
function pickTag(xml: string, tag: string) {
  const m = xml.match(new RegExp(`<\\s*${tag}\\s*>\\s*([^<]+)\\s*<\\s*/\\s*${tag}\\s*>`, "i"));
  return m ? m[1].trim() : undefined;
}

/* ===================== API_BASE 정규화/해석 ===================== */
function normalizeApiBaseCandidate(raw?: string): string | undefined {
  if (!raw) return undefined;
  let s = String(raw).trim();
  if (!s) return undefined;
  s = s.replace(/\/+$/, "");
  if (/\/api\/mssql$/i.test(s)) return s;
  if (/\/api$/i.test(s)) return s + "/mssql";
  if (/^https?:\/\//i.test(s)) return s + "/api/mssql";
  return "http://" + s + "/api/mssql";
}
function looksLikeFrontendDev(url: string) {
  return /:5173(?:\/|$)/.test(url) || /\/@vite/i.test(url);
}
function isSapHost(u: string) {
  try {
    const host = new URL(u).host.toLowerCase();
    return /(?:\.dmc\.cloud\.sap|\.hana\.ondemand\.com|\.sap\.com)$/.test(host) || host.includes(".dmc.cloud.sap");
  } catch {
    return /dmc\.cloud\.sap|hana\.ondemand\.com|sap\.com/i.test(u);
  }
}
function forceLocalIfSap(cand?: string) {
  if (!cand) return undefined;
  if (isSapHost(cand)) {
    relayPasscardLog("API_BASE warn (SAP host detected; forcing LOCAL)", { cand }, "warn");
    return "http://127.0.0.1:4000/api/mssql";
  }
  return cand;
}
function resolveApiBaseFromEnvOrCfg(cfg: PasscardCfg) {
  const envCandidates = [
    { k: "E_SCAN_API_BASE", v: process.env.E_SCAN_API_BASE },
    { k: "API_BASE",        v: process.env.API_BASE },
    { k: "API_BASE_MSSQL",  v: process.env.API_BASE_MSSQL },
  ];
  for (const e of envCandidates) {
    const cand0 = normalizeApiBaseCandidate(e.v);
    const cand  = forceLocalIfSap(cand0);
    if (cand) {
      if (looksLikeFrontendDev(cand)) {
        relayPasscardLog("API_BASE warn (env looks like front dev)", { key: e.k, cand }, "warn");
      }
      return { base: cand, from: `env:${e.k}${cand !== cand0 ? " (forced-local)" : ""}` };
    }
  }
  const xmlRaw = cfg.apiBase ?? undefined;
  const xmlCand0 = normalizeApiBaseCandidate(xmlRaw);
  const xmlCand  = forceLocalIfSap(xmlCand0);
  if (xmlCand) {
    if (looksLikeFrontendDev(xmlCand)) {
      relayPasscardLog("API_BASE warn (xml looks like front dev)", { src: CONFIG_SRC, cand: xmlCand, raw: xmlRaw }, "warn");
    }
    return { base: xmlCand, from: (CONFIG_SRC ? `xml:${CONFIG_SRC}` : "xml") + (xmlCand !== xmlCand0 ? " (forced-local)" : "") };
  }
  return { base: "http://127.0.0.1:4000/api/mssql", from: "default" };
}

let API_BASE = "http://127.0.0.1:4000/api/mssql";
function refreshApiBase() {
  const r = resolveApiBaseFromEnvOrCfg(CURRENT_CFG);
  API_BASE = r.base;
  relayPasscardLog("API_BASE resolved", { from: r.from, API_BASE }, "info");
}

/* ===================== 설정 파서/로드/워치 ===================== */
function parseSettingXml(xml: string): PasscardCfg | null {
  const device = pickTag(xml, "DEVICE_NAME");
  const preview = pickTag(xml, "PREVIEW");
  const previewCnt = pickTag(xml, "PREVIEW_COUNT_AS_PRINT");
  const w = Number(pickTag(xml, "WIDTH_MM"));
  const h = Number(pickTag(xml, "HEIGHT_MM"));
  const zoomRaw = pickTag(xml, "PREVIEW_ZOOM") ?? pickTag(xml, "PREVIEW_SCALE_PCT");

  const padLeft  = Number(pickTag(xml, "PAD_LEFT_CM"));
  const padRight = Number(pickTag(xml, "PAD_RIGHT_CM"));
  const rightInset = Number(pickTag(xml, "RIGHT_INSET_CM"));
  const lineWcm = Number(pickTag(xml, "LINE_W_CM"));
  const feedComp = Number(pickTag(xml, "FEED_COMP_MM"));
  const qrMargin = Number(pickTag(xml, "QR_MARGIN"));
  const qrScale = Number(pickTag(xml, "QR_SCALE"));
  const qrEc = (pickTag(xml, "QR_EC_LEVEL") || "").toUpperCase();

  const topPadDelta = Number(pickTag(xml, "TOP_PAD_DELTA_CM") ?? pickTag(xml, "TOP_PAD_CM_DELTA"));
  const topShift    = Number(pickTag(xml, "TOP_SHIFT_CM")    ?? pickTag(xml, "TOP_OFFSET_CM"));

  const verifyMode  = (pickTag(xml, "VERIFY_MODE") || "none").toLowerCase() as VerifyMode;
  const preflightStrict = parseBoolLike(pickTag(xml, "PREFLIGHT_STRICT"), DEFAULT_CFG.preflightStrict);

  const apiBaseXml =
    pickTag(xml, "API_BASE") ||
    pickTag(xml, "E_SCAN_API_BASE") ||
    pickTag(xml, "API_BASE_MSSQL") ||
    pickTag(xml, "API_BASE_URL") ||
    pickTag(xml, "API_ORIGIN");

  const anyOnDeviceXml = parseBoolLike(pickTag(xml, "ANY_ON_DEVICE"), false);
  const presentTooLongOkMs = Number(pickTag(xml, "PRESENT_TOO_LONG_OK_MS"));

  let previewZoom: number | undefined;
  if (zoomRaw) {
    const z = Number(String(zoomRaw).replace(/[^\d.]/g, ""));
    if (isFinite(z) && z > 0) previewZoom = z > 5 ? z / 100 : z;
  }

  const cfg: PasscardCfg = {
    deviceName: device || undefined, // 기본값 강제 X
    preview: parseBoolLike(preview, DEFAULT_CFG.preview),
    previewCountAsPrint: parseBoolLike(previewCnt, DEFAULT_CFG.previewCountAsPrint),
    widthMM: isFinite(w) && w > 0 ? w : DEFAULT_CFG.widthMM,
    heightMM: isFinite(h) && h > 0 ? h : DEFAULT_CFG.heightMM,
    previewZoom: previewZoom ?? DEFAULT_CFG.previewZoom,

    padLeftCM:  isFinite(padLeft)  ? padLeft  : DEFAULT_CFG.padLeftCM,
    padRightCM: isFinite(padRight) ? padRight : DEFAULT_CFG.padRightCM,
    rightInsetCM: isFinite(rightInset) ? rightInset : DEFAULT_CFG.rightInsetCM,
    lineWCm: isFinite(lineWcm) ? lineWcm : DEFAULT_CFG.lineWCm,
    feedCompMM: isFinite(feedComp) && feedComp >= 0 ? feedComp : DEFAULT_CFG.feedCompMM,
    qrMargin: isFinite(qrMargin) && qrMargin >= 0 ? qrMargin : DEFAULT_CFG.qrMargin,
    qrScale: isFinite(qrScale) && qrScale > 0 ? qrScale : DEFAULT_CFG.qrScale,
    qrEcLevel: (["L","M","Q","H"] as const).includes(qrEc as any) ? (qrEc as any) : DEFAULT_CFG.qrEcLevel,

    topPadDeltaCM: isFinite(topPadDelta) ? topPadDelta : DEFAULT_CFG.topPadDeltaCM,
    topShiftCM:    isFinite(topShift)    ? topShift    : DEFAULT_CFG.topShiftCM,

    verifyMode,
    preflightStrict,

    apiBase: apiBaseXml,

    anyOnDevice: anyOnDeviceXml,
    presentTooLongOkMs: isFinite(presentTooLongOkMs) && presentTooLongOkMs >= 0 ? presentTooLongOkMs : DEFAULT_CFG.presentTooLongOkMs,
  };

  console.info("[PASSCARD][CONFIG] parsed", cfg);
  return cfg;
}
function loadSpecific(file: string): PasscardCfg | null {
  try {
    const xml = fs.readFileSync(file, "utf8");
    const cfg = parseSettingXml(xml);
    if (cfg) { CONFIG_SRC = file; return cfg; }
  } catch (e) {
    console.warn("[print:config] failed to parse", file, e);
  }
  return null;
}
function loadConfigFromFile(): PasscardCfg | null {
  const candidates = resolveCfgCandidates();
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    const cfg = loadSpecific(f);
    if (cfg) return cfg;
  }
  return null;
}
function watchConfigs() {
  const files = resolveCfgCandidates();
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    try {
      fs.watch(f, { persistent: false }, () => {
        const next = loadConfigFromFile();
        if (next) {
          CURRENT_CFG = next;
          relayPasscardLog("CONFIG reloaded", { from: CONFIG_SRC, cfg: CURRENT_CFG }, "info");
          refreshApiBase();
        }
      });
    } catch {}
  }
}
function initConfig() {
  CURRENT_CFG = loadConfigFromFile() ?? { ...DEFAULT_CFG };
  console.info("[PASSCARD][CONFIG] loaded", { from: CONFIG_SRC ?? "(default)", cfg: CURRENT_CFG });
  relayPasscardLog("CONFIG loaded", { from: CONFIG_SRC ?? "(default)", cfg: CURRENT_CFG }, "info");
  refreshApiBase();
  watchConfigs();
}
initConfig();

console.log("[main] epcardPrint loaded (epcard:print / print:passcards / passcard:print-batch / print:diag / print:config-info / print:config-reload)]");

/* ===================== DB 호출 ===================== */
const _fetch: any = (globalThis as any).fetch;
async function postJson(url: string, body: any) {
  if (!_fetch) throw new Error("fetch not available");
  const res = await _fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) { let t=""; try{t=await res.text();}catch{} throw new Error(`${url} ${res.status} ${t}`); }
  try { return await res.json(); } catch { return {}; }
}

// - 마킹은 원본 seq 그대로 (패딩 X)
// - SFC는 128자로 통일
function keyOf(job: any) {
  const rawSeq = job.PCARD_SEQ ?? job.SEQ ?? job.seq ?? "0";
  const seqStr = String(rawSeq).trim(); // 원본 유지

  const daySeq = (() => {
    const s = String(job.DAY_SEQ ?? "1H").trim().toUpperCase();
    return s.endsWith("H") ? s : `${s}H`;
  })();

  const pick = (...cands: any[]) =>
    cands.map(v => (v ?? "").toString().trim()).find(v => v.length > 0) || "";

  const fromSteps = (() => {
    try {
      if (Array.isArray(job.steps) && job.steps.length) {
        return pick(job.steps[0]?.plannedWorkCenter, job.steps[0]?.resource);
      }
      return "";
    } catch { return ""; }
  })();

  const workCenter = pick(
    job.WORK_CENTER, job.center, job.CENTER, job.plannedWorkCenter,
    job.resource, job.RESOURCE, job.RESOURCE_CD, job.NEXT_RESOURCE_CD, fromSteps
  ).slice(0, 50) || "UNKNOWN";

  return {
    PLANT_CD: String(job.PLANT_CD ?? job.PLANT ?? "C200").slice(0, 4),
    SFC_CD: String(job.SFC_CD ?? job.SFC ?? "").slice(0, 128),
    ORDER_NUMBER: String(job.ORDER_NUMBER ?? job.WO ?? "").slice(0, 10),
    BAR_KEY: String(job.BAR_KEY ?? "").slice(0, 20),
    PCARD_SEQ: String(seqStr).slice(0, 20),
    DAY_SEQ: String(daySeq).slice(0, 6),
    WORK_CENTER: workCenter,
  };
}

async function markPrintStart(job: any, deviceName?: string, state?: "PRINTING" | "SPOOLED", errCode?: string, errMsg?: string) {
  const k = keyOf(job);
  const wc = String(job.WORK_CENTER ?? job.work_center ?? "").slice(0, 50);
  const nextOrd = String(job.NEXT_ORDER_NUMBER ?? job.next_order_number ?? "").slice(0, 10);
  try {
    await postJson(`${API_BASE}/epcard/print-start`, {
      ...k,
      DEVICE: deviceName,
      STATE: state,
      ERR_CODE: errCode,
      ERR_MSG: errMsg,
      WORK_CENTER: wc || "UNKNOWN",
      NEXT_ORDER_NUMBER: nextOrd || ""
    });
  } catch (e) {
    relayPasscardLog("PRINT_START_FAIL", { ...k, WORK_CENTER: wc || "UNKNOWN", err: String(e) }, "error");
  }
}

async function markPrintResult(
  job: any,
  ok: boolean,
  errCode?: string,
  errMsg?: string,
  opts?: { stateHint?: "SUCCESS" | "SPOOLED" | "ERROR"; deviceName?: string; cntInc?: number }
) {
  const k = keyOf(job);
  try {
    await postJson(`${API_BASE}/epcard/print-result`, {
      ...k,
      OK: ok ? 1 : 0,
      ERR_CODE: errCode,
      ERR_MSG: errMsg,
      STATE: opts?.stateHint,
      DEVICE: opts?.deviceName,
      PRINT_LAST_TRY_AT: new Date().toISOString(),
      CNT_INC: opts?.cntInc ?? (ok && opts?.stateHint === "SUCCESS" ? 1 : 0),
    });
  } catch (e) {
    relayPasscardLog("PRINT_RESULT_FAIL", { ...k, err: String(e) }, "error");
  }
}

/* ===================== 프린터/페이지 유틸 ===================== */
async function listPrinters(): Promise<Electron.PrinterInfo[]> {
  let anyWin = BrowserWindow.getAllWindows()[0];
  let temp = false;
  if (!anyWin) { anyWin = new BrowserWindow({ show: false }); temp = true; }
  try {
    const list = await (anyWin.webContents.getPrintersAsync?.() ?? Promise.resolve([]));
    return list ?? [];
  } catch { return []; }
  finally { if (temp && anyWin && !anyWin.isDestroyed()) try { anyWin.close(); } catch {} }
}
async function resolvePrinterName(requested?: string) {
  const name = requested ?? CURRENT_CFG.deviceName; // 기본값 강제 없음
  if (!name) return undefined;
  const list = await listPrinters();
  const exact = list.find(p => p.name === name);
  if (exact) return exact.name;
  const lc = name.toLowerCase();
  const ci = list.find(p => p.name.toLowerCase() === lc);
  if (ci) return ci.name;
  const contains = list.find(p => p.name.toLowerCase().includes(lc));
  if (contains) return contains.name;
  return undefined;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
const ymdhms = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;

function formatPrintDt(raw: any): string {
  const s = (raw ?? "").toString().trim();
  if (!s) return ymdhms(new Date());
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;
  const d = new Date(s);
  if (!isNaN(d as any)) return ymdhms(d);
  return ymdhms(new Date());
}
const clip = (s: string, max: number) => { const t = (s ?? "").toString(); return t.length <= max ? t : t.slice(0, max) };

/* ===================== 라벨 모델 (디자인 섹션 그대로) ===================== */
function makeLabelModel(src: any) {
  const NA = "N/A";
  const now = new Date();
  const plant   = (src?.PLANT_CD ?? src?.PLANT ?? "C200").toString();

  const bd   = NA;
  const opCd = NA;
  const RESOURCE_CD      = NA;
  const NEXT_RESOURCE_CD = NA;
  const OP_NAME    = NA;
  const PART_NAME  = NA;
  const STYLE_NAME = NA;

  const seq3    = String(src?.PCARD_SEQ ?? src?.SEQ ?? 1).padStart(3, "0");
  const daySeq  = NA;
  const orderNo = (src?.ORDER_NUMBER ?? src?.WO ?? "").toString();

  const createYmd = (src?.CREATE_DATE ?? "").toString().replace(/[^\d]/g, "").slice(0, 8) || ymd(now);
  const printDt   = formatPrintDt(src?.PRINT_DT || now);

  const bigCode = NA;
  const qty     = String(src?.PCARD_QTY ?? src?.QTY ?? "");
  const size    = (src?.SIZE_CD ?? src?.SIZE ?? "").toString();

  const qrText = [(src?.BAR_KEY ?? "").toString(), orderNo, (src?.NEXT_ORDER_NUMBER ?? "").toString(), qty]
    .filter(Boolean).join("_");

  const HEADER_RAW = `${plant}-${bd}-${createYmd}-${opCd}-${daySeq}-${seq3}`;

  const DISP = {
    HEADER: esc(clip(HEADER_RAW, 32)),
    PROD:   esc(clip(RESOURCE_CD, 24)),
    NEXT:   esc(clip(NEXT_RESOURCE_CD, 24)),

    BIG:    esc(clip(bigCode, 12)),
    STYLE:  esc(clip(STYLE_NAME, 36)),
    PROC:   esc(clip(`${opCd} (${OP_NAME}) / ${PART_NAME}`, 42)),
    FOOT:   esc(clip(`${plant} - ${opCd} / ${orderNo}`, 44)),
    DT:     esc(clip(printDt, 19)),
    SIZE:   esc(clip(size, 8)),
    QTY:    esc(clip(String(qty ?? ""), 5)),
    QR:     esc(clip(qrText, 160)),
  };

  return {
    HEADER: DISP.HEADER, PROD: DISP.PROD, NEXT: DISP.NEXT,
    MATCODE: DISP.BIG, STYLE: DISP.STYLE, PROCNAME: DISP.PROC,
    FOOTLINE: DISP.FOOT, DT: DISP.DT,
    SIZE: DISP.SIZE, QTY: DISP.QTY,
    QRIMG: src?.QR_IMG ?? "", QRDATA: DISP.QR,
  };
}

/* ===================== PASSCARD HTML/CSS (디자인 유지) ===================== */
const GEOM = {
  PAD_X_CM: 0.26, PAD_LEFT_CM: 0.20, PAD_Y_CM: 0.20, BORDER_PT: 1.2,
  LEFT_W_CM: 7.10, RIGHT_X_CM: 5.60, HEADER_H_CM: 0.60,
  META_H_CM: 0.60, BIG_H_CM: 0.80, STYLE_H_CM: 0.50, PROC_H_CM: 0.65, FOOT_H_CM: 0.65, TIME_H_CM: 0.60,
  META_K1_CM: 1.20, META_V1_CM: 2.65, META_K2_CM: 1.00,
  RIGHT_R1_CM: 0.80, RIGHT_R2_CM: 0.80, RIGHT_R3_CM: 1.40,
};

function makeSpoolToken(){ return `${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function docTitleFor(job:any, token:string){
  const k = keyOf(job);
  const base = `PASSCARD ${k.ORDER_NUMBER}-${k.PCARD_SEQ}`;
  return k.BAR_KEY ? `${base}-${k.BAR_KEY}-${token}` : `${base}-${token}`;
}

function buildPasscardHTML(
  jobs: any[],
  widthUm?: number,
  heightUm?: number,
  withToolbar = false,
  titleOverride?: string,
  skipQrScript = false
) {
  const Wmm = umToMm(widthUm) ?? CURRENT_CFG.widthMM;
  const Hmm = umToMm(heightUm) ?? CURRENT_CFG.heightMM;
  const Wcm = Wmm / 10, Hcm = Hmm / 10;

  const PAD_L_CONF = CURRENT_CFG.padLeftCM ?? (GEOM as any).PAD_LEFT_CM ?? GEOM.PAD_X_CM;
  const PAD_R_CONF = CURRENT_CFG.padRightCM ?? 0.2;
  const RIGHT_IN_CONF = CURRENT_CFG.rightInsetCM ?? 0.15;
  const LINE_W_CONF = CURRENT_CFG.lineWCm ?? 0.03;

  const TOP_DELTA = CURRENT_CFG.topPadDeltaCM ?? 0;
  const PAD_T = Math.max(0, GEOM.PAD_Y_CM + TOP_DELTA);
  const PAD_B = GEOM.PAD_Y_CM;
  const SHIFT_Y = CURRENT_CFG.topShiftCM ?? 0;

  const R1 = GEOM.RIGHT_R1_CM, R2 = GEOM.RIGHT_R2_CM;
  const compCm = Math.max(0, (CURRENT_CFG.feedCompMM ?? 0) / 10);
  const R3eff = Math.max(0.30, GEOM.RIGHT_R3_CM - compCm);
  const RIGHT_TOTAL = R1 + R2 + R3eff;

  const LEFT_OTHERS = GEOM.BIG_H_CM + GEOM.STYLE_H_CM + GEOM.PROC_H_CM + GEOM.FOOT_H_CM;
  const TIME_CM = Math.max(0.1, +(RIGHT_TOTAL - LEFT_OTHERS).toFixed(3));

  const PAD_L = PAD_L_CONF;
  const PAD_R = PAD_R_CONF || ((GEOM as any).PAD_RIGHT_CM ?? GEOM.PAD_X_CM);

  const pages = jobs.map((raw) => {
    const j = makeLabelModel(raw);
    const META_V2_CM = Math.max(0.1, GEOM.LEFT_W_CM - (GEOM.META_K1_CM + GEOM.META_V1_CM + GEOM.META_K2_CM));
    return `
    <section class="pc" aria-label="passcard ${Wmm}x${Hmm}">
      <style>
        @page { size: ${Wcm}cm ${Hcm}cm; margin:0; }
        html, body { margin:0; padding:0; }
        :root{
          --W:${Wcm}cm; --H:${Hcm}cm;
          --pl:${PAD_L}cm; --pr:${PAD_R}cm;
          --pt:${PAD_T}cm; --pb:${PAD_B}cm;
          --shiftY:${SHIFT_Y}cm;

          --bpt:${GEOM.BORDER_PT}pt; --rx:${GEOM.RIGHT_X_CM}cm;
          --head:${GEOM.HEADER_H_CM}cm;
          --meta:${GEOM.META_H_CM}cm; --big:${GEOM.BIG_H_CM}cm; --style:${GEOM.STYLE_H_CM}cm;
          --proc:${GEOM.PROC_H_CM}cm; --foot:${GEOM.FOOT_H_CM}cm; --time:${TIME_CM}cm;
          --k1:${GEOM.META_K1_CM}cm; --v1:${GEOM.META_V1_CM}cm; --k2:${GEOM.META_K2_CM}cm;
          --metaV2:${META_V2_CM.toFixed(3)}cm;
          --r1:${R1}cm; --r2:${R2}cm; --r3:${R3eff}cm;
          --rtotal:${RIGHT_TOTAL}cm;
          --over:0.02cm;
          --rin:${RIGHT_IN_CONF}cm;
          --linew:${LINE_W_CONF}cm;
        }

        .pc{ position:relative; width:var(--W); height:var(--H); box-sizing:border-box; border:var(--bpt) solid transparent;
             padding:var(--pt) var(--pr) var(--pb) var(--pl);
             font-family:"Arial Narrow", Arial, "Malgun Gothic","맑은 고딕",sans-serif;
             -webkit-print-color-adjust:exact; print-color-adjust:exact; overflow:visible; break-after: page; page-break-after: always; }
        .zbox{ position:absolute; left:var(--pl); width:calc(100% - var(--pl) - var(--pr)); box-sizing:border-box; }
        .z-header{ top:calc(var(--pt) + var(--shiftY)); height:var(--head); border:var(--bpt) solid #000; border-right:none; display:flex; align-items:center; justify-content:center; font-weight:710; font-size:12pt; }
        .z-meta{ top:calc(var(--pt) + var(--head) + var(--shiftY)); height:var(--meta); border-left:var(--bpt) solid #000; border-bottom:var(--bpt) solid #000; border-right:none; }
        .meta-grid{ height:100%; display:grid; grid-template-columns: var(--k1) var(--v1) var(--k2) var(--metaV2); }
        .meta-grid > *{ display:flex; align-items:center; justify-content:center; font-weight:700; }
        .meta-grid .k{ font-size:10pt; }
        .meta-grid .v{ font-size:10pt; justify-content:flex-start; padding:0 .12cm; }
        .meta-grid > :not(:first-child){ border-left:var(--bpt) solid #000; }
        .z-bodyL{ top:calc(var(--pt) + var(--head) + var(--meta) + var(--shiftY)); left:var(--pl); width:calc(var(--rx) - var(--pl));
                  height:calc(100% - (var(--pt) + var(--pb) + var(--head) + var(--meta))); }
        .z-bodyL::before{ content:""; position:absolute; left:0; top:calc(0cm - var(--over));
                          height:calc(var(--rtotal) + 2*var(--over));
                          border-left:var(--bpt) solid #000; pointer-events:none; z-index:3; }
        .left-wrap{ position:relative; width:100%; height:100%; display:grid; grid-template-rows: var(--big) var(--style) var(--proc) var(--foot) var(--time); }
        .big{   display:flex; align-items:center; justify-content:center; padding:0 .12cm; font-size:17pt; font-weight:900; }
        .style{ display:flex; align-items:center; justify-content:center; padding:0 .06cm; font-size:8.2pt; }
        .proc{  display:flex; align-items:center; justify-content:center; padding:0 .12cm; font-size:10.8pt; font-weight:800; }
        .foot, .time{ display:flex; align-items:center; justify-content:center; padding:0 .06cm; font-size:8.6pt; }
        .z-bodyR{ top:calc(var(--pt) + var(--head) + var(--meta) + var(--shiftY));
                  left:var(--rx); width:calc(100% - var(--rx) - var(--pr)); height:calc(100% - (var(--pt) + var(--pb) + var(--head) + var(--meta))); }
        .z-bodyR::before{ content:""; position:absolute; left:0; top:calc(0cm - var(--over));
                           height:calc(var(--rtotal) + 2*var(--over));
                           border-left:var(--bpt) solid #000; pointer-events:none; z-index:3; }
        .right-grid{ position:relative; width:100%; height:100%; display:grid; grid-template-rows:var(--r1) var(--r2) var(--r3); }
        .cell{ display:flex; align-items:center; justify-content:center; }
        .size{ border-bottom:var(--bpt) solid #000; }
        .qty { border-bottom:var(--bpt) solid #000; }
        .size .v{ font-size:13.5pt; font-weight:800; }
        .qty  .v{ font-size:13pt;   font-weight:800; }
        .qr{ display:flex; align-items:center; justify-content:center; width:100%; height:100%; padding:0; box-sizing:border-box; }
        .qri{ width:100%; height:100%; object-fit:contain; image-rendering:pixelated; }
        .qrtext{ display:none; }
        @media print { .qrtext{ display:none !important; } }
        .z-bottomline{ position:absolute; left:calc(var(--pl) - var(--over)); width:calc(100% - var(--pl) - var(--pr) + 2*var(--over));
                        top:calc(var(--pt) + var(--head) + var(--meta) + var(--rtotal) + var(--shiftY));
                        height:0; border-top:var(--bpt) solid #000; pointer-events:none; z-index:10; }
        .z-rightline{ position:absolute; right: calc(var(--pr) + var(--rin));
                      top:   calc(var(--pt) - var(--over) + var(--shiftY));
                      height:calc(var(--head) + var(--meta) + var(--rtotal) + 2*var(--over));
                      width: var(--linew); background:#000; pointer-events:none; z-index:12; transform: translateZ(0); }
        @media print { #toolbar{ display:none !important; } }
      </style>

      <div class="zbox z-header">${j.HEADER}</div>
      <div class="zbox z-meta">
        <div class="meta-grid">
          <div class="k">Prod</div><div class="v">${j.PROD}</div>
          <div class="k">Next</div><div class="v">${j.NEXT}</div>
        </div>
      </div>

      <div class="zbox z-bodyL">
        <div class="left-wrap">
          <div class="big">${j.MATCODE}</div>
          <div class="style">${j.STYLE}</div>
          <div class="proc">${j.PROCNAME}</div>
          <div class="foot">${j.FOOTLINE}</div>
          <div class="time">${j.DT}</div>
        </div>
      </div>

      <div class="zbox z-bodyR">
        <div class="right-grid">
          <div class="cell size"><div class="v">${j.SIZE}</div></div>
          <div class="cell qty"><div class="v">${j.QTY}</div></div>
          <div class="cell qr">
            ${ j.QRIMG ? `<img class="qri" src="${j.QRIMG}" alt="QR">` : `<div class="qri" data-qr="${j.QRDATA}"></div>` }
            <div class="qrtext">${j.QRDATA}</div>
          </div>
        </div>
      </div>

      <div class="zbox z-bottomline" aria-hidden="true"></div>
      <div class="z-rightline" aria-hidden="true"></div>
    </section>`;
  }).join("");

  const toolbar = withToolbar ? `
    <div id="toolbar" style="position:fixed;top:10px;right:10px;z-index:9999;display:flex;gap:8px">
      <button id="btnPrint">Print</button><button id="btnClose">Close</button>
    </div>
    <script>
      document.getElementById('btnPrint')?.addEventListener('click',()=>window.print());
      document.getElementById('btnClose')?.addEventListener('click',()=>window.close());
    </script>` : "";

  // 매우 경량화된 내장 QR(없으면 DataURL 사용)
  const QR_SCRIPT = `
    <script>(function(){
      function BitBuffer(){this.buffer=[];this.length=0}
      BitBuffer.prototype.put=function(num,len){for(var i=0;i<len;i++)this.putBit(((num>>(len-i-1))&1)==1)}
      BitBuffer.prototype.putBit=function(bit){var idx=this.length>>3; if(this.buffer.length<=idx)this.buffer.push(0); if(bit)this.buffer[idx]|=(128>>(this.length%8)); this.length++}
      function QR(data){this.n=33;this.modules=[...Array(this.n)].map(()=>Array(this.n).fill(false));this.data=data}
      QR.prototype.make=function(){
        var bb=new BitBuffer(), d=this.data; bb.put(4,4); bb.put(d.length,8); for(var i=0;i<d.length;i++) bb.put(d.charCodeAt(i),8);
        bb.put(0,4); while(bb.length%8) bb.putBit(false); while(bb.length< this.n*this.n){ bb.put(0xec,8); if(bb.length< this.n*this.n) bb.put(0x11,8); }
        var inc=-1,row=this.n-1,bit=0,byte=0; for(var col=this.n-1; col>0; col-=2){ if(col==6) col--; while(true){ for(var c=0;c<2;c++){ var dark=false; if(byte<bb.buffer.length){ dark=((bb.buffer[byte]>>(7-(bit%8)))&1)==1; bit++; if(bit%8==0) byte++; } this.modules[row][col-c]=dark; } row+=inc; if(row<0||this.n<=row){row-=inc; inc=-inc; break;} } }
      }
      QR.prototype.drawTo=function(el){
        var s=Math.min(el.clientWidth||120, el.clientHeight||120), n=this.n, cs=Math.max(2, Math.floor(s/n));
        var c=document.createElement('canvas'); c.width=c.height=cs*n; var g=c.getContext('2d'); g.fillStyle='#000'; g.imageSmoothingEnabled=false;
        for(var r=0;r<n;r++)for(var c2=0;c2<n;c2++) if(this.modules[r][c2]) g.fillRect(c2*cs,r*cs,cs,cs);
        c.style.width='100%'; c.style.height='100%';
        el.innerHTML=''; el.appendChild(c);
      }
      function boot(){ var nodes=document.querySelectorAll('.qri[data-qr]'); for(var i=0;i<nodes.length;i++){ var el=nodes[i], text=el.getAttribute('data-qr')||''; if(!text) continue; var q=new QR(text); q.make(); q.drawTo(el); } }
      if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    })();</script>`;

  const titleText = titleOverride || "PASSCARD";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titleText)}</title></head><body>${toolbar}${pages}${skipQrScript ? "" : QR_SCRIPT}</body></html>`;
}

/* ===================== QR(DataMatrix) 사전생성 (있으면 사용, 없으면 내장 QR) ===================== */
async function ensureQrImages(jobs: any[]) {
  let BWIP: any = null;
  try { BWIP = await import("bwip-js"); } catch {}
  const scale = Math.max(1, Math.floor(CURRENT_CFG.qrScale ?? 5));
  const pad   = Math.max(0, Math.floor(CURRENT_CFG.qrMargin ?? 0));

  const out: any[] = [];
  for (const j of jobs) {
    const model = makeLabelModel(j);
    if (!model.QRDATA) { out.push(j); continue; }
    if ((j && j.QR_IMG) || (j && j.QRIMG)) { out.push(j); continue; }

    if (BWIP && typeof BWIP.toBuffer === "function") {
      try {
        const png: Buffer = await BWIP.toBuffer({
          bcid: 'datamatrix',
          text: model.QRDATA,
          scale,
          paddingwidth: pad,
          paddingheight: pad,
        });
        const dataUrl = 'data:image/png;base64,' + png.toString('base64');
        out.push({ ...j, QR_IMG: dataUrl });
        continue;
      } catch (e) {
        console.warn("[print:dm] bwip-js datamatrix render failed, fallback to inline:", e);
      }
    }
    out.push(j);
  }
  return out;
}

/* ===================== 로딩 대기 (최소 프레임) ===================== */
function whenReadyToPrint(win: Electron.BrowserWindow, timeoutMs = 2500) {
  return new Promise<void>((resolve, reject) => {
    let done = false;
    const ok = () => { if (!done) { done = true; resolve(); } };
    const fail = (m: string) => { if (!done) { done = true; reject(new Error(m)); } };
    const to = setTimeout(() => fail("load timeout"), timeoutMs);

    const js = `
      new Promise((res) => {
        const ready = () => {
          requestAnimationFrame(() => requestAnimationFrame(res));
        };
        if (document.readyState === 'complete') ready();
        else window.addEventListener('load', ready, { once: true });
      });
    `;
    win.webContents.executeJavaScript(js, true).then(() => {
      clearTimeout(to);
      ok();
    }).catch((e:any) => {
      clearTimeout(to);
      fail(String(e));
    });
  });
}

/* ===================== 페이지 크기 ===================== */
function getConfiguredPageSizeUm(over?: { widthMicrons?: number; heightMicrons?: number }) {
  // 클램핑 제거(요청): 설정/옵션 그대로 사용
  const size = {
    width:  over?.widthMicrons  ?? mmToMicrons(CURRENT_CFG.widthMM),
    height: over?.heightMicrons ?? mmToMicrons(CURRENT_CFG.heightMM),
  };
  relayPasscardLog("PAGE_SIZE", {
    um: size,
    mm: { w: (size.width/1000), h: (size.height/1000) },
    from: CONFIG_SRC ?? "(default)"
  }, "info");
  return size;
}

/* ===================== 옵션 병합(핵심 패치) ===================== */
type BatchOptions = { deviceName?: string; preview?: boolean; widthMicrons?: number; heightMicrons?: number; };

// 반환 타입: deviceName은 optional, 나머지는 필수
type MergedBatchOptions = {
  deviceName?: string;
  preview: boolean;
  widthMicrons: number;
  heightMicrons: number;
};

function mergeOptions(partial?: BatchOptions): MergedBatchOptions {
  const cfg = CURRENT_CFG;
  // page size는 cfg에서 mm → um으로 파생, partial가 있으면 그대로 존중
  const widthMicrons  = typeof partial?.widthMicrons  === "number" ? partial.widthMicrons  : mmToMicrons(cfg.widthMM);
  const heightMicrons = typeof partial?.heightMicrons === "number" ? partial.heightMicrons : mmToMicrons(cfg.heightMM);
  return {
    deviceName: partial?.deviceName ?? cfg.deviceName ?? undefined,
    preview: typeof partial?.preview === "boolean" ? partial.preview : !!cfg.preview,
    widthMicrons,
    heightMicrons,
  };
}

/* ===================== 배치 인쇄 (FAST) ===================== */
async function doBatchPrintAsync(
  jobs: any[],
  optionsIn: BatchOptions,
  notify?: { wcId?: number; batchId?: string }
) {
  const merged = mergeOptions(optionsIn);
  const batchId = notify?.batchId || `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

  const send = (channel: string, payload: any) => {
    if (!notify?.wcId) return;
    try { webContents.fromId(notify.wcId)?.send(channel, payload); } catch {}
  };

  const preview = merged.preview;
  const pageSizeUm = getConfiguredPageSizeUm({ widthMicrons: merged.widthMicrons, heightMicrons: merged.heightMicrons });
  const resolvedDeviceNameOnce = await resolvePrinterName(merged.deviceName);

  relayPasscardLog("BATCH_START_FAST", {
    batchId,
    jobsCount: Array.isArray(jobs) ? jobs.length : -1,
    preview,
    cfg: { deviceName: CURRENT_CFG.deviceName, widthMM: CURRENT_CFG.widthMM, heightMM: CURRENT_CFG.heightMM },
    printer: { requested: merged.deviceName ?? CURRENT_CFG.deviceName, resolved: resolvedDeviceNameOnce ?? "*(system default)*" }
  }, "info");

  const printWith = (win: Electron.BrowserWindow, opts: PrintOptions) =>
    new Promise<void>((resolve, reject) => {
      win.webContents.print(opts, (ok, err) => ok ? resolve() : reject(new Error(err || "print failed")));
    });

  const perResults: Array<{ index:number; key: ReturnType<typeof keyOf>; ok?:boolean; error?:string; preview?:boolean }> = [];

  // ── 미리보기 모드
  if (preview) {
    const jobsWithQr = await ensureQrImages(jobs);
    const html = buildPasscardHTML(jobsWithQr, pageSizeUm.width, pageSizeUm.height, true);
    const dataUrl = "data:text/html;charset=UTF-8," + encodeURIComponent(html);

    const win = new BrowserWindow({
      width: 900, height: 700, show: true, autoHideMenuBar: true,
      webPreferences: { sandbox: false, backgroundThrottling: false, spellcheck: false }
    });
    HOLD.add(win); win.on("closed", () => HOLD.delete(win));

    try {
      await win.loadURL(dataUrl);
      await whenReadyToPrint(win);
      await win.webContents.setZoomFactor(CURRENT_CFG.previewZoom ?? 1.00);

      const base: PrintOptions = {
        silent: false,
        printBackground: true,
        pageSize: pageSizeUm,
        margins: { marginType: "custom", top: 0, right: 0, bottom: 0, left: 0 },
        ...(resolvedDeviceNameOnce ? { deviceName: resolvedDeviceNameOnce } : {}),
      };

      relayPasscardLog("PRINT_OPTS_PREVIEW", { pageSizeUm, deviceName: resolvedDeviceNameOnce ?? "(default)", batchId }, "info");
      try {
        await printWith(win, base);
      } catch (e: any) {
        relayPasscardLog("PRINT_FALLBACK_NODEVICE_PREVIEW", { error: String(e), batchId }, "warn");
        const { deviceName, ...noDev } = base as any;
        await printWith(win, noDev);
      }
    } catch (e) {
      relayPasscardLog("ERROR", { where: "preview", error: String(e), batchId }, "error");
    } finally {
      if (!win.isDestroyed()) win.close();
    }

    const cntInc = CURRENT_CFG.previewCountAsPrint ? 1 : 0;
    for (const [idx, job] of jobs.entries()) {
      const key = keyOf(job);
      await markPrintResult(job, true, undefined, undefined, { stateHint: "SUCCESS", deviceName: resolvedDeviceNameOnce, cntInc });
      perResults.push({ index: idx, key, ok: true, preview: true });
      send(CHANNEL_JOB, { batchId, index: idx, key, ok: true, preview: true });
    }
    send(CHANNEL_DONE, { batchId, total: jobs.length, okCount: jobs.length, pendCount: 0, failCount: 0, results: perResults });
    return;
  }

  // 프린터 지정했는데 매칭 실패 시 즉시 실패
  if (merged.deviceName && !resolvedDeviceNameOnce) {
    for (const [idx, job] of jobs.entries()) {
      const key = keyOf(job);
      await markPrintResult(job, false, "PRINTER_NOT_FOUND", "지정 프린터를 찾을 수 없습니다.", { stateHint: "ERROR", deviceName: undefined, cntInc: 0 });
      perResults.push({ index: idx, key, ok: false, error: "PRINTER_NOT_FOUND: 지정 프린터를 찾을 수 없습니다." });
      send(CHANNEL_JOB, { batchId, index: idx, key, ok: false, error: "PRINTER_NOT_FOUND" });
    }
    send(CHANNEL_DONE, { batchId, total: perResults.length, okCount: 0, pendCount: 0, failCount: perResults.length, results: perResults });
    return;
  }

  // === 빠른 전송 모드: 전송 즉시 OK 처리 ===
  const jobsWithQrAll = await ensureQrImages(jobs);
  const printWin = await getPrintWin();
  const pageCntInc = 1; // silent 인쇄는 카운트 +1

  for (const [idx, job] of jobsWithQrAll.entries()) {
    const token = makeSpoolToken();
    const docTitle = docTitleFor(job, token);
    const oneHtml = buildPasscardHTML([job], pageSizeUm.width, pageSizeUm.height, false, docTitle);

    const key = keyOf(job);

    try {
      await printWin.webContents.executeJavaScript(
        'document.open();document.write(' + JSON.stringify(oneHtml) + ');document.close();',
        true
      );
      await whenReadyToPrint(printWin);

      // 시작 알림(정보용, 상태는 PRINTING)
      await markPrintStart(job, resolvedDeviceNameOnce, "PRINTING");

      const baseSilent: PrintOptions = {
        silent: true,
        printBackground: true,
        pageSize: pageSizeUm,
        margins: { marginType: "custom", top: 0, right: 0, bottom: 0, left: 0 },
        ...(resolvedDeviceNameOnce ? { deviceName: resolvedDeviceNameOnce } : {}),
      };

      relayPasscardLog("PRINT_OPTS_SILENT_FAST", { index: idx, pageSizeUm, deviceName: resolvedDeviceNameOnce ?? "(default)", docTitle, batchId }, "info");

      // 전송
      try {
        await new Promise<void>((resolve, reject) => {
          printWin.webContents.print(baseSilent, (ok, err) => ok ? resolve() : reject(new Error(err || "print failed")));
        });
      } catch (e1) {
        relayPasscardLog("PRINT_FALLBACK_MARGINS_NONE_FAST", { index: idx, error: String(e1), batchId }, "warn");
        try {
          await new Promise<void>((resolve, reject) => {
            printWin.webContents.print(
              { ...baseSilent, margins: { marginType: "none" } },
              (ok, err) => (ok ? resolve() : reject(new Error(err || "print failed")))
            );
          });
        } catch (e2) {
          relayPasscardLog("PRINT_FALLBACK_NODEVICE_FAST", { index: idx, error: String(e2), batchId }, "warn");
          const { deviceName, ...noDev } = baseSilent as any;
          try {
            await new Promise<void>((resolve, reject) => {
              printWin.webContents.print(
                { ...noDev, margins: { marginType: "none" } },
                (ok, err) => (ok ? resolve() : reject(new Error(err || "print failed")))
              );
            });
          } catch (e3) {
            // 전송 자체 실패 → 실패 기록
            await markPrintResult(job, false, "PRINT_ERROR", String((e3 as any)?.message || e3), { stateHint: "ERROR", deviceName: resolvedDeviceNameOnce, cntInc: 0 });
            perResults.push({ index: idx, key, ok: false, error: "PRINT_ERROR" });
            webContents.getAllWebContents().forEach(wc => wc.send(CHANNEL_JOB, { batchId, index: idx, key, ok: false, error: "PRINT_ERROR" }));
            continue;
          }
        }
      }

      // 전송 성공 = 즉시 성공 처리
      await markPrintResult(job, true, undefined, undefined, { stateHint: "SUCCESS", deviceName: resolvedDeviceNameOnce, cntInc: pageCntInc });
      perResults.push({ index: idx, key, ok: true });
      webContents.getAllWebContents().forEach(wc => wc.send(CHANNEL_JOB, { batchId, index: idx, key, ok: true }));

      // 과도 큐 적체 방지
      await sleep(10);

    } catch (e) {
      relayPasscardLog("ERROR", { where: "silent-fast", index: idx, error: String(e), batchId }, "error");
      await markPrintResult(job, false, "LOAD_OR_PRINT_ERROR", String(e), { stateHint: "ERROR", deviceName: resolvedDeviceNameOnce, cntInc: 0 });
      perResults.push({ index: idx, key, ok: false, error: "LOAD_OR_PRINT_ERROR" });
      webContents.getAllWebContents().forEach(wc => wc.send(CHANNEL_JOB, { batchId, index: idx, key, ok: false, error: "LOAD_OR_PRINT_ERROR" }));
    }
  }

  const okCount   = perResults.filter(r => r.ok).length;
  const failCount = perResults.length - okCount;

  send(CHANNEL_DONE, {
    batchId,
    total: perResults.length,
    okCount,
    pendCount: 0,
    failCount,
    results: perResults
  });
}

/* ===================== 단일 프린트 (FAST) ===================== */
ipcMain.handle("epcard:print", async (e, args: PrintArgs) => {
  // 단일 프린트도 기본 옵션 자동 병합 적용
  const merged = mergeOptions({
    deviceName: args?.deviceName,
    preview: typeof args?.preview === "boolean" ? args.preview : undefined,
    widthMicrons: args?.pageSize ? mmToMicrons(args.pageSize.widthMM) : undefined,
    heightMicrons: args?.pageSize ? mmToMicrons(args.pageSize.heightMM) : undefined,
  });

  setImmediate(async () => {
    const win = new BrowserWindow({
      width: 900, height: 700, show: true, autoHideMenuBar: true,
      webPreferences: { sandbox: false, backgroundThrottling: false, spellcheck: false }
    });
    HOLD.add(win); win.on("closed", () => HOLD.delete(win));
    try {
      const targetUrl = args?.url || e.sender.getURL();
      const resolvedDeviceName = await resolvePrinterName(merged.deviceName);
      await win.loadURL(targetUrl);
      await whenReadyToPrint(win);
      await win.webContents.setZoomFactor(merged.preview ? (CURRENT_CFG.previewZoom ?? 1.00) : 1);

      const pageSizeUm = getConfiguredPageSizeUm({ widthMicrons: merged.widthMicrons, heightMicrons: merged.heightMicrons });
      const opts: PrintOptions = {
        silent: !merged.preview,
        printBackground: true,
        pageSize: pageSizeUm,
        margins: { marginType: "custom", top: 0, right: 0, bottom: 0, left: 0 },
        ...(resolvedDeviceName ? { deviceName: resolvedDeviceName } : {}),
      };

      relayPasscardLog("PRINT_OPTS_SINGLE_FAST", {
        mode: merged.preview ? "preview" : "silent",
        pageSizeUm, deviceName: resolvedDeviceName ?? "(default)", url: targetUrl
      }, "info");

      await new Promise<void>((resolve, reject) => {
        win.webContents.print(opts, (ok, err) => ok ? resolve() : reject(new Error(err || "print failed")));
      });

      await sleep(300);
      if (!merged.preview && !win.isDestroyed()) win.close();
    } catch (e) {
      relayPasscardLog("ERROR", { where: "single-fast", error: String(e) }, "error");
      if (!win.isDestroyed()) win.close();
    }
  });
  return { ok: true, accepted: 1, mode: (args?.preview ?? CURRENT_CFG.preview) ? "preview" : "silent" };
});

/* ===================== 배치 IPC/목록/컨피그 ===================== */
function parseJobs(payloadOrList: any, maybeOptions?: any) {
  const isNew = payloadOrList && typeof payloadOrList === "object" && "jobs" in payloadOrList;
  const jobs: any[] = isNew ? (payloadOrList.jobs || []) : (payloadOrList || []);
  const options = isNew ? (payloadOrList.options || {}) : (maybeOptions || {});
  return { jobs, options, batchId: (payloadOrList && payloadOrList.batchId) || undefined };
}

ipcMain.handle("print:passcards", async (e, payloadOrList: any, maybeOptions?: any) => {
  const { jobs, options, batchId } = parseJobs(payloadOrList, maybeOptions);
  const merged = mergeOptions(options); // ★ 기본 옵션 자동 병합
  relayPasscardLog("IPC print:passcards FAST", {
    accepted: Array.isArray(jobs) ? jobs.length : 0,
    preview: merged.preview,
    batchId: batchId ?? "(auto)"
  }, "info");

  setImmediate(() => { void doBatchPrintAsync(jobs, merged, { wcId: e.sender.id, batchId }); });

  return {
    ok: true,
    accepted: Array.isArray(jobs) ? jobs.length : 0,
    mode: merged.preview ? "preview" : "silent",
    batchId: batchId ?? undefined
  };
});

ipcMain.handle("passcard:print-batch", async (_e, payloadOrList: any, maybeOptions?: any) => {
  const { jobs, options, batchId } = parseJobs(payloadOrList, maybeOptions);
  const merged = mergeOptions(options); // ★ 기본 옵션 자동 병합
  relayPasscardLog("IPC passcard:print-batch FAST", { accepted: Array.isArray(jobs) ? jobs.length : 0, preview: merged.preview, batchId: batchId ?? "(auto)" }, "info");
  setImmediate(() => { void doBatchPrintAsync(jobs, merged, { batchId }); });
  return { ok: true, accepted: Array.isArray(jobs) ? jobs.length : 0, mode: merged.preview ? "preview" : "silent", batchId: batchId ?? undefined };
});

ipcMain.handle("print:diag", async (_e, deviceName?: string) => {
  const merged = mergeOptions({ deviceName });
  const resolved = await resolvePrinterName(merged.deviceName);
  const w = new BrowserWindow({ width: 380, height: 220, show: true, autoHideMenuBar: true, webPreferences: { spellcheck: false } });
  HOLD.add(w); w.on("closed", () => HOLD.delete(w));
  const html = `<!doctype html><meta charset="utf-8"><pre>DIAG ${new Date().toLocaleString()}</pre>`;
  await w.loadURL("data:text/html;charset=UTF-8," + encodeURIComponent(html));
  await whenReadyToPrint(w);
  setTimeout(() => {
    w.webContents.print(
      { silent: false, deviceName: resolved, printBackground: true, margins: { marginType: "custom", top:0, right:0, bottom:0, left:0 } },
      () => {}
    );
  }, 200);
  return { ok: true, device: resolved ?? "(default)" };
});

ipcMain.handle("print:list", async () => listPrinters());

ipcMain.handle("print:config-info", async () => ({
  ok: true,
  file: CONFIG_SRC ?? "(default)",
  cfg: CURRENT_CFG,
  API_BASE
}));

ipcMain.handle("print:config-reload", async () => {
  const next = loadConfigFromFile();
  if (next) {
    CURRENT_CFG = next;
    refreshApiBase();
    relayPasscardLog(
      "CONFIG reloaded (manual)",
      { from: CONFIG_SRC, cfg: CURRENT_CFG, API_BASE },
      "info"
    );

    return {
      ok: true,
      file: CONFIG_SRC,
      cfg: CURRENT_CFG,
      API_BASE,
    };
  }
  return {
    ok: false,
    error: "No config file found",
    file: CONFIG_SRC,
    API_BASE,
  };
});
