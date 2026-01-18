export type Env = {
  DB: D1Database;
};

export function corsHeaders(): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type,Accept");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const h = corsHeaders();
  h.set("Content-Type", "application/json; charset=utf-8");
  if (extraHeaders) {
    const eh = new Headers(extraHeaders);
    eh.forEach((v, k) => h.set(k, v));
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function optionsOk(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function nowUtcIso(): string {
  return new Date().toISOString();
}

/**
 * ISO UTC文字列 (toISOString) をチェックして Date に変換
 */
export function asUtcIso(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${field} is required`);
  const s = v.trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`${field} must be a valid ISO datetime`);
  return d.toISOString(); // 正規化
}

function jstPartsFromDate(dt: Date): {year:string; month:string; day:string; hour:string; minute:string; second:string} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(dt);
  const get = (t: string) => (parts.find(p => p.type === t)?.value ?? "");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
}

/**
 * registered_at_utc (ISO) から、表示用 registered_at_jst (YYYY-MM-DD HH:mm:ss) を生成
 */
export function formatJstDateTimeFromUtcIso(registeredAtUtcIso: string): string {
  const dt = new Date(registeredAtUtcIso);
  if (Number.isNaN(dt.getTime())) throw new Error("registered_at_utc must be a valid ISO datetime");
  const p = jstPartsFromDate(dt);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/**
 * registered_at_utc (ISO) から yyyymmdd を生成（JST基準）
 */
export function yyyymmddFromUtcIso(registeredAtUtcIso: string): string {
  const dt = new Date(registeredAtUtcIso);
  if (Number.isNaN(dt.getTime())) throw new Error("registered_at_utc must be a valid ISO datetime");
  const p = jstPartsFromDate(dt);
  return `${p.year}${p.month}${p.day}`;
}

/**
 * registered_at_jst: "YYYY-MM-DD HH:mm:ss" (JST) を想定
 * そこから yyyymmdd を作る
 */
export function yyyymmddFromRegisteredAtJst(registeredAtJst: string): string {
  if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(registeredAtJst)) {
    throw new Error("registered_at_jst must be 'YYYY-MM-DD HH:mm:ss' (JST)");
  }
  const y = registeredAtJst.slice(0, 4);
  const m = registeredAtJst.slice(5, 7);
  const d = registeredAtJst.slice(8, 10);
  return `${y}${m}${d}`;
}

/**
 * 税率別小計に対して税額を計算（1円未満は切り上げ）
 * taxRate: 8 or 10
 */
export function calcTaxCeil(subtotalExcl: number, taxRate: 8 | 10): number {
  // ceil(subtotalExcl * taxRate / 100)
  return Math.ceil((subtotalExcl * taxRate) / 100);
}

export function asNonEmptyString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${field} is required`);
  return v.trim();
}

export function asInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) {
    throw new Error(`${field} must be an integer`);
  }
  return v;
}

export function asTaxRate(v: unknown, field: string): 8 | 10 {
  const n = asInt(v, field);
  if (n !== 8 && n !== 10) throw new Error(`${field} must be 8 or 10`);
  return n as 8 | 10;
}

export function sanitizeReceiptNo(receiptNo: string): string {
  return receiptNo.trim().replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * registered_at_jst: "YYYY-MM-DD HH:mm:ss" (JST固定) を UTC ISO文字列に変換
 * - JSTは常にUTC+9（DSTなし）として扱う
 */
export function utcIsoFromRegisteredAtJst(registeredAtJst: string): string {
  if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(registeredAtJst)) {
    throw new Error("registered_at_jst must be 'YYYY-MM-DD HH:mm:ss' (JST)");
  }
  const y = Number(registeredAtJst.slice(0, 4));
  const m = Number(registeredAtJst.slice(5, 7));
  const d = Number(registeredAtJst.slice(8, 10));
  const hh = Number(registeredAtJst.slice(11, 13));
  const mm = Number(registeredAtJst.slice(14, 16));
  const ss = Number(registeredAtJst.slice(17, 19));

  // JST(UTC+9) -> UTC
  const ms = Date.UTC(y, m - 1, d, hh - 9, mm, ss);
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) throw new Error("registered_at_jst must be a valid datetime");
  return dt.toISOString();
}
