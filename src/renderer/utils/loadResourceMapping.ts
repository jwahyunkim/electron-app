export async function loadResourceMapping(): Promise<Record<string, string>> {
  try {
    const res = await fetch("/resource_mapping.json");
    if (!res.ok) throw new Error("Failed to load mapping file");
    return await res.json();
  } catch (err) {
    console.error("❌ 매핑 로딩 실패:", err);
    return {};
  }
}
