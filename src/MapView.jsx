import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import land from './data/land.json';
import timeline from './data/timeline.json';
import { people } from './data/people.json';
import { pick as pickT, range, main } from './timelineUtil.js';

// Nomes de mares exibidos como rótulos de fundo.
const WATERS = [
  { name: { pt: 'Mar Mediterrâneo', en: 'Mediterranean Sea' }, c: [19, 34.3] },
  { name: { pt: 'Mar Negro', en: 'Black Sea' }, c: [34, 43.3] },
  { name: { pt: 'Mar Vermelho', en: 'Red Sea' }, c: [35.4, 24] },
  { name: { pt: 'Mar Egeu', en: 'Aegean Sea' }, c: [25.2, 39.7], small: true },
];

const pickText = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.en : v);

const PIN_R = 9; // maior raio de um pin (o selecionado)
const NEAR = 1.5; // graus: lugares dentro desta distância formam o grupo que "Ampliar região" enquadra
const CANDIDATES = [[8, 4, 'start'], [-8, 4, 'end'], [8, -8, 'start'], [-8, -8, 'end'], [8, 14, 'start'], [-8, 14, 'end'], [0, -12, 'middle'], [0, 20, 'middle']];

// Retângulo aproximado de um rótulo (largura estimada pelo número de letras).
function labelRect(x, y, [dx, dy, anchor], w, fs) {
  const left = anchor === 'start' ? x + dx : anchor === 'end' ? x + dx - w : x + dx - w / 2;
  return { l: left, r: left + w, t: y + dy - fs * 0.85, b: y + dy + fs * 0.25 };
}
const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

// Escolhe a posição de cada rótulo sem sobrepor outros rótulos, pins nem as bordas. A dica `label` da ficha vem
// primeiro. O lugar selecionado tem prioridade e sempre ganha rótulo; os demais ficam sem rótulo quando não há
// posição livre (o nome continua na lista e no aria-label do pin).
function placeLabels(items, W, H, fs, selected) {
  const pins = items.map((it) => ({ l: it.x - PIN_R, r: it.x + PIN_R, t: it.y - PIN_R, b: it.y + PIN_R }));
  const placed = [];
  const out = new Array(items.length).fill(null);
  const order = items.map((_, i) => i).sort((a, b) => (b === selected) - (a === selected) || a - b);
  for (const i of order) {
    const it = items[i];
    const w = it.text.length * fs * 0.58;
    let best = null;
    for (const pos of it.hint ? [it.hint, ...CANDIDATES] : CANDIDATES) {
      const r = labelRect(it.x, it.y, pos, w, fs);
      let cost = 0;
      if (r.l < 2) cost += (2 - r.l) * fs * 4;
      if (r.r > W - 2) cost += (r.r - (W - 2)) * fs * 4;
      if (r.t < 2) cost += (2 - r.t) * w * 4;
      if (r.b > H - 2) cost += (r.b - (H - 2)) * w * 4;
      placed.forEach((q) => { cost += overlap(r, q) * 3; });
      pins.forEach((q, j) => { if (j !== i) cost += overlap(r, q) * 2; });
      if (!best || cost < best.cost) best = { pos, r, cost };
      if (cost === 0) break;
    }
    if (best.cost === 0 || i === selected) { out[i] = best.pos; placed.push(best.r); }
  }
  return out;
}

const NORMAL_MIN = [5.5, 3.6]; // extensão mínima (graus) da visão completa
const span = (ps, k) => Math.max(...ps.map((p) => p.lonLat[k])) - Math.min(...ps.map((p) => p.lonLat[k]));

const near = (places, i) => places.filter((p) => Math.hypot(p.lonLat[0] - places[i].lonLat[0], p.lonLat[1] - places[i].lonLat[1]) <= NEAR);

