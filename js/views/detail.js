// Popcorn · Series detail sheet, two-pane layout and navigation state.
'use strict';

/* ---------- Detail sheet ---------- */
let sheetShow = null, sheetSeason = null, sheetEps = [], summaryOpen = false, sheetHu = null, sheetProv;
function whereSection(s) {
  const sv = serviceOf(s), title = sheetHu || s.name, q = encodeURIComponent(title);
  const exact = sheetProv && typeof sheetProv === 'object' ? myProviders(sheetProv) : [];
  const known = sheetProv === null || (sheetProv && typeof sheetProv === 'object');
  const my = exact[0] || (known ? null : mine(s));
  const link = (href, name, note) => `<a href="${esc(href)}" target="_blank" rel="noopener"><b>${esc(name)}</b><small>${esc(note)}</small>${ICON.ext}</a>`;
  const rows = [link(`https://www.justwatch.com/hu/search?q=${encodeURIComponent(s.name)}`, 'JustWatch', tr('Minden magyarországi szolgáltató egy helyen, az ingyenes lehetőségekkel együtt'))];
  if (sv?.id === 'mtva' || !sv || sv.free) rows.push(link(`https://mediaklikk.hu/?s=${q}`, 'Médiaklikk', tr('Ingyenes közmédia (M1, Duna, M2) · keresés erre: {t}', { t: title })));
  if (sv?.id === 'rtl') rows.push(link(sv.url, 'RTL+', tr('Részben ingyenes · megnyitja a keresőt, írd be: {t}', { t: title })));
  if (sv?.id === 'tv2') rows.push(link(sv.url, 'TV2 Play', tr('Részben ingyenes · megnyitja a keresőt, írd be: {t}', { t: title })));
  const head = exact.length ? `<span class="pill ok">✓ ${tr('Nálad elérhető')}: ${esc(exact.map(x => x.name).join(', '))}</span>`
    : my ? `<span class="pill ok">✓ ${tr('Valószínűleg benne van')}: ${esc(my.name)}</span>`
    : sv && !known ? `<span class="pill ${sv.free ? 'ok' : 'neutral'}">${tr('Eredeti csatorna')}: ${esc(sv.name)}${sv.free ? ' · ' + tr('ingyenes is lehet') : ''}</span>` : '';
  return `<div class="panel" id="where"><h3>${tr('Hol nézhető?')}</h3>${head ? `<div>${head}</div>` : ''}
    <div data-provslot>${providersHtml(sheetProv)}</div>
    <div class="where">${rows.join('')}</div>
    ${known ? '' : `<p>${tr('Az előfizetéses egyezést az eredeti csatorna alapján becsüljük. Magyarországon egy sorozat néha máshol fut, ezt a JustWatch pontosan mutatja.')}</p>`}</div>`;
}
/** Wide screens: the detail pane only takes space while something is open. */
function renderPlaceholder() {
  sheetShow = null;
  $('#sheet').hidden = true;
  $('#sheet').innerHTML = '';
  document.querySelectorAll('.card.active').forEach(c => c.classList.remove('active'));
}
function markActive(id) { document.querySelectorAll('.card').forEach(c => c.classList.toggle('active', wide.matches && +c.dataset.open === id)); }
const closeBtnHtml = () => `<button class="iconbtn" data-close aria-label="${tr('Bezárás')}"><span class="ico-back">${ICON.back}</span><span class="ico-x">${ICON.x}</span></button>`;


