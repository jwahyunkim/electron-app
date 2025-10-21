const { connectDb } = require('../mssql2.js');

(async () => {
  try {
    const pool = await connectDb();
    const result = await pool.request().query('SELECT GETDATE() AS now');
    console.log("✅ DB 연결 성공:", result.recordset[0].now);
    pool.close();
  } catch (err) {
    console.error("❌ DB 연결 실패:", err);
  }
})();
