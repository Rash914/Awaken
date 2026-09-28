// Daily Quest rules + every state transition (pure: take state, return new state).
import { addDays } from '../core/dates.js';
import { EXERCISE_IDS } from '../data/exercises.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { buildDayPlan, programDay } from './program.js';
import { afterSet, advance, canAdvance, newEntry, questTarget } from './strength.js';
import { bestStreak, computeProgress, currentStreak, questDates } from './leveling.js';

export const COMPLETE_RATIO = 0.6; // share of planned timed seconds needed to clear the quest

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function isQuestDone(state, date) {
  return state.sessions.some((s) => s.date === date && s.complete);
}

export function penaltyActive(state, today) {
  const start = state.program.startDate;
  if (!state.settings.penalty || !start) return false;
  const y = addDays(today, -1);
  const yDay = programDay(start, y);
  return yDay >= 1 && yDay <= state.settings.programDays && !isQuestDone(state, y);
}

/** Everything the home screen needs about today. */
export function todayInfo(state, today) {
  const { programDays, sessionMinutes, includeStrength } = state.settings;
  const start = state.program.startDate;
  const day = start ? programDay(start, today) : 0;
  const finished = day > programDays;
  // After the program ends, keep training on the final week's rotation until a new cycle starts.
  const planDay = finished ? programDays - 7 + ((day - 1) % 7) + 1 : Math.max(1, day);
  const plan = buildDayPlan(planDay, { programDays, sessionMinutes, includeStrength });
  const penalty = !finished && penaltyActive(state, today);
  const recovery = plan.type === 'recovery';
  const targets = Object.fromEntries(EXERCISE_IDS.map((ex) => [ex, questTarget(state.strength[ex], { penalty, recovery })]));
  return { day, planDay, programDays, finished, plan, penalty, recovery, targets, done: isQuestDone(state, today) };
}

export function awaken(state, { name, maxes, stages, programDays, sessionMinutes, today, now = Date.now() }) {
  const s = structuredClone(state);
  s.profile = { name: String(name || 'Hunter').trim().slice(0, 24) || 'Hunter', awakened: true, createdAt: now };
  s.settings.programDays = programDays;
  s.settings.sessionMinutes = sessionMinutes;
  s.program = { startDate: today, cycle: 1, completedCycles: 0 };
  s.baseline = { ...maxes, date: today };
  for (const ex of EXERCISE_IDS) {
    s.strength[ex] = newEntry(ex, stages[ex], maxes[ex]);
    s.startStages[ex] = s.strength[ex].stage;
  }
  return s;
}

/**
 * Store a finished (or abandoned) session.
 * @param results {{secs: Record<disc, number>, reps: Record<ex, number|null>, reachedEnd: boolean}}
 */
export function recordSession(state, { date, info, results, now = Date.now() }) {
  const s = structuredClone(state);
  const plannedTimed = info.plan.segments.filter((x) => x.kind === 'timed').reduce((a, x) => a + x.seconds, 0);
  const trained = Object.values(results.secs).reduce((a, n) => a + n, 0);
  const alreadyDone = isQuestDone(s, date);
  const complete = Boolean(results.reachedEnd) && trained >= plannedTimed * COMPLETE_RATIO;

  const reps = {};
  for (const ex of EXERCISE_IDS) {
    const r = results.reps[ex];
    if (r == null) continue;
    const n = Math.max(0, Math.min(1000, Math.floor(r)));
    reps[ex] = n;
    if (n > 0) s.logs.push({ id: uid(), date, ts: now, ex, stage: s.strength[ex].stage, reps: n, src: 'quest' });
    // Targets adapt once per day, from the first attempt only.
    if (!alreadyDone) s.strength[ex] = afterSet(s.strength[ex], n, info.targets[ex]);
  }

  const session = {
    id: uid(),
    date,
    ts: now,
    day: info.day,
    type: info.plan.type,
    secs: Object.fromEntries(Object.entries(results.secs).map(([k, v]) => [k, Math.round(v)])),
    reps,
    complete,
    penalty: complete && info.penalty && !alreadyDone,
  };
  s.sessions.push(session);
  return { state: s, session, firstClear: complete && !alreadyDone };
}

export function logManual(state, { ex, reps, date, now = Date.now() }) {
  const n = Math.floor(Number(reps));
  if (!EXERCISE_IDS.includes(ex) || !Number.isFinite(n) || n <= 0 || n > 1000) return state;
  const s = structuredClone(state);
  s.logs.push({ id: uid(), date, ts: now, ex, stage: s.strength[ex].stage, reps: n, src: 'manual' });
  return s;
}

export function deleteLog(state, id) {
  const s = structuredClone(state);
  s.logs = s.logs.filter((l) => l.id !== id);
  return s;
}

export function advanceStage(state, ex) {
  if (!canAdvance(ex, state.strength[ex])) return state;
  const s = structuredClone(state);
  s.strength[ex] = advance(ex, s.strength[ex]);
  return s;
}

export function setStage(state, ex, stage) {
  const s = structuredClone(state);
  s.strength[ex] = { ...s.strength[ex], stage, hits: 0, misses: 0 };
  return s;
}

export function restartProgram(state, { today, programDays }) {
  const s = structuredClone(state);
  const finished = s.program.startDate && programDay(s.program.startDate, today) > s.settings.programDays;
  s.settings.programDays = programDays;
  s.program = {
    startDate: today,
    cycle: s.program.cycle + 1,
    completedCycles: s.program.completedCycles + (finished ? 1 : 0),
  };
  return s;
}

export function progressContext(state, today) {
  const progress = computeProgress(state, addDays);
  const dates = questDates(state);
  const start = state.program.startDate;
  const stageUps = EXERCISE_IDS.reduce((a, ex) => a + Math.max(0, state.strength[ex].stage - state.startStages[ex]), 0);
  return {
    state,
    progress,
    streak: currentStreak(dates, today, addDays),
    best: bestStreak(dates, addDays),
    stageUps,
    programDone: state.program.completedCycles > 0 || Boolean(start && programDay(start, today) > state.settings.programDays),
  };
}

export function achievementsFor(ctx) {
  return ACHIEVEMENTS.filter((a) => {
    try {
      return Boolean(a.test(ctx));
    } catch {
      return false;
    }
  });
}
