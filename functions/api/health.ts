import { json, optionsOk } from "../_shared";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") return optionsOk();
  return json({ ok: true });
};
