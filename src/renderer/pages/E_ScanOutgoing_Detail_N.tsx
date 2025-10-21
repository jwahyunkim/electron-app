// C:\Changshin\electron-app_Final\src\renderer\pages\E_ScanOutgoing_Detail_N.tsx
import saveIcon from "@ui5/webcomponents-icons/dist/save.js";
import { useState, useEffect, useRef, useMemo  } from "react";
// import axios from "axios"; // ❌ 직접 axios 사용 제거
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
import okWhite from "@renderer/resources/E_Confirm_White.png";

import './index2.css'; 
import { SAP_CONFIG, getAccessToken, refreshToken } from "@shared/sap";
// i18n
import { t } from "../utils/i18n";
import { buildPassCardPayload, type GridRow, type Context } from "../utils/passcardMapping";
// ✅ 공통 API 유틸 (동적 로컬 포트 axios 생성)
import { getAxios } from "../utils/api";
import { normalizeUpsertResp } from "../utils/upsertNormalize";
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
  isSaving?: boolean;

  // ✅ 원본 필드 (optional)
  q_quantity?: number;
  q_status_code?: string;
  q_sfc?: string;

  // ✅  mappedSFC는 SEQ별로 SFC를 매핑하기 위한 필드 
  mappedSFC?: string;
  UPLOAD_YN?: string;
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
interface SfcDetail {
  bom?: {
    bom: string;
    type: string;
  };
  steps?: {
    operation?: {
      operation: string;
      version: string;
    };
    resource?: string;
    stepId?: string;
    stepRouting?: {
      routing: string;
    };
  }[];
  quantity?: number;
}

