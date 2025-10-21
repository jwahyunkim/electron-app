import React, { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
// ❌ axios 직접 사용 제거 (동적 포트 대응을 위해 공용 클라이언트 사용)
// import axios from "axios";
import "./index.css";
import {
  FlexBox,
  CardHeader,
  Icon,
  FlexBoxDirection,
  Label,
  Input,
  AnalyticalTable,
  Card,
  Text,
  Button,
  MessageBox,
  TextAlign,
  FilterBar,
  FilterGroupItem,
  FilterItem,
  ComboBox,
  ComboBoxItem,
  DatePicker,
  Dialog,
  Bar,
  Title,
} from "@ui5/webcomponents-react";
import { useNavigate } from "react-router-dom";

import "@ui5/webcomponents-react/dist/Assets.js";
import "@ui5/webcomponents-icons/dist/Assets.js";
// ko 로케일 번들 필요 시:
import "@ui5/webcomponents-localization/dist/Assets.js";
// import E_ScanOutgoing_Detail from "./E_ScanOutgoing_Detail"; // ✅ default import!
import E_ScanOutgoing_Detail_Y from "./E_ScanOutgoing_Detail_Y"; // ✅ default import!
import E_ScanOutgoing_Detail_N from "./E_ScanOutgoing_Detail_N"; // ✅ default import!
import { loadConfigClient } from "../utils/loadConfigClient";
import type { DbConfig } from "../utils/loadConfigClient";

import backIcon from "@renderer/resources/Back-Icon.png";
import loadingIcon from "@renderer/resources/loading1.png";

// ✅ i18n 추가 (언어 관련만)
import { initI18n, t } from "../utils/i18n";

// ✅ 동적 포트 Axios 유틸 (신규)
import { getAxios } from "../utils/api";

interface ConfigType {
  plant: string;
  fac: string;
  line: string;
  mline: string;
  focus: string;
  div: string;
  workcenter: string;
  storage: string;
}

interface TableRow {
  WORK_DATE: string;
  MATERIAL_CODE: string;
  SIZE_CD: string;
  ORDER_NUMBER: string;
  [key: string]: any;
}

interface DetailDialogData {
  work_date: string;
  center: string;
  material_code: string;
  size_cd: string;
  order_number: string;
}

interface ComboItem {
  CODE: string;
  NAME: string;
}

interface PairInfo {
  CAPTION: string;
  VALUE: string;
}
type RowType = {
  PLANT: string;
  LINE: string;
  MODEL_NAME: string;
  STYLE_CODE: string;
  PART_NO: string;
  PART_NAME: string;
  DD_CAPTION: string;
  rowKey: string;
  DISTINCTROW: string;
  [key: string]: string | number | undefined;
};

export function E_ScanOutgoing() {
  const navigate = useNavigate();

  // ✅ i18n 초기화만 추가 (다른 로직 불변)
  useEffect(() => {
    initI18n().catch(() => {});
  }, []);

  const [plantList, setPlantList] = useState<ComboItem[]>([]);
  const [storageList, setStorageList] = useState<ComboItem[]>([]);
  const [workcenterList, setWorkcenterList] = useState<ComboItem[]>([]);

  const [selectedPlant, setSelectedPlant] = useState("C200");
  const [selectedStorage, setSelectedStorage] = useState("512C");
  const [selectedWorkcenter, setSelectedWorkcenter] = useState("2CFSS");

  // ✅ 헤더 DatePicker 날짜 (메인 컨텍스트의 workDate 적용)
  const [selectedDate, setSelectedDate] = useState<string>("");

  // ✅ 메인에서 내려준 타임존 (우측 시계/날짜 렌더에 사용)
  const [plantTimezone, setPlantTimezone] = useState<string | null>(null);

  // ✅ 시간 소스 표시용 ('plant' | 'local')
  const [timeSource, setTimeSource] = useState<"plant" | "local" | null>(null);

  const selectedPlantRef = useRef(selectedPlant);
  const selectedStorageRef = useRef(selectedStorage);
  const selectedWorkcenterRef = useRef(selectedWorkcenter);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00:00");

  const [lineList, setLineList] = useState<ComboItem[]>([]);
  const [selectedLine, setSelectedLine] = useState("ALL");
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [detailRows, setDetailRows] = useState<any[]>([]);

  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [config, setConfig] = useState<DbConfig | null>(null);
  const [pairInfo, setPairInfo] = useState<PairInfo[]>([]);
  const [pairSummary, setPairSummary] = useState({ input: 0, production: 0 });

  // ✅ 우측 시계: "고정 베이스 + 경과시간" 방식 (로컬 시간 변경에 영향 X)
  const [nowTime, setNowTime] = useState(new Date());
  const baseServerMsRef = useRef<number | null>(null);
  const basePerfRef = useRef<number | null>(null);

  const [useInputY, setUseInputY] = useState<boolean | null>(null);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogClose, setDialogClose] = useState(false);
  const [plantSpanMap, setPlantSpanMap] = useState<any>({});
  const [lineSpanMap, setLineSpanMap] = useState<any>({});
  const [modelSpanMap, setModelSpanMap] = useState<any>({});
  const [selectedPlantName, setSelectedPlantName] = useState("");
  const [selectedLineName, setSelectedLineName] = useState("");
  const [filteredData, setFilteredData] = useState<any>([]);

  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [hasInitialAutoFetched, setHasInitialAutoFetched] = useState(false);

  // ---------- 유틸: 서버 epoch 단위 정규화 & 범위 체크 ----------
  const normalizeEpochMs = (raw: unknown): number | null => {
    if (raw == null) return null;

    const n = typeof raw === "number" ? raw : (typeof raw === "string" ? Number(raw) : NaN);

    if (Number.isFinite(n)) {
      if (n >= 1e16) return Math.floor(n / 1e6);
      if (n >= 1e14) return Math.floor(n / 1e3);
      if (n >= 9e11 && n <= 9e12) return Math.floor(n);
      if (n <= 1e11) return Math.floor(n * 1000);
    }

    if (typeof raw === "string") {
      const t = Date.parse(raw);
      if (!Number.isNaN(t)) return t;
    }

    return null;
  };
  const isReasonableMs = (ms: number) => {
    const y = new Date(ms).getUTCFullYear();
    return y >= 2000 && y <= 2100;
  };

  // ---------- 유틸: 타임존으로 날짜/시간 문자열 ----------
  const formatYYYYMMDDInTZ = (d: Date, tz: string) => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };
  const formatTimeInTZ = (d: Date, tz: string) => {
    return d.toLocaleTimeString("ko-KR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: tz,
    });
  };

  // ---------- 최신 콤보박스 상태값 반영 ----------
  useEffect(() => {
    selectedPlantRef.current = selectedPlant;
  }, [selectedPlant]);
  useEffect(() => {
    selectedStorageRef.current = selectedStorage;
  }, [selectedStorage]);
  useEffect(() => {
    selectedWorkcenterRef.current = selectedWorkcenter;
  }, [selectedWorkcenter]);

  useEffect(() => {
    loadConfigClient().then((cfg) => {
      if (cfg) setConfig(cfg);
      else console.warn("⚠️ config 로딩 실패");
    });
  }, []);

  // ✅ 시간 컨텍스트: 메인 1회 브로드캐스트 수신 + 보강(getContext)
  useEffect(() => {
    const time = (window as any).time;
    if (!time) {
      console.warn("⚠ time bridge not found on window");
      const saved = localStorage.getItem("E_SCAN_DATE");
      if (saved) setSelectedDate(saved);
      return;
    }
    let alreadyApplied = false;

    const applyCtx = (ctx: any) => {
      if (!ctx) return;
      alreadyApplied = true;

      const tz = ctx?.timeZone ?? ctx?.timezone ?? ctx?.tz ?? null;
      const wd = ctx?.workDate ?? ctx?.workday ?? ctx?.currentWorkday ?? "";
      const src: "plant" | "local" = ctx?.source === "plant" ? "plant" : "local";

      console.log("[TIME ctx]", { src, tz, wd });

      setTimeSource(src);
      setPlantTimezone(src === "plant" && tz ? tz : null);

      if (wd) {
        setSelectedDate(wd);
        localStorage.setItem("E_SCAN_DATE", wd);
      } else {
        setSelectedDate(localStorage.getItem("E_SCAN_DATE") || "");
      }

      if (baseServerMsRef.current == null || basePerfRef.current == null) {
        const ms = normalizeEpochMs(ctx?.serverEpochMs);
        if (src === "plant" && ms != null && isReasonableMs(ms)) {
          baseServerMsRef.current = ms;
        } else {
          baseServerMsRef.current = Date.now();
          if (src === "plant") {
            console.warn("[time] invalid serverEpochMs -> fallback to local Date.now()", ctx?.serverEpochMs);
          }
        }
        basePerfRef.current = performance.now();
      }
    };

    const off = time.onReadyOnce((ctx: any) => applyCtx(ctx));

    time
      .getContext()
      .then((ctx: any) => {
        if (!alreadyApplied) applyCtx(ctx);
      })
      .catch(() => {
        const saved = localStorage.getItem("E_SCAN_DATE");
        if (saved) setSelectedDate(saved);
        if (baseServerMsRef.current == null || basePerfRef.current == null) {
          baseServerMsRef.current = Date.now();
          basePerfRef.current = performance.now();
        }
      });

    return () => {
      try {
        off?.();
      } catch {}
    };
  }, []);

  // ✅ 실시간 시계 (표시는 plantTimezone을 강제) — 고정 베이스 + 경과(ms)로 계산
  useEffect(() => {
    const timer = setInterval(() => {
      if (baseServerMsRef.current != null && basePerfRef.current != null) {
        const elapsed = performance.now() - (basePerfRef.current as number);
        setNowTime(new Date((baseServerMsRef.current as number) + elapsed));
      } else {
        setNowTime(new Date());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    console.log("📊 테이블 데이터 확인:", tableData);
  }, [tableData]);

  // ✅ 자동조회: selectedDate가 준비되지 않았으면 동작 금지
  useEffect(() => {
    if (!autoRefresh) return;
    if (!selectedDate) return;

    const fixedDate = selectedDate.replace(/-/g, "");

    intervalRef.current = setInterval(() => {
      fetchTableDataWithParams(
        fixedDate,
        selectedPlantRef.current,
        selectedStorageRef.current,
        selectedWorkcenterRef.current
      );
      fetchSummaryData(
        fixedDate,
        selectedPlantRef.current,
        selectedStorageRef.current,
        selectedWorkcenterRef.current
      );
    }, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedDate, autoRefresh]);

  // 🔄 로딩 시간 측정
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    let startTime: number;

    if (isLoading) {
      const updateTimer = () => {
        const elapsedMs = Date.now() - startTime;
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const seconds = String(totalSeconds % 60).padStart(2, "0");

        const timerEl = document.getElementById("loading-time");
        if (timerEl) {
          timerEl.textContent = `${hours}:${minutes}:${seconds}`;
        }
      };

      startTime = Date.now();
      updateTimer();
      timerId = setInterval(updateTimer, 1000);
    }

    return () => {
      clearInterval(timerId);
      const timerEl = document.getElementById("loading-time");
      if (timerEl) {
        timerEl.textContent = "00:00:00";
      }
    };
  }, [isLoading]);

  // ✅ 최초 콤보 로드
  useEffect(() => {
    const initCombos = async () => {
      const plantData = await fetchCombo("PT");
      setPlantList(plantData);

      const slData = await fetchCombo("SL", selectedPlant);
      setStorageList(slData);

      const wcData = await fetchCombo("WC", selectedPlant);
      setWorkcenterList(wcData);
    };
    initCombos();
  }, []);

  const updateDependentCombos = async (plantCode: string) => {
    const sl = await fetchCombo("SL", plantCode);
    const wc = await fetchCombo("WC", plantCode);
    setStorageList(sl);
    setWorkcenterList(wc);

    const newStorage = sl.length > 0 ? sl[0].CODE : "";
    const newCenter = wc.length > 0 ? wc[0].CODE : "";

    setSelectedStorage(newStorage);
    setSelectedWorkcenter(newCenter);
  };

  useEffect(() => {
    if (selectedPlant) {
      updateDependentCombos(selectedPlant);
    }
  }, [selectedPlant]);

  // ✅ 콤보가 확정되고, selectedDate도 준비됐을 때만 조회
  useEffect(() => {
    if (!selectedDate) return;

    const fixedDate = selectedDate.replace(/-/g, "");
    if (selectedPlant && selectedStorage && selectedWorkcenter) {
      console.log("📡 API 호출 (확정된 상태값)", {
        plant: selectedPlant,
        storage: selectedStorage,
        center: selectedWorkcenter,
      });
      fetchTableDataWithParams(fixedDate, selectedPlant, selectedStorage, selectedWorkcenter);
      fetchSummaryData(fixedDate, selectedPlant, selectedStorage, selectedWorkcenter);
    }
  }, [selectedDate, selectedPlant, selectedStorage, selectedWorkcenter]);

  useEffect(() => {
    console.log("🧪 plantList 상태", plantList);
  }, [plantList]);

  useEffect(() => {
    if (!hasInitialAutoFetched && selectedDate && selectedPlant && selectedLine) {
      console.log("📦 [초기 1회 자동조회 실행]", {
        selectedDate,
        selectedPlant,
        selectedLine,
      });

      const fixedDate = selectedDate.replace(/-/g, "");

      fetchTableDataWithParams(fixedDate, selectedPlant, selectedStorage, selectedWorkcenter);
      fetchSummaryData(fixedDate, selectedPlant, selectedStorage, selectedWorkcenter);

      setHasInitialAutoFetched(true);
    }
  }, [selectedDate, selectedPlant, selectedLine]);

  const getRowSpanMap = (data: any[], keyFn: (row: any) => string) => {
    const map: any = {};
    let prevKey = "";
    let count = 0;

    data.forEach((row, index) => {
      const currentKey = keyFn(row);
      if (currentKey === prevKey) {
        count++;
        map[index - count].span = (map[index - count].span || 1) + 1;
        map[index] = { span: 0 };
      } else {
        count = 0;
        map[index] = { span: 1 };
      }
      prevKey = currentKey;
    });

    return map;
  };

  const handleCellClick = async (row: any) => {
    console.log("[CLICK] order row =", row);

    try {
      const cfg = await (window as any).config.get();
      console.log("[CLICK] cfg =", cfg);

      const raw = (cfg?.Common?.INPUT ?? cfg?.input ?? "").toString().toUpperCase();
      const inputYN = raw === "Y";
      console.log("[CLICK] inputYN =", inputYN);

      setSelectedRow(row);
      setSelectedCell(undefined);
      setDetailRows([]);
      setUseInputY(inputYN);
      setDialogOpen(true);
      console.log("[CLICK] setDialogOpen(true)");
    } catch (err) {
      console.error("❌ handleCellClick 오류:", err);
    }
  };

  useEffect(() => {
    if (tableData.length > 0) {
      setPlantSpanMap(getRowSpanMap(tableData, (row) => row.PLANT));
      setLineSpanMap(getRowSpanMap(tableData, (row) => `${row.PLANT}_${row.LINE}`));
      setModelSpanMap(getRowSpanMap(tableData, (row) => `${row.PLANT}_${row.LINE}_${row.MODEL_NAME}`));
    }
  }, [tableData]);

  const handleSearch = () => {
    if (!selectedDate) {
      alert("날짜가 준비되지 않았습니다. 시간 정보를 다시 불러와 주세요.");
      return;
    }

    console.log("🔍 Search 수동조회", {
      selectedDate,
      selectedPlant,
      selectedStorage,
      selectedWorkcenter,
    });

    setTableData([]);
    const fixedDate = selectedDate.replace(/-/g, "");

    fetchTableDataWithParams(fixedDate, selectedPlant, selectedStorage, selectedWorkcenter);
    fetchSummaryData(fixedDate, selectedPlant, selectedStorage, selectedWorkcenter);
  };

  // ✅ 변경: 동적 포트 axios 사용
  const fetchTableDataWithParams = async (date: string, plant: string, storage: string, center: string) => {
    try {
      setIsLoading(true);

      setTableData([]);

      const ax = await getAxios();
      const res = await ax.get("/api/mssql/escan-main", {
        params: { plant, work_date: date, storage, center },
      });

      const newData = res.data;

      if (Array.isArray(newData) && newData.length > 0) {
        setTableData(newData);
      } else {
        setTableData([]);
      }
    } catch (err) {
      console.error("❌ 테이블 조회 실패:", err);
      setTableData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ 변경: 동적 포트 axios 사용
  const fetchCombo = async (type: "PT" | "SL" | "WC", plantCd = "C200") => {
    try {
      const ax = await getAxios();
      const res = await ax.get("/api/mssql/basic-info", {
        params: { type, plant_cd: plantCd },
      });

      const data: unknown = res.data;
      if (Array.isArray(data)) {
        return data as ComboItem[];
      } else {
        console.warn(`⚠ ${type} 응답이 배열이 아님`, data);
        return [];
      }
    } catch (err) {
      console.error(`❌ ${type} 콤보 불러오기 실패:`, err);
      return [];
    }
  };

  // ✅ 변경: 동적 포트 axios 사용
  const fetchSummaryData = async (date: string, plant: string, storage: string, center: string) => {
    try {
      const ax = await getAxios();
      const res = await ax.get("/api/mssql/escan-extra", {
        params: { plant, work_date: date, storage, center },
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        const { INPUT_QTY, PROD_QTY } = res.data[0];
        setPairSummary({
          input: INPUT_QTY ?? 0,
          production: PROD_QTY ?? 0,
        });
      } else {
        setPairSummary({ input: 0, production: 0 });
      }
    } catch (err) {
      console.error("❌ escan-extra 요약 데이터 조회 실패:", err);
      setPairSummary({ input: 0, production: 0 });
    }
  };

  const handleDetailConfirm = () => {
    if (!selectedDate) {
      alert("날짜가 준비되지 않았습니다. 시간 정보를 다시 불러와 주세요.");
      return;
    }

    const fixedDate = selectedDate.replace(/-/g, "");

    fetchTableDataWithParams(fixedDate, selectedPlant, selectedStorage, selectedWorkcenter);

    fetchSummaryData(fixedDate, selectedPlant, selectedStorage, selectedWorkcenter);
  };

  const initResizable = (th: HTMLTableCellElement | null) => {
    if (!th) return;
    const resizer = th.querySelector(".resizer") as HTMLDivElement;
    if (!resizer) return;

    let startX: number, startWidth: number;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + e.clientX - startX;
      th.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    resizer.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      startWidth = th.offsetWidth;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  };

  function getRowStyle(row: TableRow): CSSProperties {
    const color = row.COLOR?.toUpperCase();

    switch (color) {
      case "NOSET":
        return { backgroundColor: "lightgray", color: "black" };
      case "WHITE":
        return { backgroundColor: "white", color: "black" };
      case "ORANGE":
        return { backgroundColor: "orange", color: "black" };
      case "GREEN":
        return { backgroundColor: "limegreen", color: "black" };
      case "GREY":
        return { backgroundColor: "gray", color: "white" };
      default:
        return {};
    }
  }

  // 🔵 시간 소스 점(●) 색상 및 툴팁
  const sourceDotColor =
    timeSource === "plant" || timeSource === "local" ? "#18a558" : "#A9A9A9";
  const sourceDotTitle =
    (timeSource === "plant" ? "시간 소스: DMC/Plant 표준시간" :
     timeSource === "local" ? "시간 소스: 로컬 PC 시간" : "시간 소스: 미정") +
    (plantTimezone ? ` / TZ=${plantTimezone}` : "");

  // ✅ 타임존 표시: plant 성공 시에는 plantTimezone, 실패(local) 시에는 로컬 타임존
  const tzDisplay =
    timeSource === "plant" && plantTimezone
      ? plantTimezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div>
      <FlexBox style={{ backgroundColor: "#0F005F", height: "5rem" }} justifyContent="SpaceBetween" alignItems="Center">
        {/* Title */}
        <Label style={{ fontSize: "2rem", fontWeight: "bold", color: "white" }}>{t("app.page.escan.title")}</Label>
        {/* Right Side: Back + Source Dot + Clock */}
        <FlexBox direction="Row" alignItems="Start" gap="1rem">
          <img
            src={backIcon}
            alt="Back Icon"
            onClick={() => navigate("/")}
            style={{
              width: "60px",
              height: "70px",
              padding: "0",
              marginTop: "6px",
              cursor: "pointer",
            }}
          />
          {/* 소스 표시: 타임존/미정은 동그라미, 로컬일 때만 초록 삼각형 */}
          <div style={{ position: "relative", width: 24, height: 24, marginTop: "12px" }}>
            {timeSource === "local" ? (
              <div
                title={sourceDotTitle}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 3,
                  width: 0,
                  height: 0,
                  borderLeft: "9px solid transparent",
                  borderRight: "9px solid transparent",
                  borderBottom: "16px solid #18a558",
                  filter: "drop-shadow(0 0 2px rgba(0,0,0,0.35))",
                  pointerEvents: "none",
                }}
              />
            ) : (
              <div
                title={sourceDotTitle}
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3,
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  backgroundColor: sourceDotColor,
                  border: "2px solid white",
                }}
              />
            )}
          </div>

          <FlexBox direction="Column" alignItems="End" style={{ lineHeight: "1.2" }}>
            <Label
              style={{
                fontSize: "2rem",
                color: "white",
                fontWeight: "bold",
                marginRight: "0.5rem",
              }}
              title={tzDisplay || undefined}
            >
              {/* 우측 날짜 */}
              {tzDisplay ? formatYYYYMMDDInTZ(nowTime, tzDisplay) : ""}
            </Label>
            <Label
              style={{
                fontSize: "2rem",
                color: "white",
                fontWeight: "bold",
                marginRight: "0.5rem",
              }}
              title={tzDisplay || undefined}
            >
              {/* 우측 시간 */}
              {tzDisplay ? formatTimeInTZ(nowTime, tzDisplay) : ""}
            </Label>
          </FlexBox>
        </FlexBox>
      </FlexBox>

      {/* Filters */}
      <FlexBox gap="2rem">
        <div>
          <Label className="common-label" style={{ width: 90 }}>
            {t("app.detail.date")}
          </Label>
          {/* selectedDate는 메인 컨텍스트의 workDate */}
          <DatePicker
            key={`datepicker-${selectedDate}`}
            formatPattern="yyyy-MM-dd"
            value={selectedDate}
            style={{ width: "180px" }}
            onChange={(e: any) => {
              const newDate = e.detail.value;
              setSelectedDate(newDate);
              localStorage.setItem("E_SCAN_DATE", newDate);
            }}
          />
        </div>

        <div>
          <Label className="common-label" style={{ width: 90 }}>
            {t("app.common.plant")}
          </Label>
          <select
            value={selectedPlant}
            style={{
              width: "110px",
              padding: "0.4rem 0.8rem",
              margin: "0.4rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "1rem",
            }}
            onChange={(e) => {
              setSelectedPlant(e.target.value);
            }}
          >
            {Array.isArray(plantList) &&
              plantList.map((p) => (
                <option key={p.CODE} value={p.CODE}>
                  {p.CODE}
                </option>
              ))}
          </select>
        </div>

        <div>
          <Label className="common-label" style={{ width: 150 }}>
            {t("app.detail.storage")}
          </Label>
          <select
            value={selectedStorage}
            style={{
              width: "180px",
              padding: "0.4rem 0.8rem",
              margin: "0.4rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "1rem",
            }}
            onChange={(e) => {
              setSelectedStorage(e.target.value);
            }}
          >
            {storageList.map((s) => (
              <option key={s.CODE} value={s.CODE}>
                {s.CODE}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="common-label" style={{ width: 90 }}>
            {t("app.detail.line")}
          </Label>
          <select
            value={selectedWorkcenter}
            style={{
              width: "180px",
              padding: "0.4rem 0.8rem",
              margin: "0.4rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "1rem",
            }}
            onChange={(e) => {
              setSelectedWorkcenter(e.target.value);
            }}
          >
            {workcenterList.map((w) => (
              <option key={w.CODE} value={w.CODE}>
                {w.CODE}
              </option>
            ))}
          </select>
        </div>

        <Button className="common-button" design="Emphasized" onClick={handleSearch}>
          {t("app.button.search")}
        </Button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "1.5rem",
            fontWeight: "bold",
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            marginTop: "-0.3rem",
          }}
        >
          <input
            type="checkbox"
            checked={autoRefresh}
            style={{
              transform: "scale(2)",
              marginTop: "5px",
            }}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span>{t("app.checkbox.autoRefresh")}</span>
        </div>
      </FlexBox>

      <FlexBox direction="Row" gap="0.5rem" style={{ marginTop: "0.5rem", justifyContent: "flex-end" }}>
        <div
          style={{
            backgroundColor: "#3A3AFF",
            color: "white",
            fontWeight: "bold",
            fontStyle: "italic",
            padding: "0.4rem 1rem",
            borderRadius: "4px",
          }}
        >
          {t("app.summary.input")} : {pairSummary.input.toLocaleString()} {t("app.common.pairs")}
        </div>

        <div
          style={{
            backgroundColor: "#3A3AFF",
            color: "white",
            fontWeight: "bold",
            fontStyle: "italic",
            padding: "0.4rem 1rem",
            borderRadius: "4px",
          }}
        >
          {t("app.summary.production")} : {pairSummary.production.toLocaleString()} {t("app.common.pairs")}
        </div>
      </FlexBox>

      <FlexBox direction="Row" alignItems="Center" style={{ padding: "0.5rem", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "40px", height: "30px", backgroundColor: "gray" }} />
          <Text style={{ fontSize: "1.1rem" }}>{t("app.legend.yesterdayCompleted")}</Text>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "40px", height: "30px", backgroundColor: "lightgray" }} />
          <Text style={{ fontSize: "1.1rem" }}>{t("app.legend.notInput")}</Text>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "40px", height: "30px", backgroundColor: "white", border: "2px solid black" }} />
          <Text style={{ fontSize: "1.1rem" }}>{t("app.legend.inputOnly")}</Text>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "40px", height: "30px", backgroundColor: "orange" }} />
          <Text style={{ fontSize: "1.1rem" }}>{t("app.legend.todayActive")}</Text>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "40px", height: "30px", backgroundColor: "limegreen" }} />
          <Text style={{ fontSize: "1.1rem" }}>{t("app.legend.todayCompleted")}</Text>
        </div>
      </FlexBox>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flexShrink: 0 }}></div>

        <div style={{ flexGrow: 1, overflowY: "auto", maxHeight: "calc(100vh - 220px)" }}>
          <div style={{ minWidth: "max-content" }}>
            <table className="grid-table">
              <thead>
                <tr>
                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "3%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.location")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "3%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.detail.line")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "8%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.model")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "6%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.styleCode")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "4%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.materialCode")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "10%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.materialName")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "10%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.sfc")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "10%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.inputQty")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "10%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.prodQty")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "10%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.table.quantity")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "10%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.detail.size")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "10%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.detail.date")}
                    <div className="resizer" />
                  </th>

                  <th
                    className="sticky-header sticky-col sticky-col-1 resizable"
                    style={{ border: "1px solid black", backgroundColor: "gray", color: "white", width: "10%" }}
                    rowSpan={2}
                    ref={(el) => initResizable(el)}
                  >
                    {t("app.detail.orderNo")}
                    <div className="resizer" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => (
                  <tr key={idx} style={getRowStyle(row)}>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.PUTAWAYSTORAGELOCATION}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.WORK_CENTER}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.MODEL_CD}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.STYLE_CD}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.MATERIAL_CODE}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.MATERIAL_DESCRIPTION}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.SFC}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.INPUT_QTY}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.PROD_QTY}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.QUANTITY}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.SIZE_CD}</td>
                    <td style={{ border: "1px solid black", textAlign: "center" }}>{row.WORK_DATE}</td>

                    <td
                      style={{ border: "1px solid black", textAlign: "center", cursor: "pointer" }}
                      onClick={() => handleCellClick(row)}
                    >
                      {row.ORDER_NUMBER}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {dialogOpen && selectedRow && useInputY !== null && (useInputY ? (
              <E_ScanOutgoing_Detail_Y
                open={dialogOpen}
                onClose={() => {
                  setDialogOpen(false);
                  handleSearch();
                }}
                data={selectedRow}
                cellInfo={null}
                rows={detailRows}
                onConfirm={handleDetailConfirm}
                plant_cd={selectedPlant}
                work_date={selectedDate}
              />
            ) : (
              <E_ScanOutgoing_Detail_N
                open={dialogOpen}
                onClose={() => {
                  setDialogOpen(false);
                  handleSearch();
                }}
                data={selectedRow}
                cellInfo={null}
                rows={detailRows}
                onConfirm={handleDetailConfirm}
                plant_cd={selectedPlant}
                work_date={selectedDate}
              />
            ))}

            {isLoading && (
              <div
                style={{
                  position: "fixed",
                  top: "0",
                  left: "0",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "rgba(255, 255, 255, 0.85)",
                  zIndex: 9999,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontFamily: "Malgun Gothic",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "30px",
                    padding: "20px",
                    border: "2px solid gray",
                    borderRadius: "16px",
                    backgroundColor: "#fff",
                    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "30px", fontWeight: "bold", marginBottom: "10px" }}>{t("ui.loading")}</div>
                    <div id="loading-time" style={{ fontSize: "28px", marginBottom: "12px", color: "#07D5F4" }}>
                      {elapsedTime}
                    </div>

                    <div
                      style={{
                        width: "200px",
                        height: "10px",
                        background: "#ddd",
                        borderRadius: "5px",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: "#0078D4",
                          position: "absolute",
                          top: "-1px",
                          animation: "move-dot 1.5s linear infinite",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ width: "300px", height: "200px" }}>
                    <img src={loadingIcon} alt="Loading" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                </div>

                <style>
                  {`
                    @keyframes move-dot {
                      0% { left: 0; }
                      100% { left: 188px; }
                    }
                  `}
                </style>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default E_ScanOutgoing;
