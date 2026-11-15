// Sorozatnapló · Reusable filter bar (compact native selects), remembered per device.
'use strict';

const FILTERS = Object.assign({}, ls.get('sn.filters', {}));
const fget = (id, def) => FILTERS[id] ?? def;
function fset(id, v) { FILTERS[id] = v; ls.set('sn.filters', FILTERS); }
/** Handlers per filter scope; a scope without a handler re-renders the current tab. */
const FILTER_HANDLERS = {};

/**
 * items: [{ id, label, def, options: [[value, label], …] }]
 * Labels are translated; values are strings.
 */
function filterBar(scope, items) {
  const active = items.filter(it => String(fget(it.id, it.def)) !== String(it.def)).length;
  return `<div class="filters" data-fscope="${esc(scope)}" role="group" aria-label="${tr('Szűrők')}">
    ${items.map(it => {
      const cur = String(fget(it.id, it.def));
      return `<label class="fsel${cur !== String(it.def) ? ' on' : ''}"><span>${esc(tr(it.label))}</span>
        <select data-filter="${esc(it.id)}" data-def="${esc(it.def)}">${it.options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === cur ? ' selected' : ''}>${esc(tr(l))}</option>`).join('')}</select></label>`;
    }).join('')}
    ${active ? `<button class="linkbtn" data-freset="${esc(items.map(it => it.id).join(','))}">${tr('Alaphelyzet')}</button>` : ''}</div>`;
}
function runFilterScope(scope) { (FILTER_HANDLERS[scope] || render)(); }

document.addEventListener('change', e => {
  const s = e.target.closest?.('[data-filter]');
  if (!s) return;
  fset(s.dataset.filter, s.value);
  runFilterScope(s.closest('[data-fscope]')?.dataset.fscope);
});
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-freset]');
  if (!b) return;
  b.dataset.freset.split(',').forEach(id => delete FILTERS[id]);
  ls.set('sn.filters', FILTERS);
  runFilterScope(b.closest('[data-fscope]')?.dataset.fscope);
});
