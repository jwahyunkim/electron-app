import axios from "axios";
import { XMLParser } from "fast-xml-parser";

export interface ConfigType {
  plant: string;
  fac: string;
  line: string;
  mline: string;
  focus: string;
  div: string;
  workcenter: string;
  storage: string;
}

export async function loadMssqlConfig(): Promise<ConfigType | null> {
  try {
    // ✅ Config.xml 파일 불러오기
    const res = await axios.get("/Config.xml", { responseType: "text" });

    // ✅ XML 파서 설정
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      parseTagValue: true
    });

    // ✅ XML → JS 객체로 변환
    const parsed = parser.parse(res.data);

    // ✅ MAIN 태그 추출
    const main = parsed.Base?.MAIN;

    if (!main) {
      console.warn("⚠️ MAIN 태그 없음");
      return null;
    }

    // ✅ ConfigType에 맞게 추출 및 기본값 처리
    const cfg: ConfigType = {
      plant: main.PLANT || "C200",
      fac: main.FAC || "",
      line: main.LINECD || "",
      mline: main.MLINECD || "",
      focus: main.FOCUS || "",
      div: main.DIV || "",
      workcenter: main.WORKCENTER || "2CFSS",
      storage: main.STORAGE || "512C"
    };

    return cfg;
  } catch (err) {
    console.error("❌ MSSQL Config.xml 로드 실패:", err);
    return null;
  }
}
