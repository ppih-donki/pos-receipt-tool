import { Env, json, optionsOk, sanitizeReceiptNo } from "../_shared";

type D1TableInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") return optionsOk();
  if (request.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

  try {
    const url = new URL(request.url);
    const date = (url.searchParams.get("date") || url.searchParams.get("purchase_date") || "").trim(); // YYYY-MM-DD
    const receiptNo = (url.searchParams.get("receipt_no") || "").trim();

    if (!date || !receiptNo) return json({ error: "date and receipt_no are required" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);

    const yyyymmdd = date.replaceAll("-", "");
    const safeReceipt = sanitizeReceiptNo(receiptNo);
    const transactionId = `${yyyymmdd}_${safeReceipt}`;

    // Align with the actual D1 schema (some environments may have slightly different column sets)
    const tableInfo = await env.DB.prepare("PRAGMA table_info(transactions);").all<D1TableInfoRow>();
    const colNames = new Set((tableInfo?.results ?? []).map(r => String(r.name)));

    const selectCols: string[] = [
      "transaction_id",
      "yyyymmdd",
      "receipt_no",
      "subtotal_excl_8",
      "tax_8",
      "subtotal_incl_8",
      "subtotal_excl_10",
      "tax_10",
      "subtotal_incl_10",
      "total_incl"
    ];
    if (colNames.has("registered_at_jst")) selectCols.splice(3, 0, "registered_at_jst");
    if (colNames.has("registered_at_utc")) selectCols.splice(3, 0, "registered_at_utc");

    const header = await env.DB.prepare(
      `SELECT ${selectCols.join(", ")}
       FROM transactions
       WHERE transaction_id = ?`
    ).bind(transactionId).first();

    if (!header) return json({ error: "NOT_FOUND" }, 404);

    const { results: items } = await env.DB.prepare(
      `SELECT product_name, qty, price_excl, line_amount_excl, tax_rate
       FROM transaction_items
       WHERE transaction_id = ?
       ORDER BY id ASC`
    ).bind(transactionId).all();

    return json({
      ok: true,
      receipt: {
        transaction_id: (header as any).transaction_id,
        receipt_no: (header as any).receipt_no,
        registered_at_utc: colNames.has("registered_at_utc") ? (header as any).registered_at_utc : null,
        registered_at_jst: colNames.has("registered_at_jst") ? (header as any).registered_at_jst : null,
        items,
        tax_summary: [
          {
            tax_rate: 8,
            subtotal_excl: (header as any).subtotal_excl_8 ?? 0,
            tax_amount: (header as any).tax_8 ?? 0,
            subtotal_incl: (header as any).subtotal_incl_8 ?? 0
          },
          {
            tax_rate: 10,
            subtotal_excl: (header as any).subtotal_excl_10 ?? 0,
            tax_amount: (header as any).tax_10 ?? 0,
            subtotal_incl: (header as any).subtotal_incl_10 ?? 0
          }
        ],
        total_incl: (header as any).total_incl ?? 0
      }
    });
  } catch (e) {
    return json({ error: (e as Error).message || "UNKNOWN_ERROR" }, 500);
  }
};
