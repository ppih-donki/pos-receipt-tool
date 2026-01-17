import { corsHeaders, optionsOk } from "./_shared";

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return optionsOk();
  }

  const res = await context.next();

  const h = new Headers(res.headers);
  const cors = corsHeaders();
  cors.forEach((v, k) => h.set(k, v));

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: h
  });
};
