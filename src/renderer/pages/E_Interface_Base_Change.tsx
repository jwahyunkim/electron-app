// src/renderer/pages/E_Interface_Base_Change.tsx
import React, { useState, useEffect } from "react";
// import axios from "axios";
import { FlexBox, Label, Button, Bar } from "@ui5/webcomponents-react";
import { loadResourceMapping } from "../utils/loadResourceMapping";
import { SAP_CONFIG, getAccessToken, refreshToken } from "@shared/sap";
import { initI18n, t } from "../utils/i18n";

// ★ 추가: 뒤로가기 아이콘 & 라우터
import backIcon from "@renderer/resources/Back-Icon.png";
import { useNavigate } from "react-router-dom";
import { getAxios } from "../utils/api";
import "./index.css";   // <= 여기 추가됨

interface ComboItem { CODE: string; NAME: string; }
interface Operation { operation: string; version: string; description: string; }
interface StepRouting { routing: string; version: string; type: string; }
interface Step { stepId: string; operation: Operation; stepRouting: StepRouting; resource: string; plannedWorkCenter: string; }
interface SfcDetail {
  sfc: string;
  material?: { material: string; version: string; description: string };
  bom?: { bom: string; version: string; type: string };
  routing?: { routing: string; version: string; type: string };
  quantity: number;
  steps: Step[];
}

