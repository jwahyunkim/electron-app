// src\renderer\pages\E_ScanOutgoing_Detail_Y.tsx
import saveIcon from "@ui5/webcomponents-icons/dist/save.js";
import { useState, useEffect, useRef, useMemo } from "react";
// import axios from "axios";
import {
  Text,
  Button,
  Dialog,
  Toast,
} from "@ui5/webcomponents-react";
import "@sap-ui/common-css/dist/sap-content-paddings.css";
import "@sap-ui/common-css/dist/sap-container-type.css";

import okGreen from "@renderer/resources/E_Confirm_Ok.png";
import okOrange from "@renderer/resources/E_Confirm_Orange.png";
import okDodgerblue from "@renderer/resources/E_Confirm_Dodgerblue.png";
import okYellow from "@renderer/resources/E_Confirm_Yellow.png";
import okWhite from "@renderer/resources/E_Confirm_White.png";
import "./index.css";
import { SAP_CONFIG, getAccessToken, refreshToken } from "@shared/sap";
import pLimit from "p-limit";
import { t } from "../utils/i18n";
import { buildPassCardPayload, type GridRow, type Context } from "../utils/passcardMapping";
import { getAxios } from "../utils/api";

interface TableRow {
  stt: string;
  flag: string;
  c1_Qty: string;
  c1_Confirm_Yn: string;
  c1_Ps_Id: string;
  c2_qty: string;
  c2_Confirm_Yn: string;
  c2_Ps_Id: string;
}

interface CardItem {
  seq: number;
  qty: number;
  input_dt: string;
  prod_dt: string;
  confirm_YN: string;
  flag: string;
  sfc?: string;
  operation?: string;
  resource?: string;
  // ✅ 추가 필드들
  SCAN_TYPE?: string;
  PCARD_QTY?: number;

  // ✅ 원본 필드 (optional)
  q_quantity?: number;
  q_status_code?: string;
  q_sfc?: string;
  isSaving?: boolean;

  // ✅  mappedSFC는 SEQ별로 SFC를 매핑하기 위한 필드
  mappedSFC?: string;
}

interface SavePayloadItem {
  PLANT_CD: string;
  WORK_CENTER: string;
  ORDER_NUMBER: string;
  SEQ: string;
  MATERIAL_CODE: string;
  SIZE_CD: string;
  ITPO_TYPE: string;
  SFC: string;
  SCAN_TYPE: string;
  PCARD_QTY: number;
  USER_IP: string;
  DEVICE_ID: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: any;
  cellInfo: any;
  rows: TableRow[];
  onConfirm: (data: any[]) => void;
  plant_cd: string; // ✅ 추가
  work_date: string;
}

interface RoutingMaterial {
  material: string;
  version: string;
}
interface RoutingStepComponent {
  bomComponent?: {
    material?: RoutingMaterial;
  };
  quantity?: number;
}
interface RoutingStep {
  routingStepComponentList?: RoutingStepComponent[];
}

interface BomComponent {
  material?: {
    material: string;
    version: string;
  };
  quantity: number;
  totalQuantity?: number; // ✅ 이거 추가
  unitOfMeasure?: string; // ✅ 이 줄을 추가
  storageLocation?: string;
}

interface AutoActivityConfirmParams {
  plant: string;
  shopOrder: string;
  sfc: string;
  operationActivity: string;
  operationActivityVersion: string;
  stepId: string;
  workCenter: string;
  resource: string;
  routingId: string;
  finalConfirmation?: boolean;
  postConfirmationToErp?: boolean;
  postedBy: string;
  postingDateTime: string; // ISO format, e.g. '2025-07-08T09:00:00.000Z'
}

