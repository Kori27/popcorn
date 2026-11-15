// Popcorn · Colour mode, accent colours, OLED and text size.
'use strict';

/* ---------- themes ---------- */
const ACCENTS = {
  popcorn: { light: ['#E11D48', '#FDE2E8'], dark: ['#FF4D67', '#3A1721'] },
  blue:  { light: ['#3150D8', '#E2E7FD'], dark: ['#8196FF', '#232B55'] },
  violet: { light: ['#6D3FD1', '#ECE4FC'], dark: ['#B39BFF', '#2E2550'] },
  green:  { light: ['#0F7A5C', '#D7F0E6'], dark: ['#4CC9A0', '#15372D'] },
  orange: { light: ['#C2410C', '#FCE7DA'], dark: ['#FF9A5C', '#3D2616'] },
  pink:   { light: ['#C0266D', '#FBE1EE'], dark: ['#FF85BD', '#3D1A2C'] },
  red:    { light: ['#C62828', '#FBE0E0'], dark: ['#FF7B7B', '#3D1A1A'] }
};
const darkMq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const th = state.theme, root = document.documentElement;
  const dark = th.mode === 'dark' || (th.mode === 'system' && darkMq.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  const [acc, soft] = (ACCENTS[th.accent] || ACCENTS.popcorn)[dark ? 'dark' : 'light'];
  root.style.setProperty('--accent', acc);
  root.style.setProperty('--accent-soft', soft);
  const oled = dark && th.oled;
  [['--bg', '#000000'], ['--surface', '#0C0C10'], ['--surface-2', '#18181F'], ['--line', '#26262E']]
    .forEach(([k, v]) => oled ? root.style.setProperty(k, v) : root.style.removeProperty(k));
  document.body && (document.body.style.zoom = th.size === 'large' ? '1.12' : th.size === 'small' ? '0.92' : '');
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = bg; m.removeAttribute('media'); });
}
darkMq.addEventListener('change', () => state.theme.mode === 'system' && applyTheme());
applyTheme();
const prevVisit = state.lastVisit || Date.now();
const save = () => { ls.set('sn.state', state); updateBadge(); syncWorkerData(); };

