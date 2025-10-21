// passcardMapping.ts
import { RESOURCE } from "@common/config";
import { format } from "../utils/dateFmt";

/** 메인 그리드에서 넘어오는 행 */
export type GridRow = {
  ORDER_NUMBER: string;
  NEXT_ORDER_NUMBER?: string;
  STYLE_CD: string;             // 최종 저장용 스타일코드(예: DM8974-400)
  STYLE_NAME?: string;
  SIZE_CD: string;
  RESOURCE_CD: string;
  NEXT_RESOURCE_CD?: string;
  PCARD_QTY: number;
  PCARD_SEQ: number;
  MATERIAL_CODE?: string;       // 예: UPCDM8974400001
};

/** 라벨/저장 공통 컨텍스트 */
export type Context = {
  PLANT_CD: string;        // C200 등
  BD_CD?: string;          // 기본: WORK_CENTER 앞 2글자
  OP_CD: string;           // 기본: MATERIAL_CODE 앞 3글자
  OP_NAME?: string;        // 기본 'IP Injection'
  PART_NAME?: string;      // 기본 'MIDSOLE'
  DAY_SEQ: string;         // '1H' 형태
  SFC_CD: string;
  WORK_CENTER: string;     // 없으면 RESOURCE_CD로 보강
  DEVICE_ID?: string;      // 기본 'POP_DEVICE_01'
  USER_IP?: string;
  GENDER_CD?: string;      // ★ 추가 (DB NOT NULL 대응, 기본 'WO')
};

/** 라벨 화면 표시용 */
export type PassCardView = {
  orderTitle: string;
  prod: string;
  next: string;
  modelBold: string;
  modelSub: string;
  procName: string;
  workInfo: string;
  wo: string;
  qty: string;
  size: string;
  dateTime: string;
  qrValue: string;
};

/** DMPD_EPCARD 저장 SP 파라미터 */
export type EPCardInsert = {
  PLANT_CD: string;
  SFC_CD: string;
  BAR_KEY: string;
  DAY_SEQ: string;         // nvarchar(3)
  PCARD_SEQ: string;       // '001' 형식
  PCARD_QTY: number;

  BD_CD?: string;          // nvarchar(3)
  WORK_CENTER: string;     // nvarchar(50) NOT NULL

  ORDER_NUMBER: string;      // nvarchar(10)
  NEXT_ORDER_NUMBER: string; // ★ 빈 문자열 기본값 (nvarchar(10) NOT NULL)

  STYLE_CD: string;        // nvarchar(10) ← DM8974-400 (최대 10)
  STYLE_NAME: string;      // nvarchar(100)
  SIZE_CD: string;         // nvarchar(3)
  GENDER_CD: string;       // nvarchar(3) NOT NULL
  OP_CD: string;           // nvarchar(3)
  OP_NAME: string;         // nvarchar(100)
  PART_NAME: string;       // nvarchar(100)

  RESOURCE_CD: string;         // nvarchar(10)
  NEXT_RESOURCE_CD?: string;   // nvarchar(10)

  DEVICE_ID?: string;      // nvarchar(20)
  USER_IP?: string;        // nvarchar(50)

  PRINT_YN: string;        // nvarchar(1)
  PRINT_CNT: string;       // nvarchar(3)

  MARK_PRINTED?: boolean;
};

/* ───────── 기본값 ───────── */
const DEFAULTS = {
  NEXT_ORDER_NUMBER: "",                 // DB는 nvarchar(10) → 빈 문자열 기본
  STYLE_NAME: "WMNS NIKE AIR MAX BOLT",
  GENDER_CD: "WO",
  OP_NAME: "IP Injection",
  PART_NAME: "MIDSOLE",
  DEVICE_ID: "POP_DEVICE_01",
  DAY_SEQ: "1H",
};

const pad3 = (n: number) => n.toString().padStart(3, "0");

// DB 컬럼 길이에 맞춰 잘라주는 헬퍼
const clamp = (s: any, n: number) => (s ?? "").toString().slice(0, n);

// MATERIAL_CODE → { opCd, styleCd } 파싱
function parseFromMaterialCode(material?: string): { opCd?: string; styleCd?: string } {
  const m = (material ?? "").toString().trim();
  if (m.length < 12) return {};

  const op = m.slice(0, 3);       // 앞 3글자
  const style6 = m.slice(3, 9);   // 그 다음 6글자
  const color3 = m.slice(9, 12);  // 그 다음 3글자
  const styleCd = `${style6}-${color3}`; // 예: DM8974-400

  return { opCd: op, styleCd };
}

