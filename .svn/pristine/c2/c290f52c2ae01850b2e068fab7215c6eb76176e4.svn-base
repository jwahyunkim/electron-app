//C:\Changshin\test\electron-app_final\src\main\routes\getIpRoutes.js
import express from "express";
import os from "os";
import axios from "axios";

const router = express.Router();

// ✅ 내부 IP 구하기 함수
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

router.get("/get-ip", async (req, res) => {
  try {
    // ✅ 내부 IP (PC LAN 주소)
    const localIp = getLocalIp();

    // ✅ 외부 IP (공인 IP 주소)
    const externalResp = await axios.get("https://api.ipify.org?format=json");
    const externalIp = externalResp.data.ip;

    res.json({
      localIp,
      externalIp
    });
  } catch (err) {
    res.status(500).json({ error: "IP 조회 실패", detail: err.message });
  }
});

export default router;
