// Strength log: stage/level per exercise, quick log, 14-day chart, history.
import { h, win, stepper, segmented, fmtNum } from '../ui/dom.js';
import { EXERCISES, EXERCISE_IDS, stageOf } from '../data/exercises.js';
import { VIDEOS } from '../data/videos.js';
import { canAdvance } from '../domain/strength.js';
import { logManual, deleteLog, advanceStage, setStage } from '../domain/quest.js';
import { addDays, formatKey } from '../core/dates.js';
import { systemConfirm, toast } from '../ui/system.js';

const ui = { ex: 'pushup', reps: 10, chartEx: 'pushup' };

export function render(ctx) {
  return h('div', { class: 'stack' }, quickLog(ctx), EXERCISE_IDS.map((ex) => card(ctx, ex)), chart(ctx), history(ctx));
}

function quickLog({ store, today, refresh }) {
  return win('LOG A SET', [
    segmented(EXERCISE_IDS.map((id) => ({ value: id, label: EXERCISES[id].name })), ui.ex, (v) => { ui.ex = v; refresh(); }, 'Exercise'),
    h('div', { class: 'row gap' },
      stepper(ui.reps, { min: 1, max: 500, label: 'reps', onChange: (n) => { ui.reps = n; } }),
      h('button', { class: 'btn primary grow', onClick: () => {
        store.update((s) => logManual(s, { ex: ui.ex, reps: ui.reps, date: today }));
        toast(`+${ui.reps} ${EXERCISES[ui.ex].name} logged`);
      } }, 'LOG')),
    h('p', { class: 'muted small' }, 'Extra sets outside the quest also earn EXP and stats. Quest sets are logged automatically.'),
  ]);
}

function card({ state, store }, ex) {
  const def = EXERCISES[ex];
  const e = state.strength[ex];
  const stage = stageOf(ex, e.stage);
  const logs = state.logs.filter((l) => l.ex === ex);
  const total = logs.reduce((a, l) => a + l.reps, 0);
  const best = logs.filter((l) => l.stage === e.stage).reduce((a, l) => Math.max(a, l.reps), 0);
  const ready = canAdvance(ex, e);
  return win(def.name.toUpperCase(), [
    h('div', { class: 'row' },
      h('div', { class: 'grow' },
        h('div', {}, h('strong', {}, stage.name)),
        h('div', { class: 'muted small' }, `Stage ${e.stage + 1}/${def.stages.length}`, stage.advanceAt ? ` · advance at ${stage.advanceAt}/day` : ' · final stage')),
      h('div', { class: 'big-num glow mono', title: 'Daily target' }, e.target)),
    h('div', { class: 'chips' },
      h('span', { class: 'chip' }, `Lifetime ${fmtNum(total)}`),
      h('span', { class: 'chip' }, `Best set ${best}`),
      h('span', { class: 'chip' }, `+${def.stat}`)),
    ready ? h('button', { class: 'btn primary', onClick: async () => {
      if (await systemConfirm('CLASS ADVANCEMENT', `Advance to ${stageOf(ex, e.stage + 1).name}? Target resets to half.`, { confirm: 'Advance' })) store.update((s) => advanceStage(s, ex));
    } }, `Advance to ${stageOf(ex, e.stage + 1).name}`) : null,
    h('details', {},
      h('summary', {}, 'Form & settings'),
      h('ol', {}, stage.how.map((x) => h('li', {}, x))),
      stage.videos.map((id) => h('a', { class: 'video', href: `https://www.youtube.com/watch?v=${id}`, target: '_blank', rel: 'noopener noreferrer' },
        h('span', { class: 'play', 'aria-hidden': 'true' }, '▶'), h('span', {}, VIDEOS[id]?.title, h('small', { class: 'muted block' }, VIDEOS[id]?.author)))),
      h('label', { class: 'small muted' }, 'Variation (drop down if form breaks)'),
      h('select', { class: 'select', 'aria-label': `${def.name} variation`, onChange: (ev) => store.update((s) => setStage(s, ex, Number(ev.target.value))) },
        def.stages.map((s, i) => h('option', { value: i, selected: i === e.stage }, `${i + 1}. ${s.name}`))),
      h('label', { class: 'small muted' }, 'Daily target (auto-adjusts; override here)'),
      stepper(e.target, { min: 3, max: 60, label: `${def.name} target`, onChange: (n) => store.update((s) => { s.strength[ex].target = n; s.strength[ex].hits = 0; s.strength[ex].misses = 0; }) })),
  ]);
}

function chart({ state, today, refresh }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const vals = days.map((d) => state.logs.filter((l) => l.ex === ui.chartEx && l.date === d).reduce((a, l) => a + l.reps, 0));
  const max = Math.max(10, ...vals);
  const W = 280;
  const H = 110;
  const bw = W / days.length;
  const svg = h('svg:svg', { viewBox: `0 0 ${W} ${H + 16}`, class: 'chart', role: 'img', 'aria-label': `${EXERCISES[ui.chartEx].name} reps, last 14 days` },
    vals.map((v, i) => {
      const bh = (v / max) * H;
      return h('svg:g', {},
        h('svg:rect', { x: i * bw + 3, y: H - bh, width: bw - 6, height: Math.max(bh, v ? 2 : 0), rx: 2, class: days[i] === today ? 'bar-today' : 'bar-r' }),
        v ? h('svg:text', { x: i * bw + bw / 2, y: H - bh - 3, 'text-anchor': 'middle', class: 'bar-v' }, v) : null,
        i % 2 === 1 ? h('svg:text', { x: i * bw + bw / 2, y: H + 12, 'text-anchor': 'middle', class: 'bar-l' }, days[i].slice(8)) : null);
    }),
    h('svg:line', { x1: 0, x2: W, y1: H, y2: H, class: 'axis' }));
  return win('LAST 14 DAYS', [
    segmented(EXERCISE_IDS.map((id) => ({ value: id, label: EXERCISES[id].name })), ui.chartEx, (v) => { ui.chartEx = v; refresh(); }, 'Chart exercise'),
    svg,
  ]);
}

function history({ state, store }) {
  const items = [...state.logs].sort((a, b) => b.ts - a.ts).slice(0, 40);
  return win('HISTORY', items.length
    ? h('ul', { class: 'hist' }, items.map((l) => h('li', { class: 'row' },
      h('span', { class: 'grow' }, `${EXERCISES[l.ex].name} `, h('small', { class: 'muted' }, `${stageOf(l.ex, l.stage).name} · ${formatKey(l.date)} · ${l.src}`)),
      h('strong', { class: 'mono' }, l.reps),
      h('button', { class: 'btn icon sm', 'aria-label': 'Delete entry', onClick: async () => {
        if (await systemConfirm('DELETE ENTRY', `Delete ${l.reps} ${EXERCISES[l.ex].name} from ${formatKey(l.date)}?`, { confirm: 'Delete', danger: true })) store.update((s) => deleteLog(s, l.id));
      } }, '✕'))))
    : h('p', { class: 'muted' }, 'No sets yet. Clear a Daily Quest or log a set above.'));
}
