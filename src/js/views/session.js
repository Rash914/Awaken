// Guided session: interval timer, voice callouts, rep logging, rewards screen.
// The session survives navigation (paused) until finished or quit.
import { h, fmtTime, bar, stepper } from '../ui/dom.js';
import { SessionRunner } from '../domain/session-runner.js';
import { recordSession, progressContext, achievementsFor, todayInfo } from '../domain/quest.js';
import { STATS } from '../domain/leveling.js';
import { DISCIPLINES, DRILL_BY_ID } from '../data/drills.js';
import { EXERCISES, stageOf } from '../data/exercises.js';
import { VIDEOS } from '../data/videos.js';
import { sfx, speak, unlockAudio } from '../services/audio.js';
import { keepAwake } from '../services/platform.js';
import { systemConfirm } from '../ui/system.js';

export const live = false; // manages its own DOM; store changes don't re-render it

const RING_C = 2 * Math.PI * 54;
let active = null; // { runner, info, date, started, repsDraft, awaiting }
let timer = null;
let root = null;
let refs = {};
let ctxRef = null;

export const activeSession = () => (active && active.started && !active.runner.finished ? active : null);

export function render(ctx) {
  ctxRef = ctx;
  if (!active) {
    const info = todayInfo(ctx.state, ctx.today);
    active = { runner: new SessionRunner(info.plan.segments), info, date: ctx.today, started: false, repsDraft: { ...info.targets }, awaiting: false, cue: -1, beep: null };
  }
  root = h('div', { class: 'session' });
  draw();
  clearInterval(timer);
  timer = setInterval(loop, 200);
  return root;
}

export function unmount() {
  clearInterval(timer);
  timer = null;
  if (active) {
    active.runner.pause();
    if (!active.started) active = null; // never began: drop it so a fresh plan loads next time
  }
  keepAwake(false);
}

function segVideo(seg) {
  if (seg.kind === 'reps') return stageOf(seg.ex, ctxRef.state.strength[seg.ex].stage).videos;
  return DRILL_BY_ID[seg.drillId].videos;
}

function videoLinks(ids, query) {
  return h('div', { class: 'videos' },
    ids.map((id) => h('a', { class: 'video', href: `https://www.youtube.com/watch?v=${id}`, target: '_blank', rel: 'noopener noreferrer' },
      h('span', { class: 'play', 'aria-hidden': 'true' }, '▶'),
      h('span', {}, VIDEOS[id]?.title || 'Watch on YouTube', h('small', { class: 'muted block' }, VIDEOS[id]?.author || '')))),
    query ? h('a', { class: 'small muted', href: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, target: '_blank', rel: 'noopener noreferrer' }, 'More videos on YouTube →') : null);
}

function header() {
  const r = active.runner;
  return h('div', { class: 'ses-top' },
    h('button', { class: 'btn icon', 'aria-label': 'Quit session', onClick: quit }, '✕'),
    h('div', { class: 'grow' },
      h('div', { class: 'small muted' }, `BLOCK ${r.i + 1}/${r.segments.length} · DAY ${active.info.day}`),
      (refs.total = bar(r.progress(), 'thin'))),
    h('button', { class: 'btn icon', 'aria-label': 'Minimise', onClick: () => ctxRef.go('home') }, '▾'));
}

