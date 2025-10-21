// src/main/utils/settings.ts
import fs from "fs";
import path from "path";
import { app } from "electron";

type Settings = Record<string, any>;
const file = path.join(app.getPath("userData"), "settings.json");

function readRaw(): Settings {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}
function writeRaw(s: Settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s, null, 2), "utf-8");
}

export function getSetting<T = any>(key: string, def?: T): T {
  const s = readRaw();
  return (s as any)[key] ?? def;
}
export function setSetting(key: string, value: any) {
  const s = readRaw();
  (s as any)[key] = value;
  writeRaw(s);
}
