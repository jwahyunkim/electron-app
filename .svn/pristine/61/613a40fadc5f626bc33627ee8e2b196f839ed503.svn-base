// src/main/utils/ps.ts
import { execFile } from "child_process";

/**
 * Run a PowerShell command and return stdout (trimmed).
 * - Uses -NoProfile and -ExecutionPolicy Bypass for reliability
 * - Hides window and enforces a sane timeout
 */
export function runPS(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      process.platform === "win32" ? "powershell.exe" : "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { windowsHide: true, timeout: 20000 }, // 20s
      (err, stdout, stderr) => {
        if (err) return reject(stderr || err);
        resolve((stdout ?? "").trim());
      }
    );
  });
}
