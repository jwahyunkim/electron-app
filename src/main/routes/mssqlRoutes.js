import express from 'express'
import cors from 'cors';
import { sql, poolPromise } from '@shared/mssql2'
const router = express.Router()
// CORS: 프런트 직접 호출 시 필요. 정책에 맞게 origin 제한 권장.
router.use(cors({ origin: true, credentials: true }));

// MSSQL 연결 풀 가져오기
async function getPool() {
  try {
    const pool = await poolPromise;
    if (!pool) {
      throw new Error("MSSQL 연결 실패");
    }
    return pool;
  } catch (err) {
    console.error("MSSQL 연결 오류:", err.message);
    throw err;
  }
}

// 예시 라우트: MSSQL에서 데이터 조회

router.get("/orders", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT TOP 10 * FROM DMPD_PROD_ORDER");
    // const result = await pool.request().query("SELECT DB_NAME() AS CurrentDB, SUSER_NAME() AS CurrentUser");
    res.json(result.recordset);
  } catch (err) {
    console.error("MSSQL Error:", err.message); // <-- 여기 중요
    res.status(500).json({ error: "MSSQL Error", detail: err.message });
  }
});

// 차감 대상 타입 설정: 필요 시 여기만 수정
const DEFECT_TYPES_TO_DEDUCT = ['R', 'S']; // 예: ['R','S'] → 나중에 ['R'] 또는 ['R','S','X']로 변경 가능

// 불량 입력 전 스타일/사이즈 선택 API
router.get("/defectsOptions", async (req, res) => {
  const { styleCd, styleName, sizeCd } = req.query; // 쿼리스트링 파라미터 받음
  const defectTypeList = DEFECT_TYPES_TO_DEDUCT.map(t => `'${t}'`).join(', ');

  const query = `
   ;WITH Base AS (
    SELECT 
      P.ORDER_NUMBER,
      P.PLANT,
      P.ZCF_STYLE_CD AS STYLE_CD,
      P.ZCF_STYLE_NM AS STYLE_NAME,
      P.ZCF_SIZE_CD  AS SIZE_CD,
      CAST(P.ORDEREDQUANTITY AS DECIMAL(18,3)) AS ORDEREDQUANTITY
    FROM DMPD_PROD_ORDER P
  ),
  UsedP AS (
    SELECT 
      S.ORDER_NUMBER,
      S.PLANT_CD AS PLANT,
      SUM(CAST(S.PCARD_QTY AS DECIMAL(18,3))) AS USED_QTY
    FROM DMPD_EPCARD_SCAN S
    WHERE S.SCAN_TYPE = 'P'
    GROUP BY S.ORDER_NUMBER, S.PLANT_CD
  ),
  UsedDefect AS (
    SELECT 
      R.ORDER_NUMBER,
      R.PLANT_CD AS PLANT,
      SUM(CAST(R.DEFECT_QTY AS DECIMAL(18,3))) AS DEFECT_QTY
    FROM DMQM_DEFECT_RESULT R
    WHERE R.DEFECT_TYPE IN (${defectTypeList})
    GROUP BY R.ORDER_NUMBER, R.PLANT_CD
  ),
  Avail AS (
    SELECT 
      B.ORDER_NUMBER,
      B.PLANT,
      B.STYLE_CD,
      B.STYLE_NAME,
      B.SIZE_CD,
      (B.ORDEREDQUANTITY 
        - ISNULL(P.USED_QTY,0) 
        - ISNULL(D.DEFECT_QTY,0)) AS QTY
    FROM Base B
    LEFT JOIN UsedP P ON P.ORDER_NUMBER = B.ORDER_NUMBER AND P.PLANT = B.PLANT
    LEFT JOIN UsedDefect D ON D.ORDER_NUMBER = B.ORDER_NUMBER AND D.PLANT = B.PLANT
  )
  SELECT 
    PLANT,
    STYLE_CD,
    STYLE_NAME,
    SIZE_CD,
    SUM(QTY) AS QTY
  FROM Avail
  WHERE QTY > 0
    ${styleCd ? `AND STYLE_CD = @styleCd` : ""}
    ${styleName ? `AND STYLE_NAME = @styleName` : ""}
    ${sizeCd ? `AND SIZE_CD = @sizeCd` : ""}
  GROUP BY PLANT, STYLE_CD, STYLE_NAME, SIZE_CD
  ORDER BY PLANT, STYLE_CD, SIZE_CD;
  `;

  try {
    const pool = await getPool();
    const request = pool.request();

    if (styleCd) request.input("styleCd", styleCd);
    if (styleName) request.input("styleName", styleName);
    if (sizeCd) request.input("sizeCd", sizeCd);

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error("MSSQL Error:", err.message);
    res.status(500).json({ error: "MSSQL Error", detail: err.message });
  }
});