// Largura do contêiner em pixels. O SVG é desenhado em pixels reais para o texto manter o tamanho no celular.
function useWidth(ref) {
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setW(Math.max(240, Math.round(el.clientWidth)));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export default function MapView({ book, map, lang, t, initialPlace, onPlaceChange, onOpenTimeline, onOpenPerson }) {
  const boxRef = useRef(null);
  const [sel, setSel] = useState(() => Math.max(0, map.places.findIndex((p) => p.name.pt === initialPlace)));
  const [zoom, setZoom] = useState(false);
  const W = useWidth(boxRef);
  const H = Math.round(W < 480 ? W * 0.9 : W / 1.5);
  const places = map.places;

  // "Ampliar região": enquadra só o grupo de lugares próximos do selecionado (útil quando há muitos pins juntos).
  const group = useMemo(() => {
    const own = near(places, sel);
    if (own.length >= 3) return own;
    return places.map((_, i) => near(places, i)).reduce((a, b) => (b.length > a.length ? b : a), []);
  }, [places, sel]);
  // vale ampliar quando o grupo é só parte dos lugares ou quando todos cabem numa área menor que a visão mínima
  const canZoom = group.length >= 3 && (group.length < places.length || span(places, 0) < NORMAL_MIN[0] || span(places, 1) < NORMAL_MIN[1]);
  const zoomed = zoom && canZoom;

  const { projection, landPath } = useMemo(() => {
    const fit = zoomed ? group : places;
    const lons = fit.map((p) => p.lonLat[0]);
    const lats = fit.map((p) => p.lonLat[1]);
    const cx = (Math.min(...lons) + Math.max(...lons)) / 2;
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    // extensão mínima para a costa não parecer recortada
    const dx = Math.max(Math.max(...lons) - Math.min(...lons), zoomed ? 1.5 : NORMAL_MIN[0]);
    const dy = Math.max(Math.max(...lats) - Math.min(...lats), zoomed ? 1.0 : NORMAL_MIN[1]);
    const box = { type: 'MultiPoint', coordinates: [[cx - dx / 2, cy - dy / 2], [cx + dx / 2, cy + dy / 2]] };
    const padX = Math.min(50, Math.round(W * 0.1));
    const padY = W < 480 ? 28 : 40;
    const proj = geoMercator().fitExtent([[padX, padY], [W - padX, H - padY]], box);
    return { projection: proj, landPath: geoPath(proj)(land) };
  }, [places, group, zoomed, W, H]);

  const routePath = useMemo(
    () => (map.route ? geoPath(projection)({ type: 'LineString', coordinates: places.map((p) => p.lonLat) }) : null),
    [map.route, places, projection],
  );

  const fs = W < 480 ? 16 : 18; // nomes dos lugares: 18px (16px em tela estreita)
  const spots = useMemo(() => {
    const items = places.map((p) => {
      const [x, y] = projection(p.lonLat);
      const text = pickText(p.name, lang) + (p.uncertain ? ' ?' : '');
      return { x, y, text, hint: p.label, visible: x > -20 && x < W + 20 && y > -20 && y < H + 20 };
    });
    const idx = items.map((it, i) => (it.visible ? i : -1)).filter((i) => i >= 0);
    const pos = placeLabels(idx.map((i) => items[i]), W, H, fs, idx.indexOf(sel));
    return items.map((it, i) => ({ ...it, label: idx.includes(i) ? pos[idx.indexOf(i)] : null }));
  }, [places, projection, lang, W, H, fs, sel]);

  const color = `var(--s-${book.section})`;
  // personagens ligados ao lugar selecionado
  const folks = useMemo(
    () => people.filter((p) => p.places?.some((x) => x.book === book.slug && x.name === places[sel].name.pt)),
    [book.slug, places, sel],
  );
  // eventos da linha do tempo ligados ao lugar selecionado
  const events = useMemo(
    () => timeline.events.filter((e) => e.places?.some((p) => p.book === book.slug && p.name === places[sel].name.pt)),
    [book.slug, places, sel],
  );
  // escolher um lugar fora do grupo ampliado volta para a visão completa
  const choose = (i) => { if (zoomed && !group.includes(places[i])) setZoom(false); setSel(i); onPlaceChange?.(places[i].name.pt); };
  const onKey = (i) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i); } };

  return (
    <div className="mapview" style={{ '--c': color }}>
      <div className="mapbox" ref={boxRef}>
        {canZoom && (
          <button type="button" className="mapzoom" aria-pressed={zoomed} onClick={() => setZoom(!zoomed)}>
            {zoomed ? t.mapZoomOut : t.mapZoomIn}
          </button>
        )}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${t.mapAria}: ${book.name[lang]}`}>
          <path className="land" d={landPath} />
          {WATERS.map((w) => {
            const [x, y] = projection(w.c);
            const fs = 18;
            const half = (w.name[lang].length * (fs * 0.5 + 3)) / 2; // itálico com espaçamento entre letras (letter-spacing 3)
            if (x - half <= 4 || x + half >= W - 4 || y <= 20 || y >= H - 20) return null;
            return <text key={w.name.en} className="water" x={x} y={y} textAnchor="middle" fontSize={fs}>{w.name[lang]}</text>;
          })}
          {routePath && <path className="route" d={routePath} stroke={color} />}
          {places.map((p, i) => {
            const { x, y, text, visible, label } = spots[i];
            if (!visible) return null;
            const name = pickText(p.name, lang);
            return (
              <g key={name} className="spot" role="button" tabIndex={0} aria-pressed={i === sel}
                aria-label={`${name}${p.uncertain ? `, ${t.mapUncertain}` : ''}`}
                onClick={() => choose(i)} onKeyDown={onKey(i)}>
                <circle className="hit" cx={x} cy={y} r={16} />
                <circle className={`pin${p.uncertain ? ' unc' : ''}`} cx={x} cy={y} r={i === sel ? PIN_R : 6} />
                {label && <text className="lbl" x={x + label[0]} y={y + label[1]} textAnchor={label[2]} style={{ fontSize: fs }}>{text}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="maplegend" aria-label={t.mapLegend}>
        <li><svg width="16" height="16" aria-hidden="true"><circle className="lg-pin" cx="8" cy="8" r="6" /></svg>{t.mapKnown}</li>
        {places.some((p) => p.uncertain) && (
          <li><svg width="16" height="16" aria-hidden="true"><circle className="lg-pin unc" cx="8" cy="8" r="6" /></svg>{t.mapUncertain} (?)</li>
        )}
      </ul>

      {events.length > 0 && (
        <div className="mevents">
          <h4>{t.mapEvents}: {pickText(places[sel].name, lang)}</h4>
          <div className="tl-chips">
            {events.map((e) => (
              <button key={e.id} type="button" className="tl-chip" style={{ '--c': color }} onClick={() => onOpenTimeline(e.id)}>
                {pickT(e.title, lang)} <small>{range(main(e.dates), lang)}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {folks.length > 0 && (
        <div className="mevents">
          <h4>{t.people}: {pickText(places[sel].name, lang)}</h4>
          <div className="tl-chips">
            {folks.map((p) => (
              <button key={p.id} type="button" className="tl-chip" style={{ '--c': color }} onClick={() => onOpenPerson(p.id)}>{pickT(p.name, lang)}</button>
            ))}
          </div>
        </div>
      )}

      <div className="mplaces">
        {places.map((p, i) => (
          <button key={pickText(p.name, lang)} type="button" className="place" aria-current={i === sel} onClick={() => choose(i)}>
            <b>{pickText(p.name, lang)}{p.uncertain ? ' ?' : ''}</b>
            <span>{pickText(p.note, lang)}</span>
            <small>{book.ab[lang]} {p.ref}</small>
          </button>
        ))}
      </div>

      {map.note && <p className="mapnote">{pickText(map.note, lang)}</p>}
      <p className="mapnote">
        {t.mapUncertainHelp} {t.mapCoast} <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>. {t.mapPlaces}{' '}
        <a href="https://www.openbible.info/geo/" target="_blank" rel="noreferrer">OpenBible.info</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>). {t.mapApprox}
      </p>
    </div>
  );
}
