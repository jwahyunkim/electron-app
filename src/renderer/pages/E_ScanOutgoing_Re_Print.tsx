// E_ScanOutgoing_Re_Print.tsx — 최종본 (2번째 조회조건 라인 오른쪽에 '재출력' 버튼, 인쇄+커밋 자동, SIZE 컬럼+전달, 재출력 후 선택 해제)
import React, { useEffect, useState } from "react";
// import axios from "axios";
import "./index.css";
import {
  FlexBox,
  Label,
  DatePicker,
  Input,
  Button,
  Text,
  CheckBox,
} from "@ui5/webcomponents-react";
import { useNavigate } from "react-router-dom";
import { initI18n, t } from "../utils/i18n";
import { getAxios } from "../utils/api";

import backIcon from "@renderer/resources/Back-Icon.png";
import loadingIcon from "@renderer/resources/loading1.png";

/* ================= 유틸 ================= */
function toYmd(s?: string | Date | null) {
  if (!s) return "";
  const d = typeof s === "string" ? new Date(s) : s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}
const todayStr = () => new Date().toISOString().slice(0, 10);

/* ====== 결과 행 타입 ====== */
type Row = {
  PRINT_DATE: string;
  ORDER_NUMBER: string;
  SFC_CD: string;
  PCARD_SEQ: string;
  PCARD_QTY: number;
  BAR_KEY: string;
  STYLE_CD: string;
  STYLE_NAME: string;
  SIZE_CD?: string;
  MATERIAL_CODE?: string;
  WORK_CENTER?: string;
};

type ComboItem = { CODE: string; NAME?: string };

