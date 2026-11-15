// Popcorn · Film tracking without any key: search and details from Wikipedia + Wikidata,
// "want to watch" / "watched" lists. With a TMDB key the film page also gets a trailer and exact providers.
'use strict';

const WD_API = 'https://www.wikidata.org/w/api.php';
// Wikidata "instance of" values that mean a film (film, feature, animated, TV film, documentary, short, …)
const FILM_TYPES = new Set(['Q11424', 'Q24869', 'Q202866', 'Q29168811', 'Q506240', 'Q229390', 'Q93204', 'Q24862', 'Q226730', 'Q1361932', 'Q130232', 'Q20667187', 'Q17517379', 'Q1054574', 'Q21191270', 'Q622548']);
const NOT_FILM = /producer|rendez|színész|actor|actress|director|soundtrack|album|regény|novel|egyértelműsítő|disambiguation|díj|award|gála|list|szereplő|character|franchise|sorozat|series|Regisseur|Schauspiel|Begriffsklärung|Filmreihe|Roman/i;
state.movies = state.movies || {};

const pickLang = o => o?.[state.lang] || o?.en || o?.hu || o?.de || Object.values(o || {})[0] || '';
const claim = (e, p) => (e.claims?.[p] || []).map(c => c.mainsnak?.datavalue?.value).filter(v => v != null);
function runtimeOf(e) {
  const v = claim(e, 'P2047')[0];
  if (!v) return null;
  const n = Math.abs(+v.amount), unit = String(v.unit || '').split('/').pop();
  const min = unit === 'Q25235' ? n * 60 : unit === 'Q11574' ? n / 60 : n; // hours / seconds / minutes
  return Math.round(min) || null;
}
function slimEntity(e) {
  const val = o => Object.fromEntries(Object.entries(o || {}).map(([k, x]) => [k, x.value]));
  const descs = val(e.descriptions), date = claim(e, 'P577').map(v => v.time).sort()[0];
  const anyDesc = Object.values(descs).join(' ');
  return {
    qid: e.id, labels: val(e.labels), descs,
    year: date ? date.slice(1, 5) : '', runtime: runtimeOf(e), imdb: claim(e, 'P345')[0] || null,
    isFilm: claim(e, 'P31').some(t => FILM_TYPES.has(t.id)) || (/film|movie/i.test(anyDesc) && !NOT_FILM.test(anyDesc)),
    directors: claim(e, 'P57').map(v => v.id).slice(0, 2), genres: claim(e, 'P136').map(v => v.id).slice(0, 3),
    links: Object.fromEntries(['hu', 'en', 'de'].map(w => [w, e.sitelinks?.[w + 'wiki']?.title]).filter(x => x[1]))
  };
}
const wdEntities = ids => api(`${WD_API}?action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions|claims|sitelinks&languages=hu|en|de&sitefilter=huwiki|enwiki|dewiki&format=json&origin=*`,
  7 * DAY, d => Object.values(d.entities || {}).filter(e => !('missing' in e)).map(slimEntity));
const wdLabels = ids => ids.length ? api(`${WD_API}?action=wbgetentities&ids=${ids.join('|')}&props=labels&languages=hu|en|de&format=json&origin=*`,
  30 * DAY, d => Object.fromEntries(Object.values(d.entities || {}).map(e => [e.id, Object.fromEntries(Object.entries(e.labels || {}).map(([k, x]) => [k, x.value]))]))) : Promise.resolve({});

