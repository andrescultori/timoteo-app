// Respostas HTTP e CORS das Edge Functions chamadas pelo app (o webhook não usa CORS).
export function corsHeaders(req, appUrl) {
  const origin = req.headers.get('origin');
  const allowed = new Set([appUrl.replace(/\/+$/, ''), 'http://localhost:5173']);
  return {
    'Access-Control-Allow-Origin': origin && allowed.has(origin) ? origin : appUrl.replace(/\/+$/, ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export const bearer = (req) => (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || null;

// Compara dois segredos em tempo constante: compara os SHA-256 dos dois (o tamanho do segredo também não vaza).
// Sem segredo configurado ou sem segredo recebido, nunca confere.
export async function secretMatches(provided, expected) {
  if (!provided || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([provided, expected].map(async (v) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(v)))));
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
