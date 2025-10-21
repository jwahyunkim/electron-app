import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlexBox,
  Label,
  Button,
  Bar,
  ProgressIndicator
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
const tag = (order?: string, sfc?: string) =>
  `[${order ?? ""}${order && sfc ? "/" : ""}${sfc ?? ""}]`;

/** 콘솔 로깅 전용 (화면 로그 없음) */
type UILogLevel = "info" | "warn" | "error";
function useConsoleLog() {
  const push = (level: UILogLevel, text: string, ctx?: unknown) => {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] ${level.toUpperCase()} ${text}`;
    if (level === "error") console.error(line, ctx ?? "");
    else if (level === "warn") console.warn(line, ctx ?? "");
    else if (DEBUG) console.log(line, ctx ?? "");
  };
  return { push };
}

/* ===================== 타입 ===================== */

/** 문자열 기본값: 없으면 "N/A" */
const S = (v: unknown) => {
  const s = (v ?? "").toString().trim();
  return s.length ? s : "N/A";
};

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
  priority?: number;
  plannedStartDate?: string;           // 문자열 저장
  plannedCompletionDate?: string;      // 문자열 저장
  scheduledStartDate?: string;         // 문자열 저장
  scheduledCompletionDate?: string;    // 문자열 저장
  productionVersion?: string;
  putawayStorageLocation?: string;
  erpRoutingGroup?: string;
  warehouseNumber?: string;
  workCenters?: Array<{ workCenterRef?: string; workCenter: string; description?: string }>;

  /* ▼ 신규/확장 (테이블과 동일한 컬럼명 기반, DMC와 동일 키를 쓴다는 전제) */
  WORK_DATE?: string;
  ZCF_SHIFT_CD?: string;
  ZCF_HH?: string;
  ZCF_SEQ?: string;
  ZCF_OP_CD?: string;
  ZCF_OP_NM?: string;
  ZCF_LINE_CD?: string;
  ZCF_LINE_NM?: string;
  ZCF_MACHINE_CD?: string;
  ZCF_MACHINE_NM?: string;

  ZCF_NT_LINE_CD?: string;
  ZCF_NT_LINE_NM?: string;
  ZCF_NT_MACHINE_CD?: string;
  ZCF_NT_MACHINE_NM?: string;

  ZCF_SIZE_CD?: string;
  ZCF_MODEL_CD?: string;
  ZCF_MODEL_NM?: string;
  ZCF_STYLE_CD?: string;
  ZCF_STYLE_NM?: string;
  ZCF_GENDER_CD?: string;
  ZCF_PART_NM?: string;

  ZCF_MCS_CD?: string;
  ZCF_MC_MCS_CD?: string;
  ZCF_MCS_NM?: string;
  ZCF_MCS_COLOR_CD?: string;
  ZCF_MCS_COLOR_NM?: string;
  ZCF_MCS_CD_OPTION?: string;

  ZCF_BATCH_SIZE?: number | null;
  ZCF_BATCH_TYPE?: string;
  ZCF_BATCH_ER_STRD?: number | null;

  ZCF_NT_ORDER_NUMBER?: string;
  MV_ORDER_YN?: string;
  POP_IF_YN?: string;
}

interface ReleasedSfc { identifier: string; quantity: number; }
interface OrderReleaseResponse { data?: { sfcs?: ReleasedSfc[] } }

/** 진행 보드 타입 */
type JobStatus = "대기" | "실행중" | "완료" | "오류";
type JobItem = {
  key: string; // `${order}`
  order: string;
  sfc: string;
  qty: number;
  status: JobStatus;
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

export function E_Interface_Prod() {
  useEffect(() => { initI18n().catch(() => {}); }, []);
  const navigate = useNavigate();
  const { push: uiLog } = useConsoleLog();

  const [plantList, setPlantList] = useState<ComboItem[]>([]);
  const [workcenterList, setWorkcenterList] = useState<ComboItem[]>([]);
  const [selectedPlant, setSelectedPlant] = useState("C200");
  const [selectedWorkcenter, setSelectedWorkcenter] = useState("");

  const [testMode, setTestMode] = useState<boolean>(true);
  const [testOrderNo, setTestOrderNo] = useState<string>("");
  const [testSfc, setTestSfc] = useState<string>("");

  // 진행 현황(카드)
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const jobsDone = jobs.filter(j => j.status === "완료").length;
  const jobsErr = jobs.filter(j => j.status === "오류").length;
  const jobsRunning = jobs.filter(j => j.status === "실행중").length;

  // ✅ 오더 단위 총/완료(빨간 박스와 진행률용)
  const [plannedTotal, setPlannedTotal] = useState<number | null>(null);
  const [finishedOrders, setFinishedOrders] = useState<number>(0);

  // 분모는 확정된 총 오더 수(없으면 0)
  const denominator = plannedTotal ?? 0;

  const progressPct = useMemo(() => {
    if (!denominator) return 0;
    return Math.round((finishedOrders / denominator) * 100);
  }, [finishedOrders, denominator]);

  const pushJob = (item: JobItem) => setJobs(prev => [...prev, item]);
  const updateJob = (key: string, patch: Partial<JobItem>) => {
    setJobs(prev => prev.map(j => (j.key === key ? { ...j, ...patch } : j)));
  };
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

  /* ===================== 메인 버튼 로직 (오더→릴리즈→INSERT) ===================== */
  const handleSearch = async () => {
    try {
      resetJobs();
      setPlannedTotal(null);
      setFinishedOrders(0);

      // ✅ 테스트 모드에서 오더번호를 넣었는데 워크센터 미선택이면 중단 (조회조건 강제)
      if (testMode && testOrderNo.trim() && !selectedWorkcenter) {
        alert(t("app.common.workCenter") + "를 먼저 선택하세요.");
        return;
      }

      uiLog("info", `🔵 ${t("app.log.orderList.start")}`, { plant: selectedPlant, workCenter: selectedWorkcenter || "(auto?)", testMode });

      const ax = await getAxios();
      const params: any = { plant: selectedPlant, releaseStatuses: "RELEASABLE" };
      if (selectedWorkcenter) params.workCenter = selectedWorkcenter;

      // ✅ 테스트 모드에서만: 입력한 prod를 서버에 전달 (조건에 맞는 아무 오더든 허용)
      if (testMode && testOrderNo) {
        params.order = testOrderNo.trim();
        params.limit = 1; // 입력된 번호로 1건만
      }

      uiLog("info", `🔵 ${t("app.log.orderList.request")}`, params);
      const res = await ax.get<SapOrder[]>("/api/sap/order-list2", { params });
      let orders = res.data || [];
      uiLog("info", `📦 ${t("app.log.orderList.response")}`, { count: Array.isArray(orders) ? orders.length : 0 });

      if (!orders || orders.length === 0) {
        alert(t("app.notice.noResult"));
        return;
      }

      // ✅ 테스트 모드: 프론트 추가 필터 없음(서버가 이미 필터) — 표시 건수만 제어
      if (testMode) {
        orders = orders.slice(0, 1); // 번호 있으면 그 1건, 없으면 샘플 1건
      }

      // 선택 워크센터 자동 보정 (기존 유지)
      if (!selectedWorkcenter) {
        const firstWc = orders.find(o => Array.isArray(o.workCenters) && o.workCenters.length)?.workCenters?.[0]?.workCenter || "";
        if (firstWc) {
          uiLog("info", `ℹ️ ${t("app.log.autoSet.workCenter")}`, { workCenter: firstWc });
          setSelectedWorkcenter(firstWc);
        }
      }

      // ✅ 1) 총 오더 수 확정 → 빨간 박스/진행률 분모 고정
      setPlannedTotal(orders.length);

      // ✅ 2) 화면에 먼저 '대기' 카드 채우기 (오더=카드 1개)
      const placeholders: JobItem[] = orders.map(o => ({
        key: `${o.order}`,
        order: o.order,
        sfc: "",
        qty: Number(o.productionQuantity || 0),
        status: "대기"
      }));
      setJobs(placeholders);

      // 3) 오더별 체인 실행
      for (const order of orders) {
        const key = `${order.order}`;
        try {
          const wcFromOrder = order?.workCenters?.[0]?.workCenter || selectedWorkcenter || "";
          if (!wcFromOrder) {
            uiLog("warn", `[${order.order}] ${t("app.log.skip.noWcForOrder")}`);
            updateJob(key, { status: "오류" });
            continue;
          }
          uiLog("info", `➡️ ${t("app.log.order.prepare")} ${tag(order.order)}`, { wcFromOrder });

          // 3-1) 오더 릴리즈(1:1 가정) → SFC 확보
          uiLog("info", `🟢 ${t("app.log.orderRelease.request")}`, { plant: selectedPlant, order: order.order });
          const releaseResp = await ax.post<OrderReleaseResponse>("/api/sap/order-release", { plant: selectedPlant, order: order.order });
          let sfcs: ReleasedSfc[] = Array.isArray(releaseResp?.data?.data?.sfcs) ? releaseResp.data.data.sfcs : [];
          uiLog("info", `🟢 ${t("app.log.orderRelease.response")}`, { order: order.order, sfcCount: sfcs.length });

          if (testMode && testSfc) {
            sfcs = sfcs.filter(s => s.identifier === testSfc).slice(0, 1);
          } else {
            sfcs = sfcs.slice(0, 1); // 1:1 가정
          }

          const sfc = sfcs[0];
          if (!sfc) {
            uiLog("warn", t("app.log.noSfcForOrder", { order: order.order }));
            updateJob(key, { status: "오류" });
            continue;
          }

          // 화면 표시 업데이트
          updateJob(key, { sfc: sfc.identifier, status: "실행중" });

          // 3-2) SFC INSERT
          try {
            uiLog("info", `📝 ${t("app.log.db.insertSfc.request")} ${tag(order.order, sfc.identifier)}`, { qty: sfc.quantity, wc: wcFromOrder });
            await ax.post("/api/mssql/interface-insert-sfc", {
              sfc: sfc.identifier,
              quantity: sfc.quantity,
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
            uiLog("info", `✅ ${t("app.log.db.insertSfc.success")} ${tag(order.order, sfc.identifier)}`);
            updateJob(key, { status: "완료" });
          } catch (sErr: unknown) {
            const m = (sErr as any)?.response?.data || (sErr as any)?.message || sErr;
            uiLog("error", `❌ ${t("app.log.db.insertSfc.fail")} ${tag(order.order, sfc.identifier)}`, m);
            updateJob(key, { status: "오류" });
          }

          // 3-3) 오더 메타 INSERT (성공/실패 무관하게 시도)
          try {
            uiLog("info", `📝 ${t("app.log.db.insertOrder.request")} ${tag(order.order)}`, { wc: wcFromOrder });
            await ax.post("/api/mssql/interface-insert-order", {
              // 기본 메타
              plant: S(order.plant),
              orderNumber: S(order.order),
              status: S(order.status),
              releaseStatus: S(order.releaseStatus ?? "RELEASED"),
              executionStatus: S(order.executionStatus),
              orderType: S(order.orderType),
              orderCategory: S(order.orderCategory),

              // 자재/BOM/라우팅
              materialCode: S(order.material?.material),
              materialVersion: S(order.material?.version),
              materialDescription: S(order.material?.description),
              bomNumber: S(order.bom?.bom),
              bomVersion: S(order.bom?.version),
              bomType: S(order.bom?.type),
              routingNumber: S(order.routing?.routing),
              routingVersion: S(order.routing?.version),
              routingType: S(order.routing?.routingType),

              // 수치(Decimal/Int) → null 허용
              productionQuantity: order.productionQuantity ?? null,
              productionUnitOfMeasure: S(order.productionUnitOfMeasure),
              buildQuantity: order.buildQuantity ?? null,
              orderedQuantity: order.orderedQuantity ?? null,
              releasedQuantity: order.releasedQuantity ?? null,
              doneQuantity: order.doneQuantity ?? null,
              goodsReceiptQuantity: order.goodsReceiptQuantity ?? null,
              priority: order.priority ?? null,

              // 날짜/문자(테이블이 nvarchar이므로 문자열로 저장)
              plannedStartDate: S(order.plannedStartDate),
              plannedCompletionDate: S(order.plannedCompletionDate),
              scheduledStartDate: S(order.scheduledStartDate),
              scheduledCompletionDate: S(order.scheduledCompletionDate),

              // 기타 메타
              productionVersion: S(order.productionVersion),
              putawayStorageLocation: S(order.putawayStorageLocation),
              erpRoutingGroup: S(order.erpRoutingGroup),
              warehouseNumber: S(order.warehouseNumber),

              // 작업장
              workCenter: S(wcFromOrder),
              workCenterDesc: S(workcenterList.find(w => w.CODE === wcFromOrder)?.NAME),

              // ▼ 추가 컬럼 (문자 → "N/A", 수치 → null)

              zcf_shift_cd: S(order.ZCF_SHIFT_CD),
              zcf_hh: S(order.ZCF_HH),
              zcf_seq: S(order.ZCF_SEQ),
              zcf_op_cd: S(order.ZCF_OP_CD),
              zcf_op_nm: S(order.ZCF_OP_NM),
              zcf_line_cd: S(order.ZCF_LINE_CD),
              zcf_line_nm: S(order.ZCF_LINE_NM),
              zcf_machine_cd: S(order.ZCF_MACHINE_CD),
              zcf_machine_nm: S(order.ZCF_MACHINE_NM),

              zcf_nt_line_cd: S(order.ZCF_NT_LINE_CD),
              zcf_nt_line_nm: S(order.ZCF_NT_LINE_NM),
              zcf_nt_machine_cd: S(order.ZCF_NT_MACHINE_CD),
              zcf_nt_machine_nm: S(order.ZCF_NT_MACHINE_NM),

              zcf_size_cd: S(order.ZCF_SIZE_CD),
              zcf_model_cd: S(order.ZCF_MODEL_CD),
              zcf_model_nm: S(order.ZCF_MODEL_NM),
              zcf_style_cd: S(order.ZCF_STYLE_CD),
              zcf_style_nm: S(order.ZCF_STYLE_NM),
              zcf_gender_cd: S(order.ZCF_GENDER_CD),
              zcf_part_nm: S(order.ZCF_PART_NM),

              zcf_mcs_cd: S(order.ZCF_MCS_CD),
              zcf_mc_mcs_cd: S(order.ZCF_MC_MCS_CD),
              zcf_mcs_nm: S(order.ZCF_MCS_NM),
              zcf_mcs_color_cd: S(order.ZCF_MCS_COLOR_CD),
              zcf_mcs_color_nm: S(order.ZCF_MCS_COLOR_NM),
              zcf_mcs_cd_option: S(order.ZCF_MCS_CD_OPTION),

              zcf_batch_size: order.ZCF_BATCH_SIZE ?? null,
              zcf_batch_type: S(order.ZCF_BATCH_TYPE),
              zcf_batch_er_strd: order.ZCF_BATCH_ER_STRD ?? null,

              zcf_nt_order_number: S(order.ZCF_NT_ORDER_NUMBER),

              // 테이블에 존재
              sfc: S(sfc?.identifier),
              mv_order_yn: S(order.MV_ORDER_YN),
              pop_if_yn: S(order.POP_IF_YN),
            });
            uiLog("info", `✅ ${t("app.log.db.insertOrder.success")} ${tag(order.order)}`);
          } catch (ordErr: unknown) {
            const m = (ordErr as any)?.response?.data || (ordErr as any)?.message || ordErr;
            uiLog("warn", `❌ ${t("app.log.db.insertOrder.fail")} ${tag(order.order)}`, m);
          }
        } catch (orderErr: unknown) {
          const m = (orderErr as any)?.response?.data || (orderErr as any)?.message || orderErr;
          uiLog("error", `❌ ${t("app.log.order.prepareFail", { order: order.order })}`, m);
          updateJob(key, { status: "오류" });
        } finally {
          // ✅ 오더 1건 종료 → 진행률 카운트업
          setFinishedOrders(prev => prev + 1);
        }
      }

      alert(t("app.notice.chain.done"));
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data || (err as any)?.message || err;
      uiLog("error", `❌ ${t("app.log.process.fail")}`, detail);
      alert(`실패: ${typeof detail === "string" ? detail : ((detail as any)?.message || "Unknown error")}`);
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

  /* ===================== UI ===================== */
  const progressText = t("app.progress.displayValue", {
    done: finishedOrders.toLocaleString(),
    total: denominator.toLocaleString(),
    pct: progressPct
  });

  return (
    <div style={{ padding: "1rem" }}>
      <Bar
        design="Header"
        style={{ backgroundColor: "#d0e5ff", padding: "0.5rem 1rem", border: "1px solid #ccc", position: "relative" }}
      >
        <Label style={{ fontWeight: "bold", fontSize: "2.2rem" }}>{t("app.page.prod.title")}</Label>
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
            <span>{t("app.summary.total")}: {denominator}</span>
            <span style={{ color: "#2563eb" }}>{t("app.summary.running")}: {jobsRunning}</span>
            <span style={{ color: "#16a34a" }}>{t("app.summary.done")}: {jobsDone}</span>
            <span style={{ color: "#dc2626" }}>{t("app.summary.error")}: {jobsErr}</span>
          </div>

          {/* 렌더 모드/표시 개수 */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
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
          {t("app.button.prodOrder")}
        </Button>
      </FlexBox>

      {/* 카드 영역만 표시 (로그 패널 제거) */}
      <div style={{ marginTop: "0.5rem" }}>
        {renderMode === "virtual" ? (
          <VirtualJobGrid jobs={jobs} height={560} />
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
    </div>

  );
}

export default E_Interface_Prod;
