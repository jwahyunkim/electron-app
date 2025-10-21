import oracledb from "oracledb";

// ✅ Oracle Instant Client 경로를 명시해 Thick 모드 활성화
try {
  oracledb.initOracleClient({ libDir: "C:\\oracle\\instantclient_23_8" });
  console.log("✅ Oracle Client 초기화 완료 (Thick 모드)");
} catch (err) {
  console.error("❌ Oracle Client 초기화 실패:", err);
}

const config = {
  user: "LMES",
  password: "LMES",
  connectString: "172.30.10.49/LMES"
};

export async function getConnection() {
  return await oracledb.getConnection(config);
}
