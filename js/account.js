// Popcorn · Accounts: Firebase sign-in (Google or e-mail + password) and cloud sync of the user's own data.
// Synced: series list, watched episodes, ratings, films, favourites, services. Theme, language and the TMDB key stay per device.
// The Firebase SDK is loaded only when a project is configured (js/firebase-config.js) and the user needs it.
'use strict';

const FB_VERSION = '10.12.2';
const SYNC_FIELDS = ['follows', 'watched', 'ratings', 'movies', 'favs', 'services'];
const acct = { ready: false, loading: null, user: null, status: 'off', error: '', lastSync: 0, ref: null, unsub: null, lastPushed: '', timer: 0 };
const fbConfigured = () => !!(window.FIREBASE_CONFIG?.apiKey && window.FIREBASE_CONFIG?.projectId);
const DEVICE_ID = (() => {
  let id = ls.get('sn.device', null);
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); ls.set('sn.device', id); }
  return id;
})();

/* ---------- data helpers ---------- */
const localData = () => JSON.parse(JSON.stringify(Object.fromEntries(SYNC_FIELDS.map(k => [k, state[k] ?? (k === 'services' ? [] : {})]))));
/** Union of two data sets, used once per sign-in so nothing from either side is lost. */
function mergeData(a, b) {
  const out = { follows: { ...(b.follows || {}), ...(a.follows || {}) }, watched: {}, ratings: { ...(b.ratings || {}) }, movies: { ...(b.movies || {}) }, favs: { ...(b.favs || {}), ...(a.favs || {}) },
    services: [...new Set([...(a.services || []), ...(b.services || [])])] };
  const real = t => (t > 1e12 ? t : Infinity);
  for (const sid of new Set([...Object.keys(a.watched || {}), ...Object.keys(b.watched || {})])) {
    const x = a.watched?.[sid] || {}, y = b.watched?.[sid] || {}, m = {};
    for (const eid of new Set([...Object.keys(x), ...Object.keys(y)])) {
      const best = Math.min(real(x[eid]), real(y[eid]));   // keep the earliest known date
      m[eid] = best === Infinity ? 1 : best;
    }
    out.watched[sid] = m;
  }
  for (const [k, r] of Object.entries(a.ratings || {})) if (!out.ratings[k] || (r.at || 0) >= (out.ratings[k].at || 0)) out.ratings[k] = r;
  const mvTime = m => Math.max(m.seenAt || 0, m.added || 0);
  for (const [k, m] of Object.entries(a.movies || {})) if (!out.movies[k] || mvTime(m) >= mvTime(out.movies[k])) out.movies[k] = m;
  return out;
}
/** Takes data from the cloud without sending it straight back. */
function applyData(d) {
  SYNC_FIELDS.forEach(k => { if (d[k] !== undefined) state[k] = d[k]; });
  acct.lastPushed = JSON.stringify(localData());
  ls.set('sn.state', state); updateBadge(); syncWorkerData();
  render();
  refreshAccountUI();
  if (!$('#sheet').hidden && sheetShow) renderSheet();
}

/* ---------- Firebase ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src, async: false }); s.onload = res; s.onerror = () => rej(new Error('script')); document.head.appendChild(s); });
}
function initAccounts() {
  if (!fbConfigured()) return Promise.resolve();
  if (acct.loading) return acct.loading;
  acct.status = 'loading';
  acct.loading = (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
    await loadScript(base + 'firebase-app-compat.js');
    await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]);
    firebase.initializeApp(window.FIREBASE_CONFIG);
    acct.auth = firebase.auth(); acct.db = firebase.firestore();
    acct.auth.languageCode = state.lang;
    try { await acct.auth.getRedirectResult(); } catch (e) { acct.error = authErrorText(e); }
    acct.ready = true;
    acct.auth.onAuthStateChanged(onUser);
  })().catch(() => {
    acct.loading = null; acct.status = 'error';
    acct.error = 'Nem sikerült betölteni a bejelentkezést. Ellenőrizd az internetkapcsolatot.';
    refreshAccountUI();
  });
  return acct.loading;
}
async function onUser(user) {
  acct.unsub?.(); acct.unsub = null; acct.user = user; acct.ref = null;
  if (!user) { acct.status = 'out'; ls.set('sn.acct', 0); refreshAccountUI(); return; }
  ls.set('sn.acct', 1);
  acct.status = 'syncing'; acct.error = ''; refreshAccountUI();
  acct.ref = acct.db.collection('users').doc(user.uid);
  try {
    const snap = await acct.ref.get();
    const remote = snap.exists ? snap.data()?.data : null;
    const merged = remote ? mergeData(localData(), remote) : localData();
    applyData(merged);
    await pushNow(true);
    acct.unsub = acct.ref.onSnapshot(s => {
      if (s.metadata.hasPendingWrites || !s.exists) return;
      const d = s.data();
      if (!d?.data || d.device === DEVICE_ID) return;
      if (JSON.stringify(d.data) === JSON.stringify(localData())) return;
      applyData(d.data);   // another device changed something: take its version
      acct.lastSync = Date.now(); acct.status = 'in'; refreshAccountUI();
      toast(tr('Frissítve egy másik eszközödről'));
    }, () => { acct.status = 'error'; acct.error = 'A szinkronizálás megszakadt. Próbáld újra később.'; refreshAccountUI(); });
  } catch (e) {
    acct.status = 'error'; acct.error = syncErrorText(e); refreshAccountUI();
  }
}
async function pushNow(force = false) {
  if (!acct.ref) return;
  const data = localData(), json = JSON.stringify(data);
  if (!force && json === acct.lastPushed) return;
  acct.status = 'syncing'; refreshAccountUI();
  try {
    await acct.ref.set({ data, updated: firebase.firestore.FieldValue.serverTimestamp(), device: DEVICE_ID });
    acct.lastPushed = json; acct.lastSync = Date.now(); acct.status = 'in'; acct.error = '';
  } catch (e) { acct.status = 'error'; acct.error = syncErrorText(e); }
  refreshAccountUI();
}
/** Called after every local save (see theme.js); sends the change after a short pause. */
function cloudSave() {
  if (!acct.ref) return;
  clearTimeout(acct.timer);
  acct.timer = setTimeout(() => pushNow(), 1500);
}
// on start: reconnect only if this device was signed in before
if (fbConfigured() && ls.get('sn.acct', 0) === 1) initAccounts();

