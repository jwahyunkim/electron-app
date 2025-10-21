export function format(date = new Date(), pattern: "YYYYMMDD" | "YYYYMMDD HHmmss" | "YYYY-MM-DD HH:mm:ss") {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const H = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  if (pattern === "YYYYMMDD") return `${y}${M}${d}`;
  if (pattern === "YYYYMMDD HHmmss") return `${y}${M}${d} ${H}${m}${s}`;
  return `${y}-${M}-${d} ${H}:${m}:${s}`;
}
