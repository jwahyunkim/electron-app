import React from "react";
import { getCurrentLang, setAppLanguage, t } from "../utils/i18n";

const LANGS = [
  { value: "ko-KR", label: "한국어" },
  { value: "en",    label: "English" },
  { value: "vi",    label: "Tiếng Việt" },
  { value: "zh-Hans", label: "简体中文" },
  { value: "id",    label: "Indonesia" },
] as const;

export default function LangSwitcher() {
  const [lang, setLang] = React.useState(getCurrentLang());
  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as (typeof LANGS)[number]["value"];
    setLang(v);
    await setAppLanguage(v); // 저장 + 즉시 전환 + 리렌더 통지
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fff", padding:"6px 10px", borderRadius:8, boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
      <span style={{ opacity:.7, fontSize:12 }}>{t("app.common.language", { defaultValue:"Language" })}</span>
      <select value={lang} onChange={onChange} style={{ padding:"4px 8px" }}>
        {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
    </div>
  );
}
