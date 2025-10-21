// src/main/utils/configPath.ts
import fs from "fs";
import { getBestConfigPath } from "./loadConfig";

export function getConfigPath(): string {
  const p = getBestConfigPath();
  console.log(`🔍 Config Path: ${p}`);
  return p;
}

export function configExists(): boolean {
  try {
    const p = getConfigPath();
    const ok = fs.existsSync(p);
    if (!ok) console.warn(`❌ Config 파일이 존재하지 않음: ${p}`);
    return ok;
  } catch (e: any) {
    console.warn("❌ Config 경로 확인 실패:", e?.message || e);
    return false;
  }
}
