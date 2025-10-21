import express from "express";
import { SerialPort } from "serialport";

const router = express.Router();

// 👉 GET /api/devices/ports
router.get("/ports", async (req, res) => {
  try {
    const ports = await SerialPort.list(); // 전체 포트 목록 가져오기
    res.json(ports);
  } catch (err) {
    console.error("❌ 포트 조회 실패:", err);
    res.status(500).json({ error: "포트 목록 조회 실패" });
  }
});

export default router;
