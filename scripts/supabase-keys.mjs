// Chave secreta do Supabase para os scripts de manutenção (publish-pro, storage-poc, pro-e2e). Só do AMBIENTE do shell, nunca de arquivo.
// Aceita a secret nova (`sb_secret_...`, variável SUPABASE_SECRET_KEY) ou a legada (`service_role`, SUPABASE_SERVICE_ROLE_KEY). A nova vai só no
// cabeçalho `apikey`; a legada também em `Authorization: Bearer` (ver supabase/functions/_shared/keys.js).
import { adminHeaders } from '../supabase/functions/_shared/keys.js';

export { adminHeaders };
export const secretFromEnv = () => {
  const k = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) { console.error('Falta a variável de ambiente SUPABASE_SECRET_KEY (a secret key `sb_secret_...`; a legada SUPABASE_SERVICE_ROLE_KEY ainda é aceita). Ver o cabeçalho do script.'); process.exit(2); }
  return k;
};
