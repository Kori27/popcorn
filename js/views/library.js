// Sorozatnapló · My list tab and personal star ratings.
'use strict';

/* ---------- Library ---------- */
/* ---------- Personal ratings (stored per device; shaped so they can be shared later) ---------- */
state.ratings = state.ratings || {};
const RATE_META = {};
const STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
function rateWidget(key, meta) {
  if (meta) RATE_META[key] = meta;
  const cur = state.ratings[key]?.stars || 0;
  return `<div class="panel" data-ratepanel="${esc(key)}"><h3>${tr('Saját értékelésed')}</h3>
    <div class="stars" role="group" aria-label="${tr('Saját értékelésed')}">${[1, 2, 3, 4, 5].map(n => `<button class="star${n <= cur ? ' on' : ''}" data-rate="${esc(key)}|${n}" aria-pressed="${n === cur}" aria-label="${tr('{n} csillag', { n })}">${STAR}</button>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="note">${cur ? tr('Értékelve: {n}/5', { n: cur }) : tr('Koppints a csillagokra az értékeléshez.')}</span>
    ${cur ? `<button class="linkbtn" data-unrate="${esc(key)}">${tr('Értékelés törlése')}</button>` : ''}</div></div>`;
}
function setRating(key, stars) {
  const meta = RATE_META[key] || state.ratings[key];
  if (!meta) return;
  if (stars) state.ratings[key] = { kind: meta.kind, ref: meta.ref, title: meta.title, img: meta.img || null, stars, at: Date.now() };
  else delete state.ratings[key];
  save();
  toast(tr(stars ? 'Értékelés elmentve' : 'Értékelés törölve'));
  document.querySelectorAll(`[data-ratepanel="${CSS.escape(key)}"]`).forEach(p => { p.outerHTML = rateWidget(key); });
  if (tab === 'library' && libSeg === 'ratings') render();
}
const starsText = n => '★'.repeat(n) + '☆'.repeat(5 - n);
let libSeg = 'shows', rateKind = 'all', rateSort = 'stars';
function renderRatings(v) {
  const kinds = [['all', 'Mind'], ['tv', 'Sorozatok'], ['film', 'Filmek']];
  let list = Object.entries(state.ratings).map(([key, r]) => ({ key, ...r }))
    .filter(r => rateKind === 'all' || (rateKind === 'tv' ? r.kind === 'tv' : r.kind !== 'tv'));
  list.sort((a, b) => rateSort === 'stars' ? (b.stars - a.stars || b.at - a.at) : b.at - a.at);
  const open = r => r.kind === 'tv' ? `data-open="${r.ref}"` : r.kind === 'ia' ? `data-film="${esc(r.ref)}"` : `data-movie="${r.ref}"`;
  v.insertAdjacentHTML('beforeend', `<div class="seg" role="group">${kinds.map(([k, l]) => `<button data-ratekind="${k}" aria-pressed="${rateKind === k}">${tr(l)}</button>`).join('')}
      <button data-ratesort="${rateSort === 'stars' ? 'new' : 'stars'}" aria-pressed="false">${tr('Rendezés')}: ${tr(rateSort === 'stars' ? 'Értékelés' : 'Legújabb')}</button></div>
    ${list.length ? `<div class="list">${list.map((r, i) => `<div class="row" ${open(r)} style="cursor:pointer">
        ${r.img ? `<img class="thumb" src="${esc(r.img)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}
        <div class="body"><div class="t1"><span class="code">#${i + 1}</span> ${esc(r.title)}</div>
        <div class="t2" style="color:#E3A008;letter-spacing:2px" aria-label="${tr('{n} csillag', { n: r.stars })}">${starsText(r.stars)}</div>
        <div class="t3">${tr(r.kind === 'tv' ? 'Sorozatok' : 'Filmek')} · ${fmtDate(ymd(new Date(r.at)))}</div></div><span></span></div>`).join('')}</div>`
      : `<div class="empty"><h3>${tr('Még nem értékeltél semmit')}</h3><p>${tr('Nyiss meg egy sorozatot vagy filmet, és koppints a csillagokra. Itt rangsorban látod a kedvenceidet.')}</p></div>`}`);
}

async function renderLibrary(v, alive) {
  v.innerHTML = `<div class="seg" role="group">${[['shows', 'Sorozataim'], ['ratings', 'Értékeléseim']].map(([k, l]) => `<button data-libseg="${k}" aria-pressed="${libSeg === k}">${tr(l)}${k === 'ratings' && Object.keys(state.ratings).length ? ` (${Object.keys(state.ratings).length})` : ''}</button>`).join('')}</div>`;
  if (libSeg === 'ratings') { renderRatings(v); return; }
  v = Object.assign(document.createElement('div'), { style: 'display:contents' });
  $('#view').appendChild(v);
  const shows = Object.values(state.follows);
  if (!shows.length) {
    v.innerHTML = `<div class="empty"><h3>${tr('A listád még üres')}</h3><p>${tr('Nyisd meg egy sorozat adatlapját, és koppints a „Listára teszem” gombra. Ha kipipálsz egy részt, a sorozat magától felkerül ide.')}</p><button class="btn primary" data-tab="search">${ICON.search}${tr('Sorozat keresése')}</button></div>`;
    return;
  }
  v.innerHTML = `<section><div class="sec-head"><h2>${tr('{n} sorozat', { n: shows.length })}</h2></div>${skelGrid(Math.min(shows.length, 9))}</section>`;
  let data;
  try { data = await pool(shows, 4, async s => ({ s, p: progressOf(s.id, await getEps(s.id) || []) })); }
  catch { if (alive()) v.innerHTML = errorBox(NET_ERR); return; }
  if (!alive()) return;
  const groups = [
    ['Folyamatban', data.filter(x => x.p.next && x.p.watched > 0)],
    ['Még nem kezdted el', data.filter(x => x.p.next && x.p.watched === 0)],
    ['Naprakész', data.filter(x => !x.p.next)]
  ].filter(g => g[1].length);
  v.innerHTML = groups.map(([title, arr]) => `<section><div class="sec-head"><h2>${tr(title)}</h2><span class="count">${arr.length}</span></div>
    <div class="grid">${arr.sort((a, b) => a.s.name.localeCompare(b.s.name, 'hu')).map(({ s, p }) => {
      const pct = p.aired ? Math.round(p.watched / p.aired * 100) : 0;
      const meta = !p.next && p.upcoming ? tr('új rész {when}', { when: relDays(p.upcoming.date) }) : !p.next && s.status === 'Ended' ? tr('befejezett sorozat') : tr('{a}/{b} rész', { a: p.watched, b: p.aired });
      return showCard(s, `<div class="progress ${pct === 100 ? 'done' : ''}"><i style="width:${pct}%"></i></div><span class="meta">${esc(meta)}</span>`);
    }).join('')}</div></section>`).join('');
}

