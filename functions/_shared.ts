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