/* ---------- actions ---------- */
function authErrorText(e) {
  const c = e?.code || '';
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
  return ({
    'auth/invalid-email': 'Ez nem érvényes e-mail-cím.',
    'auth/missing-password': 'Add meg a jelszót.',
    'auth/invalid-credential': 'Hibás e-mail-cím vagy jelszó.', 'auth/wrong-password': 'Hibás e-mail-cím vagy jelszó.', 'auth/user-not-found': 'Hibás e-mail-cím vagy jelszó.',
    'auth/email-already-in-use': 'Ezzel az e-mail-címmel már van fiók. Jelentkezz be, vagy kérj új jelszót.',
    'auth/weak-password': 'A jelszó legyen legalább 6 karakter.',
    'auth/too-many-requests': 'Túl sok próbálkozás. Várj egy kicsit, és próbáld újra.',
    'auth/network-request-failed': 'Nincs internetkapcsolat.',
    'auth/unauthorized-domain': 'Ez az oldal nincs engedélyezve a Firebase-projektben (Authentication → Settings → Authorized domains).',
    'auth/operation-not-allowed': 'Ez a bejelentkezési mód nincs bekapcsolva a Firebase-projektben.',
    'auth/configuration-not-found': 'Ez a bejelentkezési mód nincs bekapcsolva a Firebase-projektben.',
    'auth/requires-recent-login': 'Biztonsági okból jelentkezz be újra, és utána próbáld meg ismét.',
    'auth/popup-blocked': 'A böngésző letiltotta a felugró ablakot. Engedélyezd, vagy próbáld újra.'
  })[c] || 'A bejelentkezés nem sikerült. Próbáld újra.';
}
const syncErrorText = e => e?.code === 'permission-denied'
  ? 'A felhőben nincs jogosultság az adataidhoz. Ellenőrizd a Firestore szabályait (firestore.rules).'
  : 'A szinkronizálás nem sikerült. Ellenőrizd az internetkapcsolatot.';
function acctMsg(text, ok = false) {
  const el = $('#acctMsg');
  if (el) { el.textContent = text ? tr(text) : ''; el.className = 'acct-msg' + (ok ? ' ok' : ''); }
}
const acctCreds = () => ({ email: ($('#acctEmail')?.value || '').trim(), pass: $('#acctPass')?.value || '' });
async function accountAction(kind) {
  await initAccounts();
  if (!acct.ready) return;
  const { email, pass } = acctCreds();
  acctMsg('');
  try {
    if (kind === 'google') {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try { await acct.auth.signInWithPopup(provider); }
      catch (e) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) await acct.auth.signInWithRedirect(provider);
        else throw e;
      }
    } else if (kind === 'login') {
      if (!email || !pass) { acctMsg('Add meg az e-mail-címet és a jelszót.'); return; }
      await acct.auth.signInWithEmailAndPassword(email, pass);
    } else if (kind === 'register') {
      if (!email || !pass) { acctMsg('Add meg az e-mail-címet és a jelszót.'); return; }
      const cred = await acct.auth.createUserWithEmailAndPassword(email, pass);
      cred.user?.sendEmailVerification().catch(() => {});
      toast(tr('Fiók létrehozva. Küldtünk egy megerősítő e-mailt.'));
    } else if (kind === 'reset') {
      if (!email) { acctMsg('Írd be az e-mail-címedet, és utána kattints újra.'); $('#acctEmail')?.focus(); return; }
      acct.auth.languageCode = state.lang;   // the e-mail arrives in the app's language
      await acct.auth.sendPasswordResetEmail(email);
      // Firebase never reveals whether an account exists, so explain the usual reasons for a missing e-mail
      acctMsg(tr('Ha a(z) {email} címmel van jelszavas fiók, pár percen belül megérkezik a levél. Nézd meg a Spam és a Promóciók mappát is (feladó: {from}). Ha Google-lel regisztráltál, nincs jelszavad: lépj be a Google-gombbal.',
        { email, from: `noreply@${window.FIREBASE_CONFIG.authDomain}` }), true);
    } else if (kind === 'logout') {
      clearTimeout(acct.timer); await pushNow();
      await acct.auth.signOut();
      toast(tr('Kijelentkeztél. Az adataid ezen az eszközön megmaradtak.'));
    } else if (kind === 'sync') {
      await pushNow(true);
    } else if (kind === 'delete') {
      if (!confirm(tr('Biztosan törlöd a fiókodat? A felhőben tárolt adataid véglegesen törlődnek, ez nem vonható vissza. Ezen az eszközön az adatok megmaradnak.'))) return;
      acct.unsub?.(); acct.unsub = null;
      await acct.ref?.delete();
      await acct.auth.currentUser.delete();
      toast(tr('A fiókod törölve.'));
    }
  } catch (e) {
    const t = authErrorText(e);
    if (t) acctMsg(t);
    if (kind === 'delete' && acct.user) onUser(acct.user);
  }
}

