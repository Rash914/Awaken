import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createMemoryStorage, defaultState, migrate } from '../src/js/core/store.js';
import { awaken, recordSession, todayInfo, penaltyActive, logManual, deleteLog, advanceStage, restartProgram, progressContext, achievementsFor, isQuestDone } from '../src/js/domain/quest.js';
import { addDays } from '../src/js/core/dates.js';

const TODAY = '2026-10-01';
const woke = () =>
  awaken(defaultState(), {
    name: 'Jin',
    maxes: { pushup: 20, squat: 30, crunch: 25 },
    stages: { pushup: 3, squat: 1, crunch: 0 },
    programDays: 30,
    sessionMinutes: 10,
    today: TODAY,
    now: 1,
  });

const fullResults = (info, reps) => {
  const secs = {};
  info.plan.segments.filter((s) => s.kind === 'timed').forEach((s) => (secs[s.disc] = (secs[s.disc] || 0) + s.seconds));
  return { secs, reps, reachedEnd: true };
};

test('migrate: garbage in, valid state out', () => {
  for (const junk of [null, 42, 'x', [], { schema: 'bad', logs: 'no', sessions: [{}], strength: { pushup: { stage: 99, target: -5 } } }]) {
    const s = migrate(junk);
    assert.equal(s.schema, 1);
    assert.ok(Array.isArray(s.logs) && Array.isArray(s.sessions));
    assert.ok(s.strength.pushup.stage <= 6 && s.strength.pushup.target >= 3);
  }
  const bad = migrate({ logs: [{ ex: 'pushup', date: '2026-01-01', ts: 1, reps: 5 }, { ex: 'nope', date: '2026-01-01', ts: 1, reps: 5 }] });
  assert.equal(bad.logs.length, 1);
});

test('store: persists, survives corrupt storage and quota errors', () => {
  const mem = createMemoryStorage();
  const a = createStore({ storage: mem });
  a.update((s) => { s.profile.name = 'Sung'; });
  const b = createStore({ storage: mem });
  assert.equal(b.get().profile.name, 'Sung');

  mem.setItem('awaken.state', '{broken');
  let err = 0;
  const c = createStore({ storage: mem, onError: () => err++ });
  assert.equal(c.get().profile.name, '');
  assert.equal(err, 1);

  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const d = createStore({ storage: full, onError: () => err++ });
  d.update((s) => { s.profile.name = 'X'; });
  assert.equal(d.get().profile.name, 'X');
});

test('awaken: sets program, baseline, targets', () => {
  const s = woke();
  assert.ok(s.profile.awakened);
  assert.equal(s.program.startDate, TODAY);
  assert.equal(s.strength.pushup.target, 12);
  const info = todayInfo(s, TODAY);
  assert.equal(info.day, 1);
  assert.equal(info.penalty, false);
  assert.equal(info.targets.pushup, 12);
});

test('quest: completion, one bonus per day, targets adapt once per day', () => {
  let s = woke();
  const info = todayInfo(s, TODAY);
  const r1 = recordSession(s, { date: TODAY, info, results: fullResults(info, { pushup: 12, squat: 18, crunch: 15 }), now: 10 });
  assert.ok(r1.firstClear && r1.session.complete);
  s = r1.state;
  assert.ok(isQuestDone(s, TODAY));
  assert.equal(s.logs.length, 3);
  assert.equal(s.strength.pushup.hits, 1);
  const r2 = recordSession(s, { date: TODAY, info, results: fullResults(info, { pushup: 12, squat: 18, crunch: 15 }), now: 11 });
  assert.equal(r2.firstClear, false);
  assert.equal(r2.state.strength.pushup.hits, 1, 'second run same day does not move targets');
});

test('quest: quitting early or skipping most of it is not a clear', () => {
  const s = woke();
  const info = todayInfo(s, TODAY);
  const quit = recordSession(s, { date: TODAY, info, results: { ...fullResults(info, {}), reachedEnd: false } });
  assert.equal(quit.session.complete, false);
  const skipped = recordSession(s, { date: TODAY, info, results: { secs: { warmup: 60 }, reps: {}, reachedEnd: true } });
  assert.equal(skipped.session.complete, false);
});

test('penalty: missed yesterday -> penalty today (+20% reps), clearing it is recorded', () => {
  let s = woke();
  const d3 = addDays(TODAY, 2);
  assert.equal(penaltyActive(s, TODAY), false, 'no penalty on day 1');
  assert.equal(penaltyActive(s, d3), true);
  const info = todayInfo(s, d3);
  assert.equal(info.targets.pushup, Math.ceil(12 * 1.2));
  const r = recordSession(s, { date: d3, info, results: fullResults(info, { pushup: 15, squat: 22, crunch: 18 }) });
  assert.ok(r.session.penalty);
  s = r.state;
  const ctx = progressContext(s, d3);
  assert.equal(ctx.progress.penaltiesCleared, 1);
  assert.ok(achievementsFor(ctx).some((a) => a.id === 'survivor'));
  s.settings.penalty = false;
  assert.equal(penaltyActive(s, addDays(TODAY, 5)), false);
});

test('program end: keeps serving final-week plans, restart bumps cycle', () => {
  let s = woke();
  const after = addDays(TODAY, 40);
  const info = todayInfo(s, after);
  assert.ok(info.finished);
  assert.equal(info.plan.phase, 2);
  assert.equal(info.penalty, false);
  assert.ok(progressContext(s, after).programDone);
  s = restartProgram(s, { today: after, programDays: 60 });
  assert.equal(s.program.cycle, 2);
  assert.equal(s.program.completedCycles, 1);
  assert.equal(todayInfo(s, after).day, 1);
});

test('manual logs + delete + stage advance guard', () => {
  let s = woke();
  s = logManual(s, { ex: 'squat', reps: 25, date: TODAY });
  s = logManual(s, { ex: 'squat', reps: -3, date: TODAY });
  s = logManual(s, { ex: 'burpee', reps: 3, date: TODAY });
  assert.equal(s.logs.length, 1);
  s = deleteLog(s, s.logs[0].id);
  assert.equal(s.logs.length, 0);
  assert.equal(advanceStage(s, 'pushup'), s, 'not eligible -> unchanged');
  s.strength.pushup.target = 25;
  const up = advanceStage(s, 'pushup');
  assert.equal(up.strength.pushup.stage, 4);
  assert.ok(achievementsFor(progressContext(up, TODAY)).some((a) => a.id === 'class-up'));
});
