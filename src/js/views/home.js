// Status window + today's Daily Quest.
import { h, win, bar, fmtTime, fmtNum } from '../ui/dom.js';
import { STATS } from '../domain/leveling.js';
import { PHASES } from '../domain/program.js';
import { EXERCISES, EXERCISE_IDS, stageOf } from '../data/exercises.js';
import { DISCIPLINES } from '../data/drills.js';
import { canAdvance } from '../domain/strength.js';
import { advanceStage } from '../domain/quest.js';
import { systemConfirm } from '../ui/system.js';
import { activeSession } from './session.js';

export function render(ctx) {
  return h('div', { class: 'stack' }, statusWindow(ctx), questWindow(ctx), advancementBanner(ctx));
}

function statusWindow({ state, pc, title, info }) {
  const p = pc.progress;
  const phase = PHASES[info.plan.phase];
  return win('STATUS', [
    h('div', { class: 'status-top' },
      h('div', { class: 'lv' }, h('small', {}, 'LEVEL'), h('strong', { class: 'glow' }, p.level)),
      h('div', { class: 'who' },
        h('div', { class: 'name' }, state.profile.name),
        h('div', { class: 'muted small' }, 'Title: ', h('span', { class: 'gold' }, title)),
        h('div', { class: 'muted small' }, `Job: Hunter · ${phase.name} phase`)),
      h('div', { class: `rank rank-${p.rank.id}`, title: p.rank.name, 'aria-label': p.rank.name }, h('span', {}, p.rank.id))),
    h('div', { class: 'xp-row' }, h('span', { class: 'muted small' }, 'EXP'), bar(p.into / p.need, 'xp'), h('span', { class: 'small mono' }, `${fmtNum(p.into)}/${fmtNum(p.need)}`)),
    h('div', { class: 'stats' }, STATS.map((s) =>
      h('div', { class: 'stat', title: `${s.name} - from ${s.from}` }, h('span', { class: 'muted' }, s.id), h('strong', {}, p.stats[s.id])))),
    h('div', { class: 'chips' },
      h('span', { class: 'chip' }, `Streak ${pc.streak}d`),
      h('span', { class: 'chip' }, info.finished ? 'Program cleared' : `Day ${info.day}/${info.programDays}`),
      h('span', { class: 'chip' }, `Quests ${p.questsDone}`)),
  ], { tag: `${p.rank.name}` });
}

function segLine(seg, info, state) {
  if (seg.kind === 'reps') {
    const ex = EXERCISES[seg.ex];
    const stage = stageOf(seg.ex, state.strength[seg.ex].stage);
    return h('li', { class: 'q-line' },
      h('span', { class: 'dot', style: { background: 'var(--glow)' } }),
      h('span', { class: 'grow' }, `${ex.name} `, h('small', { class: 'muted' }, stage.name)),
      h('span', { class: 'mono' }, `[${info.targets[seg.ex]} reps]`));
  }
  return h('li', { class: 'q-line' },
    h('span', { class: 'dot', style: { background: DISCIPLINES[seg.disc].color } }),
    h('span', { class: 'grow' }, seg.title),
    h('span', { class: 'mono muted' }, fmtTime(seg.seconds)));
}

function questWindow(ctx) {
  const { info, state, go } = ctx;
  const active = activeSession();
  const body = [];
  if (info.finished) {
    body.push(h('div', { class: 'banner gold' },
      h('strong', {}, 'PROGRAM CLEARED'),
      h('p', {}, `You finished the ${info.programDays}-day program. Keep training below, or start a new cycle in Settings.`),
      h('button', { class: 'btn', onClick: () => go('settings') }, 'Start new cycle')));
  }
  if (info.penalty && !info.done) {
    body.push(h('div', { class: 'banner danger', role: 'alert' },
      h('strong', {}, 'PENALTY QUEST'),
      h('p', {}, 'Yesterday\'s quest was not cleared. Rep targets +20% today. Clear it to earn a Survivor bonus.')));
  }
  body.push(h('p', { class: 'q-goal' }, h('span', { class: 'muted' }, 'Goal: '), 'Complete every block. ', h('span', { class: 'muted' }, `${info.plan.typeName} · max ${Math.round(info.plan.budget / 60)} min`)));
  body.push(h('ul', { class: 'q-list' }, info.plan.segments.map((s) => segLine(s, info, state))));
  body.push(h('div', { class: 'q-total' }, h('span', { class: 'muted' }, 'Total'), h('span', { class: 'mono' }, fmtTime(info.plan.totalSeconds))));

  if (active) {
    body.push(h('button', { class: 'btn primary big', onClick: () => go('session') }, 'RESUME SESSION'));
  } else if (info.done) {
    body.push(h('div', { class: 'cleared' }, 'QUEST CLEARED'));
    body.push(h('button', { class: 'btn ghost', onClick: () => go('session') }, 'Train again (no quest bonus)'));
  } else {
    body.push(h('button', { class: 'btn primary big', onClick: () => go('session') }, 'START DAILY QUEST'));
    if (state.settings.penalty) body.push(h('p', { class: 'muted small center' }, 'WARNING: Skipping today triggers a Penalty Quest tomorrow.'));
  }
  return win(`DAILY QUEST · DAY ${info.day}`, body, { cls: info.penalty && !info.done ? 'danger' : '', tag: PHASES[info.plan.phase].rank + ' phase' });
}

function advancementBanner({ state, store }) {
  const ready = EXERCISE_IDS.filter((ex) => canAdvance(ex, state.strength[ex]));
  if (!ready.length) return null;
  return win('CLASS ADVANCEMENT', ready.map((ex) => {
    const cur = stageOf(ex, state.strength[ex].stage);
    const next = stageOf(ex, state.strength[ex].stage + 1);
    return h('div', { class: 'row' },
      h('span', { class: 'grow' }, `${EXERCISES[ex].name}: `, h('span', { class: 'muted' }, cur.name), ' → ', h('strong', { class: 'gold' }, next.name)),
      h('button', { class: 'btn primary', onClick: async () => {
        if (await systemConfirm('CLASS ADVANCEMENT', `Advance to ${next.name}? Your daily target resets to half while you learn the harder form.`, { confirm: 'Advance' })) {
          store.update((s) => advanceStage(s, ex));
        }
      } }, 'Advance'));
  }), { cls: 'gold' });
}
