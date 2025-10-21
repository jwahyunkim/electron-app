import saveIcon from "@ui5/webcomponents-icons/dist/save.js";
import { useState, useEffect, useRef, useMemo  } from "react";
import axios from "axios";
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

import './index.css'; 
import { SAP_CONFIG, getAccessToken, refreshToken } from "@shared/sap";
import { loadConfigClient } from "../utils/loadConfigClient";
import type { DbConfig } from "../utils/loadConfigClient";

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



export function E_ScanOutgoing_Detail({ open, onClose, data, cellInfo, rows, onConfirm, plant_cd, work_date }: Props) {
  const [cardData, setCardData] = useState<CardItem[]>([]);
  const originalCardDataRef = useRef<CardItem[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isButtonEnabled, setIsButtonEnabled] = useState(true);
  const [isSfcMode, setIsSfcMode] = useState(false);
  const [minValidSfc, setMinValidSfc] = useState<string | null>(null); // ✅ 추가
  const orderedSfcListRef = useRef<string[]>([]);
  const stableSfc = useMemo(() => {
    return typeof data?.SFC === "string" ? data.SFC : "";
  }, [data]);
  const [localIp, setLocalIp] = useState<string>("");
  const [externalIp, setExternalIp] = useState<string>("");
  const [config, setConfig] = useState<DbConfig | null>(null);

  type FilterKey = 'notStarted' | 'inProgress' | 'completed';

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'notStarted', label: '미진행' },
    { key: 'inProgress', label: '진행중' },
    { key: 'completed', label: '완료' }
  ];

  const itemsPerPage = 8; // 카드 8개씩


  const [checkedStates, setCheckedStates] = useState<Record<FilterKey, boolean>>({
  notStarted: false,
  inProgress: false,
  completed: false
});


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

  const columnCount = 2;

  const paginatedData = [...filteredCardData]
  .filter(x => x.seq != null)
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
    paddedData.push(null);  // 빈 자리용
  }


  const rowsByColumns = Array.from({ length: Math.ceil(paddedData.length / columnCount) }, (_, rowIndex) =>
    paddedData.slice(rowIndex * columnCount, rowIndex * columnCount + columnCount)
  );

  const totalPages = Math.ceil(filteredCardData.length / itemsPerPage); // ✅ 체크박스 필터 결과 기준

  useEffect(() => {
    if (open && config === null) {
      // 디테일 팝업이 열릴 때 딱 1회 로딩
      loadConfigClient().then((cfg: DbConfig | null) => {
        if (cfg) {
          console.log("📥 config 전체 내용:", cfg);
          setConfig(cfg);
        } else {
          console.warn("⚠️ config 불러오기 실패");
        }
      });
    }
  }, [open]);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch("http://localhost:4000/api/get-ip");
        const data = await res.json();
        console.log("🌐 사용자 내부 IP:", data.localIp);
        console.log("🌍 사용자 외부 IP:", data.externalIp);
        setLocalIp(data.localIp);
        setExternalIp(data.externalIp);
      } catch (err) {
        console.error("❌ IP 조회 실패", err);
      }
    };

    fetchIp();
  }, []);


  useEffect(() => {
    if (!open || !data) return;

    const loadData = async () => {
      try {
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
            operation: "",
            resource: ""
          });
        }

        // ✅ MSSQL에서 저장된 스캔 데이터 가져오기
        const res = await axios.get("http://localhost:4000/api/mssql/escan-detail-v2", {
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
          const seqNum = Number(scan.SEQ);  // 🔥 핵심 수정
          const idx = generatedCards.findIndex(card => card.seq === seqNum);
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




  // const savedMappingRef = useRef(false); // ✅ 중복 저장 방지용

  // useEffect(() => {
  //   if (!open || cardData.length === 0 || savedMappingRef.current) return;

  //   // ✅ 매핑 저장용 payload 구성
  //   const payload = cardData.map((card) => ({
  //     ORDER_NUMBER: data.ORDER_NUMBER,
  //     SEQ: String(card.seq),
  //     SFC: card.mappedSFC
  //   }));
  // console.log("📦 매핑 저장 요청:", payload);
  //   axios.post("http://localhost:4000/api/mssql/save-mapping", { list: payload })
  //     .then(() => {
  //       console.log("✅ TMP_PCARD_SFC_MAPPING 저장 완료");
  //       savedMappingRef.current = true; // ✅ 재호출 방지
  //     })
  //     .catch((err) => console.error("❌ 매핑 저장 실패:", err));
  // }, [open, cardData, data.ORDER_NUMBER]);


  const handleDetailOk = (clickedCard: CardItem) => {
    setCardData((prev) =>
      prev.map((item) => {
        if (item.seq !== clickedCard.seq) return item;

        const { input_dt, prod_dt } = item;
        let current = item.confirm_YN;
        let newStatus = current;

        if (current === "N") {
          newStatus = input_dt ? "TP" : "TT";
        } else if (current === "TT") {
          newStatus = input_dt ? "TP" : "T";
        } else if (current === "T") {
          newStatus = "TP";
        } else if (current === "TP") {
          if (input_dt && prod_dt) {
            newStatus = "P";
          } else {
            return item; // 조건 불충족 시 상태 그대로 유지
          }
        } else if (current === "Y" || current === "P") {
          return item; // 확정되거나 완료 상태는 무시
        }

        console.log(`🟢 클릭 허용됨: ${item.seq}, confirm_YN: ${current} → ${newStatus}`);
        return { ...item, confirm_YN: newStatus };
      })
    );
  };




  const getColorByStatus = (status: string) => {
    switch (status) {
      case "Y":
      case "P": return "limegreen";
      case "T": return "dodgerblue";
      case "TP": return "orange";
      case "TT": return "yellow";
      case "N": return "#f5f5f5";
    }
  };

  const getImageByStatus = (status: string) => {
    switch (status) {
      case "P":
      case "Y": return okGreen;
      case "TP": return okOrange;
      case "T": return okDodgerblue;
      case "TT": return okYellow;
      case "N": return okWhite;
      default: return okWhite;
    }
  };

  const getModifiedRows = (original: CardItem[], current: CardItem[]) => {
    return current
      .map((cur, idx) => {
        const ori = original[idx];

        const normalizedCurStatus = cur.confirm_YN === "TP" ? "P"
                                    : cur.confirm_YN === "TT" ? "T"
                                    : cur.confirm_YN;

        const normalizedOriStatus = ori.confirm_YN === "TP" ? "T"
                                    : ori.confirm_YN === "TT" ? "N"
                                    : ori.confirm_YN;

        const isChanged = normalizedCurStatus !== normalizedOriStatus;

        // ✅ SCAN_TYPE 결정: input_dt가 없으면 'T', 있으면 'P'
        const scanType = cur.input_dt == null ? "T" : "P"; // ✅ 더 안전한 비교

        return {
          ...cur,
          confirm_YN: normalizedCurStatus,
          SCAN_TYPE: scanType,
          _changed: isChanged && ["T", "P"].includes(normalizedCurStatus)
        };
      })
      .filter(item => item._changed)
      .map(({ _changed, ...rest }) => rest); // _changed 제거 후 반환
  };


    // // ✅ 그 다음에 useMemo
    // const hasModifiedCards = useMemo(() => {
    //   const modified = getModifiedRows(originalCardDataRef.current, cardData);
    //   return modified.length > 0;
    // }, [cardData]);

    // const hasUpdatableCards = useMemo(() => {
    //   return cardData.some(card =>
    //     (card.confirm_YN === "N" || card.confirm_YN === "I") && card.flag !== "FINISH"
    //   );
    // }, [cardData]);

    // ✅ 필터된 카드 중 수정된 것만 추출
    const filteredModifiedCards = useMemo(() => {
      const modified = getModifiedRows(originalCardDataRef.current, cardData);
      return modified.filter((card) =>
        filteredCardData.some(f => f.seq === card.seq)
      );
    }, [cardData, filteredCardData]);

    // ✅ 필터된 카드 중 저장 가능한 것 추출 (N, T 상태)
    const filteredUpdatableCards = useMemo(() => {
      return filteredCardData.filter(card =>
        (card.confirm_YN === "N" || card.confirm_YN === "T") &&
        card.flag !== "FINISH"
      );
}, [filteredCardData]);

    // ✅ 현재 선택된 SFC가 가장 빠른 SFC인지 여부 판단
    const isSingleSfc = orderedSfcListRef.current.length <= 1;
    const isClickable = isSingleSfc || (stableSfc !== "" && stableSfc === minValidSfc);

    // ✅ 현재 SFC가 제한된 상태인지 (저장 차단 조건)
    const isSfcBlocked = isSfcMode && !!minValidSfc && data.SFC !== minValidSfc;

    // // ✅ 저장 가능 여부 (기존 조건 + 클릭 가능 여부 포함)
    // const canSaveDetail = hasModifiedCards && !isSfcBlocked && isClickable;
    // const canSaveAll = hasUpdatableCards && !isSfcBlocked && isClickable;
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

        const res = await axios.post("http://localhost:4000/api/sap-start", payload);

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

        const res = await axios.post("http://localhost:4000/api/sap-complete", payload);

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
      await axios.post("http://localhost:4000/api/mssql/escan-detail-save", { list: cardsToSave });
      setCardData(prev =>
        prev.map(item =>
          cardsToSave.some(c => c.SEQ === item.seq.toString())
            ? { ...item, confirm_YN: "Y" }
            : item
        )
      );
    } catch (err) {
      showToast("❌ 저장 실패");
    }
  };

  const handlePostConfirm_V2 = async (cardsToSave: SavePayloadItem[]) => {
  try {
    await axios.post("http://localhost:4000/api/mssql/escan-detail-save_v2", {
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
    showToast("❌ 저장 실패");
  }
};

  const fetchSfcDetail = async (plant_cd: string, sfc: string) => {
    try {
      const res = await axios.get("http://localhost:4000/api/sap/sfc-detail", {
        params: { plant_cd, sfc },
      });
      return res.data;
    } catch (err: any) {
      console.error("❌ SAP SFC 상태 조회 실패:", err.response?.data || err.message);
      return null;
    }
  };

//   const fetchGoodsReceipts = async (
//   plant: string,
//   order?: string,
//   sfc?: string,
//   material?: string
// ) => {
//   try {
//     const res = await axios.get("http://localhost:4000/api/sap/goodsreceipts", {
//       params: {
//         plant,
//         ...(order && { order }),
//         ...(sfc && { sfc }),
//         ...(material && { material })
//       }
//     });

//     return res.data;
//   } catch (err: any) {
//     console.error("❌ SAP 입고 이력 조회 실패:", err.response?.data || err.message);
//     return null;
//   }
// };
  const fetchPostedGoodsReceipts = async (
    plant: string,
    order: string,
    sfc: string,
    material: string,
    transactionIds: string[], // ← TxID 유무에 따라 필터링 여부 결정
    maxRetries = 50,
    delayMs = 1000
  ): Promise<any[]> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await axios.get("http://localhost:4000/api/sap/goodsreceipts", {
          params: { plant, order, sfc, material }
        });

        const data = Array.isArray((res.data as any))
          ? (res.data as any)
          : Array.isArray((res.data as any)?.content)
          ? (res.data as any).content
          : Array.isArray((res.data as any)?.lineItems)
          ? (res.data as any).lineItems
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

        const url = "http://localhost:4000/api/sap-post-assembled";
        console.log("🌐 호출 URL:", url);

        const res = await axios.post(url, payload, {
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
      if (!getAccessToken()) {
        console.warn("🔐 액세스 토큰 없음 → 토큰 갱신 시도 중...");
        await refreshToken();
      }

      const token = getAccessToken();
      if (!token) {
        console.error("❌ 액세스 토큰 획득 실패 → API 호출 중단");
        return;
      }

      const url = "http://localhost:4000/api/sap-post-assembled_auto";
      console.log("🌐 호출 URL:", url);
      console.log("📦 요청 Payload:", payload);

      const res = await axios.post(url, payload, {
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
      const res = await axios.post("http://localhost:4000/api/sap-post-goodsissue", {
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

      const payload = {
        plant,
        order,
        postedBy: postedBy || "system",
        lineItems
      };

      const url = "http://localhost:4000/api/sap-goods-receipt";
      console.log("🌐 호출 URL:", url);

      const res = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("✅ SAP GoodsReceipt 호출 성공:", res.data);
      return res.data; // ✅ 결과 반환 추가
    } catch (err: any) {
      const responseData = err?.response?.data || {};
      console.error("❌ SAP GoodsReceipt 호출 실패:", responseData.error || err.message);
      console.error("📥 전체 오류 응답:", responseData);
      throw err; // ❗ 오류는 상위에서 처리할 수 있도록 throw 해주는 게 좋음
    }
  };


  
/// 기존 입고 방식 잘됨!!!
  // const callSapPostGoodsReceipt = async ({
  //   plant,
  //   order,
  //   postedBy,
  //   lineItems
  // }: {
  //   plant: string;
  //   order: string;
  //   postedBy?: string;
  //   lineItems: {
  //     material: string;
  //     materialVersion?: string;
  //     postingDate: string;
  //     postingDateTime?: string;
  //     quantity: {
  //       unitOfMeasure: {
  //         commercialUnitOfMeasure: string;
  //         internalUnitOfMeasure: string;
  //         isoUnitOfMeasure: string;
  //       };
  //       value: number;
  //     };
  //     sfc: string;
  //     storageLocation: string;
  //   }[];
  // }) => {
  //   console.log("🚀 [SAP GoodsReceipt] 호출 시작");
  //   console.log("📦 요청 Payload:", {
  //     plant,
  //     order,
  //     postedBy,
  //     lineItems
  //   });

  //   try {
  //     if (!getAccessToken()) {
  //       console.warn("🔐 액세스 토큰 없음 → 토큰 갱신 시도 중...");
  //       await refreshToken();
  //     }

  //     const token = getAccessToken();
  //     if (!token) {
  //       console.error("❌ 액세스 토큰 획득 실패 → API 호출 중단");
  //       return;
  //     }

  //     const payload = {
  //       plant,
  //       order,
  //       postedBy: postedBy || "system",
  //       lineItems
  //     };

  //     const url = "http://localhost:4000/api/sap-goods-receipt";
  //     console.log("🌐 호출 URL:", url);

  //     const res = await axios.post(url, payload, {
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //         "Content-Type": "application/json"
  //       }
  //     });

  //     console.log("✅ SAP GoodsReceipt 호출 성공:", res.data);
  //   } catch (err: any) {
  //     const responseData = err?.response?.data || {};
  //     console.error("❌ SAP GoodsReceipt 호출 실패:", responseData.error || err.message);
  //     console.error("📥 전체 오류 응답:", responseData);
  //   }
  // };


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
      const res = await axios.post("http://localhost:4000/api/sap-post-autoconfirm", {
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





  ////////////////////////////////////////////////////////////////Save_Detail///////////////////////////////////////////////////////////////////////
  const handleSaveDetail = async () => {
    const changed = getModifiedRows(originalCardDataRef.current, cardData);
    const filtered = changed.filter(item => ["T", "P"].includes(item.confirm_YN));

    if (filtered.length === 0) return showToast("변경된 카드가 없습니다.");
    const rawSfc = String(data?.SFC || "").slice(0, 128);

    if (!rawSfc) {
      console.error("❌ 유효하지 않은 SFC: null 또는 빈 문자열입니다.");
      showToast("SFC 정보가 없습니다.");
      return;
    }

    const payload = filtered.map(item => ({
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
      DEVICE_ID: "POP_DEVICE_01"
    }));

    handlePostConfirm_V2(payload);

    onConfirm?.(payload);

    //Sap Api 호출을 위한 필수 정보
     // 🔍 SAP SFC Detail 조회 → operation 값 동적 추출
    const sfcDetail = await fetchSfcDetail(plant_cd, String(data.SFC).slice(0, 128)) as any;
    
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
      return showToast("BOM 정보를 확인할 수 없습니다.");
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
      const bomResp = await axios.get("http://localhost:4000/api/sap/bom-detail", {
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
        return showToast("SAP BOM 구성품 정보가 없습니다.");
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
      return showToast("BOM 상세 정보 로딩 실패");
    }

     // ✅ SAP START 호출 조건: 모든 카드에 input_dt 없을 때만
    const hasAnyInput = cardData.some(c => !!c.input_dt);
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

    //  // ✅ Input 상태인 카드만 SAP ASSEMBLE 호출
    // for (const item of filtered) {
    //   if (item.confirm_YN === "T") {
    //     await callSapPostAssembledComponent_auto({
    //       plant: plant_cd,
    //       sfc: String(data.SFC).slice(0, 128),
    //       operationActivity: operation,
    //       quantity: item.qty,
    //       resource: String(data.WORK_CENTER).slice(0, 36),
    //       hasTimeBased: true,
    //       hasNonTimeBased: true
    //     });
    //   }
    // }
    // ✅ SAP Goods Issue 처리 (1건씩 처리 + issued 재조회 방식)
    const issuedMap = new Map<string, number>();
    const processingMap = new Map<string, number>();
    const remainingQtyMap = new Map<string, number>();
    const requiredTotalMap = new Map<string, number>();
    const PRECISION = 1000;

    // ✅ 구성품별 총 필요 수량 계산
    const totalQty = data.qty;
    for (const comp of components) {
      const key = `${comp.component}|${comp.componentVersion}`;
      const total = Number((comp.totalQuantity ?? comp.quantity * totalQty).toFixed(3));
      requiredTotalMap.set(key, total);
    }

    // ✅ issuedMap: 구성품별로 1회만 조회
    for (const comp of components) {
      const key = `${comp.component}|${comp.componentVersion}`;
      try {
        const issuedResp = await axios.get("http://localhost:4000/api/sap/goodsissued-components", {
          params: {
            plant: plant_cd,
            material: comp.component,
            materialVersion: comp.componentVersion,
            order: data.ORDER_NUMBER,
            sfc: rawSfc,
            workCenter: String(data.WORK_CENTER ?? "").trim()
          }
        });

        const issuedData = Array.isArray(issuedResp.data)
          ? issuedResp.data
          : (issuedResp.data as any)?.content ?? [];


          

        let totalIssued = 0; // 테스트 초기값
        for (const entry of issuedData) {
          const quantity = Number(entry.quantityInBaseUnit?.value ?? 0);
          if (
            entry.postingStatus === "POSTED_TO_TARGET_SYS" &&
            !entry.cancellationTriggered &&
            quantity > 0
          ) {
            totalIssued += quantity;
          }
        }

        const issuedSoFar = Math.round(totalIssued * PRECISION) / PRECISION;
        issuedMap.set(key, issuedSoFar);
        console.log(`✅ [초기 issued 조회 완료] ${key} = ${issuedSoFar}`);
      } catch (err) {
        console.warn(`❗ issued 조회 실패 (${key})`, err);
        issuedMap.set(key, 1); // 테스트용 디폴트
      }
    }
    let index = 0;
    // ✅ 카드별 투입 처리
    for (const item of filtered) {
      if (item.confirm_YN !== "T") continue;

      for (const comp of components) {
        const key = `${comp.component}|${comp.componentVersion}`;
        const currentQty = Math.round(comp.quantity * item.qty * PRECISION) / PRECISION;
        let remainingQty = currentQty;
        let totalUsedThisCard = 0;

        // 누적된 값 불러오기
        const issuedSoFar = issuedMap.get(key) ?? 0;
        const prevProcessing = processingMap.get(key) ?? 0;
        const processingSoFar = Math.round(prevProcessing * PRECISION) / PRECISION;
        const requiredTotal = Math.round((requiredTotalMap.get(key) ?? 0) * PRECISION) / PRECISION;

        const inventoryResp = await axios.get("http://localhost:4000/api/sap/inventories", {
          params: {
            plant: plant_cd,
            material: comp.component,
            materialVersion: comp.componentVersion,
            stockRetrieveScope: "NO_ZERO_STOCK",
            batchesWithStatus: true,
            status: ["UNRESTRICTED", "RESTRICTED"],
            storageLocation: comp.storageLocation
          }
        });

        const sortedInventory = (inventoryResp.data as any[] ?? []).sort(
          (a: any, b: any) =>
            new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime()
        );



        for (const inv of sortedInventory) {
          const availableQty = Math.round(Number(inv.quantityOnHand?.value ?? 0) * PRECISION) / PRECISION;
          if (availableQty <= 0 || remainingQty <= 0) continue;

          const maxConsumableQty = Math.max(0, requiredTotal - issuedSoFar - processingSoFar - totalUsedThisCard);
          const usedQty = Math.min(remainingQty, availableQty, maxConsumableQty);
          const usedQtyRounded = Math.round(usedQty * PRECISION) / PRECISION;
          if (usedQtyRounded <= 0) continue;

          console.log(
            `🧾 카드[${item.seq}] | 구성품: ${comp.component}` +
            `\n   총필요: ${requiredTotal}` +
            `\n   issuedSoFar: ${issuedSoFar}` +
            `\n   processingSoFar: ${processingSoFar}` +
            `\n   maxConsumableQty: ${maxConsumableQty}` +
            `\n   available: ${availableQty}` +
            `\n   remainingQty: ${remainingQty}` +
            `\n   최종 투입: ${usedQtyRounded}`
          );

          try {
            await callSapPostGoodsIssue({
              plant: plant_cd,
              order: data.ORDER_NUMBER,
              phase: operation,
              workCenter: String(data.WORK_CENTER ?? "").slice(0, 36),
              component: comp.component,
              componentVersion: comp.componentVersion,
              quantity: usedQtyRounded,
              unitOfMeasure: comp.unitOfMeasure,
              postedBy: localIp,
              // postingDateTime: dayjs().subtract(10, "second").format("YYYY-MM-DD HH:mm:ss"),
              postingDateTime: new Date(Date.now() - (10000 - index * 1000)).toISOString(),
              bomCode: resolvedBomCode,
              bomVersion: bomVersion,
              inventoryId: inv.inventoryId
            });
          } catch (err) {
            console.warn(`❌ SAP GoodsIssue 실패: ${inv.inventoryId} ${usedQtyRounded}`, err);
            continue;
          }
          index++;

          remainingQty = Math.round((remainingQty - usedQtyRounded) * PRECISION) / PRECISION;
          totalUsedThisCard = Math.round((totalUsedThisCard + usedQtyRounded) * PRECISION) / PRECISION;
        }

        // ✅ 카드 처리 후 전체 처리량 누적
        const newProcessing = Math.round((prevProcessing + totalUsedThisCard) * PRECISION) / PRECISION;
        processingMap.set(key, newProcessing);

        const remainingTotal = Math.round((requiredTotal - issuedSoFar - newProcessing) * PRECISION) / PRECISION;
        remainingQtyMap.set(key, remainingTotal);
      }
    }



    // // ✅ 선택한 카드가 P일때 complete SAP POST 호출
    // for (const item of filtered) {
    // if (item.confirm_YN === "P") {
    //   console.log("✅ Receipts 진입");
    //   const sapPayload = {
    //     plant: plant_cd.slice(0, 6),
    //     operation,
    //     resource: String(data.WORK_CENTER ?? "").slice(0, 36),
    //     quantity: item.qty,
    //     sfcs: [String(data.SFC ?? "").slice(0, 128)],
    //     processLot: ""
    //   };
    //   await callSapEndApi(sapPayload);
    //   }
    // }

    let index2 = 0;
    for (const item of filtered) {
      console.log("🧪 confirm_YN 값:", item.confirm_YN);
      if (item.confirm_YN === "P") {
        console.log("✅ GoodsReceipt 진입");

        // ✅ 필수: SFC 번호 (SAP 입고에 필요)
        const rawSfc = String(data.SFC ?? "").slice(0, 128);

        // ✅ 필수: 입고일자 (YYYY-MM-DD 형식)
        const workDate = work_date;


        // ✅ 필수: 저장위치 (SAP 저장위치 코드)
        const storageLocation = String(data.PUTAWAYSTORAGELOCATION ?? "").slice(0, 10);

        // ✅ 필수: 생산오더 번호 (SAP 입고 처리에 필요)
        const orderNumber = String(data.ORDER_NUMBER ?? "").slice(0, 12);

        // ✅ 필수: 자재코드 (입고 대상 자재)
        const materialCode = data.MATERIAL_CODE;

        // ✅ 선택 (필요 시): 자재 버전
        const materialVersion = data.MATERIAL_VERSION || "ERP001";  // 기본값 적용

        // ✅ 필수: 카드 단위 수량
        const quantityValue = item.qty;

        

      // ✅ 1. SAP 단위코드 데이터 조회
      let uomData: any = null;
      try {
        const uomResp = await axios.get("http://localhost:4000/api/sap/unit-codes", {
          params: { unitCode: baseUnitOfMeasure }
        });

        // 🔍 직접 일치 결과 사용 (SAP API가 1개만 리턴한다고 가정)
        const matched = Array.isArray(uomResp.data) ? uomResp.data[0] : uomResp.data;

        if (!matched || !matched.unitCode) throw new Error("단위코드 조회 실패");

        uomData = matched;
      } catch (err) {
        console.error("❌ 단위코드 조회 실패:", err);
        return showToast("단위코드 정보 확인 실패");
      }

      // ✅ 2. 다국어 우선순위 적용 함수
      const getPreferredCommercialCode = (codes: any[] = []) => {
        const preferredLanguages = ['ko', 'en'];
        for (const lang of preferredLanguages) {
          const match = codes.find((c: any) => c.language === lang);
          if (match?.commercialCode) return match.commercialCode;
        }
        return codes[0]?.commercialCode || baseUnitOfMeasure;
      };

      // ✅ 3. 단위 정보 구성
      const unitOfMeasure = {
        commercialUnitOfMeasure: getPreferredCommercialCode(uomData?.commercialCodes),
        internalUnitOfMeasure: baseUnitOfMeasure,
        isoUnitOfMeasure: uomData?.isoCode || baseUnitOfMeasure
      };



        // // 3. SAP GoodsReceipt 호출
        // await callSapPostGoodsReceipt({
        //   plant: plant_cd,
        //   order: orderNumber,
        //   lineItems: [
        //     {
        //       material: materialCode,
        //       materialVersion: materialVersion,
        //       postingDate: workDate,
        //       quantity: {
        //         unitOfMeasure,
        //         value: quantityValue
        //       },
        //       sfc: rawSfc,
        //       storageLocation: storageLocation
        //     }
        //   ]
        // });

      // 📌 1. SAP 입고 등록 호출
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
              unitOfMeasure: {
                commercialUnitOfMeasure: "PR",
                internalUnitOfMeasure: "PR",
                isoUnitOfMeasure: "PR1"
              },
              value: quantityValue
            },
            sfc: rawSfc,
            storageLocation
          }
        ]
      });

    // 📌 2. 응답에서 transactionId 추출
    console.log("📥 SAP 응답 원본 확인:", response); // 👈 전체 응답 확인
    console.log("📦 lineItems 확인:", response?.lineItems); // 👈 lineItems 확인

    const transactionIds = Array.isArray(response?.lineItems)
      ? response.lineItems
          .filter((item: any) => item?.transactionId && !item?.hasError)
          .map((item: any) => item.transactionId)
      : [];

    console.log("🔍 추출된 transactionIds:", transactionIds); // 👈 추출 결과 확인

    if (!transactionIds.length) {
      console.error("❌ 유효한 트랜잭션 ID 없음 → 조회 중단");
      return;
    }



        // // ✅ 이후 insert 또는 다음 처리
        // await insertToNextStep();




      //   const goodsReceiptTasks = filtered
      //   .filter((item) => item.confirm_YN === "P")
      //   .map((item) => limit(async () => {
      //     try {
      //       const quantityValue = item.qty;
      //       const rawSfc = String(data.SFC ?? "").slice(0, 128);
      //       const orderNumber = String(data.ORDER_NUMBER ?? "").slice(0, 12);
      //       const workDate = work_date;
      //       const storageLocation = String(data.PUTAWAYSTORAGELOCATION ?? "").slice(0, 10);
      //       const materialCode = data.MATERIAL_CODE;
      //       const materialVersion = data.MATERIAL_VERSION || "ERP001";

      //       const unitOfMeasure = {
      //         commercialUnitOfMeasure: getPreferredCommercialCode(uomData?.commercialCodes),
      //         internalUnitOfMeasure: baseUnitOfMeasure,
      //         isoUnitOfMeasure: uomData?.isoCode || baseUnitOfMeasure,
      //       };

      //       await callSapPostGoodsReceipt({
      //         plant: plant_cd,
      //         order: orderNumber,
      //         lineItems: [
      //           {
      //             material: materialCode,
      //             materialVersion: materialVersion,
      //             postingDate: workDate,
      //             quantity: {
      //               unitOfMeasure,
      //               value: quantityValue,
      //             },
      //             sfc: rawSfc,
      //             storageLocation: storageLocation,
      //           },
      //         ],
      //       });

      //       console.log(`✅ GoodsReceipt 완료 - SFC: ${rawSfc}, QTY: ${quantityValue}`);
      //     } catch (err) {
      //       console.warn("❌ SAP GoodsReceipt 실패:", err);
      //     }
      //   }));

      // // 🔁 병렬 처리 실행
      // await Promise.all(goodsReceiptTasks);

        // 4. SAP 수량확정(Quantity Confirmation) 호출
        try {
          // const sfcStatusResp = await axios.get("http://localhost:4000/api/mssql/sfc-status", {
          //   params: { sfc: data.SFC }
          // });

          // const statusCode = sfcStatusResp.data.status;
          // const isFinal = statusCode === "405";

          // if (isFinal) {
          // console.log(`✅ SFC 상태 405 → SAP Final 처리 시작 (status: ${statusCode})`);
          // } else {
          //   console.log(`⏭️ SFC 상태가 405 아님 → 일반 Quantity Confirm 처리 (status: ${statusCode})`);
          // }
         // ✅ SFC 상세 정보 조회 (총 수량만 사용)
          // const sfcDetail_final = await fetchSfcDetail(plant_cd, String(data.SFC).slice(0, 128));
          // const totalQuantity = Number(sfcDetail_final.quantity ?? 0);



        // 1. 전체 POSTED_TO_TARGET_SYS 입고 데이터 조회
          const allPostedReceipts = await fetchPostedGoodsReceipts(
            plant_cd,
            orderNumber,
            rawSfc,
            materialCode,
            transactionIds
          );

          // 2. TxID 매칭 여부
          const postedMatchedTxIds = new Set<string>(
            allPostedReceipts
              .filter((gr: any) => transactionIds.includes(gr.transactionId?.trim?.()))
              .map((gr: any) => gr.transactionId?.trim?.())
          );

          // 3. 전체 POSTED 수량 중 TxID와 **겹치지 않는 것만** 합산
          const postedQty = allPostedReceipts
            .filter((gr: any) => !postedMatchedTxIds.has(gr.transactionId?.trim?.()))
            .reduce((sum, gr) => sum + Number(gr.quantityInBaseUnit?.value ?? 0), 0);

          // 4. TxID에 해당하는 현재 처리 중 수량
          const currentProcessingQty = allPostedReceipts
            .filter((gr: any) => postedMatchedTxIds.has(gr.transactionId?.trim?.()))
            .reduce((sum, gr) => sum + Number(gr.quantityInBaseUnit?.value ?? 0), 0);

          // 5. 총 수량 계산
          const totalDone = Math.round((postedQty + currentProcessingQty) * 1000) / 1000;
          const isFinal = Math.abs(totalQuantity - totalDone) < 0.001;


        // 6. 결과 로그 출력
        console.log("📦 입고 누적 수량 체크");
        console.log(`   🔹 총 수량 (SFC 기준): ${totalQuantity}`);
        console.log(`   🔹 누적 입고 수량 (POSTED): ${postedQty}`);
        console.log(`   🔹 현재 처리 중 수량 (TxID 매칭): ${currentProcessingQty}`);
        console.log(`   🔹 누적 합계 (Posted + 진행중): ${totalDone}`);
        console.log(`   🔹 잔량: ${Math.max(0, totalQuantity - totalDone)}`);
        console.log(`   🔹 Final 여부: ${isFinal ? "✅ Final" : "⏳ 미완료"}`);

        if (isFinal) {
          console.log("✅ 입고 수량이 총 수량과 동일 → Final 처리로 간주");
        } else {
          console.log("⏭️ 아직 입고되지 않은 수량 있음 → 일반 Confirm 처리");
        }






          // // ⏱ 1초 지연 (TEST용)
          // await new Promise(resolve => setTimeout(resolve, 2000));
          // ✅ SAP Quantity Confirmation 호출 (isFinalConfirmation 조건부 추가)
          try {
            const qtyConfirmResp = await axios.post("http://localhost:4000/api/sap-post-qty-confirm", {
              plant: plant_cd,
              shopOrder: orderNumber,
              sfc: rawSfc,
              operationActivity: operation,
              workCenter: data.WORK_CENTER,
              yieldQuantity: quantityValue,
              yieldQuantityUnit: unitOfMeasure.internalUnitOfMeasure,
              yieldQuantityIsoUnit: unitOfMeasure.isoUnitOfMeasure,
              // isFinalConfirmation: false   // ✅ 마지막 카드일 때만 Final 처리
              isFinalConfirmation: isFinal   // ✅ 마지막 카드일 때만 Final 처리
            });

            console.log("✅ Quantity Confirmation 성공:", qtyConfirmResp.data);
          } catch (qcErr) {
            const err = qcErr as any;
            console.error("❌ Quantity Confirmation 실패:", err.response?.data || err.message);
          }

          // ✅ 기존 SAP End API나 FinalConfirm API도 남겨야 할 경우만 아래 유지
          if (isFinal) {

            const postingDateTime = new Date(Date.now() - (10000 - index2 * 1000)).toISOString().replace(/\.\d{3}Z$/, ".000Z");
            // ✅ 1. Auto Activity Confirmation 호출
            try {
              await callSapPostAutoConfirm({
                plant: plant_cd,
                shopOrder: orderNumber,
                sfc: rawSfc,
                operationActivity: operation,
                operationActivityVersion: operation_Version, // 생략 가능
                stepId: stepId ?? "",
                workCenter: data.WORK_CENTER,
                resource: resource,
                routingId: routing ?? "",
                finalConfirmation: true,
                postConfirmationToErp: true,
                postedBy: "dongil.kang@changshininc.com",
                postingDateTime: postingDateTime
              });

              console.log("✅ AutoActivityConfirm 성공");
            } catch (autoErr) {
              const err = autoErr as any;
              console.error("❌ AutoActivityConfirm 실패:", err.response?.data || err.message);
            }           
            // index2++; 
            // ✅ 2. 기존 Final Confirmation 방식 호출
            try {
              const finalConfirmResp = await axios.post("http://localhost:4000/api/sap-post-final-confirm", {
                plant: plant_cd,
                shopOrder: orderNumber,
                sfc: rawSfc,
                operationActivity: operation
              });

              console.log("✅ Final Quantity Confirmation 성공:", finalConfirmResp.data);
            } catch (finalErr) {
              const err = finalErr as any;
              console.error("❌ Final Quantity Confirmation 실패:", err.response?.data || err.message);
            }
          }

        } catch (err) {
          console.error("❌ SFC 상태 확인 또는 SAP 호출 실패:", err);
        }

      }
    }

    onClose();
  };

  // const handleSaveDetail = async () => {
  //   const changed = getModifiedRows(originalCardDataRef.current, cardData);
  //   const filtered = changed.filter(item => ["T", "P"].includes(item.confirm_YN));

  //   if (filtered.length === 0) return showToast("변경된 카드가 없습니다.");
  //   const rawSfc = String(data?.SFC || "").slice(0, 128);

  //   if (!rawSfc) {
  //     console.error("❌ 유효하지 않은 SFC: null 또는 빈 문자열입니다.");
  //     showToast("SFC 정보가 없습니다.");
  //     return;
  //   }
  //   //Sap Api 호출을 위한 필수 정보
  //    // 🔍 SAP SFC Detail 조회 → operation 값 동적 추출
  //   const sfcDetail = await fetchSfcDetail(plant_cd, String(data.SFC).slice(0, 128));
  //   const routingCode = sfcDetail?.routing?.routing;
  //   const routingType = sfcDetail?.routing?.type === "SHOPORDER_SPECIFIC" ? "SHOP_ORDER" : sfcDetail?.routing?.type;

  //   const operation =
  //     sfcDetail?.status?.stepId ||
  //     sfcDetail?.steps?.[0]?.operation?.operation;

  //   if (!operation) {
  //     console.error("❌ operation 정보를 가져올 수 없습니다.");
  //     throw new Error("SFC의 operation 정보를 확인할 수 없습니다.");
  //   }

  //    // ✅ SAP START 호출 조건: 모든 카드에 input_dt 없을 때만
  //   const hasAnyInput = cardData.some(c => !!c.input_dt);
  //   if (!hasAnyInput) {
  //     const sapPayload = {
  //       plant: plant_cd.slice(0, 6),
  //       operation,
  //       resource: String(data.WORK_CENTER ?? "").slice(0, 36),
  //       // quantity: Number(data.QUANTITY ?? 0),
  //       // quantity: 0,
  //       sfcs: [String(data.SFC ?? "").slice(0, 128)],
  //       processLot: ""
  //     };
  //     await callSapStartApi(sapPayload);
  //   }

  //   //  // ✅ Input 상태인 카드만 SAP ASSEMBLE 호출
  //   // for (const item of filtered) {
  //   //   if (item.confirm_YN === "T") {
  //   //     await callSapPostAssembledComponent_auto({
  //   //       plant: plant_cd,
  //   //       sfc: String(data.SFC).slice(0, 128),
  //   //       operationActivity: operation,
  //   //       quantity: item.qty,
  //   //       resource: String(data.WORK_CENTER).slice(0, 36),
  //   //       hasTimeBased: true,
  //   //       hasNonTimeBased: true
  //   //     });
  //   //   }
  //   // }

  //   // ✅ SAP POST 호출: I 상태인 카드만
  //   // 3. 📦 SAP Routing API 통해 components 가져오기
  //   let components: { component: string; componentVersion: string; quantity: number }[] = [];

  //   try {
  //     const routingResp = await axios.get("http://localhost:4000/api/sap/routing-detail", {
  //       params: {
  //         plant: plant_cd,
  //         routing: routingCode,
  //         type: routingType,
  //       }
  //     });

  //     // ✅ SAP 응답은 배열임 → 첫 번째 라우팅 추출
  //     const routingData = Array.isArray(routingResp.data) ? routingResp.data[0] : routingResp.data;

  //     console.log("[RAW_ROUTING_DATA]", JSON.stringify(routingData, null, 2));

  //     const routingSteps = routingData?.routingSteps;

  //     if (!Array.isArray(routingSteps)) {
  //       console.warn("❗ routingSteps 데이터가 없습니다.");
  //       return showToast("SAP Routing 단계 정보가 없습니다.");
  //     }

  //     // ✅ components 추출
  //     components = routingSteps
  //       .flatMap((step) => step.routingStepComponentList || [])
  //       .map((item): { component: string; componentVersion: string; quantity: number } | null => {
  //         const mat = item?.bomComponent?.material;
  //         const qty = item?.quantity;
  //         if (!mat || qty == null) return null;
  //         return {
  //           component: mat.material,
  //           componentVersion: mat.version,
  //           quantity: qty
  //         };
  //       })
  //       .filter((x): x is { component: string; componentVersion: string; quantity: number } => x !== null);

  //     console.log("🧩 추출된 components:", components);

  //   } catch (err) {
  //     console.error("❌ Routing Detail 조회 실패", err);
  //     return showToast("Routing 상세 정보 로딩 실패");
  //   }

  //   // 4. 🔁 SAP Assemble 호출 (I 상태)
  //   for (const item of filtered) {
  //     if (item.confirm_YN === "T") {
  //       for (const comp of components) {
  //         await callSapPostAssembledComponent({
  //           plant: plant_cd,
  //           sfc: rawSfc,
  //           operationActivity: operation,
  //           component: comp.component,
  //           componentVersion: comp.componentVersion,
  //           quantity: comp.quantity,
  //           resource: String(data.WORK_CENTER).slice(0, 36)
  //         });
  //       }
  //     }
  //   }

  //   // ✅ 선택한 카드가 P일때 complete SAP POST 호출
  //   for (const item of filtered) {
  //   if (item.confirm_YN === "P") {
  //     console.log("✅ complete 진입");
  //     const sapPayload = {
  //       plant: plant_cd.slice(0, 6),
  //       operation,
  //       resource: String(data.WORK_CENTER ?? "").slice(0, 36),
  //       quantity: item.qty,
  //       sfcs: [String(data.SFC ?? "").slice(0, 128)],
  //       processLot: ""
  //     };
  //     await callSapEndApi(sapPayload);
  //     }
  //   }

  //   const payload = filtered.map(item => ({

  //     PLANT_CD: plant_cd,  // ✅ 콤보에서 넘긴 값 사용
  //     WORK_CENTER: data.WORK_CENTER,
  //     ORDER_NUMBER: data.ORDER_NUMBER,
  //     SEQ: item.seq.toString(),
  //     MATERIAL_CODE: data.MATERIAL_CODE,
  //     SIZE_CD: data.SIZE_CD,
  //     ITPO_TYPE: item.confirm_YN,
  //     SFC: String(data.SFC).slice(0, 128)
  //   }));

  //   handlePostConfirm(payload);
  //   onConfirm?.(payload);
  //   onClose();
  // };

  const handleSaveAll = async () => {
    // 현재 선택된 SFC만 저장 대상
    const currentSfc = minValidSfc;

    // 1. 상태 전환 로직 적용 (단순 상태값만 변경)
    const updatedData = cardData.map(item => {
      if (item.mappedSFC === currentSfc) {
        if (item.confirm_YN === "N") {
          return { ...item, confirm_YN: "T" }; // 하얀색 → 파란색
        } else if (item.confirm_YN === "T") {
          return { ...item, confirm_YN: "P" }; // 파란색 → 초록색 후보
        }
      }
      return item;
    });
    setCardData(updatedData); // 상태 갱신


  // 🔎 현재 SFC에 해당하고 T 또는 P 상태인 카드만 추출
  const filtered = updatedData.filter(x =>
    x.mappedSFC === currentSfc &&
    ["T", "P"].includes(x.confirm_YN) &&
    x.flag !== "FINISH"
    
  );
console.log("🔍 필터링된 카드:", filtered);
  if (filtered.length === 0) {
    return showToast("확정 가능한 카드가 없습니다.");
  }

  // // ✅ SAP API 호출을 위한 필수 정보
  // // 🔍 SAP SFC Detail 조회 → operation 추출
  // const sfcDetail = await fetchSfcDetail(plant_cd, String(currentSfc));
  // const operation =
  //   sfcDetail?.status?.stepId ||
  //   sfcDetail?.steps?.[0]?.operation?.operation;

  // if (!operation) {
  //   console.error("❌ operation 정보를 가져올 수 없습니다.");
  //   return showToast("SFC의 operation 정보를 확인할 수 없습니다.");
  // }
  // const sfcCards = cardData.filter(x => x.mappedSFC === currentSfc);
  // const allInputMissing = sfcCards.every(x => !x.input_dt);

  // // ✅ (1) SAP START 호출 (모든 카드에 input_dt가 없을 때만)
  // if (allInputMissing) {
  //   const sapPayload = {
  //     plant: plant_cd.slice(0, 6),
  //     operation,
  //     resource: String(data.WORK_CENTER ?? "").slice(0, 36),
  //     sfcs: [String(currentSfc)],
  //     processLot: ""
  //   };
  //   await callSapStartApi(sapPayload);
  // }

  // // ✅ (2) SAP ASSEMBLE 호출 (I 상태만)
  // for (const item of filtered) {
  //   if (item.confirm_YN === "I") {
  //     await callSapPostAssembledComponent_auto({
  //       plant: plant_cd,
  //       sfc: String(currentSfc),
  //       operationActivity: operation,
  //       quantity: item.qty,
  //       resource: String(data.WORK_CENTER).slice(0, 36),
  //       hasTimeBased: true,
  //       hasNonTimeBased: true
  //     });
  //   }
  // }

  // // ✅ (3) SAP COMPLETE 호출 (P 상태만)
  // for (const item of filtered) {
  //   if (item.confirm_YN === "P") {
  //     const completePayload = {
  //       plant: plant_cd.slice(0, 6),
  //       operation,
  //       resource: String(data.WORK_CENTER ?? "").slice(0, 36),
  //       quantity: item.qty,
  //       sfcs: [String(currentSfc)],
  //       processLot: ""
  //     };
  //     await callSapEndApi(completePayload);
  //   }
  // }
  // // ✅ SAP API 호출을 위한 필수 정보


  // ✅ (4) DB 저장
  const payload = filtered.map(item => ({
    PLANT_CD: plant_cd,
    WORK_CENTER: data.WORK_CENTER,
    ORDER_NUMBER: data.ORDER_NUMBER,
    SEQ: item.seq.toString(),
    MATERIAL_CODE: data.MATERIAL_CODE,
    SIZE_CD: data.SIZE_CD,
    ITPO_TYPE: item.confirm_YN,
    SFC: currentSfc
  }));

  try {
    await axios.post("http://localhost:4000/api/mssql/escan-detail-save", { list: payload });

    setCardData(prev =>
      prev.map(item =>
        payload.some(p => p.SEQ === item.seq.toString())
          ? { ...item, confirm_YN: "Y" }
          : item
      )
    );

    showToast("저장되었습니다.");
    onConfirm?.(payload);
    onClose();
  } catch (err) {
    showToast("❌ 저장 중 오류 발생");
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

  const backgroundColor = getColorByStatus(data.confirm_YN);
  const clickable = isCardClickable(data);  // ✅ mappedSFC === data.SFC 기준

    return (
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", width: "100%", height: "80px", pointerEvents: clickable ? "auto" : "none"}}>
        <div style={{
          flex: 1,
          borderRadius: "10px",
          border: "none",
          backgroundColor,
          color: "black",
          fontWeight: "bold",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "6px",
          boxShadow: "inset 0 0 4px rgba(0,0,0,0.2)",
        }}>
          <div>
            PC SEQ : {data.seq} <br />
            Q'ty : {isNaN(data.qty) ? "-" : data.qty}
          </div>
          <div>
            Input : {data.input_dt || "-"} <br />
            Prod : {data.prod_dt || "-"}
          </div>
        </div>
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
            pointerEvents: clickable ? "auto" : "none"  // ✅ 이거 추가!!!
          }}
          onClick={() => {
            if (!clickable) return;
            console.log("✅ 클릭 허용됨", data.seq);
            console.log("🔹 confirm_YN:", data.confirm_YN);
            handleDetailOk(data);
          }}
        />
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
                    "Date": data?.WORK_DATE ?? "-",
                    "Line": data?.WORK_CENTER ?? "-",
                    "Model": data?.MODEL_CD ?? "-",
                    "Style": data?.STYLE_CD ?? "-",
                    "Material": data?.MATERIAL_CODE ?? "-",
                    "Description": data?.MATERIAL_DESCRIPTION ?? "-",
                    "SFC": data?.SFC ?? "-",
                    "Qty": data?.QUANTITY ?? "-",
                    "Size": data?.SIZE_CD ?? "-",
                    "Order No.": data?.ORDER_NUMBER ?? "-",
                    "Storage": data?.PUTAWAYSTORAGELOCATION ?? "-",
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
                Do you want to <br /> confirm data?
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
                <Button
                  icon={saveIcon}
                  className="detail-button"
                  onClick={handleSaveDetail}
                  disabled={!canSaveDetail} // 체크(색 변경)된 카드가 없으면 비활성화
                >
                  Save<br />Detail
                </Button>
                <Button
                  icon={saveIcon}
                  className="detail-button"
                  onClick={handleSaveAll}
                  disabled={!(canSaveAll)} // 하나라도 업데이트 가능 상태가 없으면 비활성화
                >
                  Save<br />All
                </Button>
                <Button icon="decline" className="detail-button detail-button-danger" onClick={onClose}>
                  Close
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

export default E_ScanOutgoing_Detail;
