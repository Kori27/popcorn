// Popcorn · localStorage wrapper and the persisted app state.
'use strict';

/* ---------- storage ---------- */
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch {
      try { // full: drop the API cache, keep the user's own data
        Object.keys(localStorage).filter(x => x.startsWith('sn.c.')).forEach(x => localStorage.removeItem(x));
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    }
  }
};
let state = ls.get('sn.state', null) || { follows: {}, watched: {} };
state.services = state.services || [];
state.notify = !!state.notify;
state.videaPlayerKey = state.videaPlayerKey || '';
state.videaOpenKey = state.videaOpenKey || '';
state.theme = Object.assign({ mode: 'system', accent: 'popcorn', oled: false, size: 'normal' }, state.theme);
// Popcorn redesign: the old default (blue) becomes the new Popcorn red once; any other choice is kept.
if (!state.theme.popcorn) { if (state.theme.accent === 'blue') state.theme.accent = 'popcorn'; state.theme.popcorn = 1; }
state.lang = state.lang || ((navigator.language || 'hu').slice(0, 2) === 'de' ? 'de' : (navigator.language || 'hu').slice(0, 2) === 'en' ? 'en' : 'hu');