export function E_ScanOutgoing_Detail_N({ open, onClose, data, onConfirm, plant_cd, work_date }: Props) {

  const [cardData, setCardData] = useState<CardItem[]>([]);
  const originalCardDataRef = useRef<CardItem[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSfcMode, setIsSfcMode] = useState(false);
  const [minValidSfc, setMinValidSfc] = useState<string | null>(null); // ✅ 추가
  const orderedSfcListRef = useRef<string[]>([]);

  // 문자열 강제 유틸 (workCenter 등)
  const toStr = (v: unknown, len = 36) => String(v ?? "").slice(0, len);
  const toNum = (v: unknown) => Number(v ?? 0);


  const stableSfc = useMemo(() => {
    return typeof data?.SFC === "string" ? data.SFC : "";
  }, [data]);
  const [localIp, setLocalIp] = useState<string>("");
  const [externalIp, setExternalIp] = useState<string>("");
  type FilterKey = 'all' | 'notStarted' |  'completed';

  // 버튼 텍스트 줄바꿈 헬퍼 (i18n 값에 '\n'이 들어오면 줄바꿈 유지)
  const split2 = (s: string) => {
    const [a, b] = String(s).split("\\n");
    return { a: a ?? s, b: b ?? "" };
  };

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'all',        label: t("filter.all") },
    { key: 'notStarted', label: t("filter.notStarted") },
    { key: 'completed',  label: t("filter.completed") }
  ];

  const [checkedStates, setCheckedStates] = useState<Record<FilterKey, boolean>>({
    all: false,
    notStarted: false,
    completed: false
  });

  const COLUMN_COUNT = 2;
  const ROWS_PER_PAGE = 4;          // ✅ 4행 = 8칸
  const CARD_ROW_HEIGHT = 90;       // ✅ 카드 1행 높이(필요시 85~100로 조정)
  const ROW_GAP_PX = 8;             // 행 간격

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
    const { all, notStarted, completed } = checkedStates;

    const isInitial = !all && !notStarted && !completed;

    // 처음 상태 or 전체 체크 → 모든 카드 반환
    if (isInitial || all) return cardData;

    return cardData.filter((card) => {
      const isConfirmed = card.confirm_YN === "P";

      if (notStarted && !isConfirmed) return true;
      if (completed && isConfirmed) return true;

      return false;
    });
  }, [cardData, checkedStates]);

  const paginatedData = [...filteredCardData]
    .filter(x => x.seq != null)
    .sort((a, b) => {
      const aHasProd = !!a.prod_dt;
      const bHasProd = !!b.prod_dt;

      if (aHasProd !== bHasProd) {
        return aHasProd ? 1 : -1; // 미생산 먼저, 생산된 건 나중
      }

      return a.seq - b.seq; // 같은 상태면 seq 기준 정렬
    })
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 항상 8개로 고정 (빈 칸 포함)
  const paddedData: (CardItem | null)[] = [...paginatedData];
  while (paddedData.length < itemsPerPage) {
    paddedData.push(null);  // 빈 자리용
  }

  const rowsByColumns = Array.from({ length: Math.ceil(paddedData.length / columnCount) }, (_, rowIndex) =>
    paddedData.slice(rowIndex * columnCount, rowIndex * columnCount + columnCount)
  );

  const totalPages = Math.ceil(filteredCardData.length / itemsPerPage); // ✅ 체크박스 필터 결과 기준

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
            resource: ""
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
            resource: ""
          });
        }

        // ✅ MSSQL에서 저장된 스캔 데이터 가져오기
        // const res = await axios.get("http://localhost:4000/api/mssql/escan-detail-v2", {
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

        // ✅ 카드에 덮어쓰기 (prod 기준만 사용)
        for (const scan of savedScans) {
          const seqNum = Number(scan.SEQ);
          const idx = generatedCards.findIndex(card => card.seq === seqNum);
          if (idx === -1) continue;

          const card = generatedCards[idx];
          card.prod_dt = scan.PROD_DT ?? "";
          card.qty = scan.PCARD_QTY ?? card.qty;

          // ✅ 이제는 prod 기준으로만 상태 결정
          const hasProd = !!card.prod_dt;
          card.confirm_YN = hasProd ? "P" : " ";
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

  // ✅ 카드 상태별 색상
  const getColorByStatus = (item: CardItem) => {
    switch (item.confirm_YN) {
      case "P": return "limegreen";
      case "T": return "orange";
      case "N": return "white";
      default: return "#f5f5f5";
    }
  };

  // ✅ 카드 상태별 이미지
  const getImageByStatus = (item: CardItem) => {
    switch (item.confirm_YN) {
      case "P": return okGreen;
      case "T": return okOrange;
      case "N": return okWhite;
      default: return okWhite;
    }
  };

  // ✅ 카드 클릭 시 상태 순환
  const handleDetailOk = (clickedCard: CardItem) => {
    console.log("🟠 카드 클릭됨:", clickedCard.seq, clickedCard.confirm_YN);

    setCardData((prev) =>
      prev.map((item) => {
        if (item.seq !== clickedCard.seq) return item;

        console.log("🔄 상태 변경 전:", item.confirm_YN);

        if (item.confirm_YN === "N") {
          console.log("🟠 상태 변경: N → T");
          return { ...item, confirm_YN: "T" };
        }

        if (item.confirm_YN === "T") {
          console.log("⚪ 상태 변경: T → N");
          return { ...item, confirm_YN: "N" };
        }

        return item;
      })
    );
  };

  // ✅ 변경된 카드만 추출
  const getModifiedRows = (original: CardItem[], current: CardItem[]) => {
    return current
      .map((cur, idx) => {
        const ori = original[idx];
        const isChanged = cur.confirm_YN !== ori.confirm_YN;

        return {
          ...cur,
          SCAN_TYPE: "P",
          _changed: isChanged && (cur.confirm_YN === "P" || cur.confirm_YN === "T")
        };
      })
      .filter(item => item._changed)
      .map(({ _changed, ...rest }) => rest);
  };

  // ✅ 필터된 카드 중 변경된 카드
  const filteredModifiedCards = useMemo(() => {
    const modified = getModifiedRows(originalCardDataRef.current, cardData);
    return modified.filter((card) =>
      filteredCardData.some(f => f.seq === card.seq)
    );
  }, [cardData, filteredCardData]);

  // ✅ 필터된 카드 중 저장 가능한 카드 (P 상태)
  const filteredUpdatableCards = useMemo(() => {
    return filteredCardData.filter(card =>
      card.confirm_YN === "N" && card.flag !== "FINISH"
    );
  }, [filteredCardData]);

  // ✅ 현재 선택된 SFC가 단일 또는 최소 유효 SFC 여부
  const isSingleSfc = orderedSfcListRef.current.length <= 1;
  const isClickable = isSingleSfc || (stableSfc !== "" && stableSfc === minValidSfc);

  // ✅ 현재 SFC 차단 여부
  const isSfcBlocked = isSfcMode && !!minValidSfc && data.SFC !== minValidSfc;

  // ✅ 저장 가능 여부
  const canSaveDetail = filteredModifiedCards.length > 0 && !isSfcBlocked && isClickable;
  const canSaveAll = filteredUpdatableCards.length > 0 && !isSfcBlocked && isClickable;

  // ✅ 카드 클릭 가능 여부
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
      const ax = await getAxios();

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

      // const res = await axios.post("http://localhost:4000/api/sap-start", payload);
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
      const ax = await getAxios();

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

      // const res = await axios.post("http://localhost:4000/api/sap-complete", payload);
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
      // await axios.post("http://localhost:4000/api/mssql/escan-detail-save", { list: cardsToSave });
      await ax.post("/api/mssql/escan-detail-save", { list: cardsToSave });
      setCardData(prev =>
        prev.map(item =>
          cardsToSave.some(c => c.SEQ === item.seq.toString())
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
      // await axios.post("http://localhost:4000/api/mssql/escan-detail-save_v2", {
      await ax.post("/api/mssql/escan-detail-save_v2", {
        list: cardsToSave,
      });

      // ✅ 저장 성공 시 상태 업데이트
      setCardData(prev =>
        prev.map(item =>
          cardsToSave.some(c => c.SEQ === item.seq.toString())
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
      // const res = await axios.get("http://localhost:4000/api/sap/sfc-detail", {
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
        // const res = await axios.get("http://localhost:4000/api/sap/goodsreceipts", {
        const res = await ax.get("/api/sap/goodsreceipts", {
          params: { plant, order, sfc, material }
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
          const matched = postedOnly.filter((d: any) =>
            transactionIds.includes(d.transactionId?.trim?.())
          );

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

  // ✅ 수동 Activity Confirm - SAP 표준시간(Standard Value) 전체 구조 조회
  const fetchStandardValueObject = async ({
    plant,
    workCenter,
    operationActivity,
    operationActivityVersion,
    object,
    objectType,
    objectVersion
  }: {
    plant: string;
    workCenter: string;
    operationActivity: string;
    operationActivityVersion: string;
    object: string;
    objectType: string;
    objectVersion: string;
  }) => {
    try {
      const ax = await getAxios();
      // const res = await axios.get("http://localhost:4000/api/sap/standard-value", {
      const res = await ax.get("/api/sap/standard-value", {
        params: {
          plant,
          workCenter,
          operationActivity,
          operationActivityVersion,
          object,
          objectType,
          objectVersion
        }
      });

      const resData = res.data as any;

      if (!resData || !Array.isArray(resData?.standardValueCollectionList)) {
        console.warn("⚠️ SAP 응답에 standardValueCollectionList 없음");
        return null;
      }

      console.log("✅ SAP 표준시간 전체 응답:", resData);
      return resData; // ← 전체 객체 반환
    } catch (err: any) {
      console.error("❌ SAP StandardValue 조회 실패:", err.response?.data || err.message);
      return null;
    }
  };

  const callSapPostAssembledComponent = async ({
    plant,
    sfc,
    operationActivity,
    component,
    componentVersion,
    quantity,
    resource,
    sequence
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
      sequence
    });

    try {
      const ax = await getAxios();

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
        resource
      };

      const url = "/api/sap-post-assembled";
      console.log("🌐 호출 URL:", url);

      // const res = await axios.post(url, payload, {
      const res = await ax.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
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
    hasTimeBased = true,       // ✅ 기본값 true
    hasNonTimeBased = true     // ✅ 기본값 true
  }: {
    plant: string;
    sfc: string;
    operationActivity: string;
    quantity: number;
    resource: string;
    hasTimeBased?: boolean;     // ✅ 선택적 매개변수로 추가
    hasNonTimeBased?: boolean;
  }) => {
    console.log("🚀 [SAP Assemble] 호출 시작");
    const payload = {
      plant,
      operationActivity,
      quantity,
      resource,
      sfcs: [sfc],              // ✅ 배열로 전달
      hasTimeBased,
      hasNonTimeBased
    };

    try {
      const ax = await getAxios();

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

      // const res = await axios.post(url, payload, {
      const res = await ax.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("✅ SAP assembledComponents 호출 성공:", res.data);
    } catch (err: any) {
      const responseData = err?.response?.data || {};
      console.error("❌ SAP assembledComponents 호출 실패:", responseData.error || err.message);
      console.error("📥 전체 오류 응답:", responseData);
    }
  };

  type ActivityItem = {
    activityId: string;
    quantity: number;
    unitOfMeasure: string;
    isoUnitOfMeasure: string;
    postedBy: string;
    postingDateTime: string;
  };

  const callSapPostActivityConfirm = async ({
    plant,
    shopOrder,
    sfc,
    operationActivity,
    stepId,
    workCenter,
    activityList
  }: {
    plant: string;
    shopOrder: string;
    sfc: string;
    operationActivity: string;
    stepId: string;
    workCenter: string;
    activityList: ActivityItem[];
  }) => {
    try {
      const ax = await getAxios();

      const activities = activityList.map((item) => ({
        activityId: item.activityId,
        quantity: item.quantity,
        unitOfMeasure: item.unitOfMeasure,            // 고정
        isoUnitOfMeasure: item.isoUnitOfMeasure,         // 고정
        postedBy: item.postedBy,
        postingDateTime: item.postingDateTime
      }));

      const payload = {
        plant,
        shopOrder,
        sfc,
        operationActivity,
        stepId,
        workCenter,
        finalConfirmation: true,
        allowPostingsAfterOperationActivityComplete: true,
        activities
      };

      // const res = await axios.post("http://localhost:4000/api/sap-post-activity-confirm", payload);
      const res = await ax.post("/api/sap-post-activity-confirm", payload);
      console.log("✅ Activity Confirm 성공:", res.data);
    } catch (err: any) {
      console.error("❌ Activity Confirm 실패:", err.response?.data || err.message);
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
    inventoryId
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
      // const res = await axios.post("http://localhost:4000/api/sap-post-goodsissue", {
      const res = await ax.post("/api/sap-post-goodsissue", {
        plant,
        order,
        phase,
        workCenter,
        inventoryId, // ✅ 추가됨
        component: {
          material: {
            material: component,
            version: componentVersion
          }
        },
        bom: {
          bom: bomCode,
          version: bomVersion
        },
        isBomComponent: true,
        quantity,
        unitOfMeasure,
        postedBy,
        postingDateTime
      });

      console.log("✅ goodsissue 성공", res.data);
    } catch (err: any) {
      console.error("❌ goodsissue 실패", err.response?.data || err.message);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const callSapPostGoodsReceipt = async ({
    plant,
    order,
    postedBy,
    lineItems
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
      lineItems
    });

    const payload = {
      plant,
      order,
      postedBy: postedBy || "system",
      lineItems
    };

    const url = "/api/sap-goods-receipt";
    let attempt = 0;

    while (true) {
      try {
        const ax = await getAxios();

        console.log(`🚀 [SAP GoodsReceipt] 시도 ${attempt + 1}회`);
        
        // ✅ 백엔드에만 요청, SAP 토큰은 백엔드에서 처리
        // const res = await axios.post(url, payload, {
        const res = await ax.post(url, payload, {
          headers: {
            "Content-Type": "application/json"
          }
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
    postingDateTime
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
      // const res = await axios.post("http://localhost:4000/api/sap-post-autoconfirm", {
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
        postingDateTime
      });

      console.log("✅ AutoActivityConfirm 성공", res.data);
    } catch (err: any) {
      console.error("❌ AutoActivityConfirm 실패", err.response?.data || err.message);
    }
  };



  // ──────────────────────────────────────────────────────────────
// PASSCARD 벌크 저장/출력 빌더 - FAST (길이 자르기 제거, 최소 후처리만 유지)
// - confirm_YN === "P"만 대상
// - DAY_SEQ "NNH" 정규화
// - PCARD_SEQ 3자리 포맷
// - BAR_KEY만 20자 컷(바코드 안전)
// - dedup 유지
// ──────────────────────────────────────────────────────────────
async function buildEpcardInsertList({
  items, data, plant_cd, localIp,
}: {
  items: CardItem[];
  data: any;
  plant_cd: string;
  localIp: string;
}) {
  const opt = await (window as any).config?.getPasscardOptions?.().catch(() => undefined);
  const print = opt ?? {
    deviceName: "BIXOLON SRP-330II",
    preview: false,
    widthMicrons: 79000,
    heightMicrons: 54000,
    previewCountAsPrint: true,
  };
  const previewFlag = !!print.preview;

  const nz = <T,>(v: T | undefined | null, d: T): T => (v ?? d);
  const sTrim = (v: any) => String(v ?? "").trim();

  const normalizeDaySeq3 = (v: any) => {
    const s = sTrim(v).toUpperCase();
    const base = s.endsWith("H") ? s.slice(0, -1) : s;
    const n = Math.max(0, Math.min(99, Number(base) || 0));
    return `${String(n).padStart(2, "0")}H`;
  };

  const toSeq3 = (v: any) => String(Math.max(0, Math.min(999, Number(v) || 0))).padStart(3, "0");

  // P만 인쇄/저장
  const confirmed = (items || []).filter((it) => sTrim(it?.confirm_YN).toUpperCase() === "P");

  const seen = new Set<string>();

  const list = confirmed
    .map((it) => {
      // 설비코드 보정 (WC처럼 보이면 기본설비)
      const resourceCdSrc0 = sTrim(data?.RESOURCE_CD);
      const looksLikeWC = resourceCdSrc0.length <= 6 && !resourceCdSrc0.includes("-");
      const RESOURCE_CD = looksLikeWC ? "C200-IPIPI-01" : (resourceCdSrc0 || "C200-IPIPI-01");
      const NEXT_RESOURCE_CD = data?.NEXT_RESOURCE_CD || "C200-IPIPU-03";

      const seq3 = toSeq3(it?.seq);

      // STYLE_CD 보강(없으면 MATERIAL_CODE prefix 사용)
      const styleCd0 = sTrim(data?.STYLE_CD);
      const materialCode0 = sTrim(data?.MATERIAL_CODE ?? data?.MATERIAL);
      const styleFromMat = materialCode0 ? materialCode0.split("-")[0] : "";
      const STYLE_CD = styleCd0 || styleFromMat || "NA";

      // 수량 정수화
      const qtyInt = Math.max(0, Math.floor(Number(it?.qty) || 0));

      // buildPassCardPayload 입력
      const row = {
        ORDER_NUMBER: sTrim(data?.ORDER_NUMBER),
        NEXT_ORDER_NUMBER: sTrim(data?.NEXT_ORDER_NUMBER ?? ""),
        STYLE_CD,
        STYLE_NAME: nz(data?.MATERIAL_DESCRIPTION, materialCode0 || "STYLE"),
        SIZE_CD: sTrim(data?.SIZE_CD || "N/A"),
        RESOURCE_CD,
        NEXT_RESOURCE_CD,
        PCARD_QTY: qtyInt,
        PCARD_SEQ: Number(seq3), // 내부 계산용 숫자 OK
        MATERIAL_CODE: materialCode0,
      };

      const ctx = {
        PLANT_CD: sTrim(plant_cd ?? "C200"),
        BD_CD: nz(data?.BD_CD, "IP"),
        OP_CD: nz(data?.OP_CD, "IPI"),
        OP_NAME: nz(data?.OP_NAME, "IP Injection"),
        DAY_SEQ: normalizeDaySeq3(data?.DAY_SEQ ?? "1H"),
        DEVICE_ID: nz(data?.DEVICE_ID, "POP_DEVICE_01"),
        USER_IP: sTrim(localIp || "0.0.0.0"),
        SFC_CD: sTrim(data?.SFC ?? ""),
        WORK_CENTER: nz(data?.WORK_CENTER, resourceCdSrc0 || "N/A"),
        PART_NAME: nz(data?.PART_NAME, "MIDSOLE"),
        GENDER_CD: nz(data?.GENDER_CD, "WO"),
      };

      const { insert } = buildPassCardPayload(row as any, ctx as any);

      // 최소 후처리만 수행
      insert.DAY_SEQ   = normalizeDaySeq3(insert.DAY_SEQ ?? ctx.DAY_SEQ ?? "1H");
      insert.PCARD_SEQ = toSeq3(insert.PCARD_SEQ ?? seq3);
      insert.BAR_KEY   = insert.BAR_KEY ? String(insert.BAR_KEY).trim().slice(0, 20) : "";

      // dedup (PLANT_CD|SFC_CD|BAR_KEY|PCARD_SEQ|ORDER_NUMBER)
      const dedupKey = [
        insert.PLANT_CD,
        insert.SFC_CD,
        insert.BAR_KEY,
        insert.PCARD_SEQ,
        insert.ORDER_NUMBER,
      ].join("|");
      if (seen.has(dedupKey)) return null;
      seen.add(dedupKey);

      return insert;
    })
    .filter(Boolean) as any[];

  return { list, print, previewFlag };
}

const handleSaveDetail = async () => {
  const changed = getModifiedRows(originalCardDataRef.current, cardData);
  // ✅ "T"를 자동으로 "P"로 승격 (SAP 및 DB 저장용)
  const autoPromoted = changed.map(item =>
    item.confirm_YN === "T" ? { ...item, confirm_YN: "P" } : item
  );
  const filtered = autoPromoted.filter(item => item.confirm_YN === "P");

  // ✅ 진행중 표시 (filtered 대상만) — O(n²) 제거: Set 사용
  const targetSeqs = new Set(filtered.map(it => String(it.seq)));
  setCardData(prev =>
    prev.map(item =>
      targetSeqs.has(String(item.seq))
        ? { ...item, isSaving: true }
        : item
    )
  );

  if (filtered.length === 0) return showToast(t("toast.noChanges"));
  const rawSfc = String(data?.SFC || "").slice(0, 128);

  if (!rawSfc) {
    console.error("❌ 유효하지 않은 SFC: null 또는 빈 문자열입니다.");
    showToast(t("toast.missingSfc"));
    // 진행중 해제
    setCardData(prev =>
      prev.map(item =>
        targetSeqs.has(String(item.seq)) ? { ...item, isSaving: false } : item
      )
    );
    return;
  }

  try {
    const ax = await getAxios();

    // ✅ 기본 payload (SCAN_TYPE = "P")
    const payload = filtered.map(item => ({
      PLANT_CD: plant_cd,
      WORK_CENTER: data.WORK_CENTER,
      ORDER_NUMBER: data.ORDER_NUMBER,
      SEQ: item.seq.toString(),
      MATERIAL_CODE: data.MATERIAL_CODE,
      SIZE_CD: data.SIZE_CD,
      ITPO_TYPE: item.confirm_YN, // 여기도 거의 항상 "P"
      SFC: rawSfc,
      SCAN_TYPE: "P", // 고정
      PCARD_QTY: item.qty,
      USER_IP: localIp || "0.0.0.0",
      DEVICE_ID: "POP_DEVICE_01"
    }));

    // ✅ SCAN_TYPE = "T" 복제 추가
    const payloadWithBothTypes = [
      ...payload,
      ...payload.map(p => ({
        ...p,
        SCAN_TYPE: "T"
      }))
    ];

    // handlePostConfirm_V2(payload);
    // onConfirm?.(payload);
    await handlePostConfirm_V2(payloadWithBothTypes);
    onConfirm?.(payloadWithBothTypes);

    // ✅ 디테일용 최종본 (FAST 경로: 스풀 감시 제거, 전송 성공=성공 간주)
    // - 업서트 전에 Early Dispatch로 즉시 출력 시도  ❌ 제거 (요구사항: 업서트 성공 후에만 출력)
    // - 업서트 실패 시 출력/이후 API 모두 SKIP + 즉시 리턴
    // - 이벤트 리스너 누수 방지(최대 90초 후 자동 해제)

    try {
      const { list, print, previewFlag } = await buildEpcardInsertList({
        items: filtered, data, plant_cd, localIp,
      });

      if (list.length === 0) {
        console.info("[PASSCARD] no rows to insert/print");
        // 진행중 해제
        setCardData(prev =>
          prev.map(item =>
            targetSeqs.has(String(item.seq)) ? { ...item, isSaving: false } : item
          )
        );
        return;
      }

      // ===== 브리지/IPC/리스너 준비 (기존 구조 유지) =====
      const bridge = (window as any)?.printBridge?.passcards as
        | ((jobs: any[], options: any) => Promise<any>)
        | undefined;

      const ipcInvoke: undefined | ((ch: string, ...args: any[]) => Promise<any>) =
        (window as any)?.ipc?.invoke ?? (window as any)?.electron?.ipcRenderer?.invoke;

      const on =
        (window as any)?.ipc?.on ?? (window as any)?.electron?.ipcRenderer?.on;
      const off =
        (window as any)?.ipc?.off ?? (window as any)?.electron?.ipcRenderer?.removeListener;

      const batchId = `pcard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // ✂ seq 3자리 패딩 제거: 원본 유지
      const jobs = list.map((j: any) => ({
        PLANT_CD: String(j.PLANT_CD ?? "C200").slice(0, 4),
        SFC_CD: String(j.SFC_CD ?? "").slice(0, 128),
        ORDER_NUMBER: String(j.ORDER_NUMBER ?? "").slice(0, 10),
        BAR_KEY: String(j.BAR_KEY ?? "").slice(0, 20),
        PCARD_SEQ: String(j.PCARD_SEQ ?? "").slice(0, 20),
        NEXT_ORDER_NUMBER: String(j.NEXT_ORDER_NUMBER ?? "").slice(0, 10),
        SIZE: String(j.SIZE_CD ?? j.SIZE ?? "").slice(0, 8),
        QTY: Number(j.PCARD_QTY ?? j.QTY ?? 0),
        WORK_CENTER: String(j.WORK_CENTER ?? "").slice(0, 50),
        CREATE_DATE: String(j.CREATE_DATE ?? "").slice(0, 20),
        PRINT_DT: String(j.PRINT_DT ?? "").slice(0, 20),
      }));

      const options = {
        deviceName: print.deviceName,
        preview: !!previewFlag,
        widthMicrons: print.widthMicrons,
        heightMicrons: print.heightMicrons,
      };

      const withTimeout = <T,>(p: Promise<T>, ms: number, tag: string) =>
        Promise.race([
          p,
          new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout: ${tag}`)), ms)),
        ]) as Promise<T>;

      // ===== 업서트 진행 (스풀 미사용, 받은 데이터 그대로 저장) =====
      const normalizeUpsertResp = (data: any, expected: number) => {
        let inserted = Number(data?.insertedCount ?? data?.inserted ?? 0);
        let updated  = Number(data?.updatedCount  ?? data?.updated  ?? 0);
        let ack = inserted + updated;
        const ra = data?.rowsAffected ?? data?.rowCount;
        if (!ack) {
          if (Array.isArray(ra)) ack = Number(ra[0] ?? 0);
          else if (typeof ra === "number") ack = ra;
        }
        if (!ack && typeof data?.message === "string") {
          const m = data.message.match(/(\d+)\s*건/);
          if (m) ack = Number(m[1]);
        }
        const okFlag = data?.ok === true;
        const ok = okFlag || ack >= expected;
        return { ok, ack, inserted, updated, raw: data };
      };

      let upsertOK = false;
      try {
        const ins = await ax.post("/api/mssql/epcard/print-bulk", { list });
        const norm = normalizeUpsertResp(ins?.data, list.length);
        upsertOK = !!norm.ok;
        if (!upsertOK) {
          console.error(`[PASSCARD] upsert failed: ack=${norm.ack}/${list.length}`, norm.raw);
        }
      } catch (e) {
        console.error("❌ PASSCARD upsert error:", e);
        upsertOK = false;
      }

      // **업서트 실패면: 출력/이후 API 전부 SKIP + 즉시 종료 + i18n 토스트**
      if (!upsertOK) {
        showToast(t("toast.bulkFailed")); // "벌크 저장에 실패했습니다."
        setCardData(prev =>
          prev.map(item =>
            targetSeqs.has(String(item.seq)) ? { ...item, isSaving: false } : item
          )
        );
        return;
      }

      console.info("[PASSCARD] DB upsert(PENDING) OK. now printing...");

      // **업서트 성공 → 출력(FAST: 스풀 감시 없음)**
      try {
        if (typeof bridge === "function") {
          await withTimeout(bridge(jobs, options), 15000, "bridge");
        } else if (ipcInvoke) {
          await withTimeout(
            ipcInvoke("print:passcards", { jobs, options, batchId }),
            15000,
            "ipc"
          );
        } else {
          throw new Error("no print bridge or ipc.invoke available (preload missing?)");
        }
        console.info("[PASSCARD] print dispatched (FAST)");
      } catch (printErr) {
        console.error("❌ PASSCARD print error:", printErr);
        showToast(t("toast.printFailed")); // "인쇄에 실패했습니다."
        setCardData(prev =>
          prev.map(item =>
            targetSeqs.has(String(item.seq)) ? { ...item, isSaving: false } : item
          )
        );
        return; // 출력 실패면 이후 API도 타지 않음
      } finally {
        // 리스너 자동 정리(방어)
        setTimeout(() => {
          off?.("passcard:job-result", () => {});
          off?.("passcard:batch-done", () => {});
        }, 90_000);
      }

    } catch (e) {
      console.error("❌ PASSCARD 벌크 저장/출력 실패:", e);
      setCardData(prev =>
        prev.map(item =>
          targetSeqs.has(String(item.seq)) ? { ...item, isSaving: false } : item
        )
      );
      showToast(t("toast.processError"));
      return;
    }

    // ─────────────────────────────────────────────────────────
    // ▼▼▼ 아래는 네가 둔 SAP/후속 API 로직 — **삭제 없이 유지** ▼▼▼
    //Sap Api 호출을 위한 필수 정보
    // 🔍 SAP SFC Detail 조회 → operation 값 동적 추출
    const sfcDetail = await fetchSfcDetail(plant_cd, String(data.SFC).slice(0, 128)) as any;;

    // 🔁 BOM 정보 추출
    const bomCode = sfcDetail?.bom?.bom;
    const rawBomType = sfcDetail?.bom?.type;
    // 🔁 BOM type 변환 (SAP → API expected)
    const bomType = rawBomType === "SHOPORDERBOM"
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
    const stepId = step?.stepId;                  //Activity Comfirmation사용
    const routing = step?.stepRouting?.routing;   //Activity Comfirmation사용
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
      const ax = await getAxios();
      // const bomResp = await axios.get("http://localhost:4000/api/sap/bom-detail", {
      const bomResp = await ax.get("/api/sap/bom-detail", {
        params: {
          plant: plant_cd,
          bom: bomCode,
          type: bomType
        }
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
            storageLocation
          };
        })
        .filter((c): c is {
          component: string;
          componentVersion: string;
          quantity: number;
          totalQuantity: number | null;
          unitOfMeasure: string;
          storageLocation: string;
        } => c !== null);

      console.log("🧩 BOM에서 추출된 components:", components);
    } catch (err) {
      console.error("❌ BOM Detail 조회 실패", err);
      return showToast(t("toast.loadBomFailed"));
    }
    // ✅ SAP START 호출 조건: 모든 카드에 input_dt 없을 때만
    const hasAnyInput = cardData.some(c => !!c.prod_dt);
    if (!hasAnyInput) {
      const sapPayload = {
        plant: plant_cd.slice(0, 6),
        operation,
        resource: String(data.WORK_CENTER ?? "").slice(0, 36),
        // quantity: Number(data.QUANTITY ?? 0),
        // quantity: 0,
        sfcs: [String(data.SFC ?? "").slice(0, 128)],
        processLot: ""
      };
      await callSapStartApi(sapPayload);
    }

    // 🎯 1. 전체 수량 합산 (for문 밖에서 미리 계산)
    const totalQty = filtered
      .filter(item => item.confirm_YN === "P")
      .reduce((sum, item) => sum + Number(item.qty || 0), 0);

    // ✅ 사용된 SEQ 리스트 추출
    const usedSeqList = filtered
      .filter(item => item.confirm_YN === "P")
      .map(item => item.seq);  

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
          const ax = await getAxios();
          // const uomResp = await axios.get("http://localhost:4000/api/sap/unit-codes", {
          const uomResp = await ax.get("/api/sap/unit-codes", {
            params: { unitCode: baseUnitOfMeasure }
          });
          const matched = Array.isArray(uomResp.data) ? uomResp.data[0] : uomResp.data;
          if (!matched || !matched.unitCode) throw new Error("단위코드 조회 실패");
          uomData = matched;
        } catch (err) {
          console.error("❌ 단위코드 조회 실패:", err);
          return showToast(t("toast.loadUomFailed"));
        }

        const getPreferredCommercialCode = (codes: any[] = []) => {
          const preferredLanguages = ['ko', 'en'];
          for (const lang of preferredLanguages) {
            const match = codes.find((c: any) => c.language === lang);
            if (match?.commercialCode) return match.commercialCode;
          }
          return codes[0]?.commercialCode || baseUnitOfMeasure;
        };

        const unitOfMeasure = {
          commercialUnitOfMeasure: getPreferredCommercialCode(uomData?.commercialCodes),
          internalUnitOfMeasure: baseUnitOfMeasure,
          isoUnitOfMeasure: uomData?.isoCode || baseUnitOfMeasure
        };

        // 🎯 SAP GoodsReceipt 총합 수량으로 1회 호출
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
                value: totalQty
              },
              sfc: rawSfc,
              storageLocation
            }
          ]
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

        try {
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
            const ax = await getAxios();
            // const qtyConfirmResp = await axios.post("http://localhost:4000/api/sap-post-qty-confirm", {
            const qtyConfirmResp = await ax.post("/api/sap-post-qty-confirm", {
              plant: plant_cd,
              shopOrder: orderNumber,
              sfc: rawSfc,
              operationActivity: operation,
              workCenter: data.WORK_CENTER,
              yieldQuantity: totalQty,
              yieldQuantityUnit: unitOfMeasure.internalUnitOfMeasure,
              yieldQuantityIsoUnit: unitOfMeasure.isoUnitOfMeasure,
              // isFinalConfirmation: isFinal  2025.10.1
              isFinalConfirmation: false
            });

            console.log("✅ Quantity Confirmation 성공:", qtyConfirmResp.data);
          } catch (qcErr) {
            const err = qcErr as any;
            console.error("❌ Quantity Confirmation 실패:", err.response?.data || err.message);
          }

          if (isFinal) {

            let standardValueObj: any = null;

            try {
              standardValueObj = await fetchStandardValueObject({
                plant: plant_cd,
                workCenter: data.WORK_CENTER,
                operationActivity: operation,
                operationActivityVersion: operation_Version,
                object: orderNumber,
                objectType: "SHOP_ORDER_ROUTING",
                objectVersion: "ERP001"
              });

              console.log("✅ 조회된 Standard Value 전체 구조:", standardValueObj);
            } catch (err: any) {
              console.error("❌ Standard Value 조회 실패:", err.response?.data || err.message);
            }


            // ✅ 결과값을 기반으로 ActivityItem[] 생성
            if (!standardValueObj) return;

            const postingDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
            const postedBy = "dongil.kang@changshininc.com";

            const activityList: ActivityItem[] =
              standardValueObj.standardValueCollectionList.map((item: any) => ({
                activityId: item.standardVal,
                quantity: item.standardValueQuantity?.value || 0,
                unitOfMeasure: item.standardValueQuantity?.unitOfMeasure?.uom || "S",
                isoUnitOfMeasure: item.standardValueQuantity?.unitOfMeasure?.internalUom || "S",
                postedBy,
                postingDateTime
              }));


            try {
              await callSapPostActivityConfirm({
                plant: plant_cd,
                shopOrder: orderNumber,
                sfc: data.SFC,
                operationActivity: operation,
                stepId: stepId ?? "",
                workCenter: data.WORK_CENTER,
                activityList
              });

              console.log("✅ SAP Activity Confirm 성공");
            } catch (err: any) {
              console.error("❌ SAP Activity Confirm 실패:", err.response?.data || err.message);
            }

            // // 2025.07.18 설정 문제로 인한 추후 처리
            // const postingDateTime = new Date(Date.now()).toISOString().replace(/\.\d{3}Z$/, ".000Z");
            // try {
            //   await callSapPostAutoConfirm({
            //     plant: plant_cd,
            //     shopOrder: orderNumber,
            //     sfc: rawSfc,
            //     operationActivity: operation,
            //     operationActivityVersion: operation_Version,
            //     stepId: stepId ?? "",
            //     workCenter: data.WORK_CENTER,
            //     resource: resource,
            //     routingId: routing ?? "",
            //     finalConfirmation: true,
            //     postConfirmationToErp: true,
            //     postedBy: "dongil.kang@changshininc.com",
            //     postingDateTime
            //   });
            //   console.log("✅ AutoActivityConfirm 성공");
            // } catch (autoErr) {
            //   console.error("❌ AutoActivityConfirm 실패:", autoErr);
            // }

            // try {
            //   const finalConfirmResp = await axios.post("http://localhost:4000/api/sap-post-final-confirm", {
            //     plant: plant_cd,
            //     shopOrder: orderNumber,
            //     sfc: rawSfc,
            //     operationActivity: operation
            //   });
            //   console.log("✅ Final Quantity Confirmation 성공:", finalConfirmResp.data);
            // } catch (finalErr) {
            //   console.error("❌ FinalConfirm 실패:", finalErr);
            // }
          }
        } catch (err) {
          console.error("❌ SFC 상태 확인 또는 SAP 호출 실패:", err);
        }

        try {     
          const ax = await getAxios();
          console.log("📦 파라미터 확인:", { plant_cd, sfc: rawSfc, scan_type: item.confirm_YN, seqList: usedSeqList }); 
          // const uploadResp = await axios.post("http://localhost:4000/api/mssql/update-upload-yn", {
          const uploadResp = await ax.post("/api/mssql/update-upload-yn", {
            plant_cd: plant_cd,              
            sfc: rawSfc,
            scan_type: item.confirm_YN,
            seqList: usedSeqList
          });
          
          console.log("✅ MSSQL 업로드 상태 업데이트 성공:", uploadResp.data);
        } catch (uploadErr) {
          console.error("❌ MSSQL 업로드 상태 업데이트 실패:", uploadErr);
        }

        // 🎯 이후 반복 방지
        sapPosted = true;
      }
    }

    // 완료 시 진행중 해제
    setCardData(prev =>
      prev.map(item =>
        targetSeqs.has(String(item.seq)) ? { ...item, isSaving: false } : item
      )
    );
    onClose();

  } catch (err) {
    console.error("❌ 전체 SaveDetail 처리 오류:", err);
    showToast(t("toast.processError"));
    setCardData(prev =>
      prev.map(item =>
        targetSeqs.has(String(item.seq)) ? { ...item, isSaving: false } : item
      )
    );
  }
};

