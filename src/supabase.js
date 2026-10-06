import { createClient } from '@supabase/supabase-js';

// Cliente do Supabase (projeto dedicado do Timóteo App). Só existe se as duas variáveis estiverem definidas; sem elas o app
// funciona como antes, só no aparelho, sem erro. A chave é a publishable (pública por natureza); nunca coloque aqui a service_role.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
