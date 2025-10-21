// src/renderer/utils/upsertNormalize.ts
export function normalizeUpsertResp(data: any, expected: number) {
  let inserted = Number(data?.insertedCount ?? data?.inserted ?? 0);
  let updated  = Number(data?.updatedCount  ?? data?.updated  ?? 0);
  let ack = inserted + updated;

  // rowsAffected / rowCount 지원
  const ra = data?.rowsAffected ?? data?.rowCount;
  if (!ack) {
    if (Array.isArray(ra)) ack = Number(ra[0] ?? 0);
    else if (typeof ra === "number") ack = ra;
  }

  // message에서 “N건” 추출 (예: ✅ 1건 업서트 완료)
  if (!ack && typeof data?.message === "string") {
    const m = data.message.match(/(\d+)\s*건/);
    if (m) ack = Number(m[1]);
  }

  const okFlag = data?.ok === true;
  const ok = okFlag || ack >= expected; // 기대 건수만큼 반영되면 성공
  return { ok, ack, inserted, updated, raw: data };
}
