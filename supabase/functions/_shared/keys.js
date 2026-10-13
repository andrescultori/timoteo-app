// Chaves do Supabase nas Edge Functions e nos scripts. Duas gerações convivem:
//   nova:   secret key `sb_secret_...` (não é JWT; vai SÓ no cabeçalho `apikey`) e publishable `sb_publishable_...`;
//   legada: `service_role` e `anon` (JWT; vão em `apikey` e `Authorization: Bearer`). Deixa de valer em 2026 e não pode mais ser girada.
// As funções preferem a nova (variáveis SUPABASE_SECRET_KEYS e SUPABASE_PUBLISHABLE_KEYS, objetos JSON por nome, que o Supabase põe no ambiente
// das funções) e caem na legada (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY) enquanto a nova não existir: assim a migração é reversível.
// `get(nome)` lê uma variável de ambiente (Deno.env.get nas funções, process.env nos scripts).

const named = (json) => {
  if (!json) return null;
  try {
    const o = JSON.parse(json);
    if (typeof o?.default === 'string' && o.default) return o.default;
    return Object.values(o ?? {}).find((v) => typeof v === 'string' && v) ?? null;
  } catch { return null; }
};

export const isNewKey = (k) => typeof k === 'string' && /^sb_(secret|publishable)_/.test(k);

export const secretKey = (get) => named(get('SUPABASE_SECRET_KEYS')) ?? get('SUPABASE_SERVICE_ROLE_KEY') ?? null;
export const publishableKey = (get) => named(get('SUPABASE_PUBLISHABLE_KEYS')) ?? get('SUPABASE_ANON_KEY') ?? null;

// Cabeçalhos de uma chamada com poder de administrador. A secret nova vai só em `apikey` (em `Authorization` o gateway tenta ler como JWT e recusa).
export const adminHeaders = (key, extra = {}) => (isNewKey(key) ? { apikey: key, ...extra } : { apikey: key, Authorization: `Bearer ${key}`, ...extra });