function draw() {
  refs = {};
  if (!active.started) return root.replaceChildren(readyScreen());
  const r = active.runner;
  const seg = r.current;
  const isReps = seg.kind === 'reps';
  const disc = isReps ? null : DISCIPLINES[seg.disc];
  const drill = isReps ? null : DRILL_BY_ID[seg.drillId];
  const ex = isReps ? EXERCISES[seg.ex] : null;
  const stage = isReps ? stageOf(seg.ex, ctxRef.state.strength[seg.ex].stage) : null;
  const next = r.segments[r.i + 1];

  refs.time = h('div', { class: 'ring-time mono' }, fmtTime(r.remaining()));
  refs.arc = h('svg:circle', { class: 'ring-arc', cx: 60, cy: 60, r: 54, 'stroke-dasharray': RING_C, 'stroke-dashoffset': 0, style: { stroke: disc?.color || 'var(--glow)' } });
  const ring = h('div', { class: 'ring' },
    h('svg:svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' },
      h('svg:circle', { class: 'ring-bg', cx: 60, cy: 60, r: 54 }), refs.arc),
    refs.time);

  let center;
  if (isReps) {
    const target = active.info.targets[seg.ex];
    center = h('div', { class: 'reps-box' },
      h('div', { class: 'muted small' }, 'TARGET'),
      h('div', { class: 'reps-target glow mono' }, target),
      h('div', { class: 'muted small' }, 'Reps done'),
      stepper(active.repsDraft[seg.ex] ?? target, { min: 0, max: 300, label: `${ex.name} reps`, onChange: (n) => { active.repsDraft[seg.ex] = n; } }),
      (refs.awaitMsg = h('div', { class: ['small', 'gold', !active.awaiting && 'hidden'] }, 'Time! Log your reps.')),
      h('button', { class: 'btn primary big', onClick: () => { submitReps(seg.ex); } }, 'DONE'));
  } else {
    refs.cue = h('div', { class: 'cue', 'aria-live': 'polite' }, 'Get set');
    center = refs.cue;
  }

  root.replaceChildren(
    header(),
    h('div', { class: 'ses-disc', style: { color: disc?.color || 'var(--glow)' } }, isReps ? `STRENGTH · ${ex.stat}` : disc.name.toUpperCase()),
    h('h1', { class: 'ses-title' }, isReps ? `${ex.name}: ${stage.name}` : drill.name),
    ring,
    center,
    h('div', { class: 'controls' },
      h('button', { class: 'btn icon lg', 'aria-label': 'Previous block', onClick: () => { r.back(); onSegmentChange(); } }, '⏮'),
      (refs.play = h('button', { class: 'btn icon xl primary', 'aria-label': r.running ? 'Pause' : 'Play', onClick: togglePlay }, r.running ? '❚❚' : '▶')),
      h('button', { class: 'btn icon lg', 'aria-label': 'Skip block', onClick: () => { r.skip(); onSegmentChange(); } }, '⏭')),
    next ? h('p', { class: 'muted small center' }, 'Next: ', next.kind === 'reps' ? EXERCISES[next.ex].name : next.title) : h('p', { class: 'muted small center' }, 'Final block'),
    h('details', { class: 'howto' },
      h('summary', {}, 'How to do it'),
      h('ol', {}, (isReps ? stage.how : drill.how).map((s) => h('li', {}, s))),
      drill?.safety ? h('p', { class: 'warn small' }, drill.safety) : null,
      videoLinks(segVideo(seg), isReps ? `${stage.name} proper form` : `${drill.name} ${disc.name} tutorial`)),
  );
  update();
}

function readyScreen() {
  const { info } = active;
  return h('div', { class: 'stack' },
    header(),
    h('div', { class: 'win' },
      h('div', { class: 'win-b center' },
        h('p', { class: 'muted small' }, '[ SYSTEM ]'),
        h('h1', { class: 'glow' }, info.plan.typeName.toUpperCase()),
        h('p', {}, `${info.plan.segments.length} blocks · ${fmtTime(info.plan.totalSeconds)} total`),
        info.penalty ? h('p', { class: 'danger-t' }, 'PENALTY ACTIVE: rep targets +20%') : null,
        h('p', { class: 'muted small' }, 'Clear space around you. Weapons blocks use a training knife and a stick/rod only. Voice calls combos - turn your volume up.'),
        h('button', { class: 'btn primary big', onClick: begin }, 'BEGIN'))));
}

function begin() {
  unlockAudio();
  active.started = true;
  active.runner.start();
  keepAwake(true);
  onSegmentChange();
}

function togglePlay() {
  unlockAudio();
  active.runner.toggle();
  keepAwake(active.runner.running);
  refs.play.textContent = active.runner.running ? '❚❚' : '▶';
  refs.play.setAttribute('aria-label', active.runner.running ? 'Pause' : 'Play');
}

function submitReps(ex) {
  active.runner.submitReps(active.repsDraft[ex] ?? active.info.targets[ex]);
  onSegmentChange();
}

function onSegmentChange() {
  active.awaiting = false;
  active.cue = -1;
  active.beep = null;
  if (active.runner.finished) return finish();
  const seg = active.runner.current;
  sfx('go');
  navigator.vibrate?.(120);
  speak(seg.kind === 'reps' ? `${EXERCISES[seg.ex].name}. ${active.info.targets[seg.ex]} reps.` : seg.title.replace(/:/, '.'));
  draw();
}

