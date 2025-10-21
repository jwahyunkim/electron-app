import express from "express";
import axios from "axios";
import { SAP_CONFIG, getAccessToken, refreshToken, ensureToken } from '../sap.js';

const router = express.Router();

router.post("/sap-start", async (req, res) => {
  const { plant, operation, resource, sfcs,  processLot } = req.body;

  // 🔒 파라미터 검증
  if (!Array.isArray(sfcs) || sfcs.length === 0)
    return res.status(400).json({ error: "sfcs 배열이 필요합니다." });
  if (!operation || !resource)
    return res.status(400).json({ error: "operation / resource 파라미터 누락" });

  try {
    // 🔑 토큰 확인 및 리프레시
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token)
      return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    // 📦 실제 전송 Payload (조건부 processLot 제거)
    const payload = {
      plant,
      operation,
      resource,
      sfcs,
     
      ...(processLot ? { processLot } : {}),
    };

    console.log("📡 [SAP START 요청]:", payload);

    // 📤 SAP 호출
    const sapResp = await axios.post(SAP_CONFIG.SFC_START_API, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = sapResp.data;
    console.log("✅ [SAP 응답]:", data);

    // 🔍 응답 유효성 검사
    if (!Array.isArray(data.sfcs) || data.sfcs.length === 0) {
      return res.status(204).json({ description: "SAP 응답에 처리할 SFC 없음" });
    }

    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP START 호출 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL",
      error: "SAP START 호출 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});

// //WORK_CENTER(pod)에서 사용 
router.post("/sap-complete", async (req, res) => {
  const { plant, operation, resource, sfcs, quantity, processLot } = req.body;

  // 🔒 파라미터 검증
  if (!Array.isArray(sfcs) || sfcs.length === 0)
    return res.status(400).json({ error: "complete sfcs 배열이 필요합니다." });
  if (!operation || !resource)
    return res.status(400).json({ error: " complete operation / resource 파라미터 누락" });

  try {
    // 🔑 토큰 확인 및 리프레시
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token)
      return res.status(500).json({ error: "complete SAP 토큰 발급 실패" });

    // 📦 실제 전송 Payload (조건부 processLot 제거)
    const payload = {
      plant,
      operation,
      resource,
      sfcs,
      quantity,
      ...(processLot ? { processLot } : {}),
    };

    console.log("📡 [SAP complete 요청]:", payload);

    // 📤 SAP 호출
    const sapResp = await axios.post(SAP_CONFIG.SFC_CONFIRM_API, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = sapResp.data;
    console.log("✅ [complete SAP 응답]:", data);

    // 🔍 응답 유효성 검사
    if (!Array.isArray(data.sfcs) || data.sfcs.length === 0) {
      return res.status(204).json({ description: "complete SAP 응답에 처리할 SFC 없음" });
    }

    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [complete SAP START 호출 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "complete SAP_CALL",
      error: "complete AP START 호출 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});

router.post("/sap-complete", async (req, res) => {
  const { plant, operation, resource, sfcs, processLot } = req.body;

  // 🔒 파라미터 검증
  if (!Array.isArray(sfcs) || sfcs.length === 0)
    return res.status(400).json({ error: "complete sfcs 배열이 필요합니다." });
  if (!operation || !resource)
    return res.status(400).json({ error: " complete operation / resource 파라미터 누락" });

  try {
    // 🔑 토큰 확인 및 리프레시
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token)
      return res.status(500).json({ error: "complete SAP 토큰 발급 실패" });

    // 📦 실제 전송 Payload (조건부 processLot 제거)
    const payload = {
      plant,
      operation,
      resource,
      sfcs,
      ...(processLot ? { processLot } : {}),
    };

    console.log("📡 [SAP complete 요청]:", payload);

    // 📤 SAP 호출
    const sapResp = await axios.post(SAP_CONFIG.SFC_CONFIRM_API, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = sapResp.data;
    console.log("✅ [complete SAP 응답]:", data);

    // 🔍 응답 유효성 검사
    if (!Array.isArray(data.sfcs) || data.sfcs.length === 0) {
      return res.status(204).json({ description: "complete SAP 응답에 처리할 SFC 없음" });
    }

    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [complete SAP 호출 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "complete SAP_CALL",
      error: "complete AP START 호출 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});

router.post("/sap-post-assembled", async (req, res) => {
  const {
    plant,
    sfc,
    operationActivity,
    component,
    componentVersion,
    quantity,
    resource,
    sequence
  } = req.body;

  if (!plant || !sfc || !operationActivity || !component || !componentVersion || !quantity || !resource) {
    return res.status(400).json({ error: "필수 파라미터 누락" });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    const payload = {
      plant,
      sfc,
      operationActivity,
      component,
      componentVersion,
      quantity,
      resource,
      sequence
    };

    console.log("📡 [SAP AssembledComponents POST] Payload:", payload);

    const sapResponse = await axios.post(
      SAP_CONFIG.POST_ASSEMBLED_COMPONENT_API,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json(sapResponse.data);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP 호출 실패:", msg);
    return res.status(502).json({
      error: "SAP assembledComponents 호출 실패",
      message: msg
    });
  }
});

//// ✅ Express Router에서 SAP Goods Issue POST 처리
router.post("/sap-post-goodsissue", async (req, res) => {
  const {
    plant,
    order,
    phase,
    workCenter,
    component,
    quantity,
    unitOfMeasure,
    postedBy,
    postingDateTime,
    bom,
    inventoryId
  } = req.body;

  // ✅ 필수 파라미터 유효성 체크
  if (
    !plant || !order || !phase || !workCenter ||
    !component?.material?.material || !component?.material?.version ||
    quantity == null || // 0도 허용
    !unitOfMeasure || !postedBy || !postingDateTime ||
    !bom?.bom || !bom?.version || !inventoryId
  ) {
    return res.status(400).json({ error: "필수 파라미터 누락 또는 잘못된 값" });
  }

  // ✅ payload 선언을 try 밖으로 이동
  const payload = {
    plant,
    order,
    phase,
    workCenter,
    inventoryId,
    component,
    bom,
    isBomComponent: true,
    quantity,
    unitOfMeasure,
    postedBy,
    postingDateTime
  };

  try {
    // ✅ SAP 토큰 처리
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    console.log("📡 [SAP Goods Issue POST] Payload:", payload);

    // ✅ SAP Goods Issue API 호출
    const sapResponse = await axios.post(
      SAP_CONFIG.GOODS_ISSUE_I_API,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json(sapResponse.data);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP goodsissue 호출 실패:", {
      url: SAP_CONFIG.GOODS_ISSUE_I_API,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      payload
    });

    return res.status(502).json({
      error: "SAP goodsissue 호출 실패",
      message: msg
    });
  }
});

// ✅ SAP Goods Receipt Cancel POST 처리
router.post("/sap-cancel-goodsreceipt", async (req, res) => {
  const { plant, transactionIds } = req.body;

  // ✅ 파라미터 유효성 검사
  if (!plant || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return res.status(400).json({ error: "필수 파라미터 누락 또는 잘못된 값" });
  }

  if (transactionIds.length > 10) {
    return res.status(400).json({ error: "최대 10개의 transactionIds만 허용됩니다." });
  }

  // ✅ Payload 준비
  const payload = {
    plant,
    transactionIds
  };

  try {
    // ✅ SAP 인증 토큰 확인 및 갱신
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    console.log("📡 [SAP Cancel GoodsReceipt] Payload:", payload);

    // ✅ SAP API 호출
    const sapResponse = await axios.post(
      SAP_CONFIG.CANCEL_GOODSRECEIPTS,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json(sapResponse.data);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP Cancel GoodsReceipt 실패:", {
      url: SAP_CONFIG.CANCEL_GOODSRECEIPTS,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      payload
    });

    return res.status(502).json({
      error: "SAP Cancel GoodsReceipt 호출 실패",
      message: msg
    });
  }
});



router.post("/sap-post-assembled_auto", async (req, res) => {
  const {
    plant,
    sfcs,
    operationActivity,
    quantity,
    resource,
    hasTimeBased,
    hasNonTimeBased
  } = req.body;

  // 필수값 검사
  if (
    !plant ||
    !Array.isArray(sfcs) ||
    sfcs.length === 0 ||
    !operationActivity ||
    !quantity ||
    !resource
  ) {
    return res.status(400).json({ error: "필수 파라미터 누락 또는 형식 오류" });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    const payload = {
      plant,
      operationActivity,
      quantity,
      resource,
      sfcs,
      hasTimeBased: hasTimeBased ?? true,         // 기본값 포함
      hasNonTimeBased: hasNonTimeBased ?? true    // 기본값 포함
    };

    console.log("📡 [SAP assembled_auto POST] Payload:", payload);

    const sapResponse = await axios.post(
      SAP_CONFIG.POST_ASSEMBLED_COMPONENT_AUTO_API,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json(sapResponse.data);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP 호출 실패:", msg);
    return res.status(502).json({
      error: "SAP assembled_auto 호출 실패",
      message: msg
    });
  }
});

// 📦 ERP Goods Receipt API 호출 라우터
router.post("/sap-goods-receipt", async (req, res) => {
  const { plant, order, postedBy, lineItems } = req.body;

  // 필수값 검사
  if (!plant || !order || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: "필수 파라미터 누락 (plant, order, lineItems)" });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    // 📤 SAP 전송용 Payload 구성
    const payload = {
      plant,
      order,
      // postedBy: postedBy || "system", // 선택사항 기본값
      lineItems: lineItems.map(item => ({
        material: item.material,
        materialVersion: item.materialVersion || undefined,
        postingDate: item.postingDate,
        postingDateTime: item.postingDateTime || undefined,
        quantity: {
          unitOfMeasure: {
            commercialUnitOfMeasure: item.quantity.unitOfMeasure?.commercialUnitOfMeasure || "",
            internalUnitOfMeasure: item.quantity.unitOfMeasure?.internalUnitOfMeasure || "",
            isoUnitOfMeasure: item.quantity.unitOfMeasure?.isoUnitOfMeasure || ""
          },
          value: item.quantity.value
        },
        sfc: item.sfc,
        storageLocation: item.storageLocation
      }))
    };

    console.log("📡 [SAP GoodsReceipt POST] Payload:", JSON.stringify(payload, null, 2));

    const sapResponse = await axios.post(
      SAP_CONFIG.GOODSRECEIPTS_API_I,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json(sapResponse.data);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP GoodsReceipt 호출 실패:", msg);
    return res.status(502).json({
      error: "SAP goodsReceipts 호출 실패",
      message: msg
    });
  }
});

// // 📦 SAP Quantity Confirmation API 호출 라우터
// router.post("/sap-post-qty-confirm", async (req, res) => {
//   const {
//     plant,
//     shopOrder,
//     sfc,
//     operationActivity,
//     workCenter,
//     yieldQuantity,
//     yieldQuantityUnit,
//     yieldQuantityIsoUnit
//   } = req.body;

//   // ✅ 필수값 확인
//   if (!plant || !shopOrder || !sfc || !operationActivity || !workCenter || !yieldQuantity || !yieldQuantityUnit || !yieldQuantityIsoUnit) {
//     return res.status(400).json({
//       error: "필수 파라미터 누락",
//       missing: {
//         plant: !!plant,
//         shopOrder: !!shopOrder,
//         sfc: !!sfc,
//         operationActivity: !!operationActivity,
//         workCenter: !!workCenter,
//         yieldQuantity: !!yieldQuantity,
//         yieldQuantityUnit: !!yieldQuantityUnit,
//         yieldQuantityIsoUnit: !!yieldQuantityIsoUnit
//       }
//     });
//   }

//   try {
//     // 🔐 토큰 확인 및 갱신
//     if (!getAccessToken()) await refreshToken();
//     const token = getAccessToken();
//     if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

//     // 📤 전송 Payload 구성
//     const payload = {
//       plant,
//       shopOrder,
//       sfc,
//       operationActivity,
//       workCenter,
//       yieldQuantity,
//       yieldQuantityUnit,
//       yieldQuantityIsoUnit
//     };

//     console.log("📡 [SAP QuantityConfirm POST] Payload:", payload);

//     const sapResponse = await axios.post(
//       SAP_CONFIG.POST_QTY_CONFIRM,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json"
//         }
//       }
//     );

//     return res.status(200).json(sapResponse.data);
//   } catch (err) {
//     const msg = err.response?.data?.error?.message || err.message;
//     console.error("❌ SAP QuantityConfirm 호출 실패:", msg);
//     return res.status(502).json({
//       error: "SAP QuantityConfirm 호출 실패",
//       message: msg
//     });
//   }
// });
// 📦 SAP Quantity Confirmation API 호출 라우터
router.post("/sap-post-qty-confirm", async (req, res) => {
  const {
    plant,
    shopOrder,
    sfc,
    operationActivity,
    workCenter,
    yieldQuantity,
    yieldQuantityUnit,
    yieldQuantityIsoUnit,
    isFinalConfirmation = false   // ✅ 기본값 처리
  } = req.body;

  // ✅ 필수값 확인
  if (
    !plant || !shopOrder || !sfc || !operationActivity ||
    !workCenter || !yieldQuantity || !yieldQuantityUnit || !yieldQuantityIsoUnit
  ) {
    return res.status(400).json({
      error: "필수 파라미터 누락",
      missing: {
        plant: !!plant,
        shopOrder: !!shopOrder,
        sfc: !!sfc,
        operationActivity: !!operationActivity,
        workCenter: !!workCenter,
        yieldQuantity: !!yieldQuantity,
        yieldQuantityUnit: !!yieldQuantityUnit,
        yieldQuantityIsoUnit: !!yieldQuantityIsoUnit
      }
    });
  }

  try {
    // 🔐 SAP 토큰 확인 및 갱신
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    // 📤 SAP 전송용 Payload 구성
    const payload = {
      plant,
      shopOrder,
      sfc,
      operationActivity,
      workCenter,
      yieldQuantity,
      yieldQuantityUnit,
      yieldQuantityIsoUnit,
      finalConfirmation: isFinalConfirmation
    };

    console.log("📡 [SAP QuantityConfirm POST] Payload:", payload);

    const sapResponse = await axios.post(
      SAP_CONFIG.POST_QTY_CONFIRM,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ [SAP 응답] QuantityConfirm 완료:", sapResponse.data);

    return res.status(200).json({
      status: "success",
      data: sapResponse.data
    });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP QuantityConfirm 호출 실패:", msg);
    return res.status(502).json({
      error: "SAP QuantityConfirm 호출 실패",
      message: msg
    });
  }
});

// 📦 SAP Auto Activity Confirmation API 호출 라우터
router.post("/sap-post-autoconfirm", async (req, res) => {
  const {
    plant,
    shopOrder,
    sfc,
    operationActivity,
    operationActivityVersion,
    stepId,
    workCenter,
    resource,
    routingId,
    finalConfirmation = false,
    postConfirmationToErp = false,
    postedBy,
    postingDateTime
  } = req.body;

  // ✅ 필수값 체크
  if (
    !plant || !shopOrder || !sfc || !operationActivity || !operationActivityVersion ||
    !stepId || !workCenter || !resource || !routingId || !postedBy || !postingDateTime
  ) {
    return res.status(400).json({
      error: "필수 파라미터 누락",
      missing: {
        plant: !!plant,
        shopOrder: !!shopOrder,
        sfc: !!sfc,
        operationActivity: !!operationActivity,
        operationActivityVersion: !!operationActivityVersion,
        stepId: !!stepId,
        workCenter: !!workCenter,
        resource: !!resource,
        routingId: !!routingId,
        postedBy: !!postedBy,
        postingDateTime: !!postingDateTime
      }
    });
  }

  try {
    // 🔐 SAP 토큰 확인 및 갱신
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    // 📤 SAP API 전송용 Payload 구성
    const payload = {
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
    };

    console.log("📡 [SAP AutoActivityConfirm POST] Payload:", payload);

    const sapResponse = await axios.post(
      SAP_CONFIG.POST_AUTOCONFIRM, // 'https://api.us20.dmc.cloud.sap/activityConfirmation/v1/autoconfirm'
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ [SAP 응답] AutoActivityConfirm 완료:", sapResponse.data);

    return res.status(200).json({
      status: "success",
      data: sapResponse.data
    });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP AutoActivityConfirm 호출 실패:", msg);
    return res.status(502).json({
      error: "SAP AutoActivityConfirm 호출 실패",
      message: msg
    });
  }
});

router.post("/sap-post-activity-confirm", async (req, res) => {
  const {
    plant,
    shopOrder,
    sfc,
    operationActivity,
    stepId,
    workCenter,
    activities = []
  } = req.body;

  if (
    !plant || !shopOrder || !operationActivity ||
    !stepId || !workCenter || !activities.length
  ) {
    return res.status(400).json({ error: "필수 파라미터 누락" });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    const payload = {
      plant,
      shopOrder,
      sfc,
      operationActivity,
      stepId,
      workCenter,
      finalConfirmation: true, // ⬅ 고정
      allowPostingsAfterOperationActivityComplete: true, // ⬅ 고정
      activities
    };

    console.log("📡 [SAP ActivityConfirm POST] Payload:", payload);

    const response = await axios.post(
      SAP_CONFIG.POST_ACTIVITY_CONFIRM,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ SAP 응답:", response.data);
    return res.status(200).json({ status: "success", data: response.data });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP ActivityConfirm 실패:", msg);
    return res.status(502).json({
      error: "SAP ActivityConfirm 호출 실패",
      message: msg
    });
  }
});




// 📦 SAP Final Quantity Confirmation API 호출 라우터
router.post("/sap-post-final-confirm", async (req, res) => {
  const { plant, shopOrder, sfc, operationActivity } = req.body;

  // ✅ 필수값 체크
  if (!plant || !shopOrder || !sfc || !operationActivity) {
    return res.status(400).json({
      error: "필수 파라미터 누락",
      missing: {
        plant: !!plant,
        shopOrder: !!shopOrder,
        sfc: !!sfc,
        operationActivity: !!operationActivity
      }
    });
  }

  try {
    // 🔐 SAP 토큰 확인 및 갱신
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    // 📤 전송 Payload 구성
    const payload = {
      plant,
      shopOrder,
      sfc,
      operationActivity
    };

    console.log("📡 [SAP Final QuantityConfirm POST] Payload:", payload);

    const sapResponse = await axios.post(
      SAP_CONFIG.POST_QTY_FINAL_CONFIRM, // 'https://api.us20.dmc.cloud.sap/quantityConfirmation/v1/reportOperationActivityFinalConfirmation'
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json(sapResponse.data);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP Final QuantityConfirm 호출 실패:", msg);
    return res.status(502).json({
      error: "SAP Final QuantityConfirm 호출 실패",
      message: msg
    });
  }
});


/**
 * ✅ SAP SFC 상세 정보 조회
 * URL 예시: /sap/sfc-detail?plant_cd=C200&sfc=C20081
 */
router.get("/sap/sfc-detail", async (req, res) => {
  const { plant_cd, sfc } = req.query;

  console.log("📡 [SAP] /sap/sfc-detail 호출됨:", { plant_cd, sfc });

  if (!plant_cd || !sfc) {
    return res.status(400).json({ error: "plant_cd 또는 sfc 파라미터 누락" });
  }

  try {
    // ✅ 토큰 확인 및 리프레시
    if (!getAccessToken()) await refreshToken();

    const token = getAccessToken();
    console.log("🧪 SAP 토큰:", token?.slice(0, 50)); // 앞 50글자만 출력 (보안)

    if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    const url = `${SAP_CONFIG.SFC_DETAIL_API}?plant=${plant_cd}&sfc=${sfc}`;
    console.log("🌐 [SAP 요청 URL]:", url);

    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = sapResp.data;
    console.log("✅ [SAP 응답]:", data);

    if (!data || !data.sfc || !data.status) {
      return res.status(204).json({ description: "SAP 응답에 SFC 정보 없음" });
    }

    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP SFC_DETAIL 호출 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL",
      error: "SAP SFC_DETAIL 호출 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});

/**
 * ✅ SAP Routing 상세 정보 조회
 * 예: /sap/routing-detail?plant=C200&routing=1100000006&type=SHOP_ORDER
 */
router.get("/sap/routing-detail", async (req, res) => {
  const { plant, routing, type } = req.query;

  console.log("📡 [SAP] /sap/routing-detail 호출됨:", { plant, routing, type });

  if (!plant || !routing || !type) {
    return res.status(400).json({ error: "plant, routing, type 파라미터 누락" });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    const url = `${SAP_CONFIG.ROUTING_API}?plant=${plant}&routing=${routing}&type=${type}`;
    console.log("🌐 [SAP 요청 URL]:", url);

    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = sapResp.data;

    console.log("✅ [SAP 응답 - Routing]:", data);

    // ✅ 배열인지 확인
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
    }

    const routingInfo = data[0]; // ✅ 첫 번째 라우팅 정보 사용

    if (!routingInfo.routingSteps || routingInfo.routingSteps.length === 0) {
      return res.status(204).json({ description: "routingSteps 없음" });
    }

    return res.status(200).json(routingInfo); // ✅ 프론트에 1개의 Routing 객체만 전달
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP Routing 조회 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_ROUTING",
      error: "SAP Routing 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});

/**
 * ✅ SAP BOM 상세 조회
 * 예: /sap/bom-detail?plant=C200&bom=1100000130-UPFDM8974400F01001-1-1&type=SHOP_ORDER
 */
router.get("/sap/bom-detail", async (req, res) => {
  const { plant, bom, type } = req.query;

  console.log("📡 [SAP] /sap/bom-detail 호출됨:", { plant, bom, type });

  if (!plant || !bom || !type) {
    return res.status(400).json({ error: "plant, bom, type 파라미터 누락" });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    const url = `${SAP_CONFIG.BOM_API}?plant=${plant}&bom=${encodeURIComponent(bom)}&type=${type}`;
    console.log("🌐 [SAP 요청 URL]:", url);

    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = sapResp.data;

    console.log("✅ [SAP 응답 - BOM]:", data);

    // ✅ 유효성 검사
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
    }

    const bomInfo = data[0]; // ✅ 첫 번째 BOM 사용
    if (!bomInfo.components || bomInfo.components.length === 0) {
      return res.status(204).json({ description: "components 없음" });
    }

    return res.status(200).json(bomInfo);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP BOM 조회 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_BOM",
      error: "SAP BOM 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});

/**
 * ✅ SAP 조립 완료된 Components 조회
 * 예: /sap/assembled-components?plant=C200&sfc=C200185&operationActivity=1100000130-0-0010
 */
router.get("/sap/assembled-components", async (req, res) => {
  const { plant, sfc, operationActivity } = req.query;

  console.log("📡 [SAP] /sap/assembled-components 호출됨:", { plant, sfc, operationActivity });

  if (!plant || !sfc || !operationActivity) {
    return res.status(400).json({ error: "plant, sfc, operationActivity 파라미터 누락" });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    const url = `${SAP_CONFIG.ASSEMBLE_COMPLETED}?plant=${plant}&sfc=${sfc}&operationActivity=${operationActivity}`;
    console.log("🌐 [SAP 요청 URL]:", url);

    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = sapResp.data;
    console.log("✅ [SAP 응답 - Assembled Components]:", data);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
    }

    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP Assembled 조회 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_ASSEMBLED",
      error: "SAP Assembled Components 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});

/**
 * ✅ SAP Goods Issue 투입 이력 조회 (정확한 SFC/Order/WorkCenter 기준)
 */
router.get("/sap/goodsissued-components", async (req, res) => {
  const { plant, material, materialVersion, order, sfc, workCenter } = req.query;

  console.log("📡 [SAP] /sap/goodsissued-components 호출됨:", {
    plant, material, materialVersion, order, sfc, workCenter
  });

  // 필수 키 확인
  if (!plant || !material || !materialVersion || !order || !sfc || !workCenter) {
    return res.status(400).json({ error: "필수 파라미터 누락 (plant, material, materialVersion, order, sfc, workCenter)" });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    // 🔗 SAP API URL 구성
    const url = `${SAP_CONFIG.GOODS_ISSUE_Q_API}?plant=${plant}&material=${material}&materialVersion=${materialVersion}&order=${order}&sfc=${sfc}&workCenter=${workCenter}`;
    console.log("🌐 [SAP 요청 URL]:", url);

    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = sapResp.data?.content;
    console.log("✅ [SAP 응답 - Goods Issue 이력]:", data);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
    }

    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP Goods Issue 조회 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_GOODS_ISSUE",
      error: "SAP Goods Issue 내역 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});


// 📁 routes/sap.ts 또는 해당 라우터 파일 내부
router.get("/sap/unit-codes", async (req, res) => {
  console.log("📡 [SAP] /sap/unit-codes 호출됨");

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    // ✅ 쿼리 파라미터 전달
    const unitCode = req.query.unitCode;
    const url = SAP_CONFIG.UNIT_CODE_API;
    const fullUrl = unitCode ? `${url}?unitCode=${encodeURIComponent(unitCode)}` : url;

    console.log("🌐 [SAP 요청 URL - UNIT CODE]:", fullUrl);

    const sapResp = await axios.get(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const unitList = sapResp.data;
    console.log("✅ [SAP 응답 - Unit Codes]:", unitList);

    if (!unitList || (Array.isArray(unitList) && unitList.length === 0)) {
      return res.status(204).json({ message: "unit code 없음" });
    }

    return res.status(200).json(unitList);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP UNIT_CODE 호출 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_UNIT_CODE",
      error: "SAP 단위코드 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});

/**
 * ✅ SAP DMC 인벤토리 조회
 * 예: /sap/inventories?plant=C200&material=UPCDM8974400001&materialVersion=ERP001&stockRetrieveScope=NO_ZERO_STOCK&batchesWithStatus=true&status=UNRESTRICTED&status=RESTRICTED
 */
router.get("/sap/inventories", async (req, res) => {
  const {
    plant,
    material,
    materialVersion,
    stockRetrieveScope,
    batchesWithStatus,
    status,
    storageLocation
  } = req.query;

  console.log("📡 [SAP] /sap/inventories 호출됨:", {
    plant, material, materialVersion, stockRetrieveScope, batchesWithStatus, status, storageLocation
  });

  // ✅ 필수 파라미터 체크
  if (!plant || !material || !materialVersion) {
    return res.status(400).json({
      error: "필수 파라미터 누락 (plant, material, materialVersion)"
    });
  }

  try {
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) {
      return res.status(500).json({ error: "SAP 토큰 발급 실패" });
    }

    // ✅ 기본 URL 구성 (storageLocation 포함)
    let url = `${SAP_CONFIG.INVENTORIES_API}?plant=${plant}&material=${material}&materialVersion=${materialVersion}&stockRetrieveScope=${stockRetrieveScope}&batchesWithStatus=${batchesWithStatus}&storageLocation=${encodeURIComponent(storageLocation)}`;


    // ✅ status 배열 처리
    const statusList = Array.isArray(status) ? status : [status];
    for (const s of statusList) {
      url += `&status=${s}`;
    }

    console.log("🌐 [SAP 요청 URL]:", url);

    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = sapResp.data?.content;
    console.log("✅ [SAP 응답 - Inventories]:", data?.length ?? 0);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
    }

    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP INVENTORY 조회 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_INVENTORIES",
      error: "SAP 재고 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null
    });
  }
});

// ✅ SAP DMC 입고(GoodsReceipt) 이력 조회 API
// 예: /sap/goodsreceipts?plant=C200&order=1100000315 또는 /sap/goodsreceipts?sfc=C200346

router.get("/sap/goodsreceipts", async (req, res) => {
  const { plant, order, sfc, material } = req.query;

  console.log("📡 [SAP] /sap/goodsreceipts 호출됨:", {
    plant,
    order,
    sfc,
    material
  });

  // ✅ 필수 파라미터 체크
  if (!plant || (!order && !sfc)) {
    return res.status(400).json({
      error: "필수 파라미터 누락 (plant는 필수이며, order 또는 sfc 중 하나는 반드시 필요함)"
    });
  }

  try {
    // ✅ SAP 토큰 확인
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) {
      return res.status(500).json({ error: "SAP 토큰 발급 실패" });
    }

    // ✅ SAP 요청 URL 구성
    let url = `${SAP_CONFIG.GOODSRECEIPTS_API_Q}?plant=${plant}`;
    if (order) url += `&order=${encodeURIComponent(order)}`;
    if (sfc) url += `&sfc=${encodeURIComponent(sfc)}`;
    if (material) url += `&material=${encodeURIComponent(material)}`;

    console.log("🌐 [SAP 요청 URL]:", url);

    // ✅ SAP 호출
    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    // ✅ 응답 구조 파싱
    const data = sapResp.data?.content;
    console.log("✅ [SAP 응답 - GoodsReceipt]:", data?.length ?? 0);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
    }

    // ✅ content 배열만 응답
    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP GoodsReceipt 조회 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_GOODSRECEIPTS",
      error: "SAP 입고 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null
    });
  }
});

//standard_value
router.get("/sap/standard-value", async (req, res) => {
  const {
    plant,
    workCenter,
    operationActivity,
    operationActivityVersion,
    object,
    objectType,
    objectVersion
  } = req.query;

  console.log("📡 [SAP] /sap/standard-value 호출됨:", {
    plant,
    workCenter,
    operationActivity,
    operationActivityVersion,
    object,
    objectType,
    objectVersion
  });

  // ✅ 필수 파라미터 검증
  if (
    !plant || !workCenter || !operationActivity || !operationActivityVersion ||
    !object || !objectType || !objectVersion
  ) {
    return res.status(400).json({
      error: "필수 파라미터 누락 (plant, workCenter, operationActivity, operationActivityVersion, object, objectType, objectVersion 모두 필요)"
    });
  }

  try {
    // ✅ SAP 토큰 확인
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) {
      return res.status(500).json({ error: "SAP 토큰 발급 실패" });
    }

    // ✅ SAP 요청 URL 구성
    const baseUrl = SAP_CONFIG.GET_STANDARDVALUE;
    let url = `${baseUrl}?plant=${encodeURIComponent(plant)}`;
    url += `&workCenter=${encodeURIComponent(workCenter)}`;
    url += `&operationActivity=${encodeURIComponent(operationActivity)}`;
    url += `&operationActivityVersion=${encodeURIComponent(operationActivityVersion)}`;
    url += `&object=${encodeURIComponent(object)}`;
    url += `&objectType=${encodeURIComponent(objectType)}`;
    url += `&objectVersion=${encodeURIComponent(objectVersion)}`;

    console.log("🌐 [SAP 요청 URL]:", url);

    // ✅ SAP 호출
    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = sapResp.data;

    // ✅ 응답 검증
    if (
      !data ||
      !Array.isArray(data.standardValueCollectionList) ||
      data.standardValueCollectionList.length === 0
    ) {
      console.warn("⚠️ SAP 응답에 standardValueCollectionList 없음 또는 빈 배열");
      return res.status(204).json({ description: "SAP 응답 없음" });
    }

    console.log("✅ [SAP 응답 - 표준시간 항목 수]:", data.standardValueCollectionList.length);
    console.log("✅ [SAP 응답 - 표준시간 항목 수]:", data.standardValueCollectionList);

    return res.status(200).json(data);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP StandardValue 조회 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_STANDARDVALUE",
      error: "SAP 표준시간(Standard Value) 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null
    });
  }
});

/* ──────────────────────────── 타임존/서버시각 ──────────────────────────── */
/**
 * ✅ Plant 타임존(body: timeZone/etpTimezone) + 서버 UTC 시각(header: date) 동시 조회
 * 예) GET /sap/plant-timezone?plant=C200
 */
router.get("/sap/plant-timezone", async (req, res) => {
  const plant = String(req.query.plant ?? "").trim();
  if (!plant) return res.status(400).json({ error: "plant 파라미터가 필요합니다." });

  try {
    // 토큰은 ensureToken()으로 안전 보장(동시 갱신 방지 포함)
    const token = await ensureToken();
    const url = `${SAP_CONFIG.GET_TIMEZONE}?plant=${encodeURIComponent(plant)}`;

    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    const body = resp.data;
    const first = (Array.isArray(body) ? body[0] : body) ?? {};

    // 키 변형 대응(timeZone/timezone, etpTimezone/etpTimeZone)
    const timeZone = first.timeZone ?? first.timezone ?? null;
    const etpTimezone = first.etpTimezone ?? first.etpTimeZone ?? null;

    // 서버가 보낸 UTC 기준 시각(HTTP Date 헤더)
    const dateHeader = resp.headers?.date ?? null; // 예: "Wed, 01 Oct 2025 22:47:33 GMT"
    const serverNowUtcIso = dateHeader ? new Date(dateHeader).toISOString() : null;
    const serverNowEpochMs = dateHeader ? Date.parse(dateHeader) : null;

    // 플랜트 TZ로 포맷(24시간, ISO 유사 형식; narrow no-break space 제거)
    let serverNowInPlantTz = null;
    if (timeZone && dateHeader) {
      try {
        const d = new Date(dateHeader);
        serverNowInPlantTz = new Intl.DateTimeFormat("sv-SE", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
          .format(d)
          .replace("\u202f", " ");
      } catch {
        /* ignore */
      }
    }

    return res.status(200).json({
      plant,
      apiUrl: url,
      timeZone,
      etpTimezone,
      header: { date: dateHeader, serverNowUtcIso, serverNowEpochMs, serverNowInPlantTz },
      raw: first,
    });
  } catch (e) {
    const apiErr = e?.response?.data?.error;
    console.error("❌ [SAP GET_TIMEZONE 실패]:", apiErr?.message || e.message);
    return res.status(502).json({
      errorStep: "SAP_CALL_GET_TIMEZONE",
      error: "SAP Plant 타임존 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null,
    });
  }
});




///////////////////////////////////////////////////////////Interface에 사용///////////////////////////////////////////////////////////

// ✅ SAP SFC 생성 (주문 릴리스)
router.post("/sap/order-release", async (req, res) => {
  const { plant, order } = req.body;

  console.log("📡 [SAP] /sap/order-release 호출됨:", { plant, order });

  // ✅ 필수 파라미터 검사
  if (!plant || !order) {
    return res.status(400).json({
      error: "필수 파라미터 누락",
      missing: {
        plant: !!plant,
        order: !!order
      }
    });
  }

  try {
    // 🔐 SAP OAuth 토큰 확인 및 갱신
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    // 📤 SAP 호출 Payload 구성 (문서 기준)
    const payload = {
      plant,
      order
    };

    console.log("📦 [SAP 주문 릴리스 요청 Payload]:", payload);

    const sapResponse = await axios.post(
      SAP_CONFIG.POST_ORDER_RELEASE,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ [SAP 응답] 주문 릴리스 성공:", sapResponse.data);

    return res.status(200).json({
      status: "success",
      data: sapResponse.data
    });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP 주문 릴리스 호출 실패:", msg);
    return res.status(502).json({
      error: "SAP 주문 릴리스 호출 실패",
      message: msg
    });
  }
});

// ✅ SAP Alternate Resource 변경 API
router.put("/sap/alternate-resource", async (req, res) => {
  const { plant } = req.query;
  const { operationActivity, resource, sfc, workCenter } = req.body;

  console.log("📡 [SAP] /sap/alternate-resource 호출됨:", { plant, operationActivity, resource, sfc, workCenter });

  // ✅ 필수 파라미터 검증
  if (!plant || !operationActivity || !resource || !sfc || !workCenter) {
    return res.status(400).json({
      error: "필수 파라미터 누락",
      missing: {
        plant: !!plant,
        operationActivity: !!operationActivity,
        resource: !!resource,
        sfc: !!sfc,
        workCenter: !!workCenter
      }
    });
  }

  try {
    // 🔐 SAP OAuth 토큰 확인 및 갱신
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    console.log("🧪 현재 SAP 토큰:", token);
    if (!token) return res.status(500).json({ error: "SAP 토큰 없음" });

    // 📦 SAP 호출 Payload
    const payload = {
      operationActivity,
      resource,
      sfc,
      workCenter
    };

    console.log("📦 [SAP 요청 Payload]:", payload);

    // 🛰️ SAP API 호출
    const response = await axios.put(
      `${SAP_CONFIG.PUT_ALTER_RESOURCE}?plant=${encodeURIComponent(plant)}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ SAP 리소스 변경 완료:", response.data);

    return res.status(200).json({
      status: "success",
      data: response.data
    });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ SAP 리소스 변경 실패:", msg);
    return res.status(502).json({
      error: "SAP 리소스 변경 실패",
      message: msg
    });
  }
});


/** 문자열/배열 쿼리를 안전하게 string 으로 변환 */
const qstr = (v) => (Array.isArray(v) ? String(v[0]) : (v == null ? "" : String(v)));
/** 숫자 limit 안전 파싱 */
const qnum = (v) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : undefined;
};

// ✅ SAP DMC Order List 조회
// 예: /sap/order-list?plant=C200&releaseStatuses=RELEASABLE
//    + 선택: &order=1100000347&limit=1
// ✅ SAP DMC Order List 조회 (완화 검증: plant만 필수)
router.get("/sap/order-list2", async (req, res) => {
  const plant = qstr(req.query.plant);
  const releaseStatuses = qstr(req.query.releaseStatuses);
  const workCenter = qstr(req.query.workCenter);  // 선택
  const order = qstr(req.query.order);            // 선택
  const limit = qnum(req.query.limit);            // 선택

  console.log("📡 [SAP] /sap/order-list2 호출됨:", { plant, releaseStatuses, workCenter, order, limit });

  // ✅ 검증 완화: plant만 필수
  if (!plant) {
    return res.status(400).json({ error: "필수 파라미터 누락 (plant 필수)" });
  }

  try {
    // 🔑 SAP 토큰
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    // 🌐 SAP API URL 구성
    let url = `${SAP_CONFIG.GET_ORDER_LIST}?plant=${encodeURIComponent(plant)}`;
    if (workCenter) url += `&workCenters=${encodeURIComponent(workCenter)}`;
    if (releaseStatuses) url += `&releaseStatuses=${encodeURIComponent(releaseStatuses)}`;

    // ✅ 테스트 모드에서 전달된 단일 주문 필터를 SAP 쿼리에 직접 반영
    //    (환경별 파라미터명이 달라 둘 다 붙임: orderNumbers / order)
    if (order) {
      url += `&orderNumbers=${encodeURIComponent(order)}`;
      url += `&order=${encodeURIComponent(order)}`;
    }

    console.log("🌐 [SAP 요청 URL]:", url);

    // 📤 SAP 호출
    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    let content = Array.isArray(sapResp.data?.content) ? sapResp.data.content : [];
    console.log("✅ [SAP 응답 - Order List]:", content.length);

    // 💡 안전망: 서버 후처리 필터(혹시 SAP가 위 파라미터를 무시하는 환경 대비)
    if (order) content = content.filter((o) => String(o?.order) === order);

    if (typeof limit === "number") content = content.slice(0, limit);

    if (!Array.isArray(content) || content.length === 0) {
      return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
    }

    return res.status(200).json(content);
  } catch (e) {
    const apiErr = e?.response?.data?.error;
    console.error("❌ [SAP Order List 조회 실패]:", apiErr?.message || e?.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_ORDER_LIST",
      error: "SAP 주문 리스트 조회 실패",
      details: apiErr?.message || e?.message,
      code: apiErr?.code || null,
    });
  }
});





// ✅ SAP DMC Order List 조회 API
// 예: /sap/order-list?plant=C200&releaseStatuses=RELEASABLE

router.get("/sap/order-list", async (req, res) => {
  const { plant, releaseStatuses, workCenter } = req.query;

  console.log("📡 [SAP] /sap/order-list 호출됨:", {
    plant,
    releaseStatuses,
    workCenter
  });

  if (!plant || !workCenter) {
    return res.status(400).json({ error: "필수 파라미터 누락 (plant, workCenter)" });
  }

  try {
    // ✅ SAP 토큰 확인 및 리프레시
    if (!getAccessToken()) await refreshToken();
    const token = getAccessToken();
    if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

    // ✅ SAP API URL 구성
    let url = `${SAP_CONFIG.GET_ORDER_LIST}?plant=${encodeURIComponent(plant)}&workCenters=${encodeURIComponent(workCenter)}`;
    if (releaseStatuses) {
      url += `&releaseStatuses=${encodeURIComponent(releaseStatuses)}`;
    }

    console.log("🌐 [SAP 요청 URL]:", url);

    // ✅ SAP API 호출
    const sapResp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const content = sapResp.data?.content ?? [];
    console.log("✅ [SAP 응답 - Order List]:", content.length);

    if (!Array.isArray(content) || content.length === 0) {
      return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
    }

    return res.status(200).json(content);
  } catch (e) {
    const apiErr = e.response?.data?.error;
    console.error("❌ [SAP Order List 조회 실패]:", apiErr?.message || e.message);

    return res.status(502).json({
      errorStep: "SAP_CALL_ORDER_LIST",
      error: "SAP 주문 리스트 조회 실패",
      details: apiErr?.message || e.message,
      code: apiErr?.code || null
    });
  }
});

// ✅ SAP DMC Order List 조회 API
// 예: /sap/order-list?plant=C200&releaseStatuses=RELEASABLE&order=1100000347

// router.get("/sap/order-list", async (req, res) => {
//   const { plant, releaseStatuses, workCenter, order } = req.query;

//   console.log("📡 [SAP] /sap/order-list 호출됨:", {
//     plant,
//     releaseStatuses,
//     workCenter,
//     order
//   });

//   if (!plant || !workCenter) {
//     return res.status(400).json({ error: "필수 파라미터 누락 (plant, workCenter)" });
//   }

//   try {
//     // ✅ SAP 토큰 확인 및 리프레시
//     if (!getAccessToken()) await refreshToken();
//     const token = getAccessToken();
//     if (!token) return res.status(500).json({ error: "SAP 토큰 발급 실패" });

//     // ✅ SAP API URL 구성
//     let url = `${SAP_CONFIG.GET_ORDER_LIST}?plant=${encodeURIComponent(plant)}&workCenters=${encodeURIComponent(workCenter)}`;
//     if (releaseStatuses) {
//       url += `&releaseStatuses=${encodeURIComponent(releaseStatuses)}`;
//     }

//     console.log("🌐 [SAP 요청 URL]:", url);

//     // ✅ SAP API 호출
//     const sapResp = await axios.get(url, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json"
//       }
//     });

//     let content = sapResp.data?.content ?? [];
//     console.log("✅ [SAP 응답 - Order List]:", content.length);

//     // ✅ order 파라미터 필터링 (선택사항)
//     if (order && typeof order === "string") {
//       content = content.filter(o => o.order === order);
//     }

//     if (!Array.isArray(content) || content.length === 0) {
//       return res.status(204).json({ description: "SAP 응답이 비었거나 배열 아님" });
//     }

//     return res.status(200).json(content);
//   } catch (e) {
//     const apiErr = e.response?.data?.error;
//     console.error("❌ [SAP Order List 조회 실패]:", apiErr?.message || e.message);

//     return res.status(502).json({
//       errorStep: "SAP_CALL_ORDER_LIST",
//       error: "SAP 주문 리스트 조회 실패",
//       details: apiErr?.message || e.message,
//       code: apiErr?.code || null
//     });
//   }
// });






export default router;
