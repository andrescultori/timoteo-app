// Carregamento dos originais (hebraico e grego), por livro e sob demanda. Único ponto de acesso: na Fase 3B (conteúdo Pro fora do
// site público) só esta função muda para buscar do Supabase Storage; o formato dos arquivos continua o mesmo
// (ver docs/formatos-de-dados.md, seção "Originais em hebraico e grego").
const cache = new Map();

function get(file) {
  if (!cache.has(file)) {
    const p = fetch(`${import.meta.env.BASE_URL}interlinear/${file}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    cache.set(file, p);
    p.catch(() => cache.delete(file));
  }
  return cache.get(file);
}

export const loadInterlinear = (n) => get(String(n));
// léxico do testamento do livro: hebraico (1 a 39) ou grego (40 a 66)
export const loadLexicon = (n) => get(n <= 39 ? 'lex-h' : 'lex-g');
