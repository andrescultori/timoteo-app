// Testes da escolha de chaves do Supabase (supabase/functions/_shared/keys.js) e de como o createDb as envia. Roda no `npm test`.
import assert from 'node:assert/strict';
import { secretKey, publishableKey, adminHeaders, isNewKey } from '../supabase/functions/_shared/keys.js';
import { createDb } from '../supabase/functions/_shared/db.js';

const env = (o) => (k) => o[k];
let n = 0;
const t = async (fn) => { await fn(); n += 1; };

await t(() => {
  assert.equal(secretKey(env({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_abc"}', SUPABASE_SERVICE_ROLE_KEY: 'eyJleg' })), 'sb_secret_abc', 'prefere a secret nova');
  assert.equal(secretKey(env({ SUPABASE_SECRET_KEYS: '{"billing":"sb_secret_b","default":"sb_secret_d"}' })), 'sb_secret_d', 'usa a chave `default`');
  assert.equal(secretKey(env({ SUPABASE_SECRET_KEYS: '{"billing":"sb_secret_b"}' })), 'sb_secret_b', 'sem `default`, usa a primeira');
  assert.equal(secretKey(env({ SUPABASE_SERVICE_ROLE_KEY: 'eyJleg' })), 'eyJleg', 'sem a nova, cai na legada');
  assert.equal(secretKey(env({ SUPABASE_SECRET_KEYS: 'não é json', SUPABASE_SERVICE_ROLE_KEY: 'eyJleg' })), 'eyJleg', 'JSON inválido cai na legada');
  assert.equal(secretKey(env({ SUPABASE_SECRET_KEYS: '{}' })), null, 'objeto vazio e sem legada: nada');
  assert.equal(secretKey(env({})), null);
  assert.equal(publishableKey(env({ SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_x"}', SUPABASE_ANON_KEY: 'eyJanon' })), 'sb_publishable_x');
  assert.equal(publishableKey(env({ SUPABASE_ANON_KEY: 'eyJanon' })), 'eyJanon');
});

await t(() => {
  assert.deepEqual(adminHeaders('sb_secret_abc', { 'Content-Type': 'application/json' }), { apikey: 'sb_secret_abc', 'Content-Type': 'application/json' }, 'a secret nova vai só em apikey');
  assert.deepEqual(adminHeaders('eyJleg'), { apikey: 'eyJleg', Authorization: 'Bearer eyJleg' }, 'a legada também em Authorization');
  assert.ok(isNewKey('sb_publishable_x') && isNewKey('sb_secret_x') && !isNewKey('eyJleg') && !isNewKey(null));
});

// createDb com fetch simulado: confere cabeçalhos e rotas
const withFetch = async (fn) => {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), headers: init.headers ?? {}, method: init.method ?? 'GET' }); return new Response(JSON.stringify(String(url).includes('/auth/v1/user') ? { id: 'u1', email: 'a@b.c' } : [{ plan: 'pro' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try { await fn(calls); } finally { globalThis.fetch = real; }
};

await t(() => withFetch(async (calls) => {
  const db = createDb({ url: 'https://x.supabase.co', serviceKey: 'sb_secret_abc', publishableKey: 'sb_publishable_p' });
  await db.getEntitlement('u1');
  await db.deleteAuthUser('u1');
  const u = await db.getUser('jwt-do-usuario');
  assert.deepEqual(u, { id: 'u1', email: 'a@b.c' });
  const [rest, del, user] = calls;
  assert.equal(rest.headers.apikey, 'sb_secret_abc'); assert.equal(rest.headers.Authorization, undefined, 'secret nova nunca em Authorization (PostgREST)');
  assert.equal(del.headers.apikey, 'sb_secret_abc'); assert.equal(del.headers.Authorization, undefined, 'secret nova nunca em Authorization (Auth admin)');
  assert.equal(user.headers.apikey, 'sb_publishable_p'); assert.equal(user.headers.Authorization, 'Bearer jwt-do-usuario', 'o JWT do usuário vai em Authorization, com a publishable em apikey');
}));

await t(() => withFetch(async (calls) => {
  const db = createDb({ url: 'https://x.supabase.co', serviceKey: 'eyJlegada' });
  await db.getEntitlement('u1');
  await db.getUser('jwt-do-usuario');
  assert.equal(calls[0].headers.Authorization, 'Bearer eyJlegada', 'a legada segue como antes');
  assert.equal(calls[1].headers.apikey, 'eyJlegada', 'sem publishable, o getUser usa a chave que tem (como antes)');
}));

console.log(`OK: ${n} testes das chaves do Supabase passaram.`);
