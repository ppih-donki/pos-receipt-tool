import { Env, json, optionsOk } from "../_shared";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") return optionsOk();
  if (request.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").trim();

  if (!code) return json({ error: "code is required" }, 400);
  if (!/^\d{1,13}$/.test(code)) return json({ error: "code must be 1-13 digits" }, 400);

  const row = await env.DB.prepare(
    `SELECT
      product_code,
      product_category,
      product_name,
      pos_cost,
      price_excl,
      tax_rate
     FROM products
     WHERE product_code = ?`
  ).bind(code).first();

  if (!row) return json({ error: "NOT_FOUND" }, 404);

  return json({ product: row });
};
