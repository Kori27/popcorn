// Sorozatnapló · Watch now tab: public-domain films from the Internet Archive.
'use strict';

/* ---------- Watch now: public-domain films from the Internet Archive ---------- */
const IA = 'https://archive.org';
const IA_BASE = 'mediatype:movies AND licenseurl:*publicdomain* AND format:("h.264" OR "512Kb MPEG4")';
const IA_GENRES = [['pop', 'Népszerű', 'collection:feature_films'], ['comedy', 'Vígjáték', 'collection:Comedy_Films'], ['noir', 'Film noir', 'collection:Film_Noir'],
  ['scifi', 'Sci-fi és horror', 'collection:SciFi_Horror'], ['western', 'Western', 'collection:feature_films AND subject:western'], ['silent', 'Némafilm', 'collection:silent_films'], ['tv', 'Régi tévésorozatok', 'collection:classic_tv']];
let iaGenre = 'pop', iaQ = '', iaPage = 1;
const iaThumb = id => `${IA}/services/img/${encodeURIComponent(id)}`;
function iaSearch(genre, text, page) {
  let q = `${IA_BASE} AND (${IA_GENRES.find(g => g[0] === genre)[2]})`;
  const clean = text.replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  if (clean) q += ` AND title:(${clean})`;
  return api(`${IA}/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=year&rows=24&page=${page}&sort[]=downloads+desc&output=json`, 12 * H,
    d => ({ total: d.response?.numFound || 0, docs: (d.response?.docs || []).map(x => ({ id: x.identifier, title: Array.isArray(x.title) ? x.title[0] : x.title, year: x.year })) }));
}
const filmCard = f => `<button class="card" data-film="${esc(f.id)}" aria-label="${esc(f.title)}">
  <img class="poster" src="${iaThumb(f.id)}" alt="${esc(f.title)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;poster-ph&quot;>'+this.alt.replace(/[<&]/g,'')+'</div>'">
  <span class="name">${esc(f.title)}</span><span class="meta">${esc(f.year || tr('Klasszikus'))}</span></button>`;
const FREE_HU = [
  ['https://mediaklikk.hu/', 'Médiaklikk', 'Az M1, a Duna és az M2 műsorai, filmek, sorozatok és mesék, ingyen'],
  ['https://www.rtlplusz.hu/', 'RTL+', 'Az ingyenes része regisztrációval nézhető (sorozatok, műsorok)'],
  ['https://tv2play.hu/', 'TV2 Play', 'Az ingyenes része reklámokkal nézhető'],
  ['https://filmio.hu/', 'Filmio', 'A Nemzeti Filmintézet magyar filmtára, időszakonként ingyenes akciókkal']];
