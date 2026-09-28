// Program calendar: every day of the 30/60/90 plan with cleared / missed / today state.
import { h, win, fmtTime } from '../ui/dom.js';
import { addDays, formatKey } from '../core/dates.js';
import { buildDayPlan, PHASES, phaseOf, dayType } from '../domain/program.js';
import { isQuestDone } from '../domain/quest.js';
import { DISCIPLINES } from '../data/drills.js';
import { EXERCISES } from '../data/exercises.js';
import { systemAlert } from '../ui/system.js';

const ICON = { boxing: 'B', muaythai: 'M', mixed: 'X', weapons: 'W', recovery: 'R' };

export function render({ state, today, info, pc }) {
  const { programDays, sessionMinutes, includeStrength } = state.settings;
  const start = state.program.startDate;
  const cleared = Array.from({ length: programDays }, (_, i) => isQuestDone(state, addDays(start, i))).filter(Boolean).length;

  const phases = PHASES.map((ph) => {
    const days = [];
    for (let d = 1; d <= programDays; d++) if (phaseOf(d, programDays) === ph.id) days.push(d);
    return win(`PHASE ${ph.id + 1} · ${ph.name.toUpperCase()}`, [
      h('p', { class: 'muted small' }, ph.focus),
      h('div', { class: 'cal' }, days.map((d) => {
        const date = addDays(start, d - 1);
        const done = isQuestDone(state, date);
        const past = date < today;
        const cls = ['cal-d', done && 'done', !done && past && 'miss', date === today && 'today', date > today && 'future', dayType(d) === 'recovery' && 'rest'];
        return h('button', {
          class: cls, type: 'button',
          'aria-label': `Day ${d}, ${formatKey(date)}, ${done ? 'cleared' : past ? 'missed' : date === today ? 'today' : 'upcoming'}`,
          onClick: () => showDay(d, date, { programDays, sessionMinutes, includeStrength }, done),
        }, h('span', { class: 'cal-n' }, d), h('span', { class: 'cal-i' }, ICON[dayType(d)]));
      })),
    ], { tag: `${ph.rank}-rank` });
  });

  return h('div', { class: 'stack' },
    win('PROGRAM', [
      h('div', { class: 'chips' },
        h('span', { class: 'chip' }, `Cycle ${state.program.cycle}`),
        h('span', { class: 'chip' }, `${programDays} days`),
        h('span', { class: 'chip' }, `Started ${formatKey(start, { day: 'numeric', month: 'short', year: 'numeric' })}`)),
      h('div', { class: 'chips' },
        h('span', { class: 'chip' }, `Cleared ${cleared}/${programDays}`),
        h('span', { class: 'chip' }, `Streak ${pc.streak}`),
        h('span', { class: 'chip' }, `Best ${pc.best}`),
        h('span', { class: 'chip' }, info.finished ? 'Finished' : `Today: day ${info.day}`)),
      h('div', { class: 'legend small muted' },
        h('span', {}, h('i', { class: 'lg done' }), 'Cleared'), h('span', {}, h('i', { class: 'lg miss' }), 'Missed'),
        h('span', {}, h('i', { class: 'lg today' }), 'Today'), h('span', {}, 'B box · M muay thai · X mixed · W weapons · R recovery')),
    ]),
    phases);
}

function showDay(d, date, opts, done) {
  const plan = buildDayPlan(d, opts);
  systemAlert({
    title: `DAY ${d} · ${plan.typeName.toUpperCase()}`,
    lines: [
      h('p', { class: 'muted small' }, `${formatKey(date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(plan.totalSeconds)}${done ? ' · CLEARED' : ''}`),
      h('ul', { class: 'q-list' }, plan.segments.map((s) => h('li', { class: 'q-line' },
        h('span', { class: 'dot', style: { background: s.kind === 'reps' ? 'var(--glow)' : DISCIPLINES[s.disc].color } }),
        h('span', { class: 'grow' }, s.kind === 'reps' ? EXERCISES[s.ex].name : s.title),
        h('span', { class: 'mono muted' }, s.kind === 'reps' ? 'reps' : fmtTime(s.seconds))))),
    ],
  });
}
