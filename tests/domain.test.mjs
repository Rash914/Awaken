import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, dateKey, isDateKey } from '../src/js/core/dates.js';
import { buildDayPlan, phaseOf, dayType, WEEK } from '../src/js/domain/program.js';
import { afterSet, advance, canAdvance, initialTarget, questTarget, newEntry } from '../src/js/domain/strength.js';
import { levelFromXp, xpToNext, rankOf, computeProgress, currentStreak, bestStreak } from '../src/js/domain/leveling.js';
import { SessionRunner } from '../src/js/domain/session-runner.js';
import { DRILLS, DRILL_BY_ID, DISCIPLINES } from '../src/js/data/drills.js';
import { EXERCISES } from '../src/js/data/exercises.js';
import { VIDEOS } from '../src/js/data/videos.js';
import { APP } from '../src/js/config.js';

test('dates: add/diff across month, year and DST boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(diffDays('2026-03-01', '2026-04-01'), 31);
  assert.equal(diffDays('2026-11-01', '2026-10-25'), -7);
  assert.ok(isDateKey(dateKey()));
  assert.ok(!isDateKey('2026-9-1'));
});

test('program: every day of every length and budget fits the budget and never exceeds 10 minutes', () => {
  for (const programDays of APP.programLengths)
    for (const sessionMinutes of APP.sessionMinuteOptions)
      for (const includeStrength of [true, false])
        for (let day = 1; day <= programDays; day++) {
          const p = buildDayPlan(day, { programDays, sessionMinutes, includeStrength });
          assert.ok(p.totalSeconds <= sessionMinutes * 60, `day ${day} ${p.totalSeconds}s > ${sessionMinutes}m`);
          assert.ok(p.totalSeconds <= APP.maxSessionMinutes * 60);
          assert.ok(p.totalSeconds >= sessionMinutes * 60 - 5, `day ${day} underfilled ${p.totalSeconds}`);
          for (const s of p.segments) {
            assert.ok(s.seconds >= 30, `short segment ${s.title} ${s.seconds}`);
            if (s.kind === 'timed') {
              const d = DRILL_BY_ID[s.drillId];
              assert.ok(d, `unknown drill ${s.drillId}`);
              assert.ok(d.phase <= p.phase, `drill ${d.id} above phase`);
            }
          }
          const discs = new Set(p.segments.map((s) => s.disc));
          assert.ok(discs.has('knife') && discs.has('stick'), 'knife + stick every day');
          assert.ok(discs.has('boxing') || discs.has('muaythai'), 'striking every day');
          assert.equal(p.segments.filter((s) => s.kind === 'reps').length, includeStrength ? 3 : 0);
        }
});

test('program: phases split into thirds; weekly cycle', () => {
  assert.equal(phaseOf(1, 90), 0);
  assert.equal(phaseOf(30, 90), 0);
  assert.equal(phaseOf(31, 90), 1);
  assert.equal(phaseOf(61, 90), 2);
  assert.equal(phaseOf(90, 90), 2);
  assert.equal(phaseOf(11, 30), 1);
  assert.equal(dayType(1), WEEK[0]);
  assert.equal(dayType(8), WEEK[0]);
  assert.equal(dayType(7), 'recovery');
});

test('program: deterministic and varied', () => {
  const a = buildDayPlan(12, { programDays: 90 });
  assert.deepEqual(a, buildDayPlan(12, { programDays: 90 }));
  const ids = new Set();
  for (let d = 1; d <= 30; d++) buildDayPlan(d).segments.forEach((s) => s.drillId && ids.add(s.drillId));
  assert.ok(ids.size >= 10, `only ${ids.size} drills used in phase 0`);
});

test('strength: targets adapt with hysteresis and clamp', () => {
  assert.equal(initialTarget(20), 12);
  assert.equal(initialTarget(0), 3);
  assert.equal(initialTarget('abc'), 3);
  assert.equal(initialTarget(500), 60);
  let e = newEntry('pushup', 3, 20);
  e = afterSet(e, 12);
  assert.equal(e.target, 12);
  e = afterSet(e, 12);
  assert.equal(e.target, 13);
  e = afterSet(e, 20);
  e = afterSet(e, 20);
  assert.equal(e.target, 15);
  e = afterSet(e, 14); // near miss: hold
  assert.equal(e.target, 15);
  e = afterSet(e, 5);
  e = afterSet(e, 5);
  assert.equal(e.target, 14);
});

