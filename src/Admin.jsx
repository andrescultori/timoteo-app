import React, { useCallback, useEffect, useRef, useState } from 'react';
import BackButton from './BackButton.jsx';
import { getClient } from './auth.js';
import { usePageTitle } from './pageTitle.js';
import { formatBRL } from './billing.js';
import { replaceHome } from './route.js';
import { rpcProblem, shortcutExpiry, toDateInput, fromDateInput, planView, downgradesPaid, barRows, cents, SEX_ORDER, AGE_ORDER } from './adminData.js';

// Administração (Fase 6; só admin, ver supabase/migrations/20261015000000_fase6_admin.sql). Tudo passa pelas RPCs com a sessão do admin:
// o banco recusa quem não é admin, e esta página nem monta para quem não é (App.jsx). Nenhum segredo e nenhuma conta de sexo ou idade no navegador:
// os gráficos mostram só o que admin_kpis devolve (e nada quando um grupo é pequeno demais).
const PAGE = 20;
const PLAN_LABEL = { essencial: 'Essencial', pro: 'Pro', premium: 'Premium' };
const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);

async function rpc(name, args) {
  const client = await getClient();
  const { data, error } = await client.rpc(name, args);
  if (error) { const e = new Error(error.message); e.problem = rpcProblem(error); e.code = error.code; throw e; }
  return data;
}

