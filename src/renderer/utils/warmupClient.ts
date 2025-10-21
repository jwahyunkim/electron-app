// src/renderer/utils/warmupClient.ts
import { getAxios } from "../utils/api";

let warmupClientPromise: Promise<void> | null = null;

export function runWarmupOnceFromRenderer(): Promise<void> {
  if (warmupClientPromise) return warmupClientPromise;

  warmupClientPromise = (async () => {
    try {
      // (선택) 메인에 IPC 핸들러가 있다면 메인에서 실행
      // await (window as any)?.electron?.ipcRenderer?.invoke?.("warmup:run").catch(() => {});

      // 또는 렌더러에서 직접 가벼운 API 한 번만 콜
      const ax = await getAxios();
      await Promise.race([
        ax.get("/api/healthz"),
        new Promise((_, r) => setTimeout(() => r(new Error("warmup-timeout")), 1500)),
      ]).catch(() => {});

      // 패스카드 옵션 캐시(IPC+XML 콜드 제거)
      try { await (window as any).config?.getPasscardOptions?.(); } catch {}
    } catch {}
  })();

  return warmupClientPromise;
}
