// Awakening: System intro -> name -> assessment -> program -> safety -> awaken.
import { h, stepper, segmented } from '../ui/dom.js';
import { APP } from '../config.js';
import { EXERCISES, EXERCISE_IDS } from '../data/exercises.js';
import { VIDEOS } from '../data/videos.js';
import { awaken } from '../domain/quest.js';
import { initialTarget } from '../domain/strength.js';
import { unlockAudio, sfx } from '../services/audio.js';
import { systemAlert } from '../ui/system.js';

export const live = false;

const draft = {
  step: 0,
  name: '',
  maxes: { pushup: 15, squat: 25, crunch: 20 },
  stages: Object.fromEntries(EXERCISE_IDS.map((id) => [id, EXERCISES[id].defaultStage])),
  programDays: 90,
  sessionMinutes: 10,
  agreed: false,
};

let root;
let ctxRef;

export function render(ctx) {
  ctxRef = ctx;
  root = h('div', { class: 'awaken' });
  draw();
  return root;
}

const STEPS = [intro, nameStep, assessStep, programStep, safetyStep];

function draw() {
  const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, STEPS.map((_, i) => h('span', { class: i <= draft.step ? 'on' : '' })));
  root.replaceChildren(dots, STEPS[draft.step]());
  root.querySelector('input:not([type=checkbox]), .btn.primary')?.focus();
}

const nextBtn = (label = 'Next', ok = true) =>
  h('button', { class: 'btn primary big', disabled: !ok, onClick: () => { draft.step += 1; sfx('notify'); draw(); } }, label);
const backBtn = () => h('button', { class: 'btn ghost', onClick: () => { draft.step -= 1; draw(); } }, 'Back');

function panel(title, ...body) {
  return h('section', { class: 'win awaken-win' },
    h('header', { class: 'win-h' }, h('span', { class: 'win-t' }, title)),
    h('div', { class: 'win-b' }, body));
}

function intro() {
  const lines = [
    'A new Player has been detected.',
    'You have been granted access to the System.',
    'Each day it will issue a Daily Quest: under 10 minutes of boxing, Muay Thai, knife and stick drills, plus push-ups, squats and crunches.',
    'Clear quests to gain EXP, level up and climb from E-Rank to S-Rank.',
    'Will you accept?',
  ];
  const body = h('div', { class: 'typed' });
  lines.forEach((l, i) => body.append(h('p', { style: { animationDelay: `${i * 0.5}s` } }, l)));
  return panel('[ SYSTEM ]  NOTIFICATION',
    h('h1', { class: 'glow center brand-big' }, APP.name.toUpperCase()),
    h('p', { class: 'center muted small' }, APP.tagline),
    body,
    h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost', onClick: () => systemAlert({ title: 'SYSTEM', lines: ['Declining is not an option for a Player.', 'The System will wait.'] }) }, 'Decline'),
      h('button', { class: 'btn primary big grow', onClick: () => { unlockAudio(); draft.step = 1; sfx('levelup'); draw(); } }, 'ACCEPT')));
}

function nameStep() {
  const input = h('input', { class: 'text-in', maxlength: 24, value: draft.name, placeholder: 'Hunter name', autocomplete: 'nickname', 'aria-label': 'Player name' });
  const next = nextBtn('Next', draft.name.trim().length > 0);
  input.addEventListener('input', () => { draft.name = input.value; next.disabled = !input.value.trim(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) next.click(); });
  return panel('PLAYER REGISTRATION', h('p', {}, 'What should the System call you?'), input, h('div', { class: 'row gap' }, backBtn(), next));
}

