// Popcorn · Reusable filter bar with themed pop-up menus (bottom sheet on phones), remembered per device.
'use strict';

const FILTERS = Object.assign({}, ls.get('sn.filters', {}));
const fget = (id, def) => FILTERS[id] ?? def;
function fset(id, v) { FILTERS[id] = v; ls.set('sn.filters', FILTERS); }
/** Handlers per filter scope; a scope without a handler re-renders the current tab. */
const FILTER_HANDLERS = {};
/** Definitions of the filters currently on screen, by id. */
const FILTER_DEFS = {};

/**
 * items: [{ id, label, def, options: [[value, label], …] }]
 * Labels are translated; values are strings.
 */
function filterBar(scope, items) {
  const active = items.filter(it => String(fget(it.id, it.def)) !== String(it.def)).length;
  return `<div class="filters" data-fscope="${esc(scope)}" role="group" aria-label="${tr('Szűrők')}">
    ${items.map(it => {
      FILTER_DEFS[it.id] = { ...it, scope };
      const cur = String(fget(it.id, it.def));
      const curLabel = (it.options.find(([v]) => String(v) === cur) || it.options[0] || ['', ''])[1];
      return `<button type="button" class="fsel${cur !== String(it.def) ? ' on' : ''}" data-fopen="${esc(it.id)}" aria-haspopup="listbox" aria-expanded="false">
        <span>${esc(tr(it.label))}</span><b>${esc(tr(curLabel))}</b></button>`;
    }).join('')}
    ${active ? `<button class="linkbtn" data-freset="${esc(items.map(it => it.id).join(','))}">${tr('Alaphelyzet')}</button>` : ''}</div>`;
}
function runFilterScope(scope) { (FILTER_HANDLERS[scope] || render)(); }

/* ---------- pop-up menu ---------- */
let fmenu = null;
const phoneMenu = () => matchMedia('(max-width:600px)').matches;
function closeFilterMenu(focusBack = false) {
  if (!fmenu) return;
  const { el, shade, btn } = fmenu;
  el.remove(); shade?.remove();
  btn.setAttribute('aria-expanded', 'false');
  btn.classList.remove('open');
  if (focusBack && document.contains(btn)) btn.focus();
  fmenu = null;
}
function openFilterMenu(btn) {
  const id = btn.dataset.fopen, def = FILTER_DEFS[id];
  if (!def) return;
  if (fmenu?.btn === btn) { closeFilterMenu(); return; }
  closeFilterMenu();
  const cur = String(fget(id, def.def)), sheet = phoneMenu();
  const el = document.createElement('div');
  el.className = 'fmenu' + (sheet ? ' sheet-menu' : '');
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', tr(def.label));
  el.innerHTML = (sheet ? `<div class="fmenu-head">${esc(tr(def.label))}</div>` : '')
    + def.options.map(([v, l]) => `<button type="button" role="option" class="fopt" data-fpick="${esc(v)}" aria-selected="${String(v) === cur}">
        <span>${esc(tr(l))}</span>${String(v) === cur ? ICON.check : ''}</button>`).join('');
  let shade = null;
  if (sheet) { shade = Object.assign(document.createElement('div'), { className: 'fmenu-shade' }); document.body.appendChild(shade); }
  document.body.appendChild(el);
  if (!sheet) {
    const r = btn.getBoundingClientRect(), w = Math.max(r.width, el.offsetWidth);
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < Math.min(el.scrollHeight, 320) && above > below;
    el.style.minWidth = r.width + 'px';
    el.style.maxHeight = Math.max(160, Math.min(380, up ? above : below)) + 'px';
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    if (up) el.style.bottom = (innerHeight - r.top + 6) + 'px'; else el.style.top = (r.bottom + 6) + 'px';
  }
  btn.setAttribute('aria-expanded', 'true');
  btn.classList.add('open');
  fmenu = { el, shade, btn, id };
  (el.querySelector('[aria-selected="true"]') || el.querySelector('.fopt'))?.focus({ preventScroll: true });
}
function pickFilter(value) {
  if (!fmenu) return;
  const { id, btn } = fmenu, def = FILTER_DEFS[id];
  closeFilterMenu();
  if (String(fget(id, def.def)) === String(value)) { btn.focus(); return; }
  fset(id, value);
  runFilterScope(def.scope);
}

document.addEventListener('click', e => {
  const open = e.target.closest?.('[data-fopen]');
  if (open) { e.preventDefault(); openFilterMenu(open); return; }
  const pick = e.target.closest?.('[data-fpick]');
  if (pick && fmenu) { e.preventDefault(); pickFilter(pick.dataset.fpick); return; }
  if (fmenu && !e.target.closest('.fmenu')) closeFilterMenu();
  const b = e.target.closest?.('[data-freset]');
  if (!b) return;
  b.dataset.freset.split(',').forEach(id => delete FILTERS[id]);
  ls.set('sn.filters', FILTERS);
  runFilterScope(b.closest('[data-fscope]')?.dataset.fscope);
});
document.addEventListener('keydown', e => {
  if (!fmenu) return;
  const opts = [...fmenu.el.querySelectorAll('.fopt')], i = opts.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFilterMenu(true); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)]?.focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(0, i - 1)]?.focus(); }
  else if (e.key === 'Home') { e.preventDefault(); opts[0]?.focus(); }
  else if (e.key === 'End') { e.preventDefault(); opts[opts.length - 1]?.focus(); }
  else if (e.key === 'Tab') closeFilterMenu();
}, true);
// a desktop menu sticks to its button, so it closes when the page moves under it
['resize', 'scroll'].forEach(ev => addEventListener(ev, e => {
  if (fmenu && !fmenu.el.classList.contains('sheet-menu') && !(e.target instanceof Element && e.target.closest?.('.fmenu'))) closeFilterMenu();
}, true));