export function E_Interface_Base_Change() {
  useEffect(() => { initI18n().catch(() => {}); }, []);

  // ★ 추가: 뒤로가기용 네비게이터
  const navigate = useNavigate();

  const [plantList, setPlantList] = useState<ComboItem[]>([]);
  const [workcenterList, setWorkcenterList] = useState<ComboItem[]>([]);
  const [selectedPlant, setSelectedPlant] = useState("C200");
  const [selectedWorkcenter, setSelectedWorkcenter] = useState("2DUPC");
  const [detailDataBefore, setDetailDataBefore] = useState<SfcDetail[]>([]);
  const [detailDataAfter, setDetailDataAfter] = useState<SfcDetail[]>([]);
  const [resourceMap, setResourceMap] = useState<Record<string, string>>({});

  useEffect(() => { fetchCombos(); }, []);

  const fetchCombo = async (type: "PT" | "WC" | "SL", plantCd?: string): Promise<ComboItem[]> => {
    try {
      const ax = await getAxios();
      const params: any = type === "PT" ? { type } : { type, plant_cd: plantCd };
      const res = await ax.get("/api/mssql/basic-info", { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error(`❌ ${type} 콤보 로딩 실패`, err);
      return [];
    }
  };

  const fetchCombos = async () => {
    const plants = await fetchCombo("PT");
    const workcenters = await fetchCombo("WC", selectedPlant);
    setPlantList(plants);
    setWorkcenterList(workcenters);
    if (!workcenters.some(wc => wc.CODE === selectedWorkcenter)) {
      setSelectedWorkcenter(workcenters[0]?.CODE ?? "");
    }
  };

  useEffect(() => { fetchCombos(); }, [selectedPlant]);

  useEffect(() => {
    const loadMapping = async () => {
      const map = await loadResourceMapping();
      setResourceMap(map);
    };
    loadMapping();
  }, []);

  const handleSearch = async () => {
    setDetailDataBefore([]);
    setDetailDataAfter([]);

    try {
      const ax = await getAxios();

      const res = await ax.get("/api/sap/order-list", {
        params: { plant: selectedPlant, releaseStatuses: "RELEASABLE", workCenter: selectedWorkcenter },
      });

      const orders = res.data;
      if (!Array.isArray(orders) || orders.length === 0) {
        alert(t("app.err.noReleasableOrders"));
        return;
      }

      const beforeList: SfcDetail[] = [];
      const afterList: SfcDetail[] = [];

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        console.log(t("app.log.iteration", { current: i + 1, total: orders.length, order: order.order }));

        const releaseResp = await ax.post("/api/sap/order-release", {
          plant: selectedPlant, order: order.order,
        });

        const sfcs = Array.isArray(releaseResp.data?.data?.sfcs) ? releaseResp.data.data.sfcs : [];
        if (sfcs.length === 0) {
          console.warn(t("app.log.noSfcForOrder", { order: order.order }));
          continue;
        }

        const sfc = sfcs[0].identifier;

        const tempDetail = await fetchSfcDetail(selectedPlant, sfc, "before");
        const operation  = tempDetail?.steps?.[0]?.operation?.operation ?? "";
        const workCenter = tempDetail?.steps?.[0]?.plannedWorkCenter ?? "";

        const beforeData = await fetchSfcDetail(selectedPlant, sfc, "before");
        beforeList.push(beforeData);

        const materialCode   = beforeData?.material?.material ?? "";
        const mappedResource = resourceMap[materialCode] || "";

        await callSapAlternateResourceChange({
          plant: selectedPlant, sfc, operationActivity: operation, resource: mappedResource, workCenter,
        });

        const sapPayload = {
          plant: selectedPlant.slice(0, 6), operation, resource: mappedResource,
          sfcs: [sfc.slice(0, 128)], processLot: "",
        };
        await callSapStartApi(sapPayload);

        const afterData = await fetchSfcDetail(selectedPlant, sfc, "after");
        afterList.push(afterData);
      }

      setDetailDataBefore(beforeList);
      setDetailDataAfter(afterList);
      alert(t("app.notice.releaseAndResourceDone"));
    } catch (err) {
      console.error("❌ 전체 처리 실패:", err);
      alert(t("app.err.processing"));
    }
  };

  const fetchSfcDetail = async (plant_cd: string, sfc: string, _type: "before" | "after"): Promise<SfcDetail> => {
    try {
      const ax = await getAxios();
      const res = await ax.get("/api/sap/sfc-detail", { params: { plant_cd, sfc } });
      return res.data;
    } catch (err: any) {
      console.error("❌ SAP SFC 상태 조회 실패:", err.response?.data || err.message);
      throw err;
    }
  };

  const callSapAlternateResourceChange = async ({
    plant, sfc, operationActivity, resource, workCenter
  }: { plant: string; sfc: string; operationActivity: string; resource: string; workCenter: string; }) => {
    try {
      const ax = await getAxios();
      const res = await ax.put(
        "/api/sap/alternate-resource",
        { operationActivity, resource, sfc, workCenter },
        { params: { plant } }
      );
      console.log(t("app.log.altResource.ok"), res.data);
    } catch (err: any) {
      console.error(t("app.log.altResource.fail"), err.response?.data || err.message);
    }
  };

  const callSapStartApi = async (payload: {
    plant: string; operation: string; resource: string; sfcs: string[]; processLot: string;
  }) => {
    try {
      console.log(t("app.log.sapStart.prep"));
      if (!getAccessToken()) { console.warn(t("app.log.token.missing")); await refreshToken(); }
      const token = getAccessToken(); if (!token) { console.error(t("app.log.token.fail")); return; }

      console.log(t("app.log.request.start"));
      console.log(t("app.log.request.url", { url: SAP_CONFIG.SFC_START_API }));
      console.log(t("app.log.request.payload", { json: JSON.stringify(payload) }));

      const ax = await getAxios();
      const res = await ax.post("/api/sap-start", payload);
      console.log(t("app.log.response.ok"), res.data);
    } catch (err: any) {
      const apiErr = err.response?.data?.error;
      console.error(t("app.log.response.error", { msg: apiErr?.message || err.message }));
      console.error(t("app.log.response.body", { json: JSON.stringify(err.response?.data || {}) }));
    }
  };

  const renderGrid = (dataList: SfcDetail[], titleKey: string) => (
    <div style={{ flex: 1 }}>
      <h3>{t(titleKey)}</h3>
      <table className="grid-table">
        <thead>
          <tr>
            <th>{t("app.table.sfc")}</th>
            <th>{t("app.table.material")}</th>
            <th>{t("app.table.version")}</th>
            <th>{t("app.table.bom")}</th>
            <th>{t("app.table.routing")}</th>
            <th>{t("app.table.quantity")}</th>
            <th>{t("app.table.operation")}</th>
            <th>{t("app.table.operationVersion")}</th>
            <th>{t("app.table.resource")}</th>
            <th>{t("app.table.plannedWC")}</th>
          </tr>
        </thead>
        <tbody>
          {dataList.length > 0 ? (
            dataList.flatMap((data, idx) =>
              data.steps.map((step, stepIdx) => (
                <tr key={`${idx}-${stepIdx}`}>
                  <td>{data.sfc}</td>
                  <td>{data.material?.material}</td>
                  <td>{data.material?.version}</td>
                  <td>{data.bom?.bom}</td>
                  <td>{data.routing?.routing}</td>
                  <td>{data.quantity}</td>
                  <td>{step.operation?.operation || ""}</td>
                  <td>{step.operation?.version || ""}</td>
                  <td>{step.resource || step.plannedWorkCenter || ""}</td>
                  <td>{step.plannedWorkCenter || ""}</td>
                </tr>
              ))
            )
          ) : (
            <tr><td colSpan={10} style={{ textAlign: "center" }}>{t("app.table.noData")}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ padding: "1rem" }}>
      <Bar
        design="Header"
        style={{
          backgroundColor: "#d0e5ff",
          padding: "0.5rem 1rem",
          border: "1px solid #ccc",
          position: "relative",          // ★ 추가: 우상단 배치용
        }}
      >
        <Label style={{ fontWeight: "bold", fontSize: "2.2rem" }}>
          {t("app.page.baseChange.title")}
        </Label>

        {/* ★ 추가: 우측 상단 뒤로가기 버튼 */}
        <img
          src={backIcon}
          alt="Back"
          title="Back"
          onClick={() => navigate(-1)}
          style={{
            position: "absolute",
            right: 16,
            top: 10,
            width: 48,
            height: 48,
            cursor: "pointer",
            userSelect: "none",
            opacity: 0.9,
          }}
        />
      </Bar>

      <FlexBox
        direction="Row"
        alignItems="Center"
        style={{ gap: "3rem", padding: "2rem", border: "1px solid #ccc", borderTop: "none" }}
      >
        <Label style={{ fontWeight: "bold", fontSize: "1.3rem" }}>{t("app.common.plant")}</Label>
        <select
          value={selectedPlant}
          className="common-select"
          style={{ width: "150px", fontSize: "1.2rem", padding: "0.5rem" }}
          onChange={(e) => setSelectedPlant(e.target.value)}
        >
          {plantList.map((item) => (
            <option key={item.CODE} value={item.CODE}>{item.CODE}</option>
          ))}
        </select>

        <Label style={{ fontWeight: "bold", fontSize: "1.3rem" }}>{t("app.common.workCenter")}</Label>
        <select
          value={selectedWorkcenter}
          className="common-select"
          style={{ width: "180px", fontSize: "1.2rem", padding: "0.5rem" }}
          onChange={(e) => setSelectedWorkcenter(e.target.value)}
        >
          {workcenterList.map((item) => (
            <option key={item.CODE} value={item.CODE}>{item.CODE}</option>
          ))}
        </select>
      </FlexBox>

      <FlexBox style={{ padding: "0 2rem 2rem 2rem" }}>
        <Button
          design="Emphasized"
          style={{ width: "200px", height: "3rem", fontSize: "1.2rem" }}
          onClick={handleSearch}
        >
          {t("app.button.resourceChange")}
        </Button>
      </FlexBox>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", padding: "1rem" }}>
        {renderGrid(detailDataBefore, "app.section.before")}
        {renderGrid(detailDataAfter, "app.section.after")}
      </div>
    </div>
  );
}