/**
 * 불량 INSERT
 * 요구사항:
 * 1) ORDER_NUMBER는 STYLE_CD+SIZE_CD로 필터하고,
 *    P 스캔 수량 + 이미 입력된(defect_type ∈ DEFECT_TYPES_TO_DEDUCT) DEFECT_QTY를 차감한 잔량(QTY)>0인 주문만 사용
 * 2) 한 ORDER_NUMBER당 삽입 한도 = ORDEREDQUANTITY - SUM(PCARD_QTY where SCAN_TYPE='P') - SUM(DEFECT_QTY where DEFECT_TYPE in 대상)
 * 3) 한도를 초과하면 다음 ORDER_NUMBER로 분할 INSERT (ORDER_NUMBER 오름차순)
 * 4) PCARD_QTY는 항상 NULL
 */
router.post('/defect', async (req, res) => {
  const {
    plantCd,
    seq,                 // 분할 시 suffix 부여
    workCenter,
    defectType,          // 1자
    deviceId,
    userIp,
    lr,                  // 1자 (L/R)
    defectQty,           // 요청 불량 수량
    defectCd,            // 10자
    styleCd,             // 매칭용
    sizeCd               // 매칭용
  } = req.body;

  if (!plantCd || !styleCd || !sizeCd) {
    return res.status(400).json({ success: false, error: 'plantCd, styleCd, sizeCd 필수' });
  }
  if (!Number.isFinite(Number(defectQty)) || Number(defectQty) <= 0) {
    return res.status(400).json({ success: false, error: 'defectQty > 0 필요' });
  }

  let tx;
  try {
    const pool = await getPool();
    tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); // 동시성 보호

    // const now = new Date();
    // const pad = (n) => (n < 10 ? '0' + n : '' + n);
    // const ymd = now.getFullYear().toString() + pad(now.getMonth() + 1) + pad(now.getDate());

    // 1) STYLE_CD + SIZE_CD로 가용 수량 조회, ORDER_NUMBER 오름차순
    const listReq = new sql.Request(tx);
    listReq.input('plant', sql.NVarChar(4), plantCd);
    listReq.input('styleCd', sql.NVarChar(50), styleCd);
    listReq.input('sizeCd', sql.NVarChar(50), sizeCd);

    // DEFECT_TYPES_TO_DEDUCT 파라미터 바인딩 준비
    // 공집합이면 어떤 것도 차감하지 않도록 '0=1' 처리
    const hasTypeFilter = Array.isArray(DEFECT_TYPES_TO_DEDUCT) && DEFECT_TYPES_TO_DEDUCT.length > 0;
    const typeParams = hasTypeFilter
      ? DEFECT_TYPES_TO_DEDUCT.map((_, i) => `@dt${i}`).join(', ')
      : null;
    if (hasTypeFilter) {
      DEFECT_TYPES_TO_DEDUCT.forEach((v, i) => {
        listReq.input(`dt${i}`, sql.NVarChar(1), String(v).slice(0, 1));
      });
    }

    const listSql = `
      ;WITH Base AS (
        SELECT
          P.ORDER_NUMBER,
          P.PLANT,
          P.ZCF_STYLE_CD AS STYLE_CD,
          P.ZCF_STYLE_NM AS STYLE_NAME,
          P.ZCF_SIZE_CD  AS SIZE_CD,
          CAST(P.ORDEREDQUANTITY AS DECIMAL(18,3)) AS ORDEREDQUANTITY
        FROM DMPD_PROD_ORDER P WITH (UPDLOCK, HOLDLOCK)
        WHERE P.PLANT = @plant
          AND P.ZCF_STYLE_CD = @styleCd
          AND P.ZCF_SIZE_CD  = @sizeCd
      ),
      UsedP AS (
        SELECT
          S.ORDER_NUMBER,
          SUM(CAST(S.PCARD_QTY AS DECIMAL(18,3))) AS USED_QTY
        FROM DMPD_EPCARD_SCAN S WITH (HOLDLOCK)
        WHERE S.PLANT_CD = @plant
          AND S.SCAN_TYPE = 'P'
        GROUP BY S.ORDER_NUMBER
      ),
      UsedD AS (
        SELECT
          R.ORDER_NUMBER,
          SUM(CAST(R.DEFECT_QTY AS DECIMAL(18,3))) AS DEFECTED_QTY
        FROM DMQM_DEFECT_RESULT R WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN DMPD_PROD_ORDER P2 WITH (UPDLOCK, HOLDLOCK)
          ON P2.ORDER_NUMBER = R.ORDER_NUMBER
        AND P2.PLANT = R.PLANT_CD
        WHERE R.PLANT_CD = @plant
          AND P2.ZCF_STYLE_CD = @styleCd
          AND P2.ZCF_SIZE_CD  = @sizeCd
          ${hasTypeFilter ? `AND R.DEFECT_TYPE IN (${typeParams})` : `AND 1=0`}
        GROUP BY R.ORDER_NUMBER
      ),
      Avail AS (
        SELECT
          B.ORDER_NUMBER,
          B.PLANT,
          B.STYLE_CD,
          B.STYLE_NAME,
          B.SIZE_CD,
          CAST(B.ORDEREDQUANTITY - ISNULL(UP.USED_QTY, 0) - ISNULL(UD.DEFECTED_QTY, 0) AS DECIMAL(18,3)) AS QTY
        FROM Base B
        LEFT JOIN UsedP UP ON UP.ORDER_NUMBER = B.ORDER_NUMBER
        LEFT JOIN UsedD UD ON UD.ORDER_NUMBER = B.ORDER_NUMBER
      )
      SELECT 
        A.ORDER_NUMBER,
        A.PLANT,
        A.STYLE_CD,
        A.STYLE_NAME,
        A.SIZE_CD,
        A.QTY,
        S.SFC  AS SFC_CD   -- ★ 여기서 같이 가져옴
      FROM Avail A
      INNER JOIN DMPD_SFC S
        ON S.ORDER_NUMBER = A.ORDER_NUMBER
      AND S.PLANT_CD = A.PLANT
      WHERE A.QTY > 0
--      ORDER BY TRY_CONVERT(BIGINT, A.ORDER_NUMBER), A.ORDER_NUMBER;
      ORDER BY TRY_CONVERT(BIGINT, A.ORDER_NUMBER) DESC, A.ORDER_NUMBER DESC; -- order insert를 오름차순에서 내림차순으로 바꿈

    `;


    const orders = (await listReq.query(listSql)).recordset || [];

    if (orders.length === 0) {
      await tx.rollback();
      return res.status(400).json({ success: false, error: '가용 주문 없음' });
    }

    const totalAvail = orders.reduce((a, b) => a + Number(b.QTY), 0);
    const need = Number(defectQty);

    // 2) 총 가용 초과 금지
    if (need > totalAvail) {
      await tx.rollback();
      return res.status(400).json({
        success: false,
        error: `가용수량 부족: 요청 ${need}, 가용 ${totalAvail} (STYLE_CD=${styleCd}, SIZE_CD=${sizeCd})`
      });
    }

    // 3) ORDER_NUMBER 오름차순으로 분할 INSERT
    let remain = need;
    let seqIdx = 1;

    for (const o of orders) {
      if (remain <= 0) break;
      const alloc = Math.min(remain, Number(o.QTY)); // 주문별 한도 준수

    //생성 시간
      const now = new Date();
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      const ymd = now.getFullYear().toString() + pad(now.getMonth() + 1) + pad(now.getDate());

    // 기존 최대 seq 조회
      const seqReq = new sql.Request(tx);
      seqReq.input('orderNumber', sql.NVarChar(10), o.ORDER_NUMBER);
      seqReq.input('plantCd', sql.NVarChar(4), plantCd);
      const seqQuery = `
        SELECT MAX(TRY_CAST(RIGHT(SEQ, 3) AS INT)) AS MAX_SEQ
        FROM DMQM_DEFECT_RESULT WITH (UPDLOCK, HOLDLOCK)
        WHERE PLANT_CD = @plantCd
          AND ORDER_NUMBER = @orderNumber
          AND SEQ LIKE @orderNumber + '-___';
         `;
      const seqResult = await seqReq.query(seqQuery);
      const nextSeq = (Number(seqResult.recordset[0]?.MAX_SEQ) || 0) + 1;
      const seqVal  = `${o.ORDER_NUMBER}-${String(nextSeq).padStart(3, '0')}`;


      const insReq = new sql.Request(tx);
      insReq
        .input('plantCd', sql.NVarChar(4), plantCd)
        .input('sfcCd', sql.NVarChar(10), o.SFC_CD)

             .input('seq', sql.NVarChar(20), seqVal)
        .input('pcardQty', sql.Decimal(10, 3), null)                // PCARD_QTY는 NULL
        .input('workCenter', sql.NVarChar(50), workCenter)
        .input('defectType', sql.NVarChar(1), defectType)           // 1자
        .input('orderNumber', sql.NVarChar(10), o.ORDER_NUMBER)     // 길이 10 확정
        .input('createDate', sql.NVarChar(8), ymd)                  // YYYYMMDD
        .input('createDt', sql.DateTime, now)
        .input('deviceId', sql.NVarChar(20), deviceId)
        .input('userIp', sql.NVarChar(50), userIp)
        .input('uploadDate', sql.NVarChar(8), ymd)
        .input('uploadDt', sql.DateTime, now)
        .input('uploadYn', sql.NVarChar(1), 'N')
        .input('lr', sql.NVarChar(1), lr)                           // 1자
        .input('defectQty', sql.Decimal(10, 3), alloc)              // 분할 수량
        .input('defectCd', sql.NVarChar(10), String(defectCd || '').slice(0, 10));

      await insReq.query(`
        INSERT INTO dbo.DMQM_DEFECT_RESULT
          (PLANT_CD, SFC_CD, SEQ, PCARD_QTY, WORK_CENTER, DEFECT_TYPE,
           ORDER_NUMBER, CREATE_DATE, CREATE_DT, DEVICE_ID, USER_IP,
           UPLOAD_DATE, UPLOAD_DT, UPLOAD_YN, LR, DEFECT_QTY, DEFECT_CD)
        VALUES
          (@plantCd, @sfcCd, @seq, @pcardQty, @workCenter, @defectType,
           @orderNumber, @createDate, @createDt, @deviceId, @userIp,
           @uploadDate, @uploadDt, @uploadYn, @lr, @defectQty, @defectCd)
      `);

      remain -= alloc;
      seqIdx += 1;
    }

    await tx.commit();
    return res.status(201).json({ success: true, insertedRows: need });
  } catch (err) {
    if (tx) {
      try { await tx.rollback(); } catch (_) {}
    }
    console.error('MSSQL INSERT Error:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: err && err.message ? err.message : 'server error' });
  }
});

