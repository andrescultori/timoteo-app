// Leitura do conteúdo Pro no Supabase Storage (bucket privado `pro`, prefixo v1/). Só com VITE_PRO_SOURCE=storage.
// O acesso é decidido pelo BANCO (política do bucket, ver supabase/migrations/20261018000000_fase3b_bucket_pro.sql): sem direito, o Storage
// responde 400 (ou 401/403/404) e aqui isso vira `null` ("sem acesso"), nunca erro de tela. Rede fora do ar ou erro do servidor lança.
import { getClient } from '../auth.js';

const DENIED = new Set([400, 401, 403, 404]);

// Leitor da cópia offline (registrado por src/data/proOffline.js): devolve o valor guardado, ou undefined para ir à rede.
let stored = async () => undefined;
export const setStoredReader = (fn) => { stored = fn; };

export async function fetchProKey(key) {
  try { const hit = await stored(key); if (hit !== undefined) return hit; } catch { /* cópia ilegível: vai à rede */ }
  return fetchProNet(key);
}

// Sempre da rede (o sync usa esta; a leitura das telas usa fetchProKey).
export async function fetchProNet(key) {
  const client = await getClient();
  if (!client) return null; // sem Supabase configurado: ninguém tem Pro
  const { data, error } = await client.storage.from('pro').download(`v1/${key}`);
  if (error) {
    const status = Number(error.status ?? error.statusCode ?? error.originalError?.status);
    if (DENIED.has(status)) return null;
    throw new Error(`Storage: ${error.message ?? status}`);
  }
  return JSON.parse(await data.text());
}