function update() {
  const r = active.runner;
  const seg = r.current;
  if (!refs.time || !seg) return;
  const rem = r.remaining();
  refs.time.textContent = fmtTime(rem);
  refs.arc.setAttribute('stroke-dashoffset', String(RING_C * (1 - rem / seg.seconds)));
  refs.total?.firstChild && (refs.total.firstChild.style.width = `${r.progress() * 100}%`);

  if (seg.kind === 'timed' && refs.cue) {
    const drill = DRILL_BY_ID[seg.drillId];
    const every = seg.disc === 'warmup' || seg.disc === 'mobility' ? 8 : 5;
    const el = r.elapsed();
    const idx = el < 3 ? -1 : Math.floor((el - 3) / every);
    if (idx !== active.cue) {
      active.cue = idx;
      const text = idx < 0 ? 'Get set' : drill.cues[idx % drill.cues.length];
      refs.cue.textContent = text;
      refs.cue.classList.remove('pop');
      void refs.cue.offsetWidth;
      refs.cue.classList.add('pop');
      if (idx >= 0 && r.running && rem > 2) speak(text);
    }
  }
  const s = Math.ceil(rem);
  if (r.running && s <= 3 && s > 0 && active.beep !== s) {
    active.beep = s;
    sfx('tick');
  }
}

function loop() {
  if (!active?.started || !root?.isConnected) return;
  const ev = active.runner.tick();
  if (ev === 'next' || ev === 'done') return onSegmentChange();
  if (ev === 'awaitReps' && !active.awaiting) {
    active.awaiting = true;
    refs.awaitMsg?.classList.remove('hidden');
    sfx('notify');
    navigator.vibrate?.([100, 80, 100]);
  }
  update();
}

async function quit() {
  const r = active.runner;
  if (active.started) r.pause();
  const sum = r.summary({ includeCurrent: true });
  const trained = Object.values(sum.secs).reduce((a, n) => a + n, 0) > 0 || Object.keys(sum.reps).length > 0;
  if (active.started && trained) {
    const ok = await systemConfirm('ABANDON QUEST?', 'Progress so far is saved and earns EXP, but the Daily Quest will not be cleared.', { confirm: 'Quit', danger: true });
    if (!ok) return;
    ctxRef.store.update((s) => recordSession(s, { date: active.date, info: active.info, results: { ...sum, reachedEnd: false } }).state);
  }
  active = null;
  keepAwake(false);
  ctxRef.go('home');
}

function finish() {
  clearInterval(timer);
  keepAwake(false);
  const { store, today } = ctxRef;
  const before = progressContext(store.get(), today);
  const beforeTitles = new Set(achievementsFor(before).map((a) => a.id));
  const done = active;
  active = null;
  let res;
  store.update((s) => {
    res = recordSession(s, { date: done.date, info: done.info, results: done.runner.summary() });
    return res.state;
  });
  const after = progressContext(store.get(), today);
  const newTitles = achievementsFor(after).filter((a) => !beforeTitles.has(a.id));
  const leveled = after.progress.level > before.progress.level;
  sfx(leveled ? 'levelup' : res.session.complete ? 'notify' : 'alert');
  speak(res.session.complete ? 'Quest cleared.' : 'Session saved.');

  const gained = after.progress.xp - before.progress.xp;
  const summary = h('div', { class: 'stack summary' },
    h('div', { class: ['win', res.session.complete ? 'gold' : ''] },
      h('div', { class: 'win-b center' },
        h('p', { class: 'muted small' }, '[ SYSTEM ]'),
        h('h1', { class: res.session.complete ? 'gold glow' : '' }, res.firstClear ? 'QUEST CLEARED' : res.session.complete ? 'TRAINING COMPLETE' : 'SESSION SAVED'),
        !res.session.complete ? h('p', { class: 'muted' }, 'Not enough of the plan was completed to clear the quest.') : null,
        res.session.penalty ? h('p', { class: 'gold' }, 'Penalty survived. +50 EXP bonus.') : null,
        h('p', { class: 'reward mono' }, `+${gained} EXP`),
        leveled ? h('p', { class: 'gold big-t' }, `LEVEL UP! ${before.progress.level} → ${after.progress.level}`) : null,
        after.progress.rank.id !== before.progress.rank.id ? h('p', { class: 'gold' }, `Rank up: ${after.progress.rank.name}`) : null,
        bar(after.progress.into / after.progress.need, 'xp'),
        h('div', { class: 'stats' }, STATS.map((st) => {
          const d = after.progress.stats[st.id] - before.progress.stats[st.id];
          return h('div', { class: 'stat' }, h('span', { class: 'muted' }, st.id), h('strong', {}, after.progress.stats[st.id]), d > 0 ? h('small', { class: 'gold' }, ` +${d}`) : null);
        })),
        newTitles.map((a) => h('p', { class: 'gold' }, `Title acquired: [${a.title}]`)),
        h('button', { class: 'btn primary big', onClick: () => ctxRef.go('home') }, 'RETURN'))));
  root.replaceChildren(summary);
}
