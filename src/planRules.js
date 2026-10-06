// Regras de plano, sem React nem rede (o `npm run check` também as usa). A configuração vem de src/data/plans.json.
//
// IMPORTANTE: nesta fase (3A) o conteúdo ainda está no pacote público; estas regras controlam a interface, não são segurança.
// A proteção real do conteúdo Pro vem na 3B (conteúdo fora do site público, entregue pelo Supabase com RLS por plano).

// Cada recurso que as telas perguntam ao `can` aponta para uma linha da matriz de planos (features[].id)
export const FEATURE_ROW = {
  map: 'maps',
  structure: 'structure',
  person: 'characters',
  timeline: 'timeline',
  events: 'timeline',
  genealogy: 'genealogy',
  family: 'genealogy',
  academic: 'academic',
};

export const PLAN_ORDER = ['essencial', 'pro', 'premium'];

// Plano que vale agora: pro e premium só valem com expires_at nulo ou futuro; senão, essencial.
export function effectivePlan(plan, expiresAt, now = Date.now()) {
  if (plan !== 'pro' && plan !== 'premium') return 'essencial';
  if (expiresAt == null) return plan;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t > now ? plan : 'essencial';
}

// can(feature, ctx): ctx = { plan, isAdmin, slug?, id? }. `slug` para mapa e estrutura (livro), `id` para personagem.
export function createCan(config) {
  const rows = Object.fromEntries(config.features.map((f) => [f.id, f]));
  const ess = config.essencial;
  const partial = {
    map: (ctx) => ess.mapBooks.includes(ctx.slug),
    structure: (ctx) => ess.structureBooks.includes(ctx.slug),
    person: (ctx) => ess.characters.includes(ctx.id),
  };
  return function can(feature, ctx = {}) {
    if (ctx.isAdmin) return true; // o administrador vê tudo, inclusive a posição acadêmica
    const row = rows[FEATURE_ROW[feature]];
    if (!row) return false;
    const cell = row[ctx.plan ?? 'essencial'];
    if (cell === true) return true;
    if (cell === 'partial') return !!partial[feature]?.(ctx);
    return false; // false e "soon"
  };
}
