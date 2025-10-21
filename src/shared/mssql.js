import sql from "mssql";

// 실제 MSSQL 접속 설정
//npm install fast-xml-parser
//npm install mssql
const config = {
  user: "sa",
  password: "Welcome1@init00$",
  server: "203.228.118.39",
  database: "POP_SQLDB_UP",
  options: {
    encrypt: false,
    enableArithAbort: true,
    requestTimeout: 300000
  }
};

// 커넥션 풀 생성
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✅ MSSQL 연결 성공");
    return pool;
  })
  .catch(err => {
    console.error("❌ MSSQL 연결 실패", err);
  });

// ✅ ESM 스타일 export
export { sql, poolPromise };
