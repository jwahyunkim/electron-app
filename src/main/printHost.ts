// src/main/printHost.ts
import { BrowserWindow } from "electron";

let host: BrowserWindow | null = null;

export async function ensurePrintHost(deviceName?: string) {
  if (host && !host.isDestroyed()) return host;
  host = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await host.loadURL("data:text/html,<html><body></body></html>");

  // 🔥 드라이버 & 스풀러 예열용 1픽셀 프린트(앱 시작 시 1회)
  await new Promise<void>((resolve) => {
    host!.webContents.print(
      { silent: true, deviceName, printBackground: false, pageSize: { width: 1, height: 1 } as any },
      () => resolve()
    );
  });

  return host;
}
