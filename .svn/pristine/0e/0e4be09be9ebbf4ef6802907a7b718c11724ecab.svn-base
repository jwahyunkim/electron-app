import axios from 'axios';
import * as cfg from '../common/config.js'; // 상대 경로 확인 (shared 기준)

export const SAP_CONFIG = {
  tokenUrl: `https://dmc-for-dev-gzkiwpb4.authentication.us20.hana.ondemand.com/oauth/token`,    
  clientId: `sb-e073cc8c-e3bd-4fb7-b152-9e141fb25a5a!b31643|dmc-services!b257`,
  clientSecret: `b347225a-95fa-4098-829e-0be2508a0120$014oiS3md3mGHXYf2O0gtIINl-cFc-0t9ZAf9nAuV4E=`,

  apiLogisticsUrl: `https://api.us20.dmc.cloud.sap/logistics/v1/readLogisticsOrder?keyType=REFERENCE_NUMBER&id=C20047&plant=${cfg.PLANT}`, 
  workCenterApiUrl:  `https://api.us20.dmc.cloud.sap/workcenter/v2/workcenters?plant=${cfg.PLANT}`,
  resourceApiUrl:    `https://api.us20.dmc.cloud.sap/resource/v2/resources?plant=${cfg.PLANT}`,
  sfcApiUrl:         `https://api.us20.dmc.cloud.sap/sfc/v1/sfcdetail?sfc=C20047&plant=${cfg.PLANT}`,
  materialApiUrl:    `https://api.us20.dmc.cloud.sap/material/v2/materials?plant=${cfg.PLANT}`,
  sfcsApiUrl:        `https://api.us20.dmc.cloud.sap/sfc/v1/worklist/sfcs?plant=${cfg.PLANT}&allSfcSteps=false`,
  packingUnitUrl:    `https://api.us20.dmc.cloud.sap/packingUnits/v1/packingUnits?plant=${cfg.PLANT}&number=C200PU29`,

  acceptUrl:   'https://api.us20.dmc.cloud.sap/logistics/v1/execution/acceptLogisticsOrder',
  confirmUrl:  'https://api.us20.dmc.cloud.sap/logistics/v1/execution/confirmLogisticsOrder',
  pickUrl:     'https://api.us20.dmc.cloud.sap/logistics/v1/execution/pickLogisticsOrder',

  SFC_START_API : 'https://api.us20.dmc.cloud.sap/sfc/v1/sfcs/start',
  SFC_CONFIRM_API : 'https://api.us20.dmc.cloud.sap/sfc/v1/sfcs/complete',
  POST_ASSEMBLED_COMPONENT_API: 'https://api.us20.dmc.cloud.sap/assembly/v1/assembledComponents',
  POST_ASSEMBLED_COMPONENT_AUTO_API: 'https://api.us20.dmc.cloud.sap/assembly/v1/autoAssemble',
  SFC_DETAIL_API: 'https://api.us20.dmc.cloud.sap/sfc/v1/sfcdetail',
  ROUTING_API: 'https://api.us20.dmc.cloud.sap/routing/v1/routings',        
  BOM_API: 'https://api.us20.dmc.cloud.sap/bom/v1/boms', 
  ASSEMBLE_COMPLETED: 'https://api.us20.dmc.cloud.sap/assembly/v1/assembledComponents',
  INVENTORIES_API: 'https://api.us20.dmc.cloud.sap/inventory/v1/inventories',
  GOODS_ISSUE_I_API: 'https://api.us20.dmc.cloud.sap/processorder/v1/goodsissue',
  GOODS_ISSUE_Q_API: 'https://api.us20.dmc.cloud.sap/inventory/v1/inventory/goodsIssues',
  GOODSRECEIPTS_API_Q: 'https://api.us20.dmc.cloud.sap/inventory/v1/inventory/goodsReceipts',
  GOODSRECEIPTS_API_I: 'https://api.us20.dmc.cloud.sap/inventory/v1/inventory/erpGoodsReceipts',
  UNIT_CODE_API: 'https://api.us20.dmc.cloud.sap/uom/v2/uoms',
  POST_QTY_CONFIRM: 'https://api.us20.dmc.cloud.sap/quantityConfirmation/v1/confirm',
  POST_QTY_FINAL_CONFIRM: 'https://api.us20.dmc.cloud.sap/quantityConfirmation/v1/reportOperationActivityFinalConfirmation',
  POST_AUTOCONFIRM: 'https://api.us20.dmc.cloud.sap/activityConfirmation/v1/autoconfirm',
  POST_ACTIVITY_CONFIRM: 'https://api.us20.dmc.cloud.sap/activityConfirmation/v1/confirm',
  GET_POSTINGS: 'https://api.us20.dmc.cloud.sap/activityConfirmation/v1/postings/details',
  CANCEL_GOODSRECEIPTS: 'https://api.us20.dmc.cloud.sap/inventory/v1/inventory/goodsReceipts/cancel',
  CANCEL_GOODSISSUE: 'https://api.us20.dmc.cloud.sap/processorder/v1/goodsissue/cancellations',
  GET_ORDER_LIST: 'https://api.us20.dmc.cloud.sap/order/v1/orders/list',
  POST_ORDER_RELEASE: 'https://api.us20.dmc.cloud.sap/order/v2/orders/release',
  PUT_ALTER_RESOURCE: 'https://api.us20.dmc.cloud.sap/sfc/v1/alternateResource',
  GET_STANDARDVALUE:  'https://api.us20.dmc.cloud.sap/standardValue/v1/details'
};

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export async function refreshToken(): Promise<void> {
  try {
    const rsp = await axios.post<{ access_token: string }>(
      SAP_CONFIG.tokenUrl,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: SAP_CONFIG.clientId,
          password: SAP_CONFIG.clientSecret
        }
      }
    );
    accessToken = rsp.data.access_token;
    console.log(`[TOKEN] refreshed @ ${new Date().toISOString()}`);
  } catch (err: any) {
    accessToken = null;
    console.error('[TOKEN] refresh failed:', err.message);
  }
}

