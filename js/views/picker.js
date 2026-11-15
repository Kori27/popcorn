// Popcorn · "Mit nézzek ma?" — pick something to watch: spin (case-opening style), swipe, or duel.
// Series come from TVmaze; films from TMDB with a key, otherwise from Wikidata (well-known films, no key).
'use strict';

const PICK = { kind: 'tv', mode: 'spin', pools: {}, loading: null, spin: null, swipe: null, duel: null };
const PICK_MODES = [['spin', '🎲 Pörgetés'], ['swipe', '❤️ Húzogatós'], ['duel', '⚔️ Párbaj']];

/* ---------- pools ---------- */
async function tvPool() {
  const pages = await Promise.all([0, 1, 2, 3].map(p => api(`/shows?page=${p}`, 7 * DAY,
    a => a.filter(s => s.weight >= 95 && s.image && (s.rating?.average || 0) >= 7).map(slimShow)).catch(() => [])));
  return pages.flat().map(s => ({ kind: 'tv', id: s.id, open: `data-open="${s.id}"`, title: s.name, year: year(s), rating: s.rating || 0,
    genres: s.genres || [], img: s.img, summary: s.summary }));
}
async function moviePoolTmdb() {
  const [genres, ...pages] = await Promise.all([tmdbGenres('movie'), ...[1, 2, 3, 4, 5].map(p => tmdb(`/discover/movie?language=${TLANG()}&sort_by=vote_count.desc&vote_average.gte=6.5&include_adult=false&page=${p}`, 7 * DAY).catch(() => ({ results: [] }))),
    tmdb(`/trending/movie/week?language=${TLANG()}`, 12 * H).catch(() => ({ results: [] }))]);
  const gname = new Map(genres.map(g => [g.id, g.name])), seen = new Set();
  return pages.flatMap(p => p.results || []).filter(m => m.poster_path && !seen.has(m.id) && seen.add(m.id)).map(m => ({
    kind: 'movie', id: m.id, open: `data-movie="${m.id}"`, title: m.title, year: (m.release_date || '').slice(0, 4), rating: m.vote_average || 0,
    genres: (m.genre_ids || []).map(id => gname.get(id)).filter(Boolean), img: TIMG + 'w342' + m.poster_path, summary: m.overview, watchedKey: 'mv:' + m.id }));
}
async function moviePoolWikidata() {
  const lang = state.lang;
  const q = `SELECT ?f ?label ?en ?date ?links (GROUP_CONCAT(DISTINCT ?g; separator="|") AS ?genres) WHERE {
    ?f wdt:P31 wd:Q11424; wikibase:sitelinks ?links; wdt:P577 ?date; wdt:P345 ?imdb. FILTER(?links > 55)
    OPTIONAL { ?f rdfs:label ?label FILTER(lang(?label) = "${lang}") } OPTIONAL { ?f rdfs:label ?en FILTER(lang(?en) = "en") }
    OPTIONAL { ?f wdt:P136 ?gi. ?gi rdfs:label ?g FILTER(lang(?g) = "${lang}") }
  } GROUP BY ?f ?label ?en ?date ?links LIMIT 3000`;
  const rows = await api(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, 14 * DAY, d => d.results.bindings.map(b => ({
    qid: b.f.value.split('/').pop(), title: (b.label || b.en)?.value, year: b.date.value.slice(0, 4), links: +b.links.value,
    genres: (b.genres?.value || '').split('|').filter(Boolean).map(g => g.replace(/\s*film$/i, '')).slice(0, 4) })));
  const seen = new Set();
  return rows.filter(r => r.title && !seen.has(r.qid) && seen.add(r.qid)).map(r => ({
    kind: 'movie', id: r.qid, open: `data-wfilm="${r.qid}"`, title: r.title, year: r.year,
    rating: Math.min(9.5, 6 + r.links / 40),   // how widely known the film is stands in for a rating
    genres: r.genres, img: null, summary: '', watchedKey: 'wd:' + r.qid }));
}
async function pickPool(kind) {
  const key = kind + (kind === 'movie' && tmdbKey() ? ':tmdb' : '') + ':' + state.lang;
  if (!PICK.pools[key]) PICK.pools[key] = (kind === 'tv' ? tvPool() : tmdbKey() ? moviePoolTmdb().catch(() => moviePoolWikidata()) : moviePoolWikidata())
    .then(p => { if (!p.length) throw new Error('empty'); return p; })
    .catch(e => { delete PICK.pools[key]; throw e; });
  return PICK.pools[key];
}
/** Films from Wikidata have no poster: fetch one from Wikipedia when the card is shown. */
async function ensureImage(item) {
  if (item.img || item.kind !== 'movie' || !/^Q\d+$/.test(item.id)) return item.img;
  try { const f = await getFilm(item.id); item.img = f.img; item.summary = item.summary || f.extract; } catch {}
  return item.img;
}

