// Testes do Pro offline (src/data/proSyncCore.js) com um armazenamento falso e um "Storage" simulado.
import assert from 'node:assert/strict';
import { createProSync } from '../src/data/proSyncCore.js';

const mkStore = () => {
  const files = new Map(); let meta = null;
  return { files, getMeta: async () => meta, setMeta: async (v) => { meta = structuredClone(v); }, get: async (k) => files.get(k), put: async (k, v) => { files.set(k, structuredClone(v)); }, delete: async (k) => { files.delete(k); }, clear: async () => { files.clear(); meta = null; } };
};
const remote = (data, sha = {}) => {
  const calls = [];
  const manifest = () => ({ files: Object.fromEntries(Object.keys(data).filter((k) => k !== 'manifest.json').map((k) => [k, { sha256: sha[k] ?? `h-${k}`, bytes: 10 }])) });
  return { calls, data, sha, fetchNet: async (k) => { calls.push(k); if (k === 'manifest.json') return manifest(); return k in data ? structuredClone(data[k]) : null; } };
};
const pro = { userId: 'u1', level: 'pro' };
const admin = { userId: 'u1', level: 'admin' };
const pkg = { 'people.json': [1], 'timeline.json': { a: 1 }, 'info/gen.json': { x: 1 }, 'interlinear/43.json': [2], 'admin/scholarly.json': { s: 1 } };

{ // primeira cópia: Pro não leva admin/*
  const st = mkStore(); const r = remote({ ...pkg }); const c = createProSync({ store: st, fetchNet: r.fetchNet, now: () => 1000 });
  const prog = [];
  const out = await c.sync(pro, { onProgress: (d, t) => prog.push([d, t]) });
  assert.deepEqual(out, { status: 'ok', downloaded: 4, removed: 0, total: 4 });
  assert.deepEqual(prog.at(-1), [4, 4]);
  assert.equal(st.files.has('admin/scholarly.json'), false);
  assert.deepEqual(await c.read('people.json', pro), [1]);
  assert.equal(await c.read('admin/scholarly.json', pro), undefined);
  assert.equal((await c.meta()).syncedAt, 1000);
  // segunda vez: só o manifest
  r.calls.length = 0;
  assert.equal((await c.sync(pro)).downloaded, 0);
  assert.deepEqual(r.calls, ['manifest.json']);
  // mudou um arquivo e saiu outro
  r.sha['timeline.json'] = 'novo'; delete r.data['info/gen.json'];
  const o2 = await c.sync(pro);
  assert.deepEqual([o2.downloaded, o2.removed], [1, 1]);
  assert.equal(st.files.has('info/gen.json'), false);
  // leitura exige o mesmo usuário e nível com acesso
  assert.equal(await c.read('people.json', { userId: 'u2', level: 'pro' }), undefined);
  assert.equal(await c.read('people.json', { userId: 'u1', level: 'none' }), undefined);
  assert.equal(await c.read('people.json', null), undefined);
  // admin passa a baixar o admin/*
  const o3 = await c.sync(admin);
  assert.equal(o3.downloaded, 1);
  assert.deepEqual(await c.read('admin/scholarly.json', admin), { s: 1 });
  assert.equal(await c.read('admin/scholarly.json', pro), undefined);
  // plano vencido/sem acesso: manifest negado apaga tudo
  const denied = createProSync({ store: st, fetchNet: async () => null });
  assert.deepEqual(await denied.sync(pro), { status: 'denied' });
  assert.equal(st.files.size, 0);
  assert.equal(await st.getMeta(), null);
}
{ // outro usuário no mesmo aparelho: apaga a cópia do anterior antes de baixar
  const st = mkStore(); const r = remote({ ...pkg }); const c = createProSync({ store: st, fetchNet: r.fetchNet });
  await c.sync(pro);
  await c.sync({ userId: 'u2', level: 'pro' });
  assert.equal((await c.meta()).userId, 'u2');
  assert.equal(await c.read('people.json', pro), undefined);
}
{ // nível none não baixa nada
  const st = mkStore(); const r = remote({ ...pkg }); const c = createProSync({ store: st, fetchNet: r.fetchNet });
  assert.deepEqual(await c.sync({ userId: 'u1', level: 'none' }), { status: 'denied' });
  assert.deepEqual(r.calls, []);
}
{ // falha no meio: o que chegou fica registrado e a próxima rodada completa
  const st = mkStore(); const r = remote({ ...pkg }); let boom = true;
  const c = createProSync({ store: st, fetchNet: async (k) => { if (k === 'timeline.json' && boom) throw new Error('rede'); return r.fetchNet(k); } });
  await assert.rejects(c.sync(pro), /rede/);
  const m = await c.meta();
  assert.ok(Object.keys(m.files).length < 4);
  boom = false;
  assert.equal((await c.sync(pro)).total, 4);
  assert.equal(Object.keys((await c.meta()).files).length, 4);
}
{ // cancelar
  const st = mkStore(); const r = remote({ ...pkg }); const ac = new AbortController();
  const c = createProSync({ store: st, fetchNet: async (k) => { const v = await r.fetchNet(k); ac.abort(); return v; } });
  await assert.rejects(c.sync(pro, { signal: ac.signal }), { name: 'AbortError' });
}
console.log('OK pro offline: cópia incremental, admin separado, outro usuário, acesso negado, falha e cancelamento');
