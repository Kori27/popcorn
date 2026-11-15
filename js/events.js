// Popcorn · Click, history and media-query event handling.
'use strict';

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-open],[data-ep],[data-follow],[data-close],[data-pick],[data-season],[data-seg],[data-more],[data-settings],[data-service],[data-notify],[data-where],[data-yt],[data-film],[data-movie],[data-iamore],[data-tmdb],[data-rate],[data-unrate],[data-libseg],[data-lang],[data-mode],[data-accent],[data-size],[data-oled],[data-wfilm],[data-skind],[data-mvstatus],[data-mvquick],[data-filmseg],[data-backup],[data-wseg],[data-freemore],[data-tmdbtv]');
  if (!t) return;
  if (t.dataset.yt) { playYouTube(t); return; }
  if (t.dataset.film) { openFilm(t.dataset.film); return; }
  if (t.dataset.movie) { openMovie(+t.dataset.movie); return; }
  if (t.dataset.wfilm) { openWikiFilm(t.dataset.wfilm); return; }
  if (t.dataset.tmdbtv) { openTmdbTv(+t.dataset.tmdbtv); return; }
  if (t.dataset.mvstatus) { const i = t.dataset.mvstatus.lastIndexOf('|'); setMovieStatus(t.dataset.mvstatus.slice(0, i), t.dataset.mvstatus.slice(i + 1)); return; }
  if (t.dataset.mvquick) { t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true'); toggleMovieSeen(t.dataset.mvquick); return; }
  if (t.dataset.skind) { searchKind = t.dataset.skind; render(); return; }
  if (t.dataset.filmseg) { filmSeg = t.dataset.filmseg; render(); return; }
  if (t.dataset.wseg) { watchSeg = t.dataset.wseg; fset('watchSeg', watchSeg); render(); return; }
  if (t.hasAttribute('data-backup')) { exportBackup(); return; }
  if (t.hasAttribute('data-iamore')) { iaPage++; t.disabled = true; t.textContent = tr('Betöltés…'); const id = renderId; loadIA(() => id === renderId, true); return; }
  if (t.hasAttribute('data-freemore')) { freePage++; t.disabled = true; t.textContent = tr('Betöltés…'); const id = renderId; loadFree(() => id === renderId, true); return; }
  if (t.dataset.tmdb) { saveTmdb(t.dataset.tmdb === 'clear'); return; }
  if (t.dataset.rate) { const i = t.dataset.rate.lastIndexOf('|'); setRating(t.dataset.rate.slice(0, i), +t.dataset.rate.slice(i + 1)); return; }
  if (t.dataset.unrate) { setRating(t.dataset.unrate, 0); return; }
  if (t.dataset.libseg) { libSeg = t.dataset.libseg; render(); return; }
  if (t.dataset.lang) { setAppearance('lang', t.dataset.lang); return; }
  if (t.dataset.mode) { setAppearance('mode', t.dataset.mode); return; }
  if (t.dataset.accent) { setAppearance('accent', t.dataset.accent); return; }
  if (t.dataset.size) { setAppearance('size', t.dataset.size); return; }
  if (t.hasAttribute('data-oled')) { setAppearance('oled'); return; }
  if (t.dataset.tab) { if (t.dataset.skindgo) searchKind = t.dataset.skindgo; if (sheetOpen()) history.back(); setTab(t.dataset.tab); return; }
  if (t.dataset.open) { openShow(+t.dataset.open); return; }
  if (t.hasAttribute('data-close')) { sheetOpen() ? history.back() : closeShow(); return; }
  if (t.hasAttribute('data-settings')) {
    if (history.state?.settings) return;
    if (sheetOpen()) { history.replaceState({ settings: 1 }, '', '#beallitasok'); openSettings(false); } else openSettings();
    return;
  }
  if (t.dataset.service) {
    const id = t.dataset.service, i = state.services.indexOf(id);
    i >= 0 ? state.services.splice(i, 1) : state.services.push(id);
    save(); t.setAttribute('aria-pressed', i < 0);
    if (wide.matches) render();
    return;
  }
  if (t.dataset.notify) { t.dataset.notify === 'test' ? testNotify() : setNotify(t.dataset.notify === 'on'); return; }
  if (t.hasAttribute('data-where')) { $('#where')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' }); return; }
  if (t.dataset.seg) { calSeg = t.dataset.seg; render(); return; }
  if (t.hasAttribute('data-more')) { summaryOpen = !summaryOpen; renderSheet(); return; }
  if (t.hasAttribute('data-follow')) { toggleFollow(sheetShow); renderSheet(); return; }
  if (t.dataset.pick) { sheetSeason = +t.dataset.pick; renderSheet(); return; }
  if (t.dataset.season) {
    const ids = regular(sheetEps).filter(x => x.s === sheetSeason && aired(x)).map(x => x.id);
    await setWatched(sheetShow.id, ids, t.dataset.season === 'on');
    if (t.dataset.season === 'off') toast(tr('{n}. évad jelölése visszavonva', { n: sheetSeason }));
    renderSheet(); return;
  }
  if (t.dataset.ep) {
    const [sid, eid] = t.dataset.ep.split(':').map(Number);
    const on = !isWatched(sid, eid);
    t.setAttribute('aria-pressed', on);
    await setWatched(sid, [eid], on);
    if (!$('#sheet').hidden && sheetShow?.id === sid) renderSheet();
    else setTimeout(render, 350); // let the tick show before the row moves on
  }
});
window.addEventListener('popstate', () => {
  const m = location.hash.match(/^#sorozat-(\d+)$/);
  const f = location.hash.match(/^#film-(.+)$/), mv = location.hash.match(/^#mozi-(\d+)$/), wf = location.hash.match(/^#wfilm-(Q\d+)$/);
  if (m) openShow(+m[1], false);
  else if (wf) openWikiFilm(wf[1], false);
  else if (f) openFilm(decodeURIComponent(f[1]), false);
  else if (mv) openMovie(+mv[1], false);
  else if (location.hash === '#beallitasok') openSettings(false);
  else closeShow();
});
window.addEventListener('scroll', () => $('#top').classList.toggle('scrolled', scrollY > 4), { passive: true });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) history.back(); });
wide.addEventListener('change', () => {
  document.body.style.overflow = '';
  if (sheetOpen()) { if (!wide.matches) document.body.style.overflow = 'hidden'; return; }
  if (wide.matches) renderPlaceholder(); else $('#sheet').hidden = true;
  render();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncWorkerData(); });


/* ---------- global error handling and offline notice ---------- */
let lastErrorToast = 0;
function reportError(err) {
  console.error(err);
  if (Date.now() - lastErrorToast > 5000) { lastErrorToast = Date.now(); toast(tr('Váratlan hiba történt. Ha ismétlődik, töltsd újra az appot.')); }
}
window.addEventListener('error', e => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', e => reportError(e.reason));
function updateOnline() {
  let bar = document.getElementById('offline');
  if (navigator.onLine) { bar?.remove(); return; }
  if (!bar) { bar = Object.assign(document.createElement('div'), { id: 'offline', className: 'offline', role: 'status' }); document.body.appendChild(bar); }
  bar.textContent = tr('Nincs internetkapcsolat. A korábban betöltött adatok látszanak.');
}
window.addEventListener('online', () => { updateOnline(); render(); });
window.addEventListener('offline', updateOnline);