/* ---------- helpers ---------- */
const RARITY = [[8.5, 'legend', 'Legendás'], [7.8, 'epic', 'Epikus'], [7, 'rare', 'Ritka'], [0, 'common', 'Gyakori']];
const rarityOf = it => RARITY.find(([min]) => it.rating >= min);
function watchedLabel(it) {
  if (it.kind === 'tv') return Object.keys(state.watched[it.id] || {}).length ? tr('Már nézted') : '';
  return state.movies[it.watchedKey]?.status === 'seen' ? tr('Már megnézve') : '';
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickName = it => it.kind === 'tv' ? genreName : g => g;
const tileImg = (it, eager = false) => it.img ? `<img src="${esc(it.img)}" alt=""${eager ? '' : ' loading="lazy"'} draggable="false">` : `<span class="ph">${esc(it.title)}</span>`;
function itemCard(it, extra = '') {
  const w = watchedLabel(it), [, rk, rl] = rarityOf(it);
  return `<button class="card pick-card r-${rk}" ${it.open} aria-label="${esc(it.title)}">
    <span class="pw">${tileImg(it)}${w ? `<span class="seen-badge">✓ ${esc(w)}</span>` : ''}</span>
    <span class="name">${esc(it.title)}</span><span class="meta">${esc([it.year, it.genres.slice(0, 2).map(pickName(it)).join(', ')].filter(Boolean).join(' · '))}</span>${extra}</button>`;
}
/** Genre weights → best matches that were not shown yet. */
function recommend(pool, weights, exclude, n = 6) {
  const score = it => it.genres.reduce((s, g) => s + (weights[g] || 0), 0) / Math.sqrt(Math.max(1, it.genres.length)) + it.rating / 20 + Math.random() * 0.15;
  return pool.filter(it => !exclude.has(it.id)).map(it => [score(it), it]).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}
const likedGenres = weights => Object.entries(weights).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);

/* ---------- page ---------- */
/** Entry button used on Home and on the Watch now tab. */
const pickerCta = () => `<button class="picker-cta" data-picker><span class="picker-dice" aria-hidden="true">🎲</span>
  <span class="picker-text"><b>${tr('Mit nézzek ma?')}</b><small>${tr('Pörgess, húzogass, vagy válassz párbajban, és ajánlunk valamit.')}</small></span>
  <span class="picker-go" aria-hidden="true">›</span></button>`;
