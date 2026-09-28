// "System" notification windows: a promise-based, queued modal (one at a time), plus toasts.
import { h } from './dom.js';
import { sfx } from '../services/audio.js';

let chain = Promise.resolve();

/**
 * @param {{title?:string, lines?:(string|Node)[], tone?:'info'|'danger'|'gold', actions?:{label:string, value:any, primary?:boolean, danger?:boolean}[]}} o
 * @returns {Promise<any>} value of the chosen action (undefined on dismiss)
 */
export function systemAlert(o) {
  const run = () => new Promise((resolve) => {
    const actions = o.actions?.length ? o.actions : [{ label: 'OK', value: true, primary: true }];
    const prev = document.activeElement;
    const close = (v) => {
      root.classList.add('out');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { root.remove(); prev?.focus?.(); resolve(v); }, 160);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(undefined); };
    const root = h('div', { class: `sys-overlay tone-${o.tone || 'info'}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Notification' },
      h('div', { class: 'sys-win' },
        h('div', { class: 'sys-head' }, h('span', { class: 'sys-icon', 'aria-hidden': 'true' }, o.tone === 'danger' ? '!' : 'i'), h('span', {}, o.title || 'NOTIFICATION')),
        h('div', { class: 'sys-body' }, (o.lines || []).map((l) => (l instanceof Node ? l : h('p', {}, l)))),
        h('div', { class: 'sys-actions' }, actions.map((a) =>
          h('button', { class: ['btn', a.primary && 'primary', a.danger && 'danger'], type: 'button', onClick: () => close(a.value) }, a.label)))));
    root.addEventListener('click', (e) => { if (e.target === root && !o.modal) close(undefined); });
    document.addEventListener('keydown', onKey);
    document.body.append(root);
    sfx(o.tone === 'danger' ? 'alert' : 'notify');
    root.querySelector('.btn.primary, .btn')?.focus();
  });
  const p = chain.then(run);
  chain = p.catch(() => {});
  return p;
}

export async function systemConfirm(title, message, { confirm = 'Confirm', danger = false } = {}) {
  const v = await systemAlert({
    title, tone: danger ? 'danger' : 'info', lines: [message],
    actions: [{ label: 'Cancel', value: false }, { label: confirm, value: true, primary: !danger, danger }],
  });
  return v === true;
}

export function toast(text, ms = 2200) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
}