/** Searches the Wikipedia of the app's language and the English one, so local and original titles both work. */
async function searchFilms(q) {
  const wikis = state.lang === 'en' ? ['en'] : [state.lang, 'en'];
  const lists = await Promise.all(wikis.map(w => api(`https://${w}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q + ' film')}&gsrlimit=20&prop=pageimages|pageprops&piprop=thumbnail&pithumbsize=320&pilicense=any&ppprop=wikibase_item&format=json&formatversion=2&origin=*`,
    6 * H, d => (d.query?.pages || []).sort((a, b) => a.index - b.index).map(p => ({ qid: p.pageprops?.wikibase_item, img: p.thumbnail?.source || null })).filter(x => x.qid)).catch(() => [])));
  // interleave the two result lists, local first, and drop duplicates
  const seen = new Map();
  for (let i = 0; i < 20; i++) lists.forEach(l => { const h = l[i]; if (h && !seen.has(h.qid)) seen.set(h.qid, h); else if (h && !seen.get(h.qid).img && h.img) seen.get(h.qid).img = h.img; });
  const hits = [...seen.values()].slice(0, 30);
  if (!hits.length) return [];
  const byId = new Map((await wdEntities(hits.map(h => h.qid))).map(e => [e.qid, e]));
  return hits.map(h => { const e = byId.get(h.qid); return e?.isFilm ? { ...e, img: h.img } : null; }).filter(Boolean);
}
async function getFilm(qid) {
  const e = (await wdEntities([qid]))?.[0];
  if (!e) throw new Error('missing');
  const w = e.links[state.lang] ? state.lang : e.links.en ? 'en' : Object.keys(e.links)[0];
  const [page, names] = await Promise.all([
    w ? api(`https://${w}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(e.links[w])}&prop=pageimages|extracts&exintro=1&explaintext=1&exsentences=6&piprop=thumbnail&pithumbsize=500&pilicense=any&format=json&formatversion=2&origin=*`,
      DAY, d => { const p = d.query?.pages?.[0] || {}; return { extract: p.extract || '', img: p.thumbnail?.source || null }; }).catch(() => null) : null,
    wdLabels([...e.directors, ...e.genres]).catch(() => ({}))
  ]);
  return { ...e, wiki: w, page: w ? e.links[w] : null, extract: page?.extract || '', img: page?.img || null,
    directorNames: e.directors.map(id => pickLang(names[id])).filter(Boolean), genreNames: e.genres.map(id => pickLang(names[id])).filter(Boolean) };
}

/* ---------- want-to-watch / watched ---------- */
const MOVIE_META = {};
function movieActions(key, meta) {
  if (meta) MOVIE_META[key] = meta;
  const st = state.movies[key]?.status;
  return `<div class="actions" data-mvpanel="${esc(key)}">
    <button class="btn ${st === 'want' ? 'soft' : st ? 'ghost' : 'primary'}" data-mvstatus="${esc(key)}|want" aria-pressed="${st === 'want'}">${st === 'want' ? ICON.check : ICON.plus}${tr('Megnézendő')}</button>
    <button class="btn ${st === 'seen' ? 'soft' : 'ghost'}" data-mvstatus="${esc(key)}|seen" aria-pressed="${st === 'seen'}">${ICON.check}${tr(st === 'seen' ? 'Megnézve' : 'Megnéztem')}</button>
    ${favBtn(key, meta)}</div>`;
}
function setMovieStatus(key, status) {
  const cur = state.movies[key], meta = MOVIE_META[key] || cur;
  if (!meta) return;
  if (cur?.status === status) { delete state.movies[key]; toast(tr('{name} lekerült a filmjeid közül', { name: meta.title })); }
  else {
    state.movies[key] = { key, kind: meta.kind, ref: meta.ref, title: meta.title, img: meta.img || null, year: meta.year || '', runtime: meta.runtime || null, imdb: meta.imdb || null,
      status, added: cur?.added || Date.now(), seenAt: status === 'seen' ? Date.now() : null };
    toast(tr(status === 'seen' ? '{name} megnézve' : '{name} felkerült a megnézendők közé', { name: meta.title }));
  }
  save();
  document.querySelectorAll(`[data-mvpanel="${CSS.escape(key)}"]`).forEach(p => { p.outerHTML = movieActions(key); });
  if (tab === 'library') render();
}
function toggleMovieSeen(key) {
  const m = state.movies[key];
  if (!m) return;
  m.status = m.status === 'seen' ? 'want' : 'seen';
  m.seenAt = m.status === 'seen' ? Date.now() : null;
  save(); toast(tr(m.status === 'seen' ? '{name} megnézve' : '{name} visszakerült a megnézendők közé', { name: m.title }));
  setTimeout(render, 300);
}
const filmMeta = f => [f.year, f.runtime ? tr('{n} perc', { n: f.runtime }) : ''].filter(Boolean).join(' · ');
const filmCardW = f => `<button class="card" data-wfilm="${esc(f.qid)}" aria-label="${esc(pickLang(f.labels))}">
  ${f.img ? `<img class="poster" src="${esc(f.img)}" alt="" loading="lazy">` : `<div class="poster-ph">${esc(pickLang(f.labels))}</div>`}
  ${state.movies['wd:' + f.qid] ? `<span class="flag">${ICON.check}</span>` : ''}
  <span class="name">${esc(pickLang(f.labels))}</span><span class="meta">${esc(filmMeta(f) || tr('Film'))}</span></button>`;