function renderWatch(v, alive) {
  v.innerHTML = `<section><div class="sec-head"><h2>${tr('Klasszikus filmek, ingyen')}</h2></div>
      <p class="note">${tr('Közkincs (public domain) filmek és régi sorozatok az Internet Archive-ból. Az appban indulnak, reklám nélkül. Többnyire angol nyelvűek, felirat nélkül; a némafilmekhez nem kell nyelvtudás.')}</p>
      <div class="search">${ICON.search}<input id="iaq" type="search" enterkeyhint="search" autocomplete="off" placeholder="${tr('Film címe, pl. Chaplin')}" value="${esc(iaQ)}" aria-label="${tr('Klasszikus film keresése')}"></div>
      <div class="seg" role="group" aria-label="${tr('Műfaj')}">${IA_GENRES.map(([k, l]) => `<button data-genre="${k}" aria-pressed="${iaGenre === k}">${tr(l)}</button>`).join('')}</div>
      <div id="ia">${skelGrid(6)}</div></section>
    <div class="panel"><h3>${tr('Ingyenes magyar források')}</h3><p>${tr('Ezek a saját oldalukon nyílnak meg.')}</p>
      <div class="where">${FREE_HU.map(([u, n, d]) => `<a href="${u}" target="_blank" rel="noopener"><b>${n}</b><small>${tr(d)}</small>${ICON.ext}</a>`).join('')}</div></div>`;
  const q = $('#iaq');
  q.addEventListener('input', () => { clearTimeout(renderWatch.t); renderWatch.t = setTimeout(() => { iaQ = q.value; iaPage = 1; loadIA(alive, false); }, 400); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(renderWatch.t); iaQ = q.value; iaPage = 1; loadIA(alive, false); q.blur(); } });
  iaPage = 1; loadIA(alive, false);
}
async function loadIA(alive, append) {
  const box = $('#ia'); if (!box) return;
  const want = `${iaGenre}|${iaQ}|${iaPage}`;
  if (!append) box.innerHTML = skelGrid(6);
  try {
    const res = await iaSearch(iaGenre, iaQ, iaPage);
    if (!alive() || `${iaGenre}|${iaQ}|${iaPage}` !== want || !$('#ia')) return;
    const grid = box.querySelector('.grid');
    const cards = res.docs.map(filmCard).join('');
    if (append && grid) grid.insertAdjacentHTML('beforeend', cards);
    else box.innerHTML = res.docs.length ? `<div class="grid">${cards}</div>` : `<div class="empty"><h3>${tr('Nincs találat')}</h3><p>${tr('Próbáld angol címmel, vagy válassz másik műfajt.')}</p></div>`;
    box.querySelector('.more')?.remove();
    if (res.total > iaPage * 24) box.insertAdjacentHTML('beforeend', `<button class="btn ghost more" data-iamore style="margin-top:14px">${tr('Továbbiak')} (${res.total - iaPage * 24})</button>`);
  } catch { if (alive()) box.innerHTML = errorBox('Nem sikerült elérni az Internet Archive-ot. Próbáld újra kicsit később.'); }
}
async function openFilm(id, push = true) {
  const hash = '#film-' + encodeURIComponent(id);
  if (push) pushSheet({ film: id }, hash);
  showSheet();
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}</div><div class="sheet-body"><div class="skel" style="aspect-ratio:16/9"></div>${skelRows(2)}</div>`;
  try {
    const m = await api(`${IA}/metadata/${encodeURIComponent(id)}`, 7 * DAY, d => ({
      title: [].concat(d.metadata?.title || id)[0], year: d.metadata?.year || (d.metadata?.date || '').slice(0, 4), runtime: d.metadata?.runtime,
      desc: strip([].concat(d.metadata?.description || '').join(' ')).slice(0, 1500), server: d.d1,
      files: (d.files || []).filter(f => /\.(mp4|ogv|srt|vtt)$/i.test(f.name)).map(f => ({ name: f.name, format: f.format }))
    }));
    if (location.hash !== hash) return;
    const pick = fmt => m.files.find(f => f.format === fmt);
    const video = pick('512Kb MPEG4') || pick('h.264') || m.files.find(f => /\.mp4$/i.test(f.name)) || pick('Ogg Video');
    const src = f => `${IA}/download/${encodeURIComponent(id)}/${f.name.split('/').map(encodeURIComponent).join('/')}`;
    sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}<a class="iconbtn" href="${IA}/details/${encodeURIComponent(id)}" target="_blank" rel="noopener" aria-label="${tr('Megnyitás az Internet Archive-on')}">${ICON.ext}</a></div>
      <div class="sheet-body">
        ${video ? `<div class="player"><video id="film" controls playsinline preload="metadata" poster="${iaThumb(id)}"><source src="${src(video)}" type="${/\.ogv$/i.test(video.name) ? 'video/ogg' : 'video/mp4'}"></video></div>`
          : errorBox('Ennek a filmnek már nincs lejátszható változata. Válassz egy másikat.')}
        <div><h2 style="font:800 24px/1.15 var(--font-display);margin:0 0 6px">${esc(m.title)}</h2>
          <div class="facts">${m.year ? `<span class="pill neutral">${esc(m.year)}</span>` : ''}${m.runtime ? `<span class="pill neutral">${esc(m.runtime)}</span>` : ''}<span class="pill ok">${tr('Közkincs')}</span></div></div>
        ${rateWidget('ia:' + id, { kind: 'ia', ref: id, title: m.title, img: iaThumb(id) })}
        ${m.desc ? `<p class="summary" lang="en">${esc(m.desc)}</p>` : ''}
        <p class="note">${tr('Forrás: Internet Archive. Szerzői jog alól felszabadult (public domain) mű.')}</p></div>`;
  } catch { sh.querySelector('.sheet-body').innerHTML = errorBox('Nem sikerült betölteni a filmet. Ellenőrizd az internetkapcsolatot.'); }
}

