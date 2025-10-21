// src/routes/tcpServer.js
import net from "net";
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import axios from "axios";
import { app } from "electron";

// 🔧 개발/배포 경로 분기
function isDevMode() {
  return !app || !app.isPackaged;
}

function getConfigPath() {
  return isDevMode()
    ? path.resolve(__dirname, "../../public/Config.xml")    // 개발
    : path.join(process.resourcesPath, 'public', 'Config.xml'); // prod ✅
}

// 🔹 XML에서 TCP 포트 정보 읽기
function getTcpPortsFromXml() {
  try {
    const configPath = getConfigPath();
    const xmlData = fs.readFileSync(configPath, "utf-8");
    const parser = new XMLParser();
    const config = parser.parse(xmlData);

    const portA = parseInt(config?.SETTING?.HOST?.PORT || "8888", 10);
    const portB = parseInt(config?.SETTING?.HOST?.PORT1 || "8889", 10);

    const ipA = config?.SETTING?.HOST?.HOST || "";
    const ipB = config?.SETTING?.HOST?.HOST1 || "";

    return [
      { port: portA, name: "장비 A", expectedIp: ipA },
      { port: portB, name: "장비 B", expectedIp: ipB },
    ];
  } catch (err) {
    console.error("❌ XML 파싱 실패:", err.message);
    return [];
  }
}

// 🔹 TCP 서버 시작
export default function startTcpServer() {
  console.log("🟡 TCP 서버 시작 시도 중...");

  const configs = getTcpPortsFromXml();

  configs.forEach(({ port, name, expectedIp }) => {
    const server = net.createServer((socket) => {
      const clientIp = socket.remoteAddress?.replace("::ffff:", "");
      const deviceName = clientIp === expectedIp ? name : `알 수 없는 장비 (${clientIp})`;

      console.log(`✅ [${deviceName}] 연결됨 (포트 ${port})`);

      socket.on("data", async (data) => {
        const cleaned = data.toString("utf-8").replace(/\r?\n/g, "").trim() || "(빈 데이터)";
        console.log(`📥 [${deviceName}] 수신 데이터: ${cleaned}`);

        try {
          await axios.post("http://localhost:4000/api/mssql/save-tcp-log", {
            deviceName,
            ipAddress: clientIp,
            port,
            data: cleaned,
          });
          console.log("📝 TCP 로그 저장 요청 완료");
        } catch (err) {
          console.error("❌ 로그 저장 실패:", err.message);
        }
      });

      socket.on("end", () => {
        console.log(`📴 [${deviceName}] 연결 종료됨`);
      });

      socket.on("error", (err) => {
        console.error(`❌ [${deviceName}] 소켓 오류:`, err.message);
      });
    });

    server.listen(port, () => {
      console.log(`🚀 TCP 서버 시작됨. 포트: ${port}`);
    }).on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ 포트 ${port}는 이미 사용 중입니다. 다른 프로세스를 종료하거나 포트를 변경하세요.`);
      } else {
        console.error(`❌ 서버 실행 오류: ${err.message}`);
      }
    });
  });
}
