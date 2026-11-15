// Popcorn · Backup to a JSON file and restore from it (e.g. when changing phones).
'use strict';

const BACKUP_FIELDS = ['follows', 'watched', 'ratings', 'movies', 'favs', 'services', 'theme', 'lang', 'notify'];
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);

function exportBackup() {
  const data = Object.fromEntries(BACKUP_FIELDS.map(k => [k, state[k]]));  // the TMDB key is left out on purpose
  const body = JSON.stringify({ app: 'popcorn', format: 1, exported: new Date().toISOString(), data }, null, 1);
  const name = `popcorn-mentes-${today()}.json`;
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  state.lastBackup = Date.now(); save();
  toast(tr('Mentés letöltve: {f}', { f: name }));
  renderSettings();
}

async function importBackup(file) {
  if (!file) return;
  let b;
  try { b = JSON.parse(await file.text()); } catch { toast(tr('Ez a fájl nem olvasható. Válaszd a Popcorn által letöltött .json mentést.')); return; }
  const d = b?.data;
  if (!['popcorn', 'sorozatnaplo'].includes(b?.app) || !isObj(d) || !isObj(d.follows) || !isObj(d.watched)) { toast(tr('Ez nem Popcorn-mentés.')); return; }
  const follows = Object.fromEntries(Object.entries(d.follows).filter(([, f]) => isObj(f) && Number.isFinite(f.id) && typeof f.name === 'string'));
  const watched = Object.fromEntries(Object.entries(d.watched).filter(([, w]) => isObj(w)));
  const ratings = isObj(d.ratings) ? Object.fromEntries(Object.entries(d.ratings).filter(([, r]) => isObj(r) && r.stars >= 1 && r.stars <= 5)) : {};
  const movies = isObj(d.movies) ? Object.fromEntries(Object.entries(d.movies).filter(([, m]) => isObj(m) && (m.status === 'want' || m.status === 'seen'))) : {};
  const favs = isObj(d.favs) ? Object.fromEntries(Object.entries(d.favs).filter(([, f]) => isObj(f) && typeof f.title === 'string')) : {};
  const when = b.exported ? fmtDate(String(b.exported).slice(0, 10)) : '?';
  const ok = confirm(tr('Visszaállítod a {date} napon készült mentést?\n{a} sorozat, {b} film, {c} értékelés.\nA mostani adataid helyére kerül.',
    { date: when, a: Object.keys(follows).length, b: Object.keys(movies).length, c: Object.keys(ratings).length }));
  if (!ok) return;
  Object.assign(state, { follows, watched, ratings, movies, favs });
  if (Array.isArray(d.services)) state.services = d.services.filter(s => SERVICES.some(x => x.id === s));
  if (isObj(d.theme)) state.theme = Object.assign({}, state.theme, d.theme);
  if (['hu', 'en', 'de'].includes(d.lang)) state.lang = d.lang;
  save(); applyTheme(); applyStaticI18n();
  toast(tr('Visszaállítva: {n} sorozat', { n: Object.keys(follows).length }));
  renderSettings(); render();
}

const backupPanel = () => `<div class="panel"><h3>${tr('Mentés és visszaállítás')}</h3>
  <p>${tr('A listád, a filmjeid, az értékeléseid és a megnézett részek csak ezen az eszközön vannak. Ments róluk fájlt, és új telefonon töltsd vissza. A TMDB-kulcs nem kerül a mentésbe.')}</p>
  <p class="note">${state.lastBackup ? tr('Utolsó mentés: {d}', { d: fmtDate(ymd(new Date(state.lastBackup))) }) : tr('Még nem mentettél.')}</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-backup>${tr('Mentés fájlba')}</button>
    <label class="btn ghost" style="cursor:pointer">${tr('Visszaállítás fájlból')}<input type="file" accept="application/json,.json" data-restore hidden></label></div>
  <p class="note">${tr('Sorozatadatok: TVmaze. Filmadatok: Wikipédia, Wikidata és (kulccsal) TMDB.')}</p></div>`;

document.addEventListener('change', e => {
  if (!e.target.matches?.('[data-restore]')) return;
  importBackup(e.target.files?.[0]);
  e.target.value = '';
});
