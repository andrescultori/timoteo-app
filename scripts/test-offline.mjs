// Testes do texto offline (src/offline.js) com um cache falso: contagem por versão, download com progresso/cancelamento e remoção.
import assert from 'node:assert/strict';
import { countByVersion, downloadVersion, removeVersion, readCounts, BOOKS, BIBLE_CACHE } from '../src/offline.js';

const fake = () => {
  const m = new Map();
  const cache = { keys: async () => [...m.keys()].map((url) => ({ url })), match: async (u) => m.get(u), put: async (u, r) => { m.set(u, r); }, delete: async (r) => m.delete(r.url) };
  return { m, store: { open: async (n) => { assert.equal(n, BIBLE_CACHE); return cache; } } };
};
const ok = (u) => ({ ok: true, clone() { return this; }, url: u });

assert.deepEqual(countByVersion(['https://x/bible/kjv/1.json', 'https://x/bible/kjv/2.json', 'https://x/bible/web/1.json', 'https://x/other/1.json'], ['kjv', 'web', 'asv']), { kjv: 2, web: 1, asv: 0 });

{
  const { m, store } = fake();
  const seen = [];
  await downloadVersion('kjv', { base: '/', store, fetcher: async (u) => ok(u), onProgress: (n) => seen.push(n) });
  assert.equal(m.size, BOOKS);
  assert.equal(seen.at(-1), BOOKS);
  assert.deepEqual((await readCounts(['kjv', 'web'], store)), { kjv: BOOKS, web: 0 });
  // segunda vez: nada é baixado de novo
  let calls = 0;
  await downloadVersion('kjv', { base: '/', store, fetcher: async (u) => { calls++; return ok(u); } });
  assert.equal(calls, 0);
  await removeVersion('kjv', store);
  assert.equal(m.size, 0);
}
{
  const { store } = fake();
  await assert.rejects(downloadVersion('web', { store, fetcher: async () => ({ ok: false, status: 404 }) }), /HTTP 404/);
}
{
  const { m, store } = fake();
  const ac = new AbortController();
  await assert.rejects(downloadVersion('asv', { store, signal: ac.signal, fetcher: async (u) => { ac.abort(); return ok(u); } }), { name: 'AbortError' });
  assert.ok(m.size < BOOKS);
}
console.log('OK offline: contagem, download, cache existente, erro, cancelamento e remoção');
