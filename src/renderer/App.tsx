// src/renderer/App.tsx
import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { MyApp } from "./pages/MyApp";
import { E_ScanOutgoing } from "./pages/E_ScanOutgoing_Haeder";
import { E_Interface_Prod } from "./pages/E_Interface_Prod";
import { E_Interface_Total } from "./pages/E_Interface_Total"; // ★ 신규 추가
import { E_Interface_Base_Change } from "./pages/E_Interface_Base_Change";
import E_ScanOutgoing_Re_Print from "./pages/E_ScanOutgoing_Re_Print";

import {
  initI18n,
  useI18nRerender,
  setAppLanguage,
  getCurrentLang,
} from "./utils/i18n";

// [CHG] 워밍업 유틸 추가
import { runWarmupOnceFromRenderer } from "./utils/warmupClient"; // ← 신규 파일 사용

// 메뉴 → 렌더러로 전달되는 문자열을 LangCode로 안전 변환
type LangCodeInferred = Parameters<typeof setAppLanguage>[0];
const ALLOWED: readonly LangCodeInferred[] = [
  "en",
  "ko-KR",
  "vi",
  "zh-Hans",
  "id",
] as const;
function isLangCode(v: string): v is LangCodeInferred {
  return (ALLOWED as readonly string[]).includes(v as LangCodeInferred);
}

function App() {
  const [ready, setReady] = React.useState(false);
  const [langKey, setLangKey] = React.useState<string>(""); // (유지) 필요시 자식 remount

  React.useEffect(() => {
    (async () => {
      await initI18n();               // 번들 로드 + 문서/lang 적용
      setLangKey(getCurrentLang());   // 초기 언어를 key로 설정
      setReady(true);
    })();
  }, []);

  // ✅ Alt 메뉴(Language) 변경 즉시 반영
  React.useEffect(() => {
    const api: any = (window as any).langEvents; // ⬅ preload에서 노출
    if (!api?.onChanged) return;

    const off = api.onChanged(async (code: string) => {
      if (!isLangCode(code)) {
        console.warn("[i18n] Unknown language code from menu:", code);
        return;
      }
      await setAppLanguage(code); // 번들 재로딩 + UI5 로케일 + 문서/dir + notify()
      setLangKey(code);           // (보조) 메모이즈된 자식 강제 갱신용
      // ※ 여기서 window.location.reload()는 사용하지 않음
    });

    return () => { try { off && off(); } catch {} };
  }, []);

  // 내부 notify()를 구독해 최상단 리렌더
  useI18nRerender();

  // [CHG] 렌더러 진입 시 딱 1회 워밍업 (로컬 API / 옵션 IPC 콜드 제거)
  React.useEffect(() => {
    runWarmupOnceFromRenderer().catch(() => {});
  }, []);

  if (!ready) return null;

  return (
    <Router>
      <Routes key={langKey}>
        <Route path="/" element={<MyApp />} />
        <Route path="/outgoing" element={<E_ScanOutgoing />} />
        <Route path="/outgoing/reprint" element={<E_ScanOutgoing_Re_Print />} />
        <Route path="/interface/order" element={<E_Interface_Prod />} />
        <Route path="/interface/change" element={<E_Interface_Base_Change />} />
        <Route path="/interface/total" element={<E_Interface_Total />} /> {/* ★ 신규 라우트 */}
      </Routes>
    </Router>
  );
}

export default App;
