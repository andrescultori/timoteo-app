import { useEffect, useMemo, useState } from 'react';
import { useContent, getPeople, getTimeline, loadInfo, hasInfoFile } from './data/content.js';
import { loadPeopleChapters } from './peopleChapters.js';
import { describeItem } from './studiesCore.js';
import { includeNeeds } from './studyInclude.js';

// Carrega só o que os itens com "Incluir o conteúdo aqui" precisam (e só o que o plano permite pedir: includeNeeds olha o can antes).
// Devolve { ready, deps } para studyInclude.includeFor: people, timeline, infos { slug → ficha } e peopleChapters.
export function useIncludeDeps(study, can, accessKey = '') {
  const needs = includeNeeds(study, describeItem, can);
  const slugKey = needs.infoSlugs.join(',');
  const keys = [...(needs.people ? ['people'] : []), ...(needs.timeline ? ['timeline'] : [])];
  const { ready: contentReady } = useContent(...keys);
  const [infos, setInfos] = useState({});
  const [pc, setPc] = useState(null);
  useEffect(() => {
    let alive = true;
    const slugs = slugKey ? slugKey.split(',') : [];
    setInfos({});
    slugs.forEach((slug) => {
      if (!hasInfoFile(slug)) { setInfos((x) => ({ ...x, [slug]: { map: null } })); return; }
      loadInfo(slug).then((info) => alive && setInfos((x) => ({ ...x, [slug]: info ?? { map: null } }))).catch(() => alive && setInfos((x) => ({ ...x, [slug]: { map: null } })));
    });
    return () => { alive = false; };
  }, [slugKey, accessKey]);
  useEffect(() => {
    if (!needs.peopleChapters) return undefined;
    let alive = true;
    loadPeopleChapters().then((d) => alive && setPc(d)).catch(() => {});
    return () => { alive = false; };
  }, [needs.peopleChapters]);
  const ready = (!keys.length || contentReady) && needs.infoSlugs.every((s) => infos[s]) && (!needs.peopleChapters || !!pc);
  const deps = useMemo(() => ({
    people: needs.people && contentReady ? getPeople() : null,
    timeline: needs.timeline && contentReady ? getTimeline() : null,
    infos, peopleChapters: pc,
  }), [needs.people, needs.timeline, contentReady, infos, pc]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ready, deps };
}