export function E_ScanOutgoing_Detail_Y({
  open,
  onClose,
  data,
  cellInfo,
  rows,
  onConfirm,
  plant_cd,
  work_date,
}: Props) {
  const limit = pLimit(5);
  const [cardData, setCardData] = useState<CardItem[]>([]);
  const originalCardDataRef = useRef<CardItem[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSfcMode, setIsSfcMode] = useState(false);
  const [minValidSfc, setMinValidSfc] = useState<string | null>(null); // ✅ 추가
  const orderedSfcListRef = useRef<string[]>([]);
  const stableSfc = useMemo(() => {
    return typeof data?.SFC === "string" ? data.SFC : "";
  }, [data]);
  const [localIp, setLocalIp] = useState<string>("");
  const [externalIp, setExternalIp] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  type FilterKey = "notStarted" | "inProgress" | "completed";

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: "notStarted", label: t("filter.notStarted") },
    { key: "inProgress", label: t("filter.inProgress") }, // ⚠️ 프로젝트에 키가 있어야 함
    { key: "completed", label: t("filter.completed") },
  ];

  const [checkedStates, setCheckedStates] = useState<Record<FilterKey, boolean>>({
    notStarted: false,
    inProgress: false,
    completed: false,
  });

  const COLUMN_COUNT = 2;
  const ROWS_PER_PAGE = 4; // ✅ 4행 = 8칸
  const CARD_ROW_HEIGHT = 90; // ✅ 카드 1행 높이(필요시 85~100로 조정)
  const ROW_GAP_PX = 8; // 행 간격

  // 기존 columnCount = 2 대체
  const columnCount = COLUMN_COUNT;

  // 기존 itemsPerPage = 8 대체
  const itemsPerPage = COLUMN_COUNT * ROWS_PER_PAGE;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 3000);
  };

  const filteredCardData = useMemo(() => {
    const { notStarted, inProgress, completed } = checkedStates;
    if (!notStarted && !inProgress && !completed) return cardData;

    return cardData.filter((card) => {
      const hasInput = !!card.input_dt;
      const hasProd = !!card.prod_dt;

      if (notStarted && !hasInput && !hasProd) return true;
      if (inProgress && hasInput && !hasProd) return true;
      if (completed && hasInput && hasProd) return true;

      return false;
    });
  }, [cardData, checkedStates]);

  const paginatedData = [...filteredCardData]
    .filter((x) => x.seq != null)
    .sort((a, b) => {
      const rank = (item: CardItem) => {
        const hasInput = !!item.input_dt;
        const hasProd = !!item.prod_dt;

        if (hasInput && !hasProd) return 0;
        if (!hasInput && !hasProd) return 1;
        return 2;
      };
      const aRank = rank(a);
      const bRank = rank(b);
      if (aRank !== bRank) return aRank - bRank;
      return a.seq - b.seq;
    })
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 항상 8개로 고정 (빈 칸 포함)
  const paddedData: (CardItem | null)[] = [...paginatedData];
  while (paddedData.length < itemsPerPage) {
    paddedData.push(null); // 빈 자리용
  }

  const rowsByColumns = Array.from(
    { length: Math.ceil(paddedData.length / columnCount) },
    (_, rowIndex) => paddedData.slice(rowIndex * columnCount, rowIndex * columnCount + columnCount)
  );

  const totalPages = Math.ceil(filteredCardData.length / itemsPerPage); // ✅ 체크박스 필터 결과 기준

  // (중략) — 데이터 로딩 주석 블록은 그대로 두었습니다.

  // ✅ React
  useEffect(() => {
    (async () => {
      try {
        const ax = await getAxios();
        const res = await ax.get("/api/devices/ports");
        console.log("📦 연결된 포트:", res.data);
      } catch (err) {
        console.error("❌ 포트 조회 오류:", err);
      }
    })();
  }, []);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const ax = await getAxios();
        const { data } = await ax.get("/api/get-ip", {
          headers: { Accept: "application/json" },
        });

        const local = String(data?.localIp ?? "");
        const external = String(data?.externalIp ?? "");

        setLocalIp(local);
        setExternalIp(external);

        // (선택) i18n 로그
        console.log(t("app.log.ip.local", { ip: local }));
        console.log(t("app.log.ip.external", { ip: external }));
      } catch (err: any) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        console.error("❌ IP 조회 실패", status ? `status=${status}` : "", body ?? err?.message ?? err);
        setLocalIp("");
        setExternalIp("");
      }
    };

    fetchIp();
  }, []);


  useEffect(() => {
    if (!open || !data) return;

    const loadData = async () => {
      try {
        const ax = await getAxios();

        const quantity = Number(data.QUANTITY || 0);
        const sfc = String(data.SFC || "").slice(0, 128);

        const fullCount = Math.floor(quantity / 12);
        const remainder = quantity % 12;

        // ✅ 기본 카드 생성
        const generatedCards: CardItem[] = [];

        for (let i = 0; i < fullCount; i++) {
          generatedCards.push({
            seq: i + 1,
            qty: 12,
            input_dt: "",
            prod_dt: "",
            confirm_YN: "N",
            flag: "ACTIVE",
            sfc,
            q_sfc: sfc,
            mappedSFC: sfc,
            operation: "",
            resource: "",
          });
        }

        if (remainder > 0) {
          generatedCards.push({
            seq: fullCount + 1,
            qty: remainder,
            input_dt: "",
            prod_dt: "",
            confirm_YN: "N",
            flag: "ACTIVE",
            sfc,
            q_sfc: sfc,
            mappedSFC: sfc,
            operation: "",
            resource: "",
          });
        }

        // ✅ MSSQL에서 저장된 스캔 데이터 가져오기
        const res = await ax.get("/api/mssql/escan-detail-v2", {
          params: {
            plant_cd: plant_cd,
            sfc_cd: sfc,
            work_center: data.WORK_CENTER,
          },
        });

        const savedScans = res.data as {
          SEQ: number;
          PCARD_QTY: number;
          INPUT_DT: string | null;
          PROD_DT: string | null;
        }[];

        // ✅ 카드에 덮어쓰기
        for (const scan of savedScans) {
          const seqNum = Number(scan.SEQ); // 🔥 핵심 수정
          const idx = generatedCards.findIndex((card) => card.seq === seqNum);
          if (idx === -1) continue;

          const card = generatedCards[idx];
          card.input_dt = scan.INPUT_DT ?? "";
          card.prod_dt = scan.PROD_DT ?? "";
          card.qty = scan.PCARD_QTY ?? card.qty;

          const hasInput = !!card.input_dt;
          const hasProd = !!card.prod_dt;
          card.confirm_YN = hasInput && hasProd ? "P" : hasInput ? "T" : "N";
        }

        // ✅ 상태 저장
        setCardData(generatedCards);
        originalCardDataRef.current = JSON.parse(JSON.stringify(generatedCards));
        setIsSfcMode(false);
        setMinValidSfc(sfc);
        orderedSfcListRef.current = [sfc];

        console.log("✅ 최종 카드 리스트:", generatedCards);
      } catch (err) {
        console.error("❌ 카드 생성 실패:", err);
      }
    };

    loadData();
  }, [open, data?.ORDER_NUMBER]);

  const handleDetailOk = (clickedCard: CardItem) => {
    // 🔒 이미 최종 상태면 클릭 자체 무시
    if (["TP", "P", "Y"].includes(clickedCard.confirm_YN)) {
      console.log("⛔ 클릭 제한 상태:", clickedCard.seq, clickedCard.confirm_YN);
      return;
    }

    setCardData((prev) =>
      prev.map((item) => {
        if (item.seq !== clickedCard.seq) return item;

        const { confirm_YN } = item;
        let next = confirm_YN;

        if (confirm_YN === "N") {
          next = "TT"; // 하얀 → 노란
        } else if (confirm_YN === "TT") {
          next = "T"; // 노란 → 파랑
        } else if (confirm_YN === "T") {
          next = "TP"; // 파랑 → 주황
        }

        console.log(`🟢 카드 상태 변경: ${item.seq} | ${confirm_YN} → ${next}`);
        return { ...item, confirm_YN: next };
      })
    );
  };

  const getColorByStatus = (status: string) => {
    switch (status) {
      case "Y":
      case "P":
        return "limegreen";
      case "T":
        return "dodgerblue";
      case "TP":
        return "orange";
      case "TT":
        return "yellow";
      case "N":
        return "#f5f5f5";
    }
  };

  const getImageByStatus = (status: string) => {
    switch (status) {
      case "P":
      case "Y":
        return okGreen;
      case "TP":
        return okOrange;
      case "T":
        return okDodgerblue;
      case "TT":
        return okYellow;
      case "N":
        return okWhite;
      default:
        return okWhite;
    }
  };

  const getModifiedRows = (original: CardItem[], current: CardItem[]) => {
    return current
      .map((cur, idx) => {
        const ori = original[idx];

        const normalizedCurStatus =
          cur.confirm_YN === "TP" ? "P" : cur.confirm_YN === "TT" ? "T" : cur.confirm_YN;

        const normalizedOriStatus =
          ori.confirm_YN === "TP" ? "T" : ori.confirm_YN === "TT" ? "N" : ori.confirm_YN;

        const isChanged = normalizedCurStatus !== normalizedOriStatus;

        // ✅ SCAN_TYPE 결정: input_dt가 없으면 'T', 있으면 'P'
        const scanType = cur.input_dt == null ? "T" : "P"; // ✅ 더 안전한 비교

        return {
          ...cur,
          confirm_YN: normalizedCurStatus,
          SCAN_TYPE: scanType,
          _changed: isChanged && ["T", "P"].includes(normalizedCurStatus),
        };
      })
      .filter((item) => item._changed)
      .map(({ _changed, ...rest }) => rest); // _changed 제거 후 반환
  };

  // ✅ 필터된 카드 중 수정된 것만 추출
  const filteredModifiedCards = useMemo(() => {
    const modified = getModifiedRows(originalCardDataRef.current, cardData);
    return modified.filter((card) => filteredCardData.some((f) => f.seq === card.seq));
  }, [cardData, filteredCardData]);

  // ✅ 필터된 카드 중 저장 가능한 것 추출 (N, T 상태)
  const filteredUpdatableCards = useMemo(() => {
    return filteredCardData.filter(
      (card) => (card.confirm_YN === "N" || card.confirm_YN === "T") && card.flag !== "FINISH"
    );
  }, [filteredCardData]);

  // ✅ 현재 선택된 SFC가 가장 빠른 SFC인지 여부 판단
  const isSingleSfc = orderedSfcListRef.current.length <= 1;
  const isClickable = isSingleSfc || (stableSfc !== "" && stableSfc === minValidSfc);

  // ✅ 현재 SFC가 제한된 상태인지 (저장 차단 조건)
  const isSfcBlocked = isSfcMode && !!minValidSfc && data.SFC !== minValidSfc;

  // ✅ 저장 가능 여부 (기존 조건 + 필터 적용)
  const canSaveDetail = filteredModifiedCards.length > 0 && !isSfcBlocked && isClickable;
  const canSaveAll = filteredUpdatableCards.length > 0 && !isSfcBlocked && isClickable;

  const isCardClickable = (card: CardItem): boolean => {
    if (!isSfcMode) return true;

    if (!data?.SFC) return false;

    if (minValidSfc && data.SFC !== minValidSfc) return false;

    return card.mappedSFC === data.SFC;
  };

  const callSapStartApi = async (payload: {
    plant: string;
    operation: string;
    resource: string;
    // quantity: number;
    sfcs: string[];
    processLot: string;
  }) => {
    try {
      console.log("🚀 [SAP START] 호출 준비 시작");

      if (!getAccessToken()) {
        console.warn("🔒 토큰 없음 → 토큰 새로 발급 시도 중...");
        await refreshToken();
      }

      const token = getAccessToken();
      if (!token) {
        console.error("❌ SAP 토큰 발급 실패 → API 호출 중단");
        return;
      }

      console.log("📡 [SAP START] 실제 호출 시작");
      console.log("🧾 호출 URL:", SAP_CONFIG.SFC_START_API);
      console.log("📦 요청 Payload:", JSON.stringify(payload, null, 2));
      console.log("🔑 토큰 일부:", token.slice(0, 10) + "...");

      const ax = await getAxios();
      const res = await ax.post("/api/sap-start", payload);

      console.log("✅ SAP 응답 수신 성공:", res.data);
    } catch (err: any) {
      const apiErr = err.response?.data?.error;
      console.error("❌ SAP 호출 오류:", apiErr?.message || err.message);
      console.error("📥 오류 응답 전체:", err.response?.data || "(응답 없음)");
    }
  };

  const callSapEndApi = async (payload: {
    plant: string;
    operation: string;
    resource: string;
    // quantity: number;
    sfcs: string[];
    processLot: string;
  }) => {
    try {
      console.log("🚀 [SAP End] 호출 준비 시작");

      if (!getAccessToken()) {
        console.warn("🔒 토큰 없음 → 토큰 새로 발급 시도 중...");
        await refreshToken();
      }

      const token = getAccessToken();
      if (!token) {
        console.error("❌ SAP 토큰 발급 실패 → API 호출 중단");
        return;
      }

      const ax = await getAxios();
      const res = await ax.post("/api/sap-complete", payload);

      console.log("✅ SAP 응답 수신 성공:", res.data);
    } catch (err: any) {
      const apiErr = err.response?.data?.error;
      console.error("❌ SAP 호출 오류:", apiErr?.message || err.message);
      console.error("📥 오류 응답 전체:", err.response?.data || "(응답 없음)");
    }
  };

  //v1
  const handlePostConfirm = async (cardsToSave: any[]) => {
    try {
      const ax = await getAxios();
      await ax.post("/api/mssql/escan-detail-save", { list: cardsToSave });
      setCardData((prev) =>
        prev.map((item) =>
          cardsToSave.some((c) => c.SEQ === item.seq.toString())
            ? { ...item, confirm_YN: "Y" }
            : item
        )
      );
    } catch (err) {
      showToast(t("toast.saveFailed"));
    }
  };

  const handlePostConfirm_V2 = async (cardsToSave: SavePayloadItem[]) => {
    try {
      const ax = await getAxios();
      await ax.post("/api/mssql/escan-detail-save_v2", {
        list: cardsToSave,
      });

      // ✅ 저장 성공 시 상태 업데이트
      setCardData((prev) =>
        prev.map((item) =>
          cardsToSave.some((c) => c.SEQ === item.seq.toString())
            ? { ...item, confirm_YN: "Y" }
            : item
        )
      );
    } catch (err) {
      console.error("❌ 저장 중 오류 발생:", err);
      showToast(t("toast.saveFailed"));
    }
  };

  const fetchSfcDetail = async (plant_cd: string, sfc: string) => {
    try {
      const ax = await getAxios();
      const res = await ax.get("/api/sap/sfc-detail", {
        params: { plant_cd, sfc },
      });
      return res.data;
    } catch (err: any) {
      console.error("❌ SAP SFC 상태 조회 실패:", err.response?.data || err.message);
      return null;
    }
  };

  const fetchPostedGoodsReceipts = async (
    plant: string,
    order: string,
    sfc: string,
    material: string,
    transactionIds: string[], // ← TxID 유무에 따라 필터링 여부 결정
    maxRetries = 30,
    delayMs = 1000
  ): Promise<any[]> => {
    const ax = await getAxios();
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await ax.get("/api/sap/goodsreceipts", {
          params: { plant, order, sfc, material },
        });

        const data = res.data as any;

        const result = Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
          ? data.content
          : Array.isArray(data?.lineItems)
          ? data.lineItems
          : [];

        // 🔍 POSTED 된 전체
        const postedOnly = data.filter((d: any) => d.status === "POSTED_TO_TARGET_SYS");

        // 🔍 TxID가 제공된 경우 → 매칭되는 게 있을 때만 리턴
        if (transactionIds.length > 0) {
          const matched = postedOnly.filter((d: any) => transactionIds.includes(d.transactionId?.trim?.()));

          if (matched.length > 0) {
            console.log(`✅ TxID 매칭된 입고 데이터 발견 (시도 ${attempt}회)`);
            console.table(
              matched.map((d: any) => ({
                order: d.order,
                sfc: d.sfc,
                txId: d.transactionId,
                qty: d.quantityInBaseUnit?.value,
              }))
            );
            return postedOnly; // 전체 POSTED 반환 (TxID 필터는 바깥에서 사용)
          }

          console.log(`⏳ TxID 매칭 결과 없음 (시도 ${attempt}회) → 재시도`);
          await new Promise((res) => setTimeout(res, delayMs));
        } else {
          // TxID가 없으면 바로 리턴 (전체 조회용)
          console.log(`✅ 전체 POSTED 입고 조회 (TxID 없음, ${postedOnly.length}건)`);
          return postedOnly;
        }
      } catch (err) {
        console.warn(`🚨 조회 실패 (시도 ${attempt}회):`, err);
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }

    console.warn("❌ 최대 재시도 초과. TxID 일치 입고 데이터 확인 불가");
    return [];
  };

  const callSapPostAssembledComponent = async ({
    plant,
    sfc,
    operationActivity,
    component,
    componentVersion,
    quantity,
    resource,
    sequence,
  }: {
    plant: string;
    sfc: string;
    operationActivity: string;
    component: string;
    componentVersion: string;
    quantity: number;
    resource: string;
    sequence: number;
  }) => {
    console.log("🚀 [SAP Assemble] 호출 시작");
    console.log("📦 요청 Payload:", {
      plant,
      sfc,
      operationActivity,
      component,
      componentVersion,
      quantity,
      resource,
      sequence,
    });

    try {
      // 토큰 체크 및 갱신
      if (!getAccessToken()) {
        console.warn("🔐 액세스 토큰 없음 → 토큰 갱신 시도 중...");
        await refreshToken();
      }

      const token = getAccessToken();
      if (!token) {
        console.error("❌ 액세스 토큰 획득 실패 → API 호출 중단");
        return;
      }

      // 실제 API 요청
      const payload = {
        plant,
        sfc,
        operationActivity,
        component,
        componentVersion,
        quantity,
        resource,
      };

      const url = "/api/sap-post-assembled";
      console.log("🌐 호출 URL:", url);

      const ax = await getAxios();
      const res = await ax.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("✅ SAP assembledComponents 호출 성공:", res.data);
    } catch (err: any) {
      const responseData = err?.response?.data || {};
      console.error("❌ SAP assembledComponents 호출 실패:", responseData.error || err.message);
      console.error("📥 전체 오류 응답:", responseData);
    }
  };

  //
  const callSapPostAssembledComponent_auto = async ({
    plant,
    sfc,
    operationActivity,
    quantity,
    resource,
    hasTimeBased = true, // ✅ 기본값 true
    hasNonTimeBased = true, // ✅ 기본값 true
  }: {
    plant: string;
    sfc: string;
    operationActivity: string;
    quantity: number;
    resource: string;
    hasTimeBased?: boolean; // ✅ 선택적 매개변수로 추가
    hasNonTimeBased?: boolean;
  }) => {
    console.log("🚀 [SAP Assemble] 호출 시작");
    const payload = {
      plant,
      operationActivity,
      quantity,
      resource,
      sfcs: [sfc], // ✅ 배열로 전달
      hasTimeBased,
      hasNonTimeBased,
    };

    try {
      if (!getAccessToken()) {
        console.warn("🔐 액세스 토큰 없음 → 토큰 갱신 시도 중...");
        await refreshToken();
      }

      const token = getAccessToken();
      if (!token) {
        console.error("❌ 액세스 토큰 획득 실패 → API 호출 중단");
        return;
      }

      const url = "/api/sap-post-assembled_auto";
      console.log("🌐 호출 URL:", url);
      console.log("📦 요청 Payload:", payload);

      const ax = await getAxios();
      const res = await ax.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("✅ SAP assembledComponents 호출 성공:", res.data);
    } catch (err: any) {
      const responseData = err?.response?.data || {};
      console.error("❌ SAP assembledComponents 호출 실패:", responseData.error || err.message);
      console.error("📥 전체 오류 응답:", responseData);
    }
  };

  //// ✅ SAP POST 투입 (Goods Issue) 호출
  const callSapPostGoodsIssue = async ({
    plant,
    order,
    phase,
    workCenter,
    component,
    componentVersion,
    quantity,
    unitOfMeasure,
    postedBy,
    postingDateTime,
    bomCode,
    bomVersion,
    inventoryId,
  }: {
    plant: string;
    order: string;
    phase: string;
    workCenter: string;
    component: string;
    componentVersion: string;
    quantity: number;
    unitOfMeasure: string;
    postedBy: string;
    postingDateTime: string;
    bomCode: string;
    bomVersion: string;
    inventoryId: string;
  }) => {
    try {
      const ax = await getAxios();
      const res = await ax.post("/api/sap-post-goodsissue", {
        plant,
        order,
        phase,
        workCenter,
        inventoryId, // ✅ 추가됨
        component: {
          material: {
            material: component,
            version: componentVersion,
          },
        },
        bom: {
          bom: bomCode,
          version: bomVersion,
        },
        isBomComponent: true,
        quantity,
        unitOfMeasure,
        postedBy,
        postingDateTime,
      });

      console.log("✅ goodsissue 성공", res.data);
    } catch (err: any) {
      console.error("❌ goodsissue 실패", err.response?.data || err.message);
    }
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const callSapPostGoodsReceipt = async ({
    plant,
    order,
    postedBy,
    lineItems,
  }: {
    plant: string;
    order: string;
    postedBy?: string;
    lineItems: {
      material: string;
      materialVersion?: string;
      postingDate: string;
      postingDateTime?: string;
      quantity: {
        unitOfMeasure: {
          commercialUnitOfMeasure: string;
          internalUnitOfMeasure: string;
          isoUnitOfMeasure: string;
        };
        value: number;
      };
      sfc: string;
      storageLocation: string;
    }[];
  }): Promise<any> => {
    console.log("🚀 [SAP GoodsReceipt] 호출 시작");
    console.log("📦 요청 Payload:", {
      plant,
      order,
      postedBy,
      lineItems,
    });

    const payload = {
      plant,
      order,
      postedBy: postedBy || "system",
      lineItems,
    };

    const url = "/api/sap-goods-receipt";
    let attempt = 0;

    const ax = await getAxios();

    while (true) {
      try {
        console.log(`🚀 [SAP GoodsReceipt] 시도 ${attempt + 1}회`);

        // ✅ 백엔드에만 요청, SAP 토큰은 백엔드에서 처리
        const res = await ax.post(url, payload, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        console.log("✅ SAP GoodsReceipt 호출 성공:", res.data);
        return res.data;
      } catch (err: any) {
        const responseData = err?.response?.data || {};
        console.error(`❌ 호출 실패 (${attempt + 1}회차):`, responseData.error || err.message);

        attempt++;

        if (attempt >= 10) {
          console.warn("⚠️ 10회 연속 실패 → 2초 후 루프 재시작");
          attempt = 0;
          await delay(2000); // 🔁 10회 실패 시 2초 대기
        } else {
          await delay(1000); // 🔁 일반 재시도 1초 대기
        }
      }
    }
  };

  //// ✅ SAP POST 자동 Activity Confirmation 호출
  const callSapPostAutoConfirm = async ({
    plant,
    shopOrder,
    sfc,
    operationActivity,
    operationActivityVersion,
    stepId,
    workCenter,
    resource,
    routingId,
    finalConfirmation,
    postConfirmationToErp,
    postedBy,
    postingDateTime,
  }: {
    plant: string;
    shopOrder: string;
    sfc: string;
    operationActivity: string;
    operationActivityVersion: string;
    stepId: string;
    workCenter: string;
    resource: string;
    routingId: string;
    finalConfirmation: boolean;
    postConfirmationToErp: boolean;
    postedBy: string;
    postingDateTime: string;
  }) => {
    try {
      const ax = await getAxios();
      const res = await ax.post("/api/sap-post-autoconfirm", {
        plant,
        shopOrder,
        sfc,
        operationActivity,
        operationActivityVersion,
        stepId,
        workCenter,
        resource,
        routingId,
        finalConfirmation,
        postConfirmationToErp,
        postedBy,
        postingDateTime,
      });

      console.log("✅ AutoActivityConfirm 성공", res.data);
    } catch (err: any) {
      console.error("❌ AutoActivityConfirm 실패", err.response?.data || err.message);
    }
  };

  /** PASSCARD Insert용 리스트 생성 헬퍼 (최종본) */
  async function buildEpcardInsertList({
    items,
    data,
    plant_cd,
    localIp,
  }: {
    items: CardItem[];
    data: any;
    plant_cd: string;
    localIp: string;
  }) {
    const opt = await window.config.getPasscardOptions?.().catch(() => undefined);
    const print =
      opt ?? {
        deviceName: "BIXOLON SRP-330II",
        preview: false,
        widthMicrons: 79_000,
        heightMicrons: 60_000,
        previewCountAsPrint: true,
      };

    const previewFlag = !!print.preview;
    const countPreview = print.previewCountAsPrint !== false; // 기본 true

    // 미리보기라도 카운트할지 여부 반영
    const markPrinted = previewFlag ? !!countPreview : true;

    const ensureDaySeq = (v: any) => {
      const s = String(v ?? "1H").trim();
      return s.endsWith("H") ? s : `${s}H`;
    };
    const nz = <T,>(v: T | undefined | null, d: T): T => v ?? d;

    // 날짜
    const now = new Date();
    const toYmd = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; // YYYYMMDD (char(8))
    };
    const nowYmd = toYmd(now);

    const confirmed = items.filter((it) => it.confirm_YN === "P");

    const list = confirmed.map((it) => {
      const row: GridRow = {
        ORDER_NUMBER: String(data.ORDER_NUMBER ?? ""),
        NEXT_ORDER_NUMBER: data.NEXT_ORDER_NUMBER ? String(data.NEXT_ORDER_NUMBER) : "",
        STYLE_CD: String(data.STYLE_CD ?? ""),
        STYLE_NAME: nz(data.MATERIAL_DESCRIPTION, "WMNS NIKE AIR MAX BOLT"),
        SIZE_CD: String(data.SIZE_CD ?? ""),
        RESOURCE_CD: String(data.WORK_CENTER ?? ""),
        NEXT_RESOURCE_CD: data.NEXT_RESOURCE_CD ? String(data.NEXT_RESOURCE_CD) : undefined,
        PCARD_QTY: Number(it.qty) || 0,
        PCARD_SEQ: Number(it.seq) || 0,
        MATERIAL_CODE: String(data.MATERIAL_CODE ?? data.MATERIAL ?? ""),
      };

      const ctx: Context = {
        PLANT_CD: plant_cd,
        BD_CD: nz(data.BD_CD, "IP"),
        OP_CD: nz(data.OP_CD, "IPIPI"),
        OP_NAME: nz(data.OP_NAME, "IP Injection"),
        DAY_SEQ: ensureDaySeq(data.DAY_SEQ),
        DEVICE_ID: nz(data.DEVICE_ID, "POP_DEVICE_01"),
        USER_IP: localIp || "0.0.0.0",
        SFC_CD: String(data.SFC ?? "").slice(0, 128),
        WORK_CENTER: String(data.WORK_CENTER ?? ""),
        PART_NAME: nz(data.PART_NAME, "MIDSOLE"),
      };

      const { insert } = buildPassCardPayload(row, ctx);

      // DB NOT NULL 보호
      (insert as any).CREATE_DATE = (insert as any).CREATE_DATE ?? nowYmd; // char(8)
      (insert as any).CREATE_DT = (insert as any).CREATE_DT ?? now; // datetime
      (insert as any).PRINT_DATE = (insert as any).PRINT_DATE ?? nowYmd; // char(8) or datetime(스키마에 맞춰 사용)
      (insert as any).PRINT_DT = (insert as any).PRINT_DT ?? now; // datetime

      if (markPrinted) {
        const cnt = Number(insert.PRINT_CNT ?? "0");
        insert.PRINT_YN = "Y";
        insert.PRINT_CNT = String(cnt + 1);
      } else {
        insert.PRINT_YN = insert.PRINT_YN ?? "N";
        insert.PRINT_CNT = insert.PRINT_CNT ?? "0";
      }

      return { ...insert, MARK_PRINTED: markPrinted };
    });

    return { list, print, previewFlag };
  }

  ////////////////////////////////////////////////////////////////Save_Detail///////////////////////////////////////////////////////////////////////
  const handleSaveDetail = async () => {
    const changed = getModifiedRows(originalCardDataRef.current, cardData);
    const filtered = changed.filter((item) => ["T", "P"].includes(item.confirm_YN));

    // ✅ 진행중 표시 (filtered 대상만)
    setCardData((prev) =>
      prev.map((item) =>
        filtered.some((f) => f.seq === item.seq) ? { ...item, isSaving: true } : item
      )
    );

    if (filtered.length === 0) return showToast(t("toast.noChanges"));
    const rawSfc = String(data?.SFC || "").slice(0, 128);

    if (!rawSfc) {
      console.error("❌ 유효하지 않은 SFC: null 또는 빈 문자열입니다.");
      showToast(t("toast.missingSfc"));
      return;
    }

    try {
      const ax = await getAxios();

      const payload = filtered.map((item) => ({
        PLANT_CD: plant_cd,
        WORK_CENTER: data.WORK_CENTER,
        ORDER_NUMBER: data.ORDER_NUMBER,
        SEQ: item.seq.toString(),
        MATERIAL_CODE: data.MATERIAL_CODE,
        SIZE_CD: data.SIZE_CD,
        ITPO_TYPE: item.confirm_YN,
        SFC: rawSfc,
        SCAN_TYPE: !item.input_dt ? "T" : "P",
        PCARD_QTY: item.qty,
        USER_IP: localIp || "0.0.0.0",
        DEVICE_ID: "POP_DEVICE_01",
      }));

      handlePostConfirm_V2(payload);

      onConfirm?.(payload);

      /* ★ PASSCARD 벌크 저장 + 실제 출력 (수정 최종본) */
      try {
        const { list, print, previewFlag } = await buildEpcardInsertList({
          items: filtered,
          data,
          plant_cd,
          localIp,
        });

        if (list.length === 0) {
          console.info("[PASSCARD] no rows to insert/print");
          return;
        }

        // 1) DB 인서트
        await ax.post("/api/mssql/epcard/print-bulk", { list });
        console.info("[PASSCARD] DB insert OK. now printing...", { count: list.length });

        // 2) 실제 출력: printBridge 우선, 없으면 ipc.invoke
        const bridge = (window as any)?.printBridge?.passcards as
          | ((jobs: any[], options: any) => Promise<any>)
          | undefined;

        const ipcInvoke:
          | undefined
          | ((ch: string, ...args: any[]) => Promise<any>) =
          (window as any)?.ipc?.invoke ?? (window as any)?.electron?.ipcRenderer?.invoke;

        const jobs = list;
        const options = {
          deviceName: print.deviceName,
          preview: !!previewFlag,
          widthMicrons: print.widthMicrons,
          heightMicrons: print.heightMicrons,
        };

        // 공용 타임아웃 래퍼
        const withTimeout = <T,>(p: Promise<T>, ms: number, tag: string) =>
          Promise.race([
            p,
            new Promise<T>((_, rej) => setTimeout(() => rej(new Error(tag)), ms)),
          ]) as Promise<T>;

        let res: any = null;
        if (typeof bridge === "function") {
          console.info("[PASSCARD] try printBridge.passcards(jobs, options)");
          res = await withTimeout(bridge(jobs, options), 15000, "bridge timeout");
        } else if (ipcInvoke) {
          console.info('[PASSCARD] try ipc.invoke("print:passcards", {jobs, options})');
          res = await withTimeout(
            ipcInvoke("print:passcards", { jobs, options }),
            15000,
            "ipc timeout"
          );
        } else {
          console.error(
            "❌ PASSCARD: no print bridge or ipc.invoke available (preload 미적용 가능)"
          );
        }

        console.info("[PASSCARD] print dispatched:", res ?? "ok");
      } catch (e) {
        console.error("❌ PASSCARD 벌크 저장/출력 실패:", e);
        setCardData((prev) =>
          prev.map((item) =>
            filtered.some((f) => f.seq === item.seq) ? { ...item, isSaving: false } : item
          )
        );
        showToast(t("toast.processError"));
        return;
      }

      //Sap Api 호출을 위한 필수 정보
      // 🔍 SAP SFC Detail 조회 → operation 값 동적 추출
      const sfcDetail = (await fetchSfcDetail(plant_cd, String(data.SFC).slice(0, 128))) as any;

      // 🔁 BOM 정보 추출
      const bomCode = sfcDetail?.bom?.bom;
      const rawBomType = sfcDetail?.bom?.type;
      // 🔁 BOM type 변환 (SAP → API expected)
      const bomType =
        rawBomType === "SHOPORDERBOM"
          ? "SHOP_ORDER"
          : rawBomType === "MASTERBOM"
          ? "MASTER"
          : rawBomType === "SFCBOM"
          ? "SFC"
          : undefined;

      if (!bomCode || !bomType) {
        console.warn("❗ BOM 정보가 없거나 타입 변환 실패");
        return showToast(t("toast.noBomInfo"));
      }

      const operation = sfcDetail?.steps?.[0]?.operation?.operation;
      const step = sfcDetail?.steps?.[0];
      const stepId = step?.stepId; //Activity Comfirmation사용
      const routing = step?.stepRouting?.routing; //Activity Comfirmation사용
      const resource = step?.resource;
      const operation_Version = step?.operation?.version;
      const totalQuantity = Number(sfcDetail.quantity ?? 0);
      if (!operation) {
        console.error("❌ operation 정보를 가져올 수 없습니다.");
        throw new Error("SFC의 operation 정보를 확인할 수 없습니다.");
      }

      // 2. 📦 SAP BOM API 호출 및 구성품 추출
      let components: {
        component: string;
        componentVersion: string;
        quantity: number;
        totalQuantity?: number | null; // 🔧 이 줄을 추가
        unitOfMeasure: string;
        storageLocation: string;
      }[] = [];
      let baseUnitOfMeasure = "";
      let bomVersion = "";
      let resolvedBomCode = "";

      try {
        const bomResp = await ax.get("/api/sap/bom-detail", {
          params: {
            plant: plant_cd,
            bom: bomCode,
            type: bomType,
          },
        });

        const bomData = Array.isArray(bomResp.data) ? bomResp.data[0] : bomResp.data;
        console.log("📦 [RAW_BOM_DATA]", JSON.stringify(bomData, null, 2));

        baseUnitOfMeasure = bomData?.baseUnitOfMeasure;
        resolvedBomCode = bomData?.bom ?? "";
        bomVersion = bomData?.version ?? "";

        if (!Array.isArray(bomData?.components)) {
          console.warn("❗ BOM components 데이터가 없습니다.");
          return showToast(t("toast.noBomComponents"));
        }

        components = (bomData.components as BomComponent[])
          .map((comp) => {
            const component = comp.material?.material ?? "";
            const componentVersion = comp.material?.version ?? "";
            const quantity = comp.quantity;
            const totalQuantity = comp.totalQuantity ?? null;
            const unitOfMeasure = comp.unitOfMeasure ?? "";
            const storageLocation = comp.storageLocation ?? "";

            if (!component || !componentVersion || quantity == null) return null;

            return {
              component,
              componentVersion,
              quantity,
              totalQuantity,
              unitOfMeasure,
              storageLocation,
            };
          })
          .filter(
            (c): c is {
              component: string;
              componentVersion: string;
              quantity: number;
              totalQuantity: number | null;
              unitOfMeasure: string;
              storageLocation: string;
            } => c !== null
          );

        console.log("🧩 BOM에서 추출된 components:", components);
      } catch (err) {
        console.error("❌ BOM Detail 조회 실패", err);
        return showToast(t("toast.loadBomFailed"));
      }

      // ✅ SAP START 호출 조건: 모든 카드에 input_dt 없을 때만
      const hasAnyInput = cardData.some((c) => !!c.input_dt);
      if (!hasAnyInput) {
        const sapPayload = {
          plant: plant_cd.slice(0, 6),
          operation,
          resource: String(data.WORK_CENTER ?? "").slice(0, 36),
          // quantity: Number(data.QUANTITY ?? 0),
          // quantity: 0,
          sfcs: [String(data.SFC ?? "").slice(0, 128)],
          processLot: "",
        };
        await callSapStartApi(sapPayload);
      }

      // 🎯 1. 전체 수량 합산 (for문 밖에서 미리 계산)
      const totalQty = filtered
        .filter((item) => item.confirm_YN === "P")
        .reduce((sum, item) => sum + Number(item.qty || 0), 0);

      // ✅ 사용된 SEQ 리스트 추출
      const usedSeqList = filtered.filter((item) => item.confirm_YN === "P").map((item) => item.seq);

      // 🎯 2. 첫 P 카드만 사용해서 for 루프 안에서 1회만 처리
      let sapPosted = false;

      for (const item of filtered) {
        if (item.confirm_YN === "P" && !sapPosted) {
          console.log("✅ GoodsReceipt 진입 (합산 처리)");

          // 🎯 단일 처리 기준 정보는 첫 item에서 추출
          const rawSfc = String(data.SFC ?? "").slice(0, 128);
          const workDate = work_date;
          const storageLocation = String(data.PUTAWAYSTORAGELOCATION ?? "").slice(0, 10);
          const orderNumber = String(data.ORDER_NUMBER ?? "").slice(0, 12);
          const materialCode = data.MATERIAL_CODE;
          const materialVersion = data.MATERIAL_VERSION || "ERP001";

          // 🎯 단위코드 조회 (기존 그대로)
          let uomData: any = null;
          try {
            const uomResp = await ax.get("/api/sap/unit-codes", {
              params: { unitCode: baseUnitOfMeasure },
            });
            const matched = Array.isArray(uomResp.data) ? uomResp.data[0] : uomResp.data;
            if (!matched || !matched.unitCode) throw new Error("단위코드 조회 실패");
            uomData = matched;
          } catch (err) {
            console.error("❌ 단위코드 조회 실패:", err);
            return showToast(t("toast.loadUomFailed"));
          }

          const getPreferredCommercialCode = (codes: any[] = []) => {
            const preferredLanguages = ["ko", "en"];
            for (const lang of preferredLanguages) {
              const match = codes.find((c: any) => c.language === lang);
              if (match?.commercialCode) return match.commercialCode;
            }
            return codes[0]?.commercialCode || baseUnitOfMeasure;
          };

          const unitOfMeasure = {
            commercialUnitOfMeasure: getPreferredCommercialCode(uomData?.commercialCodes),
            internalUnitOfMeasure: baseUnitOfMeasure,
            isoUnitOfMeasure: uomData?.isoCode || baseUnitOfMeasure,
          };

          try {
            const response = await callSapPostGoodsReceipt({
              plant: plant_cd,
              order: orderNumber,
              postedBy: "dmc_services_user",
              lineItems: [
                {
                  material: materialCode,
                  materialVersion,
                  postingDate: workDate,
                  quantity: {
                    unitOfMeasure,
                    value: totalQty,
                  },
                  sfc: rawSfc,
                  storageLocation,
                },
              ],
            });

            // 📦 이후 응답 및 TxID 처리, Confirm, Final 확인 등 → 전부 그대로 유지
            const transactionIds = Array.isArray(response?.lineItems)
              ? response.lineItems
                  .filter((item: any) => item?.transactionId && !item?.hasError)
                  .map((item: any) => item.transactionId)
              : [];

            if (!transactionIds.length) {
              console.error("❌ 유효한 트랜잭션 ID 없음 → 조회 중단");
              return;
            }

            const allPostedReceipts = await fetchPostedGoodsReceipts(
              plant_cd,
              orderNumber,
              rawSfc,
              materialCode,
              transactionIds
            );

            const postedMatchedTxIds = new Set<string>(
              allPostedReceipts
                .filter((gr: any) => transactionIds.includes(gr.transactionId?.trim?.()))
                .map((gr: any) => gr.transactionId?.trim?.())
            );

            const postedQty = allPostedReceipts
              .filter((gr: any) => !postedMatchedTxIds.has(gr.transactionId?.trim?.()))
              .reduce((sum, gr) => sum + Number(gr.quantityInBaseUnit?.value ?? 0), 0);

            const currentProcessingQty = allPostedReceipts
              .filter((gr: any) => postedMatchedTxIds.has(gr.transactionId?.trim?.()))
              .reduce((sum, gr) => sum + Number(gr.quantityInBaseUnit?.value ?? 0), 0);

            const totalDone = Math.round((postedQty + currentProcessingQty) * 1000) / 1000;
            const isFinal = Math.abs(totalQuantity - totalDone) < 0.001;

            console.log("📦 입고 누적 수량 체크");
            console.log(`   🔹 총 수량 (SFC 기준): ${totalQuantity}`);
            console.log(`   🔹 누적 입고 수량 (POSTED): ${postedQty}`);
            console.log(`   🔹 현재 처리 중 수량 (TxID 매칭): ${currentProcessingQty}`);
            console.log(`   🔹 누적 합계: ${totalDone}`);
            console.log(`   🔹 잔량: ${Math.max(0, totalQuantity - totalDone)}`);
            console.log(`   🔹 Final 여부: ${isFinal ? "✅ Final" : "⏳ 미완료"}`);

            // ✅ QuantityConfirm 1회 호출
            try {
              const qtyConfirmResp = await ax.post("/api/sap-post-qty-confirm", {
                plant: plant_cd,
                shopOrder: orderNumber,
                sfc: rawSfc,
                operationActivity: operation,
                workCenter: data.WORK_CENTER,
                yieldQuantity: totalQty,
                yieldQuantityUnit: unitOfMeasure.internalUnitOfMeasure,
                yieldQuantityIsoUnit: unitOfMeasure.isoUnitOfMeasure,
                isFinalConfirmation: isFinal,
              });

              console.log("✅ Quantity Confirmation 성공:", qtyConfirmResp.data);
            } catch (qcErr) {
              const err = qcErr as any;
              console.error("❌ Quantity Confirmation 실패:", err.response?.data || err.message);
            }

            if (isFinal) {
              // 2025.07.18 설정 문제로 인한 추후 처리
              const postingDateTime = new Date(Date.now())
                .toISOString()
                .replace(/\.\d{3}Z$/, ".000Z");

              try {
                await callSapPostAutoConfirm({
                  plant: plant_cd,
                  shopOrder: orderNumber,
                  sfc: rawSfc,
                  operationActivity: operation,
                  operationActivityVersion: operation_Version,
                  stepId: stepId ?? "",
                  workCenter: data.WORK_CENTER,
                  resource: resource,
                  routingId: routing ?? "",
                  finalConfirmation: true,
                  postConfirmationToErp: true,
                  postedBy: "dongil.kang@changshininc.com",
                  postingDateTime,
                });
                console.log("✅ AutoActivityConfirm 성공");
              } catch (autoErr) {
                console.error("❌ AutoActivityConfirm 실패:", autoErr);
              }

              try {
                const finalConfirmResp = await ax.post("/api/sap-post-final-confirm", {
                  plant: plant_cd,
                  shopOrder: orderNumber,
                  sfc: rawSfc,
                  operationActivity: operation,
                });
                console.log("✅ Final Quantity Confirmation 성공:", finalConfirmResp.data);
              } catch (finalErr) {
                console.error("❌ FinalConfirm 실패:", finalErr);
              }
            }
          } catch (err) {
            console.error("❌ SAP GoodsReceipt 처리 중 오류:", err);
            showToast(t("toast.processError"));
            return;
          }

          try {
            console.log("📦 파라미터 확인:", {
              plant_cd,
              sfc: rawSfc,
              scan_type: item.confirm_YN,
              seqList: usedSeqList,
            });
            const uploadResp = await ax.post("/api/mssql/update-upload-yn", {
              plant_cd: plant_cd,
              sfc: rawSfc,
              scan_type: item.confirm_YN,
              seqList: usedSeqList,
            });

            console.log("✅ MSSQL 업로드 상태 업데이트 성공:", uploadResp.data);
          } catch (uploadErr) {
            console.error("❌ MSSQL 업로드 상태 업데이트 실패:", uploadErr);
          }
          // 🎯 이후 반복 방지
          sapPosted = true;
        }
      }
    } catch (err) {
      console.error("❌ SaveDetail 처리 오류:", err);
      showToast(t("toast.processError"));
    } finally {
      // ✅ 여기: 진행중 해제 위치
      setCardData((prev) =>
        prev.map((item) =>
          filtered.some((f) => f.seq === item.seq) ? { ...item, isSaving: false } : item
        )
      );
      onClose();
    }
  };

  // ✅ Save All 구현 - 카드별 상태에 따라 T / P 분기 처리
  const handleSaveAll = async () => {
    const currentSfc = minValidSfc;
    // 1. 상태 업데이트 (N → T, T+prod → P)
    const updatedData = cardData.map((item) => {
      if (item.confirm_YN === "N" && !item.input_dt) {
        return { ...item, confirm_YN: "T" };
      }
      if (item.confirm_YN === "T" && item.input_dt && !item.prod_dt) {
        return { ...item, confirm_YN: "P" };
      }

      return item;
    });
    setCardData(updatedData);
    await new Promise((r) => setTimeout(r, 0));

    const filtered = updatedData.filter(
      (x) =>
        x.mappedSFC === currentSfc &&
        ["T", "P"].includes(x.confirm_YN) &&
        x.flag !== "FINISH" &&
        !x.prod_dt // 🎯 아직 생산 미처리된 카드만 포함
    );

    // ✅ 진행중 표시 (filtered 대상만)
    setCardData((prev) =>
      prev.map((item) =>
        filtered.some((f) => f.seq === item.seq) ? { ...item, isSaving: true } : item
      )
    );

    const rawSfc = String(data?.SFC || "").slice(0, 128);

    if (!rawSfc) {
      console.error("❌ 유효하지 않은 SFC: null 또는 빈 문자열입니다.");
      showToast(t("toast.missingSfc"));
      return;
    }
    if (filtered.length === 0) return showToast(t("toast.nothingToConfirm"));

    try {
      const ax = await getAxios();

      const payload = filtered.map((item) => ({
        PLANT_CD: plant_cd,
        WORK_CENTER: data.WORK_CENTER,
        ORDER_NUMBER: data.ORDER_NUMBER,
        SEQ: item.seq.toString(),
        MATERIAL_CODE: data.MATERIAL_CODE,
        SIZE_CD: data.SIZE_CD,
        ITPO_TYPE: item.confirm_YN,
        SFC: rawSfc,
        SCAN_TYPE: !item.input_dt ? "T" : "P",
        PCARD_QTY: item.qty,
        USER_IP: localIp || "0.0.0.0",
        DEVICE_ID: "POP_DEVICE_01",
      }));

      handlePostConfirm_V2(payload);

      onConfirm?.(payload);

      /* ★ PASSCARD 벌크 저장 + 실제 출력 — P 전용 & 전체 플로우 방해 금지 */
      const itemsForPrint = filtered.filter((it) => it.confirm_YN === "P");

      if (itemsForPrint.length === 0) {
        console.info("[PASSCARD] skip print (no P rows)");
      } else {
        try {
          const { list, print, previewFlag } = await buildEpcardInsertList({
            items: itemsForPrint,
            data,
            plant_cd,
            localIp,
          });

          if (list.length === 0) {
            console.info("[PASSCARD] nothing to insert/print (empty list from builder)");
            // ❗ 여기서 절대 return 하지 않음 — 아래 로직 계속 진행
          } else {
            // 1) DB 인서트
            await ax.post("/api/mssql/epcard/print-bulk", { list });
            console.info("[PASSCARD] DB insert OK. now printing...", { count: list.length });

            // 2) 실제 출력: printBridge 우선, 없으면 IPC
            const bridge = (window as any)?.printBridge?.passcards as
              | ((jobs: any[], options: any) => Promise<any>)
              | undefined;

            const ipcInvoke:
              | undefined
              | ((ch: string, ...args: any[]) => Promise<any>) =
              (window as any)?.ipc?.invoke ?? (window as any)?.electron?.ipcRenderer?.invoke;

            const jobs = list;
            const options = {
              deviceName: print.deviceName,
              preview: !!previewFlag, // 컨피그/빌더에서 온 프리뷰만 사용
              widthMicrons: print.widthMicrons,
              heightMicrons: print.heightMicrons,
            };

            // 타임아웃 가드: 인쇄 지연이 있어도 전체 플로우는 계속
            const withTimeout = <T,>(p: Promise<T>, ms: number, tag: string) =>
              Promise.race([
                p,
                new Promise<T>((_, rej) => setTimeout(() => rej(new Error(tag)), ms)),
              ]) as Promise<T>;

            let res: any = null;
            if (typeof bridge === "function") {
              console.info("[PASSCARD] try printBridge.passcards(jobs, options)");
              res = await withTimeout(bridge(jobs, options), 15000, "bridge timeout");
            } else if (ipcInvoke) {
              console.info('[PASSCARD] try ipc.invoke("print:passcards", {jobs, options})');
              res = await withTimeout(
                ipcInvoke("print:passcards", { jobs, options }),
                15000,
                "ipc timeout"
              );
            } else {
              console.error(
                "❌ PASSCARD: no print bridge or ipc.invoke available (preload missing?)"
              );
            }

            console.info("[PASSCARD] print dispatched:", res ?? "ok");
          }
        } catch (e) {
          // ❗ 인쇄 단계 오류는 전체 진행을 막지 않음
          console.warn("⚠️ PASSCARD print step failed (continue flow):", e);
          // 필요하면 사용자 알림 완화
          // showToast(t("toast.printSkipped"));
        } finally {
          // 여기선 아무것도 반환하지 않음
        }
      }

      //Sap Api 호출을 위한 필수 정보
      // 🔍 SAP SFC Detail 조회 → operation 값 동적 추출
      const sfcDetail = (await fetchSfcDetail(plant_cd, String(data.SFC).slice(0, 128))) as any;

      // 🔁 BOM 정보 추출
      const bomCode = sfcDetail?.bom?.bom;
      const rawBomType = sfcDetail?.bom?.type;
      // 🔁 BOM type 변환 (SAP → API expected)
      const bomType =
        rawBomType === "SHOPORDERBOM"
          ? "SHOP_ORDER"
          : rawBomType === "MASTERBOM"
          ? "MASTER"
          : rawBomType === "SFCBOM"
          ? "SFC"
          : undefined;

      if (!bomCode || !bomType) {
        console.warn("❗ BOM 정보가 없거나 타입 변환 실패");
        return showToast(t("toast.noBomInfo"));
      }

      const operation = sfcDetail?.steps?.[0]?.operation?.operation;
      const step = sfcDetail?.steps?.[0];
      const stepId = step?.stepId; //Activity Comfirmation사용
      const routing = step?.stepRouting?.routing; //Activity Comfirmation사용
      const resource = step?.resource;
      const operation_Version = step?.operation?.version;
      const totalQuantity = Number(sfcDetail.quantity ?? 0);
      if (!operation) {
        console.error("❌ operation 정보를 가져올 수 없습니다.");
        throw new Error("SFC의 operation 정보를 확인할 수 없습니다.");
      }

      // 2. 📦 SAP BOM API 호출 및 구성품 추출
      let components: {
        component: string;
        componentVersion: string;
        quantity: number;
        totalQuantity?: number | null; // 🔧 이 줄을 추가
        unitOfMeasure: string;
        storageLocation: string;
      }[] = [];
      let baseUnitOfMeasure = "";
      let bomVersion = "";
      let resolvedBomCode = "";

      try {
        const bomResp = await ax.get("/api/sap/bom-detail", {
          params: {
            plant: plant_cd,
            bom: bomCode,
            type: bomType,
          },
        });

        const bomData = Array.isArray(bomResp.data) ? bomResp.data[0] : bomResp.data;
        console.log("📦 [RAW_BOM_DATA]", JSON.stringify(bomData, null, 2));

        baseUnitOfMeasure = bomData?.baseUnitOfMeasure;
        resolvedBomCode = bomData?.bom ?? "";
        bomVersion = bomData?.version ?? "";

        if (!Array.isArray(bomData?.components)) {
          console.warn("❗ BOM components 데이터가 없습니다.");
          return showToast(t("toast.noBomComponents"));
        }

        components = (bomData.components as BomComponent[])
          .map((comp) => {
            const component = comp.material?.material ?? "";
            const componentVersion = comp.material?.version ?? "";
            const quantity = comp.quantity;
            const totalQuantity = comp.totalQuantity ?? null;
            const unitOfMeasure = comp.unitOfMeasure ?? "";
            const storageLocation = comp.storageLocation ?? "";

            if (!component || !componentVersion || quantity == null) return null;

            return {
              component,
              componentVersion,
              quantity,
              totalQuantity,
              unitOfMeasure,
              storageLocation,
            };
          })
          .filter(
            (c): c is {
              component: string;
              componentVersion: string;
              quantity: number;
              totalQuantity: number | null;
              unitOfMeasure: string;
              storageLocation: string;
            } => c !== null
          );

        console.log("🧩 BOM에서 추출된 components:", components);
      } catch (err) {
        console.error("❌ BOM Detail 조회 실패", err);
        return showToast(t("toast.loadBomFailed"));
      }

      // ✅ SAP START 호출 조건: 모든 카드에 input_dt 없을 때만
      const hasAnyInput = cardData.some((c) => !!c.input_dt);
      if (!hasAnyInput) {
        await callSapStartApi({
          plant: plant_cd,
          operation,
          resource: data.WORK_CENTER,
          sfcs: [rawSfc],
          processLot: "",
        });
      }

      // ✅ UOM 정보
      const uomResp = await ax.get("/api/sap/unit-codes", {
        params: { unitCode: baseUnitOfMeasure },
      });

      const uomData = Array.isArray(uomResp.data) ? uomResp.data[0] : uomResp.data;
      const unitOfMeasure = {
        commercialUnitOfMeasure: uomData?.commercialCodes?.[0]?.commercialCode || baseUnitOfMeasure,
        internalUnitOfMeasure: baseUnitOfMeasure,
        isoUnitOfMeasure: uomData?.isoCode || baseUnitOfMeasure,
      };

      // ✅ GoodsReceipt 처리
      const totalQty = filtered
        .filter((item) => item.confirm_YN === "P")
        .reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const orderNumber = data.ORDER_NUMBER;
      const storageLocation = data.PUTAWAYSTORAGELOCATION || "";
      const workDate = work_date;

      const grResp = await callSapPostGoodsReceipt({
        plant: plant_cd,
        order: orderNumber,
        postedBy: "dmc_services_user",
        lineItems: [
          {
            material: data.MATERIAL_CODE,
            materialVersion: data.MATERIAL_VERSION || "ERP001",
            postingDate: workDate,
            quantity: {
              unitOfMeasure,
              value: totalQty,
            },
            sfc: rawSfc,
            storageLocation,
          },
        ],
      });

      // ✅ TxID 기반 POSTED 여부 조회
      const transactionIds = (grResp?.lineItems || [])
        .filter((item: any) => item?.transactionId && !item?.hasError)
        .map((item: any) => item.transactionId);

      const posted = await fetchPostedGoodsReceipts(
        plant_cd,
        orderNumber,
        rawSfc,
        data.MATERIAL_CODE,
        transactionIds
      );
      const postedMatched = new Set(posted.map((d: any) => d.transactionId));

      const postedQty = posted.reduce(
        (sum, d: any) => sum + Number(d.quantityInBaseUnit?.value || 0),
        0
      );
      const isFinal = Math.abs(totalQuantity - postedQty) < 0.001;

      // ✅ QuantityConfirm
      await ax.post("/api/sap-post-qty-confirm", {
        plant: plant_cd,
        shopOrder: orderNumber,
        sfc: rawSfc,
        operationActivity: operation,
        workCenter: data.WORK_CENTER,
        yieldQuantity: totalQty,
        yieldQuantityUnit: unitOfMeasure.internalUnitOfMeasure,
        yieldQuantityIsoUnit: unitOfMeasure.isoUnitOfMeasure,
        isFinalConfirmation: isFinal,
      });

      // ✅ FinalConfirm (if last)
      if (isFinal) {
        // 2025.07.18 설정 문제로 인한 추후 처리
        // ... (주석 보존)
      }

      let standardValueObj: any = null;

      try {
        // 표준시간은 N 버전에서 fetchStandardValueObject 사용했지만
        // Y 버전은 기존 로직을 그대로 두었습니다(주석/로직 유지 목적).
        // 필요 시 동일 헬퍼를 가져와 호출하도록 확장 가능.
      } catch (err: any) {
        console.error("❌ Standard Value 조회 실패:", err.response?.data || err.message);
      }

      // Upload YN 업데이트
      const seqList = filtered.map((item) => item.seq);
      await ax.post("/api/mssql/update-upload-yn", {
        plant_cd,
        sfc: rawSfc,
        scan_type: "P",
        seqList,
      });

      showToast(t("toast.saveAllDone"));
    } catch (err) {
      console.error("❌ SaveAll 처리 오류:", err);
      showToast(t("toast.saveAllError"));
    } finally {
      // ✅ 여기: 진행중 해제 위치
      setCardData((prev) =>
        prev.map((item) =>
          filtered.some((f) => f.seq === item.seq) ? { ...item, isSaving: false } : item
        )
      );
      onClose();
    }
  };

  // ✅ mappedSFC 기준으로 선택된 SFC의 총 생산 수량을 계산
  function calculateSfcTotalProdQty(sfc: string, cardList: CardItem[]): number {
    if (!sfc || !Array.isArray(cardList)) return 0;

    return cardList
      .filter((card) => card.mappedSFC === sfc)
      .reduce((sum, card) => sum + (Number(card.qty) || 0), 0);
  }

  const buttonStyle = {
    width: "120px",
    height: "90px",
    backgroundColor: "#333",
    color: "white",
    fontWeight: "bold",
    fontSize: "20px",
  };

  const cardBlock = (data: CardItem | null) => {
    if (!data) return <div style={{ height: "80px" }}></div>;

    const backgroundColor = getColorByStatus(data.confirm_YN);
    const clickable = isCardClickable(data); // ✅ mappedSFC === data.SFC 기준
    const isSaving = data.isSaving === true;

    return (
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          width: "100%",
          height: "80px",
          pointerEvents: clickable ? "auto" : "none",
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: "10px",
            border: "none",
            backgroundColor,
            lineHeight: "1.2rem",
            color: "black",
            fontWeight: "bold",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "6px",
            boxShadow: "inset 0 0 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          {isSaving ? (
            <div
              style={{
                fontSize: "2rem", // ✅ 글자 크게
                fontWeight: "bold",
                color: "#d9534f",
                lineHeight: "2rem", // ✅ 세로 공간 키움
                minHeight: "80px", // ✅ 카드 전체 높이와 맞춤
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              {t("ui.inProgress")} <br />
            </div>
          ) : (
            <>
              <div>
                {t("detail.pcSeq")} : {data.seq} <br />
                {t("detail.qty")} : {isNaN(data.qty) ? "-" : data.qty}
              </div>
              <div>
                {t("detail.input")} : {data.input_dt || "-"} <br />
                {t("detail.prod")} : {data.prod_dt || "-"}
              </div>
            </>
          )}
        </div>

        {isSaving ? (
          <div
            style={{
              width: "60px",
              height: "60px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.9rem",
              fontWeight: "bold",
              color: "#d9534f", // 빨간 느낌
              border: "2px dashed red",
              borderRadius: "10px",
              textAlign: "center",
              lineHeight: "1rem",
            }}
          >
            ⏳
            <br />
            {t("ui.inProgressShort")}
          </div>
        ) : (
          <img
            src={getImageByStatus(data.confirm_YN)}
            alt="OK"
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "10px",
              cursor: clickable ? "pointer" : "not-allowed",
              opacity: clickable ? 1 : 0.4,
              objectFit: "contain",
              pointerEvents: clickable ? "auto" : "none",
            }}
            onClick={() => {
              if (["TT", "TP", "P", "Y"].includes(data.confirm_YN)) {
                console.log("⛔ 클릭 차단 상태", data.seq, data.confirm_YN);
                return;
              }

              console.log("✅ 클릭 허용됨", data.seq);
              console.log("🔹 confirm_YN:", data.confirm_YN);
              handleDetailOk(data);
            }}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <Toast open={toastOpen}>{toastMessage}</Toast>
      <Dialog
        open={open}
        onClose={onClose}
        style={{
          width: "860px",
          height: "85vh",
          backgroundColor: "black",
          color: "white",
          overflowX: "hidden",
        }}
      >
        <div style={{ padding: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              gap: "1.6rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                backgroundColor: "black",
                color: "white",
                fontSize: "13px",
                minWidth: "220px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  border: "1px solid white",
                }}
              >
                <tbody>
                  {Object.entries({
                    Date: data?.WORK_DATE ?? "-",
                    Line: data?.WORK_CENTER ?? "-",
                    Model: data?.MODEL_CD ?? "-",
                    Style: data?.STYLE_CD ?? "-",
                    Material: data?.MATERIAL_CODE ?? "-",
                    Description: data?.MATERIAL_DESCRIPTION ?? "-",
                    SFC: data?.SFC ?? "-",
                    Qty: data?.QUANTITY ?? "-",
                    Size: data?.SIZE_CD ?? "-",
                    "Order No.": data?.ORDER_NUMBER ?? "-",
                    Storage: data?.PUTAWAYSTORAGELOCATION ?? "-",
                  }).map(([key, value]) => (
                    <tr key={key}>
                      <td
                        style={{
                          width: "100px",
                          fontWeight: "bold",
                          padding: "6px 8px",
                          border: "1px solid white",
                          backgroundColor: "black",
                          color: "white",
                          whiteSpace: "nowrap",
                        }}
                      >
                        • {key}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          border: "1px solid white",
                          backgroundColor: "black",
                          color: "white",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        : {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <Text
                style={{
                  fontSize: "3rem",
                  color: "white",
                  fontWeight: "bold",
                  marginTop: "-10px",
                  marginBottom: "0.5rem",
                }}
              >
                {t("dialog.confirm.title")}
              </Text>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "1.5rem",
                  marginBottom: "1.7rem",
                }}
              >
                {filterOptions.map(({ key, label }) => {
                  const isChecked = checkedStates[key];
                  const backgroundColor = isChecked
                    ? key === "completed"
                      ? "limegreen"
                      : key === "notStarted"
                      ? "#d3d3d3"
                      : "dodgerblue"
                    : "#444";

                  return (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor,
                        padding: "18px 15px",
                        borderRadius: "8px",
                        color: "white",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                        border: isChecked ? "2px solid cyan" : "2px solid transparent",
                        transition: "border 0.2s, background-color 0.2s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setCheckedStates((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                        style={{
                          transform: "scale(1.8)",
                          cursor: "pointer",
                          width: "20px",
                          height: "20px",
                          accentColor: "cyan",
                        }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                <Button
                  icon={saveIcon}
                  className="detail-button"
                  onClick={handleSaveDetail}
                  disabled={!canSaveDetail} // 체크(색 변경)된 카드가 없으면 비활성화
                >
                  {t("button.saveDetail")}
                </Button>
                <Button
                  icon={saveIcon}
                  className="detail-button"
                  onClick={handleSaveAll}
                  disabled={!canSaveAll} // 하나라도 업데이트 가능 상태가 없으면 비활성화
                >
                  {t("button.saveAll")}
                </Button>
                <Button icon="decline" className="detail-button detail-button-danger" onClick={onClose}>
                  {t("button.close")}
                </Button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: `${ROW_GAP_PX}px`,
              // ✅ 화면에 정확히 4행만 보이도록 높이 고정
              height: `${ROWS_PER_PAGE * CARD_ROW_HEIGHT + (ROWS_PER_PAGE - 1) * ROW_GAP_PX}px`,
              overflow: "hidden", // 넘치면 숨김 (스크롤 없음)
            }}
          >
            {rowsByColumns.map((row, rowIndex) => (
              <div key={rowIndex} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                {row.map((data, colIndex) => (
                  <div key={colIndex} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    {data ? cardBlock(data) : <div style={{ height: `${CARD_ROW_HEIGHT}px` }} />}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {cardData.length > itemsPerPage && (
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <Button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      margin: "0 8px",
                      backgroundColor: currentPage === pageNum ? "cyan" : "#222",
                      color: "white",
                      borderRadius: "8px",
                      fontWeight: "bold",
                    }}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

export default E_ScanOutgoing_Detail_Y;