/* ---------- settings panel ---------- */
const GOOGLE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>';
function accountPanel() {
  const head = `<h3>${tr('Fiók')}</h3>`;
  if (!fbConfigured()) {
    return `<div class="panel acct" id="acctPanel">${head}<p>${tr('A fiókokhoz és a szinkronizáláshoz még be kell állítani a Firebase-projektet (lásd a README „Fiókok beállítása” részét). Addig az adataid ezen az eszközön vannak, és fájlba menthetők.')}</p></div>`;
  }
  if (!acct.ready && acct.status !== 'error') {
    initAccounts();
    return `<div class="panel acct" id="acctPanel">${head}<div class="skel" style="height:44px"></div></div>`;
  }
  const u = acct.user;
  if (u) {
    const name = u.displayName || u.email || tr('Felhasználó');
    const status = acct.status === 'syncing' ? tr('Szinkronizálás…')
      : acct.status === 'error' ? tr(acct.error)
      : acct.lastSync ? tr('Szinkronizálva: {t}', { t: new Date(acct.lastSync).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' }) }) : '';
    return `<div class="panel acct" id="acctPanel">${head}
      <div class="acct-user">${u.photoURL ? `<img class="avatar" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(name.slice(0, 1).toUpperCase())}</span>`}
        <div style="min-width:0"><b>${esc(name)}</b>${u.email && u.displayName ? `<small>${esc(u.email)}</small>` : ''}
        <small class="acct-status${acct.status === 'error' ? ' err' : ''}">${esc(status)}</small></div></div>
      <p>${tr('A listád, a filmjeid, az értékeléseid és a megnézett részek minden eszközödön ugyanazok, ahol ezzel a fiókkal belépsz.')}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-acct="sync">${tr('Szinkronizálás most')}</button><button class="btn ghost" data-acct="logout">${tr('Kijelentkezés')}</button></div>
      <p id="acctMsg" class="acct-msg" aria-live="polite"></p>
      <button class="linkbtn danger" data-acct="delete">${tr('Fiók törlése')}</button></div>`;
  }
  return `<div class="panel acct" id="acctPanel">${head}
    <p>${tr('Jelentkezz be, és a listád, a filmjeid, az értékeléseid és a megnézett részek minden eszközödön ugyanazok lesznek. Belépéskor az ezen az eszközön lévő adataid is bekerülnek a fiókba.')}</p>
    <button class="btn gbtn" data-acct="google">${GOOGLE_ICON}${tr('Belépés Google-fiókkal')}</button>
    <div class="or"><span>${tr('vagy')}</span></div>
    <form class="acct-form" onsubmit="return false">
      <input id="acctEmail" type="email" autocomplete="email" inputmode="email" placeholder="${tr('E-mail-cím')}" aria-label="${tr('E-mail-cím')}">
      <input id="acctPass" type="password" autocomplete="current-password" placeholder="${tr('Jelszó (legalább 6 karakter)')}" aria-label="${tr('Jelszó')}">
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-acct="login" type="submit">${tr('Belépés')}</button><button class="btn ghost" data-acct="register" type="button">${tr('Regisztráció')}</button></div>
    </form>
    <button class="linkbtn" data-acct="reset">${tr('Elfelejtett jelszó')}</button>
    <p id="acctMsg" class="acct-msg${acct.error ? '' : ''}" aria-live="polite">${acct.error ? esc(tr(acct.error)) : ''}</p></div>`;
}
function refreshAccountUI() {
  const p = $('#acctPanel');
  if (!p) return;
  const email = $('#acctEmail')?.value, pass = $('#acctPass')?.value;
  p.outerHTML = accountPanel();
  if (email && $('#acctEmail')) $('#acctEmail').value = email;
  if (pass && $('#acctPass')) $('#acctPass').value = pass;
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-acct]');
  if (!b) return;
  e.preventDefault();
  accountAction(b.dataset.acct);
});
