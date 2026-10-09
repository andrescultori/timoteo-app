// Capítulos de uma referência do esboço da ficha: "1:19–12:50" → [1, 12]; "3:1–21" → [3, 3]; "5" → [5, 5]; "1–4" → [1, 4].
// Referência que não segue essas formas devolve null (o `npm run check` falha, para nunca ficar sem destaque em silêncio).
export function chapterSpan(ref) {
  const r = String(ref).trim();
  let m = r.match(/^(\d+):\d+[–-](\d+):\d+$/);
  if (m) return [Number(m[1]), Number(m[2])];
  m = r.match(/^(\d+):\d+[–-]\d+$/) || r.match(/^(\d+):\d+$/);
  if (m) return [Number(m[1]), Number(m[1])];
  m = r.match(/^(\d+)[–-](\d+)$/);
  if (m) return [Number(m[1]), Number(m[2])];
  m = r.match(/^(\d+)$/);
  if (m) return [Number(m[1]), Number(m[1])];
  return null;
}

// Índices das seções do esboço que contêm o capítulo (um capítulo pode estar em duas seções).
export function sectionsAt(outline, chapter) {
  return outline.map((o, i) => { const s = chapterSpan(o.ref); return s && chapter >= s[0] && chapter <= s[1] ? i : -1; }).filter((i) => i >= 0);
}