function openPicker(push = true) {
  if (push) pushSheet({ picker: 1 }, '#mit-nezzek');
  showSheet();
  renderPicker();
}
function renderPicker() {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}</div><div class="sheet-body picker">
    <div><h2 class="picker-title">${tr('Mit nézzek ma?')}</h2><p class="note">${tr('Válassz, hogy film vagy sorozat legyen, és hogyan döntsünk.')}</p></div>
    <div class="seg" role="group" aria-label="${tr('Típus')}">${[['tv', 'Sorozat'], ['movie', 'Film']].map(([k, l]) => `<button data-pkind="${k}" aria-pressed="${PICK.kind === k}">${tr(l)}</button>`).join('')}</div>
    <div class="seg pick-modes" role="group" aria-label="${tr('Mód')}">${PICK_MODES.map(([k, l]) => `<button data-pmode="${k}" aria-pressed="${PICK.mode === k}">${tr(l)}</button>`).join('')}</div>
    <div id="pickArea"><div class="skel" style="height:220px"></div></div></div>`;
  const kind = PICK.kind, mode = PICK.mode;
  pickPool(kind).then(pool => {
    if (!$('#pickArea') || PICK.kind !== kind || PICK.mode !== mode) return;
    ({ spin: renderSpin, swipe: renderSwipe, duel: renderDuel })[mode](pool);
  }).catch(() => { if ($('#pickArea')) $('#pickArea').innerHTML = errorBox('Nem sikerült betölteni a címeket. Ellenőrizd az internetkapcsolatot, és próbáld újra.'); });
}

/* ---------- 🎲 spin ---------- */
const TILE = 112, GAP = 10, STRIP = 48, WIN_AT = 40;
function renderSpin(pool) {
  const area = $('#pickArea'), s = PICK.spin;
  area.innerHTML = `<div class="spin-wrap"><div class="spin-marker" aria-hidden="true"></div><div class="spin-strip" id="spinStrip">${s?.kind === PICK.kind ? s.strip.map(spinTile).join('') : ''}</div></div>
    <div class="spin-actions"><button class="btn primary spin-btn" data-pspin>${tr(s?.kind === PICK.kind ? 'Újra pörgetés' : 'Pörgetés!')}</button></div>
    <div id="spinResult">${s?.kind === PICK.kind && s.done ? spinResult(s.win) : `<p class="note" style="text-align:center">${tr('A ritkaság a cím értékelésétől függ: Gyakori, Ritka, Epikus, Legendás.')}</p>`}</div>`;
  if (s?.kind === PICK.kind) placeStrip(s, false);
}
const spinTile = it => { const [, rk] = rarityOf(it); return `<div class="spin-tile r-${rk}">${tileImg(it, true)}<span class="spin-name">${esc(it.title)}</span></div>`; };
function placeStrip(s, animate) {
  const strip = $('#spinStrip'), wrap = strip?.parentElement;
  if (!strip) return;
  const x = -(WIN_AT * (TILE + GAP) + TILE / 2 + s.offset - wrap.clientWidth / 2);
  // jump back to the start without animating, then run the spin from there
  strip.style.transition = 'none';
  strip.style.transform = `translateX(${animate ? 0 : x}px)`;
  if (!animate) return;
  strip.getBoundingClientRect();
  strip.style.transition = `transform ${matchMedia('(prefers-reduced-motion:reduce)').matches ? 0.6 : 5.6}s cubic-bezier(.06,.72,.1,1)`;
  strip.style.transform = `translateX(${x}px)`;
}
async function startSpin() {
  const pool = await pickPool(PICK.kind);
  if (PICK.spin?.running) return;
  const strip = Array.from({ length: STRIP }, () => pool[Math.floor(Math.random() * pool.length)]);
  // rarer results are less likely, like opening a case
  const roll = Math.random(), tier = roll < 0.06 ? 'legend' : roll < 0.24 ? 'epic' : roll < 0.6 ? 'rare' : 'common';
  const cands = pool.filter(it => rarityOf(it)[1] === tier);
  strip[WIN_AT] = (cands.length ? cands : pool)[Math.floor(Math.random() * (cands.length || pool.length))];
  const s = PICK.spin = { kind: PICK.kind, strip, win: strip[WIN_AT], offset: (Math.random() - 0.5) * TILE * 0.7, running: true, done: false };
  ensureImage(s.win).then(img => { if (img) new Image().src = img; });   // load the winner's poster before the strip stops
  const el = $('#spinStrip');
  el.style.transition = 'none'; el.style.transform = 'translateX(0px)';
  el.innerHTML = strip.map(spinTile).join('');
  $('#spinResult').innerHTML = '';
  const btn = $('[data-pspin]'); if (btn) btn.disabled = true;
  placeStrip(s, true);
  const finish = async () => {
    if (!s.running) return;
    s.running = false; s.done = true;
    placeStrip(s, false);   // make sure the winner sits under the marker even if the animation could not run
    await ensureImage(s.win);
    if (PICK.spin !== s || !$('#spinResult')) return;
    $('#spinResult').innerHTML = spinResult(s.win);
    const b = $('[data-pspin]'); if (b) { b.disabled = false; b.textContent = tr('Újra pörgetés'); }
  };
  // only the strip's own transform transition counts (tiles have hover transitions that bubble up)
  const onEnd = e => { if (e.target !== el || e.propertyName !== 'transform') return; el.removeEventListener('transitionend', onEnd); finish(); };
  el.addEventListener('transitionend', onEnd);
  setTimeout(finish, 6200);   // in case the transition event never fires (e.g. hidden tab)
}
function spinResult(it) {
  const [, rk, rl] = rarityOf(it), w = watchedLabel(it);
  return `<div class="spin-win r-${rk}">
    <div class="spin-win-img">${tileImg(it, true)}</div>
    <div class="spin-win-body"><span class="rarity r-${rk}">${tr(rl)}</span><h3>${esc(it.title)}</h3>
      <p class="note">${esc([it.year, it.rating ? '★ ' + it.rating.toFixed(1) : '', it.genres.slice(0, 3).map(pickName(it)).join(', ')].filter(Boolean).join(' · '))}</p>
      ${w ? `<span class="seen-badge inline">✓ ${esc(w)}</span>` : ''}
      ${it.summary ? `<p class="spin-sum">${esc(it.summary)}</p>` : ''}
      <button class="btn primary" ${it.open}>${tr('Adatlap megnyitása')}</button></div></div>`;
}

/* ---------- ❤️ swipe ---------- */
const SWIPE_ROUNDS = 12;
function renderSwipe(pool) {
  let s = PICK.swipe;
  if (!s || s.kind !== PICK.kind) s = PICK.swipe = { kind: PICK.kind, weights: {}, seen: new Set(), liked: [], count: 0, current: null, done: false };
  const area = $('#pickArea');
  if (s.done) { area.innerHTML = resultsHtml(pool, s.weights, s.seen, s.liked, 'swipe'); return; }
  if (!s.current) s.current = nextSwipe(pool, s);
  const it = s.current, w = watchedLabel(it);
  area.innerHTML = `<p class="note" style="text-align:center">${tr('Húzd jobbra, ha tetszik, balra, ha nem. {n}/{m}', { n: s.count + 1, m: SWIPE_ROUNDS })}</p>
    <div class="swipe-stage"><div class="swipe-card" id="swipeCard">
      <div class="swipe-img">${tileImg(it)}${w ? `<span class="seen-badge">✓ ${esc(w)}</span>` : ''}<span class="swipe-stamp like">${tr('Tetszik')}</span><span class="swipe-stamp nope">${tr('Nem')}</span></div>
      <div class="swipe-body"><h3>${esc(it.title)}</h3><p class="note">${esc([it.year, it.rating ? '★ ' + it.rating.toFixed(1) : '', it.genres.slice(0, 3).map(pickName(it)).join(', ')].filter(Boolean).join(' · '))}</p></div></div></div>
    <div class="swipe-actions"><button class="round-btn nope" data-pswipe="0" aria-label="${tr('Nem tetszik')}">✕</button>
      <button class="btn ghost small" data-presults>${tr('Ajánlások most')}</button>
      <button class="round-btn like" data-pswipe="1" aria-label="${tr('Tetszik')}">♥</button></div>`;
  ensureImage(it).then(img => { if (img && PICK.swipe?.current === it && $('#swipeCard .swipe-img .ph')) $('#swipeCard .swipe-img .ph').outerHTML = `<img src="${esc(img)}" alt="" draggable="false">`; });
  enableDrag($('#swipeCard'), like => swipeDecide(like));
}
function nextSwipe(pool, s) {
  const fresh = pool.filter(it => !s.seen.has(it.id));
  // after a couple of likes, mostly show similar titles, sometimes something different to explore
  if (s.liked.length >= 2 && Math.random() < 0.7) return recommend(fresh, s.weights, new Set(), 5)[Math.floor(Math.random() * 3)] || fresh[0];
  return fresh[Math.floor(Math.random() * fresh.length)];
}
function swipeDecide(like) {
  const s = PICK.swipe, it = s?.current;
  if (!it) return;
  it.genres.forEach(g => { s.weights[g] = (s.weights[g] || 0) + (like ? 2 : -1); });
  if (like) s.liked.push(it);
  s.seen.add(it.id); s.count++; s.current = null;
  const card = $('#swipeCard');
  if (card) { card.style.transition = 'transform .25s ease-in, opacity .25s'; card.style.transform = `translateX(${like ? 140 : -140}%) rotate(${like ? 18 : -18}deg)`; card.style.opacity = '0'; }
  setTimeout(() => { if (s.count >= SWIPE_ROUNDS) s.done = true; pickPool(PICK.kind).then(renderSwipe); }, 230);
}
function enableDrag(card, decide) {
  if (!card) return;
  let x0 = null, dx = 0;
  card.addEventListener('pointerdown', e => { x0 = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; });
  card.addEventListener('pointermove', e => {
    if (x0 == null) return;
    dx = e.clientX - x0;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    card.classList.toggle('liking', dx > 40); card.classList.toggle('noping', dx < -40);
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    if (Math.abs(dx) > 100) decide(dx > 0);
    else { card.style.transition = 'transform .2s'; card.style.transform = ''; card.classList.remove('liking', 'noping'); }
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
}

/* ---------- ⚔️ duel ---------- */
const DUEL_ROUNDS = 7;
function renderDuel(pool) {
  let d = PICK.duel;
  if (!d || d.kind !== PICK.kind) d = PICK.duel = { kind: PICK.kind, weights: {}, seen: new Set(), picks: [], round: 0, pair: null, done: false };
  const area = $('#pickArea');
  if (d.done) { area.innerHTML = resultsHtml(pool, d.weights, d.seen, d.picks, 'duel'); return; }
  if (!d.pair) d.pair = duelPair(pool, d);
  area.innerHTML = `<p class="note" style="text-align:center">${tr('Melyiket néznéd szívesebben? {n}/{m}. kör', { n: d.round + 1, m: DUEL_ROUNDS })}</p>
    <div class="duel">${d.pair.map((it, i) => `<button class="duel-card" data-pduel="${i}">${tileImg(it)}${watchedLabel(it) ? `<span class="seen-badge">✓ ${esc(watchedLabel(it))}</span>` : ''}
      <span class="duel-name">${esc(it.title)}</span><span class="duel-meta">${esc([it.year, it.genres.slice(0, 2).map(pickName(it)).join(', ')].filter(Boolean).join(' · '))}</span></button>`).join(`<span class="vs">VS</span>`)}</div>`;
  d.pair.forEach((it, i) => ensureImage(it).then(img => {
    const ph = document.querySelector(`[data-pduel="${i}"] .ph`);
    if (img && ph && PICK.duel?.pair?.[i] === it) ph.outerHTML = `<img src="${esc(img)}" alt="" draggable="false">`;
  }));
}
function duelPair(pool, d) {
  const fresh = shuffle(pool.filter(it => !d.seen.has(it.id))).slice(0, 40);
  const a = fresh[0];
  // the second one should differ in genre, so every choice teaches something
  const b = fresh.slice(1).find(it => !it.genres.some(g => a.genres.includes(g))) || fresh[1];
  return [a, b];
}
function duelChoose(i) {
  const d = PICK.duel;
  if (!d?.pair) return;
  const win = d.pair[i], lose = d.pair[1 - i];
  win.genres.forEach(g => { d.weights[g] = (d.weights[g] || 0) + 2; });
  lose.genres.forEach(g => { d.weights[g] = (d.weights[g] || 0) - 0.5; });
  d.picks.push(win); d.pair.forEach(it => d.seen.add(it.id));
  d.round++; d.pair = null;
  if (d.round >= DUEL_ROUNDS) d.done = true;
  pickPool(PICK.kind).then(renderDuel);
}

/* ---------- results ---------- */
function resultsHtml(pool, weights, seen, chosen, mode) {
  const recs = recommend(pool, weights, seen, 6), top = likedGenres(weights);
  const map = pickName({ kind: PICK.kind });
  return `<div class="pick-results">
    <div class="pick-results-head"><h3>${tr('Neked ajánljuk')}</h3><button class="btn primary" data-prestart>${tr('Új kör')}</button></div>
    ${top.length ? `<p class="note">${tr('Ezek alapján: {g}', { g: top.map(map).join(', ') })}</p>` : `<p class="note">${tr('Még nem kedveltél semmit, ezért vegyes válogatás jön.')}</p>`}
    <div class="grid">${recs.map(it => itemCard(it)).join('')}</div>
    ${chosen.length ? `<h3>${tr(mode === 'duel' ? 'A választásaid' : 'Ezek tetszettek')}</h3><div class="grid">${chosen.map(it => itemCard(it)).join('')}</div>` : ''}
    </div>`;
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-pkind],[data-pmode],[data-pspin],[data-pswipe],[data-pduel],[data-presults],[data-prestart],[data-picker]');
  if (!t) return;
  if (t.hasAttribute('data-picker')) { if (history.state?.picker) return; openPicker(); return; }
  if (t.dataset.pkind) { PICK.kind = t.dataset.pkind; renderPicker(); return; }
  if (t.dataset.pmode) { PICK.mode = t.dataset.pmode; renderPicker(); return; }
  if (t.hasAttribute('data-pspin')) { startSpin(); return; }
  if (t.dataset.pswipe) { swipeDecide(t.dataset.pswipe === '1'); return; }
  if (t.dataset.pduel) { duelChoose(+t.dataset.pduel); return; }
  if (t.hasAttribute('data-presults')) { if (PICK.swipe) { PICK.swipe.done = true; pickPool(PICK.kind).then(renderSwipe); } return; }
  if (t.hasAttribute('data-prestart')) { if (PICK.mode === 'swipe') PICK.swipe = null; else PICK.duel = null; renderPicker(); }
});
// keyboard for swipe mode: ← no, → yes
document.addEventListener('keydown', e => {
  if (!history.state?.picker || PICK.mode !== 'swipe' || !$('#swipeCard')) return;
  if (e.key === 'ArrowRight') swipeDecide(true); else if (e.key === 'ArrowLeft') swipeDecide(false);
});
