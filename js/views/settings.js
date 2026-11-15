// Sorozatnapló · Settings sheet: language, appearance, services, notifications, TMDB key.
'use strict';

/* ---------- Settings ---------- */
function openSettings(push = true) {
  if (push) history.pushState({ settings: 1 }, '', '#beallitasok');
  const sh = $('#sheet'); sh.hidden = false; sh.scrollTop = 0; sheetShow = null;
  if (!wide.matches) document.body.style.overflow = 'hidden';
  renderSettings();
}
async function renderSettings() {
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => null) : null;
  const bg = !!(reg && 'periodicSync' in reg);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let notifNote;
  if (perm === 'unsupported') notifNote = tr('Ez a böngésző nem támogat értesítéseket. iPhone-on előbb tedd ki az appot a főképernyőre, és onnan nyisd meg.');
  else if (perm === 'denied') notifNote = tr('Az értesítések le vannak tiltva ennél az oldalnál. A böngésző vagy a telefon beállításaiban tudod engedélyezni.');
  else if (bg) notifNote = tr('A telefon a háttérben is ellenőrzi az új részeket. A gyakoriságot a rendszer dönti el, általában naponta egyszer.');
  else notifNote = standalone ? tr('Ezen az eszközön a háttérben futó ellenőrzés nem támogatott, ezért az új részeket az app megnyitásakor jelezzük („ÚJ” jelölés és üzenet).')
    : tr('A háttérben futó ellenőrzéshez telepítsd az appot a kezdőképernyőre (Androidon Chrome-mal). Addig az új részeket megnyitáskor jelezzük.');
  $('#sheet').innerHTML = `<div class="sheet-bar">${closeBtnHtml()}</div>
    <div class="sheet-body"><h2 style="font:800 26px/1.1 var(--font-display);margin:0">${tr('Beállítások')}</h2>
    ${appearancePanels()}
    <div class="panel"><h3>${tr('Szolgáltatóim')}</h3><p>${tr('Jelöld be, mire fizetsz elő, vagy mit nézel ingyen. Ezeket kiemeljük a kezdőlapon és az adatlapokon.')}</p>
      <div class="chips">${SERVICES.map(s => `<button class="chip" data-service="${s.id}" aria-pressed="${state.services.includes(s.id)}">${ICON.check}${esc(s.name)}${s.free ? ` <span style="opacity:.7">(${tr('ingyenes is')})</span>` : ''}</button>`).join('')}</div></div>
    <div class="panel"><h3>${tr('Értesítés új részekről')}</h3><p>${esc(notifNote)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${perm === 'unsupported' || perm === 'denied' ? '' :
        state.notify && perm === 'granted'
          ? `<button class="btn ghost" data-notify="off">${tr('Értesítések kikapcsolása')}</button><button class="btn soft" data-notify="test">${tr('Próbaértesítés')}</button>`
          : `<button class="btn primary" data-notify="on">${tr('Értesítések bekapcsolása')}</button>`}</div></div>
    <div class="panel"><h3>${tr('Előzetesek és mozifilmek (TMDB-kulcs)')}</h3>
      <p>${tr(tmdbKey() ? 'A kulcs be van állítva: az előzetesek az appban indulnak, és látod a mozibemutatókat.' : 'Egy ingyenes kulccsal az előzetesek az appban indulnak, és megjelennek a magyar mozibemutatók is.')}</p>
      ${tmdbKey() ? '' : tmdbHelpHtml()}
      <div class="field"><input id="tmdbKey" type="password" autocomplete="off" spellcheck="false" placeholder="${tr('API Key vagy API Read Access Token')}" value="${esc(state.tmdb || '')}" aria-label="${tr('TMDB-kulcs')}">
        <button class="btn primary" data-tmdb="save">${tr('Mentés')}</button>${tmdbKey() ? `<button class="btn ghost" data-tmdb="clear">${tr('Törlés')}</button>` : ''}</div>
      <p id="tmdbMsg" aria-live="polite"></p></div>
    ${backupPanel()}
    </div>`;
}
function appearancePanels() {
  const th = state.theme;
  const chip = (attr, val, cur, label, extra = '') => `<button class="chip" ${attr}="${val}" aria-pressed="${cur === val}">${ICON.check}${extra}${esc(label)}</button>`;
  const swatch = k => `<span style="width:14px;height:14px;border-radius:7px;background:${ACCENTS[k][document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'][0]};display:inline-block"></span>`;
  return `<div class="panel"><h3>${tr('Nyelv')}</h3><div class="chips">
      ${[['hu', 'Magyar'], ['en', 'English'], ['de', 'Deutsch']].map(([k, l]) => chip('data-lang', k, state.lang, l)).join('')}</div></div>
    <div class="panel"><h3>${tr('Megjelenés')}</h3>
      <span class="label">${tr('Mód')}</span><div class="chips">${[['system', 'Rendszer'], ['light', 'Világos'], ['dark', 'Sötét']].map(([k, l]) => chip('data-mode', k, th.mode, tr(l))).join('')}</div>
      <span class="label">${tr('Kiemelőszín')}</span><div class="chips">${[['blue', 'Kék'], ['violet', 'Lila'], ['green', 'Smaragd'], ['orange', 'Narancs'], ['pink', 'Rózsa'], ['red', 'Piros']].map(([k, l]) => chip('data-accent', k, th.accent, tr(l), swatch(k))).join('')}</div>
      <div class="chips"><button class="chip" data-oled aria-pressed="${!!th.oled}">${ICON.check}${tr('Teljesen fekete háttér sötét módban (OLED-kijelzőn kíméli az akkut)')}</button></div>
      <span class="label">${tr('Szövegméret')}</span><div class="chips">${[['small', 'Kicsi'], ['normal', 'Normál'], ['large', 'Nagy']].map(([k, l]) => chip('data-size', k, th.size, tr(l))).join('')}</div>
    </div>`;
}
function setAppearance(kind, val) {
  if (kind === 'lang') { state.lang = val; save(); applyStaticI18n(); }
  else { if (kind === 'oled') state.theme.oled = !state.theme.oled; else state.theme[kind] = val; save(); applyTheme(); }
  renderSettings();
  render();
}
async function saveTmdb(clear) {
  const msg = $('#tmdbMsg');
  if (clear) { state.tmdb = ''; save(); toast(tr('TMDB-kulcs törölve')); return renderSettings(); }
  const k = ($('#tmdbKey')?.value || '').trim();
  if (!k) { msg.textContent = tr('Illeszd be a kulcsot a mezőbe.'); return; }
  msg.textContent = tr('Kulcs ellenőrzése…');
  const bearer = k.length > 40;
  try {
    const r = await fetch(`${TMDB}/configuration${bearer ? '' : '?api_key=' + encodeURIComponent(k)}`, { headers: bearer ? { Authorization: 'Bearer ' + k } : {} });
    if (r.status === 401) { msg.textContent = tr('Ez a kulcs nem érvényes. Ellenőrizd, hogy a teljes kulcsot másoltad-e be.'); return; }
    if (!r.ok) throw new Error();
  } catch { msg.textContent = tr('Nem sikerült ellenőrizni a kulcsot. Ellenőrizd az internetkapcsolatot.'); return; }
  state.tmdb = k; save(); toast(tr('TMDB-kulcs elmentve')); renderSettings();
}
async function setNotify(on) {
  if (!on) { state.notify = false; save(); toast(tr('Értesítések kikapcsolva')); return renderSettings(); }
  const perm = await Notification.requestPermission().catch(() => 'denied');
  if (perm !== 'granted') { toast(tr('Az értesítések nincsenek engedélyezve')); return renderSettings(); }
  state.notify = true; save();
  try { const c = await caches.open('sn-data'); await c.put('sn-check.json', new Response(JSON.stringify({ last: Date.now() }))); } catch {}
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) await reg.periodicSync.register('new-episodes', { minInterval: 12 * H });
  } catch {}
  toast(tr('Értesítések bekapcsolva'));
  renderSettings();
}
async function testNotify() {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('Sorozatnapló', { body: tr('Így fog kinézni, ha új rész jelenik meg egy követett sorozatodból.'), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'test' });
  } catch { toast(tr('A próbaértesítés nem sikerült ezen az eszközön')); }
}
