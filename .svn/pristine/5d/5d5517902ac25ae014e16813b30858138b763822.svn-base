import { SerialPort } from "serialport";
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import axios from "axios";
import { app } from "electron";

function isDevMode() {
  return !app || process.env.NODE_ENV === "development";
}

function getConfigPath() {
  return isDevMode()
    ? path.resolve(__dirname, "../../public/Config.xml")
    : path.join(process.resourcesPath, 'public', 'Config.xml'); // prod ✅
}

function getComConfigsFromXml() {
  const configPath = getConfigPath();
  try {
    const xml = fs.readFileSync(configPath, "utf-8");
    const parser = new XMLParser();
    const parsed = parser.parse(xml);

    const comm = parsed.SETTING?.Comm;

    return [
      {
        name: "장비 A",
        port: `COM${comm?.COMMPORT || 2}`,
        settings: comm?.SETTINGS || "9600,n8,1"
      },
      {
        name: "장비 B",
        port: `COM${comm?.COMMPORT1 || 5}`,
        settings: comm?.SETTINGS1 || "9600,n8,1"
      }
    ];
  } catch (err) {
    console.error("❌ COM XML 파싱 실패:", err.message);
    return [];
  }
}

export default function startComServer() {
  const configs = getComConfigsFromXml();

  configs.forEach(({ port, name, settings }) => {
    const [baudRate, parity, stopBits] = settings.split(",").map(s => s.trim());
    const dataBits = parity?.length === 3 ? parseInt(parity[1], 10) : 8;
    const actualParity = parity?.length === 3 ? parity[0] : "none";
    const actualStopBits = stopBits === "1" ? 1 : 2;

    const serial = new SerialPort({
      path: port,
      baudRate: parseInt(baudRate, 10),
      dataBits,
      stopBits: actualStopBits,
      parity: actualParity,
      autoOpen: false
    });

    serial.open(err => {
      if (err) {
        console.error(`❌ [${name}] ${port} 열기 실패:`, err.message);
      } else {
        console.log(`✅ [${name}] ${port} 연결됨 (${settings})`);
      }
    });

    serial.on("data", async data => {
      const text = data.toString("utf-8").trim() || "(빈 데이터)";
      console.log(`📥 [${name}] 수신 데이터: ${text}`);

      try {
        await axios.post("http://localhost:4000/api/mssql/save-tcp-log", {
          deviceName: name,
          ipAddress: "COM",
          port: parseInt(port.replace("COM", ""), 10),
          data: text
        });
      } catch (err) {
        console.error(`❌ [${name}] 로그 저장 실패:`, err.message);
      }
    });

    serial.on("error", err => {
      console.error(`❌ [${name}] ${port} 오류:`, err.message);
    });

    serial.on("close", () => {
      console.warn(`🔌 [${name}] ${port} 연결 종료됨`);
    });
  });
}
