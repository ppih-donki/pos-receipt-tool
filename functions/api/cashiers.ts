import { Env, json, optionsOk } from "../_shared";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") return optionsOk();
  if (request.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

  const { results } = await env.DB.prepare(
    "SELECT cashier_name FROM cashiers ORDER BY cashier_name"
  ).all();

  return json({ cashiers: results });
};