export default function Admin({ lang, t }) {
  usePageTitle([t.admin], t.title);
  const [kpis, setKpis] = useState(null);
  const [history, setHistory] = useState(null);
  const [fatal, setFatal] = useState(null); // 'missing' | 'other'
  const [tick, setTick] = useState(0); // muda depois de salvar: a lista recarrega a linha

  const fail = useCallback((e) => {
    if (e?.problem === 'denied') replaceHome(); // não é (mais) admin: sai sem mostrar nada
    else setFatal(e?.problem === 'missing' ? 'missing' : 'other');
  }, []);

  const loadTop = useCallback(async () => {
    try {
      const [k, h] = await Promise.all([rpc('admin_kpis', { p_min: 5 }), rpc('admin_recent_changes', { p_limit: 30 })]);
      setKpis(k); setHistory(h); setFatal(null);
    } catch (e) { fail(e); }
  }, [fail]);
  useEffect(() => { loadTop(); }, [loadTop]);

  const changed = () => { loadTop(); setTick((x) => x + 1); };

  return (
    <div className="page bookpage" style={{ '--c': 'var(--muted)' }}>
      <BackButton t={t} />
      <h1>{t.admin}</h1>
      <p className="note">{t.adminIntro}</p>
      {fatal === 'missing' && (
        <section className="card" role="alert"><h2>{t.adminNoMigration}</h2><p>{t.adminNoMigrationHelp}</p></section>
      )}
      {fatal === 'other' && (
        <section className="card" role="alert"><h2>{t.adminError}</h2><button type="button" className="ghost" onClick={loadTop}>{t.adminRetry}</button></section>
      )}
      {!fatal && !kpis && <p className="soon">{t.adminLoading}</p>}
      {!fatal && kpis && (
        <>
          <Kpis k={kpis} t={t} lang={lang} />
          <div className="adm-grid">
            <Bars title={t.admSex} group={kpis.sex} order={SEX_ORDER} labels={{ female: t.admSexFemale, male: t.admSexMale, other: t.admSexOther, unspecified: t.admUnspec }} t={t} />
            <Bars title={t.admAge} group={kpis.age} order={AGE_ORDER} labels={{ unspecified: t.admUnspec }} t={t} />
          </div>
          <Users t={t} lang={lang} tick={tick} onChanged={changed} onFail={fail} />
          <History rows={history} t={t} lang={lang} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function Kpis({ k, t, lang }) {
  const n = (x) => Number(x ?? 0).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');
  const p = k.plan ?? {}, pay = k.payments ?? {};
  const wait = Object.entries(k.waitlist ?? {});
  return (
    <div className="adm-grid">
      <section className="card adm-card" aria-labelledby="k-users">
        <h2 id="k-users">{t.admKUsers}</h2>
        <dl className="adm-stats">
          <Stat label={t.admKTotal} value={n(k.total_users)} />
          <Stat label={t.admKNew7} value={n(k.new_7d)} />
          <Stat label={t.admKNew30} value={n(k.new_30d)} />
          <Stat label={t.admKMarketing} value={n(k.marketing_consent)} />
        </dl>
      </section>
      <section className="card adm-card" aria-labelledby="k-plans">
        <h2 id="k-plans">{t.admKPlans}</h2>
        <dl className="adm-stats">
          <Stat label={PLAN_LABEL.essencial} value={n(p.essencial)} />
          <Stat label={t.admKProPaid} value={n(p.pro_pago)} />
          <Stat label={t.admKProCourtesy} value={n(p.pro_cortesia)} />
          <Stat label={t.admKPremiumPaid} value={n(p.premium_pago)} />
          <Stat label={t.admKPremiumCourtesy} value={n(p.premium_cortesia)} />
          <Stat label={t.admKExpired} value={n(p.vencidos)} />
        </dl>
      </section>
      <section className="card adm-card" aria-labelledby="k-pay">
        <h2 id="k-pay">{t.admKPay}</h2>
        <dl className="adm-stats">
          <Stat label={t.admKApproved} value={n(pay.aprovados)} />
          <Stat label={t.admKPending} value={n(pay.pendentes)} />
          <Stat label={t.admKRefunded} value={n(pay.reembolsados)} />
          <Stat label={t.admKStarted} value={n(pay.usuarios_iniciaram_sem_pagar)} />
          <Stat label={t.admKAmount} value={formatBRL(cents(pay.aprovado_centavos), lang)} />
        </dl>
      </section>
      <section className="card adm-card" aria-labelledby="k-wait">
        <h2 id="k-wait">{t.admKWait}</h2>
        {wait.length ? (
          <dl className="adm-stats">{wait.sort(([a], [b]) => (a < b ? -1 : 1)).map(([f, c]) => <Stat key={f} label={f} value={n(c)} />)}</dl>
        ) : <p className="note">{t.admKWaitNone}</p>}
        <h3 className="adm-sub">{t.admKRoles}</h3>
        <dl className="adm-stats">
          <Stat label={t.admRoleEditor} value={n(k.roles?.editor)} />
          <Stat label={t.admRoleReviewer} value={n(k.roles?.revisor)} />
        </dl>
      </section>
    </div>
  );
}

function Bars({ title, group, order, labels, t }) {
  const rows = group?.hidden ? [] : barRows(group?.items, order);
  return (
    <section className="card adm-card">
      <h2>{title}</h2>
      {group?.hidden ? (
        <p className="note adm-hidden">{fill(t.admHidden, { n: group.min })}</p>
      ) : (
        <ul className="adm-bars">
          {rows.map((r) => (
            <li key={r.key}>
              <span className="adm-bl">{labels[r.key] ?? r.key}</span>
              <span className="adm-track" aria-hidden="true"><i style={{ width: `${r.width}%` }} /></span>
              <b>{r.n} <small>({r.pct}%)</small></b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlanTags({ u, t, lang }) {
  const v = planView(u);
  const d = (iso) => new Date(iso).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US');
  return (
    <span className="adm-tags">
      <span className={`adm-tag plan-${v.plan}`}>{PLAN_LABEL[v.plan]}</span>
      {v.expired && <span className="adm-tag warn">{t.admExpiredTag}</span>}
      {v.plan !== 'essencial' && <span className="adm-tag">{v.until ? fill(t.admUntil, { d: d(v.until) }) : t.admNoExpiry}</span>}
      {v.origin && <span className="adm-tag">{v.origin === 'paid' ? t.admPaid : t.admCourtesy}</span>}
      {u.roles?.map((r) => <span key={r} className="adm-tag">{r === 'editor' ? t.admRoleEditor : t.admRoleReviewer}</span>)}
      {u.is_admin && <span className="adm-tag strong">{t.admAdminTag}</span>}
    </span>
  );
}

// Busca (300 ms de espera), 20 por página e "carregar mais". A lista nunca traz sexo, idade nem cidade (a função não devolve).
function Users({ t, lang, tick, onChanged, onFail }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const seq = useRef(0);
  const qRef = useRef('');

  const fetchPage = useCallback(async (q, offset, replaceAll) => {
    const my = (seq.current += 1);
    setBusy(true); setError(false);
    try {
      const data = await rpc('admin_search_users', { p_query: q, p_limit: PAGE, p_offset: offset });
      if (my !== seq.current) return;
      setRows((cur) => (replaceAll || !cur ? data : [...cur, ...data]));
      setMore(data.length === PAGE);
    } catch (e) {
      if (my !== seq.current) return;
      if (e.problem === 'denied' || e.problem === 'missing') onFail(e); else setError(true);
    } finally { if (my === seq.current) setBusy(false); }
  }, [onFail]);

  useEffect(() => {
    const id = setTimeout(() => { qRef.current = query.trim(); fetchPage(qRef.current, 0, true); }, 300);
    return () => clearTimeout(id);
  }, [query, fetchPage]);

  // depois de salvar: a linha editada é lida de novo (busca exata pelo e-mail) e substituída
  const refreshRow = useCallback(async (u) => {
    const data = await rpc('admin_search_users', { p_query: u.email ?? '', p_limit: 5, p_offset: 0 });
    const fresh = data.find((r) => r.id === u.id);
    if (fresh) { setRows((cur) => (cur ? cur.map((r) => (r.id === u.id ? fresh : r)) : cur)); setEditing((cur) => (cur && cur.id === u.id ? fresh : cur)); }
    return fresh ?? u;
  }, []);
  useEffect(() => { /* tick: KPIs e histórico já recarregaram em Admin */ }, [tick]);

  return (
    <section className="card adm-users" aria-labelledby="adm-users">
      <h2 id="adm-users">{t.admUsers}</h2>
      <label className="adm-search">
        <span>{t.admSearch}</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" maxLength={100} />
        <small>{t.admSearchHint}</small>
      </label>
      {error && <p role="alert" className="profile-err">{t.adminError} <button type="button" className="linklike" onClick={() => fetchPage(qRef.current, 0, true)}>{t.adminRetry}</button></p>}
      {rows && !rows.length && !busy && <p className="note">{t.admNoResults}</p>}
      <ul className="adm-list" aria-busy={busy}>
        {rows?.map((u) => (
          <li key={u.id}>
            <button type="button" className="adm-row" onClick={() => setEditing(u)} aria-label={`${t.admEdit}: ${u.name || u.email || t.admNoName}`}>
              <span className="adm-who"><b>{u.name || t.admNoName}</b><span>{u.email}</span></span>
              <PlanTags u={u} t={t} lang={lang} />
            </button>
          </li>
        ))}
      </ul>
      {more && <button type="button" className="ghost" disabled={busy} onClick={() => fetchPage(qRef.current, rows.length, false)}>{t.admMore}</button>}
      {editing && (
        <EditUser key={editing.id} u={editing} t={t} lang={lang} onClose={() => setEditing(null)}
          onSaved={async () => { const fresh = await refreshRow(editing); onChanged(); return fresh; }} onFail={onFail} />
      )}
    </section>
  );
}

function EditUser({ u, t, lang, onClose, onSaved, onFail }) {
  const ref = useRef(null);
  const view = planView(u);
  const [plan, setPlan] = useState(view.plan);
  const [date, setDate] = useState(view.plan !== 'essencial' && u.expires_at ? toDateInput(u.expires_at) : '');
  const [note, setNote] = useState(u.note ?? '');
  const [step, setStep] = useState('form'); // 'form' | 'confirm'
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'ok' | 'err', text }
  const [roles, setRoles] = useState(u.roles ?? []);
  const [cur, setCur] = useState(u); // linha atual (depois de salvar, a recarregada)

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const h = () => onClose();
    d?.addEventListener('close', h);
    return () => { d?.removeEventListener('close', h); if (d?.open) d.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const expiry = plan === 'essencial' || !date ? null : fromDateInput(date);
  const dateBad = plan !== 'essencial' && !!date && (!expiry || expiry <= new Date());
  const warn = downgradesPaid(cur, plan, expiry?.toISOString() ?? null);
  const label = (p, iso) => `${PLAN_LABEL[p]}${p === 'essencial' ? '' : ` (${iso ? new Date(iso).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US') : t.admNoExpiry})`}`;

  const handle = (e, fallback) => {
    if (e.problem === 'denied' || e.problem === 'missing') { onFail(e); return; }
    setMsg({ kind: 'err', text: e.code === '22023' ? `${fallback} ${e.message}` : fallback });
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await rpc('admin_set_plan', { p_user: u.id, p_plan: plan, p_expires_at: expiry ? expiry.toISOString() : null, p_note: note.trim() || null });
      const fresh = await onSaved();
      setCur(fresh); setStep('form'); setMsg({ kind: 'ok', text: t.admSaved });
    } catch (e) { setStep('form'); handle(e, t.admSaveError); } finally { setBusy(false); }
  };

  const toggleRole = async (role) => {
    const on = roles.includes(role);
    setBusy(true); setMsg(null);
    try {
      await rpc('admin_set_role', { p_user: u.id, p_role: role, p_grant: !on });
      setRoles(on ? roles.filter((r) => r !== role) : [...roles, role]);
      await onSaved();
    } catch (e) { handle(e, t.admRolesError); } finally { setBusy(false); }
  };

  const roleSwitch = (role, text) => (
    <div className="cfg-switch" key={role}>
      <span className="cfg-switch-text"><span id={`adm-r-${role}`}>{text}</span></span>
      <button type="button" role="switch" className="switch" aria-checked={roles.includes(role)} aria-labelledby={`adm-r-${role}`} disabled={busy} onClick={() => toggleRole(role)}><span /></button>
    </div>
  );

  return (
    <dialog ref={ref} className="modal adm-modal" aria-labelledby="adm-edit-title" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="sheet" style={{ '--c': 'var(--line-strong)' }}>
        <div className="head">
          <div className="ttl">
            <h2 id="adm-edit-title">{t.admEditTitle}</h2>
            <p className="adm-id"><b>{u.name || t.admNoName}</b><br />{u.email}</p>
          </div>
          <button type="button" className="ghost close" onClick={() => ref.current.close()} aria-label={t.close}>✕</button>
        </div>
        <div className="body adm-body">
          <PlanTags u={cur} t={t} lang={lang} />
          {step === 'form' ? (
            <>
              <fieldset className="adm-field">
                <legend>{t.admPlan}</legend>
                <div className="seg" role="group" aria-label={t.admPlan}>
                  {Object.keys(PLAN_LABEL).map((p) => (
                    <button key={p} type="button" aria-pressed={plan === p} onClick={() => { setPlan(p); if (p === 'essencial') setDate(''); }}>{PLAN_LABEL[p]}</button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="adm-field" disabled={plan === 'essencial'}>
                <legend>{t.admExpiry}</legend>
                <div className="adm-short">
                  {[[1, t.admPlus1], [3, t.admPlus3], [12, t.admPlus12]].map(([m, text]) => (
                    <button key={m} type="button" className="pill" onClick={() => setDate(toDateInput(shortcutExpiry(cur.expires_at, m)))}>{text}</button>
                  ))}
                  <button type="button" className="pill" aria-pressed={plan !== 'essencial' && !date} onClick={() => setDate('')}>{t.admExpiryNone}</button>
                </div>
                <label className="adm-date"><span>{t.admExpiryDate}</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={dateBad} aria-describedby="adm-exp-help" />
                </label>
                <small id="adm-exp-help">{plan === 'essencial' ? t.admExpiryEssencial : dateBad ? t.admDateFuture : t.admExpiryHelp}</small>
              </fieldset>
              <label className="adm-field adm-note"><span>{t.admNote}</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} maxLength={300} rows={3} />
                <small>{t.admNoteHint} ({note.length}/300)</small>
              </label>
              {warn && <p className="adm-warn" role="alert">{t.admPaidWarn}</p>}
              <button type="button" className="ghost pro-cta" disabled={busy || dateBad} onClick={() => setStep('confirm')}>{t.admSave}</button>
            </>
          ) : (
            <div className="adm-confirm">
              <h3>{t.admConfirmTitle}</h3>
              <dl className="adm-stats">
                <Stat label={t.admFrom} value={label(view.plan, cur.expires_at)} />
                <Stat label={t.admTo} value={label(plan, expiry?.toISOString())} />
                {note.trim() && <Stat label={t.admNote} value={note.trim()} />}
              </dl>
              {warn && <p className="adm-warn" role="alert">{t.admPaidWarn}</p>}
              <div className="profile-actions">
                <button type="button" className="ghost pro-cta" disabled={busy} onClick={save}>{t.admConfirmDo}</button>
                <button type="button" className="ghost" disabled={busy} onClick={() => setStep('form')}>{t.admBack}</button>
              </div>
            </div>
          )}
          {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={msg.kind === 'err' ? 'profile-err' : 'adm-ok'}>{msg.text}</p>}
          <fieldset className="adm-field adm-roles">
            <legend>{t.admRoles}</legend>
            {roleSwitch('editor', t.admRoleEditor)}
            {roleSwitch('revisor', t.admRoleReviewer)}
            <small>{t.admRolesHelp}</small>
          </fieldset>
        </div>
      </div>
    </dialog>
  );
}

function History({ rows, t, lang }) {
  const when = (iso) => new Date(iso).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
  const text = (r) => {
    const who = r.admin_email || '?';
    const target = r.target_email || t.admDeletedAccount;
    const d = r.details ?? {};
    if (r.action === 'set_plan') {
      const side = (p, exp) => `${PLAN_LABEL[p] ?? p}${p && p !== 'essencial' ? ` (${exp ? new Date(exp).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US') : t.admNoExpiry})` : ''}`;
      return fill(t.admHistPlan, { who, target, from: d.to_plan ? side(d.from_plan, d.from_expires_at) : '–', to: d.to_plan ? side(d.to_plan, d.to_expires_at) : '–' });
    }
    const role = d.role === 'editor' ? t.admRoleEditor : d.role === 'revisor' ? t.admRoleReviewer : '';
    return fill(r.action === 'grant_role' ? t.admHistGrant : t.admHistRevoke, { who, target, role });
  };
  return (
    <section className="card" aria-labelledby="adm-hist">
      <h2 id="adm-hist">{t.admHistory}</h2>
      {!rows?.length ? <p className="note">{t.admHistEmpty}</p> : (
        <ul className="adm-hist">
          {rows.map((r, i) => (
            <li key={i}>
              <time dateTime={r.at}>{when(r.at)}</time>
              <span>{text(r)}{r.details?.note && <em> — “{r.details.note}”</em>}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