// /defects/current
router.get('/defects/current', async (req, res) => {
  const plant = typeof req.query.plant === 'string' ? req.query.plant : 'C200';
  const op    = typeof req.query.op === 'string'    ? req.query.op    : 'UPC';
  const asOfQ = typeof req.query.asOf === 'string'  ? req.query.asOf  : undefined;

  const pool = await getPool();

  let asOfYmd = asOfQ && /^\d{8}$/.test(asOfQ) ? asOfQ : null;
  if (!asOfYmd) {
    const r = await pool.request().query(`SELECT CONVERT(varchar(8), GETDATE(), 112) AS asOfYmd`);
    asOfYmd = r.recordset[0].asOfYmd;
  }

  const sqlText = `
DECLARE @eff CHAR(8) =
(
  SELECT MAX(VAL_DATE)
  FROM dbo.DMQM_DEFECT_MASTER
  WHERE PLANT_CD = @plant
    AND OP_CD    = @op
    AND LEN(VAL_DATE) = 8
    AND VAL_DATE <= @asOfYmd
);
IF @eff IS NULL
BEGIN
  SELECT TOP 0
    CAST(NULL AS varchar(4))   AS plantCd,
    CAST(NULL AS varchar(10))  AS opCd,
    CAST(NULL AS varchar(20))  AS defectCode,
    CAST(NULL AS varchar(100)) AS defectName,
    CAST(NULL AS varchar(100)) AS defectNameEn,
    CAST(NULL AS int)          AS sortSeq,
    CAST(NULL AS char(8))      AS valDate;
END
ELSE
BEGIN
  SELECT
    PLANT_CD       AS plantCd,
    OP_CD          AS opCd,
    DEFECT_CODE    AS defectCode,
    DEFECT_NAME    AS defectName,
    DEFECT_NAME_EN AS defectNameEn,
    SORT_SEQ       AS sortSeq,
    VAL_DATE       AS valDate
  FROM dbo.DMQM_DEFECT_MASTER
  WHERE PLANT_CD = @plant
    AND OP_CD    = @op
    AND VAL_DATE = @eff
  ORDER BY ISNULL(SORT_SEQ, 2147483647), DEFECT_CODE;
END
`;
  const request = pool.request();
  request.input('plant', plant);
  request.input('op', op);
  request.input('asOfYmd', asOfYmd);
  const result = await request.query(sqlText);
  res.json(result.recordset);
});

export default router;
