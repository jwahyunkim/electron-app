import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlexBox,
  Label,
  Button,
  Bar,
  ProgressIndicator,
  Switch
} from "@ui5/webcomponents-react";
import "./index.css";
import { initI18n, t } from "../utils/i18n";
import backIcon from "@renderer/resources/Back-Icon.png";
import { useNavigate } from "react-router-dom";
import { getAxios } from "../utils/api";
import { FixedSizeGrid as Grid } from "react-window";
import "./index.css";   // <= 여기 추가됨

/* ===================== 디버그 공통 ===================== */
const DEBUG = true;
const LOG_MAX = 500;
const tag = (order?: string, sfc?: string) =>
  `[${order ?? ""}${order && sfc ? "/" : ""}${sfc ?? ""}]`;

/** 콘솔 + 화면 로그 동시 기록 (+ 연속 중복 방지) */
type UILogLevel = "info" | "warn" | "error";
type UILogLine = { ts: string; level: UILogLevel; text: string; ctx?: any };

function useUILog(max = LOG_MAX) {
  const [lines, setLines] = useState<UILogLine[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const lastKeyRef = useRef<string>("");

  const push = (level: UILogLevel, text: string, ctx?: any) => {
    const ts = new Date().toLocaleTimeString();
    if (level === "error") console.error(text, ctx ?? "");
    else if (level === "warn") console.warn(text, ctx ?? "");
    else if (DEBUG) console.log(text, ctx ?? "");

    // 연속 중복 방지: 같은 내용이 바로 또 들어오면 무시
    const key = `${level}|${text}|${JSON.stringify(ctx ?? "")}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    setLines((prev) => {
      const next = [...prev, { ts, level, text, ctx }];
      if (next.length > max) next.splice(0, next.length - max);
      return next;
    });
    setTimeout(() => {
      if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }, 0);
  };

  return { lines, push, boxRef };
}

/* ===================== 타입 ===================== */
interface ComboItem { CODE: string; NAME: string; }

interface SapOrder {
  order: string;
  plant: string;
  material?: { material: string; version: string; description?: string };
  bom?: { bom: string; version: string; type?: string };
  routing?: { routing: string; version: string; routingType?: string };
  orderType?: string;
  orderCategory?: string;
  status?: string;
  releaseStatus?: string;
  executionStatus?: string;
  productionQuantity?: number;
  productionUnitOfMeasure?: string;
  buildQuantity?: number;
  orderedQuantity?: number;
  releasedQuantity?: number;
  doneQuantity?: number;
  goodsReceiptQuantity?: number;
  priority?: string;
  plannedStartDate?: string;
  plannedCompletionDate?: string;
  scheduledStartDate?: string;
  scheduledCompletionDate?: string;
  productionVersion?: string;
  putawayStorageLocation?: string;
  erpRoutingGroup?: string;
  warehouseNumber?: string;
  workCenters?: Array<{ workCenterRef?: string; workCenter: string; description?: string }>;
}

interface ReleasedSfc { identifier: string; quantity: number; }
interface OrderReleaseResponse { data?: { sfcs?: ReleasedSfc[] } }

/** INSERT 기반 SFC 체인 입력 */
interface PostTargetRow {
  plant: string;
  workCenter: string;
  orderNumber: string;
  sfc: string;
  qty: number;
  materialCode: string;
  materialVersion?: string;
  storageLocation?: string;
  workDate?: string;
  operation?: string;
  operationVersion?: string;
  stepId?: string;
  routing?: string;
  sfcTotalQty?: number;
}

/* ===== 진행 보드 타입 ===== */
type JobStatus = "대기" | "실행중" | "완료" | "오류";
type JobItem = {
  key: string; // `${order}-${sfc}`
  order: string;
  sfc: string;
  qty: number;
  status: JobStatus;
};

/* ===================== 유틸 ===================== */
const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
) => {
  const results: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
};

const CONCURRENCY_SFC_CHAIN = 8;
const POSTED_BY = "dmc_services_user";

const today = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/* ===================== SAP/DB API 래퍼 (+ 상세 콘솔은 화면 로그도 함께) ===================== */
const callSapStart = async (payload: {
  plant: string; operation: string; resource: string; sfcs: string[]; processLot?: string;
}, uiLog: ReturnType<typeof useUILog>["push"]) => {
  try {
    uiLog("info", `▶️ ${t("app.log.start.request")}`, { op: payload.operation, res: payload.resource, sfcs: payload.sfcs });
    const ax = await getAxios();
    await ax.post("/api/sap-start", payload);
    uiLog("info", `✅ ${t("app.log.start.success")}`, { op: payload.operation, res: payload.resource, sfcCount: payload.sfcs.length });
  } catch (e: any) {
    uiLog("error", `❌ ${t("app.log.start.fail")}`, e?.response?.data || e?.message || e);
    throw e;
  }
};

const fetchSfcDetail = async (plant: string, sfc: string, uiLog: ReturnType<typeof useUILog>["push"]) => {
  try {
    uiLog("info", `🔎 ${t("app.log.sfcDetail.request")}`, { plant, sfc });
    const ax = await getAxios();
    const res = await ax.get("/api/sap/sfc-detail", { params: { plant_cd: plant, sfc } });
    const steps = res?.data?.steps?.length ?? 0;
    const r0 = res?.data?.steps?.[0]?.resource;
    uiLog("info", `✅ ${t("app.log.sfcDetail.success")}`, { steps, firstResource: r0, bom: res?.data?.bom?.bom });
    return res.data;
  } catch (e: any) {
    uiLog("error", `❌ ${t("app.log.sfcDetail.fail")}`, e?.response?.data || e?.message || e);
    return null;
  }
};

const fetchBomBaseUom = async (plant: string, bom?: string, rawType?: string, uiLog?: ReturnType<typeof useUILog>["push"]) => {
  if (!bom || !rawType) return "";
  const type =
    rawType === "SHOPORDERBOM" ? "SHOP_ORDER" :
    rawType === "MASTERBOM"    ? "MASTER" :
    rawType === "SFCBOM"       ? "SFC"    : undefined;
  if (!type) return "";
  try {
    uiLog?.("info", `🔎 ${t("app.log.bomDetail.request")}`, { plant, bom, type });
    const ax = await getAxios();
    const res = await ax.get("/api/sap/bom-detail", { params: { plant, bom, type } });
    const uom = (Array.isArray(res.data) ? res.data[0] : res.data)?.baseUnitOfMeasure || "";
    uiLog?.("info", `✅ ${t("app.log.bomDetail.success")}`, { baseUOM: uom });
    return uom;
  } catch (e: any) {
    uiLog?.("warn", `❌ ${t("app.log.bomDetail.fail")}`, e?.response?.data || e?.message || e);
    return "";
  }
};

const fetchUom = async (unitCode: string, uiLog?: ReturnType<typeof useUILog>["push"]) => {
  if (!unitCode) return { unitCode: "EA", isoCode: "EA", internalCode: "EA", commercialCodes: [] as any[] };
  try {
    uiLog?.("info", `🔎 ${t("app.log.uom.request")}`, { unitCode });
    const ax = await getAxios();
    const res = await ax.get("/api/sap/unit-codes", { params: { unitCode } });
    const data = Array.isArray(res.data) ? res.data[0] : res.data;
    uiLog?.("info", `✅ ${t("app.log.uom.success")}`, { internal: data?.internalCode, iso: data?.isoCode });
    return data;
  } catch (e: any) {
    uiLog?.("warn", `❌ ${t("app.log.uom.failDefaultEA")}`, e?.response?.data || e?.message || e);
    return { unitCode: "EA", isoCode: "EA", internalCode: "EA", commercialCodes: [] as any[] };
  }
};

const postGoodsReceipt = async (payload: {
  plant: string; order: string; postedBy?: string;
  lineItems: Array<{
    material: string; materialVersion?: string; postingDate: string;
    quantity: { unitOfMeasure: { commercialUnitOfMeasure: string; internalUnitOfMeasure: string; isoUnitOfMeasure: string }; value: number; };
    sfc: string; storageLocation: string;
  }>;
}, uiLog: ReturnType<typeof useUILog>["push"]) => {
  try {
    uiLog("info", `📦 ${t("app.log.gr.request")} ${tag(payload.order, payload.lineItems?.[0]?.sfc)}`,
      { plant: payload.plant, order: payload.order, items: payload.lineItems.map(li => ({ mat: li.material, qty: li.quantity.value, sfc: li.sfc, sloc: li.storageLocation })) });
    const ax = await getAxios();
    const res = await ax.post("/api/sap-goods-receipt", payload, { headers: { "Content-Type": "application/json" } });
    const txIds = (res?.data?.lineItems || [])
      .filter((li: any) => li?.transactionId)
      .map((li: any) => ({ tx: li.transactionId, hasError: !!li?.hasError }));
    uiLog("info", `✅ ${t("app.log.gr.response")}`, { txIds });
    return res.data;
  } catch (e: any) {
    uiLog("error", `❌ ${t("app.log.gr.fail")}`, e?.response?.data || e?.message || e);
    return null;
  }
};

const fetchPostedGoodsReceipts = async (
  plant: string,
  order: string,
  sfc: string,
  material: string,
  transactionIds: string[],
  uiLog: ReturnType<typeof useUILog>["push"],
  maxRetries = 30,
  delayMs = 1000
): Promise<any[]> => {
  const ax = await getAxios();
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await ax.get("/api/sap/goodsreceipts", { params: { plant, order, sfc, material } });
      const data = res.data as any;
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data?.lineItems)
        ? data.lineItems
        : [];

      const postedOnly = arr.filter((d: any) => d.status === "POSTED_TO_TARGET_SYS");

      if (transactionIds.length > 0) {
        const matched = postedOnly.filter((d: any) => transactionIds.includes(d.transactionId?.trim?.()));
        if (matched.length > 0) {
          uiLog("info", `✅ ${t("app.log.gr.txidMatched", { attempt })}`, matched.map((d: any) => ({
            order: d.order, sfc: d.sfc, txId: d.transactionId, qty: d.quantityInBaseUnit?.value
          })));
          return postedOnly;
        }
        uiLog("info", `⏳ ${t("app.log.gr.txidRetry", { attempt })}`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        uiLog("info", `✅ ${t("app.log.gr.postedAllNoTx", { count: postedOnly.length })}`);
        return postedOnly;
      }
    } catch (err) {
      uiLog("warn", `🚨 ${t("app.log.gr.postedFail", { attempt })}`, err);
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  uiLog("warn", `❌ ${t("app.log.gr.maxRetryExceeded")}`);
  return [];
};

const postQtyConfirm = async (payload: {
  plant: string; shopOrder: string; sfc: string; operationActivity: string; workCenter: string;
  yieldQuantity: number; yieldQuantityUnit: string; yieldQuantityIsoUnit: string; isFinalConfirmation: boolean;
}, uiLog: ReturnType<typeof useUILog>["push"]) => {
  try {
    uiLog("info", `🧮 ${t("app.log.qty.request")} ${tag(payload.shopOrder, payload.sfc)}`, {
      op: payload.operationActivity, wc: payload.workCenter, qty: payload.yieldQuantity, final: payload.isFinalConfirmation
    });
    const ax = await getAxios();
    await ax.post("/api/sap-post-qty-confirm", payload);
    uiLog("info", `✅ ${t("app.log.qty.success")} ${tag(payload.shopOrder, payload.sfc)}`);
  } catch (e: any) {
    uiLog("error", `❌ ${t("app.log.qty.fail")}`, e?.response?.data || e?.message || e);
    throw e;
  }
};

const fetchStandardValue = async (params: {
  plant: string; workCenter: string; operationActivity: string; operationActivityVersion: string; object: string; objectType: string; objectVersion: string;
}, uiLog: ReturnType<typeof useUILog>["push"]) => {
  try {
    uiLog("info", `🔎 ${t("app.log.stdTime.request")}`, { op: params.operationActivity, wc: params.workCenter, obj: params.object });
    const ax = await getAxios();
    const res = await ax.get("/api/sap/standard-value", { params });
    const cnt = res?.data?.standardValueCollectionList?.length ?? 0;
    uiLog("info", `✅ ${t("app.log.stdTime.success")}`, { count: cnt });
    return res.data;
  } catch (e: any) {
    uiLog("warn", `❌ ${t("app.log.stdTime.fail")}`, e?.response?.data || e?.message || e);
    return null;
  }
};

const postActivityConfirm = async (payload: {
  plant: string; shopOrder: string; sfc: string; operationActivity: string; stepId: string; workCenter: string;
  activities: Array<{ activityId: string; quantity: number; unitOfMeasure: string; isoUnitOfMeasure: string; postedBy: string; postingDateTime: string }>;
}, uiLog: ReturnType<typeof useUILog>["push"]) => {
  try {
    uiLog("info", `📝 ${t("app.log.activity.request")} ${tag(payload.shopOrder, payload.sfc)}`, {
      op: payload.operationActivity, wc: payload.workCenter, stepId: payload.stepId, actCount: payload.activities.length
    });
    const ax = await getAxios();
    await ax.post("/api/sap-post-activity-confirm", {
      plant: payload.plant,
      shopOrder: payload.shopOrder,
      sfc: payload.sfc,
      operationActivity: payload.operationActivity,
      stepId: payload.stepId,
      workCenter: payload.workCenter,
      finalConfirmation: true,
      allowPostingsAfterOperationActivityComplete: true,
      activities: payload.activities,
    });
    uiLog("info", `✅ ${t("app.log.activity.success")} ${tag(payload.shopOrder, payload.sfc)}`);
  } catch (e: any) {
    uiLog("error", `❌ ${t("app.log.activity.fail")}`, e?.response?.data || e?.message || e);
    throw e;
  }
};

/* ===================== 보강 유틸: operation/resource 해석 ===================== */
const tryFetchRoutingFirstStep = async (plant: string, routingId: string, types: string[], uiLog: ReturnType<typeof useUILog>["push"]) => {
  const ax = await getAxios();
  for (const type of types) {
    try {
      uiLog("info", `🔎 ${t("app.log.routingDetail.request")}`, { plant, routing: routingId, type });
      const res = await ax.get("/api/sap/routing-detail", { params: { plant, routing: routingId, type } });
      const first = Array.isArray(res?.data?.routingSteps) ? res.data.routingSteps[0] : null;
      if (first) {
        uiLog("info", `✅ ${t("app.log.routingDetail.successFirstStep")}`, { operation: first.operationActivity, version: first.operationActivityVersion, stepId: first.stepId });
        return {
          operation: first.operationActivity || "",
          operationVersion: first.operationActivityVersion || "ERP001",
          stepId: first.stepId || ""
        };
      }
    } catch (e: any) {
      uiLog("warn", `⚠️ ${t("app.log.routingDetail.failTryNext")}`, { type, msg: e?.response?.data || e?.message || e });
    }
  }
  return null;
};

const resolveOpAndResource = async (params: {
  plant: string; order: SapOrder; sfc: string; selectedWorkcenter: string; row?: Partial<PostTargetRow>; wcFromOrder?: string;
}, uiLog: ReturnType<typeof useUILog>["push"]) => {
  const { plant, order, sfc, selectedWorkcenter, row, wcFromOrder } = params;
  const sfcDetail = await fetchSfcDetail(plant, sfc, uiLog);
  const step0 = sfcDetail?.steps?.[0] || {};

  let resource = step0?.resource || row?.workCenter || wcFromOrder || selectedWorkcenter || "";
  let operation = row?.operation || step0?.operation?.operation || "";
  let operationVersion = row?.operationVersion || step0?.operation?.version || "ERP001";
  let stepId = row?.stepId || step0?.stepId || "";
  let routing = row?.routing || step0?.stepRouting?.routing || order?.routing?.routing || "";

  uiLog("info", `🧭 ${t("app.log.resolve.pre")} ${tag(order.order, sfc)}`, { operation, stepId, routing, resource });

  if ((!operation || !stepId) && routing) {
    const fb = await tryFetchRoutingFirstStep(plant, routing, [order?.routing?.routingType || "SHOP_ORDER", "SHOP_ORDER", "SFC", "MASTER"], uiLog);
    if (fb) {
      operation = operation || fb.operation;
      operationVersion = operationVersion || fb.operationVersion || "ERP001";
      stepId = stepId || fb.stepId;
    }
  }

  if (!operation && routing) {
    const guess = `${routing}-0-0010`;
    uiLog("warn", t("app.log.resolve.operationGuess"), { guess });
    operation = guess;
  }

  uiLog("info", `🧭 ${t("app.log.resolve.post")} ${tag(order.order, sfc)}`, { operation, stepId, routing, resource });
  return { sfcDetail, operation, operationVersion, stepId, routing, resource };
};

/* ===================== 가상 스크롤 유틸/컴포넌트 ===================== */
function useMeasureWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** 주어진 컨테이너의 화면 내 위치를 기준으로 "가용 높이" 동적 계산 */
function useAvailableHeight<T extends HTMLElement>(minHeight = 360, marginBottom = 16) {
  const ref = useRef<T | null>(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    const calc = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = Math.max(minHeight, Math.floor(window.innerHeight - rect.top - marginBottom));
      setHeight(h);
    };
    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("scroll", calc, { passive: true });
    return () => {
      window.removeEventListener("resize", calc);
      window.removeEventListener("scroll", calc as any);
    };
  }, [minHeight, marginBottom]);

  return [ref, height] as const;
}

const CARD_W = 260;
const CARD_H = 110;
const GAP = 8;

function statusKeyFromLabel(s: JobStatus) {
  switch (s) {
    case "대기": return "waiting";
    case "실행중": return "running";
    case "완료": return "done";
    case "오류": return "error";
    default: return "waiting";
  }
}

function JobCard({ j }: { j: JobItem }) {
  const color =
    j.status === "완료" ? "#def7ec" :
    j.status === "오류" ? "#fde2e2" :
    j.status === "실행중" ? "#dbeafe" : "#f3f4f6";
  const border =
    j.status === "완료" ? "1px solid #10b981" :
    j.status === "오류" ? "1px solid #ef4444" :
    j.status === "실행중" ? "1px solid #2563eb" : "1px solid #d1d5db";

  const statusKey = statusKeyFromLabel(j.status);
  const statusLabel = t(`app.status.${statusKey}`);

  return (
    <div style={{ background: color, border, borderRadius: 8, padding: 10, height: "100%" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{j.order}</div>
      <div style={{ fontFamily: "monospace", fontSize: 14, marginBottom: 4 }}>{j.sfc}</div>
      <div style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}>
        <span>{t("app.common.qtyShort")}: {j.qty}</span>
        <span>
          {statusKey === "running" && "⏳"}
          {statusKey === "done" && "✅"}
          {statusKey === "error" && "❌"}
          {statusKey === "waiting" && "🟦"} {statusLabel}
        </span>
      </div>
    </div>
  );
}

function VirtualJobGrid({ jobs, height }: { jobs: JobItem[]; height: number }) {
  const [wrapRef, wrapWidth] = useMeasureWidth<HTMLDivElement>();
  const colCount = Math.max(1, Math.floor((wrapWidth + GAP) / (CARD_W + GAP)));
  const rowCount = Math.ceil(jobs.length / colCount);
  const itemData = useMemo(() => ({ jobs, colCount }), [jobs, colCount]);

  const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
    const { jobs, colCount } = data;
    const index = rowIndex * colCount + columnIndex;
    if (index >= jobs.length) return null;
    const j: JobItem = jobs[index];
    return (
      <div
        style={{
          ...style,
          left: (style.left as number) + GAP,
          top: (style.top as number) + GAP,
          width: CARD_W,
          height: CARD_H,
        }}
      >
        <JobCard j={j} />
      </div>
    );
  };

  return (
    <div ref={wrapRef} style={{ height, border: "1px solid #eee", borderRadius: 8 }}>
      <Grid
        columnCount={colCount}
        columnWidth={CARD_W + GAP}
        height={height}
        rowCount={rowCount}
        rowHeight={CARD_H + GAP}
        width={wrapWidth || 800}
        itemData={itemData}
      >
        {Cell}
      </Grid>
    </div>
  );
}

/* ===================== 컴포넌트 ===================== */
type RenderMode = "virtual" | "topN";
type LayoutMode = "vertical" | "split";

export function E_Interface_Total() {
  useEffect(() => { initI18n().catch(() => {}); }, []);
  const navigate = useNavigate();

  const { lines: uiLines, push: uiLog, boxRef: logBoxRef } = useUILog(LOG_MAX);
  const [showLog, setShowLog] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("split"); // 기본: 가로 분할

  // ── 가로 분할 모드: 로그 폭 상태 + 드래그 ───────────────────────────────
  const [logWidthSplit, setLogWidthSplit] = useState<number>(() => {
    const saved = Number(localStorage.getItem("logWidthSplit"));
    return Number.isFinite(saved) && saved >= 240 ? saved : 360; // 기본 360px
  });
  useEffect(() => {
    localStorage.setItem("logWidthSplit", String(logWidthSplit));
  }, [logWidthSplit]);

  const hDraggingRef = useRef(false);
  const hStartXRef = useRef(0);
  const hStartWidthRef = useRef(0);

  const onHDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    hDraggingRef.current = true;
    hStartXRef.current = e.clientX;
    hStartWidthRef.current = logWidthSplit;
    document.body.style.cursor = "ew-resize";
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!hDraggingRef.current) return;
      const dx = hStartXRef.current - e.clientX; // 왼쪽으로 당기면 로그 폭 감소
      const next = Math.min(800, Math.max(240, hStartWidthRef.current + dx));
      setLogWidthSplit(next);
    };
    const onUp = () => {
      if (!hDraggingRef.current) return;
      hDraggingRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [logWidthSplit]);
  // ─────────────────────────────────────────────────────────────────────

  const [plantList, setPlantList] = useState<ComboItem[]>([]);
  const [workcenterList, setWorkcenterList] = useState<ComboItem[]>([]);
  const [selectedPlant, setSelectedPlant] = useState("C200");
  const [selectedWorkcenter, setSelectedWorkcenter] = useState("");

  const [testMode, setTestMode] = useState<boolean>(true);
  const [testOrderNo, setTestOrderNo] = useState<string>("");
  const [testSfc, setTestSfc] = useState<string>("");

  // 진행 현황
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const jobsTotal = jobs.length;
  const jobsDone = jobs.filter(j => j.status === "완료").length;
  const jobsErr = jobs.filter(j => j.status === "오류").length;
  const jobsRunning = jobs.filter(j => j.status === "실행중").length;
  const progressPct = useMemo(() => {
    if (jobsTotal === 0) return 0;
    const finished = jobsDone + jobsErr;
    return Math.round((finished / jobsTotal) * 100);
  }, [jobsDone, jobsErr, jobsTotal]);

  const updateJob = (key: string, patch: Partial<JobItem>) => {
    setJobs(prev => prev.map(j => (j.key === key ? { ...j, ...patch } : j)));
  };
  const pushJobs = (items: JobItem[]) => setJobs(prev => [...prev, ...items]);
  const resetJobs = () => setJobs([]);

  // 콤보
  useEffect(() => { fetchCombos(); }, []);
  useEffect(() => { (async () => { await fetchCombos(); setSelectedWorkcenter(""); })(); }, [selectedPlant]);

  const fetchCombo = async (type: "PT" | "WC" | "SL", plantCd?: string) => {
    try {
      const ax = await getAxios();
      const params: any = type === "PT" ? { type } : { type, plant_cd: plantCd };
      const res = await ax.get("/api/mssql/basic-info", { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      uiLog("warn", `❌ ${t("app.log.combo.fail", { type })}`, e);
      return [];
    }
  };
  const fetchCombos = async () => {
    const plants = await fetchCombo("PT");
    const wcs = await fetchCombo("WC", selectedPlant);
    setPlantList(plants);
    setWorkcenterList(wcs);
  };

  /* ===================== SFC 체인 실행(진행 바 연동) ===================== */
  const runChainsForTargets = async (order: SapOrder, targets: PostTargetRow[], wcFromOrder: string, opts?: { testMode?: boolean }) => {
    const plant = order.plant || selectedPlant;
    const concurrency = opts?.testMode ? 1 : CONCURRENCY_SFC_CHAIN;

    await mapLimit(targets, concurrency, async (row) => {
      const jobKey = `${row.orderNumber}-${row.sfc}`;
      const tg = tag(row.orderNumber, row.sfc);
      console.time(`⏱️ chain ${tg}`);
      try {
        updateJob(jobKey, { status: "실행중" });

        const sfc = String(row.sfc).slice(0, 128);
        const qty = Number(row.qty || 0);
        if (!sfc || qty <= 0) { uiLog("warn", `⛔ ${t("app.log.skip.invalidSfcQty")} ${tg}`); updateJob(jobKey, { status: "오류" }); console.timeEnd(`⏱️ chain ${tg}`); return; }

        const { sfcDetail, operation, operationVersion, stepId, routing, resource: workCenterResolved } =
          await resolveOpAndResource({ plant, order, sfc, selectedWorkcenter, row, wcFromOrder }, uiLog);

        const sfcTotal = Number(row.sfcTotalQty ?? sfcDetail?.quantity ?? qty);
        if (!operation || !workCenterResolved) {
          uiLog("warn", `${tg} ${t("app.log.skip.noOpOrRes")}`);
          updateJob(jobKey, { status: "오류" });
          console.timeEnd(`⏱️ chain ${tg}`);
          return;
        }

        const baseUOM = await fetchBomBaseUom(plant, sfcDetail?.bom?.bom, sfcDetail?.bom?.type, uiLog);
        const uomData = await fetchUom(baseUOM, uiLog);
        const internal = (uomData?.internalCode || uomData?.unitCode || "EA");
        const iso = (uomData?.isoCode || internal);
        const commercial =
          (uomData?.commercialCodes?.find((c: any) => ["ko","en"].includes(c.language))?.commercialCode)
          || uomData?.commercialCodes?.[0]?.commercialCode
          || internal;

        const unitOfMeasure = {
          commercialUnitOfMeasure: commercial,
          internalUnitOfMeasure: internal,
          isoUnitOfMeasure: iso,
        };

        uiLog("info", `🚀 START ${tg}`, { operation, workCenterResolved });
        await callSapStart({ plant, operation, resource: String(workCenterResolved).slice(0, 36), sfcs: [sfc] }, uiLog);

        uiLog("info", `🚚 ${t("app.log.gr.try1")} ${tg}`, { qty, mat: row.materialCode, sloc: row.storageLocation });
        let grResp = await postGoodsReceipt({
          plant,
          order: row.orderNumber,
          postedBy: POSTED_BY,
          lineItems: [{
            material: row.materialCode,
            materialVersion: row.materialVersion || "ERP001",
            postingDate: row.workDate || today(),
            quantity: { unitOfMeasure, value: qty },
            sfc,
            storageLocation: String(row.storageLocation || "").slice(0, 10)
          }]
        }, uiLog);

        if (!grResp || !Array.isArray(grResp?.lineItems) || grResp.lineItems.length === 0) {
          uiLog("info", `🔁 ${t("app.log.gr.fallbackTotalOnce")} ${tg}`, { totalQty: sfcTotal });
          grResp = await postGoodsReceipt({
            plant,
            order: row.orderNumber,
            postedBy: POSTED_BY,
            lineItems: [{
              material: row.materialCode,
              materialVersion: row.materialVersion || "ERP001",
              postingDate: row.workDate || today(),
              quantity: { unitOfMeasure, value: sfcTotal },
              sfc,
              storageLocation: String(row.storageLocation || "").slice(0, 10)
            }]
          }, uiLog);
        }

        const transactionIds: string[] = Array.isArray(grResp?.lineItems)
          ? grResp!.lineItems
              .filter((li: any) => li?.transactionId && !li?.hasError)
              .map((li: any) => li.transactionId)
          : [];

        if (!transactionIds.length) {
          uiLog("error", `❌ ${t("app.log.noValidTxIdStop")}`, { order: row.orderNumber, sfc });
          updateJob(jobKey, { status: "오류" });
          console.timeEnd(`⏱️ chain ${tg}`);
          return;
        }

        const allPostedReceipts = await fetchPostedGoodsReceipts(
          plant, row.orderNumber, sfc, row.materialCode, transactionIds, uiLog
        );

        const postedMatchedTxIds = new Set<string>(
          allPostedReceipts
            .filter((gr: any) => transactionIds.includes(gr.transactionId?.trim?.()))
            .map((gr: any) => gr.transactionId?.trim?.())
        );

        const postedQty = allPostedReceipts
          .filter((gr: any) => !postedMatchedTxIds.has(gr.transactionId?.trim?.()))
          .reduce((sum: number, gr: any) => sum + Number(gr.quantityInBaseUnit?.value ?? 0), 0);

        const currentProcessingQty = allPostedReceipts
          .filter((gr: any) => postedMatchedTxIds.has(gr.transactionId?.trim?.()))
          .reduce((sum: number, gr: any) => sum + Number(gr.quantityInBaseUnit?.value ?? 0), 0);

        const totalDone = Math.round((postedQty + currentProcessingQty) * 1000) / 1000;
        const isFinal = Math.abs(sfcTotal - totalDone) < 0.001;

        uiLog("info", `📦 ${t("app.log.gr.accumulateCheck")}`, {
          sfcTotal, postedQty, currentProcessingQty, totalDone, remain: Math.max(0, sfcTotal - totalDone), isFinal
        });

        await postQtyConfirm({
          plant,
          shopOrder: row.orderNumber,
          sfc,
          operationActivity: operation,
          workCenter: workCenterResolved,
          yieldQuantity: qty,
          yieldQuantityUnit: internal,
          yieldQuantityIsoUnit: iso,
          isFinalConfirmation: isFinal
        }, uiLog);

        if (isFinal) {
          const std = await fetchStandardValue({
            plant,
            workCenter: workCenterResolved,
            operationActivity: operation,
            operationActivityVersion: operationVersion,
            object: row.orderNumber,
            objectType: "SHOP_ORDER_ROUTING",
            objectVersion: "ERP001",
          }, uiLog);
          const list = std?.standardValueCollectionList;
          if (Array.isArray(list) && list.length > 0) {
            const postingDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
            const postedBy = "dongil.kang@changshininc.com";
            uiLog("info", `🧾 ${t("app.log.activity.ready")} ${tg}`, { count: list.length });
            await postActivityConfirm({
              plant,
              shopOrder: row.orderNumber,
              sfc,
              operationActivity: operation,
              stepId,
              workCenter: workCenterResolved,
              activities: list.map((it: any) => ({
                activityId: it.standardVal,
                quantity: it?.standardValueQuantity?.value || 0,
                unitOfMeasure: it?.standardValueQuantity?.unitOfMeasure?.uom || "S",
                isoUnitOfMeasure: it?.standardValueQuantity?.unitOfMeasure?.internalUom || "S",
                postedBy,
                postingDateTime,
              }))
            }, uiLog);
          } else {
            uiLog("info", `ℹ️ ${t("app.log.activity.none")} ${tg}`);
          }
        }

        updateJob(jobKey, { status: "완료" });
        console.timeEnd(`⏱️ chain ${tg}`);
      } catch (err) {
        updateJob(jobKey, { status: "오류" });
        console.timeEnd(`⏱️ chain ${tg}`);
        uiLog("error", `❌ ${t("app.log.chain.fail")}`, err);
      }
    });
  };

  /* ===================== 메인 버튼 로직 ===================== */
  const handleSearch = async () => {
    try {
      resetJobs();
      uiLog("info", `🔵 ${t("app.log.orderList.start")}`, { plant: selectedPlant, workCenter: selectedWorkcenter || "(auto?)", testMode });

      const ax = await getAxios();
      const params: any = { plant: selectedPlant, releaseStatuses: "RELEASABLE" };
      if (selectedWorkcenter) params.workCenter = selectedWorkcenter;
      if (testMode && testOrderNo) { params.order = testOrderNo; params.limit = 1; }

      uiLog("info", `🔵 ${t("app.log.orderList.request")}`, params);
      const res = await ax.get<SapOrder[]>("/api/sap/order-list2", { params });
      let orders = res.data || [];
      uiLog("info", `📦 ${t("app.log.orderList.response")}`, { count: Array.isArray(orders) ? orders.length : 0 });

      if (!orders || (Array.isArray(orders) && orders.length === 0)) {
        alert(t("app.notice.noResult"));
        return;
      }
      if (testMode) {
        orders = testOrderNo ? orders.filter(o => String(o.order) === testOrderNo).slice(0, 1) : orders.slice(0, 1);
      }

      if (!selectedWorkcenter) {
        const firstWc = orders.find(o => Array.isArray(o.workCenters) && o.workCenters.length)?.workCenters?.[0]?.workCenter || "";
        if (firstWc) {
          uiLog("info", `ℹ️ ${t("app.log.autoSet.workCenter")}`, { workCenter: firstWc });
          setSelectedWorkcenter(firstWc);
        }
      }

      const allTargets: { order: SapOrder; wcFromOrder: string; rows: PostTargetRow[] }[] = [];
      for (const order of orders) {
        try {
          const wcFromOrder = order?.workCenters?.[0]?.workCenter || selectedWorkcenter || "";
          if (!wcFromOrder) {
            uiLog("warn", `[${order.order}] ${t("app.log.skip.noWcForOrder")}`);
            continue;
          }
          uiLog("info", `➡️ ${t("app.log.order.prepare")} ${tag(order.order)}`, { wcFromOrder });

          uiLog("info", `🟢 ${t("app.log.orderRelease.request")}`, { plant: selectedPlant, order: order.order });
          const releaseResp = await ax.post<OrderReleaseResponse>("/api/sap/order-release", { plant: selectedPlant, order: order.order });
          let sfcs: ReleasedSfc[] = Array.isArray(releaseResp?.data?.data?.sfcs) ? releaseResp.data.data.sfcs : [];
          uiLog("info", `🟢 ${t("app.log.orderRelease.response")}`, { order: order.order, sfcCount: sfcs.length });

          if (sfcs.length === 0) { uiLog("warn", t("app.log.noSfcForOrder", { order: order.order })); continue; }
          if (testMode) sfcs = testSfc ? sfcs.filter(s => s.identifier === testSfc).slice(0, 1) : sfcs.slice(0, 1);

          const rows: PostTargetRow[] = [];
          for (const s of sfcs) {
            uiLog("info", `📝 ${t("app.log.db.insertSfc.request")} ${tag(order.order, s.identifier)}`, { qty: s.quantity, wc: wcFromOrder });
            await ax.post("/api/mssql/interface-insert-sfc", {
              sfc: s.identifier,
              quantity: s.quantity,
              workCenter: wcFromOrder,
              plant: order.plant,
              materialCode: order.material?.material,
              materialVersion: order.material?.version,
              materialDescription: order.material?.description,
              bomNumber: order.bom?.bom,
              bomVersion: order.bom?.version,
              bomType: order.bom?.type,
              routingNumber: order.routing?.routing,
              routingVersion: order.routing?.version,
              routingType: order.routing?.routingType,
              orderNumber: order.order,
              orderType: order.orderType,
              status: order.status,
              plannedStartDate: order.plannedStartDate,
              plannedCompletionDate: order.plannedCompletionDate,
            });
            uiLog("info", `✅ ${t("app.log.db.insertSfc.success")} ${tag(order.order, s.identifier)}`);

            rows.push({
              plant: order.plant,
              workCenter: wcFromOrder,
              orderNumber: order.order,
              sfc: s.identifier,
              qty: Number(s.quantity || 0),
              materialCode: order.material?.material || "",
              materialVersion: order.material?.version || "ERP001",
              storageLocation: order.putawayStorageLocation || "",
              workDate: undefined,
            });
          }

          uiLog("info", `📝 ${t("app.log.db.insertOrder.request")} ${tag(order.order)}`, { wc: wcFromOrder });
          await ax.post("/api/mssql/interface-insert-order", {
            plant: order.plant,
            orderNumber: order.order,
            status: order.status,
            releaseStatus: order.releaseStatus,
            executionStatus: order.executionStatus,
            orderType: order.orderType,
            orderCategory: order.orderCategory,
            materialCode: order.material?.material,
            materialVersion: order.material?.version,
            materialDescription: order.material?.description,
            bomNumber: order.bom?.bom,
            bomVersion: order.bom?.version,
            bomType: order.bom?.type,
            routingNumber: order.routing?.routing,
            routingVersion: order.routing?.version,
            routingType: order.routing?.routingType,
            productionQuantity: order.productionQuantity,
            productionUnitOfMeasure: order.productionUnitOfMeasure,
            buildQuantity: order.buildQuantity,
            orderedQuantity: order.orderedQuantity,
            releasedQuantity: order.releasedQuantity,
            doneQuantity: order.doneQuantity,
            goodsReceiptQuantity: order.goodsReceiptQuantity,
            priority: order.priority,
            plannedStartDate: order.plannedStartDate,
            plannedCompletionDate: order.plannedCompletionDate,
            scheduledStartDate: order.scheduledStartDate,
            scheduledCompletionDate: order.scheduledCompletionDate,
            productionVersion: order.productionVersion,
            putawayStorageLocation: order.putawayStorageLocation,
            erpRoutingGroup: order.erpRoutingGroup,
            warehouseNumber: order.warehouseNumber,
            workCenter: wcFromOrder,
            workCenterDesc: workcenterList.find(w => w.CODE === wcFromOrder)?.NAME ?? "",
          });
          uiLog("info", `✅ ${t("app.log.db.insertOrder.success")} ${tag(order.order)}`);

          allTargets.push({ order, wcFromOrder, rows });
        } catch (orderErr: any) {
          uiLog("error", `❌ ${t("app.log.order.prepareFail", { order: order.order })}`, orderErr?.response?.data || orderErr?.message || orderErr);
        }
      }

      const jobItems: JobItem[] = [];
      allTargets.forEach(({ rows }) => {
        rows.forEach(r => {
          jobItems.push({
            key: `${r.orderNumber}-${r.sfc}`,
            order: r.orderNumber,
            sfc: r.sfc,
            qty: r.qty,
            status: "대기"
          });
        });
      });
      pushJobs(jobItems);

      for (const { order, wcFromOrder, rows } of allTargets) {
        uiLog("info", `⚙️ ${t("app.log.chain.run")} ${tag(order.order)} (targets=${rows.length})`);
        await runChainsForTargets(order, rows, wcFromOrder, { testMode });
        uiLog("info", `✅ ${t("app.log.chain.done")} ${tag(order.order)}`);
      }

      alert(t("app.notice.chain.done"));
    } catch (err: any) {
      const detail = err?.response?.data || err?.message || err;
      uiLog("error", `❌ ${t("app.log.process.fail")}`, detail);
      alert(`실패: ${typeof detail === "string" ? detail : (detail?.message || "Unknown error")}`);
    }
  };

  /* ===================== 렌더 모드: 가상 스크롤 / 상위 N + 더보기 ===================== */
  const [renderMode, setRenderMode] = useState<RenderMode>("virtual");
  const TOPN_CHOICES = [50, 100, 200, 300, 500, 1000, -1]; // -1 = 전체
  const [topNCount, setTopNCount] = useState<number>(200);
  const [visibleCount, setVisibleCount] = useState<number>(200);

  useEffect(() => {
    if (renderMode === "virtual") return;
    if (topNCount === -1) setVisibleCount(jobs.length);
    else setVisibleCount(Math.min(topNCount, jobs.length));
  }, [renderMode, topNCount, jobs.length]);

  const renderedJobs = useMemo(() => {
    if (renderMode === "virtual") return jobs;
    return jobs.slice(0, visibleCount);
  }, [renderMode, jobs, visibleCount]);

  const hasMoreToShow = renderMode === "topN" && visibleCount < jobs.length;
  const handleShowMore = () => {
    if (topNCount === -1) setVisibleCount(jobs.length);
    else setVisibleCount((prev) => Math.min(prev + topNCount, jobs.length));
  };

  /* ===================== 레이아웃(세로/가로분할) 가용 높이 계산 ===================== */
  const [splitWrapRef, splitHeight] = useAvailableHeight<HTMLDivElement>(420, 16); // 가로분할 시 카드/로그 동일 높이
  const defaultGridHeight = 560; // 세로 레이아웃 기본 높이

  /* ===================== UI ===================== */
  const progressText = t("app.progress.displayValue", {
    done: (jobsDone + jobsErr).toLocaleString(),
    total: jobsTotal.toLocaleString(),
    pct: progressPct
  });

  return (
    <div style={{ padding: "1rem" }}>
      <Bar design="Header" style={{ backgroundColor: "#d0e5ff", padding: "0.5rem 1rem", border: "1px solid #ccc", position: "relative" }}>
        <Label style={{ fontWeight: "bold", fontSize: "2.2rem" }}>{t("app.page.total.title")}</Label>
        <img
          src={backIcon}
          alt={t("app.common.back")}
          title={t("app.common.back")}
          onClick={() => navigate(-1)}
          style={{ position: "absolute", right: 16, top: 10, width: 48, height: 48, cursor: "pointer", userSelect: "none", opacity: 0.9 }}
        />
      </Bar>

      {/* 진행 요약 바 */}
      <div style={{ border: "1px solid #ccc", borderTop: "none", padding: "1rem 1.25rem", background: "#fafcff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          <ProgressIndicator value={progressPct} displayValue={progressText} style={{ width: 420 }} />
          <div style={{ display: "flex", gap: "1rem", color: "#333", fontWeight: 600 }}>
            <span>{t("app.summary.total")}: {jobsTotal}</span>
            <span style={{ color: "#2563eb" }}>{t("app.summary.running")}: {jobsRunning}</span>
            <span style={{ color: "#16a34a" }}>{t("app.summary.done")}: {jobsDone}</span>
            <span style={{ color: "#dc2626" }}>{t("app.summary.error")}: {jobsErr}</span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {/* 렌더 모드 */}
            <Label>{t("app.render.mode")}</Label>
            <select
              value={renderMode}
              onChange={(e) => setRenderMode(e.target.value as RenderMode)}
              style={{ width: 160, height: 36 }}
              title={t("app.render.modeTitle")}
            >
              <option value="virtual">{t("app.render.virtual")}</option>
              <option value="topN">{t("app.render.topNMore")}</option>
            </select>

            {renderMode === "topN" && (
              <>
                <Label>{t("app.render.count")}</Label>
                <select
                  value={topNCount}
                  onChange={(e) => setTopNCount(Number(e.target.value))}
                  style={{ width: 160, height: 36 }}
                  title={t("app.render.countTitle")}
                >
                  {TOPN_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n === -1 ? t("app.render.all") : t("app.render.nItems", { count: n.toLocaleString() })}
                    </option>
                  ))}
                </select>
                <div style={{ color: "#555" }}>
                  {t("app.render.currentShown", { shown: renderedJobs.length.toLocaleString(), total: jobs.length.toLocaleString() })}
                </div>
                {hasMoreToShow && (
                  <Button onClick={handleShowMore} design="Transparent" style={{ border: "1px solid #ddd" }}>
                    {t("app.render.showMore", { inc: topNCount === -1 ? t("app.render.all") : topNCount.toLocaleString() })}
                  </Button>
                )}
              </>
            )}

            {/* 레이아웃(세로/가로 분할) */}
            <Label>{t("app.layout.mode") || "레이아웃"}</Label>
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
              style={{ width: 160, height: 36 }}
              title={t("app.layout.modeTitle") || "화면 배치 선택"}
            >
              <option value="vertical">{t("app.layout.vertical") || "세로(현재)"}</option>
              <option value="split">{t("app.layout.split") || "가로 분할"}</option>
            </select>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Label>{t("app.log.show")}</Label>
              <Switch checked={showLog} onChange={(e: any) => setShowLog(e.target.checked)} />
            </div>
          </div>
        </div>
      </div>

      {/* 파라미터 영역 */}
      <FlexBox direction="Row" alignItems="Center" style={{ gap: "3rem", padding: "1.25rem", border: "1px solid #ccc", borderTop: "none" }}>
        <Label style={{ fontWeight: "bold", fontSize: "1.3rem" }}>{t("app.common.plant")}</Label>
        <select
          value={selectedPlant}
          className="common-select"
          style={{ width: "150px", fontSize: "1.2rem", padding: "0.5rem" }}
          onChange={(e) => setSelectedPlant(e.target.value)}
        >
          {plantList.map((item) => (<option key={item.CODE} value={item.CODE}>{item.CODE}</option>))}
        </select>

        <Label style={{ fontWeight: "bold", fontSize: "1.3rem" }}>{t("app.common.workCenter")}</Label>
        <select
          value={selectedWorkcenter}
          className="common-select"
          style={{ width: "180px", fontSize: "1.2rem", padding: "0.5rem" }}
          onChange={(e) => setSelectedWorkcenter(e.target.value)}
        >
          <option value="">{t("app.common.selectPlaceholder")}</option>
          {workcenterList.map((item) => (<option key={item.CODE} value={item.CODE}>{item.CODE}</option>))}
        </select>
      </FlexBox>

      {/* 테스트 모드 컨트롤 */}
      <div style={{ padding: "0 1.25rem 0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", borderLeft: "1px solid #ccc", borderRight: "1px solid #ccc" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
          <span style={{ fontWeight: 600 }}>{t("app.common.testModeOneByOne")}</span>
        </label>
        <input placeholder={t("app.common.orderOptional")} value={testOrderNo} onChange={(e) => setTestOrderNo(e.target.value.trim())} style={{ width: 200, height: 32 }} />
        <input placeholder={t("app.common.sfcOptional")} value={testSfc} onChange={(e) => setTestSfc(e.target.value.trim())} style={{ width: 200, height: 32 }} />
        <span style={{ color: "#666" }}>{t("app.common.testModeHint")}</span>
      </div>

      {/* 실행 버튼 */}
      <FlexBox style={{ padding: "0 1.25rem 1.25rem 1.25rem", borderLeft: "1px solid #ccc", borderRight: "1px solid #ccc", borderBottom: "1px solid #ccc" }}>
        <Button design="Emphasized" style={{ width: "220px", height: "3rem", fontSize: "1.2rem" }} onClick={handleSearch}>
          {t("app.button.integrationTest")}
        </Button>
      </FlexBox>

      {/* ===== 본문 영역: 세로/가로 분할 ===== */}
      {layoutMode === "split" && showLog ? (
        // ── 가로 분할: 카드(좌, 가변) + 핸들 + 로그(우, 고정/리사이즈 가능) ──
        <div
          ref={splitWrapRef}
          style={{ display: "flex", alignItems: "stretch", gap: 0, marginTop: "0.75rem" }}
        >
          {/* 좌측: 카드 영역 */}
          <div style={{ flex: 1, minWidth: 360, paddingRight: 8 }}>
            {renderMode === "virtual" ? (
              <VirtualJobGrid jobs={jobs} height={splitHeight} />
            ) : (
              <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", height: splitHeight, overflow: "auto", border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                {renderedJobs.map((j) => (
                  <div key={j.key} style={{ height: CARD_H }}>
                    <JobCard j={j} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 가운데: 세로 리사이즈 핸들 */}
          <div
            onMouseDown={onHDragStart}
            title="드래그하여 로그 패널 너비 조절"
            style={{
              width: 6,
              cursor: "ew-resize",
              borderRadius: 3,
              background: "linear-gradient(to right, rgba(0,0,0,0.08), rgba(0,0,0,0.12))",
              marginRight: 8,
              userSelect: "none"
            }}
          />

          {/* 우측: 로그 패널 (폭 고정/리사이즈) */}
          <div
            style={{
              flex: `0 0 ${logWidthSplit}px`,
              minWidth: 240,
              maxWidth: 800,
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div style={{ background: "#111827", color: "#d1d5db", padding: "8px 12px", borderTopLeftRadius: 8, borderTopRightRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #e5e7eb", borderBottom: "none" }}>
              <span style={{ fontWeight: 700 }}>{t("app.log.panelTitle")}</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{t("app.log.recentOfMax", { count: uiLines.length, max: LOG_MAX })}</span>
            </div>
            <div
              ref={logBoxRef}
              style={{
                height: splitHeight - 38, // 헤더 높이 보정
                overflow: "auto",
                background: "#0b1220",
                color: "#e5e7eb",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                padding: "8px 12px",
                border: "1px solid #e5e7eb",
                borderTop: "none",
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8
              }}
            >
              {uiLines.map((l, idx) => (
                <div key={idx} style={{ whiteSpace: "pre-wrap" }}>
                  <span style={{ color: "#9ca3af" }}>[{l.ts}]</span>{" "}
                  <span style={{
                    color: l.level === "error" ? "#ef4444" : l.level === "warn" ? "#f59e0b" : "#93c5fd",
                    fontWeight: 600
                  }}>
                    {l.level.toUpperCase()}
                  </span>{" "}
                  <span>{l.text}</span>
                  {l.ctx !== undefined ? <span> {typeof l.ctx === "string" ? l.ctx : JSON.stringify(l.ctx)}</span> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ── 세로 레이아웃(기존) ──
        <>
          <div style={{ marginTop: "0.5rem" }}>
            {renderMode === "virtual" ? (
              <VirtualJobGrid jobs={jobs} height={defaultGridHeight} />
            ) : (
              <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                {renderedJobs.map((j) => (
                  <div key={j.key} style={{ height: CARD_H }}>
                    <JobCard j={j} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 로그 패널 */}
          {showLog && (
            <div style={{ marginTop: "0.75rem", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "#111827", color: "#d1d5db", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>{t("app.log.panelTitle")}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{t("app.log.recentOfMax", { count: uiLines.length, max: LOG_MAX })}</span>
              </div>
              <div
                ref={logBoxRef}
                style={{ height: 260, overflow: "auto", background: "#0b1220", color: "#e5e7eb", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, padding: "8px 12px" }}
              >
                {uiLines.map((l, idx) => (
                  <div key={idx} style={{ whiteSpace: "pre-wrap" }}>
                    <span style={{ color: "#9ca3af" }}>[{l.ts}]</span>{" "}
                    <span style={{
                      color: l.level === "error" ? "#ef4444" : l.level === "warn" ? "#f59e0b" : "#93c5fd",
                      fontWeight: 600
                    }}>
                      {l.level.toUpperCase()}
                    </span>{" "}
                    <span>{l.text}</span>
                    {l.ctx !== undefined ? <span> {typeof l.ctx === "string" ? l.ctx : JSON.stringify(l.ctx)}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default E_Interface_Total;
