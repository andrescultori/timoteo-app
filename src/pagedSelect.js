// Lê todas as linhas de uma tabela em páginas: o PostgREST devolve no máximo 1000 por consulta (padrão do projeto Supabase), então 10 mil
// marcações pediriam "só as primeiras 1000" sem avisar. A ordem fixa evita pular ou repetir linhas entre as páginas.
// `eq`: { coluna: valor } opcional. Lança o erro do Supabase (quem chama decide se isola a falha).
export const PAGE = 1000;

export async function fetchAll(client, table, cols, order = [], eq = {}) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    let q = client.from(table).select(cols);
    for (const [col, val] of Object.entries(eq)) q = q.eq(col, val);
    for (const o of order) q = q.order(o);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