test('strength: class advancement only at threshold, halves target', () => {
  const at = EXERCISES.pushup.stages[3].advanceAt;
  const e = { stage: 3, target: at - 1, hits: 0, misses: 0 };
  assert.equal(canAdvance('pushup', e), false);
  const ready = { ...e, target: at };
  assert.ok(canAdvance('pushup', ready));
  const n = advance('pushup', ready);
  assert.equal(n.stage, 4);
  assert.equal(n.target, Math.round(at / 2));
  const last = { stage: EXERCISES.pushup.stages.length - 1, target: 60, hits: 0, misses: 0 };
  assert.equal(canAdvance('pushup', last), false);
});

test('strength: penalty and recovery targets', () => {
  const e = { stage: 3, target: 10, hits: 0, misses: 0 };
  assert.equal(questTarget(e), 10);
  assert.equal(questTarget(e, { penalty: true }), 12);
  assert.equal(questTarget(e, { recovery: true }), 6);
});

test('leveling: curve, ranks, streaks', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(99).level, 1);
  assert.equal(levelFromXp(100).level, 2);
  assert.equal(levelFromXp(100 + xpToNext(2)).level, 3);
  assert.equal(rankOf(1).id, 'E');
  assert.equal(rankOf(13).id, 'C');
  assert.equal(rankOf(99).id, 'S');
  const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05'];
  assert.equal(bestStreak(dates, addDays), 3);
  assert.equal(currentStreak(dates, '2026-01-05', addDays), 1);
  assert.equal(currentStreak(dates, '2026-01-06', addDays), 1);
  assert.equal(currentStreak(dates, '2026-01-07', addDays), 0);
});

test('leveling: quest bonus counted once per day, streak bonus grows', () => {
  const mk = (date, ts, complete = true) => ({ date, ts, secs: { boxing: 30 }, reps: {}, complete, penalty: false });
  const state = { logs: [{ ex: 'pushup', reps: 10 }], sessions: [mk('2026-01-01', 1), mk('2026-01-01', 2), mk('2026-01-02', 3)] };
  const p = computeProgress(state, addDays);
  // 10 reps + 3x(30s/3) + 100 + (100 + 5 streak)
  assert.equal(p.xp, 10 + 30 + 100 + 105);
  assert.equal(p.questsDone, 2);
  assert.equal(p.stats.STR, 10);
});

test('session runner: time-based progression, reps, skip, back', () => {
  let t = 0;
  const now = () => t;
  const segs = [
    { kind: 'timed', disc: 'warmup', seconds: 10 },
    { kind: 'reps', ex: 'pushup', seconds: 10 },
    { kind: 'timed', disc: 'knife', seconds: 10 },
  ];
  const r = new SessionRunner(segs, { now });
  r.start();
  t = 5000;
  assert.equal(r.tick(), null);
  assert.equal(Math.round(r.remaining()), 5);
  r.pause();
  t = 60000; // paused time does not count
  assert.equal(Math.round(r.remaining()), 5);
  r.start();
  t = 65000;
  assert.equal(r.tick(), 'next');
  assert.equal(r.i, 1);
  t = 80000;
  assert.equal(r.tick(), 'awaitReps');
  r.submitReps(14);
  assert.equal(r.i, 2);
  r.back();
  assert.equal(r.i, 1);
  r.submitReps(12);
  r.skip();
  assert.ok(r.finished);
  const s = r.summary();
  assert.equal(s.secs.warmup, 10);
  assert.equal(s.reps.pushup, 12);
  assert.equal(s.reachedEnd, true);
  assert.equal(r.progress(), 1);
});

test('session runner: quitting mid-block counts the partial block', () => {
  let t = 0;
  const r = new SessionRunner([{ kind: 'timed', disc: 'boxing', seconds: 60 }], { now: () => t });
  r.start();
  t = 25000;
  r.pause();
  assert.equal(r.summary().secs.boxing, 0);
  assert.equal(r.summary({ includeCurrent: true }).secs.boxing, 25);
  assert.equal(r.summary({ includeCurrent: true }).reachedEnd, false);
});

test('data: every drill/exercise video is in the verified registry', () => {
  const ids = [...DRILLS.flatMap((d) => d.videos), ...Object.values(EXERCISES).flatMap((e) => e.stages.flatMap((s) => s.videos))];
  for (const id of ids) assert.ok(VIDEOS[id], `unverified video ${id}`);
  for (const d of DRILLS) {
    assert.ok(DISCIPLINES[d.disc], d.id);
    assert.ok(d.cues.length >= 3 && d.how.length >= 3, d.id);
    if (d.disc === 'knife' || d.disc === 'stick') assert.ok(d.safety, `${d.id} needs safety note`);
  }
  assert.equal(new Set(DRILLS.map((d) => d.id)).size, DRILLS.length, 'duplicate drill id');
});
