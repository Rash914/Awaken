// Tiny DOM builder. Text always goes through text nodes (never innerHTML) - no XSS from user data.
export function h(tag, props = {}, ...children) {
  const svg = tag.startsWith('svg:');
  const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value' && !svg) el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const fmtTime = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const fmtNum = (n) => Number(n).toLocaleString();

export function bar(ratio, cls = '') {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return h('div', { class: `bar ${cls}`, role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { class: 'bar-fill', style: { width: `${pct}%` } }));
}

export function win(title, body, { cls = '', tag = '' } = {}) {
  return h('section', { class: `win ${cls}` },
    h('header', { class: 'win-h' }, h('span', { class: 'win-t' }, title), tag ? h('span', { class: 'win-tag' }, tag) : null),
    h('div', { class: 'win-b' }, body));
}

export function stepper(value, { min = 0, max = 999, onChange, label = 'value' }) {
  const input = h('input', { type: 'number', inputmode: 'numeric', min, max, value, 'aria-label': label, class: 'step-in' });
  const set = (v) => {
    const n = Math.max(min, Math.min(max, Math.floor(Number(v) || 0)));
    input.value = n;
    onChange?.(n);
  };
  input.addEventListener('change', () => set(input.value));
  input.addEventListener('focus', () => input.select());
  return h('div', { class: 'stepper' },
    h('button', { class: 'btn icon', type: 'button', 'aria-label': `decrease ${label}`, onClick: () => set(Number(input.value) - 1) }, '−'),
    input,
    h('button', { class: 'btn icon', type: 'button', 'aria-label': `increase ${label}`, onClick: () => set(Number(input.value) + 1) }, '+'));
}

export function segmented(options, value, onPick, name) {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name },
    options.map((o) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(o.value === value),
      class: ['seg-b', o.value === value && 'on'], onClick: () => onPick(o.value),
    }, o.label)));
}

export function toggle(label, checked, onChange, hint) {
  const id = `t-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return h('label', { class: 'row toggle', for: id },
    h('span', { class: 'grow' }, h('span', {}, label), hint ? h('small', { class: 'muted block' }, hint) : null),
    h('input', { id, type: 'checkbox', role: 'switch', checked, onChange: (e) => onChange(e.target.checked) }),
    h('span', { class: 'switch', 'aria-hidden': 'true' }));
}