function assessStep() {
  const rows = EXERCISE_IDS.map((id) => {
    const ex = EXERCISES[id];
    const target = h('small', { class: 'muted' });
    const upd = () => { target.textContent = `Starting daily target: ${initialTarget(draft.maxes[id])} reps`; };
    upd();
    const stageSel = h('select', { class: 'select', 'aria-label': `${ex.name} variation`, onChange: (e) => { draft.stages[id] = Number(e.target.value); draw(); } },
      ex.stages.map((s, i) => h('option', { value: i, selected: i === draft.stages[id] }, s.name)));
    const vid = ex.stages[draft.stages[id]].videos[0];
    return h('div', { class: 'assess' },
      h('div', { class: 'row' }, h('strong', { class: 'grow' }, ex.name), h('span', { class: 'chip' }, ex.stat)),
      h('label', { class: 'small muted' }, 'Hardest variation you can do with good form'),
      stageSel,
      h('label', { class: 'small muted' }, 'Max reps in ONE set (good form, no rest)'),
      stepper(draft.maxes[id], { min: 0, max: 300, label: `${ex.name} max reps`, onChange: (n) => { draft.maxes[id] = n; upd(); } }),
      target,
      h('a', { class: 'small', href: `https://www.youtube.com/watch?v=${vid}`, target: '_blank', rel: 'noopener noreferrer' }, `Form video: ${VIDEOS[vid]?.title || 'YouTube'}`));
  });
  return panel('ASSESSMENT',
    h('p', {}, 'Test each exercise once. Rest 2 minutes between tests. Not sure? Keep the defaults - the System adapts after every quest.'),
    rows,
    h('div', { class: 'row gap' }, backBtn(), nextBtn()));
}

function programStep() {
  const wrap = h('div');
  const paint = () => wrap.replaceChildren(
    h('p', { class: 'muted small' }, 'Program length'),
    segmented(APP.programLengths.map((d) => ({ value: d, label: `${d} days` })), draft.programDays, (v) => { draft.programDays = v; paint(); }, 'Program length'),
    h('p', { class: 'muted small' }, 'Daily session (hard cap)'),
    segmented(APP.sessionMinuteOptions.map((m) => ({ value: m, label: `${m} min` })), draft.sessionMinutes, (v) => { draft.sessionMinutes = v; paint(); }, 'Session length'),
    h('ul', { class: 'bullets small' },
      h('li', {}, 'Phase I (E): stance, jab/cross, teep, kicks, angles 1-5'),
      h('li', {}, 'Phase II (C): hooks, uppercuts, slips, knees, elbows, all 12 angles'),
      h('li', {}, 'Phase III (A): shadow rounds, flow drills, sinawali'),
      h('li', {}, 'Weekly: 2 boxing, 2 Muay Thai, 1 mixed, 1 weapons, 1 active-recovery day')));
  paint();
  return panel('SELECT PROGRAM', wrap, h('div', { class: 'row gap' }, backBtn(), nextBtn()));
}

function safetyStep() {
  const go = h('button', { class: 'btn primary big grow', disabled: !draft.agreed, onClick: finish }, 'AWAKEN');
  const cb = h('input', { type: 'checkbox', checked: draft.agreed, onChange: (e) => { draft.agreed = e.target.checked; go.disabled = !draft.agreed; } });
  return panel('EQUIPMENT & SAFETY',
    h('ul', { class: 'bullets' },
      h('li', {}, h('strong', {}, 'Training knife only'), ' - wooden, rubber or blunt aluminium trainer. Never a live blade.'),
      h('li', {}, h('strong', {}, 'Stick / rod'), ' - rattan, foam or a smooth wooden dowel, about 70 cm.'),
      h('li', {}, h('strong', {}, 'Space'), ' - 2 m clear around you and overhead. Non-slip floor.'),
      h('li', {}, 'Warm up every time. Stop if you feel pain, dizziness or chest discomfort.'),
      h('li', {}, 'This app is not medical advice. Check with a doctor before starting if you have any health condition.')),
    h('label', { class: 'row agree' }, cb, h('span', {}, 'I understand and train at my own risk.')),
    h('div', { class: 'row gap' }, backBtn(), go));
}

function finish() {
  const { store, today } = ctxRef;
  // Queue the welcome window first so it appears before any "title acquired" windows.
  systemAlert({ title: 'YOU HAVE AWAKENED', tone: 'gold', lines: [`Welcome, ${draft.name.trim()}.`, 'Your first Daily Quest has arrived.'] });
  store.update((s) => awaken(s, {
    name: draft.name,
    maxes: draft.maxes,
    stages: draft.stages,
    programDays: draft.programDays,
    sessionMinutes: draft.sessionMinutes,
    today,
  }));
  sfx('levelup');
  try { sessionStorage.setItem('arrived', today); } catch { /* ignore */ }
  ctxRef.go('home');
}