async function openShow(id, push = true) {
  const sh = $('#sheet');
  if (push) pushSheet({ show: id }, '#sorozat-' + id);
  sh.hidden = false; sh.scrollTop = 0; if (!wide.matches) document.body.style.overflow = 'hidden';
  sheetShow = null; sheetSeason = null; summaryOpen = false; sheetHu = null;
  markActive(id);
  sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}</div>
    <div class="sheet-body"><div class="hero"><div class="skel" style="aspect-ratio:2/3"></div><div style="display:flex;flex-direction:column;gap:10px"><div class="skel" style="height:26px;width:80%"></div><div class="skel" style="height:14px;width:50%"></div></div></div>${skelRows(5)}</div>`;
  try {
    const [show, eps, hu] = await Promise.all([getShow(id), getEps(id), getHuName(id)]);
    if (!show) throw new Error('missing');
    if (sh.hidden || location.hash !== '#sorozat-' + id) return;
    sheetShow = show; sheetEps = eps || []; sheetHu = hu;
    if (state.follows[id]) { // keep stored summary fresh (status, poster)
      Object.assign(state.follows[id], { name: show.name, img: show.img, network: show.network, status: show.status }); save();
    }
    const p = progressOf(id, sheetEps);
    const seasons = [...new Set(regular(sheetEps).map(e => e.s))];
    sheetSeason = p.next ? p.next.s : seasons[seasons.length - 1] ?? null;
    sheetTrailerNode = null;
    sheetProv = tmdbKey() ? undefined : 'nokey';
    sheetLocal = { summary: undefined, eps: {} }; openEps = new Set();
    renderSheet();
    fillTrailer(tmdbKey() ? trailerForShow(show) : null, sheetHu || show.name);
    localSummary(show).then(r => {
      if (sheetShow?.id !== id) return;
      sheetLocal.summary = r || null;
      if (r) renderSheet();
    });
    if (tmdbKey()) {
      const r = await resolveProviders(tmdbTvId(show).then(tid => providersFor('tv', tid)));
      if (sheetShow?.id !== id || location.hash !== '#sorozat-' + id) return;
      sheetProv = r;
      const w = $('#sheet #where');
      if (w) w.outerHTML = whereSection(sheetShow);
    }
  } catch {
    sh.querySelector('.sheet-body').innerHTML = errorBox(NET_ERR);
  }
}
function closeShow() {
  document.body.style.overflow = '';
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (wide.matches) renderPlaceholder(); else { $('#sheet').hidden = true; sheetShow = null; }
  render(); // reflect any changes
}
const sheetOpen = () => !!(history.state?.show || history.state?.settings || history.state?.film || history.state?.movie || history.state?.wfilm || history.state?.picker);
function pushSheet(st, hash) { if (wide.matches && sheetOpen()) history.replaceState(st, '', hash); else history.pushState(st, '', hash); }
function showSheet() {
  const sh = $('#sheet'); sh.hidden = false; sh.scrollTop = 0; sheetShow = null;
  if (!wide.matches) document.body.style.overflow = 'hidden';
  document.querySelectorAll('.card.active').forEach(c => c.classList.remove('active'));
}
let sheetTrailerNode = null;
/** Local-language extras of the open series: summary, and per season the episode titles and plots. */
let sheetLocal = { summary: undefined, eps: {} }, openEps = new Set();
function loadSeasonLocal(season) {
  if (season == null || season in sheetLocal.eps) return;
  sheetLocal.eps[season] = null;   // loading
  const id = sheetShow.id;
  localEpisodes(sheetShow, season).then(r => {
    if (sheetShow?.id !== id) return;
    sheetLocal.eps[season] = r;
    if (Object.keys(r.names).length || Object.keys(r.plots).length) renderSheet();
  });
}
const epName = e => sheetLocal.eps[e.s]?.names?.[e.n] || e.name;
const epPlot = e => sheetLocal.eps[e.s]?.plots?.[e.n] || e.sum || '';
function renderSheet() {
  // keep the trailer element (and a playing video) across re-renders of the sheet
  const oldTrailer = document.querySelector('#sheet #trailerPanel');
  if (oldTrailer) sheetTrailerNode = oldTrailer;
  renderSheetInner();
  const slot = document.querySelector('#sheet #trailerPanel');
  if (slot && sheetTrailerNode && sheetTrailerNode !== slot) slot.replaceWith(sheetTrailerNode);
  // "Read more" only when the text is really cut off (a short summary fits in four lines on wide screens)
  const sum = document.querySelector('#sheet .summary.clamp'), more = document.querySelector('#sheet [data-more]');
  if (sum && more && sum.scrollHeight <= sum.clientHeight + 2) more.hidden = true;
}
function renderSheetInner() {
  const s = sheetShow, eps = regular(sheetEps), p = progressOf(s.id, sheetEps), followed = !!state.follows[s.id];
  const seasons = [...new Set(eps.map(e => e.s))];
  const inSeason = eps.filter(e => e.s === sheetSeason);
  const seasonAired = inSeason.filter(aired);
  const seasonAllWatched = seasonAired.length && seasonAired.every(e => isWatched(s.id, e.id));
  loadSeasonLocal(sheetSeason);
  const loc = sheetLocal.summary, genres = loc?.genres?.length ? loc.genres : s.genres.map(genreName);
  const summaryText = loc?.text || s.summary, summaryLang = loc?.text ? state.lang : s.lang === 'Hungarian' ? 'hu' : 'en';
  const facts = [statusPill(s.status), s.rating ? `<span class="pill neutral">★ ${s.rating.toFixed(1)}</span>` : '', s.runtime ? `<span class="pill neutral">${tr('{n} perc', { n: s.runtime })}</span>` : '', ...genres.slice(0, 3).map(g => `<span class="pill neutral">${esc(g)}</span>`)].join('');
  const years = s.premiered ? (s.ended ? `${s.premiered.slice(0, 4)}–${s.ended.slice(0, 4)}` : `${s.premiered.slice(0, 4)}–`) : '';
  const nextLine = p.next ? `${tr('Következő')}: <span class="code">${code(p.next)}</span> · ${esc(epName(p.next))}` : p.upcoming ? `${tr('Új rész')}: <span class="code">${code(p.upcoming)}</span> · ${fmtDate(p.upcoming.date)}` : '';
  $('#sheet').innerHTML = `${backdrop(s.img)}<div class="sheet-bar">${closeBtnHtml()}
      ${s.url ? `<a class="iconbtn" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${tr('Megnyitás a TVmaze-en')}">${ICON.ext}</a>` : ''}</div>
    <div class="sheet-body">
      <div class="hero">${posterImg(s)}<div style="min-width:0">
        <h2>${esc(s.name)}</h2>${sheetHu && sheetHu !== s.name ? `<div class="note" style="color:var(--fg)">${tr('Helyi cím')}: ${esc(sheetHu)}</div>` : ''}<div class="note">${esc([years, s.network].filter(Boolean).join(' · '))}</div>
        <div class="facts">${facts}</div>
        <div class="actions"><button class="btn ${followed ? 'soft' : 'primary'}" data-follow>${followed ? ICON.check + tr('A listádon') : ICON.plus + tr('Listára teszem')}</button>
          ${favBtn('tv:' + s.id, { kind: 'tv', ref: s.id, title: sheetHu || s.name, img: s.img, year: (s.premiered || '').slice(0, 4), genres: s.genres })}
          <button class="btn ghost" data-where>${tr('Hol nézhető?')}</button></div>
      </div></div>
      ${rateWidget('tv:' + s.id, { kind: 'tv', ref: s.id, title: sheetHu || s.name, img: s.img })}
      ${trailerPanel()}
      ${summaryText ? `<div><p class="summary ${summaryOpen ? '' : 'clamp'}" lang="${esc(summaryLang)}">${esc(summaryText)}</p>
        <button class="linkbtn" data-more>${tr(summaryOpen ? 'Kevesebb' : 'Tovább olvasom')}</button>
        ${loc?.src ? `<p class="note" style="margin-top:4px">${tr('Leírás: {src}', { src: loc.src })}</p>` : ''}</div>` : ''}
      <div class="stat"><div><b>${p.watched}</b><span>${tr('megnézett rész')}</span></div><div><b>${Math.max(p.aired - p.watched, 0)}</b><span>${tr('hátralévő rész')}</span></div><div><b>${seasons.length}</b><span>${tr('évad')}</span></div></div>
      ${nextLine ? `<div class="note" style="color:var(--fg)">${nextLine}</div>` : ''}
      ${whereSection(s)}
      ${seasons.length ? `<section>
        <div class="seg" role="group" aria-label="${tr('Évad választása')}">${seasons.map(n => {
          const se = eps.filter(e => e.s === n && aired(e)); const done = se.length && se.every(e => isWatched(s.id, e.id));
          return `<button data-pick="${n}" aria-pressed="${n === sheetSeason}">${tr('{n}. évad', { n })}${done ? ' ✓' : ''}</button>`; }).join('')}</div>
        <div class="sec-head"><span class="label">${tr('{n}. évad', { n: sheetSeason })} · ${tr('{n} rész', { n: inSeason.length })}</span>
          ${seasonAired.length ? `<button class="btn small ${seasonAllWatched ? 'ghost' : 'soft'}" data-season="${seasonAllWatched ? 'off' : 'on'}">${tr(seasonAllWatched ? 'Jelölés visszavonása' : 'Egész évad megnézve')}</button>` : ''}</div>
        <div class="list">${inSeason.map(e => {
          const a = aired(e), w = isWatched(s.id, e.id), open = openEps.has(e.id), plot = epPlot(e);
          const plotLang = sheetLocal.eps[e.s]?.plots?.[e.n] ? state.lang : 'en';
          return `<div class="ep ${a ? '' : 'future'}${open ? ' open' : ''}"><span class="no">${e.n}.</span>
            <button class="ep-main" data-epinfo="${e.id}" aria-expanded="${open}" aria-label="${esc(code(e))} ${esc(epName(e))}: ${tr(open ? 'leírás elrejtése' : 'leírás megjelenítése')}">
              <span class="t">${esc(epName(e))}</span><span class="d">${a ? fmtDate(e.date) : tr('Megjelenik: {d}', { d: fmtDate(e.date) })}${e.rt ? ` · ${tr('{n} perc', { n: e.rt })}` : ''}</span></button>
            <button class="check" data-ep="${s.id}:${e.id}" aria-pressed="${w}" ${a ? '' : 'disabled'} aria-label="${esc(code(e))} ${tr(w ? 'megnézve' : 'megjelölése megnézettként')}">${ICON.check}</button>
            ${open ? `<div class="ep-plot"${plot ? ` lang="${plotLang}"` : ''}>${plot ? esc(plot) : `<span class="note">${tr('Ehhez a részhez még nincs leírás.')}</span>`}</div>` : ''}</div>`;
        }).join('')}</div></section>` : `<p class="note">${tr('Ehhez a sorozathoz még nincsenek epizódadatok.')}</p>`}
      <p class="note">${tr(state.lang !== 'en' && !tmdbKey() ? 'Adatok: TVmaze és Wikipédia. Magyar epizódcímekhez és -leírásokhoz add meg a TMDB-kulcsot; addig ezek angolul jelennek meg.' : 'Adatok: TVmaze, Wikipédia és TMDB.')}</p>
    </div>`;
}

