import mqtt from "mqtt";
import axios from "axios";
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { app } from "electron";

// 🔹 실행 모드에 따라 Config 파일 경로 결정
function getConfigPath() {
  const isDev = !app || process.env.NODE_ENV === "development";
  return isDev
    ? path.resolve(__dirname, "../../public/Config.xml")
    : path.join(process.resourcesPath, 'public', 'Config.xml'); // prod ✅
}

// 🔹 XML에서 MQTT 설정 읽기
function getMqttConfig() {
  try {
    const configPath = getConfigPath();
    const xml = fs.readFileSync(configPath, "utf-8");
    const parser = new XMLParser();
    const parsed = parser.parse(xml);

    return {
      broker: parsed.SETTING?.MQTT?.BROKER || "mqtt://localhost:1883",
      topic: parsed.SETTING?.MQTT?.TOPIC || "default/topic"
    };
  } catch (err) {
    console.error("❌ MQTT XML 파싱 실패:", err.message);
    return { broker: "mqtt://localhost:1883", topic: "default/topic" };
  }
}

// 🔹 MQTT 클라이언트 시작
export default function startMqttClient() {
  const { broker, topic } = getMqttConfig();
  console.log(`🚀 MQTT 연결 시작: ${broker} | 구독: ${topic}`);

  const client = mqtt.connect(broker);

  client.on("connect", () => {
    console.log("✅ MQTT 연결 성공");
    client.subscribe(topic, (err) => {
      if (err) {
        console.error("❌ MQTT 구독 실패:", err.message);
      } else {
        console.log(`📡 구독 성공: ${topic}`);
      }
    });
  });

  client.on("message", async (topic, message) => {
    const payload = message.toString("utf-8").trim();
    console.log(`📥 [MQTT] ${topic} → ${payload}`);

    try {
      await axios.post("http://localhost:4000/api/mssql/save-tcp-log", {
        deviceName: "MQTT 장비",
        ipAddress: "MQTT",
        port: 0,
        data: payload,
      });
    } catch (err) {
      console.error("❌ MQTT 로그 저장 실패:", err.message);
    }
  });

  client.on("error", (err) => {
    console.error("❌ MQTT 오류:", err.message);
  });
}