export default function E_ScanOutgoing_Re_Print() {
  const navigate = useNavigate();

  /* i18n */
  useEffect(() => { initI18n().catch(() => {}); }, []);

  /* 헤더 시계 */
  const [nowTime, setNowTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ============= 필터 상태 ============= */
  const [plantList, setPlantList] = useState<ComboItem[]>([]);
  const [selectedPlant, setSelectedPlant] = useState("C200");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [orderLike, setOrderLike] = useState("");
  const [barKeyLike, setBarKeyLike] = useState("");
  const [styleLike, setStyleLike] = useState("");

  // 날짜 기본값 오늘 + 복원
  useEffect(() => {
    const savedFrom = localStorage.getItem("E_SCAN_REPRINT_FROM");
    const savedTo = localStorage.getItem("E_SCAN_REPRINT_TO");
    const today = todayStr();
    setDateFrom(savedFrom || today);
    setDateTo(savedTo || today);
  }, []);
  useEffect(() => { if (dateFrom) localStorage.setItem("E_SCAN_REPRINT_FROM", dateFrom); }, [dateFrom]);
  useEffect(() => { if (dateTo) localStorage.setItem("E_SCAN_REPRINT_TO", dateTo); }, [dateTo]);

  /* ============= 결과/선택/로딩 ============= */
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00:00");

  // 로딩 타이머
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    let startTime = 0;
    if (isLoading) {
      const updateTimer = () => {
        const ms = Date.now() - startTime;
        const sec = Math.floor(ms / 1000);
        const h = String(Math.floor(sec / 3600)).padStart(2, "0");
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");
        const el = document.getElementById("loading-time");
        if (el) el.textContent = `${h}:${m}:${s}`;
      };
      startTime = Date.now();
      updateTimer();
      timerId = setInterval(updateTimer, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
      const el = document.getElementById("loading-time");
      if (el) el.textContent = "00:00:00";
    };
  }, [isLoading]);

  /* ============= PLANT 콤보 로딩 ============= */
  useEffect(() => {
    (async () => {
      try {
        const ax = await getAxios();
        const res = await ax.get("/api/mssql/basic-info", {
          params: { type: "PT", plant_cd: selectedPlant },
        });
        const data = Array.isArray(res.data) ? (res.data as ComboItem[]) : [];
        setPlantList(data.length ? data : [{ CODE: "C200" }]);
      } catch {
        setPlantList([{ CODE: "C200" }]);
      }
    })();
  }, []);

  /* ============= 조회 ============= */
  async function handleSearch() {
    if (!selectedPlant) {
      alert(t("app.err.configRequired"));
      return;
    }
    setIsLoading(true);
    setRows([]);
    setSelectedKeys(new Set()); // 검색 시 선택 초기화

    try {
      const ax = await getAxios();
      const body = {
        plant_cd: selectedPlant,
        print_from: dateFrom ? toYmd(dateFrom) : null,
        print_to: dateTo ? toYmd(dateTo) : null,
        order_like: orderLike || null,
        bar_key_like: barKeyLike || null,
        style_like: styleLike || null,
      };
      const res = await ax.post("/api/mssql/epcard/reprint-search", body, {
        headers: { "Content-Type": "application/json" },
      });
      const list = res.data?.rows ?? [];
      setRows(list);
    } catch (err: any) {
      console.error("❌ 재출력 조회 실패:", err);
      const msg = err?.message || String(err);
      const txt = t("reprint.err.searchFail", { msg }) || `${t("ui.error")}: ${msg}`;
      alert(txt);
    } finally {
      setIsLoading(false);
    }
  }

  /* ======== 선택 유틸 ======== */
  const keyOf = (r: Row) => `${r.ORDER_NUMBER}_${r.PCARD_SEQ}`;
  const selectedList = () => rows.filter((r) => selectedKeys.has(keyOf(r)));
  const allSelected = rows.length > 0 && selectedKeys.size === rows.length;

  const getChecked = (e: any) =>
    (e?.detail && typeof e.detail.checked === "boolean" ? e.detail.checked : e?.target?.checked) ?? false;

  const toggleRow = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedKeys(new Set(rows.map(keyOf)));
    else setSelectedKeys(new Set());
  };

  /* ======== 프린트 잡/커밋 아이템 ======== */
  function buildPrintJob(r: Row) {
    return {
      PLANT_CD: selectedPlant,
      ORDER_NUMBER: r.ORDER_NUMBER,
      BAR_KEY: r.BAR_KEY,
      PCARD_SEQ: Number(r.PCARD_SEQ ?? 1),
      PCARD_QTY: r.PCARD_QTY,
      STYLE_CD: r.STYLE_CD,
      STYLE_NAME: r.STYLE_NAME,
      SFC_CD: r.SFC_CD,
      SIZE_CD: r.SIZE_CD ?? "",
      MATERIAL_CODE: r.MATERIAL_CODE ?? "",
      WORK_CENTER: r.WORK_CENTER ?? "",
    };
  }
  function buildCommitItems(list: Row[]) {
    return list.map((r) => ({
      ORDER_NUMBER: r.ORDER_NUMBER,
      SFC_CD: r.SFC_CD,
      BAR_KEY: r.BAR_KEY,
      PCARD_SEQ: r.PCARD_SEQ,
    }));
  }

  /* ============= 인쇄 + 커밋(항상 둘 다) ============= */
  async function handleReprint() {
    const selected = selectedList();
    if (selected.length === 0) {
      alert(t("reprint.msg.selectRow") || t("ui.select"));
      return;
    }

    const jobs = selected.map(buildPrintJob);

    const ipc =
      (window as any)?.electron?.ipcRenderer?.invoke ||
      (window as any)?.api?.invoke ||
      (window as any)?.ipcRenderer?.invoke;

    if (!ipc) {
      alert(t("reprint.err.noIpc") || "ipcRenderer.invoke not found");
      return;
    }

    try {
      // 1) 출력
      const payload = { jobs, options: {} };
      try { await ipc("passcard:print-batch", payload); }
      catch { await ipc("print:passcards", payload); }

      // 2) 커밋
      const ax = await getAxios();
      const commitItems = buildCommitItems(selected);
      const commitRes = await ax.post(
        "/api/mssql/epcard/reprint-commit",
        { plant_cd: selectedPlant, items: commitItems },
        { headers: { "Content-Type": "application/json" } }
      );
      console.info("[REPRINT] commit result:", commitRes.data);

      // ✅ 성공 후 선택 해제
      setSelectedKeys(new Set());

    } catch (e: any) {
      console.error("❌ 재출력/커밋 실패:", e);
      const msg = e?.message || String(e);
      const txt = t("reprint.err.printFail", { msg }) || `${t("ui.error")}: ${msg}`;
      alert(txt);
    }
  }

  /* ======== 헤더 컬럼 리사이저 ======== */
  const initResizable = (th: HTMLTableCellElement | null) => {
    if (!th) return;
    const resizer = th.querySelector(".resizer") as HTMLDivElement;
    if (!resizer) return;

    let startX = 0, startWidth = 0;
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + e.clientX - startX);
      th.style.width = `${newWidth}px`;
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    resizer.addEventListener("mousedown", (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = th.offsetWidth;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  };

  const noWrap: React.CSSProperties = { whiteSpace: "nowrap" };

  /* ============= 렌더 ============= */
  return (
    <div className="density-compact">
      {/* 헤더 */}
      <FlexBox style={{ backgroundColor: "#0F005F", height: "5rem" }} justifyContent="SpaceBetween" alignItems="Center">
        <Label style={{ fontSize: "2rem", fontWeight: "bold", color: "white" }}>
          {t("reprint.title")}
        </Label>
        <FlexBox direction="Row" alignItems="Start" gap="1rem">
          <img
            src={backIcon}
            alt="Back Icon"
            onClick={() => navigate("/")}
            style={{ width: "48px", height: "52px", padding: "0", marginTop: "2px", cursor: "pointer" }}
          />
          <FlexBox direction="Column" alignItems="End" style={{ lineHeight: "1.2" }}>
            <Label style={{ fontSize: "2rem", color: "white", marginRight: "0.5rem" }}>
              {nowTime.toISOString().slice(0, 10)}
            </Label>
            <Label style={{ fontSize: "2rem", color: "white", marginRight: "0.5rem" }}>
              {nowTime.toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </Label>
          </FlexBox>
        </FlexBox>
      </FlexBox>

      {/* 페이지 설명 */}
      <div style={{ padding: "0.75rem 0 0.25rem 0" }}>
        <Text style={{ color: "#5f738a" }}>{t("reprint.desc")}</Text>
      </div>

      {/* ====== 조회조건 1행 ====== */}
      <div style={{ display: "flex", alignItems: "center", gap: "2rem", paddingTop: "0.5rem", flexWrap: "nowrap" }}>
        <div>
          <Label className="common-label" style={{ width: 130, ...noWrap }}>{t("app.detail.date")} (From)</Label>
          <DatePicker key={"from-" + dateFrom} formatPattern="yyyy-MM-dd" value={dateFrom} style={{ width: "180px", marginTop: "-4px" }}
            onChange={(e: any) => setDateFrom(e.detail.value)} />
        </div>

        <div>
          <Label className="common-label" style={{ width: 130, ...noWrap }}>{t("app.detail.date")} (To)</Label>
          <DatePicker key={"to-" + dateTo} formatPattern="yyyy-MM-dd" value={dateTo} style={{ width: "180px", marginTop: "-4px" }}
            onChange={(e: any) => setDateTo(e.detail.value)} />
        </div>

        <div>
          <Label className="common-label" style={{ width: 110, ...noWrap }}>{t("app.common.plant")}</Label>
          <select
            value={selectedPlant}
            style={{ width: "120px", padding: "0.4rem 0.8rem", margin: "0.4rem", borderRadius: "4px", border: "1px solid #ccc", fontSize: "1rem" }}
            onChange={(e) => setSelectedPlant(e.target.value)}
          >
            {(Array.isArray(plantList) ? plantList : [{ CODE: "C200" }]).map((p) => (
              <option key={p.CODE} value={p.CODE}>{p.CODE}</option>
            ))}
          </select>
        </div>

        <div>
          <Label className="common-label" style={{ width: 120, ...noWrap }}>{t("app.detail.orderNo")}</Label>
          <Input value={orderLike} onInput={(e: any) => setOrderLike(e.target.value)} style={{ width: "220px", marginTop: "-4px" }} />
        </div>

        {/* <div style={{ flex: 1 }} /> */}

        <Button
            className="common-button"
            design="Emphasized"
            onClick={handleSearch}
            style={{ marginLeft: "12px" }}  // 입력창과 살짝만 간격
        >
            {t("app.button.search")}
        </Button>
      </div>

      {/* ====== 조회조건 2행 (같은 줄 오른쪽에 재출력 버튼) ====== */}
      <div style={{ display: "flex", alignItems: "center", gap: "2rem", paddingTop: "0.75rem", flexWrap: "nowrap" }}>
        <div>
          <Label className="common-label" style={{ width: 120, ...noWrap }}>{t("reprint.filter.barKey")}</Label>
          <Input
            value={barKeyLike}
            onInput={(e: any) => setBarKeyLike(e.target.value)}
            style={{ width: "280px" , marginTop: "-4px" }}
          />
        </div>

        <div>
          <Label className="common-label" style={{ width: 120, ...noWrap }}>{t("app.table.styleCode")}</Label>
          <Input
            value={styleLike}
            onInput={(e: any) => setStyleLike(e.target.value)}
            style={{ width: "220px" , marginTop: "-4px"}}
          />
        </div>

        {/* 같은 라인의 오른쪽으로 밀기 */}
        {/* <div style={{ marginLeft: "0px" }} /> */}

        <Button
            className="common-button"
            design="Emphasized"
            onClick={handleReprint}
            disabled={selectedKeys.size === 0}
            >
            {t("reprint.button.printAndCommit")}
        </Button>            

      </div>

      {/* ======= 스크롤 가능한 그리드 영역 ======= */}
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flexGrow: 1, overflowY: "auto", maxHeight: "calc(100vh - 240px)" }}>
          <div style={{ minWidth: "max-content" }}>
            <table className="grid-table reprint-table">
              <colgroup>
                <col style={{ width: 140 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 240 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 240 }} />
                <col style={{ width: 90 }}  />
              </colgroup>

              <thead>
                <tr>
                  <th
                    className={`sticky-header resizable ${allSelected ? "select-all--active" : ""}`}
                    ref={(el) => initResizable(el)}
                    onDoubleClick={() => toggleAll(!allSelected)}
                    title="Double-click: Select/Deselect all"
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <CheckBox checked={allSelected} onChange={(e: any) => toggleAll(getChecked(e))} style={{ transform: "scale(1.0)" }} />
                      <span>{t("reprint.grid.select")}</span>
                      <span style={{ fontWeight: "bold" }}>({selectedKeys.size}/{rows.length || 0})</span>
                    </div>
                    <div className="resizer" />
                  </th>

                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.printDate")}<div className="resizer" /></th>
                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.orderNumber")}<div className="resizer" /></th>
                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.sfc")}<div className="resizer" /></th>
                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.pcardSeq")}<div className="resizer" /></th>
                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.pcardQty")}<div className="resizer" /></th>
                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.barKey")}<div className="resizer" /></th>
                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.styleCode")}<div className="resizer" /></th>
                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.styleName")}<div className="resizer" /></th>
                  <th className="sticky-header resizable" ref={(el) => initResizable(el)}>{t("reprint.grid.size")}<div className="resizer" /></th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const key = keyOf(r);
                  const selected = selectedKeys.has(key);
                  return (
                    <tr key={key} className={selected ? "row-selected" : undefined}>
                      <td><CheckBox checked={selected} onChange={(e: any) => toggleRow(key, getChecked(e))} /></td>
                      <td>{r.PRINT_DATE}</td>
                      <td>{r.ORDER_NUMBER}</td>
                      <td>{r.SFC_CD}</td>
                      <td>{r.PCARD_SEQ}</td>
                      <td>{r.PCARD_QTY}</td>
                      <td>{r.BAR_KEY}</td>
                      <td>{r.STYLE_CD}</td>
                      <td>{r.STYLE_NAME}</td>
                      <td>{r.SIZE_CD ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.85)", zIndex: 9999, display: "flex",
            justifyContent: "center", alignItems: "center", fontFamily: "Malgun Gothic",
          }}
        >
          <div
            style={{
              display: "flex", alignItems: "center", gap: "30px", padding: "20px",
              border: "2px solid gray", borderRadius: "16px", backgroundColor: "#fff",
              boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontSize: "30px", fontWeight: "bold", marginBottom: "10px" }}>{t("ui.loading")}</div>
              <div id="loading-time" style={{ fontSize: "28px", marginBottom: "12px", color: "#07D5F4" }}>{elapsedTime}</div>
              <div style={{ width: "200px", height: "10px", background: "#ddd", borderRadius: "5px", overflow: "hidden", position: "relative" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#0078D4", position: "absolute", top: "-1px", animation: "move-dot 1.5s linear infinite" }} />
              </div>
            </div>
            <div style={{ width: "300px", height: "200px" }}>
              <img src={loadingIcon} alt="Loading" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </div>
          <style>{`@keyframes move-dot { 0% { left: 0; } 100% { left: 188px; } }`}</style>
        </div>
      )}
    </div>
  );
}
