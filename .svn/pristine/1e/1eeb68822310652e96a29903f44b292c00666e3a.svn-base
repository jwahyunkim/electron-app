// src/renderer/utils/api.ts
import axios, { AxiosInstance } from "axios";

let _baseUrl: string | null = null;
let _axios: AxiosInstance | null = null;

/** 최소 형태의 IPC 타입 (invoke만 사용) */
type IpcRendererLike = {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
};

/** window.ipc 안전하게 얻기 (타입 내로잉 + 런타임 가드) */
function getIpc(): IpcRendererLike {
  // 사용자의 선호에 맞춰 as any로 우회 후, 런타임에서 안전성 검사
  const ipc = (window as any)?.ipc as IpcRendererLike | undefined;
  if (!ipc || typeof ipc.invoke !== "function") {
    // 여기서 명확한 메시지로 조기 실패
    throw new Error(
      "[API] preload에서 window.ipc가 노출되지 않았습니다. " +
        "preload의 contextBridge.exposeInMainWorld('ipc', ...) 구성을 확인하세요."
    );
  }
  return ipc;
}

/** 프리로드 IPC로 실제 로컬 API 포트를 받아 baseURL을 만든다. */
export async function getApiBaseUrl(): Promise<string> {
  if (_baseUrl) return _baseUrl;
  const ipc = getIpc();
  const port = await ipc.invoke("getLocalApiPort");
  _baseUrl = `http://127.0.0.1:${port}`;
  console.log("[API] baseURL =", _baseUrl);
  return _baseUrl;
}

/** baseURL을 반영한 axios 인스턴스(캐시) */
export async function getAxios(): Promise<AxiosInstance> {
  if (_axios) return _axios;
  const baseURL = await getApiBaseUrl();
  _axios = axios.create({ baseURL, timeout: 30_000 });
  return _axios;
}

/** 필요 시 강제로 리셋 */
export function resetApiClient() {
  _baseUrl = null;
  _axios = null;
}
