// src/main/utils/loadConfig_Pg.ts
import fs from "fs";
import { XMLParser } from "fast-xml-parser";
import { getBestConfigPath } from "./loadConfig";

export type PgConfig = {
  host: string; port: number; user: string; password: string; database: string;
  poolMax?: number; idleMs?: number;
};

export function loadPgConfig(): PgConfig {
  const file = getBestConfigPath();
  if (!fs.existsSync(file)) throw new Error(`Config.xml not found: ${file}`);

  const xml = fs.readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
  const json = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml);

  // 보통은 SETTING.POSTGRES, 예외적으로 루트.POSTGRES도 허용
  const pg = json?.SETTING?.POSTGRES ?? json?.POSTGRES;
  if (!pg) throw new Error(`<POSTGRES> block missing in ${file}`);

  const norm = (v: any, d = "") => (typeof v === "string" ? v.trim() : (v ?? d)).toString();

  return {
    host: norm(pg.HOST, "127.0.0.1"),
    port: Number(norm(pg.PORT, "5432")),
    user: norm(pg.USER),
    password: norm(pg.PASSWORD),
    database: norm(pg.DB_NAME),
    poolMax: Number(norm(pg.POOL_MAX, "10")),
    idleMs: Number(norm(pg.IDLE_MS, "10000")),
  };
}
