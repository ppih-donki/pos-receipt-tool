import {
  Env,
  json,
  optionsOk,
  nowUtcIso,
  yyyymmddFromRegisteredAtJst,
  calcTaxCeil,
  asNonEmptyString,
  asInt,
  asTaxRate,
  sanitizeReceiptNo
} from "../_shared";

type ItemIn = {
  product_code: string;
  product_category?: string | null;
  product_name: string;
  pos_cost?: number | null;
  price_excl: number;
  tax_rate: 8 | 10;
  qty: number;
};

type BodyIn = {
  receipt_no: string;
  registered_at_jst: string; // "YYYY-MM-DD HH:mm:ss" (JST)
  cashier_name: string;
  items: ItemIn[];
};

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
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  let body: BodyIn;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    const receiptNo = asNonEmptyString(body.receipt_no, "receipt_no");
    const registeredAtJst = asNonEmptyString(body.registered_at_jst, "registered_at_jst");
    const cashierName = asNonEmptyString(body.cashier_name, "cashier_name");

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new Error("items must be a non-empty array");
    }

    const yyyymmdd = yyyymmddFromRegisteredAtJst(registeredAtJst);
    const safeReceipt = sanitizeReceiptNo(receiptNo);
    const transactionId = `${yyyymmdd}_${safeReceipt}`;

    // Validate items and compute line totals (tax is not per-line)
    const items = body.items.map((it, idx) => {
      const productCode = asNonEmptyString(it.product_code, `items[${idx}].product_code`);
      if (!/^\d{1,13}$/.test(productCode)) throw new Error(`items[${idx}].product_code must be 1-13 digits`);

      const productName = asNonEmptyString(it.product_name, `items[${idx}].product_name`);
      const productCategory = (typeof it.product_category === "string" ? it.product_category : null);

      const priceExcl = asInt(it.price_excl, `items[${idx}].price_excl`);
      const qty = asInt(it.qty, `items[${idx}].qty`);
      if (qty < 1) throw new Error(`items[${idx}].qty must be >= 1`);
      if (priceExcl < 0) throw new Error(`items[${idx}].price_excl must be >= 0`);

      const taxRate = asTaxRate(it.tax_rate, `items[${idx}].tax_rate`);
      const posCost = (it.pos_cost === null || it.pos_cost === undefined) ? null : asInt(it.pos_cost, `items[${idx}].pos_cost`);

      const lineAmountExcl = priceExcl * qty;

      return {
        product_code: productCode,
        product_category: productCategory,
        product_name: productName,
        pos_cost: posCost,
        price_excl: priceExcl,
        tax_rate: taxRate,
        qty,
        line_amount_excl: lineAmountExcl
      };
    });

    // Tax summary (subtotal-based, ceil)
    const subtotalExcl8 = items.filter(i => i.tax_rate === 8).reduce((a,b)=>a+b.line_amount_excl, 0);
    const subtotalExcl10 = items.filter(i => i.tax_rate === 10).reduce((a,b)=>a+b.line_amount_excl, 0);

    const tax8 = calcTaxCeil(subtotalExcl8, 8);
    const tax10 = calcTaxCeil(subtotalExcl10, 10);

    const subtotalIncl8 = subtotalExcl8 + tax8;
    const subtotalIncl10 = subtotalExcl10 + tax10;
    const totalIncl = subtotalIncl8 + subtotalIncl10;
    const totalExcl = subtotalExcl8 + subtotalExcl10;

    const createdAtUtc = nowUtcIso();

    // Prevent duplicates
    const exists = await env.DB.prepare(
      "SELECT transaction_id FROM transactions WHERE transaction_id = ?"
    ).bind(transactionId).first();

    if (exists) {
      return json({ error: "ALREADY_REGISTERED", transaction_id: transactionId }, 409);
    }

    const stmts: D1PreparedStatement[] = [];

    // Align with the actual D1 schema (some environments may have slightly different column sets)
    const tableInfo = await env.DB.prepare("PRAGMA table_info(transactions);").all<D1TableInfoRow>();
    const colNames = new Set((tableInfo?.results ?? []).map(r => String(r.name)));

    const txCols: string[] = [
      "transaction_id",
      "yyyymmdd",
      "receipt_no",
      "cashier_name",
      "total_incl",
      "subtotal_excl_8",
      "tax_8",
      "subtotal_incl_8",
      "subtotal_excl_10",
      "tax_10",
      "subtotal_incl_10",
      "created_at_utc"
    ];
    const txVals: unknown[] = [
      transactionId,
      yyyymmdd,
      receiptNo,
      cashierName,
      totalIncl,
      subtotalExcl8,
      tax8,
      subtotalIncl8,
      subtotalExcl10,
      tax10,
      subtotalIncl10,
      createdAtUtc
    ];

    if (colNames.has("registered_at_jst")) {
      txCols.splice(3, 0, "registered_at_jst");
      txVals.splice(3, 0, registeredAtJst);
    }

    // If the schema has total_excl, populate it (NOT NULL in some versions)
    if (colNames.has("total_excl")) {
      // put it next to total_incl for readability
      const idx = txCols.indexOf("total_incl");
      txCols.splice(idx + 1, 0, "total_excl");
      txVals.splice(idx + 1, 0, totalExcl);
    }

    // If the schema has registered_at_utc, store UTC machine time (createdAtUtc)
    if (colNames.has("registered_at_utc")) {
      const insertAfter = txCols.indexOf("receipt_no");
      txCols.splice(insertAfter + 1, 0, "registered_at_utc");
      txVals.splice(insertAfter + 1, 0, createdAtUtc);
    }

    const placeholders = txCols.map(() => "?").join(", ");
    stmts.push(
      env.DB.prepare(
        `INSERT INTO transactions (${txCols.join(", ")}) VALUES (${placeholders})`
      ).bind(...txVals)
    );

    for (const it of items) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO transaction_items (
            transaction_id,
            product_code, product_category, product_name,
            pos_cost, price_excl, qty, line_amount_excl, tax_rate,
            created_at_utc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          transactionId,
          it.product_code, it.product_category, it.product_name,
          it.pos_cost, it.price_excl, it.qty, it.line_amount_excl, it.tax_rate,
          createdAtUtc
        )
      );
    }

    await env.DB.batch(stmts);

    return json({
      ok: true,
      transaction_id: transactionId,
      totals: {
        subtotal_excl_8: subtotalExcl8,
        tax_8: tax8,
        subtotal_incl_8: subtotalIncl8,
        subtotal_excl_10: subtotalExcl10,
        tax_10: tax10,
        subtotal_incl_10: subtotalIncl10,
        total_incl: totalIncl
      }
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
