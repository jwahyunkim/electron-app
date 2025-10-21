import axios from "axios";
import { XMLParser } from "fast-xml-parser";

export async function loadConfig() {
  try {
    const res = await axios.get("/Config.xml", { responseType: "text" });
     // ✅ 콘솔 디버깅용 로그 추가
    // console.log("📥 Config.xml 원문:", res.data);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      parseTagValue: true
    });

    const parsed = parser.parse(res.data);

     
    // // ✅ 여기서 구조 확인
    // console.log("✅ XML 파싱 결과 전체:", parsed);
    // console.log("✅ MAIN 객체:", parsed.Base?.MAIN);

    // ✅ MAIN 태그만 리턴
    return parsed.Base.MAIN || {};
  } catch (err) {
    console.error("❌ Config.xml 로드 실패:", err);
    return null;
  }
}
