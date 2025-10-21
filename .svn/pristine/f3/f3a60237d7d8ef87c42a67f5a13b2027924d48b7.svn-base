// src/types/global.d.ts

// ── 자산 모듈 선언 ─────────────────────────────────────
declare module "*.png" { const value: string; export default value; }
declare module "*.jpg" { const value: string; export default value; }
declare module "*.jpeg" { const value: string; export default value; }
declare module "*.gif" { const value: string; export default value; }
declare module "*.svg" { const value: string; export default value; }
declare module "*.png?asset" { const value: string; export default value; }
declare module "*.svg?asset" { const value: string; export default value; }
declare module "*.xml" { const value: string; export default value; }

// 전역 타입 초기화(모듈 스코프 보장)
export {};

// ── Electron 타입 보강 (버전별 누락 필드 호환)
declare module "electron" {
  interface PrinterInfo {
    /** 일부 Electron 버전에 존재하는 기본 프린터 표시 */
    isDefault?: boolean;
    /** Windows 등에서 표시용 이름 */
    displayName?: string;
    /** 플랫폼별 상태 코드 */
    status?: number;
  }
}

/** ✅ 최소 IPC 타입 (invoke만 사용) */
type IpcRendererLike = {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
};

declare global {
  type LangCode = "en" | "ko-KR" | "vi" | "zh-Hans" | "id";

  interface I18nAPI {
    getLang: () => Promise<LangCode>;
    setLang: (lang: LangCode) => Promise<boolean>;
    getBundle: () => Promise<Record<string, string>>;
  }

  /** 프리로드가 내려주는 PASSCARD 인쇄 옵션(확정형) */
  type PasscardPrintOptions = {
    deviceName: string;
    preview: boolean;
    widthMicrons: number;
    heightMicrons: number;
    /** ✅ 미리보기도 1회 출력으로 카운트/인쇄완료 처리할지 여부 */
    previewCountAsPrint?: boolean;
  };

  /** 메인 프로세스의 인쇄 IPC가 반환하는 표준 ACK */
  type PrintAck = {
    ok: boolean;
    accepted?: number;
    mode?: "preview" | "silent";
    error?: string;
    printed?: number;
  };

  type DbConfig = {
    db: { user: string; password: string; host: string; database: string; };
    plant_cd: string; zone_cd?: string;
  };

  /** 메인→렌더러 로그 브리지 메시지 포맷 */
  type PasscardLogMsg = {
    tag: string;
    payload: any;
    level: "info" | "warn" | "error";
    ts: string; // ISO8601
  };

  interface Window {
    electron: any;

    api: {
      getConfig: () => Promise<any | null>;
      getDbConfig?: () => Promise<DbConfig | null>;
      getLocalApiPort?: () => Promise<number>;
    };

    config: {
      get: () => Promise<any | null>;
      /** 프리로드에서 읽은 PASSCARD 옵션 반환 (미리보기 카운트 포함) */
      getPasscardOptions?: () => Promise<PasscardPrintOptions>;
      /** (선택) 런타임 강제 오버라이드: 미리보기 강제 on/off */
      setPreviewOverride?: (v?: boolean) => void;
      /** (선택) 런타임 강제 오버라이드: 미리보기도 카운트 강제 on/off */
      setPreviewCountAsPrintOverride?: (v?: boolean) => void;
      /** (호환) 이전 이름을 썼을 수 있으므로 유지 */
      setPasscardPreviewOverride?: (v: boolean) => void;
      setPasscardPreviewCountAsPrintOverride?: (v: boolean) => void;

      /** 🔍 추가: 메인 컨피그/리로드 헬퍼 (편의용) */
      getMainConfigInfo?: () => Promise<{ ok: true; file: string; cfg: any }>;
      reloadMainConfig?: () => Promise<any>;
      listPrinters?: () => Promise<Electron.PrinterInfo[]>;
    };

    i18n?: I18nAPI;

    /** ⚠️ 구호환: 사용 지양(브라우저 window.print와 충돌 가능). 타입만 유지 */
    print?: {
      passcards: (
        jobs: any[],
        options?: Partial<PasscardPrintOptions>
      ) => Promise<PrintAck>;
    };

    /** ✅ 권장 별칭 */
    printBridge?: {
      passcards: (
        jobs: any[],
        options?: Partial<PasscardPrintOptions>
      ) => Promise<PrintAck>;
    };
    /** 선택: 짧은 별칭 */
    passcard?: Window["printBridge"];

    /** 단일 프린트 + (옵션) 프린터 목록 */
    printer?: {
      printPasscard: (opts: {
        deviceName?: string;
        pageSize?: { widthMM: number; heightMM: number };
        url?: string;
        preview?: boolean;
      }) => Promise<PrintAck>;
      list?: () => Promise<Electron.PrinterInfo[]>;
    };

    /** 🧩 공용 IPC 브리지 — 확정형으로 선언 (TS가 undefined로 보지 않도록) */
    ipc: IpcRendererLike;

    /** 🔔 언어 변경 이벤트 */
    langEvents?: {
      onChanged: (cb: (code: string) => void) => () => void;
    };

    /** 🧩 추가: 메인→렌더러 로그 구독 유틸 (선택) */
    logs?: {
      /** 구독 시작: 반환되는 함수 호출 시 구독 해제 */
      onPasscardLog: (cb: (msg: PasscardLogMsg) => void) => () => void;
    };
  }
}
