// src/main/ipc-warmup.ts
import { ipcMain } from "electron";
import { warmupOnce } from "./warmup";

let lastBaseUrl = "http://127.0.0.1:4000"; // ensureLocalApiServer로 갱신 예정

export function setWarmupBaseUrl(url: string) {
  lastBaseUrl = url;
}

export function registerWarmupIpc() {
  ipcMain.handle("warmup:run", () => warmupOnce(lastBaseUrl));
}
