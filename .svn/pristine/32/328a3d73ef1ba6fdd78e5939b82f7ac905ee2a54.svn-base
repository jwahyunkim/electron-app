// global.d.ts
import type { ElectronAPI } from '@electron-toolkit/preload';

export {};

declare global {
  interface Window {
    // ✅ 업데이트 관련(onUpdateProgress / onUpdateError / removeUpdateListeners) 제거
    electron: ElectronAPI;

    // ✅ XML config 로더 API
    api: {
      getConfig: () => Promise<any | null>;
    };

    // ✅ Config 헬퍼
    config: {
      get: () => Promise<any | null>;
    };
  }
}
