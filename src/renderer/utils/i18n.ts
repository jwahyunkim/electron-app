// src/renderer/utils/i18n.ts
// - window.i18n(getLang/setLang/getBundle) 구조에 맞춰 언어 전환/저장/리렌더 기능
// - 기본 번들 경로: ./locales/<lang>/lang.json (preload 미제공 시 직접 fetch)

import * as React from "react";

type LangCode = "en" | "ko-KR" | "vi" | "zh-Hans" | "id";

let currentLang: LangCode = "ko-KR";
let bundle: Record<string, string> = {};
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => { try { fn(); } catch {} });
}

function toUi5Lang(lang: string) {
  const map: Record<string, string> = {
    "ko-KR": "ko",
    en: "en",
    vi: "vi",
    "zh-Hans": "zh-CN",
    id: "id",
  };
  return map[lang] || "en";
}

// 프리로드(i18n.getBundle)가 있으면 그것 우선, 없으면 직접 fetch
async function fetchBundleFor(lang: LangCode) {
  // 1) preload 경유
  try {
    const maybe = await window.i18n?.getBundle?.();
    if (maybe && typeof maybe === "object") {
      return maybe as Record<string, string>;
    }
  } catch {}
  // 2) 직접 fetch (개발/패키징 모두 상대 경로 사용)
  const url = `./locales/${lang}/lang.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`i18n bundle load failed: ${url}`);
  return (await res.json()) as Record<string, string>;
}

export async function initI18n(lang?: LangCode) {
  try {
    // 우선순위: 명시 lang > 저장된 lang > 기본 ko-KR
    const saved = await window.i18n?.getLang?.();
    currentLang = (lang || saved || "ko-KR") as LangCode;

    // 번들 로드
    bundle = await fetchBundleFor(currentLang);

    // UI5 로케일 동기화
    try {
      const { setLanguage } = await import("@ui5/webcomponents-base/dist/config/Language.js");
      await setLanguage(toUi5Lang(currentLang));
    } catch {}

    // 문서 lang/dir
    document.documentElement.lang = currentLang;
    document.documentElement.dir = ["ar", "he", "fa", "ur"].some((p) => currentLang.startsWith(p)) ? "rtl" : "ltr";
  } catch (e) {
    console.error("❌ i18n 초기화 실패:", e);
    bundle = {};
  }
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function t(key: string, params?: Record<string, string | number>) {
  let raw = bundle[key] ?? key;
  if (!params) return raw;
  for (const [k, v] of Object.entries(params)) {
    const re = new RegExp(`\\{${escapeRegExp(k)}\\}`, "g");
    raw = raw.replace(re, String(v));
  }
  return raw;
}

export async function setAppLanguage(lang: LangCode) {
  if (!lang || lang === currentLang) return;

  // 1) 메인에 저장(IPC) → i18n:getBundle가 이 lang을 기준으로 응답하게 됨
  try { await window.i18n?.setLang?.(lang); } catch {}

  // 2) 최신 번들 재로딩
  currentLang = lang;
  try {
    bundle = await fetchBundleFor(lang);
  } catch (e) {
    console.error("❌ 번들 재로딩 실패:", e);
    bundle = {};
  }

  // 3) UI5 로케일 동기화
  try {
    const { setLanguage } = await import("@ui5/webcomponents-base/dist/config/Language.js");
    await setLanguage(toUi5Lang(lang));
  } catch {}

  // 4) 문서 lang/dir
  document.documentElement.lang = lang;
  document.documentElement.dir = ["ar", "he", "fa", "ur"].some((p) => lang.startsWith(p)) ? "rtl" : "ltr";

  // 5) 구독자 리렌더
  notify();
}

export function getCurrentLang() {
  return currentLang;
}

/** 언어 변경 시 전체 화면 리렌더를 유도하는 간단한 훅 */
export function useI18nRerender() {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const cb = () => setTick((x) => x + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); }; // boolean 반환 방지(꼭 블록으로!)
  }, []);
}
