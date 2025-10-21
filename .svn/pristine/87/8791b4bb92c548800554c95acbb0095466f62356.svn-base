// sap.js — XML 기반 SAP 설정 + API_BASE 관리 (최종본, ESM)

import axios from "axios";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import * as cfg from "../shared/config.js"; // PLANT 등 기존 구성 사용

/* ===================== 경로 유틸 ===================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isDevMode() {
  // electron-vite / 일반 node 모두 대응
  const isPackaged =
    process.env.ELECTRON_IS_DEV === "0" || process.defaultApp === undefined;
  return !isPackaged || process.env.NODE_ENV === "development";
}

function getConfigPath() {
  return isDevMode()
    ? path.resolve(__dirname, "../../public/Config.xml")
    : path.join(process.resourcesPath, "public", "Config.xml");
}

const CONFIG_XML = getConfigPath();

/* ===================== XML 파싱 ===================== */

function readXmlSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const xml = fs.readFileSync(filePath, "utf-8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
    });
    return parser.parse(xml);
  } catch (e) {
    console.warn("[SAP] XML read/parse failed:", e?.message || e);
    return null;
  }
}

function loadSapFromXml() {
  const json = readXmlSafe(CONFIG_XML);
  const sap = json?.SETTING?.SAP;
  const common = json?.SETTING?.Common || json?.SETTING?.COMMON || {};

  if (!sap) return null;

  const norm = (v, d = "") => (typeof v === "string" ? v.trim() : v ?? d);

  const apiBase = norm(sap.API_BASE, "https://api.us20.dmc.cloud.sap").replace(
    /\/+$/,
    ""
  );

  return {
    tokenUrl: norm(sap.TOKEN_URL, ""),
    clientId: norm(sap.CLIENT_ID, ""),
    clientSecret: norm(sap.CLIENT_SECRET, ""),
    apiBase,
    plant:
      norm(sap.PLANT, "") ||
      norm(common.PLANT_CD, "") ||
      norm(common.PLANT, "") ||
      (cfg?.PLANT ?? ""),
  };
}

/* ===================== 설정 조립 ===================== */

let xmlSap = loadSapFromXml() || {};
let API_BASE = xmlSap.apiBase || "https://api.us20.dmc.cloud.sap";
let PLANT = xmlSap.plant || (cfg?.PLANT ?? "");

const api = (p) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

function buildSAPConfig() {
  return {
    // 🔐 토큰 설정 (XML 우선)
    tokenUrl: xmlSap.tokenUrl || "",
    clientId: xmlSap.clientId || "",
    clientSecret: xmlSap.clientSecret || "",

    // ✅ API_BASE 적용된 엔드포인트들
    acceptUrl: api("/logistics/v1/execution/acceptLogisticsOrder"),
    confirmUrl: api("/logistics/v1/execution/confirmLogisticsOrder"),
    pickUrl: api("/logistics/v1/execution/pickLogisticsOrder"),

    SFC_START_API: api("/sfc/v1/sfcs/start"),
    SFC_CONFIRM_API: api("/sfc/v1/sfcs/complete"),
    POST_ASSEMBLED_COMPONENT_API: api("/assembly/v1/assembledComponents"),
    POST_ASSEMBLED_COMPONENT_AUTO_API: api("/assembly/v1/autoAssemble"),
    SFC_DETAIL_API: api("/sfc/v1/sfcdetail"),
    ROUTING_API: api("/routing/v1/routings"),
    BOM_API: api("/bom/v1/boms"),
    ASSEMBLE_COMPLETED: api("/assembly/v1/assembledComponents"),
    INVENTORIES_API: api("/inventory/v1/inventories"),
    GOODS_ISSUE_I_API: api("/processorder/v1/goodsissue"),
    GOODS_ISSUE_Q_API: api("/inventory/v1/inventory/goodsIssues"),
    GOODSRECEIPTS_API_Q: api("/inventory/v1/inventory/goodsReceipts"),
    GOODSRECEIPTS_API_I: api("/inventory/v1/inventory/erpGoodsReceipts"),
    UNIT_CODE_API: api("/uom/v2/uoms"),
    POST_QTY_CONFIRM: api("/quantityConfirmation/v1/confirm"),
    POST_QTY_FINAL_CONFIRM: api(
      "/quantityConfirmation/v1/reportOperationActivityFinalConfirmation"
    ),
    POST_AUTOCONFIRM: api("/activityConfirmation/v1/autoconfirm"),
    POST_ACTIVITY_CONFIRM: api("/activityConfirmation/v1/confirm"),
    GET_POSTINGS: api("/activityConfirmation/v1/postings/details"),
    CANCEL_GOODSRECEIPTS: api("/inventory/v1/inventory/goodsReceipts/cancel"),
    CANCEL_GOODSISSUE: api("/processorder/v1/goodsissue/cancellations"),
    GET_ORDER_LIST: api("/order/v1/orders/list"),
    POST_ORDER_RELEASE: api("/order/v2/orders/release"),
    PUT_ALTER_RESOURCE: api("/sfc/v1/alternateResource"),
    GET_STANDARDVALUE: api("/standardValue/v1/details"),
    GET_TIMEZONE: api("/plant/v1/plants"),
  };
}

export let SAP_CONFIG = buildSAPConfig();

/** 필요 시 XML 재로딩 & 엔드포인트 재구성 */
export function reloadSapConfig() {
  const next = loadSapFromXml() || {};
  xmlSap = next;
  API_BASE = next.apiBase || API_BASE;
  PLANT = next.plant || PLANT;
  SAP_CONFIG = buildSAPConfig();
  return SAP_CONFIG;
}

/** 현재 설정된 플랜트 코드 조회용 */
export function getPlantCode() {
  return PLANT;
}

/* ===================== 토큰 헬퍼 ===================== */

let accessToken = null;
export function getAccessToken() {
  return accessToken;
}

export async function refreshToken() {
  try {
    if (!SAP_CONFIG.tokenUrl || !SAP_CONFIG.clientId || !SAP_CONFIG.clientSecret) {
      throw new Error(
        "SAP token config missing (TOKEN_URL / CLIENT_ID / CLIENT_SECRET)"
      );
    }
    const rsp = await axios.post(
      SAP_CONFIG.tokenUrl,
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        auth: {
          username: SAP_CONFIG.clientId,
          password: SAP_CONFIG.clientSecret,
        },
      }
    );
    accessToken = rsp.data.access_token;
    console.log(`[TOKEN] refreshed @ ${new Date().toISOString()}`);
    return accessToken;
  } catch (err) {
    accessToken = null;
    console.error("[TOKEN] refresh failed:", err?.message || err);
    throw err;
  }
}

/** ✅ 어디서든 안전하게 토큰을 보장 (동시 갱신 방지 포함) */
let inflight = null;
export async function ensureToken() {
  if (accessToken) return accessToken;
  if (!inflight) inflight = refreshToken().finally(() => (inflight = null));
  await inflight;
  if (!accessToken) throw new Error("ensureToken: failed to acquire SAP token");
  return accessToken;
}