const FILM_ERR = 'Nem sikerült elérni a Wikipédiát. Ellenőrizd az internetkapcsolatot, és próbáld újra.';

/* ---------- film page ---------- */
async function openWikiFilm(qid, push = true) {
  if (push) pushSheet({ wfilm: qid }, '#wfilm-' + qid);
  showSheet();
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}</div><div class="sheet-body"><div class="hero"><div class="skel" style="aspect-ratio:2/3"></div><div style="display:flex;flex-direction:column;gap:10px"><div class="skel" style="height:26px;width:80%"></div><div class="skel" style="height:14px;width:50%"></div></div></div>${skelRows(2)}</div>`;
  let f;
  try { f = await getFilm(qid); }
  catch { if (location.hash === '#wfilm-' + qid) sh.querySelector('.sheet-body').innerHTML = errorBox(FILM_ERR); return; }
  if (location.hash !== '#wfilm-' + qid) return;
  const key = 'wd:' + qid, title = pickLang(f.labels), orig = f.labels.en && f.labels.en !== title ? f.labels.en : '';
  const meta = { kind: 'wd', ref: qid, title, img: f.img, year: f.year, runtime: f.runtime, imdb: f.imdb, genres: f.genreNames };
  const wikiUrl = f.page ? `https://${f.wiki}.m.wikipedia.org/wiki/${encodeURIComponent(f.page.replace(/ /g, '_'))}` : null;
  sh.innerHTML = `${backdrop(f.img)}<div class="sheet-bar">${closeBtnHtml()}${wikiUrl ? `<a class="iconbtn" href="${esc(wikiUrl)}" target="_blank" rel="noopener" aria-label="${tr('Megnyitás a Wikipédián')}">${ICON.ext}</a>` : ''}</div>
    <div class="sheet-body">
      <div class="hero">${f.img ? `<img class="poster" src="${esc(f.img)}" alt="">` : `<div class="poster-ph">${esc(title)}</div>`}
        <div style="min-width:0"><h2>${esc(title)}</h2>${orig ? `<div class="note">${esc(orig)}</div>` : ''}
        <div class="note">${esc([filmMeta(f), f.directorNames.length ? tr('Rendező') + ': ' + f.directorNames.join(', ') : ''].filter(Boolean).join(' · '))}</div>
        <div class="facts">${f.genreNames.map(g => `<span class="pill neutral">${esc(g)}</span>`).join('')}</div>
        ${movieActions(key, meta)}</div></div>
      ${rateWidget(key, meta)}
      ${trailerPanel()}
      ${f.extract ? `<p class="summary" lang="${esc(f.wiki)}">${esc(f.extract)}</p>` : `<p class="note">${tr('Ehhez a filmhez nincs leírás ezen a nyelven.')}</p>`}
      <div class="panel" id="where"><h3>${tr('Hol nézhető?')}</h3><div data-provslot>${providersHtml(tmdbKey() ? undefined : 'nokey')}</div>
        <div class="where"><a href="https://www.justwatch.com/hu/search?q=${encodeURIComponent(f.labels.en || title)}" target="_blank" rel="noopener"><b>JustWatch</b><small>${tr('Minden magyarországi szolgáltató egy helyen, az ingyenes lehetőségekkel együtt')}</small>${ICON.ext}</a></div></div>
      <p class="note">${tr('Adatok: Wikipédia és Wikidata (CC BY-SA).')}</p></div>`;
  if (!tmdbKey()) { fillTrailer(null, title); return; }
  const tmdbId = tmdbMovieIdByImdb(f.imdb);
  fillTrailer(tmdbId.then(id => id ? tmdb(`/movie/${id}/videos?language=${TLANG()}&include_video_language=${state.lang},en,null`).then(d => pickTrailer(d.results)) : null), title);
  fillProviders(tmdbId.then(id => providersFor('movie', id)), () => location.hash === '#wfilm-' + qid);
}