// ✅ 전체 SaveAll 로직 (BULK 실패 시 즉시 리턴, BULK 성공 후에만 출력 → 이후 SAP 순서 진행)
const handleSaveAll = async () => {
  const currentSfc = minValidSfc;
  const rawSfc = String(data?.SFC || "").slice(0, 128);

  // 1) 상태 전환 (같은 SFC만: N→T, T→P)
  const updatedData = cardData.map((item) => {
    if (item.mappedSFC === currentSfc) {
      if (item.confirm_YN === "N") return { ...item, confirm_YN: "T" };
      if (item.confirm_YN === "T") return { ...item, confirm_YN: "P" };
    }
    return item;
  });
  setCardData(updatedData);

  // 2) 이번에 처리할 대상: 같은 SFC + prod_dt 없음 + 상태 T/P + FINISH 제외
  const filtered = updatedData.filter(
    (x) =>
      x.mappedSFC === currentSfc &&
      (!x.prod_dt || x.prod_dt.trim() === "") &&
      ["T", "P"].includes(x.confirm_YN) &&
      x.flag !== "FINISH"
  );
  if (filtered.length === 0) {
    return showToast(t("toast.nothingToConfirm"));
  }

  // 3) 승격 확정본(P만) & 진행중 표시
  const promoted = filtered.map((item) => ({ ...item, confirm_YN: "P" }));
  const targetSeqs = new Set(promoted.map((p) => p.seq));
  setCardData((prev) =>
    prev.map((item) =>
      targetSeqs.has(item.seq) ? { ...item, isSaving: true } : item
    )
  );

  // 4) MSSQL 저장 payload (P/T 모두)
  const payloadP = promoted.map((item) => ({
    PLANT_CD: plant_cd,
    WORK_CENTER: data.WORK_CENTER,
    ORDER_NUMBER: data.ORDER_NUMBER,
    SEQ: item.seq.toString(),
    MATERIAL_CODE: data.MATERIAL_CODE,
    SIZE_CD: data.SIZE_CD,
    ITPO_TYPE: item.confirm_YN, // "P"
    SFC: rawSfc,
    SCAN_TYPE: "P",
    PCARD_QTY: item.qty,
    USER_IP: localIp || "0.0.0.0",
    DEVICE_ID: "POP_DEVICE_01",
  }));
  const payloadWithBothTypes = [
    ...payloadP,
    ...payloadP.map((p) => ({ ...p, SCAN_TYPE: "T" })),
  ];

  const cleanupSavingFlags = () =>
    setCardData((prev) =>
      prev.map((item) =>
        targetSeqs.has(item.seq) ? { ...item, isSaving: false } : item
      )
    );

  try {
    const ax = await getAxios();

    // 5) 저장 호출 (개별 Confirm 저장) — 실패해도 'BULK 실패시 리턴' 규칙 대상 아님
    try {
      await handlePostConfirm_V2(payloadWithBothTypes);
      onConfirm?.(payloadWithBothTypes);
    } catch (e) {
      console.error("❌ handlePostConfirm_V2 실패 (계속 진행):", e);
      // Confirm 실패가 바로 리턴 조건은 아님 → 진행
    }

    // 6) PASSCARD 벌크 저장 + 출력 (P만 인쇄 대상)
    //    - 🔴 규칙: epcard/print-bulk **실패 시 즉시 리턴**(출력/ SAP 전부 중단)
    const itemsForPrint = promoted;
    let previewFlag = false;

    if (itemsForPrint.length > 0) {
      const { list, print, previewFlag: pf } = await buildEpcardInsertList({
        items: itemsForPrint,
        data,
        plant_cd,
        localIp,
      });
      previewFlag = !!pf;

      const normalizeUpsertResp = (data: any, expected: number) => {
        let inserted = Number(data?.insertedCount ?? data?.inserted ?? 0);
        let updated = Number(data?.updatedCount ?? data?.updated ?? 0);
        let ack = inserted + updated;
        const ra = data?.rowsAffected ?? data?.rowCount;
        if (!ack) {
          if (Array.isArray(ra)) ack = Number(ra[0] ?? 0);
          else if (typeof ra === "number") ack = ra;
        }
        if (!ack && typeof data?.message === "string") {
          const m = data.message.match(/(\d+)\s*건/);
          if (m) ack = Number(m[1]);
        }
        const okFlag = data?.ok === true;
        const ok = okFlag || ack >= expected;
        return { ok, ack, inserted, updated, raw: data };
      };

      // 6-1) DB 업서트(PENDING)
      const ins = await ax.post("/api/mssql/epcard/print-bulk", { list });
      const norm = normalizeUpsertResp(ins?.data, list.length);

      if (!norm.ok) {
        console.error(
          `[PASSCARD] upsert failed: ack=${norm.ack}/${list.length}`,
          norm.raw
        );
        cleanupSavingFlags();
        showToast(t("toast.processError"));
        return; // 🔴 BULK 실패시 즉시 리턴 (출력/ SAP 진행 안 함)
      }

      console.info(
        "[PASSCARD] DB upsert(PENDING) OK. now printing...",
        { count: list.length, inserted: norm.inserted, updated: norm.updated }
      );

      // 6-2) 출력 디스패치 (FAST: 스풀 감시 제거)
      try {
        const bridge = (window as any)?.printBridge?.passcards as
          | ((jobs: any[], options: any) => Promise<any>)
          | undefined;
        const ipcInvoke:
          | undefined
          | ((ch: string, ...args: any[]) => Promise<any>) =
          (window as any)?.ipc?.invoke ??
          (window as any)?.electron?.ipcRenderer?.invoke;

        const on =
          (window as any)?.ipc?.on ??
          (window as any)?.electron?.ipcRenderer?.on;
        const off =
          (window as any)?.ipc?.off ??
          (window as any)?.electron?.ipcRenderer?.removeListener;

        const batchId = `pcard-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;

        const toSeq3 = (v: any) =>
          String(Math.max(0, Math.min(999, Number(v) || 0))).padStart(3, "0");

        const jobs = list.map((j: any) => ({
          PLANT_CD: String(j.PLANT_CD ?? "C200").slice(0, 4),
          SFC_CD: String(j.SFC_CD ?? "").slice(0, 128),
          ORDER_NUMBER: String(j.ORDER_NUMBER ?? "").slice(0, 10),
          BAR_KEY: String(j.BAR_KEY ?? "").slice(0, 20),
          PCARD_SEQ: toSeq3(j.PCARD_SEQ),
          NEXT_ORDER_NUMBER: String(j.NEXT_ORDER_NUMBER ?? "").slice(0, 10),
          SIZE: String(j.SIZE_CD ?? j.SIZE ?? "").slice(0, 8),
          QTY: Number(j.PCARD_QTY ?? j.QTY ?? 0),
          WORK_CENTER: String(j.WORK_CENTER ?? "").slice(0, 50),
          CREATE_DATE: String(j.CREATE_DATE ?? "").slice(0, 20),
          PRINT_DT: String(j.PRINT_DT ?? "").slice(0, 20),
        }));

        const options = {
          deviceName: print.deviceName,
          preview: previewFlag,
          widthMicrons: print.widthMicrons,
          heightMicrons: print.heightMicrons,
        };

        const handleJob = (_: any, msg: any) => {
          if (!msg || msg.batchId !== batchId) return;
          const seq3 = toSeq3(msg?.key?.PCARD_SEQ ?? (msg?.index + 1));
          setCardData((prev) =>
            prev.map((it) =>
              toSeq3(it.seq) === seq3 ? { ...it, isSaving: false } : it
            )
          );
          if (msg.ok !== true && msg.pending !== true) {
            console.warn("[PASSCARD] job failed:", msg?.error || "unknown");
          }
        };
        const handleDone = (_: any, summary: any) => {
          if (!summary || summary.batchId !== batchId) return;
          off?.("passcard:job-result", handleJob);
          off?.("passcard:batch-done", handleDone);
          const { okCount, failCount } = summary;
          console.info(
            `[PASSCARD] batch done: ok=${okCount}, fail=${failCount}`
          );
        };

        on?.("passcard:job-result", handleJob);
        on?.("passcard:batch-done", handleDone);

        if (typeof bridge === "function") {
          await bridge(jobs, options);
        } else if (ipcInvoke) {
          await ipcInvoke("print:passcards", { jobs, options, batchId });
        } else {
          throw new Error(
            "no print bridge or ipc.invoke available (preload missing?)"
          );
        }
        console.info("[PASSCARD] print dispatched (FAST)");
        // 출력 에러가 나더라도 SAP은 계속 (요구사항: BULK만 gate)
        setTimeout(() => {
          off?.("passcard:job-result", handleJob);
          off?.("passcard:batch-done", handleDone);
        }, 90_000);
      } catch (printErr) {
        console.error("❌ PASSCARD print error (SAP은 계속):", printErr);
        // 출력 실패해도 SAP은 계속
      }
    } else {
      console.info("[PASSCARD] skip print (no P rows)");
    }

    // 7) SAP SFC Detail 조회 (operation 등)
    const sfcDetail = (await fetchSfcDetail(
      plant_cd,
      String(data.SFC).slice(0, 128)
    )) as any;

    const bomCode = sfcDetail?.bom?.bom;
    const rawBomType = sfcDetail?.bom?.type;
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
    const stepId = step?.stepId;
    const routing = step?.stepRouting?.routing;
    const resource = step?.resource;
    const operation_Version = step?.operation?.version;
    const totalQuantity = Number(sfcDetail.quantity ?? 0);
    if (!operation) {
      console.error("❌ operation 정보를 가져올 수 없습니다.");
      throw new Error("SFC의 operation 정보를 확인할 수 없습니다.");
    }

    // 8) BOM 상세
    let baseUnitOfMeasure = "";
    try {
      const bomResp = await ax.get("/api/sap/bom-detail", {
        params: { plant: plant_cd, bom: bomCode, type: bomType },
      });
      const bomData = Array.isArray(bomResp.data) ? bomResp.data[0] : bomResp.data;
      console.log("📦 [RAW_BOM_DATA]", JSON.stringify(bomData, null, 2));
      baseUnitOfMeasure = bomData?.baseUnitOfMeasure;
      if (!Array.isArray(bomData?.components)) {
        console.warn("❗ BOM components 데이터가 없습니다.");
        return showToast(t("toast.noBomComponents"));
      }
      console.log("🧩 BOM에서 추출된 components:", bomData.components);
    } catch (err) {
      console.error("❌ BOM Detail 조회 실패", err);
      return showToast(t("toast.loadBomFailed"));
    }

    // 9) START (첫 입고 시) — 최신 상태 기준(같은 SFC)
    const hasAnyInput = updatedData.some(
      (c) => c.mappedSFC === currentSfc && !!c.prod_dt
    );
    if (!hasAnyInput) {
      await callSapStartApi({
        plant: plant_cd,
        operation,
        resource: data.WORK_CENTER,
        sfcs: [rawSfc],
        processLot: "",
      });
    }

    // 10) UOM
    const uomResp = await ax.get("/api/sap/unit-codes", {
      params: { unitCode: baseUnitOfMeasure },
    });
    const uomData = Array.isArray(uomResp.data) ? uomResp.data[0] : uomResp.data;
    const unitOfMeasure = {
      commercialUnitOfMeasure:
        uomData?.commercialCodes?.[0]?.commercialCode || baseUnitOfMeasure,
      internalUnitOfMeasure: baseUnitOfMeasure,
      isoUnitOfMeasure: uomData?.isoCode || baseUnitOfMeasure,
    };

    // 11) GoodsReceipt(합계 1회)
    const totalQty = promoted.reduce(
      (sum, item) => sum + Number(item.qty || 0),
      0
    );
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
          quantity: { unitOfMeasure, value: totalQty },
          sfc: rawSfc,
          storageLocation,
        },
      ],
    });

    // 12) TxID 매칭으로 Final 여부 판단
    const txIds: string[] = (grResp?.lineItems || [])
      .filter((li: any) => li?.transactionId && !li?.hasError)
      .map((li: any) => String(li.transactionId).trim());

    let isFinal = false;
    try {
      const allPosted = await fetchPostedGoodsReceipts(
        plant_cd,
        orderNumber,
        rawSfc,
        data.MATERIAL_CODE,
        txIds
      );

      const txIdSet = new Set(txIds.map((x) => String(x).trim()));
      const postedQty = allPosted
        .filter((gr: any) => !txIdSet.has(String(gr.transactionId || "").trim()))
        .reduce(
          (sum: number, gr: any) => sum + Number(gr.quantityInBaseUnit?.value ?? 0),
          0
        );

      const currentProcessingQty = allPosted
        .filter((gr: any) => txIdSet.has(String(gr.transactionId || "").trim()))
        .reduce(
          (sum: number, gr: any) => sum + Number(gr.quantityInBaseUnit?.value ?? 0),
          0
        );

      const totalDone = Math.round((postedQty + currentProcessingQty) * 1000) / 1000;
      isFinal = Math.abs(totalQuantity - totalDone) < 0.001;

      console.log("📦 입고 누적 수량 체크", {
        totalQuantity,
        postedQty,
        currentProcessingQty,
        totalDone,
        isFinal,
      });
    } catch (e) {
      console.warn("⚠️ TxID 기반 POSTED 조회 실패, isFinal=false 처리", e);
    }

    // 13) QuantityConfirm(합계 1회)
    await ax.post("/api/sap-post-qty-confirm", {
      plant: plant_cd,
      shopOrder: orderNumber,
      sfc: rawSfc,
      operationActivity: operation,
      workCenter: data.WORK_CENTER,
      yieldQuantity: totalQty,
      yieldQuantityUnit: unitOfMeasure.internalUnitOfMeasure,
      yieldQuantityIsoUnit: unitOfMeasure.isoUnitOfMeasure,
      // isFinalConfirmation: isFinal  (정책상 false 고정)
      isFinalConfirmation: false,
    });

    // 14) Final이면 ActivityConfirm(표준값 기반) — 실패해도 전체 플로우는 계속
    try {
      const standardValueObj = await fetchStandardValueObject({
        plant: plant_cd,
        workCenter: data.WORK_CENTER,
        operationActivity: operation,
        operationActivityVersion: operation_Version,
        object: orderNumber,
        objectType: "SHOP_ORDER_ROUTING",
        objectVersion: "ERP001",
      });
      if (standardValueObj) {
        const postingDateTime = new Date()
          .toISOString()
          .replace(/\.\d{3}Z$/, ".000Z");
        const postedBy = "dongil.kang@changshininc.com";
        const activityList: ActivityItem[] =
          standardValueObj.standardValueCollectionList.map((item: any) => ({
            activityId: item.standardVal,
            quantity: item.standardValueQuantity?.value || 0,
            unitOfMeasure: item.standardValueQuantity?.unitOfMeasure?.uom || "S",
            isoUnitOfMeasure:
              item.standardValueQuantity?.unitOfMeasure?.internalUom || "S",
            postedBy,
            postingDateTime,
          }));

        await callSapPostActivityConfirm({
          plant: plant_cd,
          shopOrder: orderNumber,
          sfc: data.SFC,
          operationActivity: operation,
          stepId: stepId ?? "",
          workCenter: data.WORK_CENTER,
          activityList,
        });
        console.log("✅ SAP Activity Confirm 성공");
      }
    } catch (err: any) {
      console.error("❌ SAP Activity Confirm 실패:", err?.response?.data || err?.message);
    }

    // 15) Upload YN 업데이트(P만)
    await ax.post("/api/mssql/update-upload-yn", {
      plant_cd,
      sfc: rawSfc,
      scan_type: "P",
      seqList: promoted.map((it) => it.seq),
    });

    showToast(t("toast.saveAllDone"));
  } catch (err) {
    console.error("❌ SaveAll 처리 오류:", err);
    showToast(t("toast.saveAllError"));
  } finally {
    // 16) 진행중 해제(대상만)
    cleanupSavingFlags();
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
    fontSize: "20px"
  };

  const cardBlock = (data: CardItem | null) => {
    if (!data) return <div style={{ height: "80px" }}></div>;

    const clickable = isCardClickable(data);
    const isSaving = data.isSaving === true;

    // 🔹 배경 및 테두리 조건 처리
    const backgroundColor = isSaving ? "#ffe4e1" : getColorByStatus(data);  // 진행중일 때 연분홍
    const border = isSaving ? "3px solid red" : "none";                     // 진행중일 때 빨간 테두리

    return (
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          width: "100%",
          height: "80px",
          pointerEvents: clickable ? "auto" : "none"
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
            boxShadow: "inset 0 0 4px rgba(0,0,0,0.2)",
          }}
        >
          {isSaving ? (
            <div
              style={{
                fontSize: "2rem",         // ✅ 글자 크게
                fontWeight: "bold",
                color: "#d9534f",
                lineHeight: "2rem",         // ✅ 세로 공간 키움
                minHeight: "80px",          // ✅ 카드 전체 높이와 맞춤
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                textAlign: "center"
              }}
            >
              {t("ui.inProgress")}<br />
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
              lineHeight: "1rem"
            }}
          >
            {t("ui.inProgressShort")}
          </div>
        ) : (
          <img
            src={getImageByStatus(data)}
            alt="OK"
            style={{
              width: "60px",
              height: "60px",
              fontSize: "0.75rem",
              borderRadius: "10px",
              cursor: clickable ? "pointer" : "not-allowed",
              opacity: clickable ? 1 : 0.4,
              objectFit: "contain",
              pointerEvents: clickable ? "auto" : "none"
            }}
            onClick={() => {
              if (!clickable) return;
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
        style={{ width: "860px", height: "85vh", backgroundColor: "black", color: "white", overflowX: "hidden" }}>
        <div style={{ padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-start", gap: "1.6rem", marginBottom: "1rem" }}>
            <div style={{ backgroundColor: "black", color: "white", fontSize: "13px", minWidth: "220px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", border: "1px solid white" }}>
                <tbody>
                  {Object.entries({
                    [t("app.detail.date")]: data?.WORK_DATE ?? "-",
                    [t("app.detail.line")]: data?.WORK_CENTER ?? "-",
                    [t("app.table.model")]: data?.MODEL_CD ?? "-",
                    [t("app.table.styleCode")]: data?.STYLE_CD ?? "-",
                    [t("app.table.materialCode")]: data?.MATERIAL_CODE ?? "-",
                    [t("app.table.materialName")]: data?.MATERIAL_DESCRIPTION ?? "-",
                    [t("app.table.sfc")]: data?.SFC ?? "-",
                    [t("app.table.quantity")]: data?.QUANTITY ?? "-",
                    [t("app.detail.size")]: data?.SIZE_CD ?? "-",
                    [t("app.detail.orderNo")]: data?.ORDER_NUMBER ?? "-",
                    [t("app.detail.storage")]: data?.PUTAWAYSTORAGELOCATION ?? "-",
                  }).map(([key, value]) => (
                    <tr key={key}>
                      <td style={{ width: "100px", fontWeight: "bold", padding: "6px 8px", border: "1px solid white", backgroundColor: "black", color: "white", whiteSpace: "nowrap" }}>• {key}</td>
                      <td style={{ padding: "6px 8px", border: "1px solid white", backgroundColor: "black", color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>: {value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <Text style={{ fontSize: "3rem", color: "white", fontWeight: "bold",  marginTop: "-10px", marginBottom: "0.5rem",  }}>
                {t("dialog.confirm.title")}
              </Text>

              <div style={{
                display: "flex",
                justifyContent: "center",
                gap: "1.5rem",
                marginBottom: "1.7rem"
              }}>
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
                        transition: "border 0.2s, background-color 0.2s"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setCheckedStates((prev) => ({
                            ...prev,
                            [key]: e.target.checked
                          }))
                        }
                        style={{
                          transform: "scale(1.8)",
                          cursor: "pointer",
                          width: "20px",
                          height: "20px",
                          accentColor: "cyan"
                        }}
                      />
                      {label}
                    </label>
                  );
                })}

              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                {(() => { const { a, b } = split2(t("button.saveDetail")); return (
                  <Button
                    icon={saveIcon}
                    className="detail-button"
                    onClick={handleSaveDetail}
                    disabled={!canSaveDetail} // 체크(색 변경)된 카드가 없으면 비활성화
                  >
                    {a}{b ? <><br />{b}</> : null}
                  </Button>
                )})()}
                {(() => { const { a, b } = split2(t("button.saveAll")); return (
                  <Button
                    icon={saveIcon}
                    className="detail-button"
                    onClick={handleSaveAll}
                    disabled={!(canSaveAll)} // 하나라도 업데이트 가능 상태가 없으면 비활성화
                  >
                    {a}{b ? <><br />{b}</> : null}
                  </Button>
                )})()}
                <Button icon="decline" className="detail-button detail-button-danger" onClick={onClose}>
                  {t("button.close")}
                </Button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginLeft: "0px" }}>
            {rowsByColumns.map((row, rowIndex) => (
              <div key={rowIndex} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                {row.map((data, colIndex) => (
                  <div key={colIndex} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    {data ? cardBlock(data) : <div style={{ height: "80px" }}></div>}
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
                      fontWeight: "bold"
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

export default E_ScanOutgoing_Detail_N;
