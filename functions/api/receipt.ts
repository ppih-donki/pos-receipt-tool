import { Env, json, optionsOk, sanitizeReceiptNo } from "../_shared";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") return optionsOk();
  if (request.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

  const url = new URL(request.url);
  const date = (url.searchParams.get("date") || "").trim(); // YYYY-MM-DD
  const receiptNo = (url.searchParams.get("receipt_no") || "").trim();

  if (!date || !receiptNo) return json({ error: "date and receipt_no are required" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);

  const yyyymmdd = date.replaceAll("-", "");
  const safeReceipt = sanitizeReceiptNo(receiptNo);
  const transactionId = `${yyyymmdd}_${safeReceipt}`;

  const header = await env.DB.prepare(
    `SELECT
      transaction_id, yyyymmdd, receipt_no, registered_at_jst,
      subtotal_excl_8, tax_8, subtotal_incl_8,
      subtotal_excl_10, tax_10, subtotal_incl_10,
      total_incl
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
      transaction_id: header.transaction_id,
      receipt_no: header.receipt_no,
      registered_at_jst: header.registered_at_jst,
      items,
      tax_summary: [
        {
          tax_rate: 8,
          subtotal_excl: header.subtotal_excl_8,
          tax_amount: header.tax_8,
          subtotal_incl: header.subtotal_incl_8
        },
        {
          tax_rate: 10,
          subtotal_excl: header.subtotal_excl_10,
          tax_amount: header.tax_10,
          subtotal_incl: header.subtotal_incl_10
        }
      ],
      total_incl: header.total_incl
    }
  });
};
