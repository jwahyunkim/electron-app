// src/main/warmup.ts
import axios from "axios";

/**
 * 메인 프로세스에서 딱 1회만 워밍업.
 * - 로컬 API 서버가 이미 떠 있다면 /api/healthz, /api/mssql/ping 만 호출
 * - baseURL을 넘기면 그 주소로 핑 (권장: http://127.0.0.1:${port})
 */
let warmupPromise: Promise<void> | null = null;

export function warmupOnce(baseURL: string): Promise<void> {
  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    try {
      const ax = axios.create({ baseURL, timeout: 1500 });

      // 서버/DB 풀 콜드스타트 제거 (최대 한 번씩)
      await Promise.allSettled([
        ax.get("/api/healthz"),
        ax.get("/api/mssql/ping"),
      ]);
    } catch (e) {
      console.warn("[warmup] failed (ignored):", e);
      // 실패해도 앱은 정상 동작 (첫 실제 호출에서 자연 초기화)
    }
  })();

  return warmupPromise;
}