export function buildPassCardPayload(row: GridRow, ctx: Context) {
  const seq3 = pad3(row.PCARD_SEQ);
  const now = new Date();

  // ── 파생값 계산: MATERIAL_CODE 우선 ─────────────────────
  const { opCd: parsedOP, styleCd: parsedSTYLE } = parseFromMaterialCode(row.MATERIAL_CODE);

  // WORK_CENTER 앞 두 글자 → BD_CD 기본
  const workCenter = (ctx.WORK_CENTER && String(ctx.WORK_CENTER).trim()) || row.RESOURCE_CD || "";
  const bdFromWorkCenter = workCenter.slice(0, 2);

  // 컨텍스트/행 기본값 보강 + DB 길이 클램프
  const BD_CD      = clamp((ctx.BD_CD ?? bdFromWorkCenter), 3);                          // nvarchar(3)
  const OP_CD      = clamp((parsedOP ?? ctx.OP_CD ?? ""), 3);                            // nvarchar(3)
  const OP_NAME    = clamp((ctx.OP_NAME ?? DEFAULTS.OP_NAME), 100);                      // nvarchar(100)
  const PART_NAME  = clamp((ctx.PART_NAME ?? DEFAULTS.PART_NAME), 100);                  // nvarchar(100)
  const GENDER_CD  = clamp((ctx.GENDER_CD ?? DEFAULTS.GENDER_CD), 3);                    // nvarchar(3) NOT NULL

  const STYLE_NAME = clamp((row.STYLE_NAME ?? DEFAULTS.STYLE_NAME), 100);                // nvarchar(100)
  const DEVICE_ID  = clamp((ctx.DEVICE_ID ?? DEFAULTS.DEVICE_ID), 20);                   // nvarchar(20)
  const WORK_CENTER_CLAMPED = clamp(workCenter, 50);                                     // nvarchar(50)

  // STYLE_CD: MATERIAL_CODE 기반 파생 우선, 없으면 row.STYLE_CD 사용
  const STYLE_CD_RAW = parsedSTYLE ?? row.STYLE_CD ?? "";
  const STYLE_CD = clamp(STYLE_CD_RAW, 10);                                              // nvarchar(10) ← 'DM8974-400' 10자

  // SIZE_CD는 그대로(길이 3)
  const SIZE_CD = clamp(row.SIZE_CD, 3);

  // DAY_SEQ: 항상 '…H' 형태, 길이 3 유지
  const rawDaySeq = (ctx.DAY_SEQ && String(ctx.DAY_SEQ).trim()) || DEFAULTS.DAY_SEQ;
  const DAY_SEQ = clamp(rawDaySeq.endsWith("H") ? rawDaySeq : `${rawDaySeq}H`, 3);       // nvarchar(3)

  // BAR_KEY = ORDER_NUMBER(<=10) + PCARD_SEQ(3)  → 예: TESTPO-69 + 002 = TESTPO-69002
  const ORDER_NUMBER = clamp(row.ORDER_NUMBER, 10);
  const nextOrderNo  = clamp((row.NEXT_ORDER_NUMBER ?? DEFAULTS.NEXT_ORDER_NUMBER), 10);
  const BAR_KEY = `${ORDER_NUMBER}${seq3}`;

  // QR/바코드 문자열
  const qrValue = `${BAR_KEY}_${ORDER_NUMBER}_${nextOrderNo}`.replace(/_$/, "");

  // 상단 타이틀
  const ymd = format(now, "YYYYMMDD");
  const building = BD_CD ? `${BD_CD}-` : "";
  const orderTitle = `${ctx.PLANT_CD}-${building}${ymd}-${OP_CD}-${DAY_SEQ}-${seq3}`;

  const view: PassCardView = {
    orderTitle,
    prod: row.RESOURCE_CD,
    next: row.NEXT_RESOURCE_CD ?? "",
    modelBold: STYLE_CD,          // 굵게: DM8974-400
    modelSub: STYLE_NAME,
    procName: `${OP_CD} (${OP_NAME}) / ${PART_NAME}`,
    workInfo: `${ctx.PLANT_CD} - ${OP_CD} / ${ORDER_NUMBER}`,
    wo: "7 - 7T",
    qty: String(row.PCARD_QTY),
    size: SIZE_CD,
    dateTime: format(now, "YYYY-MM-DD HH:mm:ss"),
    qrValue,
  };

  const insert: EPCardInsert = {
    PLANT_CD: ctx.PLANT_CD,
    SFC_CD: clamp(ctx.SFC_CD, 128),
    BAR_KEY,
    DAY_SEQ,
    PCARD_SEQ: seq3,
    PCARD_QTY: row.PCARD_QTY,

    BD_CD,
    WORK_CENTER: WORK_CENTER_CLAMPED,

    ORDER_NUMBER,
    NEXT_ORDER_NUMBER: nextOrderNo,

    STYLE_CD,
    STYLE_NAME,
    SIZE_CD,
    GENDER_CD,
    OP_CD,
    OP_NAME,
    PART_NAME,

    RESOURCE_CD: clamp(row.RESOURCE_CD, 10),
    NEXT_RESOURCE_CD: clamp(row.NEXT_RESOURCE_CD ?? "", 10),

    DEVICE_ID: DEVICE_ID,
    USER_IP: clamp(ctx.USER_IP ?? "", 50),

    PRINT_YN: "N",
    PRINT_CNT: "0",
  };

  return { view, insert };
}
