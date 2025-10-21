// src/renderer/main.tsx  (파일명이 index.tsx면 동일하게 적용)
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// [CHG] initI18n 중복 제거: App.tsx가 책임지므로 import 삭제
// import { initI18n } from "./utils/i18n";

async function bootstrap() {
  // [CHG] 번들 선로딩 제거 (App 내부에서 처리)
  // await initI18n();

  const container = document.getElementById("root");
  if (!container) throw new Error("Root container missing");
  const root = createRoot(container);
  root.render(<App />);
}

bootstrap();
